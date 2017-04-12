// @flow

import React from 'react'
import './themes.less'

import makeKeyLayer from 'treed/keys/makeKeyLayer'
import SidePane from './SidePane'

import themes from './themes'

import defaultGlobalConfig from './defaultGlobalConfig'
import type {Style, ThemeSettings} from './defaultGlobalConfig'

import themeToCss, {makeClassNames} from './themeToCss'

import type {Plugin} from 'treed/types'

const config = {
  themes,
}

const PLUGIN_ID = 'themes'

const makeActions = (themeSettings, globalStore) => {
  const actions = {}
  Object.keys(themeSettings.individualStyles).forEach(key => {
    const istyle = themeSettings.individualStyles[key]
    actions[key] = {
      shortcut: 's ' + istyle.shortcut,
      description: `Toggle ${istyle.name}`,
      action: () => {
        const store = globalStore.activeView()
        const id = store.state.active
        const pluginData = store.getters.nodePluginData(id, PLUGIN_ID) || {}
        store.actions.setPluginData(id, PLUGIN_ID, {
          ...pluginData,
          [key]: !pluginData[key],
        })
      },
    }
  })
  return actions
}

// global plugin config -> saved on the document
// global plugin state -> transient state (default null)
// plugin data -> `node.plugins[pluginId]`

type GlobalState = {
  styleNode: any,
  preview: (config: ThemeSettings) => void,
  unsub: () => void,
  removeKeyLayer: () => void,
}

const plugin: Plugin<ThemeSettings, GlobalState> = {
  id: PLUGIN_ID,
  defaultGlobalConfig,

  getters: {
    viewTheme(store) {
      const {theme='default', overrides={}} = store.db.data.settings.plugins[PLUGIN_ID] || {}
      const viewTheme = {
        ...(themes[theme] || themes.default).viewStyles[store.state.viewType],
        ...(overrides.viewStyles || {})[store.state.viewType],
      }
      return viewTheme
    },
  },

  events: {
    viewTheme: () => 'view-theme',
  },

  // (globalPluginConfig) -> globalPluginState
  // TODO I want a "plugin store" or sth, not "treed"
  init(globalPluginConfig, globalStore) {
    const styleNode = document.createElement('style')
    // $FlowFixMe document.head is a thing
    document.head.appendChild(styleNode)
    styleNode.textContent = themeToCss(globalPluginConfig, themes)

    /*
     * TODO fix this
    const actions = makeActions(globalPluginConfig, globalStore)
    const keyLayer = makeKeyLayer(
      actions,
      `plugins.${PLUGIN_ID}.setStyle`,
      {}, // TODO userSettings
    )
    */

    return {
      styleNode,
      preview(config) {
        styleNode.textContent = themeToCss(config, themes)
      },
      unsub: globalStore.on([globalStore.events.settingsChanged()], () => {
        // TODO first check if it changed?
        styleNode.textContent = themeToCss(
          globalStore.db.data.settings.plugins[PLUGIN_ID],
          themes
        )
      }),
      // removeKeyLayer: globalStore.addNormalKeyLayer(keyLayer),
    }
  },

  // globalPluginState -> void
  destroy(globalPluginState) {
    const {styleNode} = globalPluginState
    styleNode.parentNode.removeChild(styleNode)
    globalPluginState.unsub()
    // TODO reenable
    // globalPluginState.removeKeyLayer()
  },

  leftSidePane: SidePane,

  /*
  actions: (globalPluginConfig, store) => {
  },
  */

  node: {
    className: (pluginData, node, store) =>
      pluginData && makeClassNames(pluginData),

    contextMenu(pluginData, node, store) {
      /*
      return {
        text: 'Styles',
        children: Object.keys(store.getters.pluginConfig(PLUGIN_ID).individualStyles).map(name => ({
          text: name,
          checked: !!(pluginData && pluginData[name]),
          action: () => store.actions.setPluginData(node._id, PLUGIN_ID, {
            ...pluginData,
            [name]: !(pluginData && pluginData[name])
          }),
        }))
      }
      */
    },
  },

  view: {
    // TODO this isn't hooked up yet
    list: {
      className(store) {
        if (store.getters.pluginConfig(PLUGIN_ID).indentType === 'dots') {
          return 'Themefeature_indent--bullets'
        }
        return ''
      }
    },
  },

}

export default plugin
