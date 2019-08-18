import React from 'react'
import { observer } from 'mobx-react'
import capitalize from 'lodash.capitalize'

import { socket } from '../io'
import authStore from '../stores/auth'

export default observer(
    class ConnectionStatus extends React.Component {
        constructor(props) {
            super(props)
            this.state = { connected: false }
        }

        componentDidMount() {
            this.socket = socket
            this.socket.on('connect', () => {
                this.setState({ connected: true })
            })
            this.socket.on('disconnect', reason => {
                console.log(`socket was disconnected with reason: ${reason}`)
                this.setState({ connected: false })
            })
            this.socket.on('error', error => {
                console.log(`an error occurred on socket: `, error)
                this.setState({ connected: false })
            })
        }

        render() {
            const login = authStore.user && capitalize(authStore.user.login)
            return (
                <span>
                    {this.state.connected ? (
                        <>
                            <span style={{ color: 'green' }}>Connected</span>
                            {login && (
                                <>
                                    , and authenticated as <b>{login}</b>
                                </>
                            )}
                        </>
                    ) : (
                        <span style={{ color: 'red' }}>Disconnected</span>
                    )}
                </span>
            )
        }
    },
)
