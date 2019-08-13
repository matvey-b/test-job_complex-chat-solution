import React from 'react'
import ListGroup from 'react-bootstrap/ListGroup'

export default class ChatsMessages extends React.Component {
    render() {
        const items = this.props.items.map(item => (
            <ListGroup.Item variant="success" action key={item.id}>
                {item.text}
            </ListGroup.Item>
        ))
        return <ListGroup>{items}</ListGroup>
    }
}
