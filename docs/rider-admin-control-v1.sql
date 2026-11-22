-- RELEASE BLOCKER (2026-11-23): production's
-- public.be_app_notification_visible_to_current_user returns TRUE whenever
-- the authenticated requester has no active field-team mapping. The
-- be_app_notifications_field_safe_select_v88 RLS policy calls this function;
-- therefore direct Rider Admin messages could be visible to unrelated
-- non-field users. The INSERT policy also allows any authenticated user.
-- This draft now proposes restrictive recipient and INSERT policies for
-- RIDER_ADMIN_MESSAGE; they are NOT deployed or security-tested. Validate
-- with actual rider, admin, unrelated employee, and anon sessions in UAT.
-- Moreover, the admin snapshot caps at 1,500 jobs / 750 settlement rows;
-- the UI must signal truncation and use paging before totals are authoritative.
--
-- Review-only Rider Admin control RPCs. DO NOT run against production before
-- UAT tests, security review and migration-history alignment.
-- Both functions fail closed unless the logged-in Supabase Auth UID is linked to
-- the APPROVED Rider App superadmin profile for rideradmin@britiumexpress.com.
-- No cross-rider authorization is granted to ordinary workforce accounts.
begin;

-- The existing permissive SELECT/UPDATE policies can OR together.
-- Restrictive policies are ANDed against ALL permissive policies and prevent
-- Rider Admin message leakage, including to non-field Enterprise accounts.
-- These policies do not attempt to change legacy notification visibility.
-- New messages carry the fixed notification_type RIDER_ADMIN_MESSAGE.
drop policy if exists be_rider_admin_message_recipient_select_v1 on public.be_app_notifications;
create policy be_rider_admin_message_recipient_select_v1
on public.be_app_notifications as restrictive
for select to authenticated
using (
  coalesce(notification_type,'') <> 'RIDER_ADMIN_MESSAGE'
  or target_user_id = (select auth.uid())::text
);

drop policy if exists be_rider_admin_message_recipient_update_v1 on public.be_app_notifications;
create policy be_rider_admin_message_recipient_update_v1
on public.be_app_notifications as restrictive
for update to authenticated
using (
  coalesce(notification_type,'') <> 'RIDER_ADMIN_MESSAGE'
  or target_user_id = (select auth.uid())::text
)
with check (
  coalesce(notification_type,'') <> 'RIDER_ADMIN_MESSAGE'
  or target_user_id = (select auth.uid())::text
);

-- Existing broad INSERT policies would otherwise permit ordinary users to
-- impersonate an Admin message. Only the active designated Rider Admin may
-- create rows bearing this reserved notification_type.
drop policy if exists be_rider_admin_message_authored_insert_v1 on public.be_app_notifications;
create policy be_rider_admin_message_authored_insert_v1
on public.be_app_notifications as restrictive
for insert to authenticated
with check (
  coalesce(notification_type,'') <> 'RIDER_ADMIN_MESSAGE'
  or (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.be_rider_auth_profiles a
      where a.auth_user_id = (select auth.uid())
        and lower(a.email) = 'rideradmin@britiumexpress.com'
        and lower(a.role) = 'superadmin'
        and lower(a.status) = 'active'
    )
  )
);

create or replace function public.be_rider_admin_control_snapshot_v1(
  p_from date default (current_date - 14),
  p_to date default current_date
) returns jsonb
language plpgsql stable security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_from date := coalesce(p_from,current_date-14);
  v_to date := coalesce(p_to,current_date);
  v_workers jsonb := '[]'::jsonb;
  v_jobs jsonb := '[]'::jsonb;
  v_settlements jsonb := '[]'::jsonb;
