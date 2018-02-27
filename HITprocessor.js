var AWS = require('aws-sdk');
var fs = require('fs');
var sch= require('./schema')
const path = require('path');
const endpoint = 'https://mturk-requester-sandbox.us-east-1.amazonaws.com';
const region = 'us-east-1';

module.exports= function (){

  this.withMturk= function( req, next, func ){
    var aval= req.session.adminVals;
        console.log( 'withMturk 1');
  
    if( 'AWSConfig' in aval ){
        console.log( 'withMturk 2');
      AWS.config= aval.AWSConfig;
      this.mturk= new AWS.MTurk({ endpoint: endpoint });
        console.log(this.mturk);
      if( this.mturk == null ){
        var err = new Error('???');
        err.status = 400;      
        return next( err );
      }
        return func( );
    } else {
		        console.log( 'withMturk 3');

      sch.MturkAuth.find( function( err, secret ){
        if (err) {
          return func( err );
        }
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
        aval.AWSConfig= AWS.config;
        this.mturk=new AWS.MTurk({ endpoint: endpoint });	  
        if( this.mturk == null ){
          var err = new Error('???');
          err.status = 400;
          return func(err);
        }
        func( );
        } catch(err){
          return func(err);
        } 
      } )
    }
  };

  this.getStoredHITs= function( next ){
  var th=this;
  sch.MturkHIT.find( {}, function(err, dbData) {
    if(err){
	   return next(err);
	}
	var k, storedHITs= {};
	for( k=0; k< dbData.length; k++ ){
	  storedHITs[dbData[k].HITdata.HITId]= dbData[k].HITdata;
	}
	th. storedHITs= storedHITs;
	return next( null );
  })
};

this.listMturkHITsNextPage= function( data, next, func ){
  var th=this;
  if('NextToken' in data ){
	this.mturk.listHITs( {NextToken:data.NextToken}, 
	  function( err, listData ){
	    if(err){
		  return next(err);
	    }
	    listData.HITs= listData.HITs.concat( data.HITs );
	    //console.log(listData)
	    //console.log(data)
	    return th.listMturkHITsNextPage( listData, next, func );
	  }
	) 
  } else {
	 return func(null,data);
  }
};

this.listMturkHITs= function( req, next, func ){
	console.log( 'listMturkHITs' )
	var th= this;
  this.withMturk( req, next, function( ){
	console.log( 'listMturkHITs 2' )
	console.log(th);
     th.mturk.listHITs( {}, function( err, listData ){
  	console.log( 'listMturkHITs 3' )
	   if(err){
		 return next(err);
	  }
	  th.listMturkHITsNextPage( listData, next, function( err, data ){
	    if(err){
		  return next(err);
	    }
	    var k, listedHITs= {};
	    for( k=0; k< data.HITs.length; k++ ){
	      listedHITs[data.HITs[k].HITId]= data.HITs[k];
	    }
	    th. listedHITs= listedHITs;
  	    //console.log( 'listMturkHITs 4' )
	    //console.log(Object.keys(th.listedHITs ));
	    return th.updateStoredHITs( func );
	  } );
	 });
  } );
};

  this.updateStoredHITs = function ( func ) {
	var th= this;
	if( 'listedHITs' in this ){
	  var lh= this.listedHITs,
	    nn= Object.keys(lh).length;
	  //console.log(Object.keys(lh).length);
	  Object.keys(lh). forEach( function( hit, hi){
		//console.log( hi+" => "+ hit+": "+ lh[hit].HITId );
		  sch.MturkHIT.findOneAndUpdate( { HITid: hit }, { HITdata: lh[hit] }, 
		   { upsert:true },
		   function( err, raw ){
			 nn--;
			 //console.log(err);
			 if(nn==0){
			   console.log('done with updating');
			   func();
			 }
		  } )
	  } )
	}
  }
}
