---
roadmap_id: META
status: done
estimate_h:
actual_h:
---

# Процесс ROADMAP ↔ планы ↔ метрики

Канон: [docs/ROADMAP.md](../ROADMAP.md) — домены, Активные / Закрыто, колонка Effort.  
Планы: [docs/plans/](./). Не полагаться на `~/.cursor/plans`.

## Цикл

1. Строка в домене → «Активные».
2. План → `docs/plans/<slug>.md` + **есть план** + ссылка.
3. `main` → **готово** + Effort → «Закрыто»; wiki/log.

## Метрики

Витрина в ROADMAP; детали — frontmatter / `local/roadmap-effort.json`. Агент не читает метрики сам.

## Агентская обвязка в репо

| Что | Где |
|-----|-----|
| Project rules | `.cursor/rules/*.mdc` |
| Указатель планов | `.cursor/plans/README.md` → сюда |
| Планы фич | `docs/plans/*.md` |
| Wiki / schema | `wiki/` |
