// @flow

import actions from './actions'

import type {Plugin} from 'treed/types'

const PLUGIN_ID = 'image'

const plugin: Plugin<void, void> = {
  id: PLUGIN_ID,

  node: {
    pasteFile: (store, id, file, type, filename) => {
      if (!type.match(/^image\//)) return false
      const node = store.db.data[id]
      let extra = {type: 'image'}
      if (!node.content.trim()) {
        extra = {content: filename, type: 'image'}
      }
      actions.setImage(store, id, file, extra)
      return true
    },

    pasteSpecial: (node, store, clipboard) => {
      if (clipboard.type !== 'image' || !clipboard.types.image || !clipboard.types.image.attachmentId) return
      return {
        text: 'Paste image',
        action: () => {
          const attachmentId = clipboard.types.image.attachmentId
          store.actions.update(node._id, {
            type: 'image',
            types: {
              ...node.types,
              image: {
                ...node.types.image,
                attachmentId,
              },
            },
            _attachments: {
              ...node._attachments,
              [attachmentId]: clipboard._attachments[attachmentId],
            },
          })
        }
      }
    },

    dropFileNew: (store, pid, idx, file) => {
      if (!file.type.match(/^image\//)) return false
      actions.createWithImage(store, pid, idx, file)
      return true
    },

    dropFileOnto: (store, id, file) => {
      if (!file.type.match(/^image\//)) return false
      const node = store.db.data[id]
      let extra = {type: 'image'}
      if (!node.content.trim()) {
        extra = {content: file.name, type: 'image'}
      }
      actions.setImage(store, id, file, extra)
      return true
    },
  },

  nodeTypes: {
    image: {
      title: 'Image',
      newSiblingsShouldCarryType: false,
      shortcut: 'i',

      render: null,

      defaultNodeConfig() {
        return {
          attachmentId: null,
          fullSize: false,
        }
      },

      contextMenu(typeData, node, store) {
        if (typeData.attachmentId) {
          return [{
            text: 'Remove image',
            action: () => actions.removeImage(store, node._id),
          }, {
            text: 'Full size',
            checked: !!typeData.fullSize,
            action: () => actions.toggleFullSize(store, node),
          }]
        }
      },

      actions: {
        toggleFullSize: {
          shortcuts: {
            normal: 'space',
            visual: 'space',
            // insert: 'space',
          },
          description: 'Toggle "full size"',
          action(store, node) {
            actions.toggleFullSize(store, node)
          },
        },
      },

      columns: {
        fileSize: {
          editable: false,
        },
      },
    },
  },
}

export default plugin
