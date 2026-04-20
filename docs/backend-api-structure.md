# Backend API Structure

Base path: `/api/v1`

## Resources
- `GET /users`
- `GET /properties`
- `GET /contracts`
- `GET /payments`
- `GET /transactions`
- `GET /integrations`

## Dashboard Aggregations
- `GET /dashboard/admin`
  Returns platform financials, purchase flow summary, integration metrics, issue counts, and revenue by channel.
- `GET /dashboard/landlords/:landlordId`
  Returns landlord hero financials and current property-level costs.
- `GET /dashboard/tenants/:tenantId`
  Returns tenant hero financials, total paid, and housing-cost breakdown.

## Analytics
- `GET /analytics/revenue-by-channel`

## Suggested Next REST Endpoints
- `POST /properties`
- `POST /contracts`
- `POST /payments`
- `PATCH /payments/:paymentId/status`
- `PATCH /users/:userId/insurance-preference`
- `POST /integrations/:provider/sync`
