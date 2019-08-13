import React from 'react'
import ListGroup from 'react-bootstrap/ListGroup'

export default class MessagesList extends React.Component {
    render() {
        console.log(`rendering MessagesList, props: `, this.props)
        const items = this.props.items.map(item => (
            <ListGroup.Item variant="light" key={item.id}>
                {item.text}
            </ListGroup.Item>
        ))
        return <ListGroup>{items}</ListGroup>
    }
}
