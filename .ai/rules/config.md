---
paths:
  - config/inertia.php
---

# Config

## Keep history encryption on, or stale history restores bypass the server
`history.encrypt` must stay true. Inertia restores a Back/Forward navigation straight from history.state (its popstate handler calls page.setQuietly) with NO request, so server guards never run — that is why the login page reappeared after login even though the route had `guest` middleware. Encryption is what makes router.clearHistory() work: clearing drops the key, older entries fail to decrypt, and Inertia itself re-visits the URL so the server redirect applies. Two hard requirements: this config stays enabled, AND lib/historyGuard.ts (wired in app.tsx) keeps calling router.clearHistory() on auth transitions. It is tracked on router's `success` event on purpose — that only fires for visits that hit the server, so a popstate restore can never look like a login/logout. Needs a secure context (HTTPS/localhost): without crypto.subtle Inertia stores plaintext and clearHistory silently does nothing.
