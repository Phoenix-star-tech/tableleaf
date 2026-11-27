create or replace function public.complete_restaurant_signup(p_name text,p_phone text,p_location_id bigint,p_location_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  rid uuid;
  existing_slug text;
  desired_slug text;
begin
  perform 1 from auth.users where id=uid and email_confirmed_at is not null
    and is_anonymous is not true and deleted_at is null for update;
  if not found then raise insufficient_privilege using message='Sign in with your confirmed email to create a restaurant'; end if;
  p_name := trim(p_name);
  p_location_name := trim(p_location_name);
  if coalesce(length(p_name),0) not between 1 and 100
    or p_phone is null or p_phone !~ '^\+?[0-9]{7,15}$'
    or coalesce(p_location_id,0)<=0
    or coalesce(length(p_location_name),0) not between 1 and 250 then
    raise exception 'Enter a restaurant name, valid phone number and location';
  end if;
  desired_slug := trim(both '-' from regexp_replace(regexp_replace(regexp_replace(lower(p_name), '[^a-z0-9[:space:]-]', '', 'g'), '[[:space:]]+', '-', 'g'), '-+', '-', 'g'));
  if desired_slug in ('','demo') then raise exception 'Choose a different restaurant name'; end if;
  select id,slug into rid,existing_slug from public.restaurants where owner_id=uid
    order by (slug=desired_slug) desc,created_at,id limit 1;
  if found then
    if existing_slug=desired_slug then return rid; end if;
    raise exception 'This account already owns a restaurant. Sign in to open it.';
  end if;
  insert into public.restaurants(owner_id,name,slug,phone_number,location_id,location_name)
    values(uid,p_name,desired_slug,p_phone,p_location_id,p_location_name)
    on conflict(slug) do nothing returning id into rid;
  if rid is null then raise exception 'That menu URL is taken. Change the restaurant name.'; end if;
  insert into public.tables(restaurant_id,table_no) select rid,generate_series(1,10);
  insert into public.staff(restaurant_id,user_id,role) values(rid,uid,'owner');
  return rid;
end $$;
revoke all on function public.complete_restaurant_signup(text,text,bigint,text) from public,anon;
grant execute on function public.complete_restaurant_signup(text,text,bigint,text) to authenticated;
