const mongoose = require("mongoose");

const referredUserSchema = new mongoose.Schema({
  name: { type: String },
  userName: { type: String },
  userId: { type: Number },
});

const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true }, 
  referred: [referredUserSchema], 
});

const UserModel = mongoose.model("User", userSchema);

module.exports = {
  UserModel,
};
