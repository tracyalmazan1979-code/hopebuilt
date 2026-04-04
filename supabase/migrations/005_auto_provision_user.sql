-- ============================================================
-- Migration 005: Auto-provision user profile on first login
-- Creates a row in public.users when a new auth.users row appears
-- ============================================================

-- Function: create a public.users row from auth.users metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  default_org_id uuid;
begin
  -- Use the first active organization as default
  -- In a multi-tenant setup, this should be derived from invite/signup metadata
  select id into default_org_id
    from public.organizations
    where active = true
    order by created_at asc
    limit 1;

  insert into public.users (id, org_id, full_name, email, role)
  values (
    new.id,
    default_org_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'read_only'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Trigger: fire after insert on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
