let mongoose = require('mongoose');
let bluebird = require('bluebird');

mongoose.Promise = bluebird;

let models = {};

models.User = require('./user');
models.Item = require('./item');

module.exports = models;