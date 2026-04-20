create or replace view vw_platform_financial_summary as
select
  date_trunc('month', current_date)::date as report_month,
  coalesce(
    sum(case
      when date_trunc('month', created_at) = date_trunc('month', current_date)
      then gross_amount
      else 0
    end),
    0
  )::numeric(14,2) as transferred_this_month,
  coalesce(
    sum(case
      when date_trunc('month', created_at) = date_trunc('month', current_date)
      then 20
      else 0
    end),
    0
  )::numeric(14,2) as monthly_platform_revenue,
  count(*) filter (
    where date_trunc('month', created_at) = date_trunc('month', current_date)
  ) as monthly_transaction_count
from platform_transactions;

create or replace view vw_provider_metrics as
select
  provider,
  count(*) as transaction_count,
  (count(*) * 20)::numeric(14,2) as revenue,
  max(created_at) as last_transaction_at
from platform_transactions
group by provider;

create or replace view vw_channel_metrics as
select
  channel,
  count(*) as transaction_count,
  sum(gross_amount)::numeric(14,2) as gross_volume,
  (count(*) * 20)::numeric(14,2) as revenue
from platform_transactions
group by channel;

create or replace view vw_purchase_flow_metrics as
select
  status,
  count(*) as transaction_count,
  sum(gross_amount)::numeric(14,2) as gross_volume
from platform_transactions
group by status;

create or replace view vw_support_issue_metrics as
select
  status,
  count(*) as issue_count
from support_issues
group by status;
