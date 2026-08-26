# Entity: журнал входов (login audit)

Файл `backend/data/login_audit.jsonl` (не в git): успех/отказ входа, IP, логин, время.

- UI: Администрирование → Журнал входов (`admin_login_audit`).
- Retention: **90 дней**, автоочистка при компактации.
- Отдельно: append-only **журнал статусов документов** в sqlite (`document_status_log`) — проведения/смены статуса, не логины (`documentStatusLog.js`, ROADMAP A3b).

**Канон сроков:** [concepts/legal-pdn.md](../concepts/legal-pdn.md)  
**Код:** `backend/src/services/loginAudit.js`
