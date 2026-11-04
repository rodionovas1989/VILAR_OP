---
roadmap_id: A3c
status: planned
estimate_h:
actual_h:
tokens_approx:
depends_on:
conflicts_with:
---

# История статусов производственного заказа (A3c)

Связано: [documentStatusLog.js](../../backend/src/services/documentStatusLog.js) (**A3b**), [planning.js](../../backend/src/services/planning.js), [order-status-machine](../../wiki/concepts/order-status-machine.md), [wip-derived-from-orders](../../wiki/analyses/wip-derived-from-orders.md), G2b [tech-maps-pp-pi-phases.md](tech-maps-pp-pi-phases.md), ROADMAP **A3c** / **A3b** / **R9**.

---

## 1. Цель

Хранить **неизменяемую** историю `fromStatus → toStatus` для `production_orders`: аудит, расследование, опционально as-of «какой статус был на дату D» без догадок только по PRI/PRR.

Qty-НЗП для **R9** по-прежнему считается из **PRI/PRR** (+ `postingDate` после R10). A3c **не** блокирует R9 и **не** заменяет складские движения.

---

## 2. SAP vs Vilar (почему не одна таблица «на всё»)

В SAP **нет** единой таблицы статусов для всех документов учёта:

| Механизм SAP | Покрытие |
|--------------|----------|
| Status management (JEST / история смен) | Объекты с машиной состояний: production order и др. |
| Change documents (CDHDR / CDPOS) | Аудит смены полей |
| Material document (MKPF / MSEG) | После проводки не гоняют по draft→posted в JEST; сторно = новый документ |

**A3c** ≈ дух status management для **заказа**.  
**A3b** (`document_status_log`) ≈ аудит жизненного цикла **складских** документов Vilar (draft/post/cancel/…).  
Слияние A3b+A3c в одну коллекцию «как JEST на всё» — **отклонено в v1** (риск S10).

MVP: один primary `order.status` (строка) + лог переходов. Набор параллельных системных статусов SAP (CRTD+REL+PDLV…) **не** копируем.

---

## 3. Зафиксированные решения

1. **Объект MVP:** только производственный заказ. RES/PRI/… остаются в A3b.
2. **Append-only:** нет API UPDATE/DELETE строк журнала; UI read-only.
3. **Та же транзакция**, что смена статуса заказа (иначе рассинхрон при сбое).
4. **Актор:** `userId` при сессии; seed/migrate — `userId: null` + явный `action`.
5. **G2b:** писать только реальные смены `order.status` (в т.ч. `→ в работе`). Reopen фазы без смены статуса заказа — **не** строка A3c.
6. **Backfill:** прошлые переходы **не** выдумывать; опционально одна строка `seed_current` (`fromStatus: null`, `toStatus: текущий`) на момент внедрения.
7. **RBAC:** отдельный objectId `admin_order_status_log` (SoD-friendly, не смешивать с A3b в одном праве без нужды).
8. Схема строки **похожа** на A3b (удобство будущего UI/STOR1), семантика — заказная.

---

## 4. Модель данных

Коллекция: `production_order_status_log` (STOR1 — волна с `production_orders`).

| Поле | |
|------|--|
| `id` | UUID |
| `at` | ISO server now (wall clock; **не** `postingDate`) |
| `productionOrderId` | обязателен |
| `action` | стабильный код: `plan` / `start` / `complete` / `cancel` / `seed_current` / `migrate` / … |
| `fromStatus` | строка или null |
| `toStatus` | строка |
| `userId` | или null |

Не в MVP: `note`, `requestId`.

Поиск: по `productionOrderId`, `at` desc.  
UI: Админ (рядом с A3b) + read-only лента на карточке заказа.

---

## 5. Код (якоря при реализации)

- Новый `backend/src/services/orderStatusLog.js` по образцу `documentStatusLog.js`.
- Единственный путь смены статуса: helper вроде `setOrderStatus(order, toStatus, { action, userId })` в `planning.js` — все присвоения `status` (`спланирован`, `завершен`, `отменен`; позже `в работе`).
- `store.js` — коллекция в списке; generic write с API **запретить** (как у других journal).
- Admin route list + FE objectId / nav.
- Тесты: после complete/cancel есть строка лога.

---

## 6. Риски и уязвимости

| ID | Риск | Митигация |
|----|------|-----------|
| S1 | Смена статуса без записи в лог | Один helper; grep на `status:` в planning |
| S2 | Лог вне транзакции update заказа | Тот же transaction boundary, что update order |
| S3 | Подделка / правка истории | Нет update/delete API; UI read-only |
| S4 | Путаница A3b vs A3c | Разные экраны; wiki; заказ ≠ documentType |
| S5 | As-of при дырявом backfill | До внедрения лог неполный; WIP — по PRI/PRR |
| S6 | `at` ≠ учётная дата периода | Аудит OK; ПТО не подменять `postingDate` движений |
| S7 | Сторно PRI (R10) без смены статуса заказа | Норма: qty в движениях; лог статусов не отражает откат qty |
| S8 | Двойной complete | Guards; лог только при успешном переходе |
| S9 | Рост таблицы | Append-only; prune вне MVP; индекс по orderId в STOR1 |
| S10 | Слияние с A3b «JEST на всё» | Отклонено в v1; унификация — отдельная идея после G2b |

---

## 7. Фазы

### A3c-a

Сервис + запись из planning + admin list API + тест.

### A3c-b

UI админ + лента на заказе; `seed_current`; wiki / userGuide.

### A3c-c (опционально)

Общий UI «журналы аудита»; STOR1 DDL.

---

## 8. Вне скоупа

- User status profiles SAP.
- Полный field audit заказа (CDHDR-like).
- WORM / ЭЦП (G10 / S-SoD).
- История статусов справочников.
- Реализация кода R9.

---

## 9. Не делать

- Писать складские документы в `production_order_status_log`.
- Исправлять историю вручную «для красивого as-of».
- Считать qty-НЗП из лога статусов вместо PRI/PRR.
- Мультистатус-набор на заказе в MVP.
