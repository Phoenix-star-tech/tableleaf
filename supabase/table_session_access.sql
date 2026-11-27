-- Apply browser-session ownership to direct active bill reads as well as checkout.
alter policy orders_read on public.orders using (
 private.is_staff(restaurant_id) or (customer_id=auth.uid() and
 (status in ('cancelled','paid') or (public.table_access(restaurant_id,table_no)->>'allowed')::boolean))
);
-- Refuse a kitchen action based on a ticket that gained new items after rendering.
create function public.advance_table_order(oid uuid, next_status public.order_status,expected_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=oid for update;
 if not found or not private.is_staff(o.restaurant_id) then raise exception 'Not allowed'; end if;
 if o.revision is distinct from expected_revision then raise exception 'New items were added. Review the updated ticket.'; end if;
 if next_status not in ('accepted','preparing','served') then raise exception 'Invalid kitchen action'; end if;
 perform private.change_status(oid,next_status);
end $$;
revoke all on function public.advance_table_order(uuid,public.order_status,integer) from public,anon;
grant execute on function public.advance_table_order(uuid,public.order_status,integer) to authenticated;
create function public.occupancy_status(b public.tables) returns text language sql stable security definer set search_path='' as $$
 select case when exists(select from private.table_stays where table_id=b.id and order_id is not null) then 'OCCUPIED' else 'AVAILABLE' end
$$;
revoke all on function public.occupancy_status(public.tables) from public;
grant execute on function public.occupancy_status(public.tables) to authenticated;
