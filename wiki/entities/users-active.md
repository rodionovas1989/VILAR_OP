# Entity: пользователи и признак «Активен»

Учётные записи в коллекции `users`. Саморегистрации нет — заводит администратор.

## Политика деактивации (FB-2026-10-27-00003)

- Поле `active` (default `true`). Снятие «Активен» = увольнение/блокировка.
- **Hard-delete запрещён** (`assertCanDelete` + `allowDelete={false}` в CRUD): история операций и ссылки `*ByUserId` должны жить.
- Вход: при верном пароле и `active === false` — сообщение «Учётная запись отключена…»; иначе «Неверный логин или пароль».
- Сессия: `verifyToken` возвращает `null`, если пользователь стал неактивным.
- Имена в обратной связи пишутся снимком (`createdByName`); документы хранят id — имя резолвится из `users` (карточка остаётся).

**Код:** `services/users.js`, `services/auth.js`, `referentialIntegrity.js` (`users`), UI `App.tsx` case `users`.  
**Связано:** [login-audit.md](login-audit.md), [feedback-tickets.md](feedback-tickets.md), [legal-pdn.md](../concepts/legal-pdn.md).
