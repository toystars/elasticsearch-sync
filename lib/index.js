/*
 * NPM modules
 * */
MongoOplog = Npm.require('mongo-oplog');
ElasticSearch = Npm.require('elasticsearch');
MongoDriver = Npm.require('mongodb').MongoClient;


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
  }
};


/*
 * Function to verify env variables
 * */
const unsetEnv = [];
const getSetStatus = (env, systemEnv) => systemEnv[env] ? true : false;
const verifySystemEnv = (mongoOplogUrl, elasticSearchUrl) => {
  const processEnv = ['SEARCH_MONGO_URL', 'SEARCH_ELASTIC_URL'];
  const serverEnv = process.env;
  if (!mongoOplogUrl || !elasticSearchUrl) {
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
      transform(getWatcherByCollection(currentCollectionName), document, Meteor.bindEnvironment(doc => {
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
  let newWatchers = getWatcherAtLevel(ESMongoSync.options.watchedCollections, priorityLevel);
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
    console.log('ESMongoSync: Batch creation complete. Processing...');
    processBatches();
  }
};


/*
 * Connect to main database
 * */
const connectDB = () => {
  MongoDriver.connect(process.env.SEARCH_MONGO_URL || ESMongoSync.options.config.mongoOplogUrl, Meteor.bindEnvironment((error, db) => {
    if (!error) {
      console.log('ESMongoSync: Connected to MONGO server successfully.');
      ESMongoSync.dbConnection.db = db;
      ESMongoSync.dbConnection.connected = true;
      createBatches();
      /*loadDocuments(ESMongoSync.options.watchedCollections, 1);*/
    } else {
      throw new Meteor.Error(400, `ESMongoSync: Connection to database: ${process.env.SEARCH_MONGO_URL} failed!`);
    }
  }));
};

/*
 * Function to tail Mongo database
 * */
const tail = (mongoUrl) => {
  /*
   * Function to reconnect after timeout when there are issues connecting to
   * Oplog.
   */
  let tailRetry = () => {
    tail(mongoUrl);
  };
  ESMongoSync.Oplog = MongoOplog(mongoUrl).tail(Meteor.bindEnvironment(() => {
    if (!ESMongoSync.Oplog.stream) {
      console.log('ESMongoSync: Connection to Oplog failed!');
      console.log('ESMongoSync: Retrying...');
      Meteor.setTimeout(tailRetry, 5000);
    } else {
      console.log('ESMongoSync: Oplog tailing connection successful.');
      ESMongoSync.Oplog.on('insert', Meteor.bindEnvironment(doc => {
        const watcher = getWatcher(getCollectionName(doc.ns));
        if (watcher) {
          insert(watcher, doc.o);
        }
      }));

      ESMongoSync.Oplog.on('update', Meteor.bindEnvironment(doc => {
        const watcher = getWatcher(getCollectionName(doc.ns));
        if (watcher) {
          update(watcher, doc.o2._id, doc.o.$set);
        }
      }));

      ESMongoSync.Oplog.on('delete', Meteor.bindEnvironment(doc => {
        const watcher = getWatcher(getCollectionName(doc.ns));
        if (watcher) {
          remove(watcher, doc.o._id);
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
const connectElasticSearch = (elasticSearchUrl, callBack) => {
  ESMongoSync.EsClient = new ElasticSearch.Client({
    host: elasticSearchUrl,
    keepAlive: true
  });
  ESMongoSync.EsClient.ping({
    requestTimeout: Infinity
  }, Meteor.bindEnvironment(error => {
    if (error) {
      throw new Meteor.Error(400, `ESMongoSync: ElasticSearch cluster is down!`);
    } else {
      console.log('ESMongoSync: Connected to ElasticSearch successfully!');
      if (callBack) {
        callBack();
      }
      connectDB();
    }
  }));
};


/*
 * Function to initialize all connections
 * */
const initialize = (config) => {
  tail(config.mongoOplogUrl);
  connectElasticSearch(config.elasticSearchUrl, config.callBack);
};


/*
 * Method to initialize all option values
 * */
ESMongoSync.init = function (mongoOplogUrl, elasticSearchUrl, callBack, watchers, documentsInBatch) {
  verifyInitArgs(arguments);
  if (!verifySystemEnv(mongoOplogUrl, elasticSearchUrl)) {
    throw new Meteor.Error(400, `ESMongoSync: The following environment variables are not defined: ${unsetEnv.join(', ')}. Set and restart server.`);
  }
  ESMongoSync.options.documentsInBatch = documentsInBatch > 0 ? documentsInBatch : ESMongoSync.options.documentsInBatch;
  ESMongoSync.options.watchedCollections = watchers;
  ESMongoSync.options.config = {
    mongoOplogUrl: mongoOplogUrl || process.env['SEARCH_MONGO_URL'],
    elasticSearchUrl: elasticSearchUrl || process.env['SEARCH_ELASTIC_URL'],
    callBack: callBack
  };
  initialize(ESMongoSync.options.config);
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
