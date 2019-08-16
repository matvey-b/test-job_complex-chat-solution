const _ = require('lodash')
const chalk = require('chalk')
const uuid = require('uuid/v4')
const Redlock = require('redlock')
const auth = require('../utils/auth')
const knex = require('../utils/knex')
const BaseHandler = require('./base')
const redis = require('../utils/redis')
const dateTime = require('../utils/date-time')

const TIME_FOR_AUTH = 60 * 1000 * 5 // 5 min на вызовы signUp или signIn
const TIME_TO_REFRESH_TOKEN = 60 * 1000 // 60 сек

const REDIS_SESSIONS_ACTIVITY_SET = 'sessions:last-activity'
const REDIS_FORGOTTEN_SESSIONS_SET = 'sessions:forgotten'
const REDIS_FORGOTTEN_SESSIONS_CLEANUP_LOCK = `lock:forgotten-sessions-cleanup`

const SESSION_ACTIVITY_UPDATE_INTERVAL = 60 * 2 * 1000
const CLEANUP_FORGOTTEN_SESSIONS_INTERVAL = 5 * 60 * 1000

const attach = socket => {
    socket.authHandlers = new AuthHandlers(socket)
}
/* 
РАЗМЫШЛЕНИЯ О ПРОБЛЕМАХ РАСПРЕДЕЛЕННОЙ СИСТЕМЫ И ПОТЕРЯННЫХ СЕССИЯХ
Фичи которые реализует сервис, требуют знания о всех активных в текущий момент сессиях для каждого из пользователей. При этом пользователь,
может порождать больше одной сессии.
Инфа о созданных сессиях естественно должна храниться в доступном для всех нод хранилище. Очевидно это должен быть reids, т.к. сессии это горячие данные, которые
лучше хранить в быстрой памяти.
В нормальных условиях сессии создает и удаляет нода которая их обслуживает.
Но бывают сценарии когда ноды могут быть по беспределу =) отрублены, например через SIGKILL.
В таких случаях в системе начинают появляться "пропащие" сессии, за которые никто не отвечает. Т.е. например, могут появляться юзеры, которые находятся в
"вечном" онлайне.
По моему мнению, на такие случаи, в любой распределенной системе обязательно должны быть fallback механизмы, которые подчищали бы систему от заблудших душ(сессий) =)
Далее я пытаюсь придумать оптимальный подход к решению этой проблемы.
Для меня задачка оказалась не тривиальной...

Распределенная чистка "потерянных" сессий:
1. Одна из нод делает глобальный лок на эту операцию(чтобы другие ноды не занимались тем же самым одновременно с этой).
2. Нода смотрит на время последней чистки, если это было достаточно давно, то ок, идет далее, иначе бросает эту операцию,
делает поправку на следующий запуск чистки с учетом времени последней(для того, чтобы более или менее совпадал интервал чистки с заданным параметром
на уровне всей системы, например раз в 5 мин) и освобождает лок.
3. Далее она берет все сессии которые не отчитывались о своем присутствии слишком долго и перекладывает их в множество "потерянных" сессий,
сохраняя при этом timestamp-ы их последних откликов. Это будет полезной инфой для других воркеров убирающихся в других участках системы.
4. Далее она вычищает множество потерянных сессий от "давно давно" забытых сессий, т.к. другие воркеры уже скорее всего воспользовались этой инфой.
Для того, чтобы гарантировать, что другие воркеры воспользовались данной инфой и она больше не нужна, после любых полных остановок системы,
мы обязаны в первую очередь дать поработать другим воркерам зависим от этих данных и только потом запускать этот.
5. Далее пишет время последней такой же чистки(чтобы другие ноды лишний раз не чистили и не тратили ресурсы попусту) в reids и разблокирует лок на эту операцию.
Таким образом у нас получается система в которой одновременно все ноды страхуют друг друга и в случае вылета одной, другая сделает чистку за первую.
А также система, в которой любая нода с достаточно высокой точностью и простотой может выяснить инфу о реальном присутствии сессий в системе.

Распределенная чистка комнат от потерянных сессий:
1. Одна из нод делает лок на эту операцию
2. Нода берет список комнат в которых есть хоть одна сессия.
3. Далее для каждой из комнат:
    3.1 нода берет пересечение от сессий комнаты и списка пропавших сессий.
    3.2 если пересечение не пустое, то далее
    3.3 нода удаляет из комнаты сессии, полученные выше
    3.4 нода вызывает процессы связанные с удалением указанных сессий из комнат (процессы могут быть самыми разными, это выходит за рамки ответственности чистильщика)
4. Далее нода пишет в reids последнее время этой чистки и освобождает лок.
Процедура на больших множествах данных выглядит достаточно тяжелой. Однако если бекенды ну будут часто не gracefully отрубаться, то тут никогда не должно становиться много "потерянных" сессий.
Плюс работа с сортированными множествами в основном соответствует алгоритмической сложности O(log) и O(1), т.е. достаточно эффективна, даже на больших данных.
Где-то читал, что полный перебор множества из 1 * 10^6 элементов, на средненьком ноуте занимает 40мс. Так что, кол-во одновременных сессий, должно исчисляться сотнями тысяч, чтобы это стало узким местом.


room:1:users = [user1:socket1 = timestamp, user1:socket2 = timestamp, user2:socket1 = timestamp, ...]
rooms = [room1 = usersCount, room2 = usersCount, ...]
sessions = [user1:socket1 = timestamp, ...]

getRooms = () => rooms
getActiveRooms = () => rooms.filter(usersCount => usersCount >= 1)
getUsers = (roomName) => room:1
cleanUpInRooms => () => {
    activeRooms = getActiveRooms()
    forgottenConnections = getForgottenConnections()
    for (room of activeRooms) {
        deletedConnections = intersect(room, forgottenConnections)
        
    }
}
*/
/* 
Клиент может подключиться к бекенду без аутентификации. Но если он не сделает assignSession в течение TIME_FOR_AUTH, то сокет будет принудительно отключен.
Аутентификация клиента основана на JWT. Для того, чтобы получить токен, нужно сделать вызовы signUp(регистрация) или signIn(аутентификация).
Далее клиент получает токен, который действителен в течение jwt.TOKEN_LIFE_TIME.
Теперь клиент аутентифицирован, а также в следующий раз клиент может использовать токен для создания сессии, для этого он должен сделать запрос assignSession со своим токеном.
При всех следующих подключениях он сразу может делать assignSession, чтобы восстановить аутентификацию на бекенде.

Токен имеет время жизни, поэтому его необходимо перевыпускать. Если клиент подключен к бекенду, то бекенд направляет ему нотификацию TokenMustBeUpdated,
в результате которой клиент должен сделать запрос refreshToken(refreshToken) и получить новый токен. Если просроченный токен отправлен в запросы refreshToken или assignSession,
то клиент получает ответ `JWT_EXPIRED`. Если клиент не переиздает токен, то он будет отключен по истечении срока действия текущего токена.

Обычно в системах определают два токена refreshToken и activeToken.
Первый из них обычно используется только для перевыпуска active токена. Но тут я решил не тратить на это время и сделал так, что activeToken позволяет перевыпустить себя. 
*/

