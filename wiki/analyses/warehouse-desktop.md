# Analysis: рабочий стол кладовщика (WP11)

Синтез проработки ROADMAP **WP11**: операционный хаб вместо ручного рисования документов как первичного UX.

**Канон плана:** [docs/plans/warehouse-desktop.md](../../docs/plans/warehouse-desktop.md).  
**Связано:** [G13 / Pull list](reservation-pull-list-staging.md), [D015](../decisions/D015-reservation-pull-list-staging.md), [document-lifecycle](../concepts/document-lifecycle.md), [QualityDesktop](../entities/lch-characteristics.md) (паттерн стола).

## Решения

- Стол — основной путь; журнал RCP/TRN/INV/SHP остаётся; «только стол» — через роли.
- Пять операций: приёмка (+партия / WP7), свободный TRN, INV→WOF/PST, обеспечение (Pull list), отгрузка.
- Свободный TRN ≠ обеспечение заказа (дисклеймер + deep-link).
- Волна обеспечения строго после **G13-c**; хаб и прочие формы могут раньше.
- PRI/PRR/RES/STT на стол не выносим.

## Волны кода (кратко)

0 хаб/nav → 1 RCP → 2 TRN → 3 INV → 4 SHP → 5 Pull list (блокер G13-c).

## Не путать

| Стол | Назначение |
|------|------------|
| `warehouse_desktop` | Кладовщик, движения запасов |
| `quality_desktop` | LCH / характеристики |
| `planning_desktop` / `production_desktop` | План и заказы |
