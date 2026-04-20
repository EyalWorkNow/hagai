# Frontend Component Structure

## Application Shell
- `src/App.tsx`
  Owns role-based navigation and top-level route/tab switching.

## Dashboards
- `src/components/AdminDashboard.tsx`
  Platform KPIs, integrations, unresolved issues, purchase flow, and channel revenue.
- `src/components/LandlordDashboard.tsx`
  Portfolio performance, rent plus property-cost hero, property ops, proofs, and maintenance.
- `src/components/TenantDashboard.tsx`
  Total paid hero, payment breakdown, housing-cost breakdown, insurance intent prompt, and tenant actions.

## Shared Financial/Document Modules
- `src/components/SharedViews.tsx`
  Payments, contracts/documents, and admin payment views.
- `src/lib/analytics.ts`
  Pure aggregation helpers for dashboards and API responses.
- `src/lib/tenantDashboard.ts`
  Tenant dashboard view-model builder.

## Data Layer
- `src/lib/appData.tsx`
  Local in-browser state, mock persistence, and app mutations.
- `src/data/rentflow-db.json`
  Seed data for demo/runtime bootstrap.
