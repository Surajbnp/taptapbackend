require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const TelegramBot = require("node-telegram-bot-api");
const { UserModel } = require("./models/User.model");
const connection = require("./database/server.js");
const cors = require("cors");

const gameName = "pomemetap";
// const webURL = "http://172.20.10.2:3000";
const webURL = `https://test.d1zpxmmc54858w.amplifyapp.com`;
const channelId = "@teampomeme";

const server = express();
server.use(cors());
let currentUserId = [];
let currentUser;
server.use(bodyParser.json());
server.use(cookieParser("surja4"));

const bot = new TelegramBot("7626606090:AAHvWwlTY_T7OMKY4heIGn2eRG9zKwK9-BQ", {
  polling: {
    interval: 1000,
    autoStart: true,
    params: {
      timeout: 10,
    },
  },
});

const port = process.env.PORT || 8080;
const queries = {};

bot.onText(/\/help/, (msg) =>
  bot.sendMessage(
    msg.from.id,
    "This bot implements a simple game. Say /game if you want to play."
  )
);

bot.onText(/\/referrals/, (msg) => {
  const userId = msg.from.id;
  const referralLink = `https://t.me/ZurianBot?start=${userId}`;

  bot.sendMessage(userId, `Share this link with your friends: ${referralLink}`);
});

bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const referralCode = match[1];
  const newUserId = chatId;

  if (referralCode) {
    if (String(referralCode) === String(newUserId)) {
      bot.sendMessage(chatId, "You cannot refer yourself.");
      return;
    }

    bot.sendMessage(
      chatId,
      `Thanks for joining via referral code: ${referralCode}`
    );

    try {
      const chatMember = await bot.getChatMember(chatId, newUserId);
      const username = chatMember.user.username;
      const firstName = chatMember.user.first_name;
      const lastName = chatMember.user.last_name;

      const referredUserData = {
        name: firstName,
        userName: username,
        userId: newUserId,
      };

      console.log(
        `Username: ${username}, First Name: ${firstName}, Last Name: ${lastName}`
      );

      const user = await UserModel.findOne({ userId: referralCode });

      if (user) {
        const isReferred = user.referred.some(
          (referral) => Number(referral.userId) === Number(newUserId)
        );

        if (isReferred) {
          console.log("This referred user data already exists.");
        } else {
          await UserModel.updateOne(
            { userId: referralCode },
            { $push: { referred: referredUserData } }
          );
          console.log("Referred user added successfully.");

          let currentScore = user?.userScore;
          let updatedScore = currentScore + 20000;
          await UserModel.findOneAndUpdate(
            { userId: referralCode },
            { userScore: updatedScore }
          );
        }
      } else {
        const newUser = new UserModel({
          userId: referralCode,
          referred: [referredUserData],
          maxEnergyVal: 500,
          recoveryVal: 1,
          isDailyLogged: false,
          tapValue: 1,
          isFollowedTg: false,
          isFollowedInsta: false,
          isFollowedTwitter: false,
        });
        await newUser.save();
        console.log("New user created and referred data added.");
      }
    } catch (error) {
      console.error("Error handling referred user:", error);
    }
  } else {
    bot.sendMessage(chatId, "Welcome to the bot!");
  }
});

bot.on("polling_error", (error) => {
  console.log("Polling error:", error);
});

bot.onText(/\/start|\/game/, (msg) => {
  bot.sendGame(msg.from.id, gameName);
  console.log("inside bot", msg.userId);
});

server.get("/referrallink", (req, res) => {
  let userId = currentUser;
  let link = `https://t.me/pomeme_bot?start=${userId}`;
  res.send(link);
});

server.get("/referrals", async (req, res) => {
  try {
    let data = await UserModel.findOne({ userId: req?.headers?.userid });
    res.send(data?.referred);
  } catch (err) {
    res.send(err);
  }
});

bot.on("callback_query", async function (query) {
  const userId = query?.from?.id;
  currentUser = userId;
  let options = {};

  try {
    // Check if the user already exists
    let user = await UserModel.findOne({ userId });
    if (!user) {
      user = new UserModel({
        userId,
        userName: query.from.username,
        isDailyLogged: false,
        isFollowedTg: false,
        isFollowedInsta: false,
        isFollowedTwitter: false,
        userScore: 0,
      });

      await user.save();
    }

    if (query.message) {
      options = {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
      };
    } else if (query.inline_message_id) {
      options = {
        inline_message_id: query.inline_message_id,
      };
    } else {
      console.log("Message ID or Inline Message ID is required.");
      return;
    }

    if (query.game_short_name !== gameName) {
      await bot.answerCallbackQuery(query.id, {
        text: `Sorry, '${query.game_short_name}' is not available.`,
        show_alert: true,
      });
    } else {
      queries[query.id] = query;
      const gameurl = `${webURL}?id=${query.id}`;
      await bot.answerCallbackQuery(query.id, { url: gameurl });
    }
  } catch (err) {
    console.error("Error handling callback query:", err);
  }
});

bot.on("inline_query", function (iq) {
  bot
    .answerInlineQuery(iq.id, [
      { type: "game", id: "0", game_short_name: gameName },
    ])
    .catch((err) => {});
});

// server.use(express.static(path.join(__dirname, "public")));

server.get("/", (req, res) => {
  res.send("Homepage");
});

server.post("/highscore/:score", async (req, res) => {
  let userId = currentUser;
  const realScore = parseInt(req.params.score, 10);
  try {
    let data = await UserModel.findOneAndUpdate(
      { userId: userId },
      { userScore: realScore }
    );

    res.status(200).send({ msg: "score updated!", data: data });
  } catch (err) {
    res.status(400).send({ msg: "something went wrong!", err });
  }
});

server.get("/user", async (req, res) => {
  let { id } = req?.query;
  try {
    let data = await UserModel.findOne({ userId: id });
    res.send(data);
  } catch {
    res.send("something went wrong");
  }
});

server.post("/completetask", async (req, res) => {
  const data = req.body;
  try {
    let response = await UserModel.findOneAndUpdate(
      { userId: currentUser },
      data,
      { new: true }
    );
    if (response) {
      res.send("task completed!");
    } else {
      res.status(404).send("User not found!");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong!");
  }
});

server.get("/getHighScore", async function (req, res) {
  let { id } = req?.query;
  console.log(req.query, "from id");
  try {
    let score = await UserModel.findOne({ userId: id });
    res.status(200).send({ msg: "score fetched!", score });
  } catch (err) {
    res.status(400).send({ msg: "something went wrong!", error: err });
  }
});

// checking member or not

server.get("/checkmember", async (req, res) => {
  const userId = currentUser;

  if (!userId) {
    return res.status(400).send("User ID is required");
  }

  try {
    const chatMember = await bot.getChatMember(channelId, userId);

    if (
      chatMember.status === "member" ||
      chatMember.status === "administrator" ||
      chatMember.status === "creator"
    ) {
      res.status(200).send(chatMember);
    } else {
      res.status(403).send("User has not joined the channel");
    }
  } catch (error) {
    console.error("Error checking channel join status:", error);
    res.status(500).send("An error occurred while checking channel status");
  }
});

server.listen(port, async () => {
  try {
    await connection;
    if (connection) {
      console.log("Connected to the database");
    } else {
      console.error("Failed to connect to the database");
    }
  } catch (error) {
    console.error("Database connection error:", error);
  }

  console.log(`Server is running on port ${port}`);
});
