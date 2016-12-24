// @flow

import React, {Component} from 'react';
import {css, StyleSheet} from 'aphrodite'

import Content from './Content'

export default class Body extends Component {
  onClick = (e: any) => {
    e.preventDefault()
    e.stopPropagation()
    this.props.actions.edit(this.props.node._id)
  }

  render() {
    const {depth, isActive, editState} = this.props
    const pluginCls = this.props.store.plugins.node.className ?
      this.props.store.plugins.node.className(this.props.node, this.props.store) :
        ''
    const cls = css(
      styles.outline,
      isActive && styles.active,
      editState && styles.editing,
    ) + ` Node_body Node_body_level_${depth} ${pluginCls}`

    const Component = this.props.node.type !== 'normal' &&
      this.props.store.plugins.nodeTypes[this.props.node.type] &&
      this.props.store.plugins.nodeTypes[this.props.node.type].render ||
      Content

    return <div
      onMouseDown={editState ? null : this.onClick}
      className={css(styles.container)}
    >
      <div className={cls}>
        <Component
          node={this.props.node}
          store={this.props.store}
          actions={this.props.actions}
          editState={this.props.editState}
        />
      </div>
    </div>
  }
}

const styles = StyleSheet.create({
  outline: {
  },

  container: {
    padding: '1px 0',
    cursor: 'pointer',
    zIndex: 1,
  },

  active: {
    outline: '2px solid magenta',
  },

  editing: {
    outlineColor: 'lime',
  },
})
