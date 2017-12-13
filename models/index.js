let mongoose = require('mongoose');
let bluebird = require('bluebird');

mongoose.Promise = bluebird;

let models = {};

models.User = require('./user');

module.exports = models;
