---
paths:
  - app/Http/Requests/FacilityFormRequest.php
---

# Requests

## Route model binding returns an instance, not an id, in form requests
$this->route('request') returns a bound Request MODEL on the update route, not the raw id. Casting it straight to int emits a PHP warning and silently evaluates to 1, so excludeRequestId() excluded request #1 instead of the request being edited — corrupting availability feedback on every edit of any other request. Always resolve it as `$route instanceof Model ? (int) $route->getKey() : (int) $route`. Note the blast radius is limited to the FormRequest's fast-feedback layer: RequestService::update()/create() re-check with the correct id under lockForUpdate, so over-booking is still blocked. Regression tests in tests/Feature/RequestEquipmentLinkageTest.php.
