## Ветка: feature/inventory-plan-fact-diff

Инвентаризация: вкладки **План / Факт / Разница**; план из `stock` по складу.
Проведение INV **не** меняет остатки — создаются черновики **WOF** и/или **PST** (`basisDocumentId` = INV).
Отмена INV запрещена, если связанный WOF/PST уже проведён; черновики-дети удаляются.
API: `GET /api/documents/inventory/stock-preview?warehouseId=`.
Повторное проведение INV недоступно.

Пилот: https://vilar-prod.ru
