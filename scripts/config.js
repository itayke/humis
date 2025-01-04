export const Config = {
  CHATGPT_MODEL: "gpt-4o-mini",
  CHATGPT_SYSTEM_MESSAGE_INTRO:
    `Assume the role of a human in a chatroom. Do not speak like an assistant! 
    Come up with a random name. Introduce yourself to the group, and share an short interesting story.`,
  CHATGPT_SYSTEM_MESSAGE_NAMED:
    `Assuming the role of a human named {0} in this chatroom conversation,
    type in your next message and engage with other people at the chatroom.`,
  CHATGPT_SYSTEM_MESSAGE_LOSER:
    `Assume the role of a human in a chatroom. Do not speak like an assistant! 
    Taunt {0} for losing the game.`,
  CHATGPT_SYSTEM_MESSAGE_LOSER_NAMED:
    `Assuming the role of {0} in this chatroom conversation, taunt {1} for losing the game.`,
  CHATGPT_SYSTEM_MESSAGE_SUFFIX:
    `Make occasional typos. Avoid emojis and fancy punctuations.
    Keep it laid back and short, no more than 20 words, but be funny and friendly!`,
  CHATGPT_IDENTIFY_NAME:
    `Given this message: "{0}", identify the speaker's first name.    
    Respond with the name only, or N/A if you can't identify the name.
            
    Example responses:
    John
    N/A`,
  ROOM_PREFIX: "humis_",
  POSTGAME_TAG_BOT: "[BOT]",
  // Is player typing "human is ...""
  REGEX_HUMANIS: /human\s*is\D*(\d+)/i,
  CHATGPT_RESPONSE_TEMPERATURE: 1,
  CHATGPT_RESPONSE_WAIT_PER_CHAR: 100,
  DEFAULT_NAME_PREFIX: "Number", // Must start with a character, with no spaces (Based on ChatGPT protocol)
  MESSAGE_RAND_TIME_MIN: 4000,
  MESSAGE_RAND_TIME_RANGE: 6000,
  CHATGPT_MAX_WAIT: 15000,
  CHATGPT_MAX_RESPONSE_TOKENS: 200,
  TIMEOUT_NO_MSG_SECS: 60,
  NUM_HUMAN_SLOTS: 2,
  NUM_AI_SLOTS: 3,
  MAX_HISTORY_PER_ROOM: 32,
  CHATGPT_MAX_HISTORY_TO_SEND: 8,
};