'use strict';

// const { create } = require('domain');
var http       = require('http'),
    express    = require('express'),
    randomstr  = require("randomstring"),
    morgan     = require('morgan'),
    faye       = require('faye');
const { __basedir } = require('../basedir');

var port = process.env.SERVER_PORT || 3030;
var publicDir = `${__basedir}/public`;

var bayeux = new faye.NodeAdapter({
    mount:    '/faye',
    timeout:  45
});

var game;

var app = express();
var server = http.createServer(app);

bayeux.attach(server);

// Room dictionary:
// <room-name>: {
//   _nids: <num-of-players>,
//   _userData: {   <-- all client ids
//     <id>: {
//       _sub: <bool>   <-- Subscribed?
//     }
//   },
// }
var rooms = {};
var nextRoom = null;

// Message received on any channel
bayeux.on('publish', (cid, room, msg) => {
    room = room.substr(1); //TODO REGEX
    console.log("-------- publish ", room, cid, msg);
    game.OnMessagePublished(cid, rooms[room], msg);
});

// Subscribed to a channel
bayeux.on('subscribe', (cid, room) => {
    room = room.substr(1); //TODO REGEX
    console.log("-------- subscribe ", room, cid);
    var room_info = rooms[room];
    if (room_info) {
        var user_data = room_info._userData[cid];
        if (user_data) {
            user_data._sub = true;
            game.OnUserSubscribed(cid, room_info);
        }
    }
});

// Disconnect + unsubscribe
bayeux.on('unsubscribe', (cid, room) => {
    room = room.substr(1); //TODO REGEX
    console.log("-------- unsubscribe ", room, cid);
    var room_info = rooms[room];
    if (room_info) {
        var user_data = room_info._userData[cid];
        if (user_data) {
            user_data._sub = false;
            game.OnUserUnsubscribed(cid, room_info);
        }
        delete room_info._userData[cid];
    }
});

// Open file server etc
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(publicDir));

// Accept chat message via HTTP
/* Moved to client
app.post('/message', function(req, res) {
    if (rooms[req.body.room]) {
        bayeux.getClient().publish(game.ROOM_PREFIX + req.body.room, {text: req.body.message});
        res.sendStatus(200);
    }
});*/

// app.get('/', (req, res) => {
//     res.send('Hello World!');
// });

// Accept dispatch message via HTTP and connect to room
app.post('/dispatch', (req, res) => {
    var msg = req.body;
    var resp = {
        op: "joinResp"
    };
    var cid = msg.cid;

    switch (msg.op) {
        case "joinReq":
            console.log("Client ID ", cid, " joining room ", msg.room);
            resp.room = assignUserToRoom(cid, msg.room);
            if (resp.room)
                game.OnUserJoinedRoom(cid, rooms[resp.room], resp);
            break;
        default:
            resp.error = "Unknown command";
    }
    console.log("Got", msg, "sending", resp);
    res.send(resp);
});

server.listen(port);
console.log(`Server up and listening on port ${port}, folder ${publicDir}`);

//
//  General chatroom functions
//

// Join requested room (or any if req_room is undefined), returns name of room or null if can't join
function assignUserToRoom(cid, req_room) {
    
    // Specified
    if (req_room) {
        // absent
        if (!rooms[req_room]) {
            createAndJoinRoom(req_room, cid);
            return req_room;
        }
        // exists
        if (rooms[req_room]._nids < game.MAX_PLAYERS_PER_ROOM) {
            if (!rooms[req_room]._userData[cid]) {
                ++rooms[req_room]._nids;
                rooms[req_room]._userData[cid] = {};
                return req_room;
            }
        }
    }

    // Room not specified
    if (nextRoom && rooms[nextRoom]) {
        var join_room = nextRoom;
        if (!rooms[join_room]._userData[cid]) {
            rooms[join_room]._userData[cid] = {};
            if (++rooms[join_room]._nids == game.MAX_PLAYERS_PER_ROOM)
                nextRoom = null;
        }
        return join_room;
    }
    nextRoom = game.ROOM_PREFIX + randomstr.generate(8);
    createAndJoinRoom(nextRoom, cid);
    return nextRoom;
}

function createAndJoinRoom (room, cid)
{
    rooms[room] = {
        _roomId: room,
        _exists: true,
        _userData: { [cid]: {} },
        _nids: 1,
    };
}

// 
// Exports
//

class ChatServer {
    static Initialize(_game) {
        console.log("initializing", _game);
        game = _game;
    }

    static GetNumberOfSubscribers(room_info) {
        var subbed = 0;
        for (var cid in room_info._userData) {
            if (room_info._userData[cid] && room_info._userData[cid]._sub)
                ++subbed;
        }
        return subbed;
    }

    static Publish(room_info, data) {
        if (room_info._exists) {
            bayeux.getClient().publish("/" + room_info._roomId, data);
            return true;
        }
        return false;
    }

    static CloseRoom(room_info) {
        if (room_info._exists && rooms[room_info._roomId]) {
            room_info._exists = false; // In case a reference is still held to this obj
            delete rooms[room_info._roomId];
            return true;
        }
        return false;
    }
}

module.exports = ChatServer;
