var express   = require('express')      // expressjs.com
  , io        = require('socket.io')    // socket.io
  , irc       = require('irc')          // github.com/martynsmith/node-irc
  , rpx       = require('express-rpx')  // github.com/dbushong/connect-rpx
  , mstore    = require('connect-session-mongo') // github.com/bartt/...
  , app       = express.createServer()
  , socket    = io.listen(app)
  , irc_conns = {}
  , backlog   = 10 // TODO: make this configurable per connection (channel?)
  , debug     = true // TODO: make this a startup flag
  , db        = require('mongoskin') // TODO: make dbname a startup flag
                  .db('localhost/woolgather?auto_reconnect')
  ;

//
// Step 1: collect users from db and open active IRC connections
//

db.collection('users').findEach(function (err, user) {
  if (!user /* wtf!? */ || !user.conns) return;
  for (var cname in user.conns) {
    if (user.conns[cname].active)
      initIRCClient(user, cname); // TODO use user/pass
  }
});

//
// Step 2: set up RPX authentication
// 
//
rpx.config('ignorePaths',       [ '/stylesheets', '/images', '/javascripts' ]);
rpx.config('reentryPoint',      '/rpx');
rpx.config('logoutPoint',       '/logout');
rpx.config('loginPage',         '/login');
rpx.config('onSuccessfulLogin', function (json, req, res, next) {
  req.sessionStore.regenerate(req, function (err) {
    // console.log('RPX Login', { json: json, err: err });
    // console.log('SessionID', req.sessionID);
    req.session.profile  = json.profile;
    req.session.username = json.profile.identifier;
    res.writeHead(302, { 'Location': '/' });
    res.end();
  });
});
rpx.loadConfig('rpxconf.json'); // should contain { "apiKey": "..." }

//
// Step 2: set up web app
//
app.set('view engine', 'jade');
app.use(express.favicon());
// app.use(express.logger());
app.use(express.cookieParser());
app.use(express.session({ secret: 'kittenz r cute'
                        , store:  new mstore({ db: 'woolgather' })
                        }));
app.use(rpx.handler());
app.use(app.router);
app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.render('index', { title: 'IRC' });
});

app.get('/login', function (req, res) {
  res.render('login', { title: 'Login' });
});

//
// Step 3: set up Socket.IO listener
//
/*
socket.on('connection', function (wclient) {
  console.log('web client connected');
  webClients.push(wclient);
  wclient.on('message', function (msg) {
    var act = msg.msg.match(/^\/me\s+(.+)/);
    if (act) msg.msg = '\01ACTION ' + act[1] + '\01';
    client.say('#node', msg.msg);
    broadcast('dpb', '#node', msg.msg); // fake msg from us
  });
  wclient.on('disconnect', function () { 
    console.log('web client disconnected');
  });
});
*/

//
// Step 4: start webserver
//
app.listen(7776);

//
// Functions
//

function initIRCClient(user, cname) {
  var conn   = user.conns[cname]
    , dblog  = db.collection('log_' + conn._id)
    , client = new irc.Client(conn.host, conn.nick,
                               { autoConnect: false 
                               , userName:    user.username
                               , realName:    user.name
                               , port:        conn.port
                               }
                             )
    ;

  console.log('opening IRC connection "'+cname+'" for user: ' + user._id);

  function log(stuff) {
    // TODO: handle date collisions (in .insert() error handling?)
    stuff._id = new Date;
    // TODO: stemming?
    if (stuff.msg)
      stuff.wds = stuff.msg.replace(/^\s+|\s+$/g, '').replace(/[^\w\s]/g, '')
                           .toLowerCase().split(/\s+/)
    if (stuff.chan) stuff.chan = stuff.chan.replace(/^#/, '');
    dblog.insert(stuff, { safe: debug }, function (err) {
      if (err) console.log('INSERT ERR', err, stuff);
    });
  }

  // grab pointer to channel info cache
  if (!irc_conns[user._id])        irc_conns[user._id] = {};
  if (!irc_conns[user._id][cname]) irc_conns[user._id][cname] = {};
  var iconn = irc_conns[user._id][cname];

  client.addListener('registered', function () {
    conn.chans.forEach(function (chan) {
      if (!iconn[chan]) iconn[chan] = { users: {} };
      client.join(chan);
    });
  });

  client.addListener('motd', function (motd) {
    // TODO: send motd to web client(?)
  });

  client.addListener('names', function (chan, nicks) {
    for (var nick in nicks) iconn[chan].users[nick] = nicks[nick];
    // TODO: send channel init to web client
  });

  client.addListener('topic', function (chan, topic, nick) {
    iconn[chan].topic = topic;
    // TODO: send topic set/change to web client
    log({ msg: topic, from: nick, chan: chan });
  });

  client.addListener('join', function (chan, nick) {
    iconn[chan].users[nick] = '';
    // TODO: update web client
    log({ from: nick, chan: chan, join: true });
  });

  client.addListener('part', function (chan, nick, reason) {
    delete iconn[chan].users[nick];
    // TODO: update web client
    log({ from: nick, chan: chan, left: true, msg: reason });
  });

  client.addListener('message', function (from, to, msg) {
    var action = msg.match(/^\01ACTION\s+(.+)\01$/);
    if (action) msg = action[1];
    // TODO: send msg to web client
    var stuff = { from: from, msg: msg };
    if (/^#/.test(to)) stuff.chan = to;
    if (action) stuff.action = true;
    log(stuff);
  });

  client.addListener('quit', function (nick, reason, chans) {
    chans.forEach(function (chan) {
      // TODO: update web client
      delete iconn[chan].users[nick];
      log({ from: nick, msg: reason, chan: chan, quit: true });
    });
  });

  client.addListener('kick', function (chan, nick, by, reason) {
    delete iconn[chan].users[nick];
    // TODO: update web client
    log({ from: by, kickee: nick, msg: reason, chan: chan });
  });

  client.addListener('notice', function (nick, to, text) {
    // TODO: update web client
    var stuff = { from: nick, msg: text };
    if (/^#/.test(to)) stuff.chan = to;
    // FIXME: log server messages?
    // log(stuff);
  });

  client.addListener('nick', function (oldnick, newnick, chans) {
    chans.forEach(function (chan) {
      // TODO: update web client
      iconn[chan].users[newnick] = iconn[chan].users[oldnick];
      delete iconn[chan].users[oldnick];
      log({ from: oldnick, new_nick: newnick, chan: chan });
    });
  });

  client.addListener('invite', function (chan, from) {
    // TODO: update web client
    log({ from: from, invite: true, chan: chan });
  });

  client.addListener('error', function (msg) {
    // TODO: plumb what varieties of these might exist (need auto-reconnect?)
    // TODO: update web client
  });

  client.connect();
}
