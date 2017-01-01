// @flow

import React, {Component} from 'react';
import {css, StyleSheet} from 'aphrodite'

import ContextMenu from '../context-menu/ContextMenu'
import WhiteboardRoot from './WhiteboardRoot'

import dragger from './dragger'
import selectBoxes from './selectBoxes'

type Props = {
  store: any,
}
type State = {
  x: number,
  y: number,
  zoom: number,
  contextMenu: any,
  root: string,
  mode: string,
  selectBox: any,
}

export default class Whiteboard extends Component {
  props: Props
  state: State
  nodeMap: any
  _sub: any
  _dragger: any
  constructor(props: Props) {
    super()
    this.nodeMap = {}
    this._sub = props.store.setupStateListener(
      this,
      store => [
        store.events.root(),
        store.events.mode(),
        store.events.activeView(),
        store.events.contextMenu(),
      ],
      store => ({
        root: store.getters.root(),
        mode: store.getters.mode(),
        isActiveView: store.getters.isActiveView(),
        contextMenu: store.getters.contextMenu(),
      }),
    )
    this.state.x = 0
    this.state.y = 0
    this.state.zoom = 1
  }

  componentDidMount() {
    this._sub.start()
  }

  componentWillUnmount() {
    this._sub.stop()
    if (this._dragger) this._dragger()
  }

  onDragDone() {
    // TODO maybe save it or something?
  }

  onMouseDown = (e: any) => {
    if (e.button === 0 && e.metaKey) {
      e.preventDefault()
      e.stopPropagation()
      const {x, y} = this.state
      this._dragger = dragger(e, {
        move: (a, b, w, h) => {
          this.setState({
            x: x + w,
            y: y + h,
          })
        },
        done: (x, y, w, h) => {
          this.onDragDone()
        },
      })
    } else if (e.button === 0) {
      this.setupSelector(e)
      this.clearSelection()
    }
  }

  setupSelector(e: any) {
    let moved = false
    let boxes = []
    for (let id in this.nodeMap) {
      boxes.push([id, this.nodeMap[id].getBoundingClientRect()])
    }

    this._dragger = dragger(e, {
      move: (x, y, w, h) => {
        if (!moved && Math.abs(w) > 5 && Math.abs(h) > 5) {
          moved = true
        }
        if (moved) {
          this.setState({
            selectBox: {x, y, w, h},
          })
          selectBoxes(x, y, w, h, boxes, this.props.store)
        }
      },
      done: (x, y, w, h) => {
        if (!moved) {
          this.props.store.actions.setActive(this.props.store.state.root)
        }
        this.setState({selectBox: null})
      },
    })
  }

  clearSelection() {
    if (!this.props.store.state.selected) return
    const events = []
    for (let id in this.props.store.state.selected) {
      events.push(this.props.store.events.nodeView(id))
    }
    this.props.store.state.selected = null
    this.props.store.emitMany(events)
  }

  renderSelectBox() {
    let {x, y, w, h} = this.state.selectBox
    if (w < 0) {
      x += w
      w *= -1
    }
    if (h < 0) {
      y += h
      h *= -1
    }
    return <div
      className={css(styles.selectBox)}
      style={{
        top: y,
        left: x,
        height: h,
        width: w,
      }}
    />
  }

  render() {
    const {x, y, zoom} = this.state
    // TODO zoom?
    return <div className={css(styles.container)}>
      <div
        onMouseDown={this.onMouseDown}
        className={css(styles.relative)}
      >
        <div className={css(styles.status)}>
          {x}:{y}:: {zoom}
        </div>
        <div
          className={css(styles.offset)}
          style={{
            transform: `translate(${x}px, ${y}px)`,
          }}
        >
          <WhiteboardRoot
            store={this.props.store}
            nodeMap={this.nodeMap}
          />
        </div>
      </div>
      {this.state.selectBox &&
        this.renderSelectBox()}

      {this.state.contextMenu &&
        <ContextMenu
          pos={this.state.contextMenu.pos}
          menu={this.state.contextMenu.menu}
          onClose={this.props.store.actions.closeContextMenu}
        />}
    </div>
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },

  selectBox: {
    outline: '5px solid blue',
    position: 'absolute',
  },

  relative: {
    position: 'relative',
    flex: 1,
  },

  offset: {
    position: 'absolute',
    top: 0,
    left: 0,
  },

  status: {
    position: 'absolute',
  },

})

