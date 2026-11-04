# Анализ: качество как тип остатка — Q10

Статус: целевая модель + разбор рисков. Обновлено: **2026-11-04**.  
План (канон реализации): [docs/plans/quality-stock-types.md](../../docs/plans/quality-stock-types.md).  
ADR: [D014](../decisions/D014-quality-stock-types.md).  
Сценарии: [quality-scenarios-movements](../concepts/quality-scenarios-movements.md).

---

## Целевая модель

Три qty (UR / QI / Blocked); доступность = UR − RES; смена типа только **STT** (+ прочие складские доки); снос QCM/`lot_qualities`; сценарии = видимые документы; причины движения; LCH остаётся; Q11/Q12/Q13 вне Q10.

## Конфликты с текущим кодом

| Место | Сейчас | Q10 |
|-------|--------|-----|
| `applyStockDelta` | одно `quantity` | delta + `stockType` |
| `freeQtyByLot` | qty − RES | **UR** − RES |
| WOF/PRI/SHP | минус от полного qty, RES часто игнор | только UR, ≤ freeQty |
| QCM / scenarios | регистр без движений | снос; сценарии→STT/RCP |
| Отчёт качества запасов | permission на партию | колонки UR/QI/Blocked |
| INV book | одно число | sum трёх; дети только UR |

## Уязвимости (закрыты правилами A–J в плане)

1. **RES + STT** — увод UR под резервом → запрет STT > freeQty.  
2. **PRI/SHP vs RES** — выровнять (дыра уже есть).  
3. **TRN смены типа «в пути»** — перенос того же stock type.  
4. **INV как обход карантина** — дети только UR.  
5. **Скрытые проводки сценариев** — запрет; только post API документов.  
6. **Двойной gate** на переходном релизе — фазы: сначала STT, потом снос QCM.  
7. **Lab/QI в FEFO** — FEFO только UR.  
8. **R10/STOR1** — не блокер старта; STT cancel → TODO R10.

## Соседние ROADMAP

| ID | Связь |
|----|--------|
| Q9 | Закрыть после Q10 |
| Q11–Q13 | Не входят в Q10 |
| STOR1 / R10 / G12 | Ортогональны; стык в фазе 5 плана |
