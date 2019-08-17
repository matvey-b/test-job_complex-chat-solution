import React from 'react'
import capitalize from 'lodash.capitalize'
import { Row, Col, Spinner, Modal, Container, Form, Button, Alert } from 'react-bootstrap'

export default class MessagesList extends React.Component {
    constructor(props) {
        super(props)
        this.messageText = React.createRef()
        this.sendMessage = this.sendMessage.bind(this)
        this.lastMessageRef = React.createRef()
        this.inputMsgRef = React.createRef()
    }

    componentDidMount() {
        this.focusOnLastMessage()
    }

    componentDidUpdate() {
        this.focusOnLastMessage()
    }

    focusOnLastMessage() {
        if (this.lastMessageRef.current) {
            this.lastMessageRef.current.scrollIntoView(false)
        }
        // не смог добиться, того чтобы кнопка "Отправить" всегда была на виду, только таким способом
        this.inputMsgRef.current.scrollIntoView(false)
    }

    async sendMessage(e) {
        e.preventDefault()
        if (this.messageText.current.value) {
            await this.props.sendMessageHandler(this.messageText.current.value)
            this.messageText.current.value = ''
        }
    }
    render() {
        const makeListItems = () => {
            const emptyList = (
                <Row>
                    <Alert variant="light">
                        {this.props.currentChat ? 'Empty messages list' : 'Select chat for messaging'}
                    </Alert>
                </Row>
            )

            const items = this.props.items.map(item => (
                <Row
                    {...(item.isLast ? { ref: this.lastMessageRef } : {})}
                    key={item.id}
                    style={{ paddingBottom: '1em' }}
                >
                    <Alert variant={item.isMy ? 'info' : 'success'}>
                        {item.author.isLoading ? (
                            <Spinner animation="border" variant="success" role="status" />
                        ) : (
                            <>
                                <b>{item.isMy ? 'You' : capitalize(item.author.login)} </b>
                                {new Date(item.createdAt).toLocaleString()}
                            </>
                        )}
                        <hr />
                        <p>{item.text}</p>
                    </Alert>
                </Row>
            ))
            return (items.length && items) || emptyList
        }
        return (
            <div>
                <h5 align="center">Messages:</h5>
                <hr />
                <Modal.Dialog scrollable size="xl">
                    <Modal.Body>
                        <Container>{makeListItems()}</Container>
                    </Modal.Body>
                    <Modal.Footer size="lg" ref={this.inputMsgRef}>
                        <Form style={{ width: '100%' }} onSubmit={this.sendMessage}>
                            <Row>
                                <Col>
                                    <Form.Control
                                        type="text"
                                        placeholder="Enter message..."
                                        ref={this.messageText}
                                        disabled={!this.props.currentChat || !this.props.haveWritePerms}
                                    />
                                </Col>
                                <Col md={2}>
                                    <Button
                                        type="submit"
                                        disabled={!this.props.currentChat || !this.props.haveWritePerms}
                                    >
                                        Send
                                    </Button>
                                </Col>
                            </Row>
                        </Form>
                    </Modal.Footer>
                </Modal.Dialog>
            </div>
        )
    }
}
