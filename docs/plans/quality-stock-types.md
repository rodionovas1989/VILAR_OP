---
roadmap_id: Q10
also: Q9, Q11, Q12, Q13, STOR1, R10, scenarios
status: planned
estimate_h:
actual_h:
tokens_approx:
---

# Типы остатка качества (SAP-like) — Q10

Разбор: [wiki/analyses/quality-stock-types.md](../../wiki/analyses/quality-stock-types.md).  
ADR: [D014](../../wiki/decisions/D014-quality-stock-types.md).  
Сценарии: [quality-scenarios-movements](../../wiki/concepts/quality-scenarios-movements.md).  
Пробы: **Q13** — [sap-physical-samples](../../wiki/analyses/sap-physical-samples.md).  
STOR1 / R10: [relational-storage-postgres.md](relational-storage-postgres.md), [storno-stock-documents.md](storno-stock-documents.md).

Инвентарь касаний кода (2026-11-04): `applyStockDelta`, `stock.js` / `planning.js`, весь контур QCM, FE quality pages, отчёты, seed `migrateLotQualitiesDefaults`, BE+FE `documentTypes`.

---

## Зафиксированные решения (продукт)

1. Три qty: `quantityUnrestricted` / `quantityQi` / `quantityBlocked` на ключ материал × партия × склад.
2. Доступность RES / FEFO / PRI / SHP / WOF (списание в производство и отгрузка): только **unrestricted**, с учётом RES где применимо.
3. Частичный карантин ручным **STT** разрешён.
4. Любая смена типа/доступности — **только документ** с проводкой; сценарии = те же документы, без скрытых дельт в сервисе.
5. **Снос:** `lot_qualities`, QCM, `quality_register`, `quality_history`, guards `resolveLotQuality` / `assertLotsQualityForUse`, UI/API/отчёты «история качеств» / справочник качеств.
6. Единый справочник **причин движения**; обязательность настраивается по типу документа / направлению STT.
7. LCH без изменений смысла; допуски — **Q12**. Пробы-сущность — **Q13**. Lot — **Q11**.
8. После merge: **Q9** закрыть как покрыто (нет резерва из QI/Blocked).

---

## Архитектурные решения (зафиксированы как default; оспорить до кода)

| # | Тема | Решение Q10 |
|---|------|-------------|
| A | **RES ∩ STT** | STT/TRN/WOF/SHP/PRI с **unrestricted** не могут затронуть qty под активным RES: лимит = `freeQty` (= UR − RES). Иначе отрицательный «свободный» остаток. Сначала снять/уменьшить RES, потом STT в QI/Blocked. |
| B | **Исходящие списания** | PRI / SHP / WOF всегда минусуют **unrestricted** (не QI/Blocked). SHP/WOF: нельзя уйти ниже RES (freeQty). **Исключение G2b:** PRI с `productionOrderId` (закрытие фазы) — **можно сверх RES** (warn в UI); ниже нуля склада/UR — нельзя. См. [tech-maps-pp-pi-phases](tech-maps-pp-pi-phases.md) §4. |
| C | **TRN** | MVP: перенос **того же** stock type; по умолчанию в UI — unrestricted. QI/Blocked переносить можно только явно указав тип (иначе карантин «утечёт» в UR на другом складе). |
| D | **RCP / PRR приход** | Целевой тип на шапке/строке: `stockType` default **unrestricted**. Сценарий или пользователь ставит **qi**. Не хардкодить «весь RCP в QI». |
| E | **INV** | Книжный остаток = **сумма трёх** типов (физ. наличие). Дельта INV → дети WOF/PST правят только **unrestricted**. Чтобы поправить QI/Blocked — сначала STT. (Иначе INV плодит третий канал «тихого» качества.) |
| F | **Сценарии** | Создают обычные draft-документы (видны в журнале) и при флаге «автопроведение» вызывают **тот же** `post*`, что UI. Запрещён прямой `applyStockDelta` из `scenarios.js`. |
| G | **Причины** | Справочник `movement_reasons`. STT → Blocked / из Blocked: reason **обязателен**. STT QI↔UR: опционален (MVP). TRN: опционален, кроме предустановленных сценариев «проба» (подготовка к Q13). |
| H | **Порядок внедрения** | Сначала три qty + STT **параллельно** со старым QCM; cutover сценариев; затем снос QCM. Не сносить QCM в том же коммите, что ломает freeQty. |
| I | **Сторно STT** | Как R10 (документ B), когда R10 готов; до R10 — legacy cancel STT допустим temporary, в коде пометить TODO R10. |
| J | **STOR1** | Логическая модель сразу с тремя полями; JSON-store сначала; DDL W1 — в волне STOR1, не блокирует Q10. |

