
export type User = {
  name: string,
  email: string,
}

let onUser
let getUser
let signIn
let getFiles
if (ELECTRON) {
  const {ipcRenderer} = require('electron')

  onUser = fn => {
    const nfn = (evt, user) => fn(user)
    ipcRenderer.on('sync:user', nfn)
    return () => ipcRenderer.removeListener('sync:user', nfn)
  }
  getUser = () => ipcRenderer.send('sync:user')
  signIn = () => ipcRenderer.send('sync:signin')
  getFiles = () => new Promise((res, rej) => {
    ipcRenderer.once('sync:files', (evt, files) => res(files))
    ipcRenderer.send('sync:files')
  })

} else {

  getUser = () => { throw new Error('not impl') }
  signIn = () => { throw new Error('not impl') }

}

export {onUser, getUser, signIn, getFiles}
