-- Read-only pg_get_functiondef snapshot from dltavabvjwocknkyvwgz.
-- Regression baseline only; never apply this fixture to production.
CREATE OR REPLACE FUNCTION public.be_allocate_delivery_way_id(p_pickup_id text, p_parcel_sequence integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_known text;
BEGIN
  SELECT a.canonical_way_id INTO v_known
    FROM public.be_delivery_way_id_aliases_v33 a
   WHERE upper(a.pickup_id)=upper(btrim(coalesce(p_pickup_id,'')))
     AND a.parcel_sequence=p_parcel_sequence
   LIMIT 1;
  IF v_known IS NOT NULL THEN RETURN v_known; END IF;
  RETURN public.be_allocate_delivery_way_id_legacy_v33(p_pickup_id,p_parcel_sequence);
END;
$function$;

CREATE OR REPLACE FUNCTION public.be_allocate_delivery_way_id_legacy_v33(p_pickup_id text, p_parcel_sequence integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_pickup_id text := upper(nullif(btrim(p_pickup_id), ''));
  v_sequence integer := p_parcel_sequence;
  v_stem text;
  v_candidate text;
  v_existing text;
  v_next integer;
begin
  if v_pickup_id is null or coalesce(v_sequence, 0) < 1 then
    raise exception 'pickup_id and a positive parcel_sequence are required.';
  end if;

  select r.delivery_way_id
    into v_existing
  from public.be_delivery_way_id_registry r
  where r.pickup_id = v_pickup_id
    and r.parcel_sequence = v_sequence;

  if v_existing is not null then
    return v_existing;
  end if;

  v_stem := public.be_delivery_way_stem(v_pickup_id);

  -- Serialize allocations within the same date/merchant DeliveryWayID stem.
  perform pg_advisory_xact_lock(hashtext(v_stem));

  select r.delivery_way_id
    into v_existing
  from public.be_delivery_way_id_registry r
  where r.pickup_id = v_pickup_id
    and r.parcel_sequence = v_sequence;

  if v_existing is not null then
    return v_existing;
  end if;

  v_candidate := v_stem || lpad(v_sequence::text, 3, '0');

  insert into public.be_delivery_way_id_registry (
    delivery_way_id,
    pickup_id,
    parcel_sequence
  )
  values (
    v_candidate,
    v_pickup_id,
    v_sequence
  )
  on conflict do nothing;

  if found then
    return v_candidate;
  end if;

  select coalesce(
    max(
      case
        when r.delivery_way_id ~ ('^' || v_stem || '[0-9]+$')
          then substring(r.delivery_way_id from '([0-9]+)$')::integer
        else 0
      end
    ),
    0
  ) + 1
    into v_next
  from public.be_delivery_way_id_registry r
  where r.delivery_way_id like v_stem || '%';

  loop
    v_candidate := v_stem || lpad(v_next::text, 3, '0');

    insert into public.be_delivery_way_id_registry (
      delivery_way_id,
      pickup_id,
      parcel_sequence
    )
    values (
      v_candidate,
      v_pickup_id,
      v_sequence
    )
    on conflict do nothing;

    if found then
      return v_candidate;
    end if;

    select r.delivery_way_id
      into v_existing
    from public.be_delivery_way_id_registry r
    where r.pickup_id = v_pickup_id
      and r.parcel_sequence = v_sequence;

    if v_existing is not null then
      return v_existing;
    end if;

    v_next := v_next + 1;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.be_delivery_way_stem(p_pickup_id text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_pickup_id text := upper(nullif(btrim(p_pickup_id), ''));
  v_parts text[];
begin
  if v_pickup_id is null then
    raise exception 'pickup_id is required.';
  end if;

  v_parts := regexp_split_to_array(v_pickup_id, '-');

  if coalesce(array_length(v_parts, 1), 0) >= 3
     and left(v_parts[1], 1) = 'P' then
    return 'D' || substr(v_parts[1], 2) || '-' || v_parts[2] || '-';
  end if;

  return 'D' || regexp_replace(v_pickup_id, '^P', '') || '-';
end;
$function$;

CREATE OR REPLACE FUNCTION public.be_pickup_parcel_capture_save(p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_identity jsonb:=public.be_current_field_team_identity();
  v_pickup text:=nullif(btrim(coalesce(p_payload->>'pickup_id',p_payload->>'pickup_way_id','')),'');
  v_seq integer:=coalesce(nullif(p_payload->>'line_no','')::integer,nullif(p_payload->>'row_no','')::integer,0);
  v_weight numeric:=coalesce(nullif(p_payload->>'parcel_weight','')::numeric,nullif(p_payload->>'actual_weight_kg','')::numeric,0);
  v_delivery text:=nullif(upper(btrim(coalesce(p_payload->>'delivery_way_id',''))),'');
  v_waybill text:=nullif(btrim(coalesce(p_payload->>'waybill_no','')),'');
  v_proof text:=nullif(btrim(coalesce(p_payload->>'cargo_photo_url',p_payload->>'proof_url','')),'');
  v_result jsonb;
begin
  if v_pickup is null then raise exception 'pickup_id is required'; end if;
  perform public.be_rider_assert_assigned_pickup(v_pickup);

  if v_seq<1 then raise exception 'parcel line number is required'; end if;
  if v_weight<=0 then raise exception 'Actual parcel weight must be greater than zero'; end if;
  if v_proof is null then raise exception 'Approved cargo photo upload is required'; end if;

  v_result:=public.be_rider_upsert_parcel_proof(
    v_pickup,
    v_seq,
    v_weight,
    v_proof,
    v_delivery,
    coalesce(v_delivery,v_waybill),
    v_waybill,
    nullif(btrim(coalesce(p_payload->>'remarks','')),''),
    nullif(btrim(coalesce(p_payload->>'cargo_photo_name',p_payload->>'proof_file_name','')),''),
    null
  );

  update public.be_portal_cargo_events e
  set field_pickup_checked=true,
      field_pickup_checked_at=now(),
      field_pickup_checked_by=v_identity->>'worker_code',
      field_pickup_photo_url=v_proof,
      field_pickup_weight_kg=v_weight,
      pickup_verification_status=case
        when e.field_pickup_photo_url is not distinct from v_proof
          and upper(coalesce(e.pickup_verification_status,'')) in ('APPROVED','VERIFIED')
        then e.pickup_verification_status
        else 'PENDING_REVIEW'
      end,
      pickup_verification_note=nullif(btrim(coalesce(p_payload->>'remarks','')),''),
      updated_at=now()
  where e.pickup_id=v_pickup
    and (
      v_delivery is null
      or upper(coalesce(e.delivery_way_id,e.deliver_way_id,e.tracking_no,e.tracking_number,''))=v_delivery
    );

  insert into public.be_portal_cargo_events(
    pickup_id,delivery_way_id,tracking_no,event_type,event_status,event_note,
    actor_role,actor_type,actor_code,actor_email,source_module,source_table,source_key,
    proof_url,weight_kg,field_pickup_checked,field_pickup_checked_at,field_pickup_checked_by,
    field_pickup_photo_url,field_pickup_weight_kg,pickup_verification_status,pickup_verification_note,
    metadata,created_at,updated_at
  ) values (
    v_pickup,v_delivery,coalesce(v_delivery,v_waybill),
    'PICKUP_PARCEL_VERIFIED','PENDING_REVIEW','Rider submitted parcel proof for Enterprise review.',
    coalesce(v_identity->>'role','rider'),coalesce(v_identity->>'role','rider'),
    v_identity->>'worker_code',v_identity->>'email','RIDER_APP','be_pickup_parcel_verifications',
    v_pickup||':'||v_seq::text,v_proof,v_weight,true,now(),v_identity->>'worker_code',
    v_proof,v_weight,'PENDING_REVIEW',nullif(btrim(coalesce(p_payload->>'remarks','')),''),
    jsonb_build_object('parcel_sequence',v_seq,'waybill_no',v_waybill,'source','RIDER_ENTERPRISE_V89'),
    now(),now()
  )
  on conflict (tracking_no) do update set
    field_pickup_checked=true,
    field_pickup_checked_at=excluded.field_pickup_checked_at,
    field_pickup_checked_by=excluded.field_pickup_checked_by,
    field_pickup_photo_url=excluded.field_pickup_photo_url,
    field_pickup_weight_kg=excluded.field_pickup_weight_kg,
    proof_url=excluded.proof_url,
    weight_kg=excluded.weight_kg,
    pickup_verification_status=case
      when public.be_portal_cargo_events.field_pickup_photo_url is not distinct from excluded.field_pickup_photo_url
        and upper(coalesce(public.be_portal_cargo_events.pickup_verification_status,'')) in ('APPROVED','VERIFIED')
      then public.be_portal_cargo_events.pickup_verification_status
      else excluded.pickup_verification_status
    end,
    pickup_verification_note=excluded.pickup_verification_note,
    metadata=coalesce(public.be_portal_cargo_events.metadata,'{}'::jsonb)||excluded.metadata,
    updated_at=now()
  where public.be_portal_cargo_events.pickup_id=excluded.pickup_id;

  if not found then
    raise exception 'TRACKING_NO_BELONGS_TO_ANOTHER_PICKUP: %',coalesce(v_delivery,v_waybill) using errcode='23505';
  end if;

  return v_result||jsonb_build_object(
    'photo_status',coalesce((
      select pv.proof_check_status from public.be_pickup_parcel_verifications pv
      where pv.pickup_id=v_pickup and pv.parcel_sequence=v_seq
      order by pv.updated_at desc nulls last limit 1
    ),'PENDING_REVIEW'),
    'enterprise_event_synced',true,
    'worker_code',v_identity->>'worker_code'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.be_rider_upsert_parcel_proof(p_pickup_id text, p_parcel_sequence integer, p_actual_weight_kg numeric, p_proof_url text, p_delivery_way_id text DEFAULT NULL::text, p_tracking_no text DEFAULT NULL::text, p_waybill_no text DEFAULT NULL::text, p_remarks text DEFAULT NULL::text, p_proof_file_name text DEFAULT NULL::text, p_signature_url text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_existing_id uuid;
  v_submitted_by text := coalesce(auth.uid()::text, 'SYSTEM');
  v_expected_count integer;
  v_delivery_way_id text;
  v_review_status text;
begin
  if nullif(btrim(p_pickup_id), '') is null then
    raise exception 'pickup_id is required.';
  end if;

  if coalesce(p_parcel_sequence, 0) < 1 then
    raise exception 'A valid parcel sequence is required.';
  end if;

  v_expected_count := public.be_rider_authoritative_expected_count_v59(p_pickup_id);
  if p_parcel_sequence > v_expected_count then
    raise exception
      'RIDER_PARCEL_SEQUENCE_EXCEEDS_EXPECTED_COUNT: pickup %, sequence %, expected 1..%',
      btrim(p_pickup_id), p_parcel_sequence, v_expected_count;
  end if;

  if coalesce(p_actual_weight_kg, 0) <= 0 then
    raise exception 'Actual parcel weight must be greater than zero.';
  end if;

  if nullif(btrim(p_proof_url), '') is null then
    raise exception 'A pickup proof photo is required.';
  end if;

  v_delivery_way_id := coalesce(
    nullif(btrim(p_delivery_way_id), ''),
    public.be_allocate_delivery_way_id(btrim(p_pickup_id), p_parcel_sequence)
  );

  select v.id
    into v_existing_id
  from public.be_pickup_parcel_verifications v
  where v.pickup_id = btrim(p_pickup_id)
    and v.parcel_sequence = p_parcel_sequence
  order by v.updated_at desc nulls last, v.created_at desc nulls last, v.id
  limit 1
  for update;

  if v_existing_id is null then
    insert into public.be_pickup_parcel_verifications (
      pickup_id,
      parcel_sequence,
      delivery_way_id,
      tracking_no,
      waybill_no,
      actual_weight_kg,
      parcel_weight_kg,
      proof_photo_path,
      proof_photo_url,
      proof_file_name,
      signature_url,
      remarks,
      verification_status,
      proof_check_status,
      submitted_by,
      submitted_at,
      created_at,
      updated_at
    )
    values (
      btrim(p_pickup_id),
      p_parcel_sequence,
      v_delivery_way_id,
      nullif(btrim(p_tracking_no), ''),
      nullif(btrim(p_waybill_no), ''),
      p_actual_weight_kg,
      p_actual_weight_kg,
      btrim(p_proof_url),
      btrim(p_proof_url),
      nullif(btrim(p_proof_file_name), ''),
      nullif(btrim(p_signature_url), ''),
      nullif(btrim(p_remarks), ''),
      'RIDER_SUBMITTED',
      'PENDING_REVIEW',
      v_submitted_by,
      now(),
      now(),
      now()
    )
    returning id into v_existing_id;
  else
    update public.be_pickup_parcel_verifications v
    set
      delivery_way_id = coalesce(nullif(btrim(v_delivery_way_id), ''), v.delivery_way_id),
      tracking_no = coalesce(nullif(btrim(p_tracking_no), ''), v.tracking_no),
      waybill_no = coalesce(nullif(btrim(p_waybill_no), ''), v.waybill_no),
      actual_weight_kg = p_actual_weight_kg,
      parcel_weight_kg = p_actual_weight_kg,
      proof_photo_path = btrim(p_proof_url),
      proof_photo_url = btrim(p_proof_url),
      proof_file_name = coalesce(nullif(btrim(p_proof_file_name), ''), v.proof_file_name),
      signature_url = coalesce(nullif(btrim(p_signature_url), ''), v.signature_url),
      remarks = coalesce(nullif(btrim(p_remarks), ''), v.remarks),
      verification_status = case
        when v.proof_photo_url is not distinct from btrim(p_proof_url)
          and upper(coalesce(v.verification_status, '')) in ('APPROVED', 'VERIFIED', 'REUPLOAD_REQUIRED', 'PHOTO_REJECTED', 'REJECTED')
          then v.verification_status
        else 'RIDER_SUBMITTED'
      end,
      proof_check_status = case
        when v.proof_photo_url is not distinct from btrim(p_proof_url)
          and upper(coalesce(v.proof_check_status, '')) in ('APPROVED', 'VERIFIED', 'REUPLOAD_REQUIRED', 'PHOTO_REJECTED', 'REJECTED')
          then v.proof_check_status
        else 'PENDING_REVIEW'
      end,
      submitted_by = v_submitted_by,
      submitted_at = now(),
      reviewed_by = case when v.proof_photo_url is distinct from btrim(p_proof_url) then null else v.reviewed_by end,
      reviewed_by_email = case when v.proof_photo_url is distinct from btrim(p_proof_url) then null else v.reviewed_by_email end,
      reviewed_at = case when v.proof_photo_url is distinct from btrim(p_proof_url) then null else v.reviewed_at end,
      review_note = case when v.proof_photo_url is distinct from btrim(p_proof_url) then null else v.review_note end,
      updated_at = now()
    where v.id = v_existing_id;
  end if;

  select proof_check_status into v_review_status from public.be_pickup_parcel_verifications where id=v_existing_id;
  return jsonb_build_object(
    'ok', true,
    'pickup_id', btrim(p_pickup_id),
    'parcel_sequence', p_parcel_sequence,
    'delivery_way_id', v_delivery_way_id,
    'actual_weight_kg', p_actual_weight_kg,
    'proof_url', btrim(p_proof_url),
    'review_status', v_review_status
  );
end;
$function$;
