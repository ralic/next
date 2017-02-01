// @flow

import PouchDB from 'pouchdb'
import {apiURL, dbURL} from '../../../../shared/config.json'
import uuid from '../../utils/uuid'

import type {User} from './types'

const USER_KEY = 'notablemind:user'

export const ensureUserDb = (done: Function) => {
  fetch(`${apiURL}/api/ensure-user`, {
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
  }).then(
    res => (console.log('good', res), done()),
    err => (console.log('bad'), done(err))
  )
}

export const ensureDocDb = (id: string) => {
  return fetch(`${apiURL}/api/create-doc?id=${id}`, {
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
  }).then(res => new PouchDB(`${dbURL}/${id}`))
}

export const getUser = () => {
  let val = localStorage[USER_KEY]
  try {
    return val ? JSON.parse(val) : null
  } catch (e) {
    return null
  }
}

export const saveUser = (user: User) => {
  localStorage[USER_KEY] = JSON.stringify(user)
}

export const clearUser = () => {
  localStorage[USER_KEY] = ''
}

export const restoreFromUser = (user: User, done: Function) => {
  const remoteUserDb = new PouchDB(`${dbURL}/user_${user.id}`)
  remoteUserDb.getSession((err, res) => {
    if (err) {
      console.log('network error', err)
      // TODO try to connect periodically.
      done('network')
      return
    }

    if (!res.userCtx || res.userCtx.name !== user.id) {
      clearUser()
      done('invalid')
      return
    }

    ensureUserDb(err => {
      if (err) {
        clearUser()
        done('invalid')
        return
      }
      done(null, remoteUserDb)
    })
  })
}


const userByEmail = (email: string, done: Function) => {
  fetch(`${apiURL}/api/user-by-email?email=${email}`)
    .then(res => res.status === 404 ? {id: null} : res.json())
    .then(
      res => done(null, res.id),
      err => done(err)
    )
}

const authWithApiServer = (id: string, pwd: string, done: Function) => {
  const remoteDb = new PouchDB(`${apiURL}/user_${id}`)
  remoteDb.getSession((err, res) => {
    if (err) {
      return done('Unable to connect to syncing server')
    }
    // already have a valid session
    if (res.userCtx && res.userCtx.name === id) {
      return authWithApiServer(id, pwd, () => {
        done(null, id, remoteDb)
      })
    }
    remoteDb.login(id, pwd, (err, response) => {
        if (err && err.name === 'unauthorized') {
          return done('Wrong password')
        }
        if (err) {
          return done('Unable to connect to syncing server')
        }
        if (response.ok && response.name === id) {
          done()
        }
    })
  })
}

export const signup = (
  name: string, email: string, pwd: string, done: Function
) => {
  const id = uuid()
  const remoteDb = new PouchDB(`${dbURL}/user_${id}`, {skipSetup: true})
  remoteDb.signup(id, pwd, {
    metadata: {email, realName: name}
  }, (err, response) => {
    if (err) return done('Failed to create user')
    done(null, id, remoteDb)
    console.log(response)
  })
}

type Done = Function // (err: ?string, id: ?string, db: ?any) => void

export const login = (email: string, pwd: string, done: Done) => {
  userByEmail(email, (err, id) => {
    if (err) {
      console.error(err)
      return done('Unable to connect to syncing server')
    }
    if (!id) {
      // this is a new user, or a different email address
      return done('No user found for that email')
    }
    const remoteDb = new PouchDB(`${dbURL}/user_${id}`)
    remoteDb.getSession((err, res) => {
      if (err) {
        return done('Unable to connect to syncing server')
      }
      // already have a valid session
      if (id && res.userCtx && res.userCtx.name === id) {
        return authWithApiServer(id, pwd, () => {
          done(null, id, remoteDb)
        })
      }
      remoteDb.login(id, pwd, (err, response) => {
        if (err && err.name === 'unauthorized') {
          return done('Wrong password')
        }
        if (err) {
          return done('Unable to connect to syncing server')
        }
        if (id && response.ok && response.name === id) {
          console.log('login response', response)
          authWithApiServer(id, pwd, () => {
            done(null, id, remoteDb)
          })
        }
      })
    })
  })
}