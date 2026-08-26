# Entity: production_register

Регистр **аналитики производства** (отдельно от `material_movements` / `stock`).

Пишется при проведении PRI (расход) и PRR (выпуск): материал, партия, заказ, серия, РЦ, документ, контрагент/производитель партии.

Назначение: прослеживаемость выпуска/списания в разрезе серии и заказа, не замена складского остатка.

**Код:** `backend/src/services/productionRegister.js`  
**Связано:** [pri-prr-complete.md](pri-prr-complete.md), [stock-registers.md](stock-registers.md)
