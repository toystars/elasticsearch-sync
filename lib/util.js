
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
* Function to verify init function arguments
* */
verifyInitArgs = (args) => {
  if (args.length !== 5) {
    throw new Meteor.Error(400, `ESMongoSync: Initialization call requires 5 parameters. ${args.length} parameters provided.`);
  }
  if ((args[0] && typeof args[0] !== 'string') || (args[1] && typeof args[1] !== 'string')) {
    throw new Meteor.Error(400, `ESMongoSync: Expects string values as first and second parameters, got ${typeof args[0]} for first and ${typeof args[1]} for second.`);
  }
  if (typeof args[2] !== 'function') {
    throw new Meteor.Error(400, `ESMongoSync: Expects function as third parameter, got ${typeof args[2]} instead.`);
  }
  if (_.isArray(args[3])) {
    verifyWatchers(args[3]);
  } else {
    throw new Meteor.Error(400, `ESMongoSync: Expects array as fourth parameter, got ${typeof args[3]} instead.`);
  }
  if (typeof parseInt(args[4]) !== 'number' || parseInt(args[4]) < 0) {
    throw new Meteor.Error(400, `ESMongoSync: Expects number as fourth parameter, got ${typeof args[3]} instead. Also expects number greater than or equal to zero (0).`);
  }
};


/*
 * Function to handle transformation
 * */
transform = (watcher, document, callBack) => {
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
getWatcherByCollection = (collectionName) => {
  return _.find(ESMongoSync.options.watchedCollections, Meteor.bindEnvironment((watcher) => {
    return watcher.collectionName === collectionName;
  }));
};


/*
 * Function to fetch all watchers at specified level
 * */
getWatcherAtLevel = (watchers, level) => {
  let newWatchers = [];
  _.each(watchers, Meteor.bindEnvironment((watcher) => {
    if (watcher.priority === level && watcher.fetchExistingDocuments) {
      newWatchers.push(watcher);
    }
  }));
  return newWatchers;
};


/*
 * Function to get collection name
 * */
getCollectionName = (ns) => {
  let splitArray = ns.split('.');
  return splitArray[splitArray.length - 1];
};


/*
 * Function to check if collection is being watched
 * */
getWatcher = (collectionName) => {
  return _.find(ESMongoSync.options.watchedCollections, function (watcher) {
    return watcher.collectionName === collectionName;
  });
};


/*
 * Function to insert into elastic search
 * */
insert = (watcher, document) => {
  transform(watcher, document, Meteor.bindEnvironment((document) => {
    ESMongoSync.EsClient.index({
      index: watcher.index,
      type: watcher.type,
      id: document.id,
      body: document
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
remove = (watcher, id) => {
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
update = (watcher, id, partialDocument) => {
  ESMongoSync.EsClient.update({
    index: watcher.index,
    type: watcher.type,
    id: id,
    body: {
      doc: partialDocument
    }
  }, Meteor.bindEnvironment((error) => {
    if (!error) {
      console.log('ESMongoSync: Updated - ', 'Index: ', watcher.index, ' Type: ', watcher.type, ' Id: ', id);
    }
  }));
};

