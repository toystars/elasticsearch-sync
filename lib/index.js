/*
 * NPM modules
 * */
MongoOplog = Npm.require('mongo-oplog');
ElasticSearch = Npm.require('elasticsearch');
MongoDriver = Npm.require('mongodb').MongoClient;



/*
 * Function to verify env variables
 * */
const unsetEnv = [];
const getSetStatus = (env, systemEnv) => systemEnv[env] ? true : false;
const verifySystemEnv = (mongoOplogUrl, elasticSearchUrl, dataDbUrl) => {
  const processEnv = ['MONGO_OPLOG_URL', 'DATA_MONGO_URL', 'SEARCH_ELASTIC_URL'];
  const serverEnv = process.env;
  if (!mongoOplogUrl || !elasticSearchUrl || !dataDbUrl) {
    _.each(processEnv, env => {
      if (!getSetStatus(env, serverEnv)) {
        unsetEnv.push(env);
      }
    });
    return unsetEnv.length === 0;
  } else {
    return true;
  }
};


/*
 * Function to process batch request
 * */
const processSingleBatch = (currentBatch, callBack) => {
  let currentDocuments = currentBatch.splice(0, ESMongoSync.options.documentsInBatch * 2);
  if (currentDocuments.length > 0) {
    let bulk = [];
    let currentCollectionName = '';
    _.each(currentDocuments, Meteor.bindEnvironment((document, mainIndex) => {
      if (document.index) {
        currentCollectionName = document.index._type;
      }
      ESMongoSync.Util.transform(ESMongoSync.Util.getWatcherByCollection(currentCollectionName), document, Meteor.bindEnvironment(doc => {
        currentDocuments[mainIndex] = doc;
        bulk.push(doc);
        if (bulk.length === currentDocuments.length) {
          ESMongoSync.EsClient.bulk({
            body: currentDocuments
          }, Meteor.bindEnvironment((error, response) => {
            if (!error && !response.errors) {
              console.log('ESMongoSync: Number of documents indexed in batch - ', bulk.length / 2);
              processSingleBatch(currentBatch, callBack);
            } else {
              console.log(error);
            }
          }));
        }
      }));
    }));
  } else {
    callBack();
  }
};


/*
 * Function to process batches
 * */
const processBatches = (currentBatchLevel) => {
  let batchLevel = currentBatchLevel || 0;
  if (batchLevel === 0) {
    console.log('ESMongoSync: Number of documents in batch - ', ESMongoSync.options.documentsInBatch);
  }
  let currentBatch = ESMongoSync.options.batches[batchLevel];
  if (currentBatch) {
    processSingleBatch(currentBatch, Meteor.bindEnvironment(() => {
      processBatches(batchLevel + 1);
    }));
  } else {
    console.log('Batch processing complete!');
  }
};


/*
 * Function to pull documents from mongoDB and send to elastic search in batches provided by user
 * */
const createBatches = (currentPriorityLevel) => {
  let priorityLevel = currentPriorityLevel || 0;
  if (priorityLevel === 0) {
    console.log('ESMongoSync: Beginning batch creation');
  }
  let newWatchers = ESMongoSync.Util.getWatcherAtLevel(ESMongoSync.options.watchedCollections, priorityLevel);
  if (newWatchers.length > 0) {
    console.log('ESMongoSync: Processing watchers on priority level ', priorityLevel);
    let checker = [];
    let mainDocuments = [];
    _.each(newWatchers, Meteor.bindEnvironment((watcher) => {
      console.log('ESMongoSync: Processing ', watcher.collectionName, ' collection');
      let documents = [];
      let collection = ESMongoSync.dbConnection.db.collection(watcher.collectionName);
      collection.count(Meteor.bindEnvironment((e, count) => {
        if (count > 0) {
          collection.find({}).forEach(Meteor.bindEnvironment(document => {
            documents.push(document);
            if (documents.length === count) {
              _.each(documents, Meteor.bindEnvironment((doc, docIndex) => {
                mainDocuments.push({
                  index: {
                    _index: watcher.index,
                    _type: watcher.type,
                    _id: doc._id
                  }
                }, doc);
                if (docIndex === documents.length - 1) {
                  checker.push(watcher.collectionName);
                  if (checker.length === newWatchers.length) {
                    ESMongoSync.options.batches.push(mainDocuments);
                    createBatches(priorityLevel + 1);
                  }
                }
              }));
            }
          }));
        } else {
          checker.push(watcher.collectionName);
          if (checker.length === newWatchers.length) {
            ESMongoSync.options.batches.push(mainDocuments);
            createBatches(priorityLevel + 1);
          }
        }
      }));
    }));
  } else {
    if (ESMongoSync.Util.getWatchersAtLevelSize(ESMongoSync.options.watchedCollections, priorityLevel + 1) === 0) {
      console.log('ESMongoSync: Batch creation complete. Processing...');
      processBatches();
    } else {
      createBatches(priorityLevel + 1);
    }
  }
};


/*
 * Connect to main database
 * */
