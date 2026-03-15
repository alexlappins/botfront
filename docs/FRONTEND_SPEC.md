# Что нужно фронту

## Окружение

- **Бэкенд:** `http://localhost:3000`
- **Фронт (dev):** например `http://localhost:5173`
- В Vite: проксировать `/api` на `http://localhost:3000`
- Все запросы к API — с `credentials: 'include'` (чтобы уходила cookie сессии)

## Авторизация

| Действие | Реализация |
|----------|------------|
| Вход | Редирект на `GET /api/auth/discord` (или ссылка на этот URL) |
| Текущий пользователь | `GET /api/auth/me` → 200 + `{ id, username, avatar, discriminator }` или 401 |
| Выход | Переход по `GET /api/auth/logout` |

## API (все запросы с куками)

| Метод | URL | Назначение |
|-------|-----|------------|
| GET | `/api/auth/me` | Кто залогинен |
| GET | `/api/guilds` | Список серверов пользователя |
| GET | `/api/guilds/:guildId/channels` | Каналы сервера |
| POST | `/api/guilds/:guildId/send` | Отправить сообщение (body: `channelId`, `title?`, `description?`, `image?`) |
| GET | `/api/guilds/:guildId/templates` | Список шаблонов |
| POST | `/api/guilds/:guildId/templates` | Создать шаблон |
| GET | `/api/guilds/:guildId/templates/:id` | Получить один шаблон |
| PATCH | `/api/guilds/:guildId/templates/:id` | Обновить шаблон |
| DELETE | `/api/guilds/:guildId/templates/:id` | Удалить шаблон |
| POST | `/api/guilds/:guildId/templates/:id/send` | Отправить по шаблону (body: `{ channelId }`) |
| GET | `/api/guilds/:guildId/logs` | Настройки логов: `{ joinLeave?, messages?, moderation?, channel?, banKick? }` (ID каналов или null) |
| PATCH | `/api/guilds/:guildId/logs` | Задать/сбросить канал: body `{ type, channelId }`, type — один из типов выше, channelId — строка или null |
| GET | `/api/guilds/:guildId/logs/events` | Лента событий: query `limit` (по умолчанию 50, макс. 100), `before` (UUID для пагинации). Ответ: `{ events: LogEvent[] }` |
| GET | `/api/guilds/:guildId/roles` | Список ролей сервера: `[{ id, name }]` (без @everyone и управляемых) |
| GET | `/api/guilds/:guildId/reaction-roles` | Список привязок: `{ bindings: [{ messageId, channelId?, roles: [{ emojiKey, roleId }] }] }` |
| POST | `/api/guilds/:guildId/reaction-roles` | Добавить привязку: body `{ channelId, messageId, emoji, roleId }` |
| POST | `/api/guilds/:guildId/reaction-roles/remove` | Удалить привязку: body `{ messageId, emojiKey }` |
| GET | `/api/server-templates` | Список шаблонов сервера для развёртывания: `[{ id, name, description, createdAt }]` |
| POST | `/api/guilds/:guildId/install-template` | Установить шаблон на сервер: body `{ templateId }`. Ответ 200: `{ ok: true }`. Ошибки: 400 (message), 401 |
