'use strict';

import { Config } from './config.js';
import { ChatServer } from "./ChatServer.js";
import OpenAI from "openai";
import dotenv from 'dotenv';

dotenv.config();
const openai = new OpenAI({
  organization: process.env.OPENAI_ORG_ID,
  project: process.env.OPENAI_PROJ_ID
});

//
//  Constants
//

const valueOrDefault = (val, def) => val != undefined ? val : def;
const NUM_SLOTS_IN_ROOM = Config.NUM_HUMAN_SLOTS + Config.NUM_AI_SLOTS;

//
// Helpers
//

String.prototype.format = function() {
  var content = this;
  for (var i = 0; i < arguments.length; i++)
      content = content.replace('{' + i + '}', arguments[i]);
  return content;
};

async function delay() { return new Promise(resolve => { resolve() }) }

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

const REGEX_AI_TRIM_QUOTES = /^\"(.*)\"$/s;
const REGEX_AI_FIRST_LINE = /^(.+)/;
const REGEX_AI_PREFIX = /^([\w\[\]]+[:\.])\W*(.*)/;   // Also remove Name: Number. etc,
const REGEX_AI_WORD = /(\w+)/;
const REGEX_AI_PARSE_METADATA = /1\.[^\w/]*([\w/]+).*2\.[^\w/]*([\w/]+)/s;
const REGEX_NAME = /^[a-zA-Z0-9]*$/;

function trimAIText(text) {
  var text = text.trim();
  var res;
  // Remove overall quotes
  res = REGEX_AI_TRIM_QUOTES.exec(text);
  if (res)
    text = res[res.length - 1].trim();
  // Extract first line
  res = REGEX_AI_FIRST_LINE.exec(text);
  if (res)
    text = res[res.length - 1].trim();
  // Remove quotes in first line only
  res = REGEX_AI_TRIM_QUOTES.exec(text);
  if (res)
    text = res[res.length - 1].trim();
  // Remove name
  res = REGEX_AI_PREFIX.exec(text);
  if (res)
    text = res[res.length - 1].trim();
  // console.log(text, "->", res_data);
  return text;
}

// console.log(REGEX_AI_PARSE_METADATA.exec("1. N/A\n2. true"));
// console.log(REGEX_AI_PARSE_METADATA.exec("1. N/A (testing)\n2. true(testing)"));
// console.log(REGEX_PROPER_NAME.test("Itay"));
// console.log(REGEX_PROPER_NAME.test("Ita/y"));
// console.log(REGEX_PROPER_NAME.test("Ita_y"));
// console.log(REGEX_PROPER_NAME.test("Ita y"));
// console.log(trimAIText("No, I am an AI language model created by OpenAI. "));
// console.log(trimAIText("[Emma]: I love hiking and once climbed to the top of Mount Kilimanjaro."));
// console.log(trimAIText("[Anna:] Hi everyone, I'm Anna, an avid traveler and yoga enthusiast"));
// console.log(trimAIText("\"[Olivia:] Great input, Ailee, I also limit the influence of social media on my mental health by following only positive influencers, removing any negative or stressful experiences or people from my feeds.\" Taking\" breaks is as effective too.\""));

async function timeLimitTask(task, timeLimit, failureValue = null) {
  let timeout;
  const timeoutPromise = new Promise((resolve, reject) => {
    timeout = setTimeout(() => {
      resolve(failureValue);
    }, timeLimit);
  });
  const response = await Promise.race([task, timeoutPromise]);
  if (timeout) { //the code works without this but let's be safe and clean up the timeout
    clearTimeout(timeout);
  }
  return response;
}

//
// Names
//

// var Names = [];

// try {
//     const data = fs.readFileSync('first-names.txt', 'utf8');
//     Names = data.split(/\r?\n/);
//     console.log("Number of names", Names.length);
// } catch (err) {
//     console.error("Error reading names", err);
// }

// const getRandomName = () => Names[Math.floor(Math.random() * Names.length)];

//console.log(trimAIText("Ben: Great input, Ailee, I also limit the influence of social media on my mental health by following only positive influencers, removing any negative or stressful experiences or people from my feeds.\" Taking\" breaks is as effective too.\""));

