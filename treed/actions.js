// @flow

// const maybeId = fn => (store, id) => fn(store, id || store.state.active)

import uuid from '../src/utils/uuid'
import * as nav from './nav'
import * as move from './move'

type Mode = 'normal' | 'insert' | 'visual'
type Store = {
  id: string,
  db: {
    data: {[key: string]: any},
  },
  actions: {[key: string]: Function},
  execute: (command: {
    type: string,
    args: any,
    preActive?: string,
    postActive?: string,
  }) => void,
  emit: Function,
  emitMany: Function,
  events: {[key: string]: (...args: any) => string},
  getters: {[key: string]: Function},
  state: {
    root: string,
    active: string,
    mode: Mode,
    lastEdited: string,
    editPos: EditPos,
    viewType: string,
    selection: ?Array<string>,
  },
  globalState: {
    activeView: string,
  },
}

type EditPos = 'start' | 'end' | 'default' | 'change'
type DefEditPos = EditPos | false

const actions = {
  set(store: Store, id: string, attr: string, value: any) {
    if (store.db.data[id][attr] === value) return
    store.execute({type: 'set', args: {id, attr, value}})
  },

  setNested(store: Store, id: string, attrs: Array<string>, value: any) {
    const att: any = attrs
    const current = att.reduce((o, a) => o ? o[a] : undefined, store.db.data[id])
    if (current === value) return
    store.execute({type: 'setNested', args: {id, attrs, value}})
  },

  update(store: Store, id: string, update: any) {
    store.execute({type: 'update', args: {id, update}})
  },

  setContent(store: Store, id: string, content: string) {
    store.actions.set(id, 'content', content)
  },

  setActiveView(store: Store) {
    if (store.id !== store.globalState.activeView) {
      store.globalState.activeView = store.id
      store.emit(store.events.activeView())
    }
  },

  setActive(store: Store, id: string) {
    if (!id || !store.db.data[id]) return
    const old = store.state.active
    store.actions.setActiveView()
    if (id === old) return
    store.state.active = id
    if (store.state.mode === 'insert') {
      store.state.editPos = 'default' // do I care about this?
    } else if (store.state.mode !== 'normal') {
      store.actions.setMode('normal')
    }
    if (store.db.data[old]) {
      store.emit(store.events.nodeView(old))
    }
    store.emitMany([
      store.events.activeNode(),
      store.events.nodeView(id),
    ])
    return true
  },

  setMode(store: Store, mode: Mode) {
    if (store.state.mode === mode) return
    store.state.mode = mode
    if (store.getters.isActiveView()) {
      store.emit(store.events.activeMode())
    }
    store.emit(store.events.mode(store.id))
  },

  normalMode(store: Store, id: string=store.state.active) {
    if (store.state.mode === 'normal' && store.state.active === id) return
    store.actions.setMode('normal')
    if (!store.actions.setActive(id)) {
      store.emit(store.events.nodeView(id))
    }
  },

  visualMode(store: Store, id: string=store.state.active) {
    if (store.state.mode === 'visual' && store.state.active === id) return
    store.actions.setMode('visual')
    store.state.selection = [id]
    if (!store.actions.setActive(id)) {
      store.emit(store.events.nodeView(id))
    }
  },

  expandSelectionPrev(store: Store) {
    throw new Error('not implt')
  },

  expandSelectionNext(store: Store) {
    throw new Error('not implt')
  },

  edit: (store: Store, id: string) => store.actions.editAt(id, 'default'),
  editStart: (store: Store, id: string) => store.actions.editAt(id, 'start'),
  editEnd: (store: Store, id: string) => store.actions.editAt(id, 'end'),

  editAt(store: Store, id: string=store.state.active, at: EditPos='default') {
    if (store.state.mode === 'edit' && store.state.active === id) return
    if (!store.actions.setActive(id)) {
      store.emit(store.events.nodeView(id))
    }
    store.state.lastEdited = id
    store.state.editPos = at
    store.actions.setMode('insert')
  },

  createAfter(store: Store, id: string=store.state.active, content: string='') {
    if (!id || !store.db.data[id]) return
    let pid = store.db.data[id].parent
    let idx
    if (pid) {
      idx = store.db.data[pid].children.indexOf(id) + 1
    } else {
      pid = id
      idx = 0
    }
    if (idx < 0) return
    const nid = uuid()
    store.execute({
      type: 'create',
      args: {id: nid, pid, ix: idx, data: {content}},
    }, id, nid)
    store.actions.editStart(nid)
    return nid
  },

  editChange: (store: Store, id: string) => store.actions.editAt(id, 'change'),

  focusNext(store: Store, id: string=store.state.active, editState: DefEditPos=false) {
    const next = nav.next(id, store.db.data, store.state.root, store.state.viewType)
    if (editState !== false) {
      store.actions.editAt(next, editState)
    } else {
      store.actions.setActive(next)
    }
  },

  focusPrev(store: Store, id: string=store.state.active, editState: DefEditPos=false) {
    const prev = nav.prev(id, store.db.data, store.state.root, store.state.viewType)
    if (editState !== false) {
      store.actions.editAt(prev, editState)
    } else {
      store.actions.setActive(prev)
    }
  },

  focusParent(store: Store, id: string=store.state.active) {
    if (id === store.state.root) return
    store.actions.setActive(store.db.data[id].parent)
  },

  toggleCollapse(store: Store, id: string=store.state.active) {
    if (id === store.state.root) return
    const views = store.db.data[id].views
    const collapsed = views && views[store.state.viewType] && views[store.state.viewType].collapsed
    store.actions.setNested(id, ['views', store.state.viewType, 'collapsed'], !collapsed)
  },

  collapse(store: Store, id: string=store.state.active) {
    if (id === store.state.root) return
    store.actions.setNested(id, ['views', store.state.viewType, 'collapsed'], true)
  },

  expand(store: Store, id: string=store.state.active) {
    if (id === store.state.root) return
    store.actions.setNested(id, ['views', store.state.viewType, 'collapsed'], false)
  },

  remove(store: Store, id: string=store.state.active, goUp: boolean=false) {
    const sibs = store.db.data[store.db.data[id].parent].children
    let nid
    if (sibs.length > 1) {
      const idx = sibs.indexOf(id)
      if (goUp) {
        if (idx === 0) {
          nid = store.db.data[id].parent
        } else {
          nid = sibs[idx - 1]
        }
      } else {
        if (idx === sibs.length - 1) {
          nid = sibs[idx - 1]
        } else {
          nid = sibs[idx + 1]
        }
      }
    } else {
      nid = store.db.data[id].parent
    }
    store.actions.setActive(nid)
    store.execute({
      type: 'remove',
      args: {id},
    }, id, nid)
  },

  _fixChildren(store: Store, id: string=store.state.active) {
    const children = store.db.data[id].children.filter(cid => !!store.db.data[cid] && store.db.data[cid].parent === id)
    store.actions.set(id, 'children', children)
  },

  makePrevSiblingsLastChild(store: Store, id: string=store.state.active) {
    const sibs = store.db.data[store.db.data[id].parent].children
    const idx = sibs.indexOf(id)
    if (idx === 0) return
    store.execute({
      type: 'move',
      args: {id, pid: sibs[idx - 1], expandParent: true, idx: -1, viewType: store.state.viewType}
    })
  },

  makeParentsNextSibling(store: Store, id: string=store.state.active) {
    if (id === store.state.root || store.db.data[id].parent === store.state.root) return
    const parent = store.db.data[store.db.data[id].parent]
    const sibs = store.db.data[parent.parent].children
    const idx = sibs.indexOf(parent._id)
    store.execute({
      type: 'move',
      args: {
        id,
        pid: parent.parent,
        expandParent: true,
        idx: idx + 1,
        viewType: store.state.viewType
      }
    })
  },

  rebase(store: Store, id: string=store.state.active) {
    if (!id) return
    store.state.root = id
    store.emit(store.events.root())
  },

  movePrev(store: Store, id: string=store.state.active) {
    if (id === store.state.root) return
    const res = move.movePrev(id, store.db.data, store.state.root, store.state.viewType)
    console.log('move', res)
    if (!res) return
    store.execute({
      type: 'move',
      args: {
        id,
        pid: res.pid,
        expandParent: false,
        idx: res.idx,
        viewType: store.state.viewType
      }
    })
  },

  moveNext(store: Store, id: string=store.state.active) {
    if (id === store.state.root) return
    const res = move.moveNext(id, store.db.data, store.state.root, store.state.viewType)
    console.log('move', res)
    if (!res) return
    store.execute({
      type: 'move',
      args: {
        id,
        pid: res.pid,
        expandParent: false,
        idx: res.idx,
        viewType: store.state.viewType
      }
    })
  },

  focusFirstSibling(store: Store, id: string=store.state.active) {
    if (id === store.state.root) return
    let nid = store.db.data[store.db.data[id].parent].children[0]
    if (nid === id) nid = store.db.data[id].parent
    store.actions.setActive(nid)
  },

  focusLastSibling(store: Store, id: string=store.state.active) {
    let nid
    if (id !== store.state.root) {
      const sibs = store.db.data[store.db.data[id].parent].children
      if (sibs[sibs.length - 1] !== id) {
        nid = sibs[sibs.length - 1]
      }
    }
    if (!nid) nid = nav.next(id, store.db.data, store.state.root, store.state.viewType)
    store.actions.setActive(nid)
  },

}

export default actions
