---
roadmap_id: Q7
status: planned
estimate_h:
actual_h:
---

# Вложения к партиям (COA / сертификаты)

Метаданные в SQLite, байты в **Yandex Object Storage** (S3); локальный FS только для dev. Диск ВМ не раздувать под сканы.

## Контекст ограничений

- Нет бинарного пайплайна: JSON API 10mb ([backend/src/index.js](../../backend/src/index.js)).
- Данные — JSON в SQLite ([store.js](../../backend/src/store.js), [D001](../../wiki/decisions/D001-sqlite-builtin.md)).
- Бэкап сейчас — только `VACUUM INTO` sqlite ([dataMaintenance.js](../../backend/src/services/dataMaintenance.js)).
- Диск ВМ ~20 ГБ SSD; расширение network-ssd дорого относительно object storage.
- Файлы вешать на **партию**, не внутрь документа качества (QCM).

## Почему Object Storage, а не SSD ВМ

Ориентиры Yandex Cloud (₽ с НДС; сверять [storage/pricing](https://yandex.cloud/ru/docs/storage/pricing)):

| Носитель | ~₽/ГБ·мес | 50 ГБ · мес |
|----------|-----------|-------------|
| network-ssd | ~15,7 | ~785 ₽ (выделенный размер) |
| Object Storage STANDARD | 2,376 | ~117 ₽ |
| COLD | 1,267 | ~63 ₽ |
| ICE | 0,633 | ~32 ₽ (мин. 12 мес) |

На старте — **STANDARD** (или COLD при редком чтении). Versioning бакета = часть бэкапа файлов. Sqlite слепок — по-прежнему off-VM.

## Целевая схема

- Коллекция `lot_attachments`: `id`, `lotId`, `kind`, `originalName`, `mime`, `size`, `sha256`, `storageKey`, `uploadedBy`, `uploadedAt`, `deletedAt?`.
- Адаптер `BlobStore` (`S3BlobStore` / `FsBlobStore` для local).
- Env (только EnvironmentFile на ВМ): endpoint, bucket, keys — см. [secrets-and-local](../../wiki/ops/secrets-and-local.md).
- Upload multipart → API → PutObject (`lots/<lotId>/<uuid>`).
- Download через API (RBAC); MIME whitelist; лимит ~5–10 МБ/файл.

## Не делать

- BLOB/base64 в sqlite; PDF в JSON store.
- Раздувать network-ssd под архив сканов.
- Публичный бакет; ключи S3 в git.

## Порядок внедрения

1. ADR: S3 primary, FS local, запрет BLOB.
2. Бакет + ключи в `/etc/vilar-op.env`.
3. Backend adapter + routes + RBAC; nginx `client_max_body_size`.
4. UI карточки партии + userGuide.
5. Versioning бакета + регламент sqlite off-VM; wiki/ops.
6. Оценка COLD vs STANDARD по факту доступа.

## Вне скоупа v1

Поиск по PDF, превью, presigned download, автозагрузка из 1С/почты.

## Todos

- [ ] ADR Object Storage + metadata
- [ ] S3 adapter, upload/download, RBAC
- [ ] Бэкап: sqlite off-VM + versioning; квоты MIME
- [ ] UI + userGuide
