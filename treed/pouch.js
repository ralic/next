
export default db => ({
  _db: db,
  sync: (onDump, onChange, onError) => {
    db.changes({
      live: true,
      include_docs: true,
      // attachments: true,
      since: 'now',
    }).on('change', change => {
      // console.log('getting changes', change)
      if (change.doc._deleted) {
        onChange(change.doc._id, null)
      } else {
        onChange(change.doc._id, change.doc)
      }
    }).on('error', onError)

    db.allDocs({
      include_docs: true,
      // attachments: true,
    }).then(({rows}) => {
      const data = {}
      rows.forEach(({doc}) => {
        data[doc._id] = doc
      })
      onDump(data)
    }, err => onError(err))
  },
  set: (id, attr, value, modified) => {
    return db.upsert(id, doc => ({...doc, [attr]: value, modified}))
  },
  setNested: (id, attrs, last, value, modified) => {
    return db.upsert(id, doc => {
      doc = {...doc, modified}
      const lparent = attrs.reduce((o, a) => o[a] = {...o[a]}, doc)
      lparent[last] = value
      return doc
    })
  },
  updateNested: (id, attrs, last, update, modified) => {
    return db.upsert(id, doc => {
      doc = {...doc, modified}
      const lparent = attrs.reduce((o, a) => o[a] = {...o[a]}, doc)
      lparent[last] = {...lparent[last], ...update}
      return doc
    })
  },
  update: (id, update, modified) => {
    return db.upsert(id, doc => ({...doc, ...update, modified}))
  },
  // upsert: (id, update) => db.upsert(id, update), // .then(r => (console.log('upsert', r))),
  save: (doc) => db.put(doc), // .then(r => (console.log('save', r), r)),
  saveMany: docs => db.bulkDocs(docs), // .then(r => (console.log('savemany', r), r)),
  delete: doc => db.remove(doc),
  getAttachment: (id, attachmentId) => db.getAttachment(id, attachmentId),
  getBase64Attachment: (id, attachmentId) => db.get(id, {attachments: true})
    .then(doc => doc._attachments[attachmentId].data)
})

