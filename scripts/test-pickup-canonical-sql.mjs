import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import test, { after } from 'node:test';
const moduleName = process.env.PGLITE_MODULE;
const { PGlite } = await import(moduleName ? pathToFileURL(moduleName).href : '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
create schema auth;
create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
create function public.be_current_field_team_identity() returns jsonb language sql as $$select '{"role":"rider","worker_code":"SYNTHETIC","email":"synthetic@example.test"}'::jsonb$$;
create function public.be_rider_assert_assigned_pickup(text) returns uuid language plpgsql as $$begin if $1='UNASSIGNED' then raise exception 'NOT_ASSIGNED'; end if; return auth.uid(); end$$;
create function public.be_rider_authoritative_expected_count_v59(text) returns integer language sql as $$select 99$$;
create table public.be_delivery_way_id_registry(delivery_way_id text primary key,pickup_id text not null,parcel_sequence integer not null,unique(pickup_id,parcel_sequence));
create table public.be_delivery_way_id_aliases_v33(pickup_id text,parcel_sequence integer,canonical_way_id text);
create table public.be_pickup_parcel_verifications(
 id uuid primary key default gen_random_uuid(), pickup_id text, parcel_sequence integer,
 delivery_way_id text,tracking_no text,waybill_no text,actual_weight_kg numeric,parcel_weight_kg numeric,
 proof_photo_path text,proof_photo_url text,proof_file_name text,signature_url text,remarks text,
 verification_status text,proof_check_status text,submitted_by text,submitted_at timestamptz,
 created_at timestamptz,updated_at timestamptz,reviewed_by text,reviewed_by_email text,reviewed_at timestamptz,review_note text,qr_payload text);
create table public.be_portal_cargo_events(
 id uuid primary key default gen_random_uuid(),pickup_id text,delivery_way_id text,deliver_way_id text unique,tracking_no text unique,tracking_number text,
 event_type text,event_status text,event_note text,actor_role text,actor_type text,actor_code text,actor_email text,source_module text,source_table text,source_key text,
 proof_url text,weight_kg numeric,field_pickup_checked boolean,field_pickup_checked_at timestamptz,field_pickup_checked_by text,
 field_pickup_photo_url text,field_pickup_weight_kg numeric,pickup_verification_status text,pickup_verification_note text,metadata jsonb,created_at timestamptz,updated_at timestamptz);
`);
await db.exec(await fs.readFile(new URL('./fixtures/pickup-capture-live-20261021.sql', import.meta.url), 'utf8')).catch(error => { throw new Error(error.message); });
await db.exec("create role synthetic_client; revoke execute on function public.be_pickup_parcel_capture_save(jsonb) from public; grant execute on function public.be_pickup_parcel_capture_save(jsonb) to synthetic_client;");
const beforeAcl = await db.query("select proacl::text acl from pg_proc where proname='be_pickup_parcel_capture_save'");
if (!process.argv.includes('--baseline')) {
 const migration = (await fs.readdir(new URL('../supabase/migrations/',import.meta.url))).find(name=>name.endsWith('_rider_pickup_canonical_capture_sync.sql'));
 await db.exec(await fs.readFile(new URL(`../supabase/migrations/${migration}`,import.meta.url),'utf8')).catch(error => { throw new Error(error.message); });
}
const reset = () => db.exec('truncate public.be_delivery_way_id_registry,public.be_delivery_way_id_aliases_v33,public.be_pickup_parcel_verifications,public.be_portal_cargo_events;');
const save = async (pickup,line=1,extra={}) => (await db.query('select public.be_pickup_parcel_capture_save($1::jsonb) result',[JSON.stringify({pickup_id:pickup,line_no:line,parcel_weight:2,cargo_photo_url:`https://proof.test/${pickup}/${line}`, ...extra})])).rows[0].result;

test('actual capture wrapper allocates separate IDs for two same-day merchant pickups without explicit IDs',async()=>{
 await reset(); const a=await save('P1020-M001-001'); const b=await save('P1020-M001-002');
 assert.notEqual(a.delivery_way_id,b.delivery_way_id);
 const {rows}=await db.query('select pickup_id,delivery_way_id,tracking_no from public.be_portal_cargo_events order by pickup_id');
 assert.equal(rows.length,2); assert.equal(rows[0].delivery_way_id,a.delivery_way_id); assert.equal(rows[1].tracking_no,b.delivery_way_id);
 assert.equal(a.temp_qr_code,'TQR-P1020-M001-001-001'); assert.equal(b.temp_qr_code,'TQR-P1020-M001-002-001');
});
test('old callers supplying the same provisional D ID cannot block the second pickup',async()=>{
 await reset(); const provisional={delivery_way_id:'D1020-M001-001',waybill_no:'W1020-M001-001'};
 const a=await save('P1020-M001-001',1,provisional); const b=await save('P1020-M001-002',1,provisional);
 assert.equal(a.delivery_way_id,'D1020-M001-001'); assert.equal(b.delivery_way_id,'D1020-M001-002');
 assert.notEqual(b.waybill_no,'W1020-M001-001');
});
test('legacy unregistered saved D001..014 remain untouched when allocating missing proof',async()=>{
 await reset();
 await db.exec(`insert into public.be_pickup_parcel_verifications(pickup_id,parcel_sequence,delivery_way_id,actual_weight_kg,parcel_weight_kg,proof_photo_url,proof_photo_path,proof_check_status)
 select 'P1020-M001-001',n,'D1020-M001-'||lpad(n::text,3,'0'),2,2,'https://legacy/'||n,'https://legacy/'||n,'APPROVED' from generate_series(1,11)n;
 insert into public.be_portal_cargo_events(pickup_id,delivery_way_id,tracking_no,proof_url,weight_kg)
 select 'P1020-M001-001','D1020-M001-'||lpad(n::text,3,'0'),'D1020-M001-'||lpad(n::text,3,'0'),'https://legacy/'||n,4 from generate_series(12,14)n;`);
 const prior = await db.query("select to_jsonb(v) row from public.be_pickup_parcel_verifications v order by parcel_sequence");
 const events = await db.query("select to_jsonb(e) row from public.be_portal_cargo_events e order by tracking_no");
 const result=await save('P1020-M001-001',12); assert.equal(result.delivery_way_id,'D1020-M001-015');
 assert.deepEqual((await db.query("select to_jsonb(v) row from public.be_pickup_parcel_verifications v where pickup_id='P1020-M001-001' and parcel_sequence<=11 order by parcel_sequence")).rows,prior.rows);
 assert.deepEqual((await db.query("select to_jsonb(e) row from public.be_portal_cargo_events e where pickup_id='P1020-M001-001' and tracking_no<>'D1020-M001-015' order by tracking_no")).rows,events.rows);
});
test('retry preserves established saved IDs and updates only its own cargo-event line',async()=>{
 await reset();
 await db.exec(`insert into public.be_pickup_parcel_verifications(pickup_id,parcel_sequence,delivery_way_id,waybill_no,actual_weight_kg,proof_photo_url,proof_check_status)
 values ('P1020-M001-001',1,'D1020-M001-009','W-EXISTING',2,'https://proof/old','APPROVED');
 insert into public.be_portal_cargo_events(pickup_id,delivery_way_id,tracking_no,proof_url,weight_kg) values
 ('P1020-M001-001','D1020-M001-009','D1020-M001-009','https://proof/old',2),
 ('P1020-M001-001','D1020-M001-010','D1020-M001-010','https://proof/other',4);`);
 const r=await save('P1020-M001-001',1,{delivery_way_id:'D1020-M001-001',waybill_no:'W-PROVISIONAL'});
 assert.equal(r.delivery_way_id,'D1020-M001-009'); assert.equal(r.waybill_no,'W-EXISTING');
 const rows=(await db.query('select tracking_no,proof_url,weight_kg from public.be_portal_cargo_events order by tracking_no')).rows;
 assert.equal(rows[1].proof_url,'https://proof/other'); assert.equal(Number(rows[1].weight_kg),4);
 assert.equal(rows[0].proof_url,'https://proof.test/P1020-M001-001/1');
});
test('existing alias and registry allocation are preserved',async()=>{
 await reset(); await db.exec("insert into public.be_delivery_way_id_aliases_v33 values ('P1020-M001-001',1,'D1020-M001-050');");
 assert.equal((await save('P1020-M001-001')).delivery_way_id,'D1020-M001-050');
 await db.exec("insert into public.be_delivery_way_id_registry values ('D1020-M001-060','P1020-M001-002',1);");
 assert.equal((await save('P1020-M001-002')).delivery_way_id,'D1020-M001-060');
});
test('another pickup cannot allocate an ID reserved by a canonical alias',async()=>{
 await reset(); await db.exec("insert into public.be_delivery_way_id_aliases_v33 values ('P1020-M001-001',1,'D1020-M001-001');");
 assert.equal((await save('P1020-M001-002')).delivery_way_id,'D1020-M001-002');
 assert.equal((await save('P1020-M001-001')).delivery_way_id,'D1020-M001-001');
});
test('assignment/weight/sequence validation and existing function ACL remain intact',async()=>{
 await reset(); await assert.rejects(save('UNASSIGNED'),/NOT_ASSIGNED/);
 await assert.rejects(save('P1020-M001-001',1,{parcel_weight:0}),/weight/i);
 await assert.rejects(save('P1020-M001-001',100),/EXCEEDS_EXPECTED_COUNT/);
 assert.deepEqual((await db.query("select proacl::text acl from pg_proc where proname='be_pickup_parcel_capture_save'")).rows,beforeAcl.rows);
});
test('exhausted three-digit stem fails clearly without rewriting historical events',async()=>{
 await reset(); await db.exec(`insert into public.be_portal_cargo_events(pickup_id,delivery_way_id,tracking_no)
 select 'P1020-M001-001','D1020-M001-'||lpad(n::text,3,'0'),'D1020-M001-'||lpad(n::text,3,'0') from generate_series(1,999)n;`);
 await assert.rejects(save('P1020-M001-002'),/NAMESPACE_EXHAUSTED/);
 assert.equal((await db.query('select count(*) n from public.be_portal_cargo_events')).rows[0].n,999);
});
after(async () => { await db.close(); });
