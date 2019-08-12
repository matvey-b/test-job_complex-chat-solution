import React from 'react'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Alert from 'react-bootstrap/Alert'
import { observer } from 'mobx-react'
import authStore from '../stores/auth'
/* 
fixme:
Нужно реализовать перевыпуск токена. Бекенд уже готов к этому.
Тут получается нужно слушать событие "TokenMustBeUpdated" и соответственно делать "rpcReissueToken". Таким образом получится авторизоваться на "вечно".
*/

class AuthModal extends React.Component {
    constructor(props) {
        super(props)
        this.loginRef = React.createRef()
        this.passwordRef = React.createRef()
    }

    async handleRegistration(event) {
        // fixme: добавить обработку плохого ввода
        if (this.isValid()) {
            await authStore.signUp({
                login: this.loginRef.current.value,
                password: this.passwordRef.current.value,
            })
        }
    }

    async handleLogin(event) {
        // fixme: добавить обработку плохого ввода
        if (this.isValid()) {
            await authStore.signIn({
                login: this.loginRef.current.value,
                password: this.passwordRef.current.value,
            })
        }
    }

    isValid() {
        return this.loginRef.current.value && this.passwordRef.current.value
    }

    render() {
        return (
            <Modal
                size="lg"
                aria-labelledby="contained-modal-title-vcenter"
                centered
                show={!authStore.isRestoringSession && !(authStore.isAuthenticated || authStore.isReconnected)}
            >
                <Modal.Body>
                    <h4 align="center">Please enter login and password:</h4>
                    <Form>
                        <Form.Group controlId="formGroupLogin">
                            <Form.Control
                                type="text"
                                placeholder="Enter login name"
                                defaultValue="matvey.b"
                                ref={this.loginRef}
                                required
                            />
                        </Form.Group>
                        <Form.Group controlId="formGroupPassword">
                            <Form.Control
                                type="password"
                                placeholder="Password"
                                defaultValue="123321"
                                ref={this.passwordRef}
                                required
                            />
                        </Form.Group>
                        <Row>
                            <Col>
                                <Button
                                    block
                                    size="sm"
                                    onClick={this.handleRegistration.bind(this)}
                                    disabled={authStore.isLoading}
                                >
                                    Register
                                </Button>
                            </Col>
                            <Col>
                                <Button
                                    block
                                    size="sm"
                                    onClick={this.handleLogin.bind(this)}
                                    disabled={authStore.isLoading}
                                >
                                    Login
                                </Button>
                            </Col>
                        </Row>
                        <br />
                        {authStore.error ? (
                            <Alert variant="danger" dismissible onClose={() => (authStore.error = null)}>
                                <Alert.Heading>An error occurred!</Alert.Heading>
                                <p>{authStore.error.message}</p>
                                <hr />
                                <p>{authStore.error.code}</p>
                            </Alert>
                        ) : (
                            ''
                        )}
                        {authStore.isAuthenticated ? (
                            <Alert variant="success">You are successfully authorized!</Alert>
                        ) : (
                            ''
                        )}
                    </Form>
                </Modal.Body>
            </Modal>
        )
    }
}

export default observer(AuthModal)
