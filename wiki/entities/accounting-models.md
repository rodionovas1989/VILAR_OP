# Entity: модели учёта

Справочник **Настройки системы → Модели учёта** (`accounting_models`, внизу меню). На материале — `accountingModelId`.

Сиды (создание, если нет по id):

- `am-standard` **Стандартная** — закуп, без шаблона, `parseMode=none`, смешение выкл., `qtyDisplayDecimals=3`.
- `am-internal` **Внутреннее производство** — `ownProduction`, шаблон загрузка + MM + YY, разбор **справа налево**, `parseMode=fill`, `generateOnRelease`, смешение выкл., `qtyDisplayDecimals=3`.

Карточка — вкладки: **Основное** (`ownProduction`, **`qtyDisplayDecimals`** 0…6 — только показ qty), **Шаблоны партий** (генерация, разбор, шаблон), **Смешение партий** (`mixSameManufacturer`). Подсказки — `HintButton`.

`qtyDisplayDecimals` не меняет `roundQty`/хранение (6 знаков). **Весь readonly-показ qty в UI** (столы, документы, отчёты, регистры) берёт масштаб через `useQtyFormat` / `formatQty(n, decimals)` ← материал → модель. Агрегаты без одного материала — default 3. `DecimalInput` при редактировании не усекает.

Шаблон — список блоков + `parseDirection` (`rtl`/`ltr`). Разбор и генерация: `backend/src/services/numberTemplates.js`. Подбор FEFO/FIFO читает только `lot.productionSequence`.

Тогл смешения: несколько строк заказа на одну позицию спеки, только партии одного производителя. Разные производители — не этим тоглом; позже справочник качества ([lot-mixing-policy](../analyses/lot-mixing-policy.md)).

Смена модели на материале пересчитывает sequence партий этого материала.

**Связано:** [fefo-fifo-picking](../concepts/fefo-fifo-picking.md), [D011](../decisions/D011-lot-production-sequence.md), [decimal-input](decimal-input.md)
