# Raw sources (immutable)

Слой **исходников** для LLM Wiki ([паттерн Карпати](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)).

## Правила

- Сюда кладут **новые** материалы для ingest (заметки заказчика, выгрузки, черновики решений, PDF→md).
- Агент **читает**, но **не переписывает** raw.
- Канонические методики и спеки, уже лежащие в `docs/`, тоже считаются raw — **не переносить** их сюда без явной задачи. Достаточно ссылки в `wiki/sources/`.

## Что уже канон в `docs/` (raw-by-convention)

| Файл | Тема |
|------|------|
| `docs/GMP_SERIES_RULES.md` | GMP: серии, одна партия на компонент, FEFO |
| `docs/LOT_RECALC.md` | Пересчёт по содержанию / потере |
| `docs/ORDER_STATUS_GUARDS.md` | Guards статусов заказа |
| `docs/STOCK_DOCUMENTS_SPEC.md` | Типы складских документов |
| `docs/LEGAL_PDN.md` | ПДн / согласие |
| `docs/SECURITY_PUBLIC_VM.md` | ИБ пилотной ВМ |
| `docs/HTTPS_SETUP.md` | HTTPS / nginx |
| `docs/CHANGELOG.md` | Журнал для пользователей |
| `docs/ROADMAP.md` | Дорожная карта (статусы vs код) |

После добавления файла сюда: сказать агенту «ingest raw/…» — обновит `wiki/`.
