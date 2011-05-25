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
