# D004 — cookie-сессия + переходный Bearer

**Решение:** httpOnly cookie как основной auth; Bearer временно для совместимости.

**Почему:** пилот в браузере; CORS credentials; AuthGate без лишнего бренда на гостевом экране.

**См.:** `docs/SECURITY_PUBLIC_VM.md`, rate limit login.
