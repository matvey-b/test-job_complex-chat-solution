## Инструкции по развертке:

### Простой способ развертки DEV окружения через docker-compose

1. Поставить себе `docker` и `docker-compose`
2. Скопировать конфиг бекенда `mv server/example.env server/.env`
3. Сделать `docker-compose up -d --scale api=2`. Параметр `--scale` позволяет задать кол-во запускаемых контейнеров, в данном случае мы хотим поднять 2 ноды для тестирования api в кластерном режиме.
4. После первого запуска сделать `docker-compose exec api_1 knex migrate:latest` чтобы накатить миграции БД
5. После этого можно подключаться к `localhost:3000` и заходить под админом `{login: 'admin', password: '123321'}`

#### ЗАМЕЧАНИЯ

1. Mysql база также проксируется на порт 33066, поэтому можно подключиться к ней с юзером паролем chat chat. Данные mysql сохраняются в `/.db`
2. Redis доступен с локалхоста через порт 63799, можно при желании в него тоже посмотреть. Данные redis контейнера сохраняются в `/.db-redis`

### Своими руками

#### Бекенд (node v12.4)

1. `cd ./server`
2. Подготовить базу mysql(v5.7) которую не жалко. Подготовить базу redis(v3.0.6).
3. Сделать `mv example.env .env`, заполнить `.env`
4. `npm i`
5. `npm knex migrate:latest` - чтобы подготовить структуру базы и наполнить её тестовыми данными.
6. `npm start`

#### Фронтенд (тоже собирался на node v12.4)

1. `cd ./client`
2. `npm i`
3. `npm start` - должен сбилдится dev бандл и начать раздаваться на `http://localhost:3000/`. Автоматом должна открыться вкладка в браузере.
4. Только пользователь с правами админа может менять права других пользователей чата. Чтобы зайти под ним, нужно ввести `{login: 'admin', password: '123321'}`

## Вещи которые нужно сделать:

1. Переделать схему rpc запросов. Не нравится мне, что тут ответ может быть одновременно и ошибкой, и верным объектом или примитивом любого типа. Лучше будет если схема будет, например такой:

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

2. Еще нужно ORM сюда затащить желательно. Я люблю objection.js.
3. Добавить возможность настраивать фронтенд через env
4. Добавить возможность настраивать nginx через env
5. Добавить возможность деплоить прод версию фронтенда и раздавать её через nginx
