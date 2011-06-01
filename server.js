var express = require('express')      // expressjs.com
  , io      = require('socket.io')    // socket.io
  , irc     = require('irc')          // github.com/martynsmith/node-irc
  , app     = express.createServer()
  , socket  = io.listen(app)
  ;

var webClients = [];

function broadcast(from, to, msg) {
  var act = msg.match(/^\01ACTION\s+(.+)\01$/);
  if (act) msg = act[1];
  webClients.forEach(function (webc) {
    webc.send({ from: from, to: to, msg: msg, action: !!act });
  });
}

var client = new irc.Client('localhost', 'dpb', { autoConnect: false });

client.addListener('registered', function () {
  console.log('registered');
  client.join('#node');
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

client.connect();

app.set('view engine', 'jade');
app.use(express.logger());
app.use(express.cookieParser());
app.use(express.session({ secret: 'kittensz r cute' }));
app.use(app.router);
app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.render('index', { title: 'IRC' });
});

app.listen(7776);

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
