create table if not exists private.platform_admins (user_id uuid primary key references auth.users on delete cascade);
create table if not exists private.menu_visits (
 restaurant_id uuid references public.restaurants on delete cascade,
 table_no integer not null, visitor uuid not null, bucket timestamptz not null,
 primary key(restaurant_id,bucket,table_no,visitor)
);
revoke all on private.platform_admins,private.menu_visits from public,anon,authenticated;

create or replace function public.record_menu_visit(r uuid,t integer) returns void
language sql security definer set search_path='' as $$
 insert into private.menu_visits
 select r,t,auth.uid(),date_bin('5 minutes',now(),'2000-01-01'::timestamptz)
 where auth.uid() is not null and exists(select from public.tables where restaurant_id=r and table_no=t and active)
 on conflict do nothing
$$;

create or replace function public.platform_report(days integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare since timestamptz := now()-make_interval(days=>days);
begin
 if not exists(select from private.platform_admins where user_id=auth.uid()) then
   raise insufficient_privilege using message='Platform administrator access required';
 end if;
 if days is null or days not in (1,7,30,90) then raise exception 'Invalid reporting period'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object(
 'email',u.email,
 'tables',(select coalesce(jsonb_agg(table_no order by table_no),'[]') from public.tables where restaurant_id=r.id and active),
 'staff',(select count(*) from public.staff where restaurant_id=r.id),
 'dishes',(select coalesce(jsonb_agg(jsonb_build_object('name',m.name,'price',m.price,'available',m.available,'category',c.name,'veg',m.is_veg) order by c.sort_order,m.name),'[]') from public.menu_items m left join public.categories c on c.id=m.category_id where m.restaurant_id=r.id),
 'revenue',sales.total,'paid',sales.orders,'visits',(select count(*) from private.menu_visits where restaurant_id=r.id and bucket>=since)
 ) order by sales.total desc,r.name),'[]') from public.restaurants r join auth.users u on u.id=r.owner_id
 cross join lateral (select coalesce(sum(total),0) total,count(*) orders from public.orders where restaurant_id=r.id and status='paid' and paid_at>=since) sales);
end $$;
revoke all on function public.platform_report(integer),public.record_menu_visit(uuid,integer) from public,anon;
grant execute on function public.platform_report(integer),public.record_menu_visit(uuid,integer) to authenticated;
