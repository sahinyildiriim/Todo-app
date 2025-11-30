const mongoose = require("mongoose");

const TodoSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  text: { type: String, required: true },
  completed: { type: Boolean, default: false },
});

module.exports = mongoose.model("Todo", TodoSchema);
