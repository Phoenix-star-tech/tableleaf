alter table public.menu_ads add column if not exists destination_url text
  check (length(destination_url)<=2048 and destination_url ~* '^https?://[^/[:space:]]+' and destination_url !~ '[[:space:][:cntrl:]]');

drop function if exists public.active_menu_ads(uuid);
create function public.active_menu_ads(restaurant uuid)
returns table(id uuid,title text,image_path text,ends_at timestamptz,destination_url text)
language sql stable security definer set search_path='' as $$
 select a.id,a.title,a.image_path,a.ends_at,a.destination_url
 from public.menu_ads a join public.restaurants r on r.id=restaurant
 where (a.location_id is null or a.location_id=r.location_id)
 and now()>=a.starts_at and now()<a.ends_at
 order by a.starts_at desc,a.id
$$;
revoke all on function public.active_menu_ads(uuid) from public;
grant execute on function public.active_menu_ads(uuid) to anon,authenticated;