const connectDB = (mongoUrl, fromResume) => {
  MongoDriver.connect(mongoUrl, Meteor.bindEnvironment((error, db) => {
    if (!error) {
      console.log('ESMongoSync: Connected to MONGO server successfully.');
      ESMongoSync.dbConnection.db = db;
      ESMongoSync.dbConnection.connected = true;
      if (!fromResume) {
        createBatches();
      }
    } else {
      throw new Meteor.Error(400, `ESMongoSync: Connection to database: ${mongoUrl} failed!`);
    }
  }));
};


/*
 * Function to tail Mongo database
 * */
const tail = (oplogUrl) => {

  // variable to hold oplogURL
  let mongoOplogUrl = oplogUrl;

  /*
   * Function to reconnect after timeout when there are issues connecting to
   * Oplog.
   */
  let tailRetry = () => {
    tail(mongoOplogUrl);
  };

  ESMongoSync.Oplog = MongoOplog(mongoOplogUrl).tail(Meteor.bindEnvironment(() => {
    if (!ESMongoSync.Oplog.stream) {
      console.log('ESMongoSync: Connection to Oplog failed!');
      console.log('ESMongoSync: Retrying...');
      Meteor.setTimeout(tailRetry, 5000);
    } else {
      console.log('ESMongoSync: Oplog tailing connection successful.');
      ESMongoSync.Oplog.on('insert', Meteor.bindEnvironment(doc => {
        const watcher = getWatcher(getCollectionName(doc.ns));
        if (watcher) {
          ESMongoSync.Util.insert(watcher, doc.o);
        }
      }));

      ESMongoSync.Oplog.on('update', Meteor.bindEnvironment(doc => {
        const watcher = getWatcher(getCollectionName(doc.ns));
        if (watcher) {
          ESMongoSync.Util.update(watcher, doc.o2._id, doc.o.$set);
        }
      }));

      ESMongoSync.Oplog.on('delete', Meteor.bindEnvironment(doc => {
        const watcher = getWatcher(getCollectionName(doc.ns));
        if (watcher) {
          ESMongoSync.Util.remove(watcher, doc.o._id);
        }
      }));

      ESMongoSync.Oplog.on('error', Meteor.bindEnvironment(error => {
        console.log('ESMongoSync: ', error);
        Meteor.setTimeout(tailRetry, 5000);
      }));

      ESMongoSync.Oplog.on('end', Meteor.bindEnvironment(() => {
        console.log('ESMongoSync: Stream ended');
        Meteor.setTimeout(tailRetry, 5000);
      }));

    }
  }));
};



/*
 * Function to connect to elastic search
 * */
const connectElasticSearch = (config, fromResume) => {
  ESMongoSync.EsClient = new ElasticSearch.Client({
    host: config.elasticSearchUrl,
    keepAlive: true
  });
  ESMongoSync.EsClient.ping({
    requestTimeout: Infinity
  }, Meteor.bindEnvironment(error => {
    if (error) {
      throw new Meteor.Error(400, `ESMongoSync: ElasticSearch cluster is down!`);
    } else {
      console.log('ESMongoSync: Connected to ElasticSearch successfully!');
      if (config.callBack) {
        config.callBack();
      }
      connectDB(config.dataDbUrl, fromResume);
    }
  }));
};


/*
 * Function to initialize all connections
 * */
const initialize = (config, fromResume) => {
  tail(config.mongoOplogUrl);
  connectElasticSearch(config, fromResume);
};


/*
 * Method to initialize all option values
 * */
ESMongoSync.init = function (mongoOplogUrl, elasticSearchUrl, dataDbUrl, callBack, watchers, documentsInBatch) {
  ESMongoSync.Util.verifyInitArgs(arguments);
  if (!verifySystemEnv(mongoOplogUrl, elasticSearchUrl, dataDbUrl)) {
    throw new Meteor.Error(400, `ESMongoSync: The following environment variables are not defined: ${unsetEnv.join(', ')}. Set and restart server.`);
  } else {
    ESMongoSync.options.documentsInBatch = (documentsInBatch && documentsInBatch > 0) ? documentsInBatch : ESMongoSync.options.documentsInBatch;
    ESMongoSync.options.watchedCollections = watchers;
    ESMongoSync.options.config = {
      mongoOplogUrl: mongoOplogUrl || process.env['MONGO_OPLOG_URL'],
      dataDbUrl: dataDbUrl || process.env['DATA_MONGO_URL'],
      elasticSearchUrl: elasticSearchUrl || process.env['SEARCH_ELASTIC_URL'],
      callBack: callBack
    };
    initialize(ESMongoSync.options.config, false);
  }
};



/*
 * Function to restart
 * */
ESMongoSync.reIndex = () => {
  createBatches();
};

/*
 * Function to destroy mongoOplog
 * */
ESMongoSync.destroy = () => {
  ESMongoSync.Oplog.destroy(Meteor.bindEnvironment(() => {
    ESMongoSync.dbConnection.db.close();
    ESMongoSync.dbConnection.connected = false;
    ESMongoSync.Oplog = {};
    console.log('ESMongoSync disconnected and Destroyed!');
  }))
};


/*
 * Function to disconnect mongoOplog
 * */
ESMongoSync.disconnect = () => {
  ESMongoSync.Oplog.stop(() => {
    console.log('ESMongoSync tailing stopped!');
  });
};


/*
 * Function to resume sync after destruction
 * */
ESMongoSync.resume = () => {
  initialize(ESMongoSync.options.config, true);
};
