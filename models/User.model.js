const mongoose = require("mongoose");

const referredUserSchema = new mongoose.Schema({
  name: { type: String },
  userName: { type: String },
  userId: { type: Number },
});

const userSchema = new mongoose.Schema({
  userName : {type : String},
  userId: { type: Number, required: true, unique: true },
  referred: { type: [referredUserSchema], default: [] },
  maxEnergyVal: { type: Number, default: 500 },
  recoveryVal: { type: Number, default: 1 },
  isDailyLogged: { type: Boolean, default: false },
  tapValue: { type: Number, default: 1 },
  isFollowedTg: { type: Boolean, default: false },
  isFollowedInsta: { type: Boolean, default: false },
  isFollowedTwitter: { type: Boolean, default: false },
  userScore: { type: Number, default: 0 },
  gotInitalReward: { type: Boolean, default: false },
});

const UserModel = mongoose.model("User", userSchema);

module.exports = {
  UserModel,
};
