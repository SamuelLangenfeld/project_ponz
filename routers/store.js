var express = require('express');
var router = express.Router();
var mongoose = require("mongoose");
var models = require("./../models/");
const User = models.User;
const Item = models.Item;


router.get('/', async(req, res) => {
  let items = await Item.find();
  res.render('store', { user: req.user, items });
})

router.get('/buy/:item', async(req, res) => {
  let user = await User.findById(req.user.id);
  let item = await Item.findById(req.params.item);
  if (item.points > user.points) {
    req.flash('You do not have enough points to buy the item');
    res.redirect('/store')
  } else {
    user.points -= item.points;
    user.items.push({ picture: item.picture, name: item.name });
    await user.save();
    req.flash('Successfully purchased item!');
    req.method = 'GET';
    res.redirect('/');
  }
})

module.exports = router;