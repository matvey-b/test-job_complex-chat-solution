import React from 'react'
import { ListGroup, Card, Row } from 'react-bootstrap'

export default class MessagesList extends React.Component {
    render() {
        console.log(`rendering MessagesList, props: `, this.props)
        const items = this.props.items.map(item => (
            <Row key={item.id} style={{ paddingBottom: '1em' }}>
                <Card border="light" style={{ width: '80%' }}>
                    <Card.Header>
                        {item.authorId} <b>{new Date(item.createdAt).toLocaleString()}</b>
                    </Card.Header>
                    <Card.Body>
                        <Card.Text>{item.text}</Card.Text>
                    </Card.Body>
                </Card>{' '}
            </Row>
        ))
        return <ListGroup>{items}</ListGroup>
    }
}