class AuthHandlers extends BaseHandler {
    constructor(socket) {
        super(socket)
        if (!this.socket.ctx) {
            this.socket.ctx = new SocketContext(socket)
        }
        this.setDestroyNotAuthorizedSocketTimeout(TIME_FOR_AUTH)

        this.socket.use((packet, next) => {
            if (!socket.eventNames().includes(_.head(packet))) {
                console.log(chalk.red(`Gotten unknown message on socket: `), packet)
                if (_.isFunction(_.last(packet))) {
                    return _.last(packet)({
                        name: 'Error',
                        code: 'UNSUPPORTED_RPC_METHOD',
                        message: `Server not supports '${_.head(packet)}' rpc method`,
                    })
                }
                return next(new Error(`Message '${_.head(packet)} is not supported by server`))
            }
            next()
        })
    }

    /**
     * Установить таймер на закрытие неавторизованного сокета
     */
    setDestroyNotAuthorizedSocketTimeout(time) {
        if (this.destroyNotAuthorizedSocketTimer) {
            clearTimeout(this.destroyNotAuthorizedSocketTimer)
        }
        this.destroyNotAuthorizedSocketTimer = setTimeout(() => this.socket.disconnect(), time)
    }

    // fixme: за это должен отвечать SessionManager
    async deleteSessionActivityEntity() {
        if (this.socket.ctx.user) {
            await redis.zrem(REDIS_SESSIONS_ACTIVITY_SET, this.socket.ctx.sessionId)
        }
    }

    // fixme: за это должен отвечать SessionManager
    async upsertSessionActivityEntity() {
        await redis.zadd(REDIS_SESSIONS_ACTIVITY_SET, dateTime.asUnixTime(), this.socket.ctx.sessionId)
    }

