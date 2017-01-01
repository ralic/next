
import React, {Component} from 'react';
import {css, StyleSheet} from 'aphrodite'

import Body from '../body'

const addMaybe = (map, ar, n) => {
  if (map[n]) return
  ar.push(n)
  map[n] = true
}

const calcSnapLines = nodeMap => {
  const verticals = []
  const vs = {}
  const horizontals = []
  const hs = {}
  for (let id in nodeMap) {
    const box = nodeMap[id].getBoundingClientRect()
    addMaybe(vs, verticals, box.left)
    addMaybe(vs, verticals, box.right)
    addMaybe(hs, horizontals, box.top)
    addMaybe(hs, horizontals, box.bottom)
    // TODO maybe have a fuzzy check instead
  }
  verticals.sort()
  horizontals.sort()
  return {verticals, horizontals}
}

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
  }

  shouldComponentUpdate(nextProps, nextState) {
    return nextState !== this.state
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
    if (e.button !== 0) return

    e.stopPropagation()
    e.preventDefault()

    const {x, y} = this.state.node.views.whiteboard ||
      {x: 0, y: 0}

    this.setState({
      moving: {
        x, y,
        ox: e.clientX,
        oy: e.clientY,
        moved: false,
        snapLines: calcSnapLines(this.props.nodeMap),
      }
    })
    window.addEventListener('mousemove', this.onDrag, true)
    window.addEventListener('mouseup', this.onMouseUp, true)
  }

  onDrag = (e: any) => {
    const dx = e.clientX - this.state.moving.ox
    const dy = e.clientY - this.state.moving.oy
    const {x, y} = this.state.node.views.whiteboard ||
      {x: 0, y: 0}
    this.setState({
      moving: {
        ...this.state.moving,
        moved: this.state.moving.moved ||
          (dx !== 0 || dy !== 0),
        x: x + dx,
        y: y + dy,
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
    console.log('mouseup', this.props.id)
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
    return <div
      ref={n => {
        this.div = n
        this.props.nodeMap[this.props.id] = n
      }}
      className={css(styles.container)}
      // onMouseMove={this.onMouseMove}
      onMouseDownCapture={this.onMouseDown}
      onContextMenu={this.onContextMenu}
      style={{
        transform: `translate(${x}px, ${y}px)`,
        zIndex: this.state.moving ? 10000 : undefined,
      }}
    >
      <Body
        node={this.state.node}
        // depth={100}
        isActive={this.state.isActive}
        // isCutting={this.state.isCutting}
        editState={this.state.editState}
        actions={this.props.store.actions}
        store={this.props.store}
      />
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
})

