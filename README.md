# Human Is
<b>Human Is</b> is a ChatGPT-powered party game where 5 chatroom slots are filled with 2 randomly selected human players plus 3 bots who desperately try to come off as humans. The winner is the player who correctly identifies the other human.
Created by Itay Keren 
Copyright (C) 2024 Untame (Keren Software)

## Setup
Create a .env file with the following info filled from an OpenAI account
OPENAI_API_KEY=
OPENAI_ORG_ID=
OPENAI_PROJ_ID=

To install node dependencies:
```
npm install 
```

To run the server:
```
npm start 
```

To change the server port (default 3030), set SERVER_PORT in .env, e.g.:
```
SERVER_PORT=3333
```