import React from 'react'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Alert from 'react-bootstrap/Alert'
import { makeRpcCall } from '../io'
import users from '../stores/users'
/* 
fixme:
Нужно реализовать перевыпуск токена. Бекенд уже готов к этому.
Тут получается нужно слушать событие "TokenMustBeUpdated" и соответственно делать "rpcReissueToken". Таким образом получится авторизоваться на "вечно".
*/

class AuthModal extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            show: false,
            isLoading: false,
            authorized: false,
        }
        this.loginRef = React.createRef()
        this.passwordRef = React.createRef()
    }

    async componentDidMount() {
        this.loadAuth()
        await this.rpcAssignSession()
    }

    async makeRpcCall(method, ...args) {
        this.hideError()
        this.setState({ isLoading: true })
        const res = await makeRpcCall(method, ...args)
        this.setState({ isLoading: false })
        if (res.name === 'Error') {
            // fixme: вот это костыль. Для некоторых методов не нужно показывать алерт ошибки. Видимо всетаки не стоит централизованно выставлять ошибку.
            if (method !== 'rpcAssignSession') {
                this.setState({ error: { code: res.code, message: res.message } })
            }
            return null
        }
        return res
    }

    hideError() {
        this.setState({ error: null })
    }

    async handleRegistration(event) {
        // fixme: добавить обработку плохого ввода
        if (this.isValid()) {
            const auth = await this.makeRpcCall('rpcSignUp', {
                login: this.loginRef.current.value,
                password: this.passwordRef.current.value,
            })
            if (auth) {
                this.saveAuth(auth)
                this.hideModal()
            }
        }
    }

    hideModal() {
        this.setState({ show: false, authorized: true })
    }

    async handleLogin(event) {
        // fixme: добавить обработку плохого ввода
        if (this.isValid()) {
            const auth = await this.makeRpcCall('rpcSignIn', {
                login: this.loginRef.current.value,
                password: this.passwordRef.current.value,
            })
            if (auth) {
                this.saveAuth(auth)
                this.hideModal()
            }
        }
    }

    /**
     * Попытаться восстановить сессию из токена, который хранится в локал сторе.
     * Если ок, то не показывать модалку авторизации
     */
    async rpcAssignSession() {
        if (this.jwt) {
            const res = await this.makeRpcCall('rpcAssignSession', this.jwt)
            if (!res) {
                this.setState({ show: true })
            }
            this.setState({ authorized: true })
        } else {
            this.setState({ show: true })
        }
    }

    isValid() {
        return this.loginRef.current.value && this.passwordRef.current.value
    }

    saveAuth(auth) {
        if (auth) {
            users.saveSession(auth)
            this.jwt = users.myJwt
            this.user = users.me
        }
    }

    loadAuth() {
        this.jwt = users.myJwt
        this.user = users.me
    }

    render() {
        return (
            <Modal size="lg" aria-labelledby="contained-modal-title-vcenter" centered show={this.state.show}>
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
                                    disabled={this.state.isLoading}
                                >
                                    Register
                                </Button>
                            </Col>
                            <Col>
                                <Button
                                    block
                                    size="sm"
                                    onClick={this.handleLogin.bind(this)}
                                    disabled={this.state.isLoading}
                                >
                                    Login
                                </Button>
                            </Col>
                        </Row>
                        <br />
                        {this.state.error ? (
                            <Alert variant="danger" dismissible onClose={this.hideError.bind(this)}>
                                <Alert.Heading>An error occurred!</Alert.Heading>
                                <p>{this.state.error.message}</p>
                                <hr />
                                <p>{this.state.error.code}</p>
                            </Alert>
                        ) : (
                            ''
                        )}
                        {this.state.authorized ? <Alert variant="success">You are successfully authorized!</Alert> : ''}
                    </Form>
                </Modal.Body>
            </Modal>
        )
    }
}

export default AuthModal
