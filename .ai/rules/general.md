---
paths:
  - '**'
---

# General

## Never run destructive artisan commands on production DB
Never run migrate:fresh, migrate:refresh, db:wipe, or queue:flush against the production database (pgsql/Supabase). These destroy unrecoverable data — free plan has no point-in-time recovery. On prod only run `migrate --force`, and only after confirming the DB target and that a backup exists. Verify read-only first with migrate:status and row counts.
