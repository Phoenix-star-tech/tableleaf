create or replace function public.cancel_table_order(oid uuid,expected_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare bill public.orders; table_id_locked uuid;
begin
 select * into bill from public.orders where id=oid;
 if not found or not private.is_staff(bill.restaurant_id) then raise exception 'Restaurant staff access required'; end if;
 select id into strict table_id_locked from public.tables
 where restaurant_id=bill.restaurant_id and table_no=bill.table_no for update;
 select * into strict bill from public.orders where id=oid for update;
 if bill.status='cancelled' then return; end if;
 if bill.status='paid' then raise exception 'This bill has already been paid'; end if;
 if bill.revision is distinct from expected_revision then raise exception 'New items were added. Review the updated bill before cancelling.'; end if;
 update private.table_stays set generation=generation+1,order_id=null,device=null
 where table_id=table_id_locked and order_id=oid;
 if not found then raise exception 'This bill has no active table session'; end if;
 delete from private.table_submissions where order_id=oid;
 delete from public.service_requests where restaurant_id=bill.restaurant_id and table_no=bill.table_no;
 update public.orders set status='cancelled',paid_at=null,customer_id=null,request_id=null where id=oid;
end $$;
revoke all on function public.cancel_table_order(uuid,integer) from public,anon;
grant execute on function public.cancel_table_order(uuid,integer) to authenticated;
