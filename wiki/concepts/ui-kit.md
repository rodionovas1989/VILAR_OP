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
| Table | `.data-table` + `.table-wrap`; sticky `th`, row hover, denser padding |
| Table cells (ТЧ) | роли: `.td-clip` (ellipsis + `title`), `.td-ctrl` (select/input), `.td-num`, `.td-sticky-end` — без горизонтального скролла |
| Modal | единый header/footer spacing; скролл — [ui-scroll-layout](ui-scroll-layout.md) |

## Чеклист нового экрана

1. Цвета только из `:root` (accent/side/panel/line/danger).
2. Фильтры/поиск: `.ctrl` / `ctrl-like`, высота ≈ `--ctrl-h`.
3. Списки: `.table-wrap` + sticky thead; не фиксировать высоту без `min-height: 0` / overflow.
4. ТЧ с длинными именами: явный `.td-clip` / `.td-ctrl`, не полагаться на `nth-child` ширины.
5. `modal-doc`: обязателен `.doc-form-scroll` (см. ui-scroll-layout).
6. Настройки-флаги: `ToggleSwitch`, не голый checkbox.
7. Числа: `DecimalInput`.
8. Не вводить Inter-only hero, purple gradients, cream+terracotta display.

## Персонализация колонок (прототип)

На «Производство → Управление заказами → Исполнение»: чекбоксы «Колонки» скрывают информационные/дублирующие колонки (IDN, Свободно, Контрагент). Persist: `localStorage` `vilar.prodDesktop.cols.<userId>`. Обязательные поля ввода (партия производителя, склад, кол-во) не скрываются.

## Вне scope этого baseline

Полный редизайн каждой страницы, dark mode, смена навигации. Resize ширин / views — позже.
