var express = require('express');
var router = express.Router();
var sch= require('./schema');
var AWS = require('aws-sdk');

function saveWord( k, cw ){
	
		sch.Words.findOne( {wordId: k}, function( err, word ){
		  if(err){
			  return next(err)
			}
			if( word == null ){
			  sch.Words.create( {wordId:k, word:cw}, function( err, data ){
			    console.log( cw, data )
				  
		     } )
			} else if( cw!= word )
			  return next(err)
	    } )
}

function admin_post(req, res, next ){
  switch( req.url.slice(12) ){
	case 'saveWords':
	  var words= req.body.words.split(/[\r\n]+/)
	  var k;
	  for( k=0; k< words.length; k++ ){
		//check and create word
		var cw= words[k].slice(1, -1);
		saveWord(k, cw);
	  }
	  res.send(words)
	 break;
	default:
      res.send({url:req.url.slice(12)})	
	 break;
  }
}

function admin_get(req, res, next ){
  switch( req.url.slice(12) ){
	case 'loadWords':
	  break;
	case '':
	    res.render( 'admin/freeRecall/main.html', {});
	  break;
	default:	
	  res.send({url:req.url.slice(12)})
      break;
  }
}

function sendRandomWords( req, res, n ){
  var k, k1, wid=[];
  for(k=0; k< n; k++){
	wid[k] = Math.floor(Math.random()*(1638-k) )
	for(k1=0; k1<k; k1++){
	  if( wid[k] >= wid[k1] ){
		wid[k]++;
	  }
	}
  }
  sch.Words.find( {wordId:{ $in: wid } }, function(err, data){
   if(err){
	   console.log(err);
	   res.send( {} );
	   return;
   }
   var words=[];
   for( wd in data ){
     words.push( data[wd].word );
    }
    res.send(words)
   } )
}

