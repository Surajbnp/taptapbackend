const mongoose = require("mongoose");

const referredUserSchema = new mongoose.Schema({
  name: { type: String },
  userName: { type: String },
  userId: { type: Number },
});

const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  referred: [referredUserSchema],
  maxEnergyVal: { type: Number, defaultValue: 500 },
  recoveryVal: { type: Number, defaultValue: 1 },
  isDailyLogged: { type: Boolean, defaultValue: false },
  tapValue: { type: Number, defaultValue: 1 },
  isFollowedTg: { type: Boolean, defaultValue: false },
  isFollowedInsta: { type: Boolean, defaultValue: false },
  isFollowedTwitter: { type: Boolean, defaultValue: false },
});

const UserModel = mongoose.model("User", userSchema);

module.exports = {
  UserModel,
};
