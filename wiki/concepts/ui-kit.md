# Clinical Ops UI kit

Базовый визуальный набор Vilar OP («Clinical Ops Refresh»): эволюция текущих токенов (navy `--side`, teal `--accent` `#1a7a62`, светлый `--panel`), без смены бренда, без тёмной темы и без purple/cream-serif/broadsheet.

## Токены (`:root` в `App.css`)

| Токен | Назначение |
|-------|------------|
| `--radius-sm` / `--radius-md` | Кнопки/ctrl и панели |
| `--ctrl-h`, `--ctrl-pad-x`, `--ctrl-bg`, `--ctrl-line`, `--ctrl-focus` | Высота и focus ring полей |
| `--table-cell-y` / `--table-cell-x` | Плотнее ячейки таблиц |

## Примитивы

| Примитив | Как |
|----------|-----|
| Boxed field | класс `.ctrl` на `input` / `select` / `textarea` (фильтры, тулбары) |
| Underline field | стиль `.doc-form` (шапки документов) — не смешивать с `.ctrl` без нужды |
| SearchableSelect | в фильтрах: `className="ctrl-like"`; в doc-form — underline как inputs |
| Button | primary (default), `.ghost` / `.secondary`, `.danger` — padding/radius от токенов |
| ToggleSwitch | стандарт настроек (тоглы) |
| LabeledToggle | тогл слева, подпись справа, опционально `HintButton` |
| HintButton | пиктограмма «?» → вложенная модалка с текстом (`nested`) |
| Table | `.data-table` + `.table-wrap`; sticky `th`, row hover, denser padding |
| Table cells (ТЧ) | **канон при bleed/наезде:** `.td-clip` / `.td-ctrl` / `.td-num` / `.td-sticky-end` — ellipsis + `title`, **без** горизонтального скролла ТЧ |
| Modal | единый header/footer spacing; рендер в `document.body` (portal); подсказки — `className="modal-hint"`; скролл — [ui-scroll-layout](ui-scroll-layout.md) |
| NumberTemplateField | на карточке пример номера + «карандаш»; блоки и порядок — во вложенной модалке |

## Чеклист нового экрана

1. Цвета только из `:root` (accent/side/panel/line/danger).
2. Фильтры/поиск: `.ctrl` / `ctrl-like`, высота ≈ `--ctrl-h`.
3. Списки: `.table-wrap` + sticky thead; не фиксировать высоту без `min-height: 0` / overflow.
4. ТЧ с длинными именами: явный `.td-clip` / `.td-ctrl`, не полагаться на `nth-child` ширины под N колонок.
5. `modal-doc`: обязателен `.doc-form-scroll` (см. ui-scroll-layout).
6. Настройки-флаги: `ToggleSwitch`, не голый checkbox.
7. Числа: `DecimalInput`.
8. Не вводить Inter-only hero, purple gradients, cream+terracotta display.

## Плотные ТЧ: канон (2026-09-07)

**Проблема:** `table-layout: fixed` + `nowrap` без clip → длинный текст наезжает на соседние колонки.

**Основной подход (не масштабировать превентивно на все экраны — включать при жалобе/bleed):**

1. Роли ячеек `.td-clip` / `.td-ctrl` / `.td-num` / `.td-sticky-end` в `App.css`.
2. Ширины через именованные `.col-*`, не хрупкий `nth-child` под число колонок.
3. Опциональная персонализация: иконка `columns` (`IconButton`) справа над таблицей → popover с чекбоксами; скрывать только информационные/дублирующие колонки, не обязательный ввод; persist `localStorage` на `userId`.
4. Не использовать горизонтальный скролл ТЧ как норму UX.

**Эталон:** «Производство → Управление заказами → Исполнение» (`ProductionDesktop`). Подбор сырья частично получил clip. Остальные экраны — по необходимости.

## Персонализация колонок (эталон)

Иконка колонок справа над таблицей; бейдж = число скрытых; «Показать все». Ключ: `vilar.prodDesktop.cols.<userId>`. Скрываемые на эталоне: IDN, Свободно, Контрагент.

## Вне scope этого baseline

Полный редизайн каждой страницы, dark mode, смена навигации. Resize ширин / именованные views — позже. Массовый rollout clip на все ТЧ — не сейчас.
