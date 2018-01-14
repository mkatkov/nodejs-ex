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

var MturkHITSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required : true },
  maxAssigments: { type: Number, required : true },
  lifetime: { type: Number, required: true},
  duration: { type: Number, required: true},
  reward: { type: Number, required: true},
  url:  { type: String, required: true },
  isURLInternal:  { type: Boolean, required: true },
  HITid: { type: String, required: false },
  HITdata: { type: Object, required: false },
}
)
 
var AdminPass = mongoose.model('AdminPass', AdminPassSchema);
var MturkAuth = mongoose.model('MturkAuth', MturkAuthSchema);
var HTML_Pages= mongoose.model('HTML_Pages', HTML_PagesSchema);
var MturkHIT= mongoose.model('MturkHIT', MturkHITSchema);

var schemas= { 
	AdminPass: AdminPass, 
	MturkAuth:MturkAuth,
	HTML_Pages:HTML_Pages,
	MturkHIT:MturkHIT
}

module.exports = schemas;
