// @flow

import type {ViewActionConfig} from '../../types'
import * as motion from './motion'

const keys: ViewActionConfig = {
  edit: {
    shortcuts: {
      normal: 'enter',
    },
    alias: 'edit',
    description: 'Start editing',
  },

  normalMode: {
    shortcuts: {
      visual: 'escape',
    },
    alias: 'normalMode',
    description: 'Quit visual mode',
  },

  editStart: {
    shortcuts: {
      normal: 'I',
    },
    alias: 'editStart',
    description: 'Start editing at the start',
  },

  remove: {
    shortcuts: {
      normal: 'd d',
      visual: 'd',
    },
    description: 'Remove the current node',
    alias: 'remove',
  },

  copy: {
    shortcuts: {
      normal: 'y y',
      visual: 'y',
    },
    description: 'Copy the current node',
    alias: 'copyNode',
  },

  cut: {
    shortcuts: {
      normal: 'y x, cmd+x',
    },
    description: 'Mark the current node to cut',
    alias: 'setCut',
  },


  rebase: {
    shortcuts: {
      normal: 'g d',
    },
    alias: 'rebase',
    description: 'Zoom to node',
  },

  rebaseLast: {
    shortcuts: {
      normal: 'g \'',
    },
    alias: 'rebaseLast',
    description: 'Go to previous zoom state',
  },

  rebaseNext: {
    shortcuts: {
      normal: 'g n',
    },
    alias: 'rebaseNext',
    description: 'Zoom to next sibling of root',
  },

  rebasePrev: {
    shortcuts: {
      normal: 'g p',
    },
    alias: 'rebasePrev',
    description: 'Zoom to previous sibling of root',
  },


  rebaseRoot: {
    shortcuts: {
      normal: 'g r',
    },
    action(store) {
      store.actions.rebase('root')
    },
    description: 'Zoom to root',
  },

  rebaseUp: {
    shortcuts: {
      normal: 'g u',
    },
    action(store) {
      const parent = store.db.data[store.state.root].parent
      store.actions.rebase(parent)
    },
    description: 'Zoom to parent of current root',
  },


  up: {
    shortcuts: {
      normal: 'k, up, alt+k, alt+up',
      // this has no insert b/c maybe up is within the thing
      // also visual mode is separate
    },
    description: 'move the cursor up one item',
    action(store) {
      const active = store.state.active
      const pid = store.db.data[active].parent
      if (!pid) return
      if (pid === store.state.root) {
        const next = motion.up(store.db.data[pid].children, store.state.nodeMap, active)
        if (next) {
          store.actions.setActive(next)
        }
      } else {
        if (!store.actions.focusPrevSibling()) {
          store.actions.focusParent()
        }
      }
    }
  },

  left: {
    shortcuts: {
      normal: 'h, left, alt+h, alt+left',
    },

    action(store) {
      const active = store.state.active
      const pid = store.db.data[active].parent
      if (!pid) return
      // need to find "next open space" on the whiteboard
      if (pid === store.state.root) {
        const next = motion.left(store.db.data[pid].children, store.state.nodeMap, active)
        if (next) {
          store.actions.setActive(next)
        }
      } else {
        store.actions.focusParent()
      }
    },
    description: 'Go left',
  },

  toNextSibling: {
    shortcuts: {
      normal: 'alt+down, alt+j',
    },

    action(store) {
      const active = store.state.active
      const pid = store.db.data[active].parent
      if (!pid) return
      if (pid === store.state.root) {
        const next = motion.down(store.db.data[pid].children, store.state.nodeMap, active)
        if (next) {
          store.actions.setActive(next)
        }
      } else {
        store.actions.focusNextSibling()
      }
    },
    description: 'Go do the first child',
  },

  right: {
    shortcuts: {
      normal: 'l, right, alt+l, alt+right',
    },

    action(store) {
      const active = store.state.active
      const pid = store.db.data[active].parent
      if (!pid) return
      if (pid === store.state.root) {
        const next = motion.right(store.db.data[pid].children, store.state.nodeMap, active)
        if (next) {
          store.actions.setActive(next)
        }
      } else {
        store.actions.focusParent()
      }
    },
    description: 'Go right',
  },

  down: {
    shortcuts: {
      normal: 'j, down',
    },
    description: 'move the cursor down one item',
    action(store) {
      const active = store.state.active
      const pid = store.db.data[active].parent
      if (!pid) return
      if (pid === store.state.root) {
        if (store.db.data[active].children.length && !store.getters.isCollapsed(active)) {
          store.actions.focusFirstChild(active)
          return
        }
        const next = motion.down(store.db.data[pid].children, store.state.nodeMap, active)
        if (next) {
          store.actions.setActive(next)
        }
      } else {
        if (!store.actions.focusNextSibling()) {
          const pid = store.db.data[active].parent
          const next = motion.down(store.db.data[store.state.root].children, store.state.nodeMap, pid)
          if (next) {
            store.actions.setActive(next)
          }
        }
      }
    }
  },

  createAfter: {
    shortcuts: {
      normal: 'o',
    },
    action(store) {
      const active = store.state.active
      const pid = store.db.data[active].parent
      if (!pid) return
      // need to find "next open space" on the whiteboard
      if (pid === store.state.root) {
      } else {
        store.actions.createNextSibling(active)
      }
    },
    description: 'Create node after',
  },

  createBefore: {
    shortcuts: {
      normal: 'O',
    },
    action(store) {
      const active = store.state.active
      const pid = store.db.data[active].parent
      if (!pid) return
      // need to find "next open space" on the whiteboard
      if (pid === store.state.root) {
      } else {
        store.actions.createBefore(active)
      }
    },
    description: 'Create node after',
  },

  createChild: {
    shortcuts: {
      normal: 'cmd+o',
    },
    description: 'Create child',
    action(store) {
      const active = store.state.active
      const pid = store.db.data[active].parent
      if (!pid) return
      if (pid === store.state.root) {
        store.actions.createLastChild(active)
        // TODO make sure it's not collapsed
      } else {
      }
    }
  },

  lineNodesUpVertically: {
    shortcuts: {
      visual: 'enter',
    },
    alias: 'lineNodesUpVertically',
    description: 'Line up selected items vertically',
  },

  // ???
}

export default keys


