# Спецификация складских документов

Версия: 0.2 · ветка `feature/stock-documents`

## Принципы

- Каждый тип документа — **отдельная коллекция** и **отдельная вкладка** в навигации.
- Общий сервис проведения: нумерация, статусы, post/cancel/fulfill.
- **Резервы** не меняют `stock`, только регистр активных резервов и историю.
- Legacy CRUD по регистрам сохранён для отладки.

## Нумерация

`{TYPE}-{YYYY-MM-DD}-{NNNNN}` — счётчик по типу и дате.

## Коллекции

| Коллекция | Код | Вкладка |
|-----------|-----|---------|
| `receipt_documents` | RCP | Приёмка |
| `transfer_documents` | TRN | Перемещение |
| `inventory_documents` | INV | Инвентаризация |
| `writeoff_documents` | WOF | Списание |
| `posting_documents` | PST | Оприходование |
| `reservation_documents` | RES | Резервирование |
| `production_issue_documents` | PRI | Списание в производство |
| `production_receipt_documents` | PRR | Выпуск из производства |
| `shipment_documents` | SHP | Отгрузка |

## API

- `GET/POST /api/documents/:type`
- `PUT/DELETE /api/documents/:type/:id`
- `POST /api/documents/:type/:id/post|cancel|fulfill`
- `GET /api/documents/meta/types`

`:type` — `receipt`, `reservation`, `production_issue`, …

## Этапы

- [x] **0** — каркас, auth, users
- [x] **1** — отдельные сущности и UI
- [ ] **2** — RES ↔ планирование
- [ ] **3** — PRI/PRR ↔ completeOrder

## Связь с заказом (этап 2–3)

```
спланирован → RES [posted]
завершён    → PRI + PRR [posted] + RES [fulfilled]
отменён     → RES [cancelled]
переплан    → RES [cancelled] + новый RES [posted]
```

Legacy `stock_documents` мигрировано; `reservations` — до этапа 2.
