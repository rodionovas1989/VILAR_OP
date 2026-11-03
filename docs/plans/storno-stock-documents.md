---
roadmap_id: R10
also: R11, STOR1, R9
status: planned
estimate_h:
actual_h:
tokens_approx:
---

# Сторно складских документов (полный документ)

Разбор: [wiki/analyses/storno-stock-documents.md](../../wiki/analyses/storno-stock-documents.md).  
ADR: [D013](../../wiki/decisions/D013-storno-new-document.md).  
Схема хранения: [relational-storage-postgres.md](relational-storage-postgres.md) (STOR1).  
Частичное по строкам: [storno-partial-lines.md](storno-partial-lines.md) (R11).

## Зафиксированные решения

1. Как **SAP MM IM**: сторно = **новый документ B** (новый номер), обратные количества, ссылка на исходник A (≈ MSEG-SMBLN). A **не удаляется** из истории.
2. **UX:** с карточки A → создать **черновик B** → пользователь открывает B → **Проводит**. Не тихое автопроведение.
3. **MVP R10:** только **полное** сторно типов, двигающих `stock`: RCP, TRN, WOF, PST, PRI, PRR, SHP.
4. **Вне R10:** RES, INV (+ дети), QCM/LCH — свои правила. Частичное по строкам — **R11**. Частичный qty в строке — не R10/R11.
5. **Даты:** `postingDate` ≈ BUDAT; `at` ≈ CPUDT. У B по умолчанию `postingDate` = у A (дефолт MIGO, KBA 3062751). Срезы «на дату» / ПТО (R9) — по `postingDate`.
6. **Repost того же id** убрать/заменить: путь = сторно B + **новый** документ C.

## Как в SAP (ориентир без домыслов)

1. Проведён материал-документ A (MKPF/MSEG).
2. MIGO Cancellation → ссылка на A → при проведении создаётся **новый** документ B.
3. В строках B — ссылка на A (SMBLN / год / позиция); A как правило **не переписывают** erase-статусом.
4. Оба документа в истории остатка; период — по **BUDAT**.
5. Дефолт BUDAT у B в MIGO = BUDAT A; CPUDT у B = время ввода сторно.

## Текущее поведение Vilar (проблема)

[`reverseStockMovements`](../../backend/src/services/documents.js): обратные дельты в `material_movements` с тем же `documentId`, затем всем строкам — `documentStatus: 'cancelled'`. Отдельного документа B нет. Отчёты режут период по дню из `at`.

## Целевая модель

### Документы

| | Документ A (исходник) | Документ B (сторно) |
|--|----------------------|---------------------|
| Номер | прежний | **новый** (`nextDocumentNumber`) |
| Тип | RCP…SHP | **тот же type** (без обязательных кодов 102/262) |
| `reverses_document_id` | null | = id A |
| `is_reversal` | false | true |
| Статус после успеха | `reversed` | `posted` (после проведения черновика) |
| Строки | без изменения qty | копия строк A с **обратным** знаком qty (хранение: положительные qty + направление склада, как принято в типе; смысл — откат) |

Для **TRN**: у B склады from/to **меняются местами** (обратное перемещение).

### Движения

- При post A: строки журнала с `postingDate = A.date`, `at = now`.
- При post B: новые строки с `postingDate = B.date` (по умолчанию = A.date), `at = now`, `documentId = B`.
- Движения A **не** помечаются cancelled и **не** исключаются из наката.
- Остаток на дату D: `SUM(qty) WHERE posting_date <= D` по всем posted-движениям.

### API / UX (чеклист реализации)

1. Действие на A (posted, не reversed): `createStornoDraft(type, id)` → B draft, открыть карточку B.
2. На B: обычный **post** (с проверкой, что A ещё не полностью сторнирован другим B).
3. После post B: A → `reversed`; запрет второго полного сторно.
4. Убрать «Провести повторно» для того же id (или текст: сделайте сторно и создайте новый документ).
5. Черновик B: можно отменить как draft (без влияния на stock); удаление draft снимает блок на повторное создание сторно.
6. Список документов: бейдж «Сторно» / «Сторнирован»; ссылки A↔B в карточке и trace.

### Запреты

- Сторно draft/cancelled/reversed A — нет.
- Сторно, если уже есть draft или posted B с `reverses_document_id = A` — нет (пока draft не снят).
- Сторно RES/INV/QCM этим API — нет (R10).

## Изменения к STOR1

См. обновлённые таблицы в [relational-storage-postgres.md](relational-storage-postgres.md):

- W1: `posting_date` + индекс; накат не через «выкинуть cancelled».
- W2: `reverses_document_id`, `is_reversal`, статус `reversed`.

Реализацию DDL согласовать с волнами STOR1; логику сторно можно начать на JSON-store с теми же полями на шапке/движениях.

## Legacy-миграция

Старые отмены (`cancelled` + пары ±qty на одном documentId):

- Оставить в истории для аудита; эвристика отчётов: включать все строки с осмысленным `postingDate`/`at` **или** одноразовый скрипт пометки legacy.
- Новые отмены — только модель A+B.
- Backfill `postingDate` из `doc.date` по `documentId`, иначе день из `at`.

## Проблемы и решения

| Проблема | Решение |
|----------|---------|
| Повторное полное сторно | Один активный B на A |
| TRN направление | Swap from/to на B |
| PRI/PRR после complete заказа | Разрешить сторно документов; влияние на статус заказа — **отдельное решение при коде** (не откатывать `завершен` молча без политики) |
| Repost same id | Удалить; путь B + C |
| Дата сторно «сегодня» | Не дефолт; опция позже (ручная правка `date` на черновике B до post) |
| Period close | Вне MVP (как MM period в SAP) |

## Фазы кода (позже, отдельные ветки)

1. Поля `postingDate` на движениях + запись при post; отчёты на `postingDate`.
2. `createStornoDraft` + post B + статус `reversed`; UI.
3. Убрать legacy cancel-for-stock-types / repost; тесты chain + сторно RCP/TRN.
4. Согласование с STOR1 W1/W2 при миграциях таблиц.

## Вне скоупа R10

- Частичное по строкам (R11).
- Частичный qty в строке.
- RES / INV / качество.
- Закрытие учётного периода.
- Отдельные коды видов движения 102/262.