// console.log(Array(10).fill().map(() => getRandomName()));

// <room-name>: {
//   _nids: <num-of-players>,
//   _userData: {   <-- all client ids
//     <clientid>: {
//       _sub: <bool>,   <-- Subscribed?
//       slot: <idx_in_slots0..4>
//     }
//   },
//   slotInfos: [     <--- Numbered entries of 5 players, AI/human
//      { clientid: <clientid> },
//      ...
//   ]
// }

const chatServer = new ChatServer (Config.NUM_HUMAN_SLOTS, Config.ROOM_PREFIX, {
  onUserJoinedRoom: OnUserJoinedRoom,
  onUserSubscribed: OnUserSubscribed,
  onUserUnsubscribed: OnUserUnsubscribed,
  onMessagePublished: OnMessagePublished
});

//
// Chat Server Implementations
//

function OnUserJoinedRoom(cid, room_info, resp) {
  console.log(cid, "=============================================Joined room ", room_info, "resp", resp);
  if (room_info.slotInfos == undefined) {
    room_info.slotInfos = Array(NUM_SLOTS_IN_ROOM).fill(null);      // [ null, null, ...]
    room_info.botSlotNums = [...Array(NUM_SLOTS_IN_ROOM).keys()];   // [ 0, 1, 2, ...]
  }

  var idx = randomBotSlotIndex(room_info);
  var slot = room_info.botSlotNums[idx];
  room_info.botSlotNums.splice(idx, 1);

  room_info.slotInfos[slot] = {
    cid: cid
  };
  room_info._userData[cid].slot = slot;

  resp.waiting = !roomHasMinimumPlayers(room_info);
  resp.slot = slot;

  // console.log("Joined room ", room_info, "resp", resp);
}

function OnUserSubscribed(cid, room_info) {
  var full = isRoomReady(room_info);
  if (full)
    startRoom(room_info);

  console.log("JOINED ", room_info, "full? " + full);
}

function OnUserUnsubscribed(cid, room_info) {
  var slot = getSlotByClientID(cid, room_info);
  console.log(cid + " LEFT room slot " + slot);

  if (slot >= 0) {
    chatServer.publishMessage(room_info, { op: "Quit", slot: Number(slot) });
    chatServer.closeRoom(room_info);
  }
}

async function OnMessagePublished(cid, room_info, msg) {
  if (!room_info)
    return;
  switch (msg.op) {
    case "Chat": {
      const slot = msg.slot;

      saveMessageHistory(room_info, msg);

      if (room_info._userData[cid]) // Is human?
      {
        if (!room_info.names[slot]) {
          var metadata_from_message = await getMetadataFromMessage(msg.text);
          console.log("MY METADATA", metadata_from_message);
          if (metadata_from_message && metadata_from_message.name)
            room_info.names[slot] = metadata_from_message.name;
        }

        // Last message timestamp
        room_info.lastMsgTS = Date.now();

        // Check if "Human Is ..."
        var result = Config.REGEX_HUMANIS.exec(msg.text);
        if (result && result[1] > 0) {
          var guessed_slot = result[1] - 1;   // down to 0..4
          if (guessed_slot != slot) { // Ignore self-guess
            if (room_info.slotInfos[guessed_slot]) { // Is human
              console.log("Guessed correct! win. Human slot is " + guessed_slot);
              gameOver(room_info, true, slot, guessed_slot, guessed_slot);
              room_info.loserSlot = guessed_slot;
            }
            else {  // Not human
              // Find human for the response
              for (var human_slot in room_info.slotInfos)
                if (room_info.slotInfos[human_slot] && room_info.slotInfos[human_slot].cid != cid)
                  break;
              console.log("Guessed wrong! loss. Human slot is " + human_slot);
              gameOver(room_info, false, slot, guessed_slot, human_slot);
              room_info.loserSlot = slot;
            }
          }
        }
        // console.log("Message from", cid, msg, result);
      }
      break;
    }
  }
}

//
// General funcs
//

function saveMessageHistory(room_info, msg) {
  if (room_info.history == undefined)
    room_info.history = [];
  else if (room_info.history.length > Config.MAX_HISTORY_PER_ROOM)
    room_info.history.shift();
  
  room_info.history.push({
    slot: Number(msg.slot),
    msg: msg.text
  });
  // console.log("History", room_info.history);
}