begin
  if v_uid is null or not exists (
    select 1 from public.be_rider_auth_profiles a
    where a.auth_user_id = v_uid and lower(a.email) = 'rideradmin@britiumexpress.com'
    and lower(a.role) = 'superadmin' and lower(a.status) = 'active'
  ) then
    raise exception 'RIDER_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if v_from > v_to or v_to - v_from > 92 or v_to > current_date + 1 then
    raise exception 'INVALID_REPORT_RANGE' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(to_jsonb(w) order by w.display_name),'[]'::jsonb)
  into v_workers from (
    select distinct on (coalesce(w.auth_user_id::text, w.id::text, w.worker_id))
      coalesce(nullif(w.workforce_code,''),nullif(w.worker_code,''),nullif(w.account_code,''),w.worker_id) as worker_code,
      coalesce(nullif(w.display_name,''),nullif(w.full_name,''),nullif(w.name,''),'Unnamed') as display_name,
      lower(coalesce(nullif(w.role,''),nullif(w.workforce_type,''),nullif(w.role_type,''),'rider')) as workforce_role,
      coalesce(nullif(w.branch_code,''),nullif(w.assigned_branch,''),'') as branch_code,
      w.auth_user_id,
      lower(coalesce(nullif(w.email,''),nullif(w.user_email,''),'')) as email,
      (coalesce(w.active,true) and coalesce(w.is_active,true)) as active,
      w.updated_at
    from public.be_mobile_workforce_accounts w
    where lower(coalesce(nullif(w.role,''),nullif(w.workforce_type,''),nullif(w.role_type,''),'rider')) in ('rider','driver','helper')
    order by coalesce(w.auth_user_id::text, w.id::text, w.worker_id),w.updated_at desc nulls last
  ) w;

  select coalesce(jsonb_agg(to_jsonb(j) order by j.dispatched_at desc nulls last,j.wayplan_id),'[]'::jsonb)
  into v_jobs from (
    select
      j.wayplan_id,j.delivery_way_id,j.pickup_id,j.rider_code,j.driver_code,j.helper_code,
      j.rider_name,j.driver_name,j.helper_name,j.wayplan_status,
      j.stop_status,j.rider_status,j.dispatched_at,j.delivered_at,
      j.cod_amount,j.cod_collected,j.failed_reason,
      (j.rider_proof_url is not null and j.rider_proof_url <> '') as has_proof
    from public.be_v_rider_delivery_wayplan_jobs j
    where coalesce(j.dispatched_at,j.wayplan_created_at)::date between v_from and v_to
    order by j.dispatched_at desc nulls last,j.wayplan_id
    limit 1500
  ) j;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.work_date desc,f.wayplan_id),'[]'::jsonb)
  into v_settlements from (
    select work_date,wayplan_id,rider_code,driver_code,helper_code,
      rider_name,driver_name,helper_name,total_ways,delivered_ways,failed_ways,
      remaining_ways,expected_cod,actual_collected,variance_amount,status,
      opened_at,cleared_at
    from public.be_field_finance_settlements_v1
    where work_date between v_from and v_to
    order by work_date desc,wayplan_id
    limit 750
  ) f;

  return jsonb_build_object(
    'ok',true,'scope','RIDER_ADMIN_VERIFIED','generated_at',now(),
    'from',v_from,'to',v_to,
    'workforce',v_workers,'jobs',v_jobs,'settlements',v_settlements,
    'jobs_limit',1500,'settlements_limit',750,
    'jobs_may_be_truncated',jsonb_array_length(v_jobs)>=1500,
    'settlements_may_be_truncated',jsonb_array_length(v_settlements)>=750,
    'limitations','Usage exceptions are derived from assigned wayplan progress, not login telemetry. Job and finance rows are bounded.'
  );
end
$$;

revoke all on function public.be_rider_admin_control_snapshot_v1(date,date) from public,anon;
grant execute on function public.be_rider_admin_control_snapshot_v1(date,date) to authenticated;

