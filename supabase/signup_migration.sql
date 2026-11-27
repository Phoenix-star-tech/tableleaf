-- Run this in the Supabase SQL Editor AFTER setup.sql.
-- It adds a server-side function that lets a newly signed-up user
-- create their restaurant, seed 10 tables, and register as owner.

create or replace function public.create_restaurant(
  p_name text,
  p_slug text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
begin
  -- Must be a real authenticated user (not anonymous)
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists(select 1 from auth.users where id = uid and coalesce(is_anonymous, false)) then
    raise exception 'Anonymous users cannot create restaurants';
  end if;

  -- One restaurant per owner
  if exists(select 1 from restaurants where owner_id = uid) then
    raise exception 'You already own a restaurant. Sign in instead.';
  end if;

  -- Validate slug format (lowercase letters, digits, hyphens)
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Slug must be lowercase letters, digits and hyphens (e.g. my-restaurant)';
  end if;

  if p_slug = 'demo' then
    raise exception 'The slug "demo" is reserved';
  end if;

  -- Create restaurant
  insert into restaurants(owner_id, name, slug)
  values (uid, p_name, p_slug)
  returning id into rid;

  -- Seed 10 tables
  insert into tables(restaurant_id, table_no)
  select rid, generate_series(1, 10);

  -- Register user as owner in staff table
  insert into staff(restaurant_id, user_id, role)
  values (rid, uid, 'owner');

  return rid;
end;
$$;

