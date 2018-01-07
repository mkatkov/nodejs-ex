var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var sch= require('./schema')
var crypto = require('crypto');
//var mturk = require('mturk-api');
const uuidv4 = require('uuid/v4');
var ejs = require('ejs');
var blake = require('blakejs')
var AWS = require('aws-sdk');
var region = 'us-east-1';

var endpoint = 'https://mturk-requester-sandbox.us-east-1.amazonaws.com';

/**
 * hash password with sha512.
 * @function
 * @param {string} password - List of required fields.
 * @param {string} salt - Data to be validated.
 */
var sha512 = function(password, salt){
    var hash = crypto.createHmac('sha512', 'Mechanical Tirk Experiments!'); /** Hashing algorithm sha512 */
    hash.update(password);
    var value = hash.digest('hex');
    return value;
};

function encrypt(text, password, iv) {
  var iv1= blake.blake2b( Uint8Array.from(iv), null, 12 );
  var key= blake.blake2b( Uint8Array.from(password) , null, 32 );

  var cipher = crypto.createCipheriv('aes-256-gcm', key, iv1);
  var encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex');
  var tag = cipher.getAuthTag();
  return {
    content: encrypted,
    tag: tag
  };
}

function decrypt(encrypted, password, iv) {
  var iv1= blake.blake2b( Uint8Array.from(iv), null, 12 );
  var key= blake.blake2b( Uint8Array.from(password) , null, 32 );
  var decipher = crypto.createDecipheriv('aes-256-gcm', key, iv1)
  decipher.setAuthTag(encrypted.tag);
  var dec = decipher.update(encrypted.content, 'hex', 'utf8')
  dec += decipher.final('utf8');
  return dec;
}

function adminProcessing( req, res, next, method ){
  if( req.session.user != 'admin' ){
   var err = new Error('Not authorized! Go back!');
          err.status = 400;
          return next(err);
  }
   if ( "adminVals" in req.session ){
      var adminVals= req.session.adminVals;
      //console.log( adminVals );
      if (adminVals.showForm){
        adminVals.showForm= false; 
      } else {
        adminVals.showForm= true; 
      }
   } else {
      // first time in admin
      req.session.adminVals= new Object();
      req.session.adminVals.showForm= true;
      var adminVals= req.session.adminVals;
   }
   
   // connection to mturk
   sch.MturkAuth.find( function( err, secret ){
     if (err) {
        return next(err);
     } 
      if( secret.length==0 ) {
        adminVals.connectionForm= "init";
      } else {
         adminVals.connectionForm= "set";
      }
      res.render('admin/admin.html', req.session.adminVals );
   })
}

function mturkLogin( req, res, next, func ){
  var aval= req.session.adminVals;
  if( 'AWSConfig' in aval ){
    AWS.config= aval.AWSConfig;
    aval.mturk=new AWS.MTurk({ endpoint: endpoint });
    if( aval.mturk == null ){
        var err = new Error('???');
        err.status = 400;
        return next(err);
    }
    func( req, res, next );
  }else{
    sch.MturkAuth.find( function(err, secret ){
      if (err) {
        return next(err);
      }
     // console.log( secret[0] )
      try{
      var aws_access_key_id = decrypt( 
           { content: secret[0].AccessKey, tag: Buffer( secret[0].acsessTag, 'base64') },
           req.body.APIpassword, secret[0].iv );
      var aws_secret_access_key = decrypt( 
           { content: secret[0].Secret, tag: Buffer( secret[0].secretTag, 'base64') },
           req.body.APIpassword, secret[0].iv );

      AWS.config = {
      "accessKeyId": aws_access_key_id,
      "secretAccessKey": aws_secret_access_key,
      "region": region,
      "sslEnabled": 'true'
           };
      //console.log( AWS.config )
      aval.AWSConfig= AWS.config;
      aval.mturk=new AWS.MTurk({ endpoint: endpoint });
      if( aval.mturk == null ){
        var err = new Error('???');
        err.status = 400;
        return next(err);
      }
      func( req, res, next );
      } catch(err){
        return next(err);
      } 
    } )
  }
}

