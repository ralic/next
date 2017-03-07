'use strict';

const path = require('path')
const PouchDB = require('pouchdb')
const electron = require('electron')
const {ipcMain, app} = electron

const startSync = require('./src/sync')
const makeWindow = require('./src/makeWindow')

const state = {
  documentsDir: path.join(__dirname, 'documents'),
  publicDir: path.join(__dirname, 'public'),
  baseDir: __dirname,
  ipcMain,
  plugins: {},
}

ipcMain.on('sync', (evt, uid, docid) => {
  startSync(state, evt.sender, uid, docid)
})

app.on('window-all-closed', function() {
  app.quit();
});

app.on('ready', function() {
  const plugins = [
    require('../plugins/files/electron'),
    require('../plugins/quick-add/electron'),
    require('../dom/src/pages/Document/Sync/electron'),
  ]

  plugins.forEach(plugin => {
    state.plugins[plugin.id] = plugin.init(state)
  })

  // makeWindow(state)
  makeWindow(state)
});

