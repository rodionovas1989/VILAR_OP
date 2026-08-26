# Entity: ops-debug JSONL

Операционный журнал API: мутации и ошибки в `backend/data/ops_debug.jsonl` (не в git).

- Middleware + error handler на Express.
- Компактация по сроку хранения (как у login audit, дни из legal-констант) и лимиту строк.
- Для диагностики пилота, не для пользовательского UI.

**Код:** `backend/src/services/opsDebugLog.js`, `middleware/opsDebug.js`  
**Связано:** [login-audit.md](login-audit.md) (другой файл, та же идея JSONL+retention)
