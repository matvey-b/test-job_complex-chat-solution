import io from 'socket.io-client'

export const socket = io('http://localhost:8080')

export const makeRpcCall = (method, ...args) =>
    new Promise(resolve => socket.emit(method, ...args, result => resolve(result))).then(res => {
        if (res.name === 'Error') {
            console.log('rpcCall returns error', res)
        }
        return res
    })
