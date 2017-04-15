// @flow

import React from 'react';
import CodeBlock from './CodeBlock'
import CodeScope from './CodeScope'
import Manager from './Manager'
import Settings from './Settings'
import setupRenderers from './renderers'

const sources = [
  require('./sources/browser').default,
  require('./sources/jupyter').default,
]

const PLUGIN_ID = 'code'

const walk = (id, data, fn) => {
  fn(data[id])
  data[id].children.forEach(id => walk(id, data, fn))
}

const plugin: Plugin<*, *> = {
  id: PLUGIN_ID,
  title: 'Code',

  defaultGlobalConfig: { sources: {}, kernels: {} },

  init(globalPluginConfig, globalStore) {
    const manager = new Manager(globalStore.globalState.documentId, globalPluginConfig, globalStore, sources)
    window.manager = manager
    return manager.init().then(() => ({
      manager: manager,
      renderers: setupRenderers(globalStore.enabledPlugins),
    }))
  },

  settingsPage(globalPluginConfig, pluginState, store) {
    return <Settings
      config={globalPluginConfig}
      manager={pluginState.manager}
      sources={sources}
      store={store}
    />
  },

  actions: {
    setNodeKernel(store, id, kernelId, language) {
      const type = store.db.data[id].type
      if (type !== 'code' && type !== 'codeScope') return
      store.actions.updateNested(id, ['types', type], {kernelId, language})
    },

    executeNode(store, id) {
      if (store.getters.node(id).type !== 'code') return
      const {manager} = store.getters.pluginState('code')
      manager.execute(id)
    },

    clearAllOutputs(store, id) {
      // grrrrrr I really want transactions!!!
      const ids = []
      const updates = []
      const data = store.db.data
      walk(id, data, node => {
        if (node.type === 'code') {
          ids.push(node._id)
          updates.push({
            types: {
              ...node.types,
              code: {
                ...node.types.code,
                lastRun: null,
              },
            },
          })
        }
      })
      store.actions.updateMany(ids, updates)
    },
  },

  quickActions: [{
    id: 'clear_all_outputs',
    title: 'Clear all outputs',
    action: (store) => {
      store.actions.clearAllOutputs(store.state.active)
    },
  }],

  nodeTypes: {
    codeScope: {
      title: 'CodeScope',
      newSiblingsShouldCarryType: false,

      render: CodeScope,

      defaultNodeConfig(fromNode) {
        if (fromNode) {
          return {
            ...(fromNode.types.code || fromNode.types.codeScope),
            lastRun: null,
          }
        }
        return {
          lastRun: null,
          kernelId: null,
          language: 'javascript', // TODO have a better way of defining that
        }
      },
    },

    code: {
      title: 'Code',
      newSiblingsShouldCarryType: true,
      shortcut: 'c',

      render: CodeBlock,

      contextMenu(typeData, node, store) {
        if (typeData.lastRun) {
          return [{
            text: 'Clear last run',
            action: () => {
              const {manager} = store.getters.pluginState('code')
              store.actions.setNested(node._id, ['types', 'code', 'lastRun'], null)
              manager.clearOutput(node._id)
            }
          }]
        }
      },

      defaultNodeConfig(fromNode) {
        if (fromNode) {
          return {
            ...(fromNode.types.code || fromNode.types.codeScope),
            lastRun: null,
          }
        }
        return {
          lastRun: null,
          kernelId: null,
          language: 'javascript', // TODO have a better way of defining that
        }
      },

      actions: {
        execute: {
          shortcuts: {
            normal: 'cmd+enter',
            visual: 'cmd+enter',
            insert: 'cmd+enter',
          },
          description: 'Execute',
          action(store) {
            const {manager} = store.getters.pluginState('code')
            manager.execute(store.state.active)
            console.log('want to execute yall')
          },
        },
      },
    },
  },
}

export default plugin
