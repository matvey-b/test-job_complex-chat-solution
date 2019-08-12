import './App.css'
import React from 'react'
import Container from 'react-bootstrap/Container'
import ConnectionStatus from './components/ConnectionStatus'
import AuthModal from './components/AuthModal'
import ChatsContainer from './components/ChatContainer'
import authStore from './stores/auth'
import { observer } from 'mobx-react'

export default observer(function App() {
    console.log('auth ' + authStore.isAuthenticated, 'reconnected ' + authStore.isReconnected)
    return (
        <>
            <AuthModal />
            <Container style={{ paddingTop: '20px' }}>
                <h2 align="center">Chat application</h2>
                <p align="right">
                    <ConnectionStatus />
                </p>
            </Container>
            {(authStore.isAuthenticated || authStore.isReconnected) && <ChatsContainer />}
        </>
    )
})
