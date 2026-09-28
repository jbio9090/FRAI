---
paths:
  - 'resources/{css/calendar-custom.css,js/components/FacilityCalendar.tsx}'
---

# Components

## Calendar height/scroll lives in CSS, not Tailwind classes
FacilityCalendar's wrapper height is driven by the `.frai-calendar` class in resources/css/calendar-custom.css (height: calc(100dvh - 12rem), min-height 24rem, overflow: auto, plus a tall-desktop 57rem override). Do not put a fixed `h-[...]` back on the wrapper div — the calendar is its own scroll container so short viewports can reach the bottom month weeks. Month rows have min-height 4.5rem so the box scrolls instead of squeezing; the custom toolbar is `sticky top-0 left-0 z-10 bg-background`. If the offset needs tuning, change the CSS rule, not the component.
