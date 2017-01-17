
import Component from './Whiteboard'
import actions from './actions'
import keys from './keys'

export default {
  Component,
  actions,
  keys,
  getters: {
    isCollapsed: (store, id) => (
      store.db.data[id].views.whiteboard &&
      store.db.data[id].views.whiteboard.collapsed
    )
  },
  contextMenu: (store, id) => {
    const viewData = store.getters.nodeViewData(id)
    if (viewData && viewData.height) {
      return {
        text: 'Unset height',
        action: () => {
          store.actions.setNodeViewData(id, 'whiteboard', {
            ...viewData,
            height: null,
          })
        }
      }
    }
    return
  },
  contextMenuVisual: (store) => {
    const ids = Object.keys(store.state.selected)
    if (ids.length < 2) return
    return [{
      text: 'Line up vertically',
      action: () => {
      }
    }, {
      text: 'Line up horizontally',
      action: () => {
      }
    }]
  }
}

