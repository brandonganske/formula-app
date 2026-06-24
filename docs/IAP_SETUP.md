# In-App Purchases (RevenueCat) — app setup

The app-side credits + subscriptions flow is built. It **cannot run in Expo Go**
(RevenueCat needs native modules) — it no-ops gracefully there and lights up in a
dev/TestFlight build.

## 1. Environment variables (`.env`)

Add the RevenueCat **public SDK keys** (per platform — get them from the RevenueCat
project once it exists). `EXPO_PUBLIC_` prefix is required so they reach the app.

```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxxxxxxxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_xxxxxxxxxxxxxxxx
```

Until set, the paywall shows "store products aren't configured yet" and purchases are disabled.

(Backend env, set in Vercel by Brandon — not here: `RC_WEBHOOK_AUTH`, `ADMIN_DASHBOARD_SECRET`.)

## 2. Build a dev client

```
npm i -g eas-cli          # if needed
eas login                 # Brandon's Expo account
eas init                  # links the project (writes extra.eas.projectId in app.json)
eas build --profile development --platform ios     # and/or android
```

Install the resulting build on a device, then `npm run dev` and open it there (not Expo Go).
`eas.json` profiles (development/preview/production) are already created.

## 3. Product IDs (must match exactly everywhere)

Registered in App Store Connect + Google Play + a RevenueCat offering. Source of truth in
`lib/iap/catalog.ts`.

| Product ID | Type | Price |
|---|---|---|
| `formula.sub.creator.monthly` | auto-renewable sub | $9.99/mo |
| `formula.sub.pro.monthly` | auto-renewable sub | $14.99/mo |
| `formula.sub.studio.monthly` | auto-renewable sub | $39.99/mo |
| `formula.credits.5` | consumable | $2.99 |
| `formula.credits.10` | consumable | $4.99 |
| `formula.credits.25` | consumable | $10.99 |
| `formula.credits.60` | consumable | $23.99 |

Put the 3 subs in one RevenueCat **offering** (three packages) and a subscription group in
App Store Connect. Packs must be **consumable**.

## Credit model (single source: `lib/iap/catalog.ts`)

| Tier | Price | Credits/mo |
|---|---|---|
| Free | $0 | 3 |
| Creator | $9.99 | 20 |
| Pro | $14.99 | 35 |
| Studio | $39.99 | 100 |

Costs: 1 script = 1 credit · 1 product analysis = 1 credit · brain refresh = 2 credits.

**Backend must (per the renewal/grant model):**
- Give every **new** creator **3** credits on signup.
- On each **subscription renewal** (RevenueCat `RENEWAL`/`INITIAL_PURCHASE` events), **set** the creator's balance to that tier's monthly allotment (20/35/100) — i.e. refresh monthly, don't just stack.
- Refresh **free**-tier creators back to **3** each month.
The app only displays the balance and re-fetches `GET /creators/me`; it never grants.

## How it works in the app

- `context/PurchasesContext.tsx` configures RevenueCat and calls
  `Purchases.logIn(<auth sub>)` after login — the `sub` is decoded from the access-token JWT
  (`lib/auth.ts → getAuthUserId`). **This is the ID the backend resolves purchases by.**
- Purchases never grant credits client-side. After a buy we poll `GET /creators/me`
  (`refreshMe`) a few times so the balance/plan update once the webhook lands.
- Paywall: `app/paywall.tsx` (subs + packs + Restore). Also reachable from the profile
  credits card and the "out of credits" modal.
- Gating: generators block at `credits <= 0`; brain refresh blocks at `credits < 2`
  (`CREDIT_COSTS` in the catalog). Credits now come from `profile.ai_generations_remaining`.
