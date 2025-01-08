
const STYLE_MESSAGE = `respond in short messages (5-15 words). 
use informal tone, grammar, and capitalization.
Do not use emojis! Use only simple keyboard characters.
don't prefix your name, just write your message.`;

export const ChatConfig = {
  CHATGPT_MODEL: "gpt-4o-mini",

  // First message to make an intro, when the bot is still unnamed
  AI_MESSAGE_INTRO:
`you're in a chatroom with humans and AI bots.
try to sound like AI, and use your wits to reveal who's the human!
make fun of humans but keep it friendly and inquisitive.
first, make up a human name and introduce yourself.`,
  
  // First message to make an intro, when the bot is still unnamed, with transcript at {0}
  AI_MESSAGE_INTRO_TRANSCRIPT:
`you're in a chatroom with humans and AI bots.
try to sound like AI, and use your wits to reveal who's the human!
make fun of humans but keep it friendly and inquisitive.
first, make up a human name and introduce yourself.

Previous messages:
{0}`,

  // Bot is named {0}, continue playing. Transcript at {1}
  AI_MESSAGE_NAMED_TRANSCRIPT:
`you're {0} in a chatroom with humans and AI bots.
try to sound like AI, and use your wits to reveal who's the human!
make fun of humans but keep it friendly and inquisitive.

previous messages:
{1}`,
  
  // Bot is unnamed, the game is lost and human named {0} is the loser, transcript at {1}
  AI_MESSAGE_LOSER_TRANSCRIPT:
`you're in a chatroom with humans and AI bots.
taunt player {0} for losing the game and being revealed as the human.

Previous messages:
{1}`,

  // Bot is named {0}, the game is lost and human named {1} is the loser, transcript at {2}
  AI_MESSAGE_LOSER_NAMED_TRANSCRIPT:
`you're {0} in a chatroom with humans and bots.
taunt player {1} for losing the game and being revealed as the human.

Previous messages:
{2}`,
  
  // Dev (system) commands - more info on how to respond
  AI_DEV_MESSAGE: STYLE_MESSAGE,
  
  // Query to identify a name from response {0} to AI_MESSAGE_INTRO
  AI_IDENTIFY_NAME:
`Given the message: '{0}', identify the speaker's name.
Do not use the name of anyone being addressed in the message, just provide the speaker's name.
If it's unclear or not present, respond with 'N/A'.

Example responses:
John
N/A`,
  
  // Is player typing "human is ...""
  REGEX_HUMANIS: /human\s*is\D*(\d+)/i,
  ROOM_PREFIX: 'humis_',
  POSTGAME_TAG_BOT: '[BOT]',
  CHATGPT_RESPONSE_TEMPERATURE: 1,
  CHATGPT_FREQ_PANELTY: 1,
  UNNAMED_USER_FMT: '#{0}',
  YOUR_NAME_SUFFIX: ' (You)',
  MESSAGE_RAND_TIME_MIN: 2,
  MESSAGE_RAND_TIME_MAX: 10,
  CHATGPT_RESPONSE_WAIT_PER_CHAR: 0.1,
  CHATGPT_MAX_WAIT: 15,
  CHATGPT_MAX_RESPONSE_TOKENS: 200,
  TIMEOUT_NO_MSG_SECS: 60,
  NUM_HUMAN_SLOTS: 2,
  NUM_AI_SLOTS: 3,
  MAX_HISTORY_PER_ROOM: 32,
  CHATGPT_MAX_HISTORY_TO_SEND: 16,
};