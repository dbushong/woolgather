function init() {
  var socket = new io.Socket();
  var  log   = $('#log')[0];
  socket.on('connect', function () {
    log.appendChild(document.createTextNode('CONNECTED'));
  });
  socket.on('message', function (msg) {
    var div   = document.createElement('div')
      , from  = document.createElement('b')
      , text  = document.createElement('span')
      , froms = msg.action ? '(*) ' + msg.from + ' ' : '<' + msg.from + '> '
      ;
    from.appendChild(document.createTextNode(froms));
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

  var $line = $('#line');
  $('#entry').submit(function () {
    socket.send({ msg: $line.val() });
    $line.val('');
    $line.focus();
    return false;
  });
  $line.focus();
}
