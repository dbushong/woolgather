// TODO: emulate console.* for sucky browsers

var socket
  , config
  , listeners = { msg:    receiveMsg
                , config: updateConfig
                , error:  handleError
                }
  ;

function setStatus(msg) {
  $('#status').text(msg).show('fast');
}

function resetChannelTabs() {
  $('#chan-tabs').tabs('#chan-panes > div');
}

function receiveMsg(msg) {
  /* TODO: rewrite
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
  */
}

function updateConfig(cfg) {
  // TODO: something more interesting
  console.log('CONFIG: ', cfg);

  // update global cache
  config = cfg;

  // rebuild HTML display
  var $alist = $('#account-list tbody');
  $alist.empty(); 

  // no connections?
  if (!cfg.conns) {
    $('#account-list table').hide();
    return;
  }

  var cid, conn, $row;
  for (cid in cfg.conns) {
    conn = cfg.conns[cid];
    $row = $('<tr id="conn_' + cid + '">'
           +   '<td><input type="checkbox"></td>'
           +   '<td class="list-nick"></td>'
           +   '<td class="list-host"></td>'
           + '</tr>');
    $row.find('input')[0].checked = conn.active;
    $row.find('.list-nick').text(conn.nick);
    $row.find('.list-host').text(conn.host);
    $alist.append($row);
  }
  $('#account-list table').show();
}

function handleError(err) {
  if (err.type == 'auth_failed') window.location = '/login';
  console.error('SERVER ERROR: ', err);
}

function send(type, msg) {
  socket.send({ type: type, msg: msg });
}

$(document).ready(function () {
  var sid = $.cookie('woolgather_sid');

  if (!sid) {
    console.error('Failed to acquire session id from cookie; aborting');
    return;
  }

  socket = new io.Socket();

  // start things off by handshaking w/ server once we're connected
  socket.on('connect', function () {
    console.log('connected');
    send('start', { session_id: sid });
  });

  // register a generic message dispatcher for our listeners
  socket.on('message', function (msg) {
    if (!msg || !msg.type || !msg.msg) {
      console.error("Invalid message: ", msg);
      return;
    }
    var func = listeners[msg.type];
    if (!func) {
      console.error("Unhandled message type: ", msg);
      return;
    }
    func(msg.msg);
  });


  socket.on('disconnect', function () {
    // TODO something else about this?
    setStatus('Disconnected at ' + (new Date));
  });

  socket.connect();

  $('#status').click(function () { $(this).hide('fast'); });

  resetChannelTabs();
});
