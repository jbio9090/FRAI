---
paths:
  - 'resources/js/components/chatbot/**'
---

# Chatbot

## No automatic retry of a failed chat turn
useChatAPI must not auto-retry a failed chat turn. It used to re-fire the identical payload after 2 minutes, which stacked a second long request on top of one the server was still working on. Failures are surfaced with an explicit "Try again" button (retryLastMessage), each turn runs under its own AbortController (aborted on a new send and on unmount) plus a 50s client ceiling, and a 200 response carrying meta.budget_exceeded renders as a neutral hint, not an error.
