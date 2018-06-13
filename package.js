Package.describe({
  name: 'toystars:elasticsearch-sync',
  version: '0.1.2',
  // Brief, one-line summary of the package.
  summary: 'ElasticSearch utility wrapper for mongoDB integration and sync',
  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/toystars/elasticsearch-sync',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Npm.depends({
  'mongo-oplog': '1.0.1',
  'elasticsearch': '10.0.1',
  'mongodb': '2.1.16',
  'dot-object': '1.4.1'
});

Package.onUse(function(api) {

  api.versionsFrom('1.2.1');

  api.use([
    'ecmascript',
    'underscore'
  ]);

  api.addFiles([
    'lib/util.js',
    "lib/index.js"
  ], ['server']);


  api.export("ESMongoSync", 'server');
});
