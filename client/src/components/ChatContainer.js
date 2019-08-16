import React from 'react'
import chatsStore from '../stores/chats'
import { observer } from 'mobx-react'
import { Container, Row, Col } from 'react-bootstrap'
import ChatList from './ChatsList'
import MessagesList from './MessagesList'
import ChatUsersList from './ChatUsersList'

export default observer(
    class ChatsContainer extends React.Component {
        constructor(props) {
            super(props)
            this.handleChatSelection = this.handleChatSelection.bind(this)
        }

        async handleChatSelection(e) {
            const chatId = e.currentTarget.value
            // note: нужно последовательно выполнить след действия (это не совсем разумно, но я так косячно сделал фронтенд, что других вариантов нет)
            // доигрался с mobx-ом =)
            await chatsStore.subscribeToChat(chatId)
            await chatsStore.loadOnlineUsers(chatId)
            await chatsStore.loadMessages({ filter: { chatId } })
        }
        async componentDidMount() {
            await chatsStore.loadChats()
            if (chatsStore.currentChatId) {
                await chatsStore.subscribeToChat(chatsStore.currentChatId)
                await chatsStore.loadOnlineUsers(chatsStore.currentChatId)
                await chatsStore.loadMessages({ filter: { chatId: chatsStore.currentChatId } })
            }
        }
        render() {
            return (
                <Container>
                    <Row style={{ height: '500px' }}>
                        <Col md={2}>
                            <ChatList
                                items={chatsStore.chats}
                                onClickHandler={this.handleChatSelection}
                                currentChatId={chatsStore.currentChatId}
                            />
                        </Col>
                        <Col>
                            <MessagesList
                                items={chatsStore.currentChatMessages}
                                sendMessageHandler={chatsStore.sendMessage.bind(chatsStore)}
                                currentChatId={chatsStore.currentChatId}
                            />
                        </Col>
                        <Col md={2}>
                            <ChatUsersList items={chatsStore.onlineUsers} />
                        </Col>
                    </Row>
                </Container>
            )
        }
    },
)
