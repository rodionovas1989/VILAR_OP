# Entity: модели учёта

Справочник **Настройки системы → Модели учёта** (`accounting_models`, внизу меню). На материале — `accountingModelId`.

Сиды (создание, если нет по id):

- `am-standard` **Стандартная** — закуп, без шаблона, `parseMode=none`, смешение выкл.
- `am-internal` **Внутреннее производство** — `ownProduction`, шаблон загрузка + MM + YY, разбор **справа налево**, `parseMode=fill`, `generateOnRelease`, смешение выкл.

Карточка — вкладки: **Основное** (`ownProduction`), **Шаблоны партий** (генерация, разбор, шаблон), **Смешение партий** (`mixSameManufacturer`). Подсказки — `HintButton`.

Шаблон — список блоков + `parseDirection` (`rtl`/`ltr`). Разбор и генерация: `backend/src/services/numberTemplates.js`. Подбор FEFO/FIFO читает только `lot.productionSequence`.

Тогл смешения: несколько строк заказа на одну позицию спеки, только партии одного производителя. Разные производители — не этим тоглом; позже справочник качества ([lot-mixing-policy](../analyses/lot-mixing-policy.md)).

Смена модели на материале пересчитывает sequence партий этого материала.

**Связано:** [fefo-fifo-picking](../concepts/fefo-fifo-picking.md), [D011](../decisions/D011-lot-production-sequence.md)
