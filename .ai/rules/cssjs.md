---
paths:
  - 'resources/{css,js}/**'
---

# Cssjs

## Use frai-* prefix, never ads-* for CSS classes
Never use `ads-*` as a CSS class prefix (e.g. .ads-card) — EasyList contains generic cosmetic filters like `##.ads-card` that make uBlock Origin/AdBlock hide those elements on every site, which blanked the request pages. Use the `frai-*` prefix for design-system classes instead. `--ads-*` CSS variable names inside stylesheets are safe (blockers match DOM selectors, not var names).
