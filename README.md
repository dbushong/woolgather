Status
======

Work has just begun; nothing significant is yet functional.  Next steps:

* Connection configuration web interface
* New connection scrollback presentation
* Multiple channel tabbed display
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

When a user logs into the web interface, their connection will be added to 
a list on the server of those connections which should receive live updates.
Additionally, a query will be done for an appropriate amount of backlog
(eventually configurable).  The backlog msgs will be sent asynchronously, and
fun will commence!

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

### collection: log_<db.users.<uid>.conns.<conn oid>> entry ###
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
    , conns:    { '<ObjectId hash>': { host:   '<host>'
                                     , port:   <port>
                                     , active: <true|false>
                                     , nick:   '<nick>'
                                     , user:   '<username>' // TODO
                                     , pass:   '<password>' // TODO
                                     , chans:  [ '<name>', ... ]
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

    { type: 'start', msg:  { session_id: 'abc', last_mid: null } }

### Client -> Server Messages ###

#### start ####
The client will collect the session id from its cookie and pass that through
the socket (which doesn't see the cookie), thus correlating that session socket
with the user.  If this is a reconnection attempt, the message will include
the objectid of the most recent message received, so the server can send only
what was missed.

    { session_id: '<session_id from cookie>'
    , last_mid:   '<hex>' // optional
    }

#### add_acct ####

    { host: '<host>'
    , port: <port>
    , nick: '<nick>'
    }

#### msg ####
This is for sending chat lines.  The format is the logical subset of fields
from the log collection specification above.  (e.g. no `_id`, `from` or
`wds` fields are needed)  Additionally a connection id should be specified
as field `conn`.  To whit:

    { msg:      '<text>'     // public, private, or action text
    , to:       '<#channel or nick>' // depending on public or private msg
    , action:   true         // inc. if an emote
    , join:     true         // inc. if user joined 'chan'
    , new_nick: '<nick>'     // inc. if user switched nicks
    , left:     true         // inc. if user left 'chan' with reason 'msg'
    , quit:     true         // inc. if user quit 'chan' with reason 'msg'
    , topic:    true         // inc. if 'msg' was a topic change by 'chan'
    , kickee:   '<nick>'     // inc. if user kicked 'kickee' with reason 'msg'
    , invite:   '<chan>'     // inc. if user invited 'to' to channel 'invite'
    , conn:     '<oid hash>' // specify which connection this is for
    }

### Server -> Client Messages ###

#### config ####
This contains the details of the account configuration, in the form of a user
blob from the `users` collection.

#### msg ####
This is for receiving chat lines.  The format is the logical subset of fields
from the log collection specification above.  (e.g. no `wds` field is needed)
Additionally a connection id is specified as field `conn`.  To whit:

    { _id:      '<hex>'      // unique msg objectid hex
    , msg:      '<text>'     // public, private, or action text
    , from:     '<nick>'     // inc. if not a server msg
    , to:       '<#channel or nick>' // depending on public or private msg
    , action:   true         // inc. if an emote
    , join:     true         // inc. if 'from' joined 'chan'
    , new_nick: '<nick>'     // inc. if 'from' switched nicks
    , left:     true         // inc. if 'from' left 'chan' with reason 'msg'
    , quit:     true         // inc. if 'from' quit 'chan' with reason 'msg'
    , topic:    true         // inc. if 'msg' was a topic change by 'chan'
    , kickee:   '<nick>'     // inc. if 'from' kicked 'kickee' with reason 'msg'
    , invite:   '<chan>'     // inc. if 'from' invited user to channel 'invite'
    , conn:     '<oid hash>' // specify which connection this is for
    }

Messages are *not* guaranteed to be delivered in order, and there may on 
occasion be duplicates, so, you know, sort that out, client code!

#### error ####
Error messages from the server.  Example:

    { type: 'auth_failed'
    , msg:  'Invalid or expired session'
    }

### Example Sessions ###

#### New User ####

1.  User `alice` logs into the web app using openid, with openid url 
    `http://alice.example.com/`
1.  She is assigned session ID `abcd` in the cookie `woolgather_sid`, and 
    a basic user entry is created for her in the db.
1.  When she successfully loads `/`, Socket.IO will attempt to connect to the 
    server.
1.  Upon successful connection, the client will send a msg of the form:

        { type: 'start'
        , msg:  { session_id: 'abcd' }
        }
1.  The server will verify the sid, correlate her Socket.IO connection with
    her user identity, and reply with a `config` message something like:

        { username: 'exalice42'
        , name:     'Alice Example'
        , conns:    {}
        }
1.  Having no connections configured yet, she'll see a blank chats tab.
1.  She clicks on the Settings tab, displaying a configuration panel noting
    she has no configured connections.
1.  She clicks "Add new connection...", fills in some details and clicks
    "Connect"
1.  The client sends an `add_acct` message to the server like:

        { host: 'irc.freenode.net'
        , port: 6667
        , nick: 'exalice42'
        }
1.  The server replies with a `config` message like:

        { username: 'exalice42'
        , name:     'Alice Example'
        , conns:    { '01234abcdef': { host:   'irc.freenode.net'
                                     , port:   6667
                                     , nick:   'exalice42'
                                     , active: true // default this to false?
                                     , chans:  []
                                     }
                    }
        }
1.  She can now join a channel, maybe from the settings tab, maybe from the
    chat tab, I dunno.  She types in `#kittens`, chooses her existing 
    connection, and clicks "Join"
1.  The client sends a `msg` message to the server something like:

        { to:   '#kittens'
        , join: true
        , conn: '01234abcdef'
        }
1.  The server replies with a `config` message to update the the config with
    the new channel (overkill?)
1.  The server sends a join command to the irc client
1.  The IRC server responds to a successful join with a join message, which
    the server stores in `log_01234abcdef`
1.  The server passes the join msg onto the client; something like:
    `msg` message of the form:

        { _id:  'abc01234'      // unique msg objectid hex w/ timestamp
        , to:   '#kittens'
        , join: true
        , conn: '01234abcdef'
        }
1.  The client, seeing activity for a channel it didn't have a tab for yet,
    creates a new tab and populates it with a "You joined the channel" message
    including a timestamp extracted from the `_id`
1.  She types "hi, everyone!" into the chat field
1.  The client sends a `msg` message:

        { to:   '#kittens'
        , msg:  'hi, everyone!'
        , conn: '01234abcdef'
        }
1.  The server sends this msg on to `irc.freenode.net`
1.  The server adds an entry to a new collection: `log_01234abcdef`:

        { _id:  <objectid>  // created by mongo; contains timestamp
        , wds:  [ 'hi', 'everyone' ]
        , msg:  'hi, everyone!'
        , from: 'exalice42'
        , to:   '#kittens'
        }
1.  The server sends a `msg` message back to the client:

        { _id:  <objectid>  // created by mongo; contains timestamp
        , wds:  [ 'hi', 'everyone' ]
        , msg:  'hi, everyone!'
        , from: 'exalice42'
        , to:   '#kittens'
        , conn: '01234abcdef'
        }
