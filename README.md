# Final Rider App ↔ Enterprise Portal Go-Live Wire-Up

This patch fixes the uploaded `App.tsx` and rewires the Rider App mobile runtime for:

- Rider
- Driver
- Helper

It follows the Spec-12 go-live workflow:

- one canonical pickup record
- role-specific mobile screens
- backend-only synchronized assignments
- no mock/local runtime data
- Rider/Driver/Helper jobs from Data Entry waybill rows
- order-picker verification visible to Data Entry
- COD, route, proof, support, sync all updating Enterprise Portal rows

## Source of truth

```text
be_portal_pickup_requests
be_portal_cargo_events
be_mobile_workforce_accounts
be_app_notifications
```

## Required ID format

```text
Pickup Way ID   = P0518-MEL-010
Delivery Way ID = D0518-MEL-001
```

## Included files

```text
sql/01_final_mobile_go_live_wireup.sql
src/App.tsx
src/lib/mobileGoLiveApi.ts
src/pages/shared/MobileGoLivePage.tsx
src/pages/Rider*.tsx
src/pages/Driver*.tsx
src/pages/Helper*.tsx
apply_final_rider_app_wireup.sh
```

## Apply order

### 1) Supabase SQL Editor

Run:

```text
sql/01_final_mobile_go_live_wireup.sql
```

This creates:

```text
be_mobile_go_live_resolve_account
be_mobile_go_live_snapshot
be_mobile_go_live_waybill_status
be_mobile_go_live_verify_pickup_parcel
be_mobile_go_live_cod_handover
be_mobile_go_live_support_request
```

### 2) Git Bash

From the extracted patch folder:

```bash
bash apply_final_rider_app_wireup.sh "/d/Britium_No_Demo_Deployment/rider-app/Rider App"
```

### 3) Build

```bash
cd "/d/Britium_No_Demo_Deployment/rider-app/Rider App"
npm run build
```

### 4) Commit and push

```bash
git status --short
git add src/App.tsx src/lib/mobileGoLiveApi.ts src/pages/shared/MobileGoLivePage.tsx src/pages/Rider*.tsx src/pages/Driver*.tsx src/pages/Helper*.tsx
git commit -m "Final wire-up Rider App with Enterprise Portal go-live workflow"
git push
```

## Expected behavior

### Supervisor assignment

When Supervisor assigns a pickup to rider/driver/helper:

```text
be_portal_pickup_requests.assigned_rider_code
be_portal_pickup_requests.assigned_driver_code
be_portal_pickup_requests.assigned_helper_code
```

### Rider / Driver / Helper mobile app

Mobile pages load through:

```text
be_mobile_go_live_snapshot
```

They should show:

```text
Assigned pickups
Data Entry delivery waybills
Notifications
COD records
Route stops
Order-picker verification status
```

### Field pickup verification

When rider/driver/helper verifies a parcel:

```text
be_portal_cargo_events.field_pickup_checked = true
be_portal_cargo_events.pickup_verification_status = verified
be_portal_cargo_events.field_pickup_weight_kg = actual weight
be_portal_cargo_events.field_pickup_photo_url = cargo photo
```

Data Entry can then use the checked parcel as its registration reference.

## Go-live dry run

1. Customer Service creates pickup: `P0518-MEL-010`
2. Data Entry prepares waybills: `D0518-MEL-001...`
3. Supervisor assigns Rider/Driver/Helper.
4. Rider/Driver/Helper opens mobile app and syncs.
5. Assigned pickups and waybills appear.
6. Field team verifies parcel photo + weight.
7. Data Entry sees `field_pickup_checked = true`.
8. Status/COD/proof updates sync to Enterprise Portal.
