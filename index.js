require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const TelegramBot = require("node-telegram-bot-api");
const { UserModel } = require("./models/User.model");
const connection = require("./database/server.js");

const gameName = "ZuraTap";
// const webURL = "https://test.d1zpxmmc54858w.amplifyapp.com";
const webURL = "http://192.168.1.9:3000";

const server = express();
let currentUserId = [];
let currentUser;
server.use(bodyParser.json());
server.use(cookieParser("surja4"));

const bot = new TelegramBot("7439126507:AAFsGlejIE1CMyMWr-qlIbLFvIT9BGp02lA", {
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

function getGameHighScore(userId, options, res) {
  if (!options.message_id && !options.inline_message_id) {
    return res.send("Message ID or Inline Message ID is required.");
  }

  bot
    .getGameHighScores(userId, options)
    .then((highScores) => {
      if (highScores && highScores.length > 0) {
        // If a high score is found, send it back
        res.send(`${highScores[0]?.score}`);
      } else {
        // No high score found for the user, so set an initial high score
        console.log(
          `No high score found for user ${userId}, setting initial high score.`
        );
        // setInitialHighScore(userId, options, res);
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("An error occurred while retrieving the high score");
    });
}

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

server.post("/task", (req, res) => {
  let { points } = req?.headers;

  // bot.setGameScore()
});

bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const referralCode = match[1];
  const newUserId = chatId;

  if (referralCode) {
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
        }
      } else {
        // Create a new user with the referred user data
        const newUser = new UserModel({
          userId: referralCode,
          referred: [referredUserData],
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
  let link = `https://t.me/ZurianBot?start=${userId}`;
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

bot.on("callback_query", function (query) {
  const userId = query?.from?.id;
  currentUser = userId;

  let options = {};

  // Check if the query has a message or inline_message_id and set options accordingly
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
    // If neither message nor inline_message_id is available, log the error
    console.log("Message ID or Inline Message ID is required.");
    return;
  }

  // Now call getGameHighScore with the correct options
  getGameHighScore(userId, options, {
    send: (message) => console.log(`Response: ${message}`), // This will log the response
  });

  if (query.game_short_name !== gameName) {
    bot
      .answerCallbackQuery(query.id, {
        text: "Sorry, '" + query.game_short_name + "' is not available.",
        show_alert: true,
      })
      .catch((err) => {});
  } else {
    queries[query.id] = query;
    const gameurl = `${webURL}?id=${query.id}`;
    bot.answerCallbackQuery(query.id, { url: gameurl }).catch((err) => {});
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

server.post("/highscore/:score", function (req, res, next) {
  if (!Object.hasOwnProperty.call(queries, req.query.id)) {
    return next();
  }

  const realScore = parseInt(req.params.score, 10);

  let query = queries[req.query.id];
  let options;

  if (query.message) {
    options = {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
    };
  } else {
    options = {
      inline_message_id: query.inline_message_id,
      force: true,
    };
  }

  bot
    .setGameScore(query.from.id, realScore, options)
    .then(() => {
      getGameHighScore(query.from.id, options, res);
    })
    .catch((err) => {
      if (
        err.response.body.description === "Bad Request: BOT_SCORE_NOT_MODIFIED"
      ) {
        return res
          .status(204)
          .send("New score is inferior to user's previous one");
      } else {
        return res
          .status(500)
          .send("An error occurred while setting the score");
      }
    });
});

server.get("/getHighScore", function (req, res, next) {
  if (!Object.hasOwnProperty.call(queries, req.query.id)) {
    return next();
  }

  let query = queries[req.query.id];
  let options;

  if (query.message) {
    options = {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
    };
  } else {
    options = {
      inline_message_id: query.inline_message_id,
      force: true,
    };
  }
  getGameHighScore(query.from.id, options, res);
});

server.listen(port, async (req, res) => {
  console.log(currentUserId);
  await connection;
  if (connection) console.log("conneted to the database");
  console.log("server is running");
});
