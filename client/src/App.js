import './App.css'
import React from 'react'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Modal from 'react-bootstrap/Modal'
import ListGroup from 'react-bootstrap/ListGroup'
import ConnectionStatus from './components/ConnectionStatus'
import AuthModal from './components/Auth'

function App() {
    return (
        <>
            <AuthModal />
            <Container style={{ 'padding-top': '20px' }}>
                <h2 align="center">Chat application</h2>
                <p align="right">
                    <ConnectionStatus />
                </p>
            </Container>
            <Container>
                <Row>
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
                    <Col>
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
        </>
    )
}

export default App
