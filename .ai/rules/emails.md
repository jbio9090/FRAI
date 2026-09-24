---
paths:
  - 'app/Mail/**, resources/views/emails/**'
---

# Emails

## Mailables with x-mail components must use markdown
Templates using <x-mail::> components must be sent via Markdown (Mailable Content markdown: or MailMessage->markdown()), never a plain view:. The `mail` view namespace is only registered during Markdown rendering, so a plain view fails in the queue worker with "No hint path defined for [mail]". Only message, header, footer, panel, button, subcopy, table exist — there is no heading component.
