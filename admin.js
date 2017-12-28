var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var sch= require('./schema')
var crypto = require('crypto');

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

router.get('/', function (req, res, next ) {
  var db= mongoose.connection;
  sch.AdminPass.find( function( err, pass ){
       if (err) {
        return next(err);
      }    if( pass.length == 0 ){
       res.render('admin/newPass.html', {});
       //this is fresh run, setup passsword
     } else {
       // the password already set, authenticate
       if( req.session.user == 'admin' ){
         // here is the real logic
         console.log('logged as admin')
         res.send('admin odnako');
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
       // the password already set, authenticate
       console.log( 'POST: ', pass, sha512( req.body.password) )
       console.log( pass[0].pass )
       if( pass[0].pass == sha512( req.body.password) ){
         req.session.user= 'admin';
         return res.redirect('/admin');
       } else {
           res.render('admin/wrongPass.html', {});
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
