
var Parser = Npm.require('dot-object');

/*
 * Function to verify watchers
 * */
const checkWatcher = (watcher) => {
  return typeof watcher.collectionName === 'string' && typeof watcher.index === 'string'
    && typeof watcher.type === 'string' && (!watcher.transformFunction || typeof watcher.transformFunction === 'function')
    && typeof watcher.fetchExistingDocuments === 'boolean' && typeof watcher.priority === 'number' && watcher.priority >= 0;
};


const verifyWatchers = (watchers) => {
  for (var x = 0; x < watchers.length; x++) {
    if (!checkWatcher(watchers[x])) {
      throw new Meteor.Error(400, `ESMongoSync: Watcher parsing error. Watcher objects not well formatted.`);
    }
  }
};


/*
 * Define main ESMongoSync object
 * */
ESMongoSync = {
  Oplog: {},
  EsClient: {},
  dbConnection: {
    db: {},
    connected: false
  },
  options: {
    watchedCollections: [],
    batches: [],
    documentsInBatch: 100,
    config: {}
  },
  Util: {}
};


/*
 * Function to verify init function arguments
 * */
ESMongoSync.Util.verifyInitArgs = (args) => {
  if (args.length !== 6) {
    throw new Meteor.Error(400, `ESMongoSync: Initialization call requires 6 parameters. ${args.length} parameters provided.`);
  }
  if ((args[0] && typeof args[0] !== 'string') || (args[1] && typeof args[1] !== 'string') || (args[2] && typeof args[2] !== 'string')) {
    throw new Meteor.Error(400, `ESMongoSync: Expects string values as first and second parameters, got ${typeof args[0]} for first and ${typeof args[1]} for second.`);
  }
  if (typeof args[3] !== 'function') {
    throw new Meteor.Error(400, `ESMongoSync: Expects function as third parameter, got ${typeof args[3]} instead.`);
  }
  if (_.isArray(args[4])) {
    verifyWatchers(args[4]);
  } else {
    throw new Meteor.Error(400, `ESMongoSync: Expects array as fourth parameter, got ${typeof args[4]} instead.`);
  }
  if (typeof parseInt(args[5]) !== 'number' || parseInt(args[5]) < 0) {
    throw new Meteor.Error(400, `ESMongoSync: Expects number as fourth parameter, got ${typeof args[5]} instead. Also expects number greater than or equal to zero (0).`);
  }
};


/*
 * Function to handle transformation
 * */
ESMongoSync.Util.transform = (watcher, document, callBack) => {
  if (document.index) {
    callBack(document);
  } else {
    if (watcher.transformFunction) {
      watcher.transformFunction(watcher, document, callBack);
    } else {
      document.id = document._id;
      delete document._id;
      callBack(document);
    }
  }
};


/*
 * Function to get watcher by collection name and index
 * */
ESMongoSync.Util.getWatcherByCollection = (collectionName) => {
  return _.find(ESMongoSync.options.watchedCollections, Meteor.bindEnvironment((watcher) => {
    return watcher.collectionName === collectionName;
  }));
};



/*
 * Function to fetch all watchers at specified level
 * */
ESMongoSync.Util.getWatcherAtLevel = (watchers, level) => {
  let newWatchers = [];
  _.each(watchers, Meteor.bindEnvironment((watcher) => {
    if (watcher.priority === level && watcher.fetchExistingDocuments) {
      newWatchers.push(watcher);
    }
  }));
  return newWatchers;
};



/*
 * Function to check for size of watchers at specific level
 * */
ESMongoSync.Util.getWatchersAtLevelSize = (watchers, level) => {
  let newWatchers = [];
  _.each(watchers, Meteor.bindEnvironment((watcher) => {
    if (watcher.priority === level) {
      newWatchers.push(watcher);
    }
  }));
  return newWatchers.length;
};



/*
 * Function to get collection name
 * */
ESMongoSync.Util.getCollectionName = (ns) => {
  let splitArray = ns.split('.');
  return splitArray[splitArray.length - 1];
};



/*
 * Function to check if collection is being watched
 * */
ESMongoSync.Util.getWatcher = (collectionName) => {
  return _.find(ESMongoSync.options.watchedCollections, function (watcher) {
    return watcher.collectionName === collectionName;
  });
};



/*
 * Function to insert into elastic search
 * */
ESMongoSync.Util.insert = (watcher, document) => {
  ESMongoSync.Util.transform(watcher, document, Meteor.bindEnvironment((document) => {
    ESMongoSync.EsClient.index({
      index: watcher.index,
      type: watcher.type,
      id: document.id,
      body: Parser.object(document)
    }, Meteor.bindEnvironment((error, response) => {
      if (!error && !response.errors) {
        console.log('ESMongoSync: Inserted - ', 'Index: ', watcher.index, ' Type: ', watcher.type, ' Id: ', document.id);
      }
    }));
  }));
};


/*
 * Function to delete from elastic search
 * */
ESMongoSync.Util.remove = (watcher, id) => {
  ESMongoSync.EsClient.delete({
    index: watcher.index,
    type: watcher.type,
    id: id
  }, Meteor.bindEnvironment((error, response) => {
    if (!response.found) {
      console.log('ESMongoSync: Deleted - ', 'Index: ', watcher.index, ' Type: ', watcher.type, ' Id: ', id);
    }
  }));
};


/*
 * Function to update elastic search document
 * */
ESMongoSync.Util.update = (watcher, id, partialDocument) => {
  ESMongoSync.EsClient.update({
    index: watcher.index,
    type: watcher.type,
    id: id,
    body: {
      doc: Parser.object(partialDocument)
    }
  }, Meteor.bindEnvironment((error) => {
    if (!error) {
      console.log('ESMongoSync: Updated - ', 'Index: ', watcher.index, ' Type: ', watcher.type, ' Id: ', id);
    }
  }));
};

