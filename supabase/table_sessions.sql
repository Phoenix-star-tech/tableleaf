-- One row per physical table. Only definer functions may read the device session.
create table private.table_stays(
 table_id uuid primary key references public.tables(id) on delete cascade,
 generation bigint not null default 0, device uuid, order_id uuid unique references public.orders(id)
);
create table private.table_submissions(
 order_id uuid not null references public.orders(id) on delete cascade,
 request_id uuid primary key, submitted_at timestamptz not null default now()
);
create table private.paid_dish_totals(
 restaurant_id uuid not null, day date not null, name text not null, quantity bigint not null,
 sales numeric not null, primary key(restaurant_id,day,name)
);
revoke all on private.table_stays,private.table_submissions,private.paid_dish_totals from public,anon,authenticated;
alter table public.orders alter column customer_id drop not null, alter column request_id drop not null;
alter table public.orders add column revision integer not null default 1;
alter table public.order_items add column is_new boolean not null default false, add column batch_note text;
-- Abort rather than silently merge existing customers' bills if a legacy installation has duplicates.
create unique index one_live_table_bill on public.orders(restaurant_id,table_no)
 where status in ('placed','accepted','preparing','served');
insert into private.table_stays(table_id,order_id)
 select t.id,o.id from public.orders o join public.tables t on t.restaurant_id=o.restaurant_id and t.table_no=o.table_no
 where o.status in ('placed','accepted','preparing','served');

create function public.table_access(r uuid,t integer) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('generation',coalesce(s.generation,0),'status',case when s.order_id is null then 'AVAILABLE' else 'OCCUPIED' end,
 'allowed',s.order_id is null or coalesce(o.customer_id=auth.uid() and
 (s.device=(auth.jwt()->>'session_id')::uuid or (s.device is null and auth.jwt()->>'is_anonymous'='true')),false))
 from public.tables b left join private.table_stays s on s.table_id=b.id left join public.orders o on o.id=s.order_id
 where b.restaurant_id=r and b.table_no=t
$$;

create function private.submit_table_order(r uuid,t integer,lines jsonb,n text,k uuid,expected bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.tables; rest public.restaurants; stay private.table_stays; bill public.orders; device_id uuid:=(auth.jwt()->>'session_id')::uuid;
 entry jsonb; food public.menu_items; qty integer; sub numeric:=0; disc numeric; taxv numeric; extra boolean;
begin
 if auth.uid() is null or device_id is null then raise exception 'A browser session is required'; end if;
 if k is null or n is null or length(n)>500 then raise exception 'Invalid request'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into b from public.tables where restaurant_id=r and table_no=t and active for update;
 if not found then raise exception 'Invalid or inactive table'; end if;
 insert into private.table_stays(table_id) values(b.id) on conflict do nothing;
 select * into strict stay from private.table_stays where table_id=b.id for update;
 if expected is not null and expected<>stay.generation then raise exception 'Table session ended. Scan the QR again.'; end if;
 extra:=stay.order_id is not null;
 if extra then
   select * into strict bill from public.orders where id=stay.order_id for update;
   if bill.customer_id is distinct from auth.uid() or (stay.device is null and coalesce(auth.jwt()->>'is_anonymous','false')<>'true') or (stay.device is not null and stay.device<>device_id) then raise exception 'This table is currently occupied. Please ask the staff for help.'; end if;
   if bill.request_id=k or exists(select from private.table_submissions where order_id=bill.id and request_id=k) then return bill.id; end if;
 end if;
 select * into strict rest from public.restaurants where id=r for share;
 if not rest.is_open then raise exception 'The kitchen is closed'; end if;
 if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 50 then raise exception 'Choose 1–50 different dishes'; end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(lines))<>jsonb_array_length(lines) then raise exception 'Duplicate dishes'; end if;
 if (select count(*) from private.table_submissions s join public.orders o on o.id=s.order_id where o.customer_id=auth.uid() and s.submitted_at>now()-interval '1 minute')>=5 then raise exception 'Please wait before placing another order'; end if;
 if not extra then
   insert into public.orders(restaurant_id,table_no,customer_id,request_id,notes) values(r,t,auth.uid(),k,n) returning * into bill;
 end if;
 for entry in select value from jsonb_array_elements(lines) loop
   if coalesce(entry->>'quantity','') !~ '^[0-9]{1,2}$' then raise exception 'Invalid quantity'; end if;
   qty:=(entry->>'quantity')::integer;
   if qty not between 1 and 50 then raise exception 'Invalid quantity'; end if;
   select * into food from public.menu_items where id=(entry->>'id')::uuid and restaurant_id=r for share;
   if not found or not food.available then raise exception 'A dish is no longer available'; end if;
   insert into public.order_items(order_id,menu_item_id,name,quantity,unit_price,is_new,batch_note) values(bill.id,food.id,food.name,qty,food.price,extra,case when extra then nullif(n,'') end);
   sub:=sub+qty*food.price;
 end loop;
 disc:=round(sub*rest.discount_percent/100,2); taxv:=round((sub-disc)*rest.tax_percent/100,2);
 update public.orders set subtotal=subtotal+sub,discount=discount+disc,tax=tax+taxv,total=total+sub-disc+taxv,status='placed',revision=revision+extra::int where id=bill.id;
 update private.table_stays set order_id=bill.id,device=device_id where table_id=b.id;
 insert into private.table_submissions(order_id,request_id) values(bill.id,k);
 return bill.id;
