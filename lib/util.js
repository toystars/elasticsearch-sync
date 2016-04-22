
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

