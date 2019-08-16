import React from 'react'
import { ListGroup, Spinner } from 'react-bootstrap'

export default class ChatUsersList extends React.Component {
    render() {
        const makeListItems = () => {
            const items = this.props.items.map(item => (
                <ListGroup.Item variant="light" value={item.id} key={item.id}>
                    {item.isLoading ? (
                        <Spinner animation="border" variant="success" role="status" />
                    ) : (
                        <>{item.login}</>
                    )}
                </ListGroup.Item>
            ))
            return (items.length && items) || <ListGroup.Item variant="light">Empty list</ListGroup.Item>
        }
        return (
            <div>
                <h5>Users:</h5>
                <hr />
                <ListGroup>{makeListItems()}</ListGroup>
            </div>
        )
    }
}
