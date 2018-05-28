var mongoose = require('mongoose');

var AdminPassSchema = new mongoose.Schema({
  pass: { type: String, required: true}
},
{ capped: { size: 1024, max: 1, autoIndexId: true } }
)

var HTML_PagesSchema = new mongoose.Schema({
  content: { type: String, required: true},
  relurl: { type: String, unique : true, required : true, dropDups: true }
}
)

var RecordedResultsSchema= new mongoose.Schema({
  content: { type: String, required: true},
  relurl: { type: String, required : true }
}
)

var MturkAuthSchema = new mongoose.Schema({
  AccessKey: { type: String, required: true},
  Secret: { type: String, required: true},
  iv : { type: String, required: true},
  secretTag : { type: String, required: true},
  acsessTag : { type: String, required: true},
  sandbox : { type: Boolean, required: true}
},
{ capped: { size: 1024, max: 1, autoIndexId: true } }
)

var AssignmentSchema = new mongoose.Schema({
	assignmentId:{ type: String, required: true, unique: true, dropDups: true },  
	hitId: { type: String, required: true},
	turkSubmitTo: { type: String, required: true},
	workerId: { type: String, required: true },
	resultSubmitted: {type: Date, required: false },
	trialInfo: { type: String },
	status: { type: String, required: true, index:true },
	data:{ type: String, required: false }
})

var HITschema= new mongoose.Schema({
  HITid: { type: String, required: true, unique: true, dropDups: true },  
  HITparam: { type: Object, required: true },
}
)

var MturkHITSchema = new mongoose.Schema({
  HITid: { type: String, required: true },  
  HITdata: { type: Object, required: true },
}
)

var WordsSchema = new mongoose.Schema({
  wordId: { type: Number, required: true, unique : true, dropDups: true },  
  word: { type: String, required: true, unique : true, dropDups: true },
}
)

var WorkerDataSchema = new mongoose.Schema({
  workerId: { type: String, required: true, unique : true, dropDups: true },  
  data: { type: String, default: "{}", required: true }, // json paramenters
}
)

function GlobalData(){
  this.data={};
}
 
var AdminPass = mongoose.model('AdminPass', AdminPassSchema);
var MturkAuth = mongoose.model('MturkAuth', MturkAuthSchema);
var HTML_Pages= mongoose.model('HTML_Pages', HTML_PagesSchema);
var MturkHIT= mongoose.model('MturkHIT', MturkHITSchema);
var HIT= mongoose.model('HIT', HITschema);
var Words= mongoose.model('Words', WordsSchema);
var Assignment= mongoose.model('Assignement', AssignmentSchema )
var WorkerData= mongoose.model('WorkerData', WorkerDataSchema )
var RecordedResults= mongoose.model('RecordedResults', RecordedResultsSchema)

var schemas= { 
	AdminPass: AdminPass, 
	MturkAuth:MturkAuth,
	HTML_Pages:HTML_Pages,
	MturkHIT:MturkHIT,
	HIT:HIT,
	Words:Words,
	Assignment: Assignment,
	WorkerData:WorkerData,
	GlobalData: new GlobalData(),
	RecordedResults: RecordedResults
}

module.exports = schemas;
