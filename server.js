//  OpenShift sample Node application
var express = require('express'),
    app     = express(),
    morgan  = require('morgan');
var session = require('express-session');
var mongoose = require('mongoose');
var MongoStore = require('connect-mongo')(session);
var sch= require('./schema')
var bodyParser = require('body-parser');
  var mongodb = require('mongodb');
Object.assign=require('object-assign');

app.engine('html', require('ejs').renderFile);
app.use(morgan('combined'))
app.disable('etag');  // remove in production

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
  var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
      mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
      mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
      mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
      mongoPassword = process.env[mongoServiceName + '_PASSWORD']
      mongoUser = process.env[mongoServiceName + '_USER'];

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;

  }
}

const MongoOptions = {
  useMongoClient: true,
  autoIndex: false, // Don't build indexes
  reconnectTries: Number.MAX_VALUE, // Never stop trying to reconnect
  reconnectInterval: 500, // Reconnect every 500ms
  poolSize: 10, // Maintain up to 10 socket connections
  // If not connected, return errors immediately rather than waiting for reconnect
  bufferMaxEntries: 0
};
var db = null,
    dbDetails = new Object(),
    mdb = null;

    mongoose.connect( mongoURL, MongoOptions );
    mdb = mongoose.connection;
    mdb.on('error', console.error.bind(console, 'connection error:'));
    mdb.once('open', function() {
     // we're connected!
      console.log('Connected to mongoose at: %s', mongoURL);
    });
app.use(session({
  secret: 'work hard on MTurk',
  resave: true,
  saveUninitialized: false,
  store: new MongoStore({
    mongooseConnection: mdb
  })
}));

// parse incoming requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var initDb = function(callback) {
  if (mongoURL == null) return;

  if (mongodb == null) return;

  mongodb.connect(mongoURL, function(err, conn) {
    if (err) {
      callback(err);
      return;
    }

    db = conn;
    dbDetails.databaseName = db.databaseName;
    dbDetails.url = mongoURLLabel;
    dbDetails.type = 'MongoDB';

    console.log('Connected to MongoDB at:  %s', mongoURL);
  });
};

app.get('/', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var col = db.collection('counts');
    // Create a document with request IP and current time of request
    col.insert({ip: req.ip, date: Date.now()});
    col.count(function(err, count){
      if (err) {
        console.log('Error running count. Message:\n'+err);
      }
      res.render('index.html', { pageCountMessage : count, dbInfo: dbDetails });
    });
  } else {
    res.render('index.html', { pageCountMessage : null});
  }
});

var admin= require('./admin')
app.use('/admin', admin )
var freeRecall= require('./freeRecall');
app.use( '/freeRecall', freeRecall.router )

app.get('/pagecount', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    db.collection('counts').count(function(err, count ){
      res.send('{ pageCount: ' + count + '}');
    });
  } else {
    res.send('{ pageCount: -1 }');
  }
});

app.get( '/genericPages/*', function( req, res ){
  var qMark= req.url.indexOf("?");
  var relurl;
  if( qMark==-1){
    relurl = req.url.slice(14);
  } else {
	relurl= req.url.slice(14, qMark);
  }
  sch.HTML_Pages.findOne( {relurl:relurl}, function( err, data ){
	if(err){
      console.error(err.stack);
      res.status(500).send('Something bad happened!');	  
      return;
	}  
	if( data == null ){
      res.status(404).send('Page not found.');	  
      return;		
	}
	//console.log(data);
	res.send( data.content );
  })
  //res.send( relurl )
} );

app.post( '/genericResults/*', function( req, res ){
  console.log( req.header('Referer') );
  console.log( req.body );
  sch.RecordedResults.create( {relurl:  req.header('Referer'),  content: JSON.stringify( req.body) },
  function( err, data ){
    if(err){
	  console.log(err);
	}
    res.send( err )
  });
});

// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send('Something bad happened!');
});

initDb(function(err){
  console.log('Error connecting to Mongo. Message:\n'+err);
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app ;
