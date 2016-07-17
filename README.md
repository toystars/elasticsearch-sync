# elasticsearch-sync
ElasticSearch and MongoDB sync package for Meteor.

## What does it do?
elasticsearch-sync package keeps your mongoDB collections and elastic search cluster in sync. It does so by tailing the mongo oplog and replicate whatever crud operation into elastic search cluster without any overhead.
Please note that a replica set is needed for the package to tail mongoDB.


## How to use
Add to meteor app -  

Add with meteor
```bash
$ meteor add toystars:elasticsearch-sync
```
Add with iron
```bash
$ iron add toystars:elasticsearch-sync
```

## Sample usage (version <= 0.0.9)
After adding package to meteor app

```javascript

// initialize package as below

let finalCallBack = () => {
  // whatever code to run after package init
  .
  .
}

let transformFunction = (watcher, document, callBack) => {
  document.name = document.firstName + ' ' + document.lastName;
  callBack(document);
}

let sampleWatcher = {
  collectionName: 'users',
  index: 'person',
  type: 'users',
  transformFunction: transformFunction,
  fetchExistingDocuments: true,
  priority: 0
};

let watcherArray = [];
watcherArray.push(sampleWatcher);

let batchCount = 500;

ESMongoSync.init('MONGO_URL', 'ELASTIC_SEARCH_URL', finalCallBack, watcherArray, batchCount);

```

## Using environment variables
While it is possible to supply mongoDB and elastic search cluster URLs as parameters in the init() method, it is best to define them as environment variables
MongoDB url should be defined as: process.env.SEARCH_MONGO_URL, while Elastic search cluster url: process.env.SEARCH_ELASTIC_URL
Supplying the URLs as environments variables, the init method can be called like so:

```javasript
ESMongoSync.init(null, null, finalCallBack, watcherArray, batchCount);
```

## More usage info

The elasticsearch-sync package tries as much as possible to handle most heavy lifting, but certain checks has to be put in place, and that can be seen from the init function above. The ESMongoSync.init() takes five parameters:

- **MongoDB URL** - MongoDB database to tail and pull data from.

- **ElasticSearch URL** - URL to a running ElasticSearch cluster.

- **CallBack Function** - Function to execute after initial package setup is successful (can be null).

- **Watchers** - Array of watcher objects to signify which collection to tail and receive real-time update for.

- **Batch Count** - An integer that specifies number of documents to send to ElasticSearch in batches. (can be set to very high number. defaults to 100)


Below is more info about sample watcher:

```javascript
let sampleWatcher = {
  collectionName: 'users', 
  index: 'person',
  type: 'users',
  transformFunction: transformFunction,
  fetchExistingDocuments: true,
  priority: 0
};
```

- **collectionName** - MongoDB collection to watch.

- **index** - ElasticSearch index where documents from watcher collection is saved.

- **type** - ElasticSearch type given to documents from watcher collection

- **transformFunction** - Function that gets run each time watcher document is processed. Takes 3 parameters (watcher object, document and callBack function). The callBack function is to be called with processed document as argument. (can be null)

- **fetchExistingDocuments** - Specifies if existing documents in collection are to be pulled on initialization

- **priority** - Integer (starts from 0). Useful if certain watcher depends on other watchers. Watchers with lower priorities get processed before watchers with higher priorities.



## Sample usage (version >= 0.1.0)
After adding package to meteor app. It is highly recommended that ENV_VARs be used.