    clearTimers() {
        clearTimeout(this.destroyNotAuthorizedSocketTimer)
        clearTimeout(this.tokenTimeoutTimer)
        clearInterval(this.updateSessionActivityTimer)
    }

    assignEventListeners() {
        // note: после удаления сокета, таймеры остаются жить, поэтому нужно их принудительно отключать
        this.socket.on('disconnect', async () => {
            this.clearTimers()
            // fixme: этим тоже должен заниматься SessionManager, т.к. слишком много обязанностей возложено на AuthHandler
            if (this.socket.ctx.user) {
                await this.deleteSessionActivityEntity()
            }
            if (this.connectedRooms && this.connectedRooms.size) {
                await Promise.all([...this.connectedRooms].map(this.leaveRoom.bind(this)))
            }
        })
    }

    async assignUserToSocket({ user, jwt }) {
        if (_.get(this.socket.ctx, 'user.id') !== (user.id || user)) {
            if (_.isObject(user)) {
                this.socket.ctx.setSession({ user, jwt })
            } else {
                const res = await knex('users')
                    .first('*')
                    .where({ id: user })
                this.socket.ctx.setSession({ user: res, jwt })
            }
            await this.upsertSessionActivityEntity()
            this.updateSessionActivityTimer = setInterval(
                () => this.upsertSessionActivityEntity(),
                SESSION_ACTIVITY_UPDATE_INTERVAL,
            )
            console.log(`${this.socket.ctx.user.login} was authenticated`)
        }
        return this.socket.ctx.user
    }

    // попросить клиента, чтобы он обновил просроченный токен
    sendTokenMustBeUpdated() {
        this.socket.emit('TokenMustBeUpdated')
    }

    /**
     * Оповещает клиента о том, что нужно перевыпустить токен. Ставит таймер на отключение клиента, если он не перевыпустит токен.
     */
    scheduleNotificationAboutTokenExpiration(token) {
        if (_.isString(token)) {
            token = auth.decode(token)
        }
        if (this.tokenTimeoutTimer) {
            clearTimeout(this.tokenTimeoutTimer)
        }
        if (this.destroyNotAuthorizedSocketTimer) {
            clearTimeout(this.destroyNotAuthorizedSocketTimer)
        }
        this.tokenTimeoutTimer = setTimeout(() => {
            this.sendTokenMustBeUpdated()
            this.setDestroyNotAuthorizedSocketTimeout(TIME_TO_REFRESH_TOKEN)
        }, token.timeToExpiration - TIME_TO_REFRESH_TOKEN)
    }

    /**
     * Пишит нового пользователя в базу и привязывает его к сокету.
     * Если вызвать будучи залогининым под другим пользователем, то аутентификация первого заменяется на новую.
     */
    async rpcSignUp({ login, password }) {
        const existedUser = await knex('users')
            .first('id')
            .where({ login })
        if (existedUser) {
            throw this.makeRpcError({
                code: 'LOGIN_ALREADY_REGISTERED',
                message: 'Provided login name already registered. Please choose another login.',
            })
        }
        const user = { id: uuid(), login }
        await knex('users').insert({ ...user, password: auth.hashPassword(password), createdAt: new Date() })
        const token = await auth.sign(user)
        await this.assignUserToSocket({ user, jwt: token })
        this.scheduleNotificationAboutTokenExpiration(token)
        return { user: this.socket.ctx.user, token }
    }

    async rpcSignIn({ login, password }) {
        const user = await knex('users')
            .first('*')
            .where({ login })
        if (!user) {
            throw this.makeRpcError({
                code: 'USER_NOT_FOUND',
                message: 'User with provided login not registered.',
            })
        }
        if (auth.hashPassword(password) !== user.password) {
            throw this.makeRpcError({ code: 'INVALID_PASSWORD', message: 'Entered incorrect password or login' })
        }
        const token = await auth.sign(user)
        await this.assignUserToSocket({ user, jwt: token })
        this.scheduleNotificationAboutTokenExpiration(token)
        return { user: this.socket.ctx.user, token }
    }

    async rpcReissueToken(token) {
        this.validateAuthorization()

        // fixme: нужно разделить ошибки JWT_EXPIRED и INVALID_TOKEN_SIGN чтобы клиент мог при желании это как-то более тонко обработать
        if (!(await auth.verify(token).catch(() => null))) {
            throw this.makeRpcError({ code: 'JWT_EXPIRED', message: 'Invalid token provided' })
        }

        const newToken = await auth.sign(this.socket.ctx.user)
        this.scheduleNotificationAboutTokenExpiration(newToken)

        return newToken
    }

