# Ethiopian Equb — Expo TypeScript MVP

A mobile-first Equb management app with:

- Amharic / English UI and light / dark themes
- Clerk authentication using Google OAuth or email verification codes
- Role-scoped Equb data stored in Convex and synced in realtime
- Monthly contribution tracking, verification, draw history, and payout records
- One Equb group per signed-in account (owner or linked member)
- One-time import of existing local records; generated sample members and demo payments are excluded

Payment records and payout approvals are bookkeeping only. The app does not
transfer money or replace independent verification of a bank/mobile-money
transfer.

## Architecture

- `app/`: Expo Router screens, Clerk/Convex providers, sign-in, and tabs
- `convex/schema.ts`: Account and Equb record schema with indexes
- `convex/auth.config.ts`: Clerk JWT issuer for Convex authorization
- `convex/equb.ts`: Authenticated owner-scoped queries and mutations
- `src/core/engine/`: Financial rules and domain types
- `src/store/EqubProvider.tsx`: Reactive Convex state, mutations, and local-data import
- `src/store/useSettingsStore.ts`: Local-only language and theme preferences
- `src/features/`: Dashboard, members, draw, payment, payout, and settings screens

Every Equb query and mutation derives access from Clerk's verified Convex
identity; clients do not choose the account or role. Local theme and language
preferences remain on the device.

## Group access and roles

After signing in, an account can create a group as its administrator or join an
existing group with its invite code and the customer number on its roster
record. Customer numbers must uniquely identify a roster member. Administrators
can add members, promote linked member accounts
to administrator, and rotate the invite code. Rotating a code prevents new
joins using the previous code; it does not unlink existing accounts.

Administrators can manage group records and verify contributions or approve
payouts. Members can view and submit contributions only for their linked
profile, and can read group draw and payout history. Other member profiles and
contributions are not returned to member accounts. These boundaries are
enforced in Convex functions as well as reflected in the interface.

## Configure Clerk and Convex

1. Create a Clerk application. Enable Google OAuth and email verification
   codes. Add the app's `equb` redirect scheme to the Clerk configuration.
2. In Clerk, create a JWT template whose name is exactly `convex` (lowercase).
   Set its issuer to the Clerk issuer URL, its JWKS endpoint to the matching
   `/.well-known/jwks.json` URL, and its application ID / audience to `convex`.
   The template name matters: the app requests a token using `template: "convex"`.
3. Add the mobile variables to your ignored `.env.local` (preserve any Convex
   deployment settings already there):
   - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `EXPO_PUBLIC_CONVEX_URL`
4. Set `CLERK_JWT_ISSUER_DOMAIN` on the same Convex deployment with the issuer
   URL from Clerk, for example:
   `npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-instance.clerk.accounts.dev`
   Then run `npx convex dev` to deploy the schema and functions. Set the
   variable separately for each deployment (dev, preview, or production).
5. Run `npx expo start` for development. Configure the same mobile public
   variables in the release build environment and rebuild the native app.

Never include Clerk secret keys in Expo `EXPO_PUBLIC_*` variables or the mobile
app. `.env.example` has variable names only. Use the ignored local env file and
Convex deployment settings for real values.

## Local data migration

After an administrator creates or accesses an Equb, the app imports the
previous AsyncStorage payload under `ethiopian-equb-state-v1` into that
administrator's Equb once. The migration skips
generated member IDs such as `member-1` and generated `demo-payment-*` entries,
and preserves actual added records. Local data is removed only after the
cloud import succeeds. Linked member accounts do not import device data into a
group.

Legacy cycle membership snapshots are best-effort because older app versions
did not retain historical rosters. The app does not invent missing customer or
ID numbers; complete them before drawing.

## Requirements and run

- Node.js LTS and npm
- Convex deployment and Clerk application configured as above
- Android emulator/device or browser for supported Expo web features

```bash
npm install
npx expo start
```

For Android emulator, press `a`; for web, press `w`.

## Validate

```bash
npm run test:engine
npm run typecheck
```

Before using with a real group, configure backups, monitoring, privacy and
retention controls, and operational audit procedures.