```javascript

// initialize package as below

let finalCallBack = () => {
  // whatever code to run after package init
  .
  .
}

let transformFunction = (watcher, document, callBack) => {
  document.name = document.firstName + ' ' + document.lastName;
  callBack(document);
}

let sampleWatcher = {
  collectionName: 'users',
  index: 'person',
  type: 'users',
  transformFunction: transformFunction,
  fetchExistingDocuments: true,
  priority: 0
};

let watcherArray = [];
watcherArray.push(sampleWatcher);

// The following env_vars are to be defined. Error will be thrown if any of the env_var is not defined 
export MONGO_OPLOG_URL="mongodb://127.0.0.1:27017/local" // mongoDB url where data will be pulled from
export DATA_MONGO_URL="mongodb://127.0.0.1:27017/meteor" // mongoDB oplog url which is the local DB of replica-set
export SEARCH_ELASTIC_URL="localhost:9200" // ElasticSearch cluster url
export BATCH_COUNT = 100; // Number of documents to be indexed in a single batch indexing


ESMongoSync.init(null, null, null, finalCallBack, watcherArray, null);

```


#### Don't want to use ENV_VARs (not recommended)

```javascript

/*
 * The init function takes six (6) arguments in all, as follows
 * 1. MongoDB oplog url
 * 2. ELasticSearch cluster url
 * 3. MongoDB data url
 * 4. callBack function to be called after init function has finished running all checkup. Can be null.
 * 5. Array of wather objects specifying which mongoDB collections to pull from and keep in sync with ES cluster
 * 6. Batch count - Number of documents to index as a bulk
 */
 
ESMongoSync.init("mongodb://127.0.0.1:27017/local", "localhost:9200", "mongodb://127.0.0.1:27017/meteor", finalCallBack, watcherArray, 100);

/* 
 * It should be noted that the above option should only be used in extreme cases where ENV_VARs can't be deifned or accessed.
 * It should only be seen as an extreme fall back, so not recommended.
 */

```

All other configurations are as they were in previous versions.


## Extra APIs

#### Reindexing

If you have a cron-job that runs at specific intervals and you need to reindex data from your mongoDB database to ElasticSearch cluster, there is a reIndex function that takes care of fetching the new documents and reindexing in ElasticSearch.
This can also come in handy if there is an ElasticSearch mappings change and there is a need to reindex data. It should be noted that calling reIndex overwrites previously stored data in ElasticSearch cluster. It also doesn't take into consideration the size of documents to reindex and ElasticSearch cluster specs.

```javascript
 
ESMongoSync.reIndex();

```


#### MongoDB and Oplog connection destruction 

If for any reason there is a need to disconnect from MongoDB and MongoDB Oplog, then the `destroy` or `disconnect` functions handle that.

```javascript

// completely destroy both conenctions
ESMongoSync.destroy();

// only disconnect from MongoOplog.
ESMongoSync.disconnect();

```

To resume syncing after mongoDB and Oplog connection has been destroyed or stopped,

```javascript

ESMongoSync.resume();

```

will reconnect to Mongo and Oplog and re-enable real time Mongo to ElasticSearch sync.

## Sample init:

Still confused? Get inspired by this [Sample Setup](lib/examples/SAMPLE.js)



## Contributing

Contributions are **welcome** and will be fully **credited**.

We accept contributions via Pull Requests on [Github](https://github.com/toystars/elasticsearch-sync).


### Pull Requests

- **Document any change in behaviour** - Make sure the `README.md` and any other relevant documentation are kept up-to-date.

- **Consider our release cycle** - We try to follow [SemVer v2.0.0](http://semver.org/). Randomly breaking public APIs is not an option.

- **Create feature branches** - Don't ask us to pull from your master branch.

- **One pull request per feature** - If you want to do more than one thing, send multiple pull requests.

- **Send coherent history** - Make sure each individual commit in your pull request is meaningful. If you had to make multiple intermediate commits while developing, please [squash them](http://www.git-scm.com/book/en/v2/Git-Tools-Rewriting-History#Changing-Multiple-Commit-Messages) before submitting.


## Issues

Check issues for current issues.

## Credits

- [Mustapha Babatunde](https://twitter.com/iAmToystars)
- [Victor Fernandez](https://github.com/victor-fdez)

## License

The MIT License (MIT). Please see [LICENSE](LICENSE.md) for more information.

