# Create Super Admin Command

**Signature:** `php artisan admin:create-super-admin`

## Purpose

Creates or ensures a **Super Admin** user with all system permissions via `spatie/laravel-permission`. This command provides a clean, interactive, and scriptable CLI method to set up super admin accounts without running full database seeders.

---

## Capabilities

1. **Permission Synchronization:** Resets the Spatie permission cache and ensures all 12 core permissions exist.
2. **Role Setup:** Ensures the `Super Admin` role exists and assigns all permissions (`Permission::all()`) to it.
3. **Interactive & Non-interactive Mode:** Prompts for missing fields interactively or accepts options via CLI flags.
4. **Idempotent Handling:** If the user already exists, it assigns the `Super Admin` role (if not already assigned) and optionally updates their password if `--password` is provided.

---

## Usage

### 1. Interactive Mode

Run the command without options to receive guided prompts:

```bash
php artisan admin:create-super-admin
```

Prompts:
- **Name** (default: `GSO`)
- **Email** (default: `gso@example.com`)
- **Password** (hidden input; press Enter for default `password`)

### 2. Non-Interactive / Scripted Mode

Provide flags directly (useful for CI/CD, docker entrypoints, or automated deployments):

```bash
php artisan admin:create-super-admin --name="GSO Admin" --email="admin@domain.com" --password="SecurePassword123!" --no-interaction
```

---

## Command Options

| Option | Description | Default (if empty) |
|---|---|---|
| `--name` | Name of the super admin user | `GSO` |
| `--email` | Email address of the super admin | `gso@example.com` |
| `--password` | Plaintext password to hash and store | `password` |

---

## System Permissions Configured

- `view requests`
- `create requests`
- `approve requests`
- `reject requests`
- `manage facilities`
- `manage equipments`
- `manage users`
- `modify rules`
- `view chatbot logs`
- `reset password`
- `create new admins`
- `manage request options`
