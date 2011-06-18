Status
======

Work has just begun; nothing significant is yet functional.  Next steps:

* Make mongo IRC logging more reliable (avoid date race condition on _id)
* Use session ID cookie to connect Socket.IO connection to web login
* Connection configuration web interface
* New connection scrollback presentation
* Much, much more...

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

Authentication
--------------

For web app login I'll probably use `connect-rpx`, and hopefully bastardize
the session id from this for Socket.IO authentication.

DB Schema
---------

### collection: log_<db.users.<uid>.conns.<name>._id> entry ###
    // required
    { _id:      <objectid>  // implicitly created by mongo; contains timestamp
    , wds:      [ '<word>', ... ] // inc. words from misc. string fields
    // optional, in various combinations
    , msg:      '<text>'    // public, private, or action text
    , from:     '<nick>'    // inc. if not a server msg
    , to:       '<#channel or nick>' // depending on public or private msg
    , action:   true        // inc. if an emote
    , join:     true        // inc. if 'from' joined 'chan'
    , new_nick: '<nick>'    // inc. if 'from' switched nicks
    , left:     true        // inc. if 'from' left 'chan' with reason 'msg'
    , quit:     true        // inc. if 'from' quit 'chan' with reason 'msg'
    , topic:    true        // inc. if 'msg' was a topic change by 'chan'
    , kickee:   '<nick>'    // inc. if 'from' kicked 'kickee' with reason 'msg'
    , invite:   '<chan>'    // inc. if 'from' invited 'to' to channel 'invite'
    }
    db.log_<oid>.ensureIndex({ wds: 1 })
    db.log_<oid>.ensureIndex({ time: 1 })

### collection: users ###
    { _id:      '<rpx ident>'
    , username: '<desired username>'
    , name:     '<real name>'
    , conns:    { '<name>': { _id:      <ObjectId>
                            , host:     '<host>'
                            , port:     <port>
                            , active:   <true|false>
                            , nick:     '<nick>'
                            , user:     '<username>' // TODO
                            , pass:     '<password>' // TODO
                            , chans:    [ '<name>', ... ]
                            }
                , ...
                }
    }

### sample queries ###

#### search for: 'dogs "are cute"'  ####
    db.log_<oi>.find({ wds: { $all: ['dogs', 'are', 'cute'] } })
               .filter(function (hit) {return /\bare\s+cute\b/i.test(hit.msg);}

#### retrieve last 10 msgs for a user ####
    db.log_<oi>.find().sort({ _id: -1 }).limit(10)

Client/Server API
-----------------

All client/server communication will be routed through the Socket.IO connection,
and all messages are thus unidirectional.  All messages both directions are
wrapped in an envelope which looks (for now) like:

    { type: '<message type>'
    , msg:  <message payload>
    }

For example, an `auth` envelope might look like:

    { type: 'auth', msg:  { session_id: 'abc' } }

### Client -> Server Messages ###

#### auth ####
The client will collect the session id from its cookie and pass that through
the socket (which doesn't see the cookie), thus correlating that session socket
with the user.

    { session_id: '<session_id from cookie>' }

#### add_account ####
An expected response would be an *config* msg

    { name: '<connection name>'
    , host: '<host>'
    , port: <port>
    , nick: '<nick>'
    }

#### msg ####
This is for sending chat lines.  The format is the logical subset of fields
from the log collection specification above.  (e.g. no `_id`, `from` or
`wds` fields are needed)  Additionally a connection id should be specified
as field `conn`.  To whit:

    { msg:      '<text>'    // public, private, or action text
    , to:       '<#channel or nick>' // depending on public or private msg
    , action:   true        // inc. if an emote
    , join:     true        // inc. if user joined 'chan'
    , new_nick: '<nick>'    // inc. if user switched nicks
    , left:     true        // inc. if user left 'chan' with reason 'msg'
    , quit:     true        // inc. if user quit 'chan' with reason 'msg'
    , topic:    true        // inc. if 'msg' was a topic change by 'chan'
    , kickee:   '<nick>'    // inc. if user kicked 'kickee' with reason 'msg'
    , invite:   '<chan>'    // inc. if user invited 'to' to channel 'invite'
    }

### Server -> Client Messages ###

#### config ####
This contains the details of the account configuration, in the form of a user
blob from the `users` collection.

#### msg ####
This is for receiving chat lines.  The format is the logical subset of fields
from the log collection specification above.  (e.g. no `wds` field is needed)
Additionally a connection id is specified as field `conn`.  To whit:

    { _id:      <ms since epoch>
    , msg:      '<text>'    // public, private, or action text
    , from:     '<nick>'    // inc. if not a server msg
    , to:       '<#channel or nick>' // depending on public or private msg
    , action:   true        // inc. if an emote
    , join:     true        // inc. if 'from' joined 'chan'
    , new_nick: '<nick>'    // inc. if 'from' switched nicks
    , left:     true        // inc. if 'from' left 'chan' with reason 'msg'
    , quit:     true        // inc. if 'from' quit 'chan' with reason 'msg'
    , topic:    true        // inc. if 'msg' was a topic change by 'chan'
    , kickee:   '<nick>'    // inc. if 'from' kicked 'kickee' with reason 'msg'
    , invite:   '<chan>'    // inc. if 'from' invited user to channel 'invite'
    }
