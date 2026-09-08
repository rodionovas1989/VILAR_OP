# Entity: модели учёта

Справочник **Настройки системы → Модели учёта** (`accounting_models`). На материале — `accountingModelId`.

Сиды (создание, если нет по id):

- `am-standard` **Стандартная** — закуп, без шаблона, `parseMode=none`. Назначается всем материалам без модели.
- `am-internal` **Внутреннее производство** — `ownProduction`, шаблон загрузка + MM + YY, разбор **справа налево**, `parseMode=fill`, `generateOnRelease`.

Карточка модели: `LabeledToggle` (тогл слева, подпись, `HintButton` «?»). Шаблон партии на карточке — пример номера и пиктограмма правки; блоки и порядок — во вложенном окне (`NumberTemplateField`).

Шаблон — список блоков + `parseDirection` (`rtl`/`ltr`). Разбор и генерация: `backend/src/services/numberTemplates.js`. Подбор FEFO/FIFO читает только `lot.productionSequence`.

Смена модели на материале пересчитывает sequence партий этого материала.

**Связано:** [fefo-fifo-picking](../concepts/fefo-fifo-picking.md), [D011](../decisions/D011-lot-production-sequence.md)
