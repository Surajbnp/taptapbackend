require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const TelegramBot = require("node-telegram-bot-api");
const { UserModel } = require("./models/User.model");
const connection = require("./database/server.js");
const cors = require("cors");
const axios = require("axios");

const gameName = "pomemetap";
// const webURL = "http://192.168.1.3:3000";
const webURL = `https://test.d1zpxmmc54858w.amplifyapp.com`;
const channelId = "@teampomeme";
const BOT_TOKEN = "7626606090:AAHvWwlTY_T7OMKY4heIGn2eRG9zKwK9-BQ";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

const server = express();
server.use(cors());
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

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  try {
    if (msg.reply_to_message?.message_id) {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: chatId,
          message_id: msg.reply_to_message.message_id,
        }
      );
    }

    await bot.sendPhoto(
      chatId,
      "https://pomeme.s3.ap-south-1.amazonaws.com/Poop_coin.png",
      {
        caption:
          "🎮 **Pomeme Tap Game**\n\n💡 Tap to test your speed and set new high scores!",
        parse_mode: "Markdown",
      }
    );

    await bot.sendMessage(chatId, "Click the button below to start the game:", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Launch Game 🕹️",
              web_app: {
                url: webURL,
              },
            },
          ],
          [
            {
              text: "Follow Community 📡",
              url: "https://t.me/pomeme_sol/1",
            },
            {
              text: "Follow X 🚀",
              url: "https://x.com/Zuraverse",
            },
          ],
        ],
      },
    });
  } catch (error) {
    console.error("Error handling message:", error);
  }
});

bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const referralCode = match[1];
  const newUserId = String(chatId);
  const chatMember = await bot.getChatMember(chatId, newUserId);

  if (referralCode && referralCode === newUserId) {
    bot.sendMessage(chatId, "You cannot refer yourself.");
    return;
  }

  try {
    let user = await UserModel.findOne({ userId: newUserId });

    if (!user) {
      try {
      } catch (err) {
        console.log("Error fetching chat member:", err);
        bot.sendMessage(chatId, "Could not fetch your details.");
        return;
      }

      if (chatMember && chatMember.user) {
        user = await UserModel.create({
          userId: chatMember?.user?.id,
          userName: chatMember?.user?.first_name || chatMember?.user?.username,
        });

        if (referralCode) {
          const referrer = await UserModel.findOne({ userId: referralCode });

          if (referrer) {
            const isAlreadyReferred = referrer.referred.some(
              (referral) => String(referral.userId) === newUserId
            );

            if (!isAlreadyReferred) {
              const referredUserData = {
                name: chatMember?.user?.first_name,
                userName: chatMember?.user?.username,
                userId: newUserId,
              };

              await UserModel.updateOne(
                { userId: referralCode },
                {
                  $push: { referred: referredUserData },
                  $inc: { userScore: 20000 },
                }
              );

              bot.sendMessage(
                chatId,
                `Thanks for joining via referral code: ${referralCode}`
              );
              console.log("Referred user added successfully.");
            } else {
              console.log("This referred user data already exists.");
            }
          } else {
            console.log("Referrer does not exist.");
          }
        }

        bot.sendMessage(chatId, "Welcome to the bot!");
      } else {
        bot.sendMessage(
          chatId,
          "Could not retrieve your profile. Please try again."
        );
        return;
      }
    } else {
      bot.sendMessage(chatId, "Welcome back to the bot!");
    }
  } catch (error) {
    console.error("Error handling referred user:", error);
    bot.sendMessage(chatId, "An error occurred. Please try again later.");
  }
});

bot.on("polling_error", (error) => {
  console.log("Polling error:", error);
});

// fetchiing user profile
async function fetchUserProfilePic(userId) {
  try {
    const photosRes = await axios.post(`${TELEGRAM_API}/getUserProfilePhotos`, {
      user_id: userId,
    });
    const photos = photosRes.data.result;
    if (!photos || photos.total_count === 0) {
      console.log("No profile picture found.");
      return null;
    }

    const fileId = photos.photos[0][0].file_id;
    const fileRes = await axios.post(`${TELEGRAM_API}/getFile`, {
      file_id: fileId,
    });

    const filePath = fileRes.data.result.file_path;
    const fileUrl = `${TELEGRAM_FILE_API}/${filePath}`;
    return fileUrl;
  } catch (error) {
    console.error("Error fetching profile picture:", error.message);
    return null;
  }
}

server.get("/referrallink", (req, res) => {
  let { id } = req?.query;
  let link = `https://t.me/pomeme_bot?start=${id}`;
  res.send(link);
});

server.get("/referrals", async (req, res) => {
  try {
    let data = await UserModel.findOne({ userId: req?.headers?.id });
    res.send(data?.referred);
  } catch (err) {
    res.send(err);
    console.log(err);
  }
});

bot.on("inline_query", function (iq) {
  bot
    .answerInlineQuery(iq.id, [
      { type: "game", id: "0", game_short_name: gameName },
    ])
    .catch((err) => {});
});

server.get("/", (req, res) => {
  res.send("Homepage");
});

