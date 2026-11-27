# Tableleaf

A mobile-first QR restaurant ordering app built with **Next.js App Router, TypeScript, Tailwind CSS, and Supabase Auth, Postgres, Storage and Realtime**.

## Start here

You need Node.js **22 LTS or newer**, npm, a Supabase project, and (for hosting) a Vercel account.

1. Extract this project ZIP and open the `tableleaf` folder in VS Code.
2. In the terminal:
   ```bash
   npm ci
   cp .env.example .env.local
   ```
   On Windows PowerShell, use `Copy-Item .env.example .env.local`.
3. Create a **new** Supabase project. Keep the database password private.
4. In the Supabase SQL Editor, paste and run **supabase/setup.sql** once. It creates all tables, constraints, policies, RPCs, Storage bucket and Realtime publication entries.
5. In Authentication settings, **enable anonymous sign-ins** and email/password authentication. Anonymous sign-in creates an invisible guest identity; customers never enter a username or password.
6. In Authentication → Users, create an owner email/password account. Confirm the account if required by your Auth settings.
7. Open **supabase/bootstrap.sql**, replace `owner@example.com` with that account’s email, optionally change name/slug, then run it in SQL Editor. It creates a restaurant, tables 1–10, categories and four sample menu items. Do not run it twice with the same slug.
8. Copy the project URL and **publishable API key** from Supabase's project Connect/API settings into `.env.local`:
   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
   Never put a service-role or secret key in any `NEXT_PUBLIC_` variable. This app does not require one.
9. Run:
   ```bash
   npm run dev
   ```
10. Visit:
    - Restaurant login: http://localhost:3000/restaurant/login
    - Dashboard: http://localhost:3000/restaurant/dashboard
    - Real customer menu: http://localhost:3000/r/green-table?table=1
    - Sample visual preview, no backend needed: http://localhost:3000/r/demo?table=4

Upload your food photos through Menu manager. The real seeded menu uses neutral placeholders until you upload photos. The demo menu uses remote Unsplash example photos; substitute your own licensed photography for your actual restaurant.

## What is included

- **Customer:** valid table QR lookup, categories, search, veg filter, dish photos and translated names, quantities, order notes, discount/tax preview, repeated orders, own order history, live status, waiter/bill requests, UPI QR/link on served orders.
- **Restaurant:** verified email/password session, owner and kitchen roles, multi-restaurant selector, live order board, new-order popup, opt-in sound alert and badge, ordered status transitions, menu CRUD, availability toggle, category creation/deletion, Storage photo uploads, tables, PNG/PDF QR downloads, kitchen receipt printing, history with date/status/table filters and pagination.
- **Owner:** settings, branding/logo, theme colour, open/closed toggle, GST/discount, UPI address, staff access assignment/removal, daily sales and top-selling items over a selected date range.
- **Experience:** responsive layout, English/Telugu/Hindi customer navigation/status labels and optional dish-name translations, persistent dark mode, installable PWA manifest/icons/service worker and offline fallback.
- **Engineering:** exact package versions and lockfile, typed app models, atomic database writes, RLS, idempotent retries, guest throttling, 15 executable database security/integration tests.

The owner/kitchen dashboard and descriptive marketing copy are currently in English. Dish descriptions/categories are stored as restaurant-provided text; translated dish-name fields are available in the menu editor.

## Folder structure

```text
tableleaf/
  app/
    layout.tsx                  Global metadata, PWA and preferences
    globals.css                 Tailwind + responsive design system
    page.tsx                    Landing page
    r/[restaurant_slug]/page.tsx Customer route
    restaurant/login/page.tsx   Staff login
    restaurant/dashboard/page.tsx  Server-side Auth guard
  components/
    customer.tsx                Menu, cart, guest session, own orders
    dashboard.tsx               Live kitchen board, receipts, history
    management.tsx              Menu, QR, settings, staff and reports
    payment.tsx                 UPI QR/link
    preferences.tsx             Languages and theme
  lib/
    types.ts                    Shared domain types
    demo.ts                     Clearly labelled sample menu
    supabase/client.ts          Browser client
    supabase/server.ts          Cookie-backed server client
  proxy.ts                      Refresh Auth cookies; protect dashboard
  public/
    manifest.webmanifest
    sw.js                       Network-only navigation + offline fallback
    offline.html
    icon-*.png
  supabase/
    setup.sql                   Schema, RLS, Storage, Realtime, functions
    bootstrap.sql               Owner restaurant + starter menu
  tests/database.test.mjs        Real Postgres engine via PGlite
  .env.example
  package.json
  package-lock.json
  README.md
  VERIFICATION.md
```

