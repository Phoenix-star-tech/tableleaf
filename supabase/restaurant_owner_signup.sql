alter table public.restaurants add column if not exists phone_number text;

create or replace function private.register_restaurant_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  restaurant_name text := trim(new.raw_user_meta_data->>'restaurant_name');
  phone text := new.raw_user_meta_data->>'restaurant_phone';
  slug text;
  rid uuid;
begin
  if restaurant_name is null or new.email is null or new.is_anonymous is true then
    return new;
  end if;
  if phone is null or phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'Invalid restaurant phone number';
  end if;
  slug := trim(both '-' from regexp_replace(regexp_replace(regexp_replace(lower(restaurant_name), '[^a-z0-9[:space:]-]', '', 'g'), '[[:space:]]+', '-', 'g'), '-+', '-', 'g'));
  if slug = '' or slug = 'demo' then raise exception 'Invalid restaurant slug'; end if;
  insert into public.restaurants(owner_id,name,slug,phone_number)
    values(new.id,restaurant_name,slug,phone) returning id into rid;
  insert into public.tables(restaurant_id,table_no) select rid,generate_series(1,10);
  insert into public.staff(restaurant_id,user_id,role) values(rid,new.id,'owner');
  return new;
end;
$$;
revoke all on function private.register_restaurant_owner() from public, anon, authenticated;
drop trigger if exists register_tableleaf_restaurant on auth.users;
create trigger register_tableleaf_restaurant after insert on auth.users
for each row execute function private.register_restaurant_owner();
