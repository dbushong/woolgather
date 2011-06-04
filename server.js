var express = require('express')      // expressjs.com
  , io      = require('socket.io')    // socket.io
  , irc     = require('irc')          // github.com/martynsmith/node-irc
  , rpx     = require('express-rpx')  // github.com/dbushong/connect-rpx
  , mstore  = require('connect-session-mongo') // github.com/bartt/c..-s..-m..
  , app     = express.createServer()
  , socket  = io.listen(app)
  , users   = {}
  , db      = require('mongoskin')
                .db('localhost/woolgather?auto_reconnect')
  ;

//
// Step 1: collect users from db and open active IRC connections
//

/*
db.collection('users').find().each(function (err, user) {
  users[user._id] = user; // cache details in-process
  if (!user.conns) return;
  var conn, cname, client;
  for (cname in user.conns) {
    conn = user.conns[cname];
    if (conn.active) {
      client = new irc.Client(conn.host, conn.nick, { autoConnect: false });
      addIRCClientListeners(client, conn.chans);
      client.connect();
    }
  }
});
*/

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
    console.log('RPX Login', { json: json, err: err });
    console.log('SessionID', req.sessionID);
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

function addIRCClientListeners(client, chans) {
  client.addListener('registered', function () {
    // console.log('registered');
    chans.forEach(function (chan) { client.join(chan); });
  });

  client.addListener('names', function (chan, nicks) {
    console.log('names', chan, nicks);
  });

  client.addListener('topic', function (chan, topic, nick) {
    console.log('topic', chan, topic, nick);
  });

  client.addListener('join', function (chan, topic, nick) {
    console.log('join', chan, topic, nick);
  });

  client.addListener('part', function (chan, nick, reason) {
    console.log('part', chan, nick, reason);
  });

  client.addListener('message', function (from, to, msg) {
    broadcast(from, to, msg);
    if (to == 'dpb' && msg == 'quit') client.disconnect('bye!');
  });

  client.addListener('quit', function (nick, reason, chans) {
    console.log('quit', nick, reason, chans);
  });

  client.addListener('kick', function (chan, nick, by, reason) {
    console.log('kick', chan, nick, by, reason);
  });

  client.addListener('notice', function (nick, to, text) {
    console.log('notice', nick, to, text);
  });

  client.addListener('nick', function (oldnick, newnick, chans) {
    console.log('nick', oldnick, newnick, chans);
  });

  client.addListener('invite', function (chan, from) {
    console.log('invite', chan, from);
  });

  client.addListener('error', function (msg) {
    console.log('error', msg);
  });
}

var webClients = [];
function broadcast(from, to, msg) {
  var act = msg.match(/^\01ACTION\s+(.+)\01$/);
  if (act) msg = act[1];
  webClients.forEach(function (webc) {
    webc.send({ from: from, to: to, msg: msg, action: !!act });
  });
}

