# Entity: лента «Что нового» (changelog)

Канон для людей: **`docs/CHANGELOG.md`** (raw; ведётся при значимых merge / релизах).

- API: `GET /api/admin/changelog` отдаёт markdown с бэка.
- UI: Админ → «Что нового» — разбор по датам и видам (`new` / `change` / `fix` / `security`) через `frontend/src/utils/changelog.ts`. Лента на ширину рабочей области (без узкой колонки).
- Пункт: `- [kind] **Заголовок.**` первый абзац на той же строке; следующие непустые строки до нового `- [` или `##` — дополнительные абзацы (зачем / бизнес-логика, не только «что сделано»).
- При релизе — тег `vX.Y.Z` (процесс в releases rule).

**Не путать** с [feedback-tickets.md](feedback-tickets.md) (обращения пользователей).  
**Связано:** `.cursor/rules/docs-sync-after-main.mdc`, [D006](../decisions/D006-docs-sync-after-main.md)
