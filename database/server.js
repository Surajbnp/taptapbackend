const mongoose = require("mongoose");
require("dotenv").config();

const connection = mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 20000,
});


mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err);
});

module.export = connection;