## Staff accounts

Create each staff email/password user through Supabase Authentication → Users. In Tableleaf, an owner opens **Staff**, enters that email and chooses **Kitchen** or **Owner**. The account must already exist; this screen does not send an invitation or expose an admin API key.

| Permission                                | Guest             | Kitchen             | Owner                   |
| ----------------------------------------- | ----------------- | ------------------- | ----------------------- |
| Read restaurant/menu                      | Yes               | Yes                 | Yes                     |
| Create an order/request                   | Own guest session | Own session         | Own session             |
| Read orders/items                         | Own only          | Assigned restaurant | Own/assigned restaurant |
| Accept / prepare / serve / cancel         | No                | Yes                 | Yes                     |
| Mark paid                                 | No                | No                  | Yes                     |
| Menu / tables / settings / Storage writes | No                | No                  | Yes                     |
| Staff management / sales reports          | No                | No                  | Yes                     |

The primary owner is stored in `restaurants.owner_id`. Additional owner/kitchen roles live in `staff`. Role changes are checked in the database immediately, not trusted from editable user metadata. The primary owner cannot be removed through the app. Use a reviewed administrative SQL operation to transfer ownership.

## Security and ordering design

Public visitors can read restaurants, table configuration, categories and menu items. Creating an order first obtains an automatic anonymous Supabase Auth session. The guest’s Auth UUID restricts order reads and Realtime events. Guests can see their own orders only, even when another guest uses the same table number.

Direct inserts/updates on orders, line items and service requests are revoked, including Supabase default grants. Customers invoke an authenticated `place_order` RPC:

- Locks the guest to serialize concurrent submissions and rate-limit checks.
- Checks restaurant open status, active table, item ownership, availability, integer quantities and note length.
- Rejects empty/duplicate item lists; allows 1–50 distinct items and 1–50 units per item.
- Copies trusted names/prices from the menu. Never accepts customer-provided totals.
- Computes discount, then GST, rounded to two decimal places.
- Writes order and lines atomically; errors roll back the whole order.
- Reuses an existing order for the same customer/request UUID; retries cannot duplicate it.
- Allows at most 5 new orders per guest per minute.

Privileged implementations live in the non-exposed `private` schema, with fixed search paths, explicit Auth checks and revoked PUBLIC/anon execution. Public wrappers are security-invoker. Do not expose `private` in the Data API schemas.

Status transitions:
`Placed → Accepted → Preparing → Served → Paid`.
Cancellation is allowed before Paid. Paid/cancelled orders are terminal. The database enforces all transitions, including the owner-only payment permission.

The app’s table QR is a public menu link, not proof of physical presence. A copied QR can be used remotely. For busy public deployments, add table/session admission tokens if required and configure Supabase Auth abuse controls. Current database throttling is per guest and does not replace network-level abuse protection.

Customers retain their identity in the same browser until its Auth storage is cleared or they sign out. Different browsers/private sessions do not share “My orders.” Do not delete guest Auth users referenced by orders unless you have a retention/anonymization plan.

## Realtime and notifications

The SQL publishes `orders`, `service_requests`, `menu_items`, and `restaurants` to `supabase_realtime`. RLS applies to Postgres Changes subscriptions. If your project already publishes those tables, omit duplicate publication additions.

The customer and staff clients subscribe to changes and refresh from the database. A 15-second fallback refresh recovers from missed events or reconnects. Existing orders at first load do not trigger a new-order popup. Click **Enable sound** once after opening the dashboard: browser audio autoplay rules require a user gesture. Browser background tabs may suspend audio; this is an in-app alert, not a background push-notification service.

