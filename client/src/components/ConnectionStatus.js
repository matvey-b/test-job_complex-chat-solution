import React from 'react'
import { observer } from 'mobx-react'

import { socket } from '../io'
import users from '../stores/users'

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
            const login = users.me && users.me.login
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
