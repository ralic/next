
import React, {Component} from 'react';
import {css, StyleSheet} from 'aphrodite'

import Body from '../body'
import trySnapping from './trySnapping'
import calcSnapLines from './calcSnapLines'

export default class WhiteboardNode extends Component {
  constructor(props) {
    super()
    this._sub = props.store.setupStateListener(
      this,
      store => [
        store.events.node(props.id),
        store.events.nodeView(props.id),
      ],
      store => ({
        node: store.getters.node(props.id),
        isActive: store.getters.isActive(props.id),
        isSelected: store.state.selected &&
          store.state.selected[props.id],
        // isCutting: store.getters.isCutting(props.id),
        editState: store.getters.editState(props.id),
        handoff: null,
      })
    )
    this.state.moving = false
  }

  componentDidMount() {
    this._sub.start()
  }

  componentWillUnmount() {
    this.stopDragging()
    this._sub.stop()
    delete this.props.nodeMap[this.props.id]
  }

  shouldComponentUpdate(nextProps, nextState) {
    return nextState !== this.state || (
      !!this.state.isSelected && (
        nextProps.dx !== this.props.dx ||
        nextProps.dy !== this.props.dy))
  }

  stopDragging() {
    window.removeEventListener('mousemove', this.onDrag, true)
    window.removeEventListener('mouseup', this.onMouseUp, true)
  }

  onContextMenu = (e: any) => {
    e.preventDefault()
    e.stopPropagation()
    this.props.store.actions.openContextMenuForNode(
      this.props.id, e.clientX, e.clientY)
  }

  onMouseDown = (e: any) => {
    if (this.state.isSelected) return this.props.onSelectedDown(e)
    if (e.button !== 0) return

    e.stopPropagation()
    e.preventDefault()

    const {x, y} = this.state.node.views.whiteboard ||
      {x: 0, y: 0}

    const box = this.div.getBoundingClientRect()
    const snapLines = calcSnapLines(
      this.props.id,
      this.props.nodeMap,
      x, y,
      box
    )
    this.setState({
      moving: {
        x, y,
        ox: e.clientX,
        oy: e.clientY,
        moved: false,
        width: box.width,
        height: box.height,
        snapLines,
      }
    })
    window.addEventListener('mousemove', this.onDrag, true)
    window.addEventListener('mouseup', this.onMouseUp, true)
  }

  onDrag = (e: any) => {
    const dx = e.clientX - this.state.moving.ox
    const dy = e.clientY - this.state.moving.oy
    let orig = this.state.node.views.whiteboard ||
      {x: 0, y: 0}
    let {x, y} = trySnapping(
      orig.x + dx,
      orig.y + dy,
      this.state.moving.width,
      this.state.moving.height,
      this.state.moving.snapLines)
    this.setState({
      moving: {
        ...this.state.moving,
        moved: this.state.moving.moved ||
          (dx !== 0 || dy !== 0),
        x, y,
      }
    })
  }

  onMouseUp = () => {
    if (!this.state.moving) return
    if (!this.state.moving.moved) {
      this.props.store.actions.edit(this.props.id)
      this.stopDragging()
      this.setState({
        moving: false,
      })
      return
    }
    this.stopDragging()

    const orig = this.state.node.views.whiteboard ||
      {x: 0, y: 0}
    const {x, y} = this.state.moving

    if (x !== orig.x || y !== orig.y) {
      this.props.store.actions.setNodeViewData(
        this.props.id,
        'whiteboard',
        {...this.state.node.views.whiteboard, x, y}
      )
    }

    this.setState({
      moving: false,
      handoff: {x, y},
    })
  }

  render() {
    const settings = this.state.node.views.whiteboard
    let {x, y} = this.state.handoff || this.state.moving ||
      this.state.node.views.whiteboard || {x: 0, y: 0}
    if (!x) x = 0
    if (!y) y = 0
    const {dx, dy} = this.props
    return <div
      ref={n => n && (this.div = this.props.nodeMap[this.props.id] = n)}
      className={css(styles.container)}
      onMouseDownCapture={this.onMouseDown}
      onContextMenu={this.onContextMenu}
      style={{
        transform: `translate(${x + dx}px, ${y + dy}px)`,
        zIndex: this.state.moving ? 10000 : undefined,
      }}
    >
      <Body
        node={this.state.node}
        // depth={100}
        isActive={this.state.isActive}
        isSelected={this.state.isSelected}
        // isCutting={this.state.isCutting}
        editState={this.state.editState}
        actions={this.props.store.actions}
        store={this.props.store}
      />
      {this.state.node.children.length > 0 &&
        <div className={css(styles.kidBadge)}>
          {this.state.node.children.length}
        </div>}
    </div>
  }
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 2,
    position: 'absolute',
    backgroundColor: 'white',
    padding: 10,
    // minHeight: 100,
    width: 200,
    border: '1px solid #ccc',
    cursor: 'move',
  },

  kidBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    padding: '2px 4px',
    borderRadius: 10,
    fontSize: 10,
    color: '#aaa',
    // backgroundColor: '#eee',
    zIndex: 10,
  },
})