The live board shows the newest 500 active orders. Use Order history filters for older records; history is paginated 30 per page. Service requests are deduplicated per table/kind until resolved.

## Sales, GST and UPI

Prices are stored in INR, excluding tax. Discount applies before GST. Every order stores its monetary snapshot; changing settings/menu prices does not alter old bills.

Reports aggregate **Paid** orders by `paid_at`, in **Asia/Kolkata**, for up to 366 days. Sales include tax after discounts. Top-selling item revenue is before order-level tax/discount. Reports run in SQL across the full matching dataset, independent of UI pagination.

UPI is a payment intent link/QR, **not** payment-gateway verification. Staff must verify funds were received, then an owner clicks **Mark paid**. Opening a UPI app does not mark an order paid. Each served order has its own payment amount; the app does not consolidate several orders into a single bill.

Confirm tax configuration with your accountant. The kitchen receipt is an operational ticket, not a full GST-compliant tax invoice with GSTIN/invoice numbering.

## Storage

Bucket: `restaurant-media`, public read, maximum file size 5 MB, JPG/PNG/WebP only. Paths use `<restaurant UUID>/<random UUID>.<extension>`. Only owners of that restaurant can upload/update/delete. Public menu photos/logos must not contain private information.

Replacing a photo creates a new random path. Deleting/replacing a menu item does not automatically delete old Storage objects; periodically remove unreferenced uploads in the Supabase Storage dashboard.

## PWA

Serve over HTTPS in production. The manifest includes 192/512px icons and a maskable icon. Install through your browser’s “Install app” or “Add to Home Screen” menu. Orders require an active internet connection. The service worker does not cache Auth data, customer orders or dashboard pages and never queues offline order submissions.

## Deploy to Vercel

1. Push this folder to a new GitHub repository. Include the lockfile and SQL; exclude `.env.local`, `node_modules`, `.next`.
2. In Vercel → Add New Project, import that repository.
3. Choose **Next.js**. If the repository contains the outer ZIP folder, set Root Directory to `tableleaf`.
4. Use `npm ci` for installation and `npm run build` for build; leave Next.js output defaults.
5. Under Environment Variables, copy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from your working local configuration. For Production, set `NEXT_PUBLIC_SITE_URL` to `https://tableleaf.vashik.in`. Leave it unset in Preview to test menus on each preview's own hostname.
6. Deploy. Public environment variables are embedded at build time; **redeploy whenever you change them**.
7. Under Vercel Project Settings → Domains, add `tableleaf.vashik.in`. At your DNS provider, add the record shown by Vercel for that hostname. Wait for Vercel to verify the domain and issue its HTTPS certificate. In Supabase Authentication → URL Configuration, set Site URL to the same HTTPS origin and allow any exact redirect destinations used for authentication.
8. Sign in, upload photos/logo, configure taxes/UPI, and generate table QRs using the final URL. Regenerate printed QRs if you change domain or restaurant slug.
9. Test one order on a phone and the dashboard on a separate computer. Verify updates, sound, printing, UPI and staff isolation using the checklist below.

For this Tableleaf installation, use the existing Supabase project so owners, restaurants, menus, and platform admin access carry over.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm start
```

See **VERIFICATION.md** for checked behavior and remaining hosted tests.

Production smoke test:

1. In separate browsers: owner, kitchen, guest A, guest B.
2. Guest A scans table 1 and places two orders. Guest B cannot see them.
3. Confirm popup, badge and enabled sound on the owner/kitchen dashboard.
4. Move through Take order → Preparing → Served.
5. Verify customer status and UPI bill; owner confirms payment.
6. Check report totals and receipt print.
7. Make a dish unavailable; verify stale carts are rejected.
8. Close restaurant and confirm new orders are blocked.
9. Upload a photo, check the menu, and verify another restaurant owner cannot replace it.
10. Test QR PNG/PDF on a real phone at the final domain.
11. Check waiter/bill requests, reconnect recovery, mobile layout and PWA install.
12. Verify removed staff immediately lose database permissions.
