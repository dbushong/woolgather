var express = require('express')
  , io      = require('socket.io')
  , app     = express.createServer()
  , socket  = io.listen(app)
  ;

app.set('view engine', 'jade');
app.use(express.cookieParser());
app.use(express.session({ secret: 'kittensz r cute' }));
app.use(app.router);
app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  req.session.times = (req.session.times || 0) + 1;
  res.render('index', { title: 'Home', times: req.session.times });
});

socket.on('connection', function (client) {
  client.on('message', function () {
  });
  // client.on('disconnect', function () { });
});

app.listen(7776);
