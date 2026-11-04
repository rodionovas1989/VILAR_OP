# Планы реализации (канон в репозитории)

Канонические планы фич живут **здесь**, в git — не в `~/.cursor/plans` на одном ПК.

## Цикл с ROADMAP

Формат карты: домены → в каждом **Активные** (сверху) и **Закрыто** (снизу).  
Колонки: ID · Тема · Описание · Приоритет · План. дата · Статус · План · Effort.

1. Строка в [`docs/ROADMAP.md`](../ROADMAP.md) в нужном домене, блок «Активные».
2. Проработка → `docs/plans/<slug>.md` + статус **есть план** + ссылка в колонке «План».
3. После факта в `main` → статус **готово**, заполнить **Effort** (часы · токены), перенести строку в «Закрыто».

Примеры: **Q7** [lot-attachments.md](lot-attachments.md) · **Q10** [quality-stock-types.md](quality-stock-types.md) · **R10** [storno-stock-documents.md](storno-stock-documents.md) · **STOR1** [relational-storage-postgres.md](relational-storage-postgres.md) · **G2b** [tech-maps-pp-pi-phases.md](tech-maps-pp-pi-phases.md) · **G13** [reservation-pull-list-staging.md](reservation-pull-list-staging.md) · **A3c** [order-status-history.md](order-status-history.md).

## Frontmatter плана

```yaml
---
roadmap_id: Q7
status: planned   # idea | planned | in_progress | done | deferred
estimate_h:
actual_h:
tokens_approx:    # опционально, из Cursor Usage
---
```

Effort в ROADMAP — краткая витрина; полные заметки — frontmatter и/или `local/roadmap-effort.json` (шаблон: [roadmap-effort.example.json](./roadmap-effort.example.json)).

## Агентская обвязка

- Правила: [`.cursor/rules/`](../../.cursor/rules/), особенно `roadmap-plans.mdc`
- Указатель: [`.cursor/plans/README.md`](../../.cursor/plans/README.md)
- Процесс: [wiki/sources/roadmap-and-agent-docs.md](../../wiki/sources/roadmap-and-agent-docs.md)
