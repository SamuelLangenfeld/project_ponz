const mongoose = require("mongoose");

const Schema = mongoose.Schema;
const ItemSchema = new Schema({
  name: { type: String, required: true, unique: true },
  points: { type: Number },
  picture: { type: String }
});

const Item = mongoose.model("Item", ItemSchema);

module.exports = Item;