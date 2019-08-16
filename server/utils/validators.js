const Joi = require('joi')

const MAX_CHAT_MESSAGES_QUERY_LIMIT = 50
const DEFAULT_CHAT_MESSAGES_QUERY_LIMIT = 20
const MAX_USERS_QUERY_LIMIT = 50
const DEFAULT_USERS_QUERY_LIMIT = 20

const chatIdSchema = Joi.string().uuid()
const userIdSchema = Joi.string().uuid()
const userLoginSchema = Joi.string()
    .min(5)
    .max(20)
const userPasswordSchema = Joi.string()
    .min(5)
    .max(20)
const jwtSchema = Joi.string().min(30)

/**
 * Все перечисленные ниже валидаторы, должны соответствовать шаблону именования `${rpcMethodName}InputSchema` т.к. они вызываются автоматически если определены для метода.
 * Именно поэтому я пишу схему для каждого запроса, даже если схемы полностью совпадают.
 */
module.exports = {
    rpcGetChatMessagesInputSchema: Joi.object().keys({
        limit: Joi.number()
            .positive()
            .integer()
            .max(MAX_CHAT_MESSAGES_QUERY_LIMIT)
            .default(DEFAULT_CHAT_MESSAGES_QUERY_LIMIT),
        filter: Joi.object().keys({
            chatId: chatIdSchema.required(),
        }),
    }),

    rpcGetUsersInputSchema: Joi.object().keys({
        limit: Joi.number()
            .positive()
            .integer()
            .max(MAX_USERS_QUERY_LIMIT)
            .default(DEFAULT_USERS_QUERY_LIMIT),
        filter: Joi.object().keys({
            ids: Joi.array()
                .items(userIdSchema)
                .min(1),
        }),
    }),

    rpcSignUpInputSchema: Joi.object().keys({
        login: userLoginSchema.required(),
        password: userPasswordSchema.required(),
    }),

    rpcSignInInputSchema: Joi.object().keys({
        login: userLoginSchema.required(),
        password: userPasswordSchema.required(),
    }),

    rpcReissueTokenInputSchema: jwtSchema.required(),
    rpcAssignSessionInputSchema: jwtSchema.required(),
    rpcSubscribeToChatInputSchema: chatIdSchema.required(),
    rpcSendChatMessage: Joi.object().keys({
        text: Joi.string()
            .min(1)
            .required(),
        chatId: chatIdSchema.required(),
    }),
}