router.get( '/*', function(req, res ){
  switch( req.url.slice(1) ){
	case "random_trial_data":
	  sendRandomWords( req, res, 16 )
	  break;
	case "random_trial":
	    res.render( 'admin/freeRecall/exp.html', {});
	  break;
	default:
	  if( ( req.url.indexOf( "random_trial_data/" ) ==1  ) ){
		var n= parseInt(req.url.slice(19));
		if( isNaN(n) ){
		  res.send({})
		} else {
		  sendRandomWords( req, res, n )
		}
	  } 
	  else if( req.url.indexOf( "random_trial/" ) ==1  ){
		var prm= {numWords:'/16', wordTime:2000, responseTime: 120000, trialNum:-1 };
		console.log( 'rnadom_trial/...' )
		// also record the assignement if it is from amazon
		if( 'assignmentId' in req.query ){
	     if( req.query['assignmentId'] == 'ASSIGNMENT_ID_NOT_AVAILABLE' ){
			 /**************************************
			  * 
			  * Preview mode
			  * 
			  ****************************************/
	       console.log( 'preview' )
		   prm['preview']=true;
	       // we may want to show additional information to the user - trials done today
	       if( 'workerId' in req.query ){
			 sch.WorkerData.find( { workerId:req.query[ 'workerId' ] }, function(err, data){
			   if( data.length == 0 ){
				  // this is new user
				  console.log( 'creating worker ', { workerId:req.query[ 'workerId' ] } )
				  sch.WorkerData.create( { workerId:req.query[ 'workerId' ] }, 
				   (err, data ) => { 
					   console.log( 'user creation: ', err, data );
					   // TODO:
					   // can_do_today qualification automatically
					   } )
				  // that means this is qualification trial
				  // we need to run qualification experiment
				  prm['qualification']= true
				  //prm['numWords']= 4
				  prm['responseTime']= 60000
			   } else {
				   // this is a returning user
				   // he/she probably have qualification - we need to test it
				  console.log(data[0])
				  jData= JSON.parse( data[0].data );
				  if ( ( 'qualification' in jData ) && ('score' in jData['qualification']) ){
				    prm['qualification']= false // we should check
				  } else {
					prm['qualification']= true  
				  }
			   }
	           res.render( 'admin/freeRecall/exp.html', {prm:prm} );
			 } )
	       } else {
			 // something is wrong
			 console.log('no workerId in assignement request')   
	         res.render( 'admin/freeRecall/exp.html', {prm:prm} );
			}
	     } else {
			 /**************************************
			  * 
			  * real assignement
			  * 
			  ****************************************/
	       console.log( 'real assigmenent' )
	       if( 'workerId' in req.query ){
			 prm['preview']= false;
			 sch.WorkerData.findOne( { workerId:req.query[ 'workerId' ] }, function(err, data){
			   console.log(err);
			   if( data ){
				   // this is a returning user
				  jData= JSON.parse( data.data );
				  if ( ( 'qualification' in jData ) ){
				    prm['qualification']= false 
				    prm['numWords']= '/16';
				    prm['responseTime']= 140000;
				    // we should check also if performed less than all trials a day
				    // this is done through qualification Run Today
				  } else {
					prm['qualification']= true;  
				    prm['numWords']= '/4';
				    prm['responseTime']= 20000;
				  }
			   } else {
				  // this is new user - that means no preview - jumped ahead- qualification trial
				  sch.WorkerData.create( { workerId:req.query[ 'workerId' ] }, 
				   (err, data ) => { 
					   console.log( 'user creation: ', err, data );
					   // TODO:
					   // can_do_today qualification automatically
					   } )
				  prm['qualification']= true
				  prm['numWords']= '/4';
				  prm['responseTime']= 60000;
			   }
			   // we want to create record with an assignement that later will be updated
			   sch.Assignment.findOne( {assignmentId: req.query['assignmentId']}, 
			     (err, data ) => { 
				  if( data ){
					data.update( {
				      hitId: req.query['hitId'],
				      turkSubmitTo: req.query['turkSubmitTo'],
				      workerId: req.query['workerId'], 
				      trialInfo: JSON.stringify( prm ),
				      status: "init" }, (err, data ) => { 
				        console.log( 'assignement updated: ', err )
				        res.render( 'admin/freeRecall/exp.html', {prm:prm} );
				      }); 
			      } else {  
					sch.Assignment.create( {
				      assignmentId: req.query['assignmentId'],
				      hitId: req.query['hitId'],
				      turkSubmitTo: req.query['turkSubmitTo'],
				      workerId: req.query['workerId'], 
				      trialInfo: JSON.stringify( prm ),
				      status: "init" }, (err, data ) => { 
				        console.log( 'assignement creation: ', err )
				        res.render( 'admin/freeRecall/exp.html', {prm:prm} );
				      });
				  }
				  
		       });
			 } )
	       } else {
			 console.log('no workerId in assignement request', prm )   
	         res.render( 'admin/freeRecall/exp.html', {prm:prm} );
			}
	     }
		} else {
			 /**************************************
			  * 
			  * not amazon
			  * we should probably create random workerId and track it
			  * recording results
			  * 
			  ****************************************/
		   // this is not from amazon, we still want to process it, show random trial
	       console.log( 'not amazon' )
	       // TODO:
	       // send reference to amazon site
		   prm['preview']= false;
		   prm['qualification']= false // from the data
	       res.render( 'admin/freeRecall/exp.html', {prm:prm} );
		}
	  } else{
	    sch.Words.findOne( {wordId: req.url.slice(1)}, function( err, word ){
		  res.send( word )
	      });
        }
	break;
  }
})

var testQuestion="<ExternalQuestion xmlns=\"http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2006-07-14/ExternalQuestion.xsd\">\
  <ExternalURL>https://exp-mturk.1d35.starter-us-east-1.openshiftapps.com/freeRecall/random_trial/</ExternalURL>\
  <FrameHeight>400</FrameHeight>\
</ExternalQuestion>";

