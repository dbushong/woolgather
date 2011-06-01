function connectClient() {
  var socket = new io.Socket();
  var  log   = $('#log')[0];
  socket.on('connect', function () {
    log.appendChild(document.createTextNode('CONNECTED'));
  });
  socket.on('message', function (msg) {
    var div  = document.createElement('div')
      , from = document.createElement('b')
      , text = document.createElement('span')
      ;
    from.appendChild(document.createTextNode('<' + msg.from + '> '));
    div.appendChild(from);
    text.appendChild(document.createTextNode(msg.msg));
    if (!/^#/.test(msg.to)) text.style.fontStyle = 'italic';
    div.appendChild(text);
    log.appendChild(div);
  });
  socket.on('disconnect', function () {
    log.appendChild(document.createTextNode('DISCONNECTED'));
  });
  socket.connect();
}
