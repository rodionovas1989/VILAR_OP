# Entity: карта кода (сжатая)

Полный перечень файлов раньше был в AGENT_BRIEF; теперь brief тонкий — детали по мере нужды в дереве `backend/src`, `frontend/src`. Якоря:

| Область | Где смотреть |
|---------|----------------|
| API entry | `backend/src/index.js` |
| CRUD store | `backend/src/store.js` (SQLite JSON docs) |
| Планирование / FEFO / complete | `backend/src/services/planning.js` |
| Документы | `backend/src/services/documents.js` |
| Типы документов FE↔BE | `documentTypes.js` / `.ts` (оба!) |
| Auth / RBAC | `auth.js`, `access.js`, `permissions.js` |
| Меню / страницы | `frontend/src/App.tsx`, `navConfig.ts` |
| Руководство UI | `frontend/src/content/userGuide.ts` |
| Тесты цепочки | `backend/tests/chain.test.js` |
| Секреты lint | `npm run wiki:secrets-lint` |
| Feedback | `services/feedback.js` |
| Production register | `services/productionRegister.js` |
| Ops debug / login audit | `opsDebugLog.js`, `loginAudit.js` |
| Changelog UI | `docs/CHANGELOG.md` → `utils/changelog.ts` |

Новые фичи — новые ветки. После main — sync docs + wiki.
