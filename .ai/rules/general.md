---
paths:
  - '**'
---

# General

## Never run destructive artisan commands on production DB
Never run migrate:fresh, migrate:refresh, db:wipe, or queue:flush against the production database (pgsql/Supabase). These destroy unrecoverable data — free plan has no point-in-time recovery. On prod only run `migrate --force`, and only after confirming the DB target and that a backup exists. Verify read-only first with migrate:status and row counts.

## Frontend permission gates must mirror route middleware
Equipment CRUD (routes/web.php `equipments.store|update|destroy` + `sync-facilities`) is gated by the `manage equipments` permission; facilities pages use the separate `manage facilities`. Both are granted only to `admin`/`Super Admin` via `givePermissionTo(Permission::all())`; `Administrative Staff` holds neither. Gate the React UI with `hasPermission('<exact string from the middleware>')` — never `hasRole('admin') || hasRole('Super Admin')`, and never gate on a different permission than the route enforces. Read access (`GET /equipments` and the sidebar nav item) stays open to all authenticated users by design. If you change a permission string in routes/web.php, update the matching `hasPermission` in the same commit.
