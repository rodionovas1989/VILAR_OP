# Concept: признак «Активен» у справочников

Единый soft-flag `active` (default `true`): запись остаётся в БД и в истории, но не предлагается в новых выборах.

| Коллекция | Статус |
|-----------|--------|
| users | да ([users-active](../entities/users-active.md)) |
| lot_qualities, substitutions, characteristics | да |
| counterparties, manufacturers | да (FB-2026-10-27-00002) |
| materials, series, warehouses, work_centers, tech_maps | ещё нет — тот же паттерн при следующем тикете |

**Правило агента:** `.cursor/rules/dictionary-requisites.mdc`  
**Хелпер UI:** `activeOnly` / `activeOrSelected`  
**Связано:** [soft-vs-hard-supplier-approval](soft-vs-hard-supplier-approval.md) (другая ось — одобрение поставщика, не архив).
