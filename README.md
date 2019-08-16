## Инструкции по развертке простые:

### Бекенд (node v12.4)

1. `cd ./server`
2. Подготовить базу mysql(v5.7) которую не жалко. Подготовить базу redis(v3.0.6).
3. Сделать `mv config.example.js config.js`, заполнить `config.js`
4. `npm i`
5. `npm knex migrate:latest` - чтобы подготовить структуру базы и наполнить её тестовыми данными.
6. `npm start`

### Фронтенд (тоже собирался на node v12.4)

1. `cd ./client`
2. `npm i`
3. `npm start` - должен сбилдится dev бандл и начать раздаваться на `http://localhost:3000/`. Автоматом должна открыться вкладка в браузере.
4. Только пользователь с правами админа может менять права других пользователей чата. Чтобы зайти под ним, нужно ввести `{login: 'admin', password: '123321'}`

## Вещи которые нужно сделать:

1. Завернуть все это в docker-compose. Так, чтобы dev окружение запускалось через одну команду и не портило окружение локалхоста. А также это поможет поднять многонодовое окружение + как было сказано в задании, завернуть весь трафик через `nginx`.
2. Чистка чистка чатов от потерянных сессий(когда бекенд не хорошо отрубается, они начинают появляться, например). Из-за этого, в чатах отображаются юзеры, которые не онлайн.
3. Логаут. Из-за того, что щас его нет, разлогиниться можно только через сброс кеша браузера.
4. На бекенде полный ковардак в архитектуре. Нужно вынести в отдельный класс\модуль управление сессиями. Нужно сделать авто враппинг сокетов в хэндлеры.
5. Переделать схему rpc запросов. Не нравится мне, что тут ответ может быть одновременно и ошибкой, и верным объектом или примитивом любого типа. Лучше будет если схема будет, например такой:

```js
const successfulRes = {
    success: true,
    value: 'Any',
}
const rejectedRes = {
    success: false,
    value: `Any representation of error`,
}
```

6. Сделать чтобы работало в режиме кластера с больше чем одной нодой в параллели.
