// @flow

import FlushingEmitter from './FlushingEmitter'
import Commandeger from './Commandeger'
import commands from './commands'
import Database from './Database'

import baseActions from './actions'
import baseGetters from './getters'
import baseEvents from './events'

import addPluginKeys from './keys/addPluginKeys'
import makeViewKeyLayers from './keys/makeViewKeyLayers'
import KeyManager from './keys/Manager'

import organizePlugins from './organizePlugins'
import bindCommandProxies from './bindCommandProxies'
import * as search from './search'
import * as migrations from './migrations'

import uuid from './uuid'
import type {Plugin, Store, GlobalStore, GlobalState, ViewTypeConfig} from './types'
import type {Db} from './Database'

type ViewId = number

const defaultSettings = {
  _id: 'settings',
  viewConfig: {
    leaf: true,
    type: 'list',
    root: 'root',
  },
}

type ViewTypes = {
  [name: string]: ViewTypeConfig,
}

const bindStoreProxies = (store, config, sub) => {
  Object.keys(config.getters[sub]).forEach(name => {
    store.getters[name] = config.getters[sub][name].bind(null, store)
  })

  Object.keys(config.events[sub]).forEach(name => {
    store.events[name] = config.events[sub][name].bind(null, store)
  })

  Object.keys(config.actions[sub]).forEach(name => {
    store.actions[name] = config.actions[sub][name].bind(null, store)
  })
}

export default class Treed {
  emitter: FlushingEmitter
  commands: Commandeger<*, *>
  ready: Promise<*>
  db: Database
  config: {
    events: any,
    getters: any,
    actions: any,
    plugins: Array<any>
  }
  keys: any
  nextViewId: number
  viewStores: any
  globalState: GlobalState
  keyManager: KeyManager
  globalStore: GlobalStore
  viewTypes: ViewTypes

  constructor(db: Db, plugins: Array<Plugin<any, any>>, viewTypes: ViewTypes, documentId: string, sharedViewData: any) {
    this.emitter = new FlushingEmitter()
    this.viewTypes = viewTypes
    this.commands = new Commandeger(commands, this.setActive)
    this.db = new Database(
      db, plugins, id => this.emitter.emit('node:' + id),
      this.settingsChanged
    )

    this.config = {
      actions: baseActions,
      getters: baseGetters,
      events: baseEvents,
      plugins: plugins,
    }

    this.viewStores = {}
    this.keys = {}
    this.nextViewId = 1
    this.globalState = {
      cut: null,
      activeView: 1,
      plugins: {},
      clipboard: null,
      runtimeId: uuid(),
      documentId,
    }
    this.keyManager = new KeyManager([
      () => this.getCurrentKeyLayer(),
    ])
    // this._pluginKeyLayer = this.keyManager.addLayer(pluginKeys(plugins))

    // TODO maybe plugins will want a say in the db stuff?
    this.ready = this.db.ready.then(() => {
      // first run
      const now = Date.now()
      // TODO handle initial sync - if the doc is already on the server, don't
      // open this up until we've had a full sync.
      if (!this.db.data.root) {
        console.log('creating')
        const pluginSettings = plugins.reduce((settings, plugin) => (
          settings[plugin.id] = plugin.defaultGlobalConfig, settings
        ), {})
        console.log('plungin settings', pluginSettings)
        return this.db.saveMany([{
          _id: 'root',
          created: now,
          modified: now,
          parent: null,
          children: [],
          type: 'normal',
          content: '',
          plugins: {},
          types: {},
          views: {},
        }, {
          _id: 'settings',
          created: now,
          modified: now,
          plugins: pluginSettings,
          views: {},
          version: 1,
          defaultViews: {
            root: {
              type: 'list',
              settings: {},
            },
          },
          // TODO what other things go in settings?
        }])
      } else if (!this.db.data.settings.version ||
                 this.db.data.settings.version < migrations.version) {
        return migrations.migrate(this.db)
      }

      /*
      // TODO remove
      if (!this.db.data.settings) {
        const pluginSettings = plugins.reduce((settings, plugin) => (
          settings[plugin.id] = plugin.defaultGlobalConfig, settings
        ), {})
        return this.db.save({
          _id: 'settings',
          created: now,
          modified: now,
          plugins: pluginSettings,
          views: {},
          // TODO what other things go in settings?
        })
      }
      */
    }).then(() => {
      const settings = this.db.data.settings
      return Promise.all(plugins.map(plugin => {
        if (plugin.init) {
          return Promise.resolve(plugin.init(
            settings.plugins[plugin.id] || plugin.defaultGlobalConfig,
            this.globalStore
          )).then(state => {
            this.globalState.plugins[plugin.id] = state
          })
        }
      }))
    })

    sharedViewData = {...sharedViewData}
    Object.keys(viewTypes).forEach(key => {
      if (!sharedViewData[key]) {
        sharedViewData[key] = viewTypes[key].initialSharedViewData ? viewTypes[key].initialSharedViewData() : {}
      }
    })

    const events = {}
    const args: any = [this.db, events]
    const globalStore: any = {
      db: this.db,
      emit: this.emitter.emit,
      emitMany: this.emitter.emitMany,
      plugins: organizePlugins(this.config.plugins),
      addKeyLayer: this.keyManager.addLayer,
      addNormalKeyLayer: this.addNormalKeyLayer,
      globalState: this.globalState,
      activeView: () => this.activeView(),
      handleKey: this.handleKey,
      on: this.on,
      addListener: (evt, fn) => this.emitter.on(evt, fn),
      removeListener: (evt, fn) => this.emitter.off(evt, fn),
      viewTypes: this.viewTypes,
      sharedViewData,

      undo: () => this.emitter.emitMany(this.commands.undo(args)),
      redo: () => this.emitter.emitMany(this.commands.redo(args)),

      events,
      getters: {},
      actions: {},

      setupStateListener: (...args) => this.setupStateListener(this.globalStore, ...args),
    }
    bindCommandProxies(globalStore, this.commands, this.emitter, args, null)
    bindStoreProxies(globalStore, this.config, 'global')
    this.globalStore = globalStore
  }

