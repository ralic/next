
import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableHighlight,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

import Button from '../components/Button'

export default class Browse extends Component {
  constructor() {
    super()
    this.state = {
      files: null,
      existings: {},
      error: null,
    }
  }

  getAllDocs() {
    this.props.userDb.allDocs({include_docs: true}).then(result => {
      const files = result.rows.filter(item => item.doc.type === 'doc').map(item => item.doc)
        .sort((a, b) => a.title > b.title ? 1 : (a.title === b.title ? 0 : -1))
      this.setState({files})
    }, err => {
      console.log('failed to get')
      this.setState({error: 'Failed to list files'})
    })
  }

  componentDidMount() {
    this.getAllDocs()
    this._changes = this.props.userDb.changes({
      include_docs: true,
      live: true,
      since: 'now',
    })
    .on('change', change => {
      this.getAllDocs()
    })
  }

  componentWillUnmount() {
    if (this._changes) {
      this._changes.cancel()
    }
  }

  render() {
    if (this.state.error) {
      return <View style={styles.container}>
        <View style={styles.loading}>
          <Text>Failed to load files list</Text>
        </View>
      </View>
    }
    if (!this.state.files) {
      return <View style={styles.container}>
        <View style={styles.loading}>
          <Text>Loading files list</Text>
        </View>
      </View>
    }
    if (!this.state.files.length) {
      return <View style={styles.container}>
        <View style={styles.loading}>
          <Text>No files</Text>
        </View>
      </View>
    }

    return <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>NotableMind: Files</Text>
      </View>

      <ScrollView style={{flex: 1}}>
      {this.state.files.map(file => (
        <TouchableOpacity
          key={file._id}
          onPress={() => this.props.openFile(file._id, file.title)}
          style={styles.item}>
          <View style={styles.itemRow}>
          <Text style={[styles.title, !this.props.syncData[file._id] && styles.unsynced]}>
            {file.title}
          </Text>
          <Text>
            {file.size}
          </Text>
          </View>
        </TouchableOpacity>
      ))}
      </ScrollView>
    </View>
  }
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    flex: 1,
    // padding: 10,
  },

  loading: {
    alignItems: 'center',
    paddingVertical: 50,
  },

  unsynced: {
    fontStyle: 'italic',
    color: '#888',
  },

  header: {
    backgroundColor: 'cyan',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },

  headerText: {
    color: '#555',
    fontWeight: 'bold',
  },

  title: {
    flex: 1,
    fontWeight: '200',
  },

  itemRow: {
    flexDirection: 'row',
  },

  item: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: .5,
    borderColor: '#ccc',
  },
})
