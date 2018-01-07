var mongoose = require('mongoose');

var AdminPassSchema = new mongoose.Schema({
  pass: { type: String, required: true}
},
{ capped: { size: 1024, max: 1, autoIndexId: true } }
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

var AdminPass = mongoose.model('AdminPass', AdminPassSchema);
var MturkAuth = mongoose.model('MturkAuth', MturkAuthSchema);

var schemas= { AdminPass: AdminPass, MturkAuth:MturkAuth }

module.exports = schemas;