  changeViewType(id: number, type: string): any {
    if (!this.viewTypes[type]) {
      throw new Error(`Unknown view type ${type}`)
    }
    const viewTypeConfig: ViewTypeConfig = this.viewTypes[type]
    const store = this.viewStores[id]
    store.state.viewType = type
    store.state.viewTypeConfig = viewTypeConfig
    store.state.view = viewTypeConfig.getInitialState ? viewTypeConfig.getInitialState() : {}
    this.setupActionsAndGetters(store, viewTypeConfig)
    this.keys[store.id] = makeViewKeyLayers(this.viewTypes[type].keys, `views.${type}.`, {}, store)
    addPluginKeys(store, this.keys[store.id], this.config.plugins)
    store.emit(store.events.viewType())
    store.emit(store.events.serializableState())
  }

  serializeViewState(id: number): any {
    const {state} = this.viewStores[id]
    const viewTypeConfig: ViewTypeConfig = this.viewTypes[state.viewType]
    const plugins = {}
    this.config.plugins.forEach(plugin => (
      plugin.serializeState ?
        plugins[plugin.id] = plugin.serializeState(state.plugins[plugin.id])
          : null))
    return {
      root: state.root,
      viewType: state.viewType,
      view: viewTypeConfig.serializeState ? viewTypeConfig.serializeState(state.view) : null,
      plugins,
    }
  }

  registerView(initialState: Object): Store {
    const type = initialState.viewType
    if (!this.viewTypes[type]) {
      throw new Error(`Unknown view type ${type}`)
    }
    const id = this.nextViewId++
    const viewTypeConfig: ViewTypeConfig = this.viewTypes[type]

    const state = {
      id,
      root: 'root',
      active: 'root',
      activeIsJump: false,
      selected: null,
      editPos: null,
      mode: 'normal',
      minorMode: null,
      viewType: type,
      contextMenu: null,
      lastEdited: null,
      lastJumpOrigin: null,
      viewTypeConfig,
      plugins: {},
      view: null,
      ...initialState,
    }
    if (!state.view) {
      state.view = viewTypeConfig.getInitialState ?
        viewTypeConfig.getInitialState() : {}
    }

    this.config.plugins.forEach(
      plugin => !state.plugins[plugin.id] &&
        (state.plugins[plugin.id] = plugin.getInitialState ?
          plugin.getInitialState() : null))

    if (!state.root || !this.db.data[state.root]) state.root = 'root'
    state.active = viewTypeConfig.defaultActive === 'firstChild' && this.db.data[state.root].children[0] || state.root

    const events = {
      ...this.globalStore.events,
    }
    const args: any = [this.db, events]
    const store: Store = this.viewStores[id] = {
      id,
      state,
      ...this.globalStore,
      getters: {
        ...this.globalStore.getters,
      },
      actions: {
        ...this.globalStore.actions,
        changeViewType: this.changeViewType.bind(this, id),
      },

      // TODO maybe handle "changing active view" here too?
      // TODO test this stuff
      // call with (this, store => [], store => {})
      // and it will automatically manage unsub / resub for you
      setupStateListener: (...args) => this.setupStateListener(store, ...args),
    }

    this.setupActionsAndGetters(store, viewTypeConfig)
    bindCommandProxies(store, this.commands, this.emitter, args, id)

    this.keys[store.id] = makeViewKeyLayers(this.viewTypes[type].keys, `views.${type}.`, {}, store)
    addPluginKeys(store, this.keys[store.id], this.config.plugins)

    this.globalState.activeView = store.id
    this.emitter.emit(this.globalStore.events.activeView())

    return store
  }

  setupActionsAndGetters(store: Store, viewTypeConfig: ViewTypeConfig) {
    Object.keys(viewTypeConfig.getters).forEach(key => {
      store.getters[key] = viewTypeConfig.getters[key].bind(null, store)
    })
    Object.keys(viewTypeConfig.actions).forEach(key => {
      store.actions[key] = viewTypeConfig.actions[key].bind(null, store)
    })
    bindStoreProxies(store, this.config, 'view')
  }

