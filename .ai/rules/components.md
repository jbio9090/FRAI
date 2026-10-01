---
paths:
  - resources/js/components/app-sidebar.tsx
---

# Components

## Close the mobile sidebar sheet on navigation
AppSidebar closes the mobile Sheet with setOpenMobile(false) whenever usePage().url changes. This is required because the shell is a persistent layout and no longer unmounts between visits, so the Sheet overlay would otherwise stay open on top of the page the user just navigated to.
