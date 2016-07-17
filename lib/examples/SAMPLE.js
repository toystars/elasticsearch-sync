/*
* SAMPLE.js
*
* This is to illustrate the basic use of elasticsearch-sync meteor package,
* this assumes the package has been added to the meteor app successfully.
*
* This does not cover elastic search cluster set-up and assumes the cluster is up and running,
* and that index and types are set up correctly with the correct mappings
* */


/*
* Let's say we have a database with 3 collections: users, posts and comments.
* And we want to have all the collections indexed in elasticsearch. Watchers can be created as below
* */


/*
* define transform functions for each watcher. Takes 3 parameters:
* watcher, document and callBack.
*
* callBack is to be invoked after document transformation with the new document as the parameter



let transformUser = (watcher, user, callBack) => {
  user.fullName = user.firstName + ' ' + user.lastName; // object has been transformed
  callBack(user); // callBack called with transformed object
};

let transformPost = (watcher, post, callBack) => {
  post.savedDate = new Date();
  callBack(post); // callBack called with transformed object
};

let transformComment = (watcher, comment, callBack) => {
  comment.author = 'Mustapha Babatunde Oluwaleke';
  callBack(comment); // callBack called with transformed object
};

let watchers = [];

// define watchers
let usersWatcher = {
  collectionName: 'users',
  index: 'person', // elastic search index
  type: 'users', // elastic search type
  transformFunction: transformUser, // can be null if no transformation is needed to be done
  fetchExistingDocuments: true, // this will fetch all existing document in collection and index in elastic search
  priority: 0 // defines order of watcher processing. Watchers with low priorities get processed ahead of those with high priorities
};
let postsWatcher = {
  collectionName: 'posts',
  index: 'post',
  type: 'posts',
  transformFunction: transformPost,
  fetchExistingDocuments: true,
  priority: 0
};
let commentsWatcher = {
  collectionName: 'posts',
  index: 'post',
  type: 'posts',
  transformFunction: transformComment,
  fetchExistingDocuments: true,
  priority: 0
};

// push watchers into array
watchers.push(usersWatcher, postsWatcher, commentsWatcher);



 let finalCallBack = () => {
      console.log(Syncing setup successful...);
 };


* Call the init method of the package as below and you are done. Parameters are as follows. No ENV_VARs (not recommended)
* 1. Mongo OPLOG URL - MongoDB replica-set local URL,
* 2. ElasticSearch URL - ElasticSearch cluster URL,
* 3. Mongo Data URL - MongoDB data URL,
* 4. Function to call after package init (can be null),
* 5. Watchers,
* 6. BatchCount - Number of documents to index for each bulk elastic search indexing (Should be set according to elastic search cluster capability)
*
* Note: All parameters are to be supplied in the specified order.
*
 ESMongoSync.init("mongodb://127.0.0.1:27017/local", "localhost:9200", "mongodb://127.0.0.1:27017/meteor", finalCallBack, watchers, 500);



/*
* Using process vars
* export MONGO_OPLOG_URL="mongodb://localhost:27017/local"
* export DATA_MONGO_URL="mongodb://127.0.0.1:27017/meteor"
* export SEARCH_ELASTIC_URL="localhost:9200"
*
ESMongoSync.init(null, null, null, finalCallBack, watchers, 500);





* That's all! Now whatever CRUD operation that occur in the MongoDB database collection that are specified in the watchers will be synchronized
 * with the specified elastic search cluster in real time. You don't have to worry about your elastic search documents getting stale over time as all
 * CRUD operations are handled seamlessly.
*
* */
