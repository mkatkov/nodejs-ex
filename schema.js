var mongoose = require('mongoose');

var AdminPassSchema = new mongoose.Schema({
  pass: { type: String, required: true}
},
{ capped: { size: 1024, max: 1, autoIndexId: true } }
)

var AdminPass = mongoose.model('AdminPass', AdminPassSchema);

var schemas= { AdminPass: AdminPass }

module.exports = schemas;
