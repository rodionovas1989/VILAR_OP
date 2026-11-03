# Анализ: сторно складских документов

Статус: синтез + **есть план**. Обновлено: **2026-11-03**.  
Канон: [`docs/plans/storno-stock-documents.md`](../../docs/plans/storno-stock-documents.md) (R10), упрощённо частично — [`storno-partial-lines.md`](../../docs/plans/storno-partial-lines.md) (R11).  
ADR: [D013](../decisions/D013-storno-new-document.md).

## Зачем

Сейчас отмена пишет обратные движения в тот же документ и помечает строки `cancelled`. Для отчётов «на дату» и ПТО это ломает ясную историю. В SAP отмена — **новый материал-документ** со ссылкой на исходник.

## Целевой опыт пользователя

1. На проведённом A: «Сторно» / «Отменить».
2. Открывается **черновик B** (новый номер, обратные строки, ссылка на A).
3. Пользователь проверяет и жмёт **Провести**.
4. В списках: A — сторнирован; B — проведённый сторно-документ.
5. «Провести повторно» тот же id — больше не путь; нужен новый документ после сторно.

## Даты

- `postingDate` — учётный день (срезы, ПТО).
- `at` — когда записали в систему.
- У B дата проводки по умолчанию как у A (как MIGO).

## Схема (STOR1)

Нужны `posting_date` на движениях; на шапке — `reverses_document_id`, статус `reversed`. Согласовано с планом STOR1.

## Частичное сторно

Отдельный пункт **R11**: выбрать часть строк A (целиком), не дробить qty в строке.

## Связано

[document-lifecycle](../concepts/document-lifecycle.md), [stock-registers](../entities/stock-registers.md), [pto-manual-form](pto-manual-form.md), [sap-mm-pp-comparison](sap-mm-pp-comparison.md), [relational-storage-migration](relational-storage-migration.md).
