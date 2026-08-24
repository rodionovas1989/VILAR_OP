# BRANCH_INFO

| Ветка | Описание | Статус |
|-------|----------|--------|
| `main` | + производители, analytics movements PRI/PRR, аудит, ops-debug | **эталон** |
| `feature/prod-analytics-movements-split-badges` | Регистр аналитики = движения PRI/PRR; раздельные бейджи CP/MFR | **слита** в main |
| `feature/ops-debug-log` | Операционный JSONL-журнал API (мутации + ошибки) | **слита** в main |
| `feature/document-status-audit` | Журнал статусов документов (A3b) | **слита** в main |
| `feature/production-analytics-register` | Регистр аналитики производства при completeOrder | **слита** в main |
| `feature/lot-manufacturer-approvals` | Справочник Производители; тройка в одобренных; мягкий бейдж | **слита** в main |
| `fix/admin-backups-list-scroll` | Скролл списка слепков на странице резервных копий | **слита** в main |
| `fix/hide-spec-recalc-comment` | Убрана подсказка «норма для N% сухого» под методом пересчёта | **слита** в main |
| `feature/lot-characteristics` | LCH + импорт рецептур заказчика + аналоги | **слита** в main |
| `feature/customer-recipes-analogs` | Рецептуры ВИЛАР + аналоги (промежуточный слой) | **снята** (работа ушла в `feature/lot-characteristics`) |
| `feature/searchable-selects` | Поиск в выпадающих списках (поле сверху панели) | **слита** в main |
| `fix/scenario-checkbox-align` | Выравнивание чекбоксов в форме сценариев качества | **слита** в main |
| `feature/series-planning-tech-maps` | Техкарты; планирование серий; отчёт План/Факт | **слита** в main |
| `feature/quality-scenarios-mvp` | Сценарии: регистрация новых партий → авто-QCM | **слита** в main |
| `feature/quality-reports` | Отчёты: качество запасов + история качеств | **слита** в main |
| `feature/legal-pdn-notices` | Политика ПДн, cookies, принятие при входе, ротация журнала | **слита** в main |
| `feature/recent-opened-strip` | Полоска последних открытых объектов под шапкой | **слита** в main |
| `feature/ref-integrity-delete-guards` | Запрет удаления справочников при ссылках; обновление userGuide по качеству | **слита** в main |
| `feature/quality-doc-trace-movements` | Движения в карточке документа качества (как у складских) | **слита** в main |
| `feature/quality-lot-permissions-redesign` | Справочник качеств, единый QCM, регистры, проверки | **слита** в main |
| `feature/roadmap-batch-remaining` | W1–W4 ROADMAP batch | **слита** в main |
| `feature/admin-login-audit-envfile` | Журнал входов, скачать бэкап, EnvironmentFile | слита в main |
| `feature/favicon-vilar-logo` | Свой hi-tech логотип + favicon | слита в main |
| `feature/login-rate-limit` | Rate limit login | слита в main |
| `feature/auth-gate-landing` | Гостевой экран «Вход» | слита в main |
| `fix/http-randomuuid-fallback` | UUID fallback на http://IP | слита в main |
| `feature/admin-data-reset-demo-backups` | Админ: очистка, демо, бэкапы | слита в main |
| `fix/admin-login-no-hint-strong-password` | VILAR_ADMIN_PASSWORD | слита в main |
| `fix/sqlite-builtin-no-gyp` | node:sqlite | слита в main |
| `feature/reports-released-series` | Отчёты; обратная связь | слита в main |
| `feature/launch-sqlite-reservations` | SQLite, RES, RBAC | слита в main |
| `feature/stock-documents` | Документы движений | слита в main |
| `feature/initial-ops-planning` | Каркас ОП | слита в main |
| `feature/planning-orders-matrix` | Установка/запуск | слита в main |
| `feature/echarts-resource-gantt` | ECharts Гант | слита в main |
| `feature/planned-series-volumes` | Плановые объёмы | слита в main |
| `feature/spec-approved-suppliers` | Поставщики | слита в main |
| `feature/admin-export-dictionaries` | Экспорт справочников | слита в main |
| `feature/crud-ux-spec-type-filters` | Отборы | слита в main |
| `feature/spec-kg-per-1000-packs` | кг на 1000 уп | слита в main |
| `feature/production-desktop-warehouses` | Производство план/факт | слита в main |
