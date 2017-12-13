let mongoose = require('mongoose');
let env = process.env.NODE_ENV || 'development';

module.exports = () => {
  let localUrl = `mongodb://localhost/ponz`
  return mongoose.connect(localUrl);
};
