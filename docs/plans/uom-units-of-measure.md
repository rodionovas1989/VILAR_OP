---
roadmap_id: G12
status: planned
estimate_h:
actual_h:
tokens_approx:
---

# Единицы измерения (UOM)

Разбор: [wiki/analyses/uom-units-of-measure.md](../../wiki/analyses/uom-units-of-measure.md). Ориентир SAP: `MARA.MEINS` / `MARD` / `MARM` / `MSEG`.

## Зафиксированные решения

1. **Учётная ЕИ** — на карточке материала (`baseUomId`), не в модели учёта.
2. **Одна учётная ЕИ:** все движения и регистры остатка только в ней.
3. **Регистры `stock` / `active_reservations`:** qty-only (**R1**, как SAP `MARD`); колонку ЕИ в остаток не добавлять.
4. **Смена `baseUomId` после зависимостей:** запрет на **API** (`materials` `beforeUpdate` + чеклист); UI только отражает. Обход — альты или новый материал; админ-миграция ×k — отдельный канал (не в MVP).
5. **Альты + коэффициенты** — задел для отчётов/столов/ввода; не dual stock.
6. **Catch weight** — вне MVP (при необходимости позже, база кг + FW2).

## Фазы

### G12-a — MVP (учётная ЕИ)

1. Справочник `uoms` (минимум: кг, уп; далее г/т/шт/л по потребности).
2. `material.baseUomId` вместо свободной строки `unit`; миграция существующих `кг`/`уп`.
3. Soft-default при создании: продукт → уп, иначе → кг.
4. Серверный `assertBaseUomChangeAllowed` + список blockers в ошибке 400.
5. На строках складских/производственных документов при save/post: снимок **`uomBaseId`** (= текущий base материала). Опционально сразу слоты `qtyEntry` / `uomEntry` (= base в MVP).
6. UI: показ подписи ЕИ из каталога; ввод по-прежнему в учётной ЕИ.
7. Wiki + userGuide по смыслу; ADR при желании (`D0xx-base-uom`).

### G12-b — Альты (после потребности)

1. Альтернативы на материале (`altUomId` + `factorToBase`); system peer внутри размерности (кг↔г).
2. Ввод в `uomEntry` → пересчёт в base до `applyStockDelta`; snapshot factor на post.
3. Presentation convert в отчётах/столах.

### Вне скоупа v1

- Dual qty в `stock` (R3).
- Catch weight / счёт мест как второй остаток.
- Иерархия упаковок (паллета→короб).
- Смена base через обычную карточку при ненулевом стоке.

## Не делать

- ЕИ только на фронте / запрет смены только disabled в UI.
- Второе независимое qty в регистре остатка.
- Жёсткую базовую ЕИ только из модели учёта.

## Todos

- [ ] G12-a: каталог + baseUomId + миграция + API-guard
- [ ] G12-a: uomBaseId (и слот entry) на строках документов / movement log
- [ ] G12-b: альты + ввод/отчёты (по запросу)
- [ ] ADR + wiki sync после merge в main
