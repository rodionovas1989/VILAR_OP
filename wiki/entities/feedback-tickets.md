# Entity: обратная связь (feedback / тикеты)

Внутренние обращения пользователей (не внешний helpdesk).

- Категории: понравилось / улучшить / ошибка / вопрос.
- Статусы: новый → в работе → закрыт | отклонён.
- Номер: `FB-YYYY-MM-DD-NNNNN` (последовательность по дате).
- Автор видит свои; модератор (`seeAll`) — все. ObjectId: `admin_feedback`.

**API:** `/api/feedback`  
**Код:** `backend/src/services/feedback.js`, UI `FeedbackPage`  
**Не путать** с `docs/CHANGELOG.md` / «Что нового».
