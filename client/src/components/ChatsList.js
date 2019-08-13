import React from 'react'
import ListGroup from 'react-bootstrap/ListGroup'

export default class ChatsList extends React.Component {
    render() {
        const items = this.props.items.map(item => (
            <ListGroup.Item
                variant="light"
                action
                active={this.props.currentChatId === item.id}
                value={item.id}
                key={item.id}
                onClick={this.props.onClickHandler}
            >
                {item.name}
            </ListGroup.Item>
        ))
        return <ListGroup>{items}</ListGroup>
    }
}
