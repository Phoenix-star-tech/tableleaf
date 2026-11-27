create or replace function private.activate_invited_platform_admin() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if lower(new.email)='vashikrestaurantadmin@gmail.com'
     and new.invited_at is not null and new.email_confirmed_at is not null
     and new.deleted_at is null and new.is_anonymous is not true then
    insert into private.platform_admins(user_id) values(new.id) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function private.activate_invited_platform_admin() from public, anon, authenticated;
create or replace trigger activate_invited_platform_admin after insert or update of email_confirmed_at on auth.users
for each row execute function private.activate_invited_platform_admin();
