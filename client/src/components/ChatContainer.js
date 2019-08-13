import React from 'react'
import users from '../stores/users'
import chatsStore from '../stores/chats'
import { observer } from 'mobx-react'
import { makeRpcCall, socket } from '../io'
import { Container, Row, Col, ListGroup } from 'react-bootstrap'
import ChatList from './ChatsList'
import MessagesList from './MessagesList'

export default observer(
    class ChatsContainer extends React.Component {
        constructor(props) {
            super(props)
            this.handleChatSelection = this.handleChatSelection.bind(this)
        }

        async handleChatSelection(e) {
            const chatId = e.currentTarget.value
            await Promise.all([chatsStore.subscribeToChat(chatId), chatsStore.loadMessages({ filter: { chatId } })])
        }
        async componentDidMount() {
            await chatsStore.loadChats()
        }
        render() {
            return (
                <Container>
                    <Row>
                        <Col md={2}>
                            <ChatList items={chatsStore.chats} onClickHandler={this.handleChatSelection} />
                        </Col>
                        <Col>
                            <MessagesList items={chatsStore.currentChatMessages} />
                        </Col>
                        <Col md={2}>
                            <ListGroup>
                                <ListGroup.Item>No style</ListGroup.Item>
                                <ListGroup.Item variant="primary">Primary</ListGroup.Item>
                                <ListGroup.Item variant="secondary">Secondary</ListGroup.Item>
                                <ListGroup.Item variant="success">Success</ListGroup.Item>
                                <ListGroup.Item variant="danger">Danger</ListGroup.Item>
                                <ListGroup.Item variant="warning">Warning</ListGroup.Item>
                                <ListGroup.Item variant="info">Info</ListGroup.Item>
                                <ListGroup.Item variant="light">Light</ListGroup.Item>
                                <ListGroup.Item variant="dark">Dark</ListGroup.Item>
                            </ListGroup>
                        </Col>
                    </Row>
                </Container>
            )
        }
    },
)