router.post( "/action/mturk",  function (req, res, next ) { 
  if( req.session.user != 'admin' ){
   var err = new Error('Not authorized! Go back!');
          err.status = 400;
          return next(err);
  }
  if( "action" in req.body ){
    mturkLogin( req, res, next, function ( req, res, next ){
      var aval= req.session.adminVals;
      //console.log( aval )
      if( 'body' in req ){
        switch(req.body.action){
        case "getBalance" :
            aval.mturk.getAccountBalance(function(err, data){
             // console.log(data.AvailableBalance);
              //console.log(data);
       if (err) {
        return next(err);
      }
             
              res.send( data.AvailableBalance )
            });  
          break;
        }
      } else {
        var err = new Error('???');
        err.status = 400;
        return next(err);    
      }
    } )
  }
})

router.post( "/action/resetAPIKey",  function (req, res, next ) { 
  if( req.session.user != 'admin' ){
   var err = new Error('Not authorized! Go back!');
          err.status = 400;
          return next(err);
  }
  res.sendFile( "views/admin/MturkConnectionForm.partial.html", { root : __dirname} );
})

router.post( "/action/setAPIKey",  function (req, res, next ) { 
  if( req.session.user != 'admin' ){
   var err = new Error('Not authorized! Go back!');
          err.status = 400;
          return next(err);
  }
  var iv= uuidv4();
  var encryptedSecret= encrypt( req.body.secret, req.body.pass, iv );
  var secretTag = encryptedSecret.tag.toString('base64');
  //console.log( encryptedSecret );
 // console.log( secretTag );
  //console.log( Buffer(secretTag, 'base64') )
  var encryptedKey= encrypt( req.body.key, req.body.pass, iv );
  var keyTag = encryptedKey.tag.toString('base64');

  sch.MturkAuth.create(  {  
    AccessKey: encryptedKey.content,
    Secret: encryptedSecret.content,
    iv : iv,
    secretTag : secretTag,
    acsessTag : keyTag,
    sandbox : true
}  )

  //console.log( decrypt( encryptedSecret, req.body.pass, iv ) );
 // console.log( req.body );
  res.send('');
})

router.post( '/partial/MturkConnectionFormContent', function (req, res, next ) { 
  if( req.session.user != 'admin' ){
   var err = new Error('Not authorized! Go back!');
          err.status = 400;
          return next(err);
  }
   // console.log( req.body );
   sch.MturkAuth.find( function( err, secret ){
     if (err) {
        return next(err);
     } 
      if( secret.length==0 ) {
        res.sendFile( "views/admin/MturkConnectionForm.partial.html", { root : __dirname} );
      } else {
        res.send( '' );
      }
   })

})

router.post( '/xmltest', function (req, res, next ) { 
 // console.log( req.body );
  res.send( req.body );
} )

router.get('/', function (req, res, next ) {
  var db= mongoose.connection;
  sch.AdminPass.find( function( err, pass ){
       if (err) {
        return next(err);
      }   
      if( pass.length == 0 ){
       res.render('admin/newPass.html', {});
       //this is fresh run, setup passsword
     } else {
       // the password already set, authenticate
       if( req.session.user == 'admin' ){
         // here is the real logic
       //  console.log('logged as admin');
         adminProcessing( req, res, next, "GET" );
       } else {
         // show login page
         res.render('admin/login.html', {});
       }
     }     
    })
})

router.post('/', function (req, res, next ) {
  var db= mongoose.connection;
  sch.AdminPass.find( function( err, pass ){
      if (err) {
        return next(err);
      }     
     if( pass.length == 0 ){
       //this is fresh run, setup passsword       
       sch.AdminPass.create( { pass: sha512( req.body.password) } )
       res.render('admin/newPassSet.html', {});
     } else {
       if( req.session.user == 'admin' ){
         // authenticated process form submissions
         adminProcessing( req, res, next, "POST" );
       }else{
         // the password already set, authenticate
       if( pass[0].pass == sha512( req.body.password) ){
         req.session.user= 'admin';
         return res.redirect('/admin');
       } else {
           res.render('admin/wrongPass.html', {});
       }
       }
     }     
    })
})

// GET for logout logout
router.get('/logout', function (req, res, next) {
  if (req.session) {
    // delete session object
    req.session.destroy(function (err) {
      if (err) {
        return next(err);
      } else {
        return res.redirect('/');
      }
    });
  }
});

module.exports = router;
