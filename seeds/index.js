const mongoose = require('mongoose');
const mongooseeder = require('mongooseeder');
const models = require('../models/');
const User = require('../models/user.js');
var faker = require('faker');
const bcrypt = require('bcrypt');
const mongodbUrl = 'mongodb://localhost/ponz';

mongooseeder.seed({
  mongodbUrl: mongodbUrl,
  clean: true,
  models: models,
  mongoose: mongoose,
  seeds: () => {
    const users = [];

    for (let i = 0; i < 10; i++) {
      let username = faker.internet.userName();
      console.log(username);
      const user = new User({
        username: username,
        passwordHash: bcrypt.hashSync(username, 8),
        points: 0,
        parent: null,
        children: [],
      });
      users.push(User.create(user));
    }
    return Promise.all(users);
  },
});