---

## Модель данных

### `stock`

| Поле | |
|------|--|
| ключ | `materialId`, `lotId`, `warehouseId` |
| `quantityUnrestricted` | |
| `quantityQi` | |
| `quantityBlocked` | |
| (legacy) `quantity` | удалить после миграции: значение → unrestricted |

Инвариант: все три ≥ 0; `total = sum`.

### `material_movements`

- `stockType` на дельте: `unrestricted` \| `qi` \| `blocked`
- для STT: две ноги или одна строка с `fromStockType` / `toStockType` + qty (предпочтительно **две** signed строки в журнале — симметрия с TRN, проще R10)
- опц. `movementReasonId`

### `movement_reasons`

`id`, `code`, `name`, `active`; связь допустимости — конфиг на тип документа (таблица или поле `allowedDocumentTypes[]`).

### STT (document type)

| | |
|--|--|
| id / code | `stock_type_transfer` / **STT** |
| warehouseMode | `single` (тот же склад) |
| строка | material, lot, warehouse, fromType, toType, qty, reason? |
| post | −from +to; проверки freeQty если from=unrestricted |

Синхронно: `documentTypes.js` + FE `documentTypes.ts` + nav + RBAC `doc_*`.

---

## Поведение по типам документов

| Тип | Qty-эффект |
|-----|------------|
| RCP / PST / PRR | + в выбранный `stockType` (default UR) |
| WOF / SHP / PRI | − **unrestricted**, ≤ freeQty (PRI: согласовать с фактом заказа) |
| TRN | −type на from, +type на to; type с строки |
| STT | −fromType +toType, один склад |
| RES | без изменения stock; лимит freeQty (UR−RES) |
| INV | book=sum; дети только UR |

---

## Снос качества (QCM)

Удалить / вычистить:

- BE: `quality.js`, `routes/quality.js`, `lotQuality.js` (или оставить пустым), коллекции, `migrateLotQualitiesDefaults`, referentialIntegrity, systemObjects
- FE: `QualityManagementPage`, словарь, register/history pages, quality history report, куски `lotSelect` / planning badges `qualityAllowed`
- Сценарии: модель «качествоId» → действия «создать RCP/STT с типом…»
- userGuide §13 переписать под типы остатка + LCH + сценарии-движения
- Отчёт «Качество запасов» → «Остатки по типу» (UR/QI/Blocked); историю качеств убрать или заменить журналом STT+причин

---

## Уязвимости и конфликты

| Риск | Митигация |
|------|-----------|
| STT уводит UR, оставляя RES «висеть» | Правило **A**: нельзя STT больше freeQty |
| PRI/SHP обходят RES (баг уже сейчас) | Правило **B**: выровнять на freeQty |
| TRN QI→UR на другом складе | Правило **C**: тот же type |
| INV «чинит» карантин без STT | Правило **E** |
| Сценарий пишет stock в обход журнала | Правило **F** + code review |
| Двойной gate (QCM + типы) в переходный период | Правило **H**: короткий параллельный режим; cutover чеклист |
| STOR1 DDL отстаёт от JSON | Правило **J**; не блокировать Q10 |
| R10 не готов | Правило **I** |
| FEFO берёт lab/QI | freeQty только UR; склады lab — вне FEFO до Q13 (тип склада / exclude), иначе QI на lab |
| Потеря «Условно годен» | Сознательно; warnings позже через Q12 |
| Отчёт R4 / quality history сломают UI | Заменить в том же релизе, что снос |
| INT1 / внешние ожидают одно quantity | Документировать total=sum; внешний контракт — позже INT1 |
| G12 UOM на движениях | Не блокирует; stock type ортогонален ЕИ |
| D010 одна партия на складах | Совместимо; STT не заменяет TRN |

