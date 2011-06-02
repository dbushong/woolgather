Status
======

Work has just begun; nothing significant is yet functional.

Overview
========

WoolGather is, basically, a Web-based IRC client.  However, it aspires to be
much more than most existing web irc clients.  Here are some differentiators:

Persistent server connection
----------------------------

* Serves much the same purpose as an IRC bouncer like ZNC
* Logs "scrollback" even when you're not logged into the web app
* Reconnects automatically on server disconnect
* Keeps your nick

Searchable, centralized logging
-------------------------------

* All your logs for all of your channels & private chats will be searchable
* Contextually useful amounts of scrollback will be visible on login

[Socket.io](http://socket.io/) WebSocket-like networking
--------------------------------------------------------

* All traffic to the browser will use the most efficient transport method
  available (depending on your browser)

Self-contained server
---------------------

* Using [Node.js](http://nodejs.org/)

Architecture
============

"What architecture, isn't this just a client in front of the Real Work of an 
IRC Server?"  Oh, if only it were that easy. 

Overview
--------

Logs & user preferences will be persisted in MongoDB, as it provides efficient
methods for log-styled asynchronous storage.  Upon startup, the server will
check the user preferences for desired persistent connections and connect to 
the IRC server, recording messages seen in the relevant channels to the 
database.

When a user logs into the web interface, an appropriate level of scrollback
will be retrieved from the DB (repeated as many times as possible until the
client is up-to-date), then the connection will entire "real-time" mode and
future updates will be sent both to the database and to the client.  Each
real-time update will come with a unique msg identifier, as well as the 
identifier of the immediately preceding msg, guaranteeing that the client
always receives a complete set of messages and allowing it to switch back 
into history playback mode as required.

When the user *sends* a message (and receipt is confirmed by the relevant
server), the message will be logged to the db and only then mirrored back to 
the client for display.

Full-text searching will be faked for now by using an indexed searchable words
array field in Mongo, searched with the `$all` modifier (perhaps stemmed?)
We'll fake multi-word sequence searches w/ post-filtering.

DB Schema
---------

### log ###
    { _id:  <Timestamp>
    , msg:  '<text>'
    , wds:  [ '<word>', ... ]
    , from: '<nick>'
    , act:  <true|false> // roll this into msg somehow for space reasons?
    , to:   { u: '<rpx ident>', c: '<conn name>', t: '<#channel or nick>' }
    }
    db.log.ensureIndex({ "to.u": 1, wds: 1 })

### users ###
    { _id:   '<rpx ident>'
    , conns: { '<name>': { host:     '<host:port>'
                         , ssl:      <true|false>
                         , active:   <true|false>
                         , last_try: <Date>
                         , nick:     '<nick>'
                         , user:     '<username>' // TODO
                         , pass:     '<password>' // TODO
                         , chans:    [ '<name>', ... ]
                         }
             , ...
             }
    }