function getSlotByClientID(cid, room_info) {
  if (room_info && room_info._userData[cid])
    return room_info._userData[cid].slot;
  return -1;
}

// At least MIN players
const roomHasMinimumPlayers = (room_info) => room_info && room_info._nids >= Config.NUM_HUMAN_SLOTS;
const randomBotSlotIndex = (room_info) => Math.floor(Math.random() * room_info.botSlotNums.length);
const randomBotSlotIndexFavorFirst = (room_info) => Math.floor(Math.pow(Math.random(), 4) * room_info.botSlotNums.length);

const getUserNameInRoom = (slot, room_info) => room_info.names[slot];
// "Slot" + String((Number(slot) + 1));

// At least MIN players who are subscribed
function isRoomReady(room_info) {
  if (room_info)
    return chatServer.getNumberOfSubscribers(room_info) >= Config.NUM_HUMAN_SLOTS;
  return false;
}

function startRoom(room_info) {
  // Create names for bots to use
  room_info.names = Array(NUM_SLOTS_IN_ROOM);

  // Last message timestamp
  room_info.lastMsgTS = Date.now();

  // Shuffle the leftover bot slots
  shuffleArray(room_info.botSlotNums);

  if (chatServer.publishMessage(room_info, { op: "Start" }))
    setTimeoutForNextBotMessage(room_info);
}

function gameOver(room_info, correct_guess, sender_slot, guessed_slot, human_slot) {
  chatServer.publishMessage(room_info, {
    op: "GameOver",
    correct: Boolean(correct_guess),
    senderSlot: Number(sender_slot),
    guessedSlot: Number(guessed_slot),
    humanSlot: Number(human_slot)
  });
  room_info.gameOver = true;
}


function populateMessageHistory(slot, room_info) {
  // var name = valueOrDefault(getUserNameInRoom(slot, room_info), humisConfig.CHATGPT_SYSTEM_MESSAGE_YOURNAME_PLACEHOLDER);
  var my_name = getUserNameInRoom(slot, room_info);
  var sys_msg;
  if (room_info.loserSlot != undefined) {
    var loser_name = getUserNameInRoom(room_info.loserSlot, room_info);
    if (!loser_name)
      loser_name = "Slot " + (Number(room_info.loserSlot) + 1);
    sys_msg = my_name ? Config.CHATGPT_SYSTEM_MESSAGE_LOSER_NAMED.format(my_name, loser_name) : Config.CHATGPT_SYSTEM_MESSAGE_LOSER.format(loser_name);
  } else {
    sys_msg = my_name ? Config.CHATGPT_SYSTEM_MESSAGE_NAMED.format(my_name) : Config.CHATGPT_SYSTEM_MESSAGE_INTRO;
  }
  sys_msg += " " + Config.CHATGPT_SYSTEM_MESSAGE_SUFFIX;

  var messages = [
    {
      role: "system",
      content: sys_msg
    }
  ];

  if (room_info.history != undefined) {
    var len = room_info.history.length;
    for (var i = len - 1; i >= 0; --i) {
      var entry = room_info.history[i];

      // After CHATGPT_MAX_HISTORY_TO_SEND only allow messages from self
      if (slot == entry.slot || messages.length <= Config.CHATGPT_MAX_HISTORY_TO_SEND)
        messages.unshift({
          role: "user",
          content: room_info.history[i].msg,
          name: valueOrDefault(getUserNameInRoom(entry.slot, room_info), Config.DEFAULT_NAME_PREFIX + (Number(entry.slot) + 1))
        });
    }
  }

  return messages;
}

function setTimeoutForNextBotMessage(room_info) {
  var time = Config.MESSAGE_RAND_TIME_MIN + Math.floor(Math.random() * Config.MESSAGE_RAND_TIME_RANGE);
  setTimeout(() => sendBotMessage(room_info), time)
}