  setActive = (view: ViewId, id: string) => {
    this.viewStores[view].actions.setActive(id)
  }

  getCurrentKeyLayer(): any {
    const mode = this.viewStores[this.globalState.activeView].state.mode
    return this.keys[this.globalState.activeView][mode]
  }

  handleKey = (e: any) => {
    this.keyManager.handle(e)
    // throw new Error('not impl')
  }

  searchFromCurrentView(text: string) {
    return search.shallowFromRoot(this.activeView(), text)
  }

  handlePaste = (e: any) => {
    if (e.target.nodeName === 'TEXTAREA') {
      return // allow normal pasting into text input
    }
    if (e.target.nodeName === 'INPUT') {
      return // allow normal pasting into text input
    }
    const data = e.clipboardData
    if (data.items.length === 1) {
      if (data.items[0].kind === 'string') {
        if (data.items[0].kind === 'string' && data.items[0].type === 'application/x-notablemind') {
          data.items[0].getAsString(string => {
            let data
            try {
              data = JSON.parse(string)
            } catch (e) {
              // TODO toast
              console.warn('failed to parse json from string of length ' + string.length)
              return
            }
            if (data.runtime === this.globalState.runtimeId) {
              if (data.source === 'clipboard') {
                this.activeView().actions.pasteAfter()
                return
              } else if (data.source === 'cut') {
                // umm yeah this is the same I think
                this.activeView().actions.pasteAfter()
                return
              }
            } else {
              const store = this.activeView()
              store.actions.insertTreeAfter(store.state.active, data.tree)
              return
            }
          })
          return
        }
        if (e.target.nodeName === 'INPUT') {
          return // allow normal pasting into text input
        }
      }
      if (data.items[0].kind === 'file') {
        const file = data.items[0].getAsFile()
        this.activeView().actions.pasteFile(file, data.items[0].type, '<pasted file>')
        return
      }
    }

    e.preventDefault()
    if (
      data.items.length === 2 &&
      data.items[0].kind === 'string' &&
        data.items[1].kind === 'file'
    ) {
      // looks like a "copy/pasted a file"
      // note this will only work if they pasted an image. (at least in chrome)
      const file = data.items[1].getAsFile()
      console.log(data.items[1], file)
      if (!file) { // wasn't an image I guess
        // TODO toast
        console.warn("Bad file - not an image?")
        return
      }
      const type = data.items[1].type
      data.items[0].getAsString(filename => {
        this.activeView().actions.pasteFile(file, type, filename)
      })
    } else {
      // TODO other pastes
      debugger
    }
  }

  addKeyLayer(layer: Function | any): () => void {
    return this.keyManager.addLayer(layer)
  }

  addNormalKeyLayer = (layer: Object) => {
    return this.keyManager.addLayer(() => this.isCurrentViewInInsertMode() ? null : layer)
  }

  settingsChanged = () => {
    this.emitter.emit(this.globalStore.events.settingsChanged())
    console.log('TODO proces settings change')
  }

  pluginStore(pluginId: string): any {
    const store = {
      events: {},
    }
  }

  setupStateListener = (
    store: GlobalStore,
    reactElement: any,
    eventsFromStore: (store: GlobalStore) => Array<string>,
    stateFromStore: (store: GlobalStore) => {[key: string]: any},
    shouldResub?: ?(store: GlobalStore)=>bool =null
  ) => {
    reactElement.state = stateFromStore(store)
    let evts = eventsFromStore(store)
    const fn = () => {
      if (shouldResub && shouldResub(store)) {
        let nevts = eventsFromStore(store)
        evts.forEach(ev => nevts.indexOf(ev) === -1 ? this.emitter.off(ev, fn) : null)
        nevts.forEach(ev => evts.indexOf(ev) === -1 ? this.emitter.on(ev, fn) : null)
        evts = nevts
      }
      reactElement.setState(stateFromStore(store))
    }
    return {
      start: () => evts.forEach(ev => this.emitter.on(ev, fn)),
      stop: () => evts.forEach(ev => this.emitter.off(ev, fn)),
    }
  }

  unregisterView(id: string) {
    delete this.viewStores[id]
    if (id === this.globalState.activeView) {
      const keys = Object.keys(this.viewStores)
      if (keys.length) {
        this.globalState.activeView = +keys[0]
        this.emitter.emit(this.config.events.activeView())
      }
    }
  }

  activeView(): any {
    return this.viewStores[this.globalState.activeView]
  }

  isCurrentViewInInsertMode() {
    const current = this.activeView()
    return current && current.state.mode === 'insert'
  }

  on = (evts: Array<string>, fn: Function) => {
    if (!Array.isArray(evts)) {
      evts = [evts]
    }
    evts.forEach(evt => this.emitter.on(evt, fn))
    return () => {
      evts.forEach(evt => this.emitter.off(evt, fn))
    }
  }

  destroy() {
    this.config.plugins.map(plugin => {
      if (plugin.destroy) {
        plugin.destroy(this.globalState.plugins[plugin.id])
      }
    })
    // TODO
  }
}
