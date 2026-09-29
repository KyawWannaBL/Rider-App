-- V176 permission hardening:
-- Keep the team-confirmation table private and expose it only through
-- authenticated, assignment-checked RPCs.

alter function public.be_field_team_confirm_delivery_v146(jsonb) security definer;
alter function public.be_field_team_confirm_delivery_v146(jsonb)
  set search_path = public, auth, pg_temp;

revoke all on function public.be_field_team_confirm_delivery_v146(jsonb) from public, anon;
grant execute on function public.be_field_team_confirm_delivery_v146(jsonb) to authenticated;

revoke all on public.be_delivery_team_confirmations_v176 from anon, authenticated;