create or replace function public.be_rider_admin_send_message_v1(
  p_target_user_id uuid,
  p_title text,
  p_message text,
  p_broadcast boolean default false
) returns jsonb
language plpgsql volatile security definer
set search_path = public,auth,pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title,''));
  v_message text := btrim(coalesce(p_message,''));
  v_count integer := 0;
begin
  if v_uid is null or not exists (
    select 1 from public.be_rider_auth_profiles a
    where a.auth_user_id = v_uid and lower(a.email)='rideradmin@britiumexpress.com'
    and lower(a.role)='superadmin' and lower(a.status)='active'
  ) then
    raise exception 'RIDER_ADMIN_REQUIRED' using errcode='42501';
  end if;
  if length(v_title) not between 4 and 120 or length(v_message) not between 5 and 2000 then
    raise exception 'INVALID_MESSAGE_LENGTH' using errcode='22023';
  end if;
  if not p_broadcast and p_target_user_id is null then
    raise exception 'TARGET_REQUIRED' using errcode='22023';
  end if;
  insert into public.be_app_notifications (
    title,message,body,notification_type,category,priority,status,is_read,
    target_user_id,target_workforce_code,target_user_code,target_email,target_user_email,
    recipient_email,source_table,source_key,event_type,event_key,metadata,created_at
  )
  select v_title,v_message,v_message,'RIDER_ADMIN_MESSAGE','general','NORMAL','unread',false,
    w.auth_user_id::text,w.worker_code,w.worker_code,w.email,w.email,w.email,
    'rider_admin_command_center','rider_admin',
    'RIDER_ADMIN_MESSAGE','rider_admin_message:'||gen_random_uuid()::text,
    jsonb_build_object('sender_auth_user_id',v_uid,'scope',case when p_broadcast then 'ALL_STAFF' else 'DIRECT' end),
    now()
  from (
    select distinct on (w.auth_user_id) w.auth_user_id,
      coalesce(nullif(w.workforce_code,''),nullif(w.worker_code,''),nullif(w.account_code,''),w.worker_id) worker_code,
      lower(coalesce(nullif(w.email,''),nullif(w.user_email,''),'')) email
    from public.be_mobile_workforce_accounts w
    where w.auth_user_id is not null and coalesce(w.active,true) and coalesce(w.is_active,true)
      and lower(coalesce(nullif(w.role,''),nullif(w.workforce_type,''),nullif(w.role_type,''),'rider')) in ('rider','driver','helper')
      and (p_broadcast or w.auth_user_id = p_target_user_id)
    order by w.auth_user_id,w.updated_at desc nulls last
  ) w;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'NO_ELIGIBLE_STAFF_RECIPIENTS' using errcode='22023';
  end if;
  return jsonb_build_object('ok',true,'sent',v_count,'broadcast',p_broadcast);
end
$$;

revoke all on function public.be_rider_admin_send_message_v1(uuid,text,text,boolean) from public,anon;
grant execute on function public.be_rider_admin_send_message_v1(uuid,text,text,boolean) to authenticated;
commit;

-- Required UAT checks before applying to production:
-- 1. Logged-out call => 42501; rider/driver/helper JWT => 42501.
-- 2. Active Rider Admin JWT => summary, all branches, no UI bypass.
-- 3. Direct message reaches only specified Auth UID; broadcast fans out once
--    per active mapped workforce Auth UID; notification read state is per row.
-- 4. Verify no recipient payload exposes unrelated rider work via RLS.
-- 5. Test date limits, disabled recipients, unmapped accounts and replay.
-- 6. Check restrictive SELECT+UPDATE under each existing permissive policy:
--    admin message targeted to Rider A must never appear to Rider B,
--    unmapped employee or unrelated admin (even under a broad policy).
-- 7. Test INSERT impersonation by ordinary authenticated users: rejected.
-- 8. Confirm legacy non-admin notices remain visible where intended.
-- 9. Frontend must flag jobs_may_be_truncated/settlements_may_be_truncated
--    and avoid implying that capped numbers are complete.
