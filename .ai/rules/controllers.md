---
paths:
  - app/Http/Controllers/ChatController.php
---

# Controllers

## Chat turns run on an ai.chat wall-clock budget, never a hardcoded timeout
A chat turn is one synchronous request (tool loop + fallback call), and nginx has no fastcgi_read_timeout — locally (Herd) or in nginx.conf — so it cuts off at 60s and the user sees a 504 while PHP keeps going to set_time_limit(120). Every AI call must go through chatCallTimeout() and be gated by chatBudgetSpent(); never reintroduce a hardcoded 120. When the budget runs out, return the 200 + meta.budget_exceeded fallback (chatBudgetExceededResponse) instead of a gateway error, and keep ai.chat.budget under 60.
