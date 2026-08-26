# D007 — LLM Wiki как слой знаний агента

**Решение:** ввести `wiki/` + `raw/` + schema/rules; существующие `docs/*` методики оставить raw-by-convention; не удалять AGENT_BRIEF на первом этапе.

**Почему:** знания между сессиями накапливаются (ingest), а не пересобираются из чанков каждый раз.

**Источники идеи:** [llm-wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), [karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)
