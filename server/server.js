const app = require('express')()
const path = require('path')

app.use(require('cors')({origin: true, credentials: true}))
app.use(require('cookie-parser')())

const PouchDB = require('http-pouchdb')(require('pouchdb'), require('./supersecret.json').url + '/')
// const PouchDB = require('pouchdb').defaults({prefix: path.join(__dirname, 'data/')})

PouchDB.plugin(require('pouchdb-auth'))
PouchDB.plugin(require('pouchdb-security'))
PouchDB.plugin(require('pouchdb-find'))

const users = new PouchDB('_users')
users.useAsAuthenticationDB()
users.createIndex({index: {fields: ['email']}})

const usersQuery = {
  _id: '_design/by_email',
  views: {
    by_email: {
      map: function(doc) {emit(doc.email)}.toString(),
    },
  },
}

users.put(usersQuery)
  .then(() => console.log('saved users query'))
  .catch(err => err.status === 409 ? console.log('users query all set') : console.log('users query saving:', err))

const checkAuth = (username, password, done) => {
  users.multiUserLogIn(username, password, (err, res) => {
    if (res && res.ok) {
      done(true)
    } else {
      done(false)
    }
  })
}

const getUsersDB = (req) => {
  return require('express-pouchdb/lib/utils').getUsersDB(pouchApp, PouchDB)
}

const authMiddleware = (req, res, next) => {
  if (req.cookies.AuthSession) {
    // console.log(req.cookies.AuthSession)
    return getUsersDB(req).then(db => db.multiUserSession(req.cookies.AuthSession).then(
      result => {
        if (!result || !result.userCtx.name) {
          console.log('Unable to authorize', result, req.cookies.AuthSession)
          res.status(401)
          res.end('Bad news')
          return
        }
        // console.log('auth-ed', result.userCtx)
        req.pouchUserId = result.userCtx.name
        next()
      },
      err => {
        console.log('err authing', err)
        res.status(401)
        res.end('Bad news')
        return
      }
    ))
  }

  if (!req.headers.authorization) {
    res.status(401)
    res.end('Bad news')
    return
  }
  const part = req.headers.authorization.split(' ')[1]
  if (!part) {
    res.status(401)
    res.end('Bad news')
    return
  }
  const decoded = atob(part).split(':')
  checkAuth(decoded[0], decoded[1], good => {
    if (!good) {
      res.status(401)
      res.end('Bad news')
      return
    } else {
      req.pouchUserId = decoded[0]
      next()
    }
  })
}

const atob = text => {
  return new Buffer(text, 'base64').toString()
}

const ensureMemberAccess = (dbname, username, done) => {
  const db = new PouchDB(dbname)
  db.installSecurityMethods()
  db.getSecurity().then(security => {
    console.log('got security', security)
    if (!security.members) {
      security.members = {names: [], roles: []}
    }
    if (!security.cloudant) {
      security.cloudant = {}
    }
    security.cloudant[username] = ['_reader', '_writer']
    if (security.members.names.indexOf(username) === -1) {
      security.members.names.push(username)
    }
    return db.putSecurity(security)
  }).then(() => {
    console.log('ensured member access to', dbname, 'for', username)
    done()
  }, err => {
    console.log('failed to ensure member access')
    done(err)
  }).then(() => db.close())
}

const finish = (res, good, failMessage) => {
  if (!good) {
    res.status(500)
    res.end(failMessage || 'Bad news')
    return
  }
  res.status(204)
  res.end()
}

PouchDB.debug.enable('pouchdb:find')
const isMyDoc = (id, userId) => {
  return id.indexOf(`doc_${userId}_`) === 0
}

const userByEmail = (email, done) => {
  // (doc, emit) => emit(doc.email)
  users.query('by_email/by_email', {
    key: email,
    include_docs: true,
  }).then(res => {
    // console.log('got', res)
    if (!res || !res.rows.length) return done(null, null)
    users.get(res.rows[0].id).then(doc => {
      done(null, doc.name)
    }, err => {
      done('Failed to get doc: ' + res.rows[0].id)
    })
  }, err => {
    console.log('errors umm' + err)
    done(err)
  })

  /*
  users.find({selector: {'email': email}})
    .then(users => {
      if (!users || !users.docs.length) {
        console.log('no users?', users, email)
        return done(null, null)
      }
      done(null, users.docs[0].name)
    }, err => {
      console.log('failed to find probably', err, email)
      done(null, null)
      // done("Error finding user maybe")
    })
    */
}

app.get('/api/user-by-email', (req, res) => {
  if (!req.query.email) {
    res.status(400)
    return res.end()
  }
  userByEmail(req.query.email, (err, userId) => {
    if (err) {
      console.log('Server fail', err)
      res.status(500)
      return res.end()
    }
    if (!userId) {
      res.status (404)
      return res.end()
    }
    return res.end(JSON.stringify({id: userId}))
  })
})

app.post('/api/create-doc', authMiddleware, (req, res) => {
  if (!req.query.id) {
    res.status(400)
    return res.end()
  }
  if (!isMyDoc(req.query.id, req.pouchUserId)) {
    res.status(401)
    return res.end()
  }
  ensureMemberAccess(req.query.id, req.pouchUserId, err => {
    finish(res, !err)
  })
})

app.post('/api/add-collaborator', authMiddleware, (req, res) => {
  if (!req.query.id || !req.query.user) {
    res.status(400)
    return res.end('need id & user')
  }
  if (!isMyDoc(req.query.id, req.pouchUserId)) {
    res.status(401)
    return res.end()
  }
  ensureMemberAccess(req.query.id, req.query.user, err => {
    finish(res, !err)
  })
})

app.post('/api/remove-collaborator', authMiddleware, (req, res) => {
  if (!req.query.id || !req.query.user) {
    res.status(400)
    return res.end('need id & user')
  }
  if (!isMyDoc(req.query.id, req.pouchUserId)) {
    res.status(401)
    return res.end()
  }
  ensureMemberAccess(req.query.id, req.query.user, err => {
    finish(res, !err)
  })
})

app.post('/api/ensure-user', authMiddleware, (req, res) => {
  ensureMemberAccess('user_' + req.pouchUserId, req.pouchUserId, err => {
    finish(res, !err)
  })
})

app.put('/_users/:name', require('body-parser').json(), (req, res, next) => {
  const email = req.body.email // TODO case insensitive
  userByEmail(email, (err, userId) => {
    if (err) {
      res.status(500)
      return res.end()
    }
    if (!userId) {
      return next() // good, that email is not taken
    }
    res.status(409)
    res.end(JSON.stringify({
      error: 'conflict',
      reason: 'Document creation conflict',
      status: 409,
      message: 'Document creation conflict',
    }))
  })
})

const pouchApp = require('express-pouchdb')(PouchDB)

app.use(pouchApp)

app.listen(6102, () => {
  console.log('ready on 6102')
})
