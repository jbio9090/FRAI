# FRAI — Codebase Guide

## Main Purpose

**FRAI (Facility Request AI)** is a Facility Management System built for the **General Services Office (GSO)** of **Pamantasan ng Lungsod ng Valenzuela (PLV)**. It replaces a manual, paper-based process for managing facility and equipment requests.

**Key capabilities:**
- Online submission of facility/equipment requests by Department Heads
- Admin review, approval, rejection, conditional approval, and rescheduling
- AI-powered recommendation engine (OpenRouter LLM + RAG) that evaluates each booking against rules
- Web push notifications (real-time browser notifications via Service Worker)
- Email notifications with signed URLs for quick approve/reschedule actions
- AI chatbot that helps users generate requests conversationally and answers FAQs
- Role-based access control (admin, Super Admin) via Spatie Laravel-permission
- Full audit logging for all actions
- Conflict detection and priority-based resolution for overlapping bookings

---

## How the Project Flows

### Authentication Flow
1. User visits `/login` — rendered as an Inertia React page
2. Submits credentials via `POST /login` → `LoginController@authenticate`
3. Session-based auth (standard Laravel). Middleware checks active account status and enforces password changes if flagged
4. Successful login redirects to the dashboard

### Request Lifecycle
1. **Submission** — User fills a multi-step form at `/requests/create` (facility, equipment, attendees, date/time, priority level). Submitted via `POST /requests` → `RequestController@store` → `RequestService@create`
2. **Queue Job** — `ProcessRequestRecommendation` is dispatched. The AI recommendation service evaluates each facility booking against rules using OpenRouter (LLM) + pre-computed signals (conflicts, timing, equipment availability)
3. **Admin Review** — Admin views the request at `/requests/{id}` with full details, AI recommendations, and audit logs
4. **Decision** — Admin can approve, reject, conditionally approve, or mark for rescheduling. Each action triggers notifications (push + email) to the requester
5. **Conflict Resolution** — Approval auto-puts conflicting lower-priority requests on hold and displaces equipment bookings as needed

### Chatbot Flow
- Users can interact via a chatbot at `/chatbot` to ask questions or generate requests conversationally
- `POST /chat` (non-streaming) and `POST /chat/stream` (SSE) use OpenRouter
- `FaqMatchingService` performs lexical FAQ matching against rules
- The chatbot can create requests directly via `POST /chat/create-request`

### Notification Flow
- **Web Push** — Uses VAPID keys via `laravel-notification-channels/webpush`. Users subscribe via `POST /push/subscribe` and receive browser notifications via a Service Worker
- **Email** — Sent via SMTP (MailerSend). Signed URLs in emails allow admin actions without logging into the system
- **Database** — Laravel's built-in notifications table for in-app notification inbox

---

## Tech Stack

### Backend
| Component | Technology |
|---|---|
| PHP Framework | Laravel 12 |
| PHP Version | ^8.2 |
| Auth | Session-based (Laravel built-in) |
| Roles/Permissions | spatie/laravel-permission ^7.2 |
| Web Push | laravel-notification-channels/webpush + minishlink/web-push |
| Image Processing | intervention/image ^4.0 |
| AI / LLM | Custom OpenRouterClient (GuzzleHttp) connecting to OpenRouter API |
| Vector Search / RAG | pgvector extension for PostgreSQL |
| Queue | Database-driven queue |
| Route JS Bridge | tightenco/ziggy + laravel/wayfinder |

### Frontend
| Component | Technology |
|---|---|
| JS Framework | React 19 |
| TypeScript | ^5.7 (strict mode) |
| Inertia.js | @inertiajs/react ^2.3 |
| Build Tool | Vite 7 |
| CSS | Tailwind CSS v4 |
| UI Components | shadcn/ui (New York style, Radix primitives) |
| Icons | lucide-react |
| Date Handling | date-fns, moment |
| Charts | recharts |
| Calendar | react-big-calendar |
| PDF | @react-pdf/renderer |
| Animations | motion |
| Theme | next-themes |

### Database
- **PostgreSQL** (primary) with **pgvector** extension for vector embeddings
- SQLite available (likely for testing)

### DevOps
- Docker (docker-compose, nginx, supervisor)
- Render.com deployment support

---

## Project Structure

```
app/                              # Laravel application code
├── Console/Commands/             # Custom Artisan commands
├── Enums/                        # PHP BackedEnums (RequestStatus, PriorityLevel, AuditEvent)
├── Http/
│   ├── Controllers/              # 15 controllers handling HTTP requests
│   ├── Middleware/                # 4 custom middleware (auth, breadcrumbs, inertia, password change)
│   └── Requests/                 # Form request validation classes
├── Jobs/                         # Queueable jobs (AI recommendation, rule embedding)
├── Models/                       # 16 Eloquent models
├── Notifications/                # 6 notification classes (push + email)
├── Providers/                    # Service providers
└── Services/                     # Business logic services
    ├── AI/                       # OpenRouter HTTP client
    ├── RAG/                      # AI recommendation, FAQ matching, rule indexing
    ├── AuditLogger.php
    ├── ChatbotLogService.php
    ├── CloudinaryUploader.php
    ├── FacilityService.php
    ├── NotificationService.php
    ├── RequestService.php
    └── StorageService.php

bootstrap/                        # Laravel bootstrapping
config/                           # 16 configuration files (app, auth, ai, webpush, etc.)
database/
├── factories/                    # 10 model factories
├── migrations/                   # 32 migration files
└── seeders/                      # 5 seeders

resources/
├── css/app.css                   # Tailwind v4 stylesheet
├── js/                           # React/TypeScript frontend
│   ├── components/               # Reusable React components
│   │   ├── ui/                   # 37 shadcn/ui components
│   │   ├── chatbot/              # Chatbot-specific components
│   │   ├── charts/               # Chart components
│   │   ├── pdf/                  # PDF generation components
│   │   ├── request/              # Request-specific components
│   │   └── ...                   # Other components
│   ├── hooks/                    # Custom React hooks
│   ├── layout.tsx/               # Layout components
│   ├── lib/                      # Utility functions (utils, formatters)
│   ├── pages/                    # Inertia page components
│   ├── routes/                   # Inertia route definitions
│   ├── types/                    # TypeScript type definitions
│   ├── app.tsx                   # Inertia app bootstrap
│   └── ssr.tsx                   # Server-side rendering entry
└── views/                        # Blade templates (app.blade.php, email templates)

routes/
├── web.php                       # All web routes (login, dashboard, requests, facilities, etc.)
└── console.php                   # Artisan console commands

tests/
├── Feature/                      # Feature tests
├── Unit/                         # Unit tests
└── TestCase.php

storage/                          # Logs, uploaded files, compiled views
public/                           # Web root (index.php, assets, serviceWorker.js)
```

