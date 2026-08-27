# UI scroll layout (modal-doc)

Канон для модалок документов (`.modal-doc`), чтобы длинные формы не клипались.

## Цепочка flex

```
.modal / .modal-doc   → column, max-height, min-height: 0
  .modal-header       → flex: 0 (не скроллится)
  .modal-body         → flex: 1, min-height: 0, column
    .doc-form         → flex: 1, min-height: 0, column
      .doc-form-scroll / .modal-scroll  → flex: 1, min-height: 0, overflow: auto
      .doc-form-extra (опц.)            → flex: 0 (футер формы: вкладки и т.п.)
  .modal-footer       → flex: 0 (не скроллится)
```

## Правила

1. Shell `.modal` / `.modal-doc` — column + `max-height` + `min-height: 0`.
2. Chrome (header/footer) не скроллится; скролл только в content region.
3. Каждый `modal-doc` обязан иметь `.doc-form-scroll` (синоним `.modal-scroll`): `flex:1; min-height:0; overflow:auto`.
4. Многострочные ТЧ: внутри scroll-region или отдельный `.table-wrap` с `min-height:0; overflow:auto` (не без max/flex).
5. Запрет: `overflow:hidden` на `.doc-form` без scrolling child.

## CSS fallback

Если у `.doc-form` нет `.doc-form-scroll` / `.modal-scroll`, форма сама получает `overflow: auto` (`:not(:has(...))`), чтобы не клипать навсегда. Эталон разметки — всё равно со scroll-child (см. `DocumentTypePage`, `ProductionOrderPage`, LCH/QCM).

## Эталоны в коде

- `frontend/src/components/DocumentTypePage.tsx`
- `frontend/src/components/ProductionOrderPage.tsx`
- `frontend/src/components/CharacteristicManagementPage.tsx`
- `frontend/src/components/QualityManagementPage.tsx`

См. также [ui-kit](ui-kit.md).
