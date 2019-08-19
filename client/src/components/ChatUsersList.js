import React from 'react'
import { makeRpcCall } from '../io'
import authStore from '../stores/auth'
import capitalize from 'lodash.capitalize'
import { ListGroup, Spinner } from 'react-bootstrap'

class ChatUsersListItem extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            hover: false,
        }
        this.toggleHover = this.toggleHover.bind(this)
        this.changePermissions = this.changePermissions.bind(this)
    }

    get isMe() {
        return authStore.user.id === this.props.user.id
    }

    get hasReadOnlyPerms() {
        return this.props.currentChat.readOnlyUsers.includes(this.props.user.id)
    }

    get chatWasSelected() {
        return this.props.currentChat
    }

    async changePermissions() {
        await makeRpcCall('rpcChangeChatPermissions', {
            chatId: this.props.currentChat.id,
            permissions: this.hasReadOnlyPerms ? 'readWrite' : 'readOnly',
            userId: this.props.user.id,
        })
    }

    toggleHover() {
        this.setState({ hover: !this.state.hover })
    }

    render() {
        const makePermissionsInfo = () => {
            if (!this.chatWasSelected) {
                return null
            }
            const infoTags = []
            if (this.props.user.isAdmin && '(admin)') {
                infoTags.push('(admin)')
            }
            if (this.hasReadOnlyPerms) {
                infoTags.push('(readOnly)')
            }
            if (infoTags.length) {
                return (
                    <span style={{ color: 'green', fontWeight: 'bold', fontSize: '0.8em' }}>{infoTags.join(' ')}</span>
                )
            }
            return null
        }

        const makeActionInfo = () => {
            if (!this.state.hover || this.isMe || !this.chatWasSelected || !authStore.user.isAdmin) {
                return null
            }
            const text = this.hasReadOnlyPerms ? 'Set ReadWrite Perms' : 'Set ReadOnly Perms'

            return <span style={{ color: 'darkorange', fontWeight: 'bold', fontSize: '0.9em' }}>{text}</span>
        }

        const makeListItemChild = () => {
            if (this.props.user.isLoading) {
                return <Spinner animation="border" variant="success" role="status" />
            }

            return (
                <>
                    {this.isMe ? <u><b>{capitalize(this.props.user.login)}</b></u> : capitalize(this.props.user.login)}{' '}
                    {makePermissionsInfo()} {makeActionInfo()}
                </>
            )
        }

        return (
            <ListGroup.Item
                variant="light"
                value={this.props.user.id}
                action={!this.isMe && authStore.user.isAdmin}
                onMouseEnter={this.toggleHover}
                onMouseLeave={this.toggleHover}
                {...(this.isMe || !authStore.user.isAdmin ? {} : { onClick: this.changePermissions })}
            >
                {makeListItemChild()}
            </ListGroup.Item>
        )
    }
}

export default class ChatUsersList extends React.Component {
    render() {
        const makeListItems = () => {
            const empty = () => <ListGroup.Item variant="light">Empty list</ListGroup.Item>
            if (!this.props.currentChat || !(this.props.items && this.props.items.length)) {
                return empty()
            }
            const items = this.props.items.map(item => (
                <ChatUsersListItem key={item.id} user={item} currentChat={this.props.currentChat} />
            ))
            return items
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
