// const { create } = require('domain');
import { createServer } from 'http';
import express, { json, urlencoded } from 'express';
import { generate } from "randomstring";
import morgan from 'morgan';
import fayeImport from 'faye';
const { NodeAdapter } = fayeImport;

import { __basedir } from '../basedir.js';

//
//  General chatroom functions
//

export class ChatServer {

  DebugLevel = 1;

  maxPlayersPerRoom;
  roomPrefix;

  bayeux;
  app;
  server;
  rooms = {};
  nextRoom;

  onMessagePublished = (cid, room_info, msg) => { };
  onUserSubscribed = (cid, room_info) => { };
  onUserUnsubscribed = (cid, room_info) => { };
  onUserJoinedRoom = (cid, room_info, resp) => { };
  
  constructor(maxPlayersPerRoom, roomPrefix) {
    if (this.DebugLevel) console.log("initializing ChatServer");

    this.maxPlayersPerRoom = maxPlayersPerRoom ?? 5;
    this.roomPrefix = roomPrefix ?? "room_";

    this.bayeux = new NodeAdapter({
      mount: '/faye',
      timeout: 45
    });
        
    this.app = express();
    this.server = createServer(this.app);
        
    this.bayeux.attach(this.server);
        
    // Room dictionary:
    // <room-name>: {
    //   _nids: <num-of-players>,
    //   _userData: {   <-- all client ids
    //     <id>: {
    //       _sub: <bool>   <-- Subscribed?
    //     }
    //   },
    // }
        
    // Message received on any channel
    this.bayeux.on('publish', (cid, room, msg) => {
      room = room.substr(1); // remove /
      if (this.DebugLevel >= 2) console.log("-------- publish ", room, cid, msg);
      this.onMessagePublished(cid, this.rooms[room], msg);
    });
        
    // Subscribed to a channel
    this.bayeux.on('subscribe', (cid, room) => {
      room = room.substr(1); // remove /
      if (this.DebugLevel >= 2) console.log("-------- subscribe ", room, cid);
      var room_info = this.rooms[room];
      if (room_info) {
        var user_data = room_info._userData[cid];
        if (user_data) {
          user_data._sub = true;
          this.onUserSubscribed(cid, room_info);
        }
      }
    });
        
    // Disconnect + unsubscribe
    this.bayeux.on('unsubscribe', (cid, room) => {
      room = room.substr(1); //TODO REGEX
      if (this.DebugLevel >= 2) console.log("-------- unsubscribe ", room, cid);
      var room_info = this.rooms[room];
      if (room_info) {
        var user_data = room_info._userData[cid];
        if (user_data) {
          user_data._sub = false;
          this.onUserUnsubscribed(cid, room_info);
        }
        delete room_info._userData[cid];
      }
    });
        
    const publicDir = `${__basedir}/public`;
    const port = process.env.SERVER_PORT || 3030;

    // Open file server etc
    this.app.use(morgan("combined"));
    this.app.use(json());
    this.app.use(urlencoded({ extended: false }));
    this.app.use(express.static(publicDir));
        
    // app.get('/', (req, res) => {
    //     res.send('Hello World!');
    // });
        
    // Accept dispatch message via HTTP and connect to room
    this.app.post('/dispatch', (req, res) => {
      var msg = req.body;
      var resp = {
        op: "joinResp"
      };
      var cid = msg.cid;
        
      switch (msg.op) {
        case "joinReq":
          if (this.DebugLevel >= 2) console.log("Client ID ", cid, " joining room ", msg.room);
          resp.room = this.assignUserToRoom(cid, msg.room);
          if (resp.room)
            this.onUserJoinedRoom(cid, this.rooms[resp.room], resp);
          break;
        default:
          resp.error = "Unknown command";
      }
      console.log("Got", msg, "sending", resp);
      res.send(resp);
    });
        
    this.server.listen(port);
    if (this.DebugLevel) console.log(`Server up and listening on port ${port}, folder ${publicDir}`);

  }

  getNumberOfSubscribers(room_info) {
    var subbed = 0;
    for (let cid in room_info._userData) {
      if (room_info._userData[cid] && room_info._userData[cid]._sub)
        ++subbed;
    }
    return subbed;
  }

  publishMessage(room_info, data) {
    if (room_info._exists) {
      this.bayeux.getClient().publish("/" + room_info._roomId, data);
      return true;
    }
    return false;
  }

  closeRoom(room_info) {
    if (room_info._exists && this.rooms[room_info._roomId]) {
      room_info._exists = false; // In case a reference is still held to this obj
      delete this.rooms[room_info._roomId];
      return true;
    }
    return false;
  }

  // Join requested room (or any if req_room is undefined), returns name of room or null if can't join
  assignUserToRoom(cid, req_room) {
    // Specified
    if (req_room) {
      // absent
      if (!this.rooms[req_room]) {
        this.createAndJoinRoom(req_room, cid);
        return req_room;
      }
      // exists
      if (this.rooms[req_room]._nids < this.maxPlayersPerRoom) {
        if (!this.rooms[req_room]._userData[cid]) {
          ++this.rooms[req_room]._nids;
          this.rooms[req_room]._userData[cid] = {};
          return req_room;
        }
      }
    }

    // Room not specified
    if (this.nextRoom && this.rooms[this.nextRoom]) {
      var join_room = this.nextRoom;
      if (!this.rooms[join_room]._userData[cid]) {
        this.rooms[join_room]._userData[cid] = {};
        if (++this.rooms[join_room]._nids == this.maxPlayersPerRoom)
          this.nextRoom = null;
      }
      return join_room;
    }
    this.nextRoom = this.roomPrefix + generate(8);
    this.createAndJoinRoom(this.nextRoom, cid);
    return this.nextRoom;
  }

  createAndJoinRoom(room, cid) {
    this.rooms[room] = {
      _roomId: room,
      _exists: true,
      _userData: { [cid]: {} },
      _nids: 1,
    };
  }

}
