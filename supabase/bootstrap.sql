-- Run AFTER setup.sql.
-- 1. Create an email/password account in Supabase Authentication > Users.
-- 2. Replace owner@example.com below with that account's email.
-- 3. Edit the restaurant name/slug as desired and execute this file.
do $$
declare
 owner_email text := 'owner@example.com';
 restaurant_name text := 'The Green Table';
 restaurant_slug text := 'green-table';
 uid uuid;
 rid uuid;
 starters uuid;
 mains uuid;
 drinks uuid;
begin
 select id into uid from auth.users where lower(email)=lower(owner_email) and not coalesce(is_anonymous,false);
 if uid is null then raise exception 'Create the owner email/password account in Authentication first, then edit owner_email in this script.'; end if;
 insert into public.restaurants(owner_id,name,slug) values(uid,restaurant_name,restaurant_slug) returning id into rid;
 insert into public.tables(restaurant_id,table_no) select rid,generate_series(1,10);
 insert into public.categories(restaurant_id,name,sort_order) values(rid,'Small plates',0) returning id into starters;
 insert into public.categories(restaurant_id,name,sort_order) values(rid,'Signature dishes',1) returning id into mains;
 insert into public.categories(restaurant_id,name,sort_order) values(rid,'Sips & coolers',2) returning id into drinks;
 insert into public.menu_items(restaurant_id,category_id,name,name_te,name_hi,description,price,is_veg) values
 (rid,mains,'Hyderabadi dum biryani','హైదరాబాదీ దమ్ బిర్యానీ','हैदराबादी दम बिरयानी','Slow-cooked basmati, chicken and fragrant spices.',320,false),
 (rid,mains,'Paneer butter masala','పనీర్ బటర్ మసాలా','पनीर बटर मसाला','Soft paneer in a silky tomato gravy.',260,true),
 (rid,starters,'Vegetable samosas','వెజిటబుల్ సమోసాలు','वेज समोसे','Golden pastry, spiced potatoes and chutney.',120,true),
 (rid,drinks,'Fresh lime cooler','నిమ్మరసం','नींबू शरबत','Freshly squeezed lime with a sparkling finish.',90,true);
end $$;
