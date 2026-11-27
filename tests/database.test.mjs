import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const pg = new PGlite();
const owner = "00000000-0000-4000-8000-000000000001",
  guest = "00000000-0000-4000-8000-000000000002",
  other = "00000000-0000-4000-8000-000000000003",
  kitchen = "00000000-0000-4000-8000-000000000004";
const rid = "10000000-0000-4000-8000-000000000001",
  rid2 = "10000000-0000-4000-8000-000000000002",
  food = "20000000-0000-4000-8000-000000000001",
  food2 = "20000000-0000-4000-8000-000000000002";
let order;
async function asUser(id, fn, role = "authenticated") {
  await pg.exec("set role " + role);
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  try {
    return await fn();
  } finally {
    await pg.exec("reset role");
  }
}
const place = (
  items = [{ id: food, quantity: 2 }],
  key = crypto.randomUUID(),
  r = rid,
  t = 1,
) =>
  pg.query("select public.place_order($1,$2,$3::jsonb,$4,$5) id", [
    r,
    t,
    JSON.stringify(items),
    "Less spicy",
    key,
  ]);
before(async () => {
  await pg.exec(`
 create role anon; create role authenticated;
 create schema auth;
 create table auth.users(id uuid primary key,email text,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,public to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated;
 grant select,insert,update,delete on storage.objects to authenticated;
 grant select on storage.objects to anon;
 create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
 create publication supabase_realtime;
 -- Simulate Supabase's permissive default grants to verify the script revokes them.
 alter default privileges in schema public grant all on tables to anon,authenticated;
 `);
  await pg.exec(
    readFileSync(new URL("../supabase/setup.sql", import.meta.url), "utf8"),
  );
  await pg.query(
    "insert into auth.users values($1,$2,false),($3,null,true),($4,$5,false),($6,$7,false)",
    [
      owner,
      "owner@example.com",
      guest,
      other,
      "other@example.com",
      kitchen,
      "kitchen@example.com",
    ],
  );
  await pg.query(
    "insert into public.restaurants(id,owner_id,name,slug,tax_percent,discount_percent) values($1,$2,'Green Table','green-table',5,10),($3,$4,'Other','other',0,0)",
    [rid, owner, rid2, other],
  );
  await pg.query(
    "insert into public.tables(restaurant_id,table_no) values($1,1),($2,1)",
    [rid, rid2],
  );
  await pg.query(
    "insert into public.menu_items(id,restaurant_id,name,price) values($1,$2,'Biryani',100),($3,$4,'Other dish',200)",
    [food, rid, food2, rid2],
  );
  await pg.query("insert into public.staff values($1,$2,'kitchen')", [
    rid,
    kitchen,
  ]);
});
after(async () => await pg.close());
test("public visitors can read menu but cannot read orders or insert directly", async () => {
  await asUser(
    null,
    async () => {
      assert.equal(
        (await pg.query("select * from public.menu_items")).rows.length,
        2,
      );
      await assert.rejects(
        () => pg.query("select * from public.orders"),
        /permission denied/,
      );
      await assert.rejects(() => place(), /permission denied/);
    },
    "anon",
  );
});
test("guest order snapshots price and calculates discount before tax", async () => {
  await asUser(guest, async () => {
    order = (await place()).rows[0].id;
    const o = (
      await pg.query("select * from public.orders where id=$1", [order])
    ).rows[0];
    assert.equal(Number(o.subtotal), 200);
    assert.equal(Number(o.discount), 20);
    assert.equal(Number(o.tax), 9);
    assert.equal(Number(o.total), 189);
    assert.equal(o.status, "placed");
  });
});
test("idempotent retries return one order", async () => {
  await asUser(guest, async () => {
    const key = crypto.randomUUID();
    const a = (await place(undefined, key)).rows[0].id,
      b = (await place(undefined, key)).rows[0].id;
    assert.equal(a, b);
  });
});
test("invalid, duplicate, fractional and foreign items are rejected atomically", async () => {
  await asUser(guest, async () => {
    const before = (await pg.query("select count(*) n from public.orders"))
      .rows[0].n;
    for (const items of [
      [{ id: food, quantity: 0 }],
      [{ id: food, quantity: 1.5 }],
      [{ id: food, quantity: 51 }],
      [
        { id: food, quantity: 1 },
        { id: food, quantity: 2 },
      ],
      [{ id: food2, quantity: 1 }],
      [],
      null,
      {},
    ])
      await assert.rejects(() => place(items));
    assert.equal(
      (await pg.query("select count(*) n from public.orders")).rows[0].n,
      before,
    );
  });
});
test("unavailable dishes, closed kitchen and inactive tables reject orders", async () => {
  await pg.query("update public.menu_items set available=false where id=$1", [
    food,
  ]);
  await asUser(guest, () =>
    assert.rejects(() => place(), /no longer available/),
  );
  await pg.query("update public.menu_items set available=true where id=$1", [
    food,
  ]);
  await pg.query("update public.restaurants set is_open=false where id=$1", [
    rid,
  ]);
  await asUser(guest, () => assert.rejects(() => place(), /closed/));
  await pg.query("update public.restaurants set is_open=true where id=$1", [
    rid,
  ]);
  await pg.query(
    "update public.tables set active=false where restaurant_id=$1",
    [rid],
  );
  await asUser(guest, () => assert.rejects(() => place(), /inactive/));
  await pg.query(
    "update public.tables set active=true where restaurant_id=$1",
    [rid],
  );
});
test("guests cannot update money, write menu or set status", async () => {
  await asUser(guest, async () => {
    await assert.rejects(
      () => pg.query("update public.orders set total=1 where id=$1", [order]),
      /permission denied/,
    );
    assert.equal(
      (
        await pg.query(
          "update public.menu_items set price=1 where id=$1 returning id",
          [food],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      () =>
        pg.query("select public.change_order_status($1,'accepted')", [order]),
      /Not allowed/,
    );
  });
});
test("another user cannot read guest order/items or change another restaurant", async () => {
  await asUser(other, async () => {
    assert.equal(
      (await pg.query("select * from public.orders where id=$1", [order])).rows
        .length,
      0,
    );
    assert.equal(
      (
        await pg.query("select * from public.order_items where order_id=$1", [
          order,
        ])
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await pg.query(
          "update public.restaurants set name='Hacked' where id=$1 returning id",
          [rid],
        )
      ).rows.length,
      0,
    );
  });
});
test("kitchen sees orders and can progress only valid transitions; cannot confirm payment", async () => {
  await asUser(kitchen, async () => {
    assert.equal(
      (await pg.query("select * from public.orders where id=$1", [order])).rows
        .length,
      1,
    );
    await assert.rejects(
      () => pg.query("select public.change_order_status($1,'served')", [order]),
      /Invalid status/,
    );
    for (const status of ["accepted", "preparing", "served"])
      await pg.query("select public.change_order_status($1,$2)", [
        order,
        status,
      ]);
    await assert.rejects(
      () => pg.query("select public.change_order_status($1,'paid')", [order]),
      /Only an owner/,
    );
    assert.equal(
      (
        await pg.query(
          "update public.menu_items set price=5 where id=$1 returning id",
          [food],
        )
      ).rows.length,
      0,
    );
  });
});
test("owner confirms payment and report counts only paid orders", async () => {
  await asUser(owner, async () => {
    await pg.query("select public.change_order_status($1,'paid')", [order]);
    const report = (
      await pg.query(
        "select public.sales_report($1,(now() at time zone 'Asia/Kolkata')::date,(now() at time zone 'Asia/Kolkata')::date) report",
        [rid],
      )
    ).rows[0].report;
    assert.equal(report.count, 1);
    assert.equal(report.sales, 189);
    assert.equal(report.top[0].quantity, 2);
    await assert.rejects(
      () =>
        pg.query("select public.change_order_status($1,'cancelled')", [order]),
      /Invalid status/,
    );
  });
});
test("guest and kitchen cannot access sales reports or manage staff", async () => {
  for (const u of [guest, kitchen, other])
    await asUser(u, async () => {
      await assert.rejects(
        () =>
          pg.query("select public.sales_report($1,current_date,current_date)", [
            rid,
          ]),
        /Not allowed/,
      );
      await assert.rejects(
        () =>
          pg.query(
            "select public.manage_staff($1,'other@example.com','owner',false)",
            [rid],
          ),
        /Not allowed/,
      );
    });
});
test("service requests deduplicate and require staff to resolve", async () => {
  await asUser(guest, async () => {
    await pg.query("select public.request_service($1,1,'waiter')", [rid]);
    await pg.query("select public.request_service($1,1,'waiter')", [rid]);
    const q = await pg.query("select * from public.service_requests");
    assert.equal(q.rows.length, 1);
    await assert.rejects(
      () => pg.query("select public.resolve_request($1)", [q.rows[0].id]),
      /Not allowed/,
    );
  });
  await asUser(kitchen, async () => {
    const q = await pg.query("select * from public.service_requests");
    await pg.query("select public.resolve_request($1)", [q.rows[0].id]);
    assert.equal(
      (await pg.query("select resolved from public.service_requests")).rows[0]
        .resolved,
      true,
    );
  });
});
test("storage writes are limited to owning restaurant folder", async () => {
  await asUser(owner, async () => {
    await pg.query(
      "insert into storage.objects(bucket_id,name) values($1,$2)",
      ["restaurant-media", rid + "/ok.png"],
    );
    await assert.rejects(
      () =>
        pg.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
          "restaurant-media",
          rid2 + "/no.png",
        ]),
      /row-level security/,
    );
  });
  await asUser(kitchen, () =>
    assert.rejects(
      () =>
        pg.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
          "restaurant-media",
          rid + "/no.png",
        ]),
      /row-level security/,
    ),
  );
});
test("owner can assign and remove existing staff; primary owner is protected", async () => {
  await asUser(owner, async () => {
    await pg.query(
      "select public.manage_staff($1,'other@example.com','kitchen',false)",
      [rid],
    );
    await pg.query(
      "select public.manage_staff($1,'other@example.com','kitchen',true)",
      [rid],
    );
    await assert.rejects(
      () =>
        pg.query(
          "select public.manage_staff($1,'owner@example.com','kitchen',true)",
          [rid],
        ),
      /Primary owner/,
    );
    await assert.rejects(
      () =>
        pg.query("update public.restaurants set owner_id=$1 where id=$2", [
          other,
          rid,
        ]),
      /permission denied/,
    );
  });
});
test("cross-restaurant category foreign key is enforced", async () => {
  const c = (
    await pg.query(
      "insert into public.categories(restaurant_id,name) values($1,'Other') returning id",
      [rid2],
    )
  ).rows[0].id;
  await asUser(owner, () =>
    assert.rejects(
      () =>
        pg.query("update public.menu_items set category_id=$1 where id=$2", [
          c,
          food,
        ]),
      /foreign key/,
    ),
  );
});
test("rate limit caps accepted guest orders at five per minute", async () => {
  await asUser(guest, async () => {
    await place();
    await place();
    await place();
    await assert.rejects(() => place(), /wait a minute/);
  });
});
