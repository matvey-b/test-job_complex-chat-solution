import './App.css'
import React from 'react'
import { Container, Button } from 'react-bootstrap'
import ConnectionStatus from './components/ConnectionStatus'
import AuthModal from './components/AuthModal'
import ChatsContainer from './components/ChatContainer'
import authStore from './stores/auth'
import { observer } from 'mobx-react'

const LogoutButton = () => {
    if (authStore.isAuthenticated) {
        return (
            <Button variant="outline-success" onClick={() => authStore.logout()}>
                Logout
            </Button>
        )
    }
    return null
}

export default observer(function App() {
    return (
        <>
            <AuthModal />
            <Container style={{ paddingTop: '20px' }}>
                <h2 align="center">Chat application</h2>
                <p align="right">
                    <ConnectionStatus /> <LogoutButton />
                </p>
            </Container>
            {(authStore.isAuthenticated || authStore.isReconnected) && <ChatsContainer />}
        </>
    )
})
