// @flow

import React, {Component} from 'react';
import {css, StyleSheet} from 'aphrodite'

import WhiteboardNode from './WhiteboardNode'
import dragger from './dragger'

import trySnapping from './trySnapping'
import calcSnapLines from './calcSnapLines'

import calcChildBoxes from './calcChildBoxes'
import calcChildInsertPos from './calcChildInsertPos'
import findEnclosingBox from './findEnclosingBox'

type State = {
  dx: number,
  dy: number,
  node: any,
  root: string,
  defaultPositions: ?Array<any>,
  hideSelected: bool,
}

export default class WhiteboardRoot extends Component {
  _dragger: any
  _sub: any
  _unsub: () => void
  state: State
  div: any

  constructor(props: any) {
    super()
    this._sub = props.store.setupStateListener(
      this,
      store => [
        store.events.root(),
        store.events.node(store.getters.root())
      ],
      store => ({
        root: store.getters.root(),
        node: store.getters.node(store.getters.root()),
      }),
      store => store.getters.root() !== this.state.root,
    )
    this._unsub = props.store.on(['x-selection'], () => {
      this.setState({
        dx: 0,
        dy: 0,
      })
    })
    this.state.dx = 0
    this.state.dy = 0
    this.state.hideSelected = false
  }

  shouldComponentUpdate(nextProps: any, nextState: State) {
    return nextState !== this.state
  }

  componentDidMount() {
    this._sub.start()

    this.calcDefaultPositions()
  }

  componentWillUnmount() {
    this._sub.stop()
    this._unsub()
  }

  componentDidUpdate(prevProps: any, prevState: State) {
    if (prevState.root !== this.state.root) {
      this.calcDefaultPositions()
    }
  }

  calcDefaultPositions() {
    let top = 0
    let x = 0
    let nextX = 0
    let defaultPositions = []
    this.state.node.children.forEach(id => {
      const box = this.props.nodeMap[id].getBoundingClientRect()
      if (top + box.height > window.innerHeight) {
        top = 0
        x = nextX + 5
      }
      defaultPositions.push({
        x: x,
        y: top,
      })
      nextX = Math.max(nextX, x + box.width)
      top += box.height + 5
    })
    this.setState({defaultPositions})
  }

  offsetSelected(dx: number, dy: number) {
    const ids = Object.keys(this.props.store.state.selected)
    const defaultPositions = this.state.defaultPositions || []
    const updates = ids.map(id => this.props.store.db.data[id])
      .map(node => {
        const pos = node.views.whiteboard || defaultPositions[
          this.state.node.children.indexOf(node._id)
        ] || {
          x: 0,
          y: this.state.node.children.indexOf(node._id) * 100,
        }
        return {
          views: {
            ...node.views,
            whiteboard: {
              ...node.views.whiteboard,
              x: pos.x + dx,
              y: pos.y + dy,
            },
          },
        }
      })
    this.props.store.actions.updateMany(ids, updates)
    this.props.store.emit('x-selection')
  }

  onSelectedDown = (id: string, e: any) => {
    if (e.button !== 0) return

    const {store, nodeMap} = this.props

    e.stopPropagation()
    e.preventDefault()

    let box, snapLines
    let wasSelected = true
    let childBoxes
    let moveCount

    let childPos = null
    let moved = false
    this._dragger = dragger(e, {
      move: (x, y, w, h) => {
        if (!moved) {
          if (Math.abs(w) > 5 || Math.abs(h) > 5) {
            moved = true
            if (!store.state.selected) {
              wasSelected = false
              store.actions.setActive(id)
              store.actions.select(id)
            } else if (!store.state.selected[id]) {
              wasSelected = false
              store.actions.clearSelection()
              store.actions.setActive(id)
              store.actions.select(id)
            }
            this.props.store.actions.setMode('dragging')

            box = findEnclosingBox(store.state.selected, nodeMap)
            snapLines = calcSnapLines(
              store.state.selected,
              store.db.data[store.state.root].children,
              nodeMap,
              box.left,
              box.top,
              box,
            )

            childBoxes = calcChildBoxes(
              id,
              store.db.data,
              store.state.root,
              store.state.nodeMap,
              store.state.selected,
            )
            moveCount = Object.keys(store.state.selected).length

          } else {
            return
          }
        }

        const {insertPos, indicator} = calcChildInsertPos(childBoxes, x + w, y + h)
        childPos = insertPos

        if (!insertPos) {
          let news = trySnapping(
            box.left + w,
            box.top + h,
            box.width,
            box.height,
            snapLines,
          )

          this.props.showIndicators(
            news.xsnap,
            news.ysnap,
            true,
          )
          this.props.setChildDrag(null)

          this.setState({
            dx: news.x - box.left,
            dy: news.y - box.top,
            hideSelected: false,
          })
        } else {
          this.props.setChildDrag({
            pos: {x: x + w, y: y + h},
            insertPos,
            indicator,
            moveCount,
          })
          this.props.showIndicators(null, null)
          this.setState({
            hideSelected: true,
          })
        }
      },

      done: (x, y, w, h) => {
        if (!moved) {
          this.props.store.actions.edit(id)
          return
        }
        if (childPos) {
          this.props.setChildDrag(null)
          const {pid, idx} = childPos
          this.setState({
            hideSelected: false,
            dx: 0,
            dy: 0,
          })
          this.props.store.actions.moveSelected(
            pid,
            idx,
          )
          return
        }
        let news = trySnapping(
          box.left + w,
          box.top + h,
          box.width,
          box.height,
          snapLines,
        )
        this.props.showIndicators(null, null)
        this.offsetSelected(
          news.x - box.left,
          news.y - box.top,
        )
        if (!wasSelected) {
          this.props.store.actions.normalMode()
        }
      },
    })
  }

  render() {
    const {dx, dy, defaultPositions} = this.state
    return <div className={css(styles.container)} ref={node => this.div = node}>
      {this.state.node.children.map((child, i) => (
        <WhiteboardNode
          id={child}
          key={child}
          store={this.props.store}
          nodeMap={this.props.nodeMap}
          onSelectedDown={this.onSelectedDown}
          showIndicators={this.props.showIndicators}
          startChildDragging={this.props.startChildDragging}
          dx={dx}
          dy={dy}
          hideSelected={this.state.hideSelected}
          defaultPos={defaultPositions &&
            defaultPositions[i] || {
              x: 0,
              y: i * 100,
            }
          }
        />
      ))}
    </div>
  }
}

const styles = StyleSheet.create({
  container: {
  },
})

