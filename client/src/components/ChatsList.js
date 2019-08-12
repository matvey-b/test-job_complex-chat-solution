import React from 'react'
import { observer } from 'mobx-react'
import ListGroup from 'react-bootstrap/ListGroup'

export default observer(
    class ChatsList extends React.Component {
        render() {
            const items = this.props.items.map(item => (
                <ListGroup.Item variant="light" action active={this.props.currentChatId === item.id} key={item.id}>
                    {item.name}
                </ListGroup.Item>
            ))
            return <ListGroup>{items}</ListGroup>
        }
    },
)