---

## Coding Guidelines

### PHP (Backend)

**Code Style**
- Follows Laravel Pint with `preset: "laravel"` (PSR-2/PSR-12 derived). Run `./vendor/bin/pint` to format.

**File Naming**
| Type | Convention | Example |
|---|---|---|
| Controllers | PascalCase + `Controller` suffix | `RequestController.php` |
| Models | PascalCase, singular | `Request.php`, `FacilityEquipment.php` |
| Enums | PascalCase | `RequestStatus.php`, `AuditEvent.php` |
| Services | PascalCase + `Service` suffix | `RequestService.php`, `NotificationService.php` |
| Jobs | PascalCase | `ProcessRequestRecommendation.php` |
| Notifications | PascalCase | `NewPendingRequest.php` |
| Middleware | PascalCase | `HandleInertiaRequests.php` |
| Form Requests | PascalCase + `Request` suffix | `FacilityFormRequest.php` |
| Migrations | `YYYY_MM_DD_HHMMSS_descriptive_snake_case` | `2026_02_02_102029_create_rules_table.php` |
| Factories | PascalCase + `Factory` suffix | `UserFactory.php` |
| Seeders | PascalCase + `Seeder` suffix | `DatabaseSeeder.php` |

**Class/Method/Variable Naming**
- **Classes** — PascalCase, PSR-4 namespacing (`App\Http\Controllers`, `App\Models`, etc.)
- **Methods** — camelCase (`index()`, `store()`, `approve()`, `bulkAction()`, `handleSignedEmailAction()`)
- **Controller action methods** — descriptive verbs (approve, reject, conditionally_approve, forReschedule)
- **Model relationships** — camelCase (`facility()`, `user()`, `comments()`, `requestFacilities()`)
- **Model scopes** — camelCase with `scope` prefix (`scopeConflicting()`)
- **Local variables** — camelCase (`$statusParam`, `$pageTitle`, `$facilityRequest`)
- **Database columns / model attributes** — snake_case (`user_id`, `start_time`, `end_time`, `priority_level`, `recommended_action`)

**Database Naming**
- **Tables** — snake_case, plural (`users`, `requests`, `facilities`, `request_facilities`)
- **Pivot tables** — singular_singular (`facility_equipment`, `request_equipment`)
- **Columns** — snake_case (`created_at`, `updated_at`, `deleted_at`)

**Route Naming**
- dot-notation kebab-case: `'dashboard'`, `'requests.index'`, `'requests.detail'`, `'requests.conditionally_approve'`
- Multi-word segments use snake_case (e.g., `conditionally_approve`)

### TypeScript / React (Frontend)

**Code Style**
- ESLint flat config with import ordering (builtin → external → internal → parent → sibling → index, alphabetized within groups)
- Prettier: single quotes, 4-space tabs, 150 print width, no trailing commas
- Tailwind CSS class sorting via `prettier-plugin-tailwindcss`

**File Naming**
| Type | Convention | Example |
|---|---|---|
| Page components | kebab-case `.tsx` | `dashboard.tsx`, `create.tsx`, `detail.tsx` |
| Regular components | kebab-case `.tsx` | `activity-feed.tsx`, `booking-card.tsx`, `status-tag.tsx` |
| shadcn/ui components | kebab-case `.tsx` | `button.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx` |
| Hooks | kebab-case with `use-` prefix | `use-darkMode.ts`, `use-mobile.ts`, `use-permission.ts` |
| Types | kebab-case `.ts` | `auth.ts`, `request.ts`, `facility.ts`, `equipment.ts` |
| Lib utilities | kebab-case `.ts` | `utils.ts`, `getInitials.ts`, `downloadCSV.ts` |

**Component Naming**
- PascalCase for React function components (`export function ActivityFeed(...)`)
- Named exports preferred over default exports

**Variable Naming**
- **JS/TS variables** — camelCase (`appName`, `pageTitle`, `statusValues`, `sortedRequests`)
- **React components / TypeScript interfaces** — PascalCase
- **Constants** — UPPER_CASE (`PRIORITY_LABELS`)
- **Props interfaces** — `Props` suffix or descriptive name

**TypeScript Conventions**
- Strict mode enabled
- Prefer `import type { ... }` over `import { type ... }`
- Path alias `@/` maps to `resources/js/`
- React 19 with React Compiler enabled

**Import Order (ESLint-enforced)**
1. Builtin modules
2. External packages (react, axios, lucide-react)
3. Internal modules (`@/components/*`, `@/lib/*`, `@/hooks/*`, `@/types/*`)
4. Parent imports
5. Sibling imports
6. Index imports
(Alphabetized within each group, case-insensitive)
