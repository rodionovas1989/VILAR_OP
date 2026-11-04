# Entity: характеристики LCH

- Справочник `lot_characteristics` (system/user; системные assay / loss_on_drying).
- Документ LCH + регистр `characteristic_register`.
- Применение на материале определяет, какие поля участвуют в пересчёте.
- Приёмка в этот регистр не пишет.
- **Рабочий стол качества** (`quality_desktop`): тогл «первичный ввод» → партии без значений по применимым характеристикам → confirm создаёт и проводит LCH; без тогла — обзор регистра + история.
- **Допуски / spec limits** пока нет — ROADMAP **Q12**; до них сценарии **не** завязаны на «все ОК» по LCH (только движения остатков по явным правилам).

**Канон пересчёта:** [concepts/lot-recalc-assay-dry.md](../concepts/lot-recalc-assay-dry.md)  
**Код:** `characteristics.js`, `lotRecalc.js`, `QualityDesktop.tsx`