Противоречие с **закрытыми** Q1–Q4/QBL: помечены superseded в ROADMAP — ок.

---

## Фазы реализации (ветки от `main`)

### Фаза 1 — ядро остатка (без сноса QCM)

1. Миграция stock → три поля; `applyStockDelta(lot, wh, delta, stockType)`.
2. `freeQty` = UR − RES; planning/FEFO на freeQty.
3. Все post-handlers существующих типов: явный stockType (default UR).
4. Регрессия: chain tests, seed, import xlsx.
5. Отчёт запасов / движения: показывать три колонки (+ total).

**Критерий:** старый QCM ещё работает; весь физический остаток в UR после миграции.

### Фаза 2 — STT + причины

1. Справочник `movement_reasons` + CRUD/RBAC.
2. Тип STT BE+FE; post/cancel; UI документ.
3. Guards: from unrestricted ≤ freeQty.
4. userGuide: черновик раздела STT.

**Критерий:** ручной QI↔UR↔Blocked без QCM.

### Фаза 3 — политика прихода и сценарии

1. `stockType` на RCP/PRR (UI + API).
2. Сценарии: вместо qualityId — шаблон документов (тип, stockType, reason, автоpost?).
3. Cutover существующих сценариев пилота (если есть) → QI при создании партии / приёмке.

**Критерий:** путь «приёмка в QI → LCH → STT в UR» руками и сценарием; документы в журнале.

### Фаза 4 — снос QCM и отчёты

1. Удаление API/UI/коллекций/nav/RBAC/тестов scenarios.quality.
2. Planning: убрать `qualityAllowed`; блок только нулевым freeQty.
3. Отчёты: quality-stock → типы остатка; quality-history снять или stub «удалено».
4. userGuide §13; Q9 → готово/закрыто в ROADMAP.
5. Wiki: qcm entity archived note; log.

**Критерий:** grep по репо — нет `lot_qualities` / `quality_register` / QCM routes; npm test green.

### Фаза 5 — стык платформы

1. INV по правилу E + UI подсказка.
2. Выравнивание PRI/SHP/WOF с freeQty (B).
3. Пометка STT cancel → R10; STOR1 поля в плане DDL уже есть.
4. Pilot: бэкап sqlite → migrate → smoke RCP/STT/RES/PRI.

---

## Вне скоупа Q10

Q11 lot · Q12 допуски · Q13 пробы · Q8 CAPA · Restricted · авто expiry · partial qty внутри строки сторно · отдельный «складской QI» без STT.

---

## Чеклист приёмки

- [ ] Миграция: sum(UR+QI+Blk) = бывший quantity на каждой строке
- [ ] RES не берёт QI/Blocked; STT не ломает RES (A)
- [ ] STT + reason в Blocked; журнал движений с stockType
- [ ] Сценарий создаёт видимый документ; stock меняется только после post
- [ ] QCM/словарь/регистр отсутствуют
- [ ] Отчёты и userGuide согласованы
- [ ] Q9 закрыт в ROADMAP; wiki/log; BE+FE documentTypes синхронны

## Todos

- [ ] Фаза 1: три qty + applyStockDelta + freeQty
- [ ] Фаза 2: STT + movement_reasons
- [ ] Фаза 3: RCP stockType + сценарии→документы
- [ ] Фаза 4: снос QCM + отчёты + Q9
- [ ] Фаза 5: INV/PRI-freeQty + STOR1/R10 пометки
