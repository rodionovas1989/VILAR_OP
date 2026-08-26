# Concept: ПДн и доступ без саморегистрации

**Канон:** [docs/LEGAL_PDN.md](../../docs/LEGAL_PDN.md); тексты UI — `frontend/src/content/legal/`.

- Учётки создаёт администратор; саморегистрации нет.
- Политика ПДн принимается при первом входе / смене версии (`pdnAcceptedAt`, `pdnPolicyVersion`).
- Сроки: login audit 90 дней; чат ≤200 сообщений; сессия ~8 ч / до 30 сут с «Запомнить».
- Перед промышленной эксплуатацией — юрлицо оператора в константах + оргчеклист в LEGAL_PDN.
- Не публиковать sqlite / пароли / `auth_secret` в открытый git.

**Связано:** [ops/secrets-and-local.md](../ops/secrets-and-local.md), [decisions/D004-cookie-auth.md](../decisions/D004-cookie-auth.md)
