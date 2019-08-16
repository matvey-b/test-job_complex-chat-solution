import io from 'socket.io-client'

export const socket = io('http://localhost:8080')

export const makeRpcCall = (method, ...args) => {
    console.log(`makeRpcCall(${method}) with args: `, ...args)
    return new Promise(resolve => socket.emit(method, ...args, result => resolve(result))).then(res => {
        if (res.name === 'Error') {
            console.log(`rpcCall(${method}) returns error`, res)
        } else {
            console.log(`Success(${method}): `, res)
        }
        return res
    })
}
