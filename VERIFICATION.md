# Verification record

## Executed successfully

- Next.js 16.4.6 optimized production compilation and TypeScript checking.
- 15 database integration/security tests using PGlite (embedded PostgreSQL).
- Browser review of the landing page and demo customer menu.
- Browser cart test: one ₹320 item → ₹16 GST → ₹336 total; quantity 2 → ₹32 GST → ₹672 total.
- Browser language switch: Telugu navigation, dish names, service buttons and total labels.
- Browser dark-mode switch.
- Browser sample-menu order submission correctly rejected with an explicit setup message.

## Database assertions

1. Public visitors read menu only, not orders; no anonymous direct insert.
2. Server price snapshots and discount-before-tax calculation.
3. Idempotent request UUID retries.
4. Atomic rejection of invalid, empty, null, object, duplicate, fractional or cross-restaurant item lists.
5. Closed kitchen, unavailable dish and inactive table rejection.
6. Guest cannot modify money, menu or status.
7. Another customer/restaurant owner cannot read guest orders or change another restaurant.
8. Kitchen can follow valid status transitions but cannot confirm payments or edit menu.
9. Owner marks paid; reporting counts only paid orders.
10. Guest/kitchen/other restaurant cannot read sales reports or assign staff.
11. Waiter/bill request deduplication and staff-only resolution.
12. Storage writes limited to the owning restaurant folder.
13. Existing staff assignment/removal and protected primary owner.
14. Cross-restaurant category assignment rejected.
15. Guest order throttle enforced at five new orders per minute.

## Verification limits

No Supabase project was connected, so these have not been tested against hosted Supabase:

- Real email/password and anonymous Auth sessions, cookie refresh and Auth rate limits.
- Hosted Storage upload and download transport.
- Realtime websocket event delivery and cross-client notifications.
- Hosted RLS/advisor scan.
- Payment app behavior, physical printer output or a real QR scan.
- Mobile device/browser-specific PWA installation.
- Production Vercel deployment.

The database harness stubs Supabase Auth/Storage schemas and uses actual PostgreSQL role/RLS/function execution. It validates SQL behavior; it does not simulate Supabase service infrastructure.

Production smoke-test steps are in README.md. UPI payment verification is deliberately manual. No hosted deployment is claimed.
