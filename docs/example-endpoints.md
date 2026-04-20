# Example Endpoints

## Admin dashboard
```http
GET /api/v1/dashboard/admin
```

## Tenant dashboard
```http
GET /api/v1/dashboard/tenants/tenant_1
```

## Landlord dashboard
```http
GET /api/v1/dashboard/landlords/landlord_1
```

## Revenue by channel
```http
GET /api/v1/analytics/revenue-by-channel
```

## Example response shape
```json
{
  "financials": {
    "currentMonthTransfers": 23600,
    "currentBalance": 45000,
    "monthlyRevenue": 3420
  },
  "integrations": [
    { "provider": "insurance", "label": "Insurance", "count": 11, "revenue": 20000 }
  ],
  "purchaseFlow": [
    { "status": "pending", "count": 3 },
    { "status": "in_progress", "count": 2 },
    { "status": "completed", "count": 4 }
  ]
}
```
