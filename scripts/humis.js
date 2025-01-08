'use strict';

import { ChatConfig } from './ChatConfig.js';
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

const DebugLevel = 1;

const NUM_SLOTS_IN_ROOM = ChatConfig.NUM_HUMAN_SLOTS + ChatConfig.NUM_AI_SLOTS;

//
// Helpers
//

String.prototype.format = function() {
  var content = this;
  for (var i = 0; i < arguments.length; i++) {
    let str = '{' + i + '}';
    while (content.includes(str))
      content = content.replace(str, arguments[i]);
  }
  return content;
};

//async function delay() { return new Promise(resolve => { resolve() }) }
async function delaySec(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

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
const REGEX_AI_PREFIX = /^([\w\[\]\ ]+[:\.])\W*(.*)/;   // Also remove Name: Number. etc,
// const REGEX_AI_WORD = /(\w+)/;
// const REGEX_AI_PARSE_METADATA = /1\.[^\w/]*([\w/]+).*2\.[^\w/]*([\w/]+)/s;
const REGEX_NAME = /^[a-zA-Z0-9\_\-]*(\s[a-zA-Z0-9\_\-]*)?$/;
//const REGEX_NAME = /\b[a-zA-Z]+(?:\s+[a-zA-Z]+)?\b/;

// console.log(REGEX_NAME.test("N/A"));
// console.log(REGEX_NAME.test("Itay"));
// console.log(REGEX_NAME.test("sds_999"));


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

const chatServer = new ChatServer(ChatConfig.NUM_HUMAN_SLOTS, ChatConfig.ROOM_PREFIX);

//
// Chat Server events
//

chatServer.onUserJoinedRoom = function OnUserJoinedRoom(cid, room_info, resp) {
  if (DebugLevel) console.log("CID", cid, "Joined room ", room_info, "resp", resp);
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

chatServer.onUserSubscribed = function OnUserSubscribed(cid, room_info) {
  var full = isRoomReady(room_info);
  if (full)
    startRoom(room_info);

  if (DebugLevel) console.log("CID", cid, "JOINED ", room_info, "full? " + full);
}

chatServer.onUserUnsubscribed = function OnUserUnsubscribed(cid, room_info) {
  var slot = getSlotByClientID(cid, room_info);
  if (DebugLevel) console.log("CID", cid, "LEFT room slot", slot);

  if (slot >= 0) {
    chatServer.publishMessage(room_info, { op: "Quit", slot: Number(slot) });
    chatServer.closeRoom(room_info);
  }
}

chatServer.onMessagePublished = async function OnMessagePublished(cid, room_info, msg) {
  if (!room_info)
    return;
  switch (msg.op) {
    case "Chat": {
      const slot = msg.slot;

      saveMessageHistory(room_info, msg);

      if (room_info._userData[cid]) // Is human?
      {
        if (!room_info.names[slot]) {
          var nameFromMsg = await getNameFromMessage(msg.text);
          if (DebugLevel) console.log("MY NAME", nameFromMsg);
          if (nameFromMsg)
            room_info.names[slot] = nameFromMsg;
        }

        // Last message timestamp
        room_info.lastMsgTS = Date.now();

        // Check if "Human Is ..."
        var result = ChatConfig.REGEX_HUMANIS.exec(msg.text);
        if (result && result[1] > 0) {
          var guessedSlot = result[1] - 1;   // down to 0..4
          if (guessedSlot != slot) { // Ignore self-guess
            if (room_info.slotInfos[guessedSlot]) { // Is human
              if (DebugLevel) console.log("Guessed correct! win. Human slot is " + guessedSlot);
              gameOver(room_info, true, slot, guessedSlot, guessedSlot);
              room_info.loserSlot = guessedSlot;
            }
            else {  // Not human
              // Find human for the response
              for (var human_slot in room_info.slotInfos)
                if (room_info.slotInfos[human_slot] && room_info.slotInfos[human_slot].cid != cid)
                  break;
              if (DebugLevel) console.log("Guessed wrong! loss. Human slot is " + human_slot);
              gameOver(room_info, false, slot, guessedSlot, human_slot);
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
  else if (room_info.history.length > ChatConfig.MAX_HISTORY_PER_ROOM)
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
const roomHasMinimumPlayers = (room_info) => room_info && room_info._nids >= ChatConfig.NUM_HUMAN_SLOTS;
const randomBotSlotIndex = (room_info) => Math.floor(Math.random() * room_info.botSlotNums.length);
const randomBotSlotIndexFavorFirst = (room_info) => Math.floor(Math.pow(Math.random(), 4) * room_info.botSlotNums.length);

const getUserNameInRoom = (slot, room_info) => room_info.names[slot];
// "Slot" + String((Number(slot) + 1));

// At least MIN players who are subscribed
function isRoomReady(room_info) {
  if (room_info)
    return chatServer.getNumberOfSubscribers(room_info) >= ChatConfig.NUM_HUMAN_SLOTS;
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
  const my_name = getUserNameInRoom(slot, room_info);
  var user_message;
  var transcript = '';
  if (room_info.history) {
    let len = room_info.history.length;
    let startHistory = Math.max(0, len - ChatConfig.CHATGPT_MAX_HISTORY_TO_SEND);
    for (var i = startHistory; i < len; ++i) {
      var entry = room_info.history[i];

      // // After CHATGPT_MAX_HISTORY_TO_SEND only allow messages from self
      // if (i < startHistory && slot != entry.slot)
      //   continue;

      let name = getUserNameInRoom(entry.slot, room_info) ?? (ChatConfig.UNNAMED_USER_FMT.format(Number(entry.slot) + 1));

      // Suffix (You) for this player's actual 
      if (slot == entry.slot)
        name += ChatConfig.YOUR_NAME_SUFFIX;
      transcript += `${name}: ${entry.msg}\n`;
    }
  }

  // Loser found
  if (room_info.loserSlot != undefined) {
    var loser_name = getUserNameInRoom(room_info.loserSlot, room_info) ?? ChatConfig.UNNAMED_USER_FMT.format(Number(room_info.loserSlot) + 1);
    user_message = my_name ?
      ChatConfig.AI_MESSAGE_LOSER_NAMED_TRANSCRIPT.format(my_name, loser_name, transcript) :
      ChatConfig.AI_MESSAGE_LOSER_TRANSCRIPT.format(loser_name, transcript);
  }
  else {
    user_message = my_name ?
      ChatConfig.AI_MESSAGE_NAMED_TRANSCRIPT.format(my_name, transcript) :
      room_info.history ?
        ChatConfig.AI_MESSAGE_INTRO_TRANSCRIPT.format(transcript) :
        ChatConfig.AI_MESSAGE_INTRO;
  }

  console.log('Sending: ---->\n', user_message);//

  var messages = [
    {
      role: "user",
      content: user_message
    },
    {
      role: "developer",
      content: ChatConfig.AI_DEV_MESSAGE
    }
  ];

  return messages;
}

function setTimeoutForNextBotMessage(room_info) {
  var timeSec = ChatConfig.MESSAGE_RAND_TIME_MIN + Math.floor(Math.random() * (ChatConfig.MESSAGE_RAND_TIME_MAX - ChatConfig.MESSAGE_RAND_TIME_MIN));
  setTimeout(() => sendBotMessage(room_info), timeSec * 1000)
}

async function sendBotMessage(room_info) {
  if (!room_info || !room_info._exists)
    return;
  
  // Check for chatroom timeout
  if (room_info.lastMsgTS) {
    const secs_since_last_human_msg = (Date.now() - room_info.lastMsgTS) / 1000;
    if (secs_since_last_human_msg > ChatConfig.TIMEOUT_NO_MSG_SECS) {
      if (DebugLevel) console.log("Timeout - no human messages for {0} seconds, limit {1}".format(secs_since_last_human_msg, ChatConfig.TIMEOUT_NO_MSG_SECS))
      chatServer.publishMessage(room_info, { op: "Close", reason: "Idle" });
      chatServer.closeRoom(room_info);
      return;
    }
  }
          
  // Get a random bot, preferrably first (then moved to the back)
  var idx = randomBotSlotIndexFavorFirst(room_info);
  // var idx = randomBotSlotIndex(room_info);
  var slot = Number(room_info.botSlotNums[idx]);
  // Move to the end of the list to reduce chance of same bot sending multiple msgs
  room_info.botSlotNums.splice(idx, 1);
  room_info.botSlotNums.push(slot);

  // Populate messages
  var messages = populateMessageHistory(slot, room_info);

  var chat_req_data = {
    model: ChatConfig.CHATGPT_MODEL,
    messages: messages,
    // frequency_penalty: Number(ChatConfig.CHATGPT_FREQ_PANELTY),
    temperature: Number(ChatConfig.CHATGPT_RESPONSE_TEMPERATURE),
    max_tokens: Number(ChatConfig.CHATGPT_MAX_RESPONSE_TOKENS),
  };
  if (DebugLevel >= 2) console.log("CHATGPT sending", chat_req_data);

  var text;
  try {
    const response = await timeLimitTask(openai.chat.completions.create(chat_req_data), ChatConfig.CHATGPT_MAX_WAIT * 1000);
    if (response) {
      let message = response.choices[0].message;
      text = trimAIText(String(message.content));

      if (!room_info.names[slot]) {
        var nameFromMsg = await getNameFromMessage(text);
        if (DebugLevel) console.log("BOT NAME", nameFromMsg);
                                
        if (nameFromMsg)
          room_info.names[slot] = nameFromMsg;
      }

      console.log('Response: <----\n', message.content);

      var waitSec = text.length * ChatConfig.CHATGPT_RESPONSE_WAIT_PER_CHAR;
      if (DebugLevel >= 2) console.log("CHATGPT response", message.content, "=>", text, "Name", room_info.names[slot], "wait=" + waitSec);
      if (waitSec > 0)
        await delaySec(waitSec);
    }
    else
      console.log("Response timed out after " + ChatConfig.CHATGPT_MAX_WAIT + "s");
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
      tag: room_info.gameOver ? ChatConfig.POSTGAME_TAG_BOT : undefined,
      text: text
    });
  }
}

// Send ChatGPT a message to determine user name from response
// Returns name or null
async function getNameFromMessage(message) {
  var chat_req_data = {
    model: ChatConfig.CHATGPT_MODEL,
    messages: [
      { role: "user", content: ChatConfig.AI_IDENTIFY_NAME.format(message) }
    ],
    temperature: 0.2,   // deterministic
    max_tokens: 20,
  };
  if (DebugLevel) console.log("Name request", chat_req_data);

  let retName = null;
  try {
    const response = await timeLimitTask(openai.chat.completions.create(chat_req_data), ChatConfig.CHATGPT_MAX_WAIT * 1000);
    if (response) {
      let message = response.choices[0].message;
      let contentData = String(message.content);
      let parsedData = contentData.trim().split('\n');
      // content_data.trim().split("\n");
      if (parsedData && parsedData.length) {
        var name = String(parsedData[0]).trim();
        if (name && REGEX_NAME.test(name)) {
          retName = name;
          if (DebugLevel) console.log("Name identified as", name, "from", contentData)
        }
        else {
          if (DebugLevel) console.log("Name unidentified from", contentData);
        }
      }
      // var is_ai_str = String(parsed_data[2]).trim().toLowerCase();     
      // var ret = {
      //     isAI: is_ai_str == "true" || is_ai_str == "yes" || is_ai_str == "y"
      // };
    }
    else
      console.log("Response timed out after " + ChatConfig.CHATGPT_MAX_WAIT + "s");
  } catch (err) {
    console.log("CHATGPT error", err);
  }
  return retName;
}

