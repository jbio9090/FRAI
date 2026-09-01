<p align="center">
  <img src="public/FRAIwLabelBackground.png" alt="FRAI" width="100%"/>
</p>

# Local Development Setup Guide - Laravel Herd
---

## Quick Start Checklist (New Developers)

**Follow these exact steps to avoid common setup issues:**

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd GSO
composer install
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your local domain (see step 3)
# OR copy .env.local.example to .env.local for machine-specific overrides
```

### 3. Configure Local Domain (CRITICAL)
Set these in your `.env` (or `.env.local`) to match your Herd/Valet domain:

```env
APP_URL=https://your-domain.test
ASSET_URL=https://your-domain.test
SESSION_DOMAIN=.your-domain.test        # leading dot required
SESSION_SECURE_COOKIE=true              # Herd uses HTTPS
SESSION_SAME_SITE=lax
SANCTUM_STATEFUL_DOMAINS=your-domain.test
VITE_HMR_TLS=false                      # set true ONLY if you have valid cert
```

**Common mistake:** Accessing `https://your-domain.test:5173` (Vite dev server) instead of `https://your-domain.test` (Herd). **Always use the Herd domain without port.**

### 4. Herd/Valet Setup
```bash
# If using Herd:
herd link    # or herd park in parent directory

# If using Valet:
valet link   # or valet park
```
Ensure your domain resolves to the `public/` directory.

### 5. Database & Migrations
```bash
php artisan migrate:fresh --seed
```

### 6. Build Frontend Assets
```bash
# Option A: Production build (Laravel serves built assets)
npm run build

# Option B: Development with HMR (run in SEPARATE terminal)
npm run dev
```
**If using `npm run dev`**, keep it running. Laravel's `@vite` directive will proxy to it.

### 7. Queue Worker (for notifications, emails, etc.)
```bash
php artisan queue:work
```

### 8. Verify
Open `https://your-domain.test` (NOT :5173). Login should work.

---

## Detailed Setup

### 1. Database Setup
Since you are using the free version of Herd, you must ensure PostgreSQL is installed and running on your machine independently.

#### Install & Connect
1.  Ensure **PostgreSQL** is installed (via Homebrew, Postgres.app, or direct installer).
2.  Open your preferred database management tool (e.g., **pgAdmin**, **TablePlus**, or **DBeaver**).
3.  Create a new database for the project (e.g., `frai_db`).

#### Update `.env`
Update your project's `.env` file with your local PostgreSQL credentials:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=frai_db
DB_USERNAME=your_username
DB_PASSWORD=your_password
```

---

### 2. NVIDIA NIM & Models
NVIDIA NIM provides the hosted LLM used by the chatbot and AI recommendations.

1.  Create a NVIDIA API key from your NVIDIA account.
2.  Use the model slug `nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b` or another NVIDIA-hosted chat model.

---

### 3. Application Configuration
Configure the application to communicate with NVIDIA NIM:

```env
AI_PROVIDER=nvidia
NVIDIA_API_KEY=your_nvidia_key
NVIDIA_MODEL=nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1

AI_GENERATE_TIMEOUT=60
AI_GENERATE_TEMPERATURE=0.1
AI_GENERATE_MAX_TOKENS=512
AI_RECOMMENDATION_RULE_LIMIT=10
AI_FAQ_TOP_K=5
AI_FAQ_LEXICAL_THRESHOLD=0.5
AI_FAQ_NEAR_MATCH_RATIO_MIN=0.8
```

---

### 4. Initialization
Run these commands in your terminal to prepare the application:

1.  **Install Dependencies:**
    ```bash
    composer install
    ```
2.  **Run Migrations:**
    ```bash
    php artisan migrate:fresh --seed
    ```
3. **Run the Queue**
    For the Notifications and other non blocking processes to work
    ```
    php artisan queue:work
    ```
4.  **Check AI Configuration:**
    Verify the NVIDIA settings in `.env` and run `php artisan config:clear` if needed.

---

## Common Issues & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| **419 CSRF / Login fails** | Wrong `SESSION_DOMAIN`, missing `SESSION_SECURE_COOKIE`, or accessing `:5173` | Set `SESSION_DOMAIN=.your-domain.test`, `SESSION_SECURE_COOKIE=true`, access via Herd domain |
| **WebSocket `wss://` fails** | `VITE_HMR_TLS=true` but no valid cert | Set `VITE_HMR_TLS=false` (uses `ws://`) |
| **Vite manifest not found** | `npm run build` / `npm run dev` not run | Run `npm run build` (or `npm run dev` in separate terminal) |
| **Unable to locate file in Vite manifest** | Stale manifest or missing build | Run `npm run build` again |
| **Database connection failed** | PostgreSQL not running or wrong creds | Check `DB_*` in `.env`, ensure PG service running |

---

## Troubleshooting
* **Database Connection:** Ensure the PostgreSQL service is active on your system. If you use a non-standard port (not 5432), update the `DB_PORT` in your `.env`.
* **AI Configuration:** Ensure the NVIDIA settings (`NVIDIA_API_KEY`, `NVIDIA_MODEL`, `NVIDIA_BASE_URL`) are set in `.env`, then run `php artisan config:clear` if config was cached.
* **Clear all caches:** `php artisan optimize:clear`

---

# Local Development Setup Guide - Docker

Work in progress!