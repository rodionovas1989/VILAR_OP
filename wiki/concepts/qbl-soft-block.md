# Concept: QBL — мягкая блокировка партии

Исторически: блокировка/карантин партии через качество (сейчас единый **QCM**, не отдельный вид QBL):

- подсветка + причина в подборе;
- остаток **не** обнуляется (мягкий карантин);
- жёсткий запрет резерва — ROADMAP **Q9** (идея); целевая модель с qty QI/Blocked — **Q10**.

В коде партии: legacy флаги block* снимаются при проведении QCM через quality-сервис.

**Канон статуса:** [docs/ROADMAP.md](../../docs/ROADMAP.md) (QBL готово; Q9 / Q10)  
**Связано:** [entities/qcm-quality.md](../entities/qcm-quality.md), [fefo-fifo-picking.md](fefo-fifo-picking.md), [analyses/quality-stock-types.md](../analyses/quality-stock-types.md)
