-- Run once in a NEW Supabase project through SQL Editor.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create type public.order_status as enum ('placed','accepted','preparing','served','paid','cancelled');
create table public.restaurants (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check(length(name) between 1 and 100), slug text not null unique check(slug <> 'demo' and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 logo_url text, theme_color text not null default '#245b47' check(theme_color ~ '^#[0-9a-fA-F]{6}$'),
 is_open boolean not null default true, tax_percent numeric(5,2) not null default 5 check(tax_percent between 0 and 100),
 discount_percent numeric(5,2) not null default 0 check(discount_percent between 0 and 100), upi_id text,
 created_at timestamptz not null default now()
);
create table public.staff (
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'kitchen' check(role in ('owner','kitchen')), primary key(restaurant_id,user_id)
);
create table public.tables (
 id uuid primary key default gen_random_uuid(),restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 table_no integer not null check(table_no between 1 and 9999),active boolean not null default true,
 unique(restaurant_id,table_no)
);
create table public.categories (
 id uuid primary key default gen_random_uuid(),restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 name text not null check(length(name) between 1 and 80),sort_order integer not null default 0,
 unique(restaurant_id,id),unique(restaurant_id,name)
);
create table public.menu_items (
 id uuid primary key default gen_random_uuid(),restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 category_id uuid,name text not null check(length(name) between 1 and 150),name_te text,name_hi text,
 description text not null default '' check(length(description)<=500),price numeric(10,2) not null check(price between 0.01 and 100000),
 photo_url text,is_veg boolean not null default true,available boolean not null default true,
 foreign key(restaurant_id,category_id) references public.categories(restaurant_id,id)
);
create table public.orders (
 id uuid primary key default gen_random_uuid(),restaurant_id uuid not null references public.restaurants(id),
 table_no integer not null,customer_id uuid not null references auth.users(id),
 request_id uuid not null,status public.order_status not null default 'placed',
 notes text not null default '' check(length(notes)<=500),subtotal numeric(12,2) not null default 0,
 tax numeric(12,2) not null default 0,discount numeric(12,2) not null default 0,total numeric(12,2) not null default 0,
 created_at timestamptz not null default now(),paid_at timestamptz,
 unique(customer_id,request_id),foreign key(restaurant_id,table_no) references public.tables(restaurant_id,table_no)
);
create table public.order_items (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 menu_item_id uuid references public.menu_items(id) on delete set null,name text not null,
 quantity integer not null check(quantity between 1 and 50),unit_price numeric(10,2) not null
);
create table public.service_requests(
 id uuid primary key default gen_random_uuid(),restaurant_id uuid not null references public.restaurants(id),
 table_no integer not null,customer_id uuid not null references auth.users(id),
 kind text not null check(kind in ('waiter','bill')),resolved boolean not null default false,
 created_at timestamptz not null default now(),foreign key(restaurant_id,table_no) references public.tables(restaurant_id,table_no)
);
create unique index one_pending_request on public.service_requests(restaurant_id,table_no,kind) where not resolved;
create index orders_restaurant_time on public.orders(restaurant_id,created_at desc);
create index orders_customer on public.orders(customer_id,created_at desc);
create index orders_paid on public.orders(restaurant_id,paid_at) where status='paid';
create index order_items_order on public.order_items(order_id);
create index order_items_menu on public.order_items(menu_item_id);
create index menu_restaurant on public.menu_items(restaurant_id);
create index menu_category on public.menu_items(restaurant_id,category_id);
create index staff_user on public.staff(user_id);
create index requests_restaurant on public.service_requests(restaurant_id,resolved);
create index requests_customer on public.service_requests(customer_id);
create index restaurants_owner on public.restaurants(owner_id);

-- Internal, non-API helpers. Never derive roles from editable user_metadata.
create function private.is_owner(r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (exists(select 1 from public.restaurants where id=r and owner_id=auth.uid())
 or exists(select 1 from public.staff where restaurant_id=r and user_id=auth.uid() and role='owner'));
$$;
create function private.is_staff(r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.is_owner(r) or exists(select 1 from public.staff where restaurant_id=r and user_id=auth.uid()));
$$;
revoke all on function private.is_owner(uuid),private.is_staff(uuid) from public;
grant execute on function private.is_owner(uuid),private.is_staff(uuid) to authenticated;
alter table public.restaurants enable row level security;
alter table public.staff enable row level security;
alter table public.tables enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.service_requests enable row level security;
create policy restaurant_read on public.restaurants for select to anon,authenticated using(true);
create policy restaurant_update on public.restaurants for update to authenticated using(private.is_owner(id)) with check(private.is_owner(id));
-- Remove Supabase default API grants before applying narrow grants.
revoke all on public.restaurants,public.tables,public.categories,public.menu_items,public.staff,public.orders,public.order_items,public.service_requests from anon,authenticated;
-- Column grants prevent changing primary identity or owner.
grant select on public.restaurants,public.tables,public.categories,public.menu_items to anon,authenticated;
grant update(name,logo_url,theme_color,is_open,tax_percent,discount_percent,upi_id) on public.restaurants to authenticated;
create policy staff_read on public.staff for select to authenticated using(user_id=auth.uid() or private.is_owner(restaurant_id));
grant select on public.staff to authenticated;
create policy table_read on public.tables for select to anon,authenticated using(true);
create policy category_read on public.categories for select to anon,authenticated using(true);
create policy menu_read on public.menu_items for select to anon,authenticated using(true);
create policy table_manage on public.tables for all to authenticated using(private.is_owner(restaurant_id)) with check(private.is_owner(restaurant_id));
create policy category_manage on public.categories for all to authenticated using(private.is_owner(restaurant_id)) with check(private.is_owner(restaurant_id));
create policy menu_manage on public.menu_items for all to authenticated using(private.is_owner(restaurant_id)) with check(private.is_owner(restaurant_id));
grant insert,update,delete on public.tables,public.categories,public.menu_items to authenticated;
create policy orders_read on public.orders for select to authenticated using(customer_id=auth.uid() or private.is_staff(restaurant_id));
create policy items_read on public.order_items for select to authenticated using(exists(select 1 from public.orders where id=order_id));
create policy requests_read on public.service_requests for select to authenticated using(customer_id=auth.uid() or private.is_staff(restaurant_id));
grant select on public.orders,public.order_items,public.service_requests to authenticated;
-- No direct INSERT/UPDATE on money or order rows; narrow authenticated RPCs below.

create function private.place_order(r uuid,t integer,lines jsonb,n text,k uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare restaurant public.restaurants; entry jsonb; food public.menu_items; oid uuid; qty integer; sub numeric:=0; disc numeric; taxv numeric;
begin
 if auth.uid() is null then raise exception 'A guest session is required'; end if;
 if k is null or n is null or length(n)>500 then raise exception 'Invalid request'; end if;
 -- Serialize each guest to enforce retry and rate limits across restaurants/tables.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select id into oid from public.orders where customer_id=auth.uid() and request_id=k;
 if oid is not null then return oid; end if;
 select * into restaurant from public.restaurants where id=r for share;
 if restaurant.id is null or not restaurant.is_open then raise exception 'The kitchen is closed'; end if;
 perform 1 from public.tables where restaurant_id=r and table_no=t and active for share;
 if not found then raise exception 'Invalid or inactive table'; end if;
 if lines is null or jsonb_typeof(lines) is distinct from 'array' then raise exception 'Items must be an array'; end if;
 if jsonb_array_length(lines) not between 1 and 50 then raise exception 'Choose 1–50 different dishes'; end if;
 if (select count(*) from public.orders where customer_id=auth.uid() and created_at>now()-interval '1 minute')>=5 then raise exception 'Please wait a minute before placing another order'; end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(lines))<>jsonb_array_length(lines) then raise exception 'Duplicate dishes'; end if;
 insert into public.orders(restaurant_id,table_no,customer_id,request_id,notes) values(r,t,auth.uid(),k,n) returning id into oid;
 for entry in select value from jsonb_array_elements(lines) loop
  if (entry->>'quantity') is null or (entry->>'quantity') !~ '^[0-9]+$' then raise exception 'Invalid quantity'; end if;
  qty:=(entry->>'quantity')::integer;
  if qty not between 1 and 50 then raise exception 'Quantity must be between 1 and 50'; end if;
  select * into food from public.menu_items where id=(entry->>'id')::uuid and restaurant_id=r for share;
  if food.id is null or not food.available then raise exception 'A dish is no longer available. Refresh your menu.'; end if;
  insert into public.order_items(order_id,menu_item_id,name,quantity,unit_price) values(oid,food.id,food.name,qty,food.price);
  sub:=sub+food.price*qty;
 end loop;
 disc:=round(sub*restaurant.discount_percent/100,2);
 taxv:=round((sub-disc)*restaurant.tax_percent/100,2);
 update public.orders set subtotal=sub,discount=disc,tax=taxv,total=sub-disc+taxv where id=oid;
 return oid;
end $$;
create function public.place_order(restaurant_id uuid,table_no integer,items jsonb,notes text,request_id uuid) returns uuid
language sql security invoker set search_path='' as $$ select private.place_order(restaurant_id,table_no,items,notes,request_id); $$;

create function private.change_status(oid uuid,next_status public.order_status) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=oid for update;
 if auth.uid() is null or o.id is null or not private.is_staff(o.restaurant_id) then raise exception 'Not allowed'; end if;
 if next_status='paid' and not private.is_owner(o.restaurant_id) then raise exception 'Only an owner may confirm payment'; end if;
 if not ((o.status='placed' and next_status='accepted') or (o.status='accepted' and next_status='preparing') or (o.status='preparing' and next_status='served') or (o.status='served' and next_status='paid') or (o.status in ('placed','accepted','preparing','served') and next_status='cancelled')) then raise exception 'Invalid status transition'; end if;
 update public.orders set status=next_status,paid_at=case when next_status='paid' then now() else null end where id=oid;
end $$;
create function public.change_order_status(order_id uuid,next_status public.order_status) returns void language sql security invoker set search_path='' as $$ select private.change_status(order_id,next_status); $$;

create function private.request_service(r uuid,t integer,k text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Guest session required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 if k not in ('waiter','bill') or k is null then raise exception 'Invalid request'; end if;
 if not exists(select 1 from public.tables where restaurant_id=r and table_no=t and active) then raise exception 'Invalid table'; end if;
 if (select count(*) from public.service_requests where customer_id=auth.uid() and created_at>now()-interval '1 minute')>=3 then raise exception 'Please wait before requesting again'; end if;
 insert into public.service_requests(restaurant_id,table_no,customer_id,kind) values(r,t,auth.uid(),k) on conflict do nothing;
end $$;
create function public.request_service(restaurant_id uuid,table_no integer,kind text) returns void language sql security invoker set search_path='' as $$ select private.request_service(restaurant_id,table_no,kind); $$;
create function private.resolve_request(rid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.service_requests where id=rid and private.is_staff(restaurant_id)) then raise exception 'Not allowed'; end if;
 update public.service_requests set resolved=true where id=rid;
end $$;
create function public.resolve_request(request_id uuid) returns void language sql security invoker set search_path='' as $$ select private.resolve_request(request_id); $$;

-- Accounts must already exist in Auth. This function neither sends mail nor creates passwords.
create function private.manage_staff(r uuid,email_address text,staff_role text,remove_member boolean) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 if auth.uid() is null or not private.is_owner(r) then raise exception 'Not allowed'; end if;
 select id into uid from auth.users where lower(email)=lower(trim(email_address)) and not coalesce(is_anonymous,false);
 if uid is null then raise exception 'Create this email account in Supabase Auth first'; end if;
 if exists(select 1 from public.restaurants where id=r and owner_id=uid) then raise exception 'Primary owner cannot be changed here'; end if;
 if remove_member then delete from public.staff where restaurant_id=r and user_id=uid;
 else
  if staff_role not in ('owner','kitchen') or staff_role is null then raise exception 'Invalid role'; end if;
  insert into public.staff values(r,uid,staff_role) on conflict(restaurant_id,user_id) do update set role=excluded.role;
 end if;
end $$;
create function public.manage_staff(restaurant_id uuid,email_address text,staff_role text,remove_member boolean default false) returns void language sql security invoker set search_path='' as $$ select private.manage_staff(restaurant_id,email_address,staff_role,remove_member); $$;

revoke all on all functions in schema private from public,anon;
grant execute on all functions in schema private to authenticated;
revoke all on function public.place_order(uuid,integer,jsonb,text,uuid),public.change_order_status(uuid,public.order_status),public.request_service(uuid,integer,text),public.resolve_request(uuid),public.manage_staff(uuid,text,text,boolean) from public,anon;
grant execute on function public.place_order(uuid,integer,jsonb,text,uuid),public.change_order_status(uuid,public.order_status),public.request_service(uuid,integer,text),public.resolve_request(uuid),public.manage_staff(uuid,text,text,boolean) to authenticated;


create function private.sales_report(r uuid,s date,e date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.is_owner(r) then raise exception 'Not allowed'; end if;
 if s is null or e is null or e<s or e-s>365 then raise exception 'Choose a date range of up to 366 days'; end if;
 with paid as (
 select * from public.orders where restaurant_id=r and status='paid'
 and paid_at >= (s::timestamp at time zone 'Asia/Kolkata')
 and paid_at < ((e+1)::timestamp at time zone 'Asia/Kolkata')
 ), daily as (
 select (paid_at at time zone 'Asia/Kolkata')::date as day,sum(total) as total,count(*) as count from paid group by 1 order by 1
 ), top as (
 select i.name,sum(i.quantity) as quantity,sum(i.quantity*i.unit_price) as sales
 from public.order_items i join paid p on p.id=i.order_id group by i.name order by quantity desc limit 10
 )
 select jsonb_build_object(
 'sales',coalesce(sum(total),0),'count',count(*),'average',coalesce(round(avg(total),2),0),
 'tax',coalesce(sum(tax),0),'discount',coalesce(sum(discount),0),
 'daily',coalesce((select jsonb_agg(d) from daily d),'[]'::jsonb),
 'top',coalesce((select jsonb_agg(t) from top t),'[]'::jsonb)
 ) into result from paid;
 return result;
end $$;
create function public.sales_report(restaurant_id uuid,start_day date,end_day date) returns jsonb language sql security invoker set search_path='' as $$ select private.sales_report(restaurant_id,start_day,end_day); $$;
revoke all on function private.sales_report(uuid,date,date),public.sales_report(uuid,date,date) from public,anon;
grant execute on function private.sales_report(uuid,date,date),public.sales_report(uuid,date,date) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('restaurant-media','restaurant-media',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy media_read on storage.objects for select to anon,authenticated using(bucket_id='restaurant-media');
create policy media_insert on storage.objects for insert to authenticated with check(bucket_id='restaurant-media' and private.is_owner(((storage.foldername(name))[1])::uuid));
create policy media_update on storage.objects for update to authenticated using(bucket_id='restaurant-media' and private.is_owner(((storage.foldername(name))[1])::uuid)) with check(bucket_id='restaurant-media' and private.is_owner(((storage.foldername(name))[1])::uuid));
create policy media_delete on storage.objects for delete to authenticated using(bucket_id='restaurant-media' and private.is_owner(((storage.foldername(name))[1])::uuid));
alter publication supabase_realtime add table public.orders,public.service_requests,public.menu_items,public.restaurants;
commit;