var testHIT = {
        Title: 'Free recall experiment',
        Description: 'This is free recall experiment. You need to request "Run Today" qualification, which is automatically granted',
        MaxAssignments: 1,
        LifetimeInSeconds: 3600,
        AssignmentDurationInSeconds: 600,
        Reward: '0.07',
        Question: testQuestion,

        // Add a qualification requirement that the Worker must be either in Canada or the US 
        QualificationRequirements: [
            {
                QualificationTypeId: '00000000000000000071',
                Comparator: 'In',
                LocaleValues: [
                    { Country: 'US' },
                    { Country: 'CA' },
                    { Country: 'IL' },
                ],
            },
            {
				QualificationTypeId: '3ISNM39IK7QVTOB2KIEB03RTH4E0SZ',
				Comparator: 'LessThanOrEqualTo',
				IntegerValues: [10],
				RequiredToPreview: true
			},
			{
				QualificationTypeId: '3WZ6PU0JYUIA21NG42RS71S738CLKC',
				Comparator: 'LessThanOrEqualTo',
				IntegerValues: [16],
				RequiredToPreview: false
			}
        ],
    };

router.post( '/*', function(req, res ){
  switch( req.url.slice(1) ){
	case "random_trial_data":
	  var k, wid=[];
	  for(k=0; k< 16; k++){
		wid[k] = Math.floor(Math.random()*1638)
	  }
	  sch.Words.find( {wordId:{ $in: wid } }, function(err, data){
		var words=[];
		for( wd in data ){
		  words.push( data[wd].word );
		}
		res.send(words)
	  } )
	  break;
	 case "results" :
	   // we need to discriminate between qualification trial and real trial.
	   // if this is qualification trial we need to grant qualification
	   // technically that means that admin browser need to poll qualifications
	   // or we need an admin daemon
	   console.log(req.body)
	   if( 'local' in req.body ){
		 console.log( 'local in body' )
		 var local = req.body['local'];
		 if( 'prm' in local ){
		   console.log( 'prm in local' )
		   if( 'assignmentId' in req.body['local']['prm'] ){
			 assignmentId= local['prm']['assignmentId'];
			 console.log( 'assignementId: ', assignmentId )
			 sch.Assignment.findOne( {assignmentId: assignmentId}, 
			     (err, data ) => { 
				console.log( 'err: ', err, ' data: ', data )
				if(data){
				  // now we have real assignement
				  // update it with result
				  console.log('assignement found in db')
				  var prm= JSON.parse( data.trialInfo );
				  prm.results= req.body;
				  data.update( { trialInfo: JSON.stringify( prm ), status:'completed' }, 
				  ( err, data1 ) => {
				  // check if this is qualification
				  console.log( 'assignement updated ', err, ' data1: ', data1 )
				  console.log( 'prm:', prm )
				  if( prm[ 'qualification' ] ){
				    console.log( "prm['qualification']: ok" )
				    // if qualification:
				    var timeDiff= 100000;
				    var presMap={}, k, n_correct_words=0, recTime;
				    if( ('presentedWords' in local) && ( 'words' in req.body ) ){
				      console.log( 'checking words' )
					  for(k=0;k< req.body['words'].length; k++){
						var curWord= req.body['words'][k][0].toUpperCase();
						console.log( curWord, "<=>", local[ 'presentedWords' ], local[ 'presentedWords' ]. indexOf( curWord )  )
						if( local[ 'presentedWords' ].indexOf(curWord) >=0  ){
						  n_correct_words++;
						  if(n_correct_words==2){
							timeDiff= Date.parse( req.body['words'][k][1] )- Date.parse( local['startRecall'] );
							break;
						  }
						}
					  }
				      console.log( 'checking words: timeDiff', timeDiff  )
				    // update worker record,
				      sch.WorkerData.findOne( { workerId:local['prm']['workerId'] }, 
				      (err,wdata) => {
						console.log( 'found worker ', err, ' data ', wdata )
						if(wdata){
							var wd= JSON.parse( wdata.data );
							if( 'qualification' in wd ){}
							else{
							  wd['qualification']= Math.floor(timeDiff/1000);
							  wd['trialNum']= 1;
							  wd['lastTrialTime']= Date.now()
							  wdata.update( {data: JSON.stringify( wd ) }, ( err, data2) => {
								if (err) console.log(err, err.stack); // an error occurred
								else {
								  console.log( 'worker data updated ', data);           // successful response
							    }
							  } );
							  // grant worker typing speed qualification
							  AWS.config= sch.GlobalData.AWSConfig;
							  //console.log(  AWS.config )
							  //console.log(  sch.GlobalData.AWSendpoint )
							  var mturk=new AWS.MTurk({ endpoint: sch.GlobalData.AWSendpoint });
							  var params = {
								QualificationTypeId: '3ISNM39IK7QVTOB2KIEB03RTH4E0SZ', /* required */
								WorkerId: local['prm']['workerId'], /* required */
								IntegerValue: wd['qualification'],
								SendNotification: false
							  };
							  mturk.associateQualificationWithWorker(params, function(err, data) {
								if (err) console.log(err, err.stack); // an error occurred
								else {
								  console.log(data);           // successful response
								  // TODO:
								  // make control of qualification from admin page
								  maxQual= 10;
								  if( wd['qualification'] <= maxQual ){
								    // submit another hit for worker if qualification is good
									// TODO:
									// control this from admin page
									mturk.createHIT( testHIT, function(err, data) {
									  if (err) console.log(err, err.stack); // an error occurred
									  else {
										      console.log(data);           // successful response
								  // send an explanation what to do next
										      res.send('You can run <br>experiment now')
										  }
									});
								  } else {
									res.send('unfortunaltely your typing speed is too slow, so we would not be able to make meaningfull conclusions from your data' )
								  }
								}
							  });
							}
						} else {
							// TODO:
							// somehow unexpected new worker - need to handle
						}
					  } );
					}
				  } else {
				  // if a trial
				  var workerId= data.workerId;
				  // update worker record
				  sch.WorkerData.findOne( { workerId: workerId }, (err,wdata) => {
					console.log( 'found worker ', err, ' data ', wdata )
					if( wdata ){
					  var wd= JSON.parse( wdata.data );
					  wd['trialNum'] ++;
					  wd['lastTrialTime']= Date.now();
					    wdata.update( {data: JSON.stringify( wd ) }, ( err, data2) => {
						  if (err) console.log(err, err.stack); // an error occurred
						  else {
							console.log( 'worker data updated ', data);           // successful response
					        if( wd['trialNum'] >16  ){
					          res.send( 'Please come tomorrow' );
							} else {
							  // create new HIT
							  AWS.config= sch.GlobalData.AWSConfig;
							  //console.log(  AWS.config )
							  //console.log(  sch.GlobalData.AWSendpoint )
							  var mturk=new AWS.MTurk({ endpoint: sch.GlobalData.AWSendpoint });
							  // update numTodayTrials qualification
							  var params = {
								QualificationTypeId: '3WZ6PU0JYUIA21NG42RS71S738CLKC', /* required */
								WorkerId: workerId, /* required */
								IntegerValue: wd['trialNum'],
								SendNotification: false
							  };
							  mturk.associateQualificationWithWorker(params, function(err, data) {
								if (err) console.log(err, err.stack); // an error occurred
								else {
								  console.log(data);           // successful response
								  mturk.createHIT( testHIT, function(err, data) {
								    if (err) console.log(err, err.stack); // an error occurred
								    else {
									  console.log(data);           // successful response
									  // send an explanation what to do next
									  res.send('You can run <br>experiment now')
								    }
								  });
								}
							  });
							}
						  }
					    });
					  //TODO:
					  // check the date for last trial if difference more that 16 hours reset
					}
				  });
				  // submit another hit if less than an hour working
				  // send an explanation
				  }
				  });
				}
			 });
		   }
		 }
	   }
	   // console.log( sch.GlobalData.AWSConfig )
	   // res.send('{}') // empty for now
	  break;
	default:
	  if( ( req.url.indexOf( "random_trial_data/" ) ==1  ) ){
		var n= parseInt(req.url.slice(19));
		if( isNaN(n) ){
		  res.send({})
		} else {
		  sendRandomWords( req, res, n )
		}
	  } 
	  else{
		sch.Words.findOne( {wordId: req.url.slice(1)}, function( err, word ){
		   res.send( word )
	    })
	  }
	break;
  }
})

module.exports = { router:router,
	admin_post: admin_post,
	admin_get: admin_get};
