// @flow

import type {Db} from './types'
type Events = any

type Command<T, D> = {
  apply: (args: T, db: Db<D>, events: Events) => ?{
    old: any,
    prom?: Promise<void>,
    events?: Array<string>
  },
  undo: (old: any, db: Db<D>, events: Events) => ?{
    prom?: Promise<void>,
    events?: Array<string>,
  }
}

const commands: {[key: string]: Command<*, *>} = {
  update: {
    apply({id, update}, db, events) {
      const backdate = {}
      Object.keys(update).forEach(k => backdate[k] = db.data[id][k])
      const prom = db.update(id, {update})
      // not much to see here
      return {old: {backdate, id}, prom}
    },
    undo({id, backdate}, db, events) {
      const prom = db.update(id, backdate)
      return {prom}
    }
  },

  updateMany: {
    apply({ids, updates}, db, events) {
      const old = ids.map(id => db.data[id])
      const prom = db.saveMany(ids.map((id, i) => ({
        ...db.data[id],
        ...updates[i],
      })))
      return {old, prom}
    },
    undo(old, db, events) {
      const prom = db.saveMany(old)
      return {prom}
    },
  },

  set: {
    apply({id, attr, value}, db, events) {
      const old = {
        id,
        attr,
        value: db.data[id][attr]
      }
      const prom = db.set(id, attr, value)
      return {old, prom}
    },
    undo({id, attr, value}, db, events) {
      return {prom: db.set(id, attr, value)}
    },
  },

  setNested: {
    apply({id, attrs, value}, db, events) {
      const old = {
        id,
        attrs,
        value: attrs.reduce((o, a) => o ? o[a] : undefined, db.data[id]),
      }
      const prom = db.setNested(id, attrs, value)
      return {old, prom}
    },
    undo({id, attrs, value}, db, events) {
      // TODO this undo is a little incomplete, b/c setNested will construct
      // intermediate objects if they don't exist. if any code is looking for
      // the existance of these intermediate objects, this undo will be wrong.
      return {prom: db.setNested(id, attrs, value)}
    },
  },

  create: {
    apply({id, pid, ix, data}, db, events) {
      const now = Date.now()
      if (!id || !db.data[pid]) return null
      const children = db.data[pid].children.slice()
      children.splice(ix, 0, id)
      const prom = db.saveMany([{
        _id: id,
        created: now,
        modified: now,
        parent: pid,
        children: [],
        type: 'normal',
        content: '',
        plugins: {},
        types: {},
        views: {},
        ...data,
      }, {
        ...db.data[pid],
        children,
      }])
      return {old: id}
    },

    undo(id, db, events) {
      const node = db.data[id]
      if (!id || !node || !db.data[node.parent]) return null
      const parent = db.data[node.parent]
      const children = parent.children.slice()
      children.splice(children.indexOf(id), 1)
      return {prom: db.saveMany([{
        ...parent,
        children,
      }, {
        ...node,
        _deleted: true,
      }])}
    }
  },

  remove: {
    apply({id}, db, events) {
      const now = Date.now()
      if (!id || !db.data[id]) return null
      const node = db.data[id]
      if (!node.parent) return null
      const children = db.data[node.parent].children.slice()
      const idx = children.indexOf(id)
      children.splice(idx, 1)
      return {
        old: {node, idx},
        prom: db.saveMany([{
          ...db.data[node.parent],
          children,
        }, {
          ...node,
          _deleted: true,
        }])
      }
    },

    undo({idx, node}, db, events) {
      const children = db.data[node.parent].children.slice()
      children.splice(idx, 0, node._id)
      return {prom: db.saveMany([{
        ...db.data[node.parent],
        children,
      }, node])}
    },
  },

  move: {
    apply({id, pid, idx, expandParent, viewType}, db, events) {
      const opid = db.data[id].parent
      const ochildren = db.data[opid].children.slice()
      const oidx = ochildren.indexOf(id)
      ochildren.splice(oidx, 1)
      let pviews = db.data[pid].views
      let viewsDirty = false
      if (expandParent && pviews[viewType] && pviews[viewType].collapsed) {
        viewsDirty = true
        pviews = {
          ...pviews,
          [viewType]: {
            ...pviews[viewType],
            collapsed: false,
          },
        }
      }
      if (opid === pid) {
        // if (oidx > idx) idx--
        ochildren.splice(idx, 0, id)
        const old = {id, oidx, opid, pid}
        const prom = viewsDirty ?
          db.update(pid, {children: ochildren, views: pviews})
          : db.set(pid, 'children', ochildren)
        return {prom, old}
      }
      const children = db.data[pid].children.slice()
      if (idx === -1) {
        children.push(id)
      } else {
        children.splice(idx, 0, id)
      }
      // TODO expandParent
      return {prom: db.saveMany([{
        ...db.data[opid],
        children: ochildren,
      }, {
        ...db.data[pid],
        views: pviews,
        children,
      }, {
        ...db.data[id],
        parent: pid,
      }]), old: {id, oidx, opid, pid}}
    },

    undo({id, oidx, opid}, db, events) {
      const pid = db.data[id].parent
      const children = db.data[pid].children.slice()
      const idx = children.indexOf(id)
      children.splice(idx, 1)
      if (pid === opid) {
        if (idx < oidx) oidx--
        children.splice(oidx, 0, id)
        return {prom: db.set(pid, 'children', children)}
      }
      const ochildren = db.data[opid].children.slice()
      ochildren.splice(oidx, 0, id)
      return {prom: db.saveMany([{
        ...db.data[opid],
        children: ochildren,
      }, {
        ...db.data[pid],
        children,
      }, {
        ...db.data[id],
        parent: opid,
      }])}
    },
  },

  // TODO setMany
  // remove
  // move
}

export default commands