server.post("/create", async (req, res) => {
  let { id } = req?.query;
  let { userScore, gotInitalReward } = req?.body;

  try {
    let existingUser = await UserModel.findOne({ userId: id });

    if (existingUser) {
      if (!existingUser.gotInitalReward) {
        existingUser.userScore += userScore || 0;
        existingUser.gotInitalReward = true;
        await existingUser.save();

        return res.status(200).send({
          msg: "User updated with initial reward!",
          data: existingUser,
        });
      } else {
        return res.status(200).send({
          msg: "User already exists and got initial reward!",
          data: existingUser,
        });
      }
    }
    let newUser = await UserModel.create({
      userId: id,
      gotInitalReward: gotInitalReward || false,
      userScore: userScore || 0,
    });

    res.status(201).send({ msg: "New user created!", data: newUser });
  } catch (err) {
    res.status(400).send({ msg: "Something went wrong!", error: err.message });
  }
});

server.post("/highscore/:score", async (req, res) => {
  let { id } = req?.query;
  const incrementScore = parseInt(req.params.score, 10);

  try {
    let data = await UserModel.findOneAndUpdate(
      { userId: id },
      { $inc: { userScore: incrementScore } },
      { new: true }
    );

    res.status(200).send({ msg: "Score updated!", data: data });
  } catch (err) {
    res.status(400).send({ msg: "Something went wrong!", err });
  }
});

server.get("/user", async (req, res) => {
  let { id } = req?.query;
  try {
    let data = await UserModel.findOne({ userId: id });
    if (!data) {
      return res.status(404).send(null);
    }
    return res.status(200).send(data);
  } catch (error) {
    res.status(500).send("Something went wrong");
  }
});

server.get("/profilepic/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const imageUrl = await fetchUserProfilePic(userId);
    if (imageUrl) {
      const imageResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });
      res.set("Content-Type", "image/jpeg");
      res.send(imageResponse.data);
    } else {
      res.status(404).send("No profile picture found.");
    }
  } catch (error) {
    console.error("Error fetching image:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

// server.get("/leaderboard", async (req, res) => {
//   try {
//     let data = await UserModel.find().sort({ userScore: -1 });
//     const imageUrl = await fetchUserProfilePic(userId);
//     if (imageUrl) {
//       const imageResponse = await axios.get(imageUrl, {
//         responseType: "arraybuffer",
//       });
//       console.log(imageResponse.data);
//     } else {
//       console.log("No profile picture found.");
//     }
//     if (!data || data.length === 0) {
//       return res.status(404).send([]);
//     }
//     return res.status(200).send(data);
//   } catch (error) {
//     console.error('Error fetching image:', error.message);
//     res.status(500).send("Something went wrong");
//   }
// });

server.get("/leaderboard", async (req, res) => {
  try {
    let data = await UserModel.find().sort({ userScore: -1 });
    if (!data || data.length === 0) {
      return res.status(404).send([]);
    }
    const leaderboardWithPics = await Promise.all(
      data.map(async (user) => {
        try {
          const url = `/profilepic/${user.userId}`;
          return {
            ...user._doc,
            profilepic: `https://www.gamefistudios.xyz/${url}` || null,
          };
        } catch (error) {
          console.error(
            `Error fetching profile picture for userId: ${user.userId}`,
            error.message
          );
          return { ...user._doc, profilepic: null };
        }
      })
    );
    return res.status(200).send(leaderboardWithPics);
  } catch (error) {
    console.error("Error fetching leaderboard:", error.message);
    res.status(500).send("Something went wrong");
  }
});

server.post("/completetask", async (req, res) => {
  const data = req.body;
  const { id } = req.query;
  const { taskKey, points } = data;

  try {
    const response = await UserModel.findOneAndUpdate(
      { userId: id },
      {
        $inc: { userScore: points },
        $set: { [taskKey]: true },
      },
      { new: true }
    );

    if (response) {
      res.status(200).send({ message: "Task completed!", user: response });
    } else {
      res.status(404).send("User not found!");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong!");
  }
});

server.post("/completeupgrade", async (req, res) => {
  const data = req.body;
  const { id } = req.query;
  const { taskKey, points, incBy } = data;

  try {
    const response = await UserModel.findOneAndUpdate(
      { userId: id },
      {
        $inc: { userScore: -points, [taskKey]: incBy },
      },
      { new: true }
    );

    if (response) {
      res.status(200).send({ message: "Upgrade success!", user: response });
    } else {
      res.status(404).send("User not found!");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong!");
  }
});

server.get("/fetchdate", async function (req, res) {
  const now = new Date();
  const formattedDate = now.toISOString().replace("T", "-").slice(0, 19);
  res.status(200).send({ msg: "date fetched!", date: formattedDate });
});

server.get("/getHighScore", async function (req, res) {
  let { id } = req?.query;
  try {
    let score = await UserModel.findOne({ userId: id });
    res.status(200).send({ msg: "score fetched!", score });
  } catch (err) {
    res.status(400).send({ msg: "something went wrong!", error: err });
  }
});

server.get("/checkmember", async (req, res) => {
  const { id } = req?.query;

  if (!id) {
    return res.status(400).send("User ID is required");
  }

  try {
    const chatMember = await bot.getChatMember(channelId, id);

    if (
      chatMember.status === "member" ||
      chatMember.status === "administrator" ||
      chatMember.status === "creator"
    ) {
      res
        .status(200)
        .send({ msg: "member verified!", status: 200, data: chatMember });
    } else {
      res
        .status(403)
        .send({ msg: "User has not joined the channel", status: 403 });
    }
  } catch (error) {
    res.status(500).send({
      msg: "An error occurred while checking channel status",
      status: 500,
    });
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

  console.log(`Bot is running on port ${port}`);
});
