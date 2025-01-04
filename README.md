# Human Is
<b>Human Is</b> is a ChatGPT-powered party game where 5 chatroom slots are filled with 2 randomly selected human players plus 3 bots who desperately try to come off as humans. The winner is the player who correctly identifies the other human.
Created by Itay Keren 
Copyright (C) 2024 Untame (Keren Software)

## Setup
Create a .env file with the following info filled from an OpenAI account:
```
OPENAI_API_KEY=<openai-key>
OPENAI_ORG_ID=<openai-org-id>
OPENAI_PROJ_ID=<openai-proj-id>
```

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
SERVER_PORT=<new-port>
```

The node server will be running at the designated port, returning the main game page at index.html. On default, test by opening http://localhost:3030 on your browser.
