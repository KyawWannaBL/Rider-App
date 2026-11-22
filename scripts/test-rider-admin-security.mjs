import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const sql=readFileSync(new URL("../docs/rider-admin-control-v1.sql",import.meta.url),"utf8");
const ui=readFileSync(new URL("../src/pages/RiderAdminPage.tsx",import.meta.url),"utf8");
const auth=readFileSync(new URL("../src/contexts/AuthContext.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");

test("admin rights are taken from the authenticated profile RPC, never client email matching alone",()=>{
  assert.match(auth,/be_rider_admin_profile_snapshot_v1/);
  assert.match(app,/profile\?\.admin_mode===true/);
  assert.match(app,/profile\?\.admin_mode!==true/);
  assert.match(sql,/a\.auth_user_id = v_uid/);
  assert.match(sql,/lower\(a\.role\)\s*=\s*'superadmin'/);
  assert.match(sql,/lower\(a\.status\)\s*=\s*'active'/);
});
test("all-staff snapshot exposes only whitelisted columns and bounded date ranges",()=>{
  assert.match(sql,/INVALID_REPORT_RANGE/);
  assert.match(sql,/v_to\s*-\s*v_from\s*>\s*92/);
  assert.match(sql,/limit 1500/);
  assert.match(sql,/limit 750/);
  assert.match(sql,/jobs_may_be_truncated/);
  assert.match(sql,/settlements_may_be_truncated/);
  assert.match(ui,/jobs_may_be_truncated\|\|snapshot\.settlements_may_be_truncated/);
});
test("admin messages use restrictive recipient-only read and write protections",()=>{
  for(const permission of ["select","update","insert"]){
    assert.match(sql,new RegExp("be_rider_admin_message_\\w+"+permission+"_v1"));
  }
  assert.match(sql,/on public\.be_app_notifications as restrictive/);
  assert.match(sql,/target_user_id = \(select auth\.uid\(\)\)::text/g);
  assert.match(sql,/coalesce\(notification_type,''\) <> 'RIDER_ADMIN_MESSAGE'/);
  assert.match(sql,/RIDER_ADMIN_REQUIRED/);
  assert.match(sql,/revoke all on function public\.be_rider_admin_send_message_v1/);
});
test("broadcast requires explicit confirmation and messages require a recipient",()=>{
  assert.match(ui,/broadcastConfirmed/);
  assert.match(ui,/!broadcastConfirmed/);
  assert.match(ui,/p_target_user_id:broadcast\?null:targetId/);
  assert.match(sql,/NO_ELIGIBLE_STAFF_RECIPIENTS/);
  assert.match(sql,/TARGET_REQUIRED/);
});