async function sendBotMessage(room_info) {
  if (!room_info || !room_info._exists)
    return;
  
  // Check for timeout
  if (room_info.lastMsgTS) {
    const secs_since_last_human_msg = (Date.now() - room_info.lastMsgTS) / 1000;
    if (secs_since_last_human_msg > Config.TIMEOUT_NO_MSG_SECS) {
      console.log("Timeout - no human messages for {0} seconds, limit {1}".format(secs_since_last_human_msg, Config.TIMEOUT_NO_MSG_SECS))
      chatServer.publishMessage(room_info, { op: "Close", reason: "Idle" });
      chatServer.closeRoom(room_info);
      return;
    }
  }
          
  // Get a random bot, preferrably first
  var idx = randomBotSlotIndexFavorFirst(room_info);
  var slot = Number(room_info.botSlotNums[idx]);
  // Move to the end of the list to reduce chance of same bot sending multiple msgs
  room_info.botSlotNums.splice(idx, 1);
  room_info.botSlotNums.push(slot);

  // Populate messages
  var messages = populateMessageHistory(slot, room_info);

  var chat_req_data = {
    model: Config.CHATGPT_MODEL,
    messages: messages,
    temperature: Number(Config.CHATGPT_RESPONSE_TEMPERATURE),
    max_tokens: Number(Config.CHATGPT_MAX_RESPONSE_TOKENS),
    // logit_bias: CHATGPT_RESPONSE_LOGIT_BIAS
  };
  console.log("CHATGPT sending", chat_req_data);

  var text;// = randomstr.generate(4);
  try {
    const response = await timeLimitTask(openai.chat.completions.create(chat_req_data), Config.CHATGPT_MAX_WAIT);
    if (response) {
      let message = response.choices[0].message;
      console.log("==========", message);
      text = trimAIText(String(message.content));

      if (!room_info.names[slot]) {
        var metadata_from_message = await getMetadataFromMessage(text);
        console.log("BOT METADATA", metadata_from_message);
                                
        if (metadata_from_message && metadata_from_message.name)
          room_info.names[slot] = metadata_from_message.name;
      }

      var wait = text.length * Config.CHATGPT_RESPONSE_WAIT_PER_CHAR;
      console.log("CHATGPT response", message.content, "=>", text, "Name", room_info.names[slot], "wait=" + wait);
      if (wait > 0)
        await delay(wait);
    }
    else
      console.log("Response timed out after " + Config.CHATGPT_MAX_WAIT + "ms");
  } catch (err) {
    console.log("CHATGPT error", err, messages);
  }

  // if (room_info.gameOver)
  //     return;
  
  setTimeoutForNextBotMessage(room_info);

  if (text) {
    chatServer.publishMessage(room_info, {
      op: "Chat",
      slot: slot,
      tag: room_info.gameOver ? Config.POSTGAME_TAG_BOT : undefined,
      text: text
    });
  }
}

// Send ChatGPT a message to determine name and likelihood of being an AI
// Returns: {
//    name: String,
//    isHuman: Boolean
// }
// or null on error
async function getMetadataFromMessage(message) {
  var chat_req_data = {
    model: Config.CHATGPT_MODEL,
    messages: [
      { role: "user", content: Config.CHATGPT_IDENTIFY_NAME.format(message) }
    ],
    temperature: 0.2,   // deterministic
    max_tokens: 20,
  };
  console.log("METADATA request", chat_req_data);

  try {
    const response = await timeLimitTask(openai.createChatCompletion(chat_req_data), Config.CHATGPT_MAX_WAIT);
    if (response) {
      var content_data = String(response.data.choices[0].message.content);
      var parsed_data = content_data.trim().split('\n');
      // content_data.trim().split("\n");
      console.log("METADATA response", response.data.choices[0].message.content, parsed_data);
      var ret = {};
      if (parsed_data && parsed_data.length >= 1) {
        var name = String(parsed_data[0]).trim();
        if (name && REGEX_NAME.test(name))
          ret.name = name;
      }
      return ret;
      // var is_ai_str = String(parsed_data[2]).trim().toLowerCase();     
      // var ret = {
      //     isAI: is_ai_str == "true" || is_ai_str == "yes" || is_ai_str == "y"
      // };
    }
    else
      console.log("Response timed out after " + Config.CHATGPT_MAX_WAIT + "ms");
  } catch (err) {
    console.log("CHATGPT error", err);
  }
  return null;
}

