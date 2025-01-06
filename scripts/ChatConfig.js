
const AI_MAIN_COMMAND = `Engage in a light-hearted conversation with others on the chat. 
Keep pointing out others as the human.`;

export const ChatConfig = {
  CHATGPT_MODEL: "gpt-4o-mini",

  // First message to make an intro, when the bot is still unnamed
  AI_MESSAGE_INTRO:
    `You are human in a chatroom of AI bots.
    Make up a first name and introduce yourself.
    ${AI_MAIN_COMMAND}`,
  
  // First message to make an intro, when the bot is still unnamed, but a transcript is attached
  AI_MESSAGE_INTRO_TRANSCRIPT:
    `You are human in a chatroom of AI bots, based on the following transcript.
    Make up a first name and introduce yourself.
    ${AI_MAIN_COMMAND}
    
    Transcript:`,

  // Bot is named {0}, continue playing
  AI_MESSAGE_NAMED_TRANSCRIPT:
    `You are human named {0} in a chatroom of AI bots, based on the following transcript.
    ${AI_MAIN_COMMAND}
    
    Transcript:`,
  
  // Bot is unnamed, the game is lost and human named {0} is the loser, but a transcript is attached
  AI_MESSAGE_LOSER_TRANSCRIPT:
    `You are a human in a chatroom, based on the following transcript.
    Taunt {0} for losing the game and being identified as a human.
    
    Transcript:`,

  // Bot is named {0}, the game is lost and human named {1} is the loser
  AI_MESSAGE_LOSER_NAMED_TRANSCRIPT:
    `You are a human named {0} in a chatroom, based on the following transcript.
    Taunt {1} for losing the game and being identified as a human.
    
    Transcript:`,
  
  // Dev (system) commands - more info on how to respond
  AI_DEV_MESSAGE:
    `You are not here to chill, but to identify who's a bot and who's a human.
    Act and talk like a human. Do not speak like an AI assistant.
    Don't use emojis. Use simple punctuations, bad capitalization, common shorthands, occasional typos.
    Don't prefix your name, just write a one line message, around 5-20 words.`,
  
  // Query to identify a name from response {0} to AI_MESSAGE_INTRO
  AI_IDENTIFY_NAME:
    `Given this message: "{0}", identify the speaker's first name.    
    Respond with the name only, or N/A if you can't identify it.
            
    Example responses:
    John
    N/A`,
  
  ROOM_PREFIX: 'humis_',
  POSTGAME_TAG_BOT: '[BOT]',
  // Is player typing "human is ...""
  REGEX_HUMANIS: /human\s*is\D*(\d+)/i,
  CHATGPT_RESPONSE_TEMPERATURE: 1.5,
  CHATGPT_FREQ_PANELTY: 1,
  CHATGPT_RESPONSE_WAIT_PER_CHAR: 100,
  DEFAULT_NAME_PREFIX: '#',
  MESSAGE_RAND_TIME_MIN: 5000,
  MESSAGE_RAND_TIME_MAX: 15000,
  CHATGPT_MAX_WAIT: 15000,
  CHATGPT_MAX_RESPONSE_TOKENS: 200,
  TIMEOUT_NO_MSG_SECS: 60,
  NUM_HUMAN_SLOTS: 2,
  NUM_AI_SLOTS: 3,
  MAX_HISTORY_PER_ROOM: 32,
  CHATGPT_MAX_HISTORY_TO_SEND: 16,
};