    async rpcAssignSession(token) {
        if (!this.socket.ctx.user) {
            const decodedToken = await auth.verify(token).catch(() => null)
            // fixme: нужно разделить ошибки JWT_EXPIRED и INVALID_TOKEN_SIGN
            if (!decodedToken) {
                throw this.makeRpcError({ code: 'JWT_EXPIRED', message: 'Invalid token provided' })
            }

            await this.assignUserToSocket({ user: decodedToken.userId, jwt: token })
            this.scheduleNotificationAboutTokenExpiration(decodedToken)
        }

        return this.socket.ctx.user
    }
}

class SocketContext {
    constructor(socket) {
        this.user = null
        this.jwt = null
    }

    setSession({ user, jwt }) {
        this.user = user
        this.jwt = jwt
    }

    get sessionId() {
        if (!this.user) {
            throw new Error(`Cannot create sessionId for not authenticated user`)
        }
        return `${this.user.id}:${this.jwt.split('.')[2]}`
    }

    get isAdmin() {
        return this.user.isAdmin
    }

    get isAuthenticated() {
        return Boolean(this.user)
    }

    get publicUserData() {
        return _.pick(this.user, 'id', 'login', 'isAdmin')
    }
}

// fixme: Вот это все нужно вынести из этого модуля, не место тут ему. Нужно по идее создать класс SessionsManager, который бы отвечал за работу именно с сессиями.
// И тут в auth уже юзать его по необходимости. Это на будущее заметка.
const cleanupForgottenSessions = async () => {
    try {
        const redlock = new Redlock([redis], { retryCount: 0 })
        await redlock.lock(REDIS_FORGOTTEN_SESSIONS_CLEANUP_LOCK, 2000).then(async lock => {
            // точка во времени, до которой сессии считаются устаревшими
            const edgeOfActivityTimestamp =
                dateTime.asUnixTime() - dateTime.asUnixTime(SESSION_ACTIVITY_UPDATE_INTERVAL)
            const forgottenSessions = await redis.zrangebyscore(
                REDIS_SESSIONS_ACTIVITY_SET,
                '-inf',
                edgeOfActivityTimestamp,
                'WITHSCORES',
            )
            if (forgottenSessions.length) {
                // note: добавляем забытые сессии в список забытых, чтобы потом можно было использовать их по назначению
                await redis.zadd(REDIS_FORGOTTEN_SESSIONS_SET, forgottenSessions.slice().reverse())
                const deletedCount = await redis.zremrangebyscore(
                    REDIS_SESSIONS_ACTIVITY_SET,
                    '-inf',
                    edgeOfActivityTimestamp,
                )
                console.log(
                    chalk.green.bold(
                        `FORGOTTEN SESSIONS SET WAS SUCCESSFULLY CLEANED. DELETED ${deletedCount} ENTITIES:`,
                    ),
                    '\n',
                    _(forgottenSessions)
                        .chunk(2)
                        .map(pair => {
                            pair[1] = new Date(pair[1] * 1000)
                            return pair
                        })
                        .fromPairs()
                        .value(),
                )
            }
            await redis.zremrangebyscore(REDIS_FORGOTTEN_SESSIONS_SET, '-inf', dateTime.asUnixTime() - 3600) // note: все забытые сессии которым уже исполнилось больше чата, удаляем

            return lock.unlock()
        })
    } catch (error) {
        if (error.name === 'LockError') {
            if (error.attempts) {
                // лок занят
                // fixme: Тут нужно перепланировать вызов чистки с учетом того, когда она была сделана в последний раз.
                // смысл в том, что нужно добиться того, чтобы только одна из нод раз в указанный промежуток времени делала эту чистку
                // т.к. нефиг нагружать систему лишним процессингом =)
                // нет времени делать это сейчас, оставлю на "потом"
                return
            } else {
                // не успел сделать операцию до конца таймаута лока или что-то другое
            }
        }
        console.log(`An error occured while cleaning up forgotten sessions:`, error)
    }
}

setInterval(cleanupForgottenSessions, CLEANUP_FORGOTTEN_SESSIONS_INTERVAL)

module.exports = { attach, REDIS_FORGOTTEN_SESSIONS_SET_KEY: REDIS_FORGOTTEN_SESSIONS_SET }
