# GSO User Manual

**Facility & Equipment Request Management System**

Last Updated: September 2026 | Version 1.0

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [For Requesters](#3-for-requesters)
4. [For Approvers & Admins](#4-for-approvers--admins)
5. [AI-Powered Features](#5-ai-powered-features)
6. [Notifications](#6-notifications)
7. [Reports & Audit Logs](#7-reports--audit-logs)
8. [Settings & Profile](#8-settings--profile)
9. [User Roles & Permissions Matrix](#9-user-roles--permissions-matrix)
10. [Glossary](#10-glossary)
11. [Troubleshooting / FAQ](#11-troubleshooting--faq)

---

## 1. Introduction

### What is GSO?

GSO (General Services Office) is a web-based system for managing facility and equipment requests within an organization. It handles the complete lifecycle: submission, conflict detection, priority-based resolution, approval workflows, and AI-assisted recommendations.

### Key Concepts

| Term | Definition |
|------|------------|
| **Request** | A booking for one or more facilities and/or equipment for a specific date/time |
| **Facility** | A bookable space (room, hall, court, etc.) organized by Campus → Building → Facility |
| **Equipment** | Borrowable items (projectors, sound systems, etc.) linked to facilities |
| **RequestFacility** | Junction record linking a Request to a Facility with specific date/time |
| **Priority Level** | Urgency rank: Low < Normal < High < Critical (higher overrides lower) |
| **Status** | Pending → Approved / Conditionally Approved / Rejected / On Hold / Cancelled |
| **Conflict** | Two requests for the same facility at overlapping times |

### Priority Override Logic

- **Higher priority** request → existing lower-priority request moves to **On Hold**
- **Lower priority** request → new request moves to **On Hold** (blocked)
- **Equal priority** → new request moves to **Pending Review** (manual decision needed)
- Held requests are released automatically when the overriding request is cancelled/rejected

---

## 2. Getting Started

### Login

1. Navigate to your organization's GSO URL (e.g., `https://gso.yourorg.test`)
2. Enter your credentials
3. If prompted for password change, see [Force Password Change](#83-force-password-change-flow)

### Dashboard Overview

After login, you land on the **Dashboard** showing:

- **Pending Requests** — Your requests awaiting action (requesters) or your approval (approvers)
- **Calendar View** — Visual schedule of approved bookings
- **Chart Data** — Request volume, approval rates, facility utilization
- **Audit Logs** — Recent system activity (admins only)
- **Notifications Bell** — Unread notification count

### Navigation

| Menu Item | Access | Purpose |
|-----------|--------|---------|
| Dashboard | All | Overview, calendar, charts |
| Requests | All | Create, view, manage requests |
| Facilities | All (view), Admins (manage) | Browse facilities, view schedules |
| Equipment | All (view), Admins (manage) | Browse equipment, check availability |
| Rules | Admins | Manage approval rules |
| Settings | All | Profile, password, notifications |
| Reports | Approvers/Admins | Generate reports |
| Accounts | Admins | User management |
| Chatbot | All | AI assistant |

### Role Quick Reference

| Role | Can Submit | Can Approve | Can Manage Facilities | Can Manage Users | Can View Reports |
|------|------------|-------------|----------------------|------------------|------------------|
| Requester | ✓ | ✗ | ✗ | ✗ | Own only |
| Approver | ✓ | ✓ | ✗ | ✗ | ✓ |
| Facility Manager | ✓ | ✗ | ✓ | ✗ | ✓ |
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Super Admin | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 3. For Requesters

### 3.1 Create a Facility Request

1. Click **Requests** → **Create Request** (or **New Request** button)
2. Fill in required fields:
   - **Title** — Brief descriptive name
   - **Description** — Purpose, setup needs, special instructions
   - **Date** — Single date (YYYY-MM-DD)
   - **Start Time / End Time** — 24-hour format (HH:MM)
   - **Participants** — Expected headcount
   - **Priority Level** — Low / Normal / High / Critical
   - **Priority Reason** — Required for High/Critical; explains urgency
3. **Add Facilities**:
   - Click **Add Facility**
   - Select Campus → Building → Facility
   - System shows real-time availability for selected date/time
   - Repeat for multi-facility requests
4. (Optional) **Add Equipment** — see [3.2](#32-add-equipment-to-request)
5. (Optional) **Attach Files** — see [3.3](#33-attach-files)
6. Click **Submit**

> **Note**: Submitting checks for conflicts instantly. If conflicts exist, you'll see a warning but can still submit — the priority system resolves them.

### 3.2 Add Equipment to Request

1. In the request form, scroll to **Equipment** section
2. Click **Add Equipment**
3. Select equipment from dropdown (filtered by facility if selected)
4. Enter **Quantity Needed**
5. Choose **Source**:
   - **Internal** — Equipment assigned to the selected facility
   - **Borrowed** — Equipment from another facility (select source facility)
6. Click **Add** — repeat for multiple items
7. System validates availability against existing approved requests

### 3.3 Attach Files

1. In request form, click **Attach Files** or drag-and-drop
2. Supported: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (max 10MB each)
3. Files appear in request detail view for all stakeholders

### 3.4 View My Requests

1. Click **Requests** → **My Requests**
2. Use filters:
   - **Status**: All / Pending / Approved / Rejected / On Hold / Cancelled
   - **Date Range**: From / To
   - **Facility**: Search by name
3. Status badges:
   - 🟡 **Pending** — Awaiting approval
   - 🟢 **Approved** — Confirmed booking
   - 🔵 **Conditionally Approved** — Approved with conditions (see details)
   - 🔴 **Rejected** — Denied with reason
   - ⏸ **On Hold** — Blocked by higher-priority request
   - ⚫ **Cancelled** — Withdrawn by requester or admin
4. Click any row for **Request Detail** view

### 3.5 Edit / Cancel Pending Requests

**Edit** (only while status = Pending):
1. Open request detail → click **Edit**
2. Modify fields (date/time changes re-check conflicts)
3. Click **Update**

**Cancel**:
1. Open request detail → click **Cancel Request**
2. Confirm — status changes to **Cancelled**, held requests released

### 3.6 Comments & Audit Trail

**Add Comment**:
1. Open request detail → scroll to **Comments**
2. Type message → click **Post**
3. Notifies requester, approvers, and mentioned users (@name)

**View Audit Logs**:
1. Open request detail → click **Audit Logs** tab
2. Shows: status changes, priority overrides, comments, file uploads, AI recommendations
3. Each entry: timestamp, user, action, before/after values

### 3.7 Handle Reschedule Alternatives

When an approver proposes alternative dates/times:

**Via Email**:
1. Open email → click **View Alternatives** (signed link, expires in 7 days)
2. Review proposed slots
3. Click **Accept** on preferred option OR **Decline All**

**Via Push Notification**:
1. Tap notification → opens app to **Alternatives** screen
2. Same accept/decline flow

**In App**:
1. Requests → **Reschedule Alternatives** tab
2. Lists all pending proposals for your requests
3. Select → Accept / Decline

> Accepting an alternative updates the request date/time and re-triggers conflict checks.

---

## 4. For Approvers & Admins

### 4.1 Approve / Reject / Conditionally Approve

1. Open **Requests** → **Pending** (or Dashboard → Pending Requests)
2. Click request to review details (facilities, equipment, conflicts, AI recommendation)
3. Choose action:
   - **Approve** — Full confirmation, all facilities/equipment booked
   - **Conditionally Approve** — Approved with notes (e.g., "Setup by 8AM", "Clean after use")
   - **Reject** — Requires rejection reason (shown to requester)
4. Click **Confirm**

> **Bulk Action**: Select multiple requests via checkboxes → **Bulk Action** dropdown → Approve/Reject all

### 4.2 Reschedule Requests

Use when requested time conflicts but you want to accommodate:

1. Open request → click **Reschedule**
2. Propose **Alternative Dates/Times** (add multiple slots)
3. Add **Reason** (e.g., "Maintenance on original date")
4. Click **Send Alternatives**
5. Requester receives email + push notification (see [3.7](#37-handle-reschedule-alternatives))
6. Once requester accepts, request updates automatically

### 4.3 Hold / Release Requests

**Hold** (manual override):
1. Open request → click **Hold**
2. Enter reason → **Confirm**
3. Status → **On Hold**, no conflict checks while held

**Release**:
1. Open held request → click **Release Hold**
2. Request returns to **Pending** — conflict checks re-run

### 4.4 Bulk Actions

1. On **Requests** index, check boxes on multiple rows
2. Select from **Bulk Action** dropdown:
   - Approve All
   - Reject All (requires shared reason)
   - Hold All
   - Release Hold All
   - Export Selected (CSV)
3. Click **Apply** → confirm

### 4.5 Priority Override Logic (Deep Dive)

| Scenario | New Request Priority | Existing Request Priority | Result |
|----------|---------------------|--------------------------|--------|
| A | Critical | High | Existing → On Hold, New → Approved |
| B | Normal | High | New → On Hold, Existing unchanged |
| C | High | High | New → Pending Review, Existing unchanged |
| D | High | Normal (On Hold by Critical) | New → On Hold (Critical still wins) |

**Key Rules**:
- Only **Pending** and **Approved** requests participate in conflict checks
- **On Hold** requests don't block new requests
- When overriding request is cancelled/rejected, held requests revert to **Pending** (re-queued)
- Chain holds: A (Critical) holds B (High), B holds C (Normal) — cancelling A releases B, which may then hold C

### 4.6 Manage Facilities

**Access**: Facilities → **Manage Facilities** (permission: `manage facilities`)

**Create Facility**:
1. Click **New Facility**
2. Fill: Name, Campus, Building, Capacity, Description
3. Set **Operating Hours** (per day, e.g., Mon-Fri 07:00-22:00)
4. Set **Status**: Active / Inactive / Maintenance
5. Save

**Campuses & Buildings**:
- Facilities → **Campuses** / **Buildings** tabs
- CRUD operations similar to facilities
- Deleting campus/building cascades to facilities (soft delete)

**Facility Schedule**:
- Click facility → **Schedule** tab
- View calendar with all approved bookings
- JSON endpoints: `/facilities/getSchedule/{facility}/{date}`, `/facilities/getCalendarSchedule/{facility_id}`

### 4.7 Manage Equipment

**Access**: Equipment → **Manage Equipment** (permission: `manage facilities`)

**Create Equipment**:
1. Click **New Equipment**
2. Fill: Name, Description, Total Quantity, Category
3. **Sync Facilities** — select which facilities this equipment belongs to
4. Save

**Check Conflicts**:
- Equipment → **Check Conflicts** — enter date/time, see overlapping bookings
- Equipment → **Availability** — view free slots for a date range

### 4.8 Request Options (System Settings)

**Access**: Settings → **Request Options** (permission: `manage request options`)

| Setting | Description | Default |
|---------|-------------|---------|
| **Approvers** | Users/groups who can approve requests | — |
| **Booking Window** | Max days in advance a request can be made | 90 days |
| **Min Advance Days** | Min days before event date to submit | 1 day |
| **Max Duration** | Max hours per single request | 12 hours |
| **Allow Multi-Facility** | Enable booking multiple facilities in one request | Yes |
| **Require Priority Reason** | For High/Critical priority | Yes |

### 4.9 Rules Engine

**Access**: Rules (permission: `modify rules`)

Rules define auto-approval conditions. Evaluated in order (top to bottom).

**Create Rule**:
1. Click **Add Rule**
2. Define **Conditions** (all must match):
   - Facility / Campus / Building
   - Priority Level
   - Participant count range
   - Date range / Day of week
   - Time range
   - Requester role/department
3. Define **Action**: Auto-Approve / Auto-Reject / Require Approval
4. Set **Priority** (order) — drag to reorder
5. Save

**Rule Examples**:
- "Auto-approve Low priority requests for Classroom A, Mon-Fri, <20 participants"
- "Require approval for all Critical priority requests"
- "Auto-reject requests outside operating hours"

**Test Rule**: Click **Test** on any rule → enter sample request → see matched action

---

## 5. AI-Powered Features

### 5.1 AI Recommendations

**Per-Request Recommendation**:
- Appears on request detail (approver view)
- Shows: **Recommended Action** (Approve/Reject/Conditional), **Reason**, **Confidence**
- Based on: historical approval patterns, rule matches, conflict severity, priority

**Per-Facility Recommendation** (multi-facility requests):
- Each RequestFacility row gets independent AI status + reason
- Approver can accept/reject per facility

**View Recommendation API**:
```
GET /requests/{id}/recommendation
```
Returns JSON with recommended_action, reason, and per-facility breakdown.

### 5.2 Chatbot

**Access**: Navigation → **Chatbot** or `/chatbot`

**Capabilities**:
- **Facility Queries**: "Which rooms hold 50 people on Friday 2PM?"
- **Equipment Queries**: "Available projectors next Tuesday?"
- **Create Request**: "Book Conference Room B for March 15, 10AM-12PM, 15 people, High priority"
- **Check Status**: "What's the status of my request #123?"
- **Explain Rules**: "Why was my request put on hold?"

**Session Management**:
- **New Session**: Clears context (top-right button)
- **History**: Persists across logins
- **Rate Limited**: 60 requests/minute

**API Endpoints**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/chat` | POST | Send message, get AI response |
| `/chat/facilities` | GET | List facilities for context |
| `/chat/equipment` | GET | List equipment for context |
| `/chat/session` | GET | Get current session |
| `/chat/session` | DELETE | Clear session |
| `/api/db/create-request` | POST | Create request via chat |

---

## 6. Notifications

### 6.1 Email Notifications

| Trigger | Recipients | Template |
|---------|------------|----------|
| New request submitted | Assigned approvers | `NewPendingRequest` |
| Request approved | Requester | `RequestResult` (approved) |
| Request rejected | Requester | `RequestResult` (rejected) |
| Request conditionally approved | Requester | `RequestResult` (conditional) |
| Reschedule alternatives proposed | Requester | `RescheduleAlternativesChosen` |
| Reschedule alternative chosen | Approver | `Reschedule` |
| Request edited by requester | Approvers | `RequestEditedByRequester` |
| Request put on hold | Requester | `RequestResult` (on hold) |
| AI recommendation ready | Admins | `AdminAiRecommendationReady` |

**Signed Action Links**:
- Approve/Reject/Reschedule emails contain signed URLs (7-day expiry)
- Click → action executes without login (if session valid)
- Actions: `/requests/{id}/email-action/{approve|reject|reschedule}`

### 6.2 Push Notifications

**Subscribe**:
1. Settings → **Push Notifications** → **Enable**
2. Browser prompts for permission → **Allow**
3. Device token stored (FCM via `LoggableFcmChannel`)

**Events Sent**:
- Request status changes
- New comment mentions
- Reschedule alternatives
- System announcements

**Manage Devices**:
- Settings → **Push Notifications** → **Registered Devices**
- Remove stale tokens
- Test push: click **Send Test Notification**

### 6.3 Notification Preferences

**Requesters**: No granular control — all request-related emails sent

**Approvers/Admins**:
- Settings → **Admin Email Notifications** → toggle **Receive approval request emails**
- When OFF: only push + in-app notifications

---

## 7. Reports & Audit Logs

### 7.1 Reports Dashboard

**Access**: Reports (permission: `approve requests`)

**Filters**:
- Date Range (required)
- Status (multi-select)
- Facility / Campus / Building
- Priority Level
- Requester / Approver
- Department

**Visualizations**:
- Requests by Status (pie)
- Requests by Priority (bar)
- Facility Utilization (heatmap calendar)
- Approval Rate Trend (line)
- Average Processing Time (bar by approver)

**Export**: Click **Export CSV** → downloads filtered dataset

### 7.2 Request Audit Logs

**Per-Request**: Request Detail → **Audit Logs** tab (see [3.6](#36-comments--audit-trail))

**Global Audit Logs**: Dashboard → **Audit Logs** (admins only)
- Filter by: Event Type, User, Date Range, Request ID
- Event Types: `request.created`, `request.approved`, `request.rejected`, `request.held`, `priority.override`, `rule.matched`, `ai.recommendation`, `file.uploaded`, `comment.added`

### 7.3 Chatbot Interaction Logs

**Access**: Chatbot Logs (permission: `view chatbot logs`)
- Table: User, Query, Response, Tokens Used, Latency, Timestamp
- Filter by: User, Date Range, Success/Error
- Export CSV for analytics

---

## 8. Settings & Profile

### 8.1 Change Password

1. Settings → **Change Password**
2. Enter: Current Password, New Password, Confirm New Password
3. Requirements: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
4. Click **Update**

### 8.2 Update Profile Details

1. Settings → **Profile Details**
2. Editable: Name, Email, Phone, Department, Position
3. Click **Save**

### 8.3 Profile Picture

**Upload**:
1. Settings → **Profile Picture** → **Upload**
2. Select image (JPG/PNG, max 2MB, auto-resized to 256x256)
3. Click **Save**

**Remove**:
1. Settings → **Profile Picture** → **Remove**
2. Confirms → reverts to default avatar

### 8.4 Force Password Change Flow

Triggered when:
- Admin resets user password
- Security policy requires rotation
- First login after account creation

**Flow**:
1. Login → redirected to `/reset-required`
2. Enter new password (same requirements as 8.1)
3. Submit → redirected to Dashboard

---

## 9. User Roles & Permissions Matrix

| Permission | Requester | Approver | Facility Mgr | Admin | Super Admin |
|------------|-----------|----------|--------------|-------|-------------|
| **Requests** | | | | | |
| view own requests | ✓ | ✓ | ✓ | ✓ | ✓ |
| view all requests | ✗ | ✓ | ✗ | ✓ | ✓ |
| create request | ✓ | ✓ | ✓ | ✓ | ✓ |
| edit own pending | ✓ | ✓ | ✓ | ✓ | ✓ |
| cancel own | ✓ | ✓ | ✓ | ✓ | ✓ |
| approve/reject | ✗ | ✓ | ✗ | ✓ | ✓ |
| conditionally approve | ✗ | ✓ | ✗ | ✓ | ✓ |
| reschedule | ✗ | ✓ | ✗ | ✓ | ✓ |
| hold/release | ✗ | ✓ | ✗ | ✓ | ✓ |
| bulk action | ✗ | ✓ | ✗ | ✓ | ✓ |
| view audit logs (own) | ✓ | ✓ | ✓ | ✓ | ✓ |
| view audit logs (all) | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Facilities** | | | | | |
| view facilities | ✓ | ✓ | ✓ | ✓ | ✓ |
| view schedules | ✓ | ✓ | ✓ | ✓ | ✓ |
| create/edit facility | ✗ | ✗ | ✓ | ✓ | ✓ |
| delete facility | ✗ | ✗ | ✗ | ✓ | ✓ |
| manage campuses/buildings | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Equipment** | | | | | |
| view equipment | ✓ | ✓ | ✓ | ✓ | ✓ |
| check availability | ✓ | ✓ | ✓ | ✓ | ✓ |
| create/edit equipment | ✗ | ✗ | ✓ | ✓ | ✓ |
| delete equipment | ✗ | ✗ | ✗ | ✓ | ✓ |
| sync facilities | ✗ | ✗ | ✓ | ✓ | ✓ |
| **Rules & Settings** | | | | | |
| view rules | ✗ | ✗ | ✗ | ✓ | ✓ |
| modify rules | ✗ | ✗ | ✗ | ✓ | ✓ |
| manage request options | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Users** | | | | | |
| view accounts | ✗ | ✗ | ✗ | ✓ | ✓ |
| create users | ✗ | ✗ | ✗ | ✓ | ✓ |
| edit users | ✗ | ✗ | ✗ | ✓ | ✓ |
| delete/restore users | ✗ | ✗ | ✗ | ✗ | ✓ |
| reset passwords | ✗ | ✗ | ✗ | ✓ | ✓ |
| toggle user status | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Reports** | | | | | |
| view reports | ✗ | ✓ | ✓ | ✓ | ✓ |
| export reports | ✗ | ✓ | ✓ | ✓ | ✓ |
| **AI & Chatbot** | | | | | |
| use chatbot | ✓ | ✓ | ✓ | ✓ | ✓ |
| view chatbot logs | ✗ | ✗ | ✗ | ✓ | ✓ |
| view AI recommendations | ✗ | ✓ | ✗ | ✓ | ✓ |
| **Notifications** | | | | | |
| manage push tokens | ✓ | ✓ | ✓ | ✓ | ✓ |
| admin email toggle | ✗ | ✓ | ✗ | ✓ | ✓ |

---

## 10. Glossary

| Term | Meaning |
|------|---------|
| **Approver** | User with `approve requests` permission |
| **Campus** | Top-level organizational unit containing buildings |
| **Building** | Physical structure within a campus containing facilities |
| **Facility** | Bookable space (room, hall, court, lab, etc.) |
| **Equipment** | Borrowable resource (AV, furniture, tools) |
| **RequestFacility** | Link between Request and Facility with date/time |
| **RequestEquipment** | Link between Request and Equipment with quantity |
| **PriorityLevel** | Enum: Low (1), Normal (2), High (3), Critical (4) |
| **RequestStatus** | Enum: Pending, Approved, Conditionally Approved, Rejected, On Hold, Cancelled |
| **Conditionally Approved** | Approved with attached conditions/notes |
| **On Hold** | Blocked by higher-priority request; auto-releases when blocker removed |
| **Pending Review** | Equal-priority conflict requiring manual decision |
| **Override** | Higher-priority request forcing lower to On Hold |
| **Booking Window** | Max days in advance a request can be made |
| **Min Advance Days** | Min days before event date to submit request |
| **Signed URL** | Cryptographically signed link for email actions (7-day expiry) |
| **FCM Token** | Firebase Cloud Messaging device token for push notifications |
| **RAG** | Retrieval-Augmented Generation (AI rule/FAQ matching) |
| **Rule** | Auto-approval condition with priority order |
| **AuditEvent** | Enum of all logged system events |

---

## 11. Troubleshooting / FAQ

### Login & Access

| Issue | Cause | Fix |
|-------|-------|-----|
| **419 CSRF / Login fails** | Wrong `SESSION_DOMAIN`, accessing via `:5173` (Vite) instead of Herd domain | Use `https://your-domain.test` (no port), ensure `.env` has `SESSION_DOMAIN=.your-domain.test`, `SESSION_SECURE_COOKIE=true` |
| **Redirect loop after login** | `APP_URL` mismatch | Set `APP_URL` to exact Herd domain (with `https://`) |
| **Permission denied** | Missing role/permission | Contact admin to assign correct role |

### Requests & Conflicts

| Issue | Cause | Fix |
|-------|-------|-----|
| **Request stuck in "Pending Review"** | Equal-priority conflict | Approver must manually approve/reject/hold |
| **Held request not releasing** | Overriding request still active | Cancel/reject overriding request, or wait for it to end |
| **Can't edit request** | Status not "Pending" | Only Pending requests editable; cancel and resubmit |
| **Equipment conflict not detected** | Equipment not synced to facility | Admin: sync equipment to facility via Equipment → Sync Facilities |

### Notifications

| Issue | Cause | Fix |
|-------|-------|-----|
| **No email received** | Queue not running, mail config wrong | Run `php artisan queue:work`, check `MAIL_*` in `.env` |
| **Push not working** | FCM token expired, browser blocked | Re-enable in Settings → Push Notifications, allow browser permission |
| **Signed link expired** | >7 days old | Requester must use in-app Reschedule Alternatives |

### AI & Chatbot

| Issue | Cause | Fix |
|-------|-------|-----|
| **AI recommendation missing** | NVIDIA API key invalid, queue stuck | Check `NVIDIA_API_KEY` in `.env`, run `php artisan queue:work` |
| **Chatbot timeout** | NVIDIA API slow, complex query | Increase `AI_GENERATE_TIMEOUT` in `.env` (default 60s) |
| **Chatbot creates wrong request** | Ambiguous natural language | Use structured format: "Book [Facility] for [Date] [Time] [People] [Priority]" |

### Performance

| Issue | Cause | Fix |
|-------|-------|-----|
| **Slow dashboard** | Large dataset, missing indexes | Run `php artisan optimize:clear`, check DB indexes on `requests` table |
| **Vite manifest not found** | Assets not built | Run `npm run build` (prod) or `npm run dev` (dev, separate terminal) |

### Data Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| **Facility missing from dropdown** | Status = Inactive/Maintenance | Admin: set facility to Active |
| **Rule not matching** | Conditions too strict, wrong priority order | Test rule via Rules → Test, adjust conditions or reorder |
| **Report shows no data** | Date range outside data, permissions | Expand date range, verify role has `approve requests` |

---

## Support

For issues not covered here:
- **Technical**: Check Laravel logs (`storage/logs/laravel.log`)
- **Process**: Consult your department's GSO administrator
- **Feature Requests**: Submit via internal ticketing system

---

*End of Manual*