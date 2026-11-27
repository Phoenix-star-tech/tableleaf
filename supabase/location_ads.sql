alter table public.restaurants add column if not exists location_id bigint, add column if not exists location_name text;
create or replace function private.set_signup_location() returns trigger language plpgsql security definer set search_path='' as $$
declare meta jsonb;
begin
 select raw_user_meta_data into meta from auth.users where id=new.owner_id;
 if meta ? 'restaurant_name' and new.location_id is null then
   new.location_id := (meta->>'location_id')::bigint;
   new.location_name := trim(meta->>'location_name');
   if coalesce(new.location_id,0)<=0 or coalesce(length(new.location_name),0) not between 1 and 250 then raise exception 'Choose a restaurant location'; end if;
 end if;
 return new;
end $$;
revoke all on function private.set_signup_location() from public,anon,authenticated;
drop trigger if exists set_signup_location on public.restaurants;
create trigger set_signup_location before insert on public.restaurants for each row execute function private.set_signup_location();

create table if not exists public.menu_ads (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 1 and 100),
 image_path text not null unique, location_id bigint, location_name text,
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at)
);
alter table public.menu_ads enable row level security;
revoke all on public.menu_ads from public,anon,authenticated;
grant select,insert,delete on public.menu_ads to authenticated;
create or replace function private.can_manage_ads() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from private.platform_admins where user_id=auth.uid())
$$;
revoke all on function private.can_manage_ads() from public,anon;
grant execute on function private.can_manage_ads() to authenticated;
drop policy if exists platform_ads on public.menu_ads;
create policy platform_ads on public.menu_ads to authenticated using(private.can_manage_ads()) with check(private.can_manage_ads());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('menu-ads','menu-ads',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists manage_ad_images on storage.objects;
create policy manage_ad_images on storage.objects to authenticated using(bucket_id='menu-ads' and private.can_manage_ads()) with check(bucket_id='menu-ads' and private.can_manage_ads());
create or replace function public.active_menu_ads(restaurant uuid) returns table(id uuid,title text,image_path text,ends_at timestamptz)
language sql stable security definer set search_path='' as $$
 select a.id,a.title,a.image_path,a.ends_at from public.menu_ads a join public.restaurants r on r.id=restaurant
 where (a.location_id is null or a.location_id=r.location_id) and now()>=a.starts_at and now()<a.ends_at order by a.starts_at desc,a.id
$$;
revoke all on function public.active_menu_ads(uuid) from public;
grant execute on function public.active_menu_ads(uuid) to anon,authenticated;