end $$;
revoke all on function private.submit_table_order(uuid,integer,jsonb,text,uuid,bigint) from public,anon,authenticated;
create function public.submit_table_order(restaurant_id uuid,table_no integer,items jsonb,notes text,request_id uuid,generation bigint)
returns uuid language plpgsql security definer set search_path='' as $$ begin
 if generation is null then raise exception 'Scan the QR again'; end if;
 return private.submit_table_order(restaurant_id,table_no,items,notes,request_id,generation);
end $$;
-- Legacy clients can finish their current stay; require the new client after turnover.
create or replace function private.place_order(r uuid,t integer,lines jsonb,n text,k uuid) returns uuid
language sql security definer set search_path='' as $$select private.submit_table_order(r,t,lines,n,k,0)$$;

create function public.settle_table(oid uuid,expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; b uuid;
begin
 select * into strict o from public.orders where id=oid;
 if not private.is_owner(o.restaurant_id) then raise exception 'Only an owner may confirm payment'; end if;
 select id into strict b from public.tables where restaurant_id=o.restaurant_id and table_no=o.table_no for update;
 select * into strict o from public.orders where id=oid for update;
 if o.status='paid' then return; end if;
 if o.revision is distinct from expected_revision then raise exception 'New items were added. Refresh and confirm the latest bill.'; end if;
 update private.table_stays set generation=generation+1,order_id=null,device=null where table_id=b and order_id=oid;
 if not found then raise exception 'No active session for this bill'; end if;
 insert into private.paid_dish_totals as d select o.restaurant_id,(now() at time zone 'Asia/Kolkata')::date,name,sum(quantity),sum(quantity*unit_price)
 from public.order_items where order_id=oid group by name order by name
 on conflict(restaurant_id,day,name) do update set quantity=d.quantity+excluded.quantity,sales=d.sales+excluded.sales;
 delete from public.order_items where order_id=oid;
 delete from private.table_submissions where order_id=oid;
 delete from public.service_requests where restaurant_id=o.restaurant_id and table_no=o.table_no;
 update private.menu_visits set visitor=gen_random_uuid() where restaurant_id=o.restaurant_id and table_no=o.table_no and visitor=o.customer_id;
 update public.orders set status='paid',paid_at=now(),customer_id=null,request_id=null,notes='' where id=oid;
end $$;
alter function private.change_status(uuid,public.order_status) rename to change_kitchen_status;
revoke all on function private.change_kitchen_status(uuid,public.order_status) from public,anon,authenticated;
create function private.change_status(oid uuid,next_status public.order_status) returns void language plpgsql security definer set search_path='' as $$
begin
 if next_status='paid' then perform public.settle_table(oid,1); return; end if;
 if next_status='cancelled' and exists(select from private.table_stays where order_id=oid) then raise exception 'This table stays occupied until the owner settles the bill'; end if;
 perform private.change_kitchen_status(oid,next_status);
 if next_status='accepted' then update public.order_items set is_new=false where order_id=oid and is_new; end if;
end $$;
create or replace function public.change_order_status(order_id uuid,next_status public.order_status) returns void language sql security invoker set search_path='' as $$select private.change_status(order_id,next_status)$$;
revoke all on function private.change_status(uuid,public.order_status),public.settle_table(uuid,integer),public.submit_table_order(uuid,integer,jsonb,text,uuid,bigint) from public,anon;
grant execute on function private.change_status(uuid,public.order_status),public.settle_table(uuid,integer),public.submit_table_order(uuid,integer,jsonb,text,uuid,bigint) to authenticated;
revoke all on function public.table_access(uuid,integer) from public;
grant execute on function public.table_access(uuid,integer) to anon,authenticated;

create function private.guard_table_request() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.tables where restaurant_id=new.restaurant_id and table_no=new.table_no for share;
 if (public.table_access(new.restaurant_id,new.table_no)->>'allowed')::boolean is not true then raise exception 'This table is currently occupied. Please ask the staff for help.'; end if;
 return new;
end $$;
revoke all on function private.guard_table_request() from public,anon,authenticated;
create trigger check_table_service before insert on public.service_requests for each row execute function private.guard_table_request();
create or replace function private.sales_report(r uuid,s date,e date) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
 select x.name,sum(x.quantity) as quantity,sum(x.sales) as sales from (
   select i.name,i.quantity,i.quantity*i.unit_price as sales from public.order_items i join paid p on p.id=i.order_id
   union all select d.name,d.quantity,d.sales from private.paid_dish_totals d where d.restaurant_id=r and d.day between s and e
 ) x group by x.name order by quantity desc limit 10
 )
 select jsonb_build_object(
 'sales',coalesce(sum(total),0),'count',count(*),'average',coalesce(round(avg(total),2),0),
 'tax',coalesce(sum(tax),0),'discount',coalesce(sum(discount),0),
 'daily',coalesce((select jsonb_agg(d) from daily d),'[]'::jsonb),
 'top',coalesce((select jsonb_agg(t) from top t),'[]'::jsonb)
 ) into result from paid;
 return result;
end $$;
