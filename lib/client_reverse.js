//###############################################################################
//##
//# Copyright (C) 2014-2015 Andrea Rocco Lotronto, 2017 Nicola Peditto
//##
//# Licensed under the Apache License, Version 2.0 (the "License");
//# you may not use this file except in compliance with the License.
//# You may obtain a copy of the License at
//##
//# http://www.apache.org/licenses/LICENSE-2.0
//##
//# Unless required by applicable law or agreed to in writing, software
//# distributed under the License is distributed on an "AS IS" BASIS,
//# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//# See the License for the specific language governing permissions and
//# limitations under the License.
//##
//###############################################################################
const log4js = require('log4js');
var logger = log4js.getLogger('wstun:client_reverse');

var WebSocketClient = require('websocket').client;
var net = require("net");
const EventEmitter = require('events').EventEmitter;
const util = require('util');

var bindSockets = require("./bindSockets_reverse");

wst_client_reverse = function() {
  this.wsClientForControll = new WebSocketClient();
};
util.inherits(wst_client_reverse, EventEmitter);


wst_client_reverse.prototype.start = function(portTunnel, wsHostUrl, remoteAddr) {
  const self = this;
  //Getting paramiters
  var url = require("url");
  var urlWsHostObj = url.parse(wsHostUrl);
  var _ref1 = remoteAddr.split(":"), remoteHost = _ref1[0], remotePort = _ref1[1];

  var proto = wsHostUrl.split(":")[0];
  if(proto == "wss")
    require("../lib/https_override");

  url = "" + wsHostUrl + "/?dst=" + urlWsHostObj.hostname+":"+portTunnel;
  
  logger.trace("[SYSTEM] - Connecting to", wsHostUrl);
  logger.trace("[SYSTEM] --> exposing", remoteAddr, "on port", portTunnel);

  //Connection to Controll WS Server
  this.wsClientForControll.connect(url, 'tunnel-protocol');

  this.wsClientForControll.removeAllListeners('connect');
  this.wsClientForControll.once('connect', (function(_this){

    return function(wsConnectionForControll) {

      self.emit('connected');
      logger.trace('Connected');

      wsConnectionForControll.once('close',function(reasonCode, description){
        logger.trace("[SYSTEM] --> TCP connection closed!",reasonCode,description);
        self.emit('close',description);
      });
      wsConnectionForControll.once('error',function(err){
        logger.trace("[SYSTEM] --> TCP connection error!",err.toString());
        self.emit('error',err);
      });

      logger.trace("[SYSTEM] --> TCP connection established!");

      wsConnectionForControll.on('message', function(message) {

        //Only utf8 message used in Controll WS Socket
        var parsing = message.utf8Data.split(":");
        
        //Managing new TCP connection on WS Server
        if (parsing[0] === 'NC'){

          //Identification of ID connection
          var idConnection = parsing[1];

          this.wsClientData = new WebSocketClient();
          this.wsClientData.connect(wsHostUrl+"/?id="+idConnection, 'tunnel-protocol');

          this.wsClientData.on('close',(function(_this){
            return function(){
              logger.trace('client data closed');
            }
          })(this));
          //Management of new WS Client for every TCP connection on WS Server
          this.wsClientData.on('connect', (function(_this){

            return function(wsConnectionForData){

              //Waiting of WS Socket with WS Server
              wsConnectionForData.socket.pause();

              //DEBUG logger.trace("Connected wsClientData to WS-Server for id "+parsing[1]+" on localport::"+wsConnectionForData.socket.localPort);
              logger.trace("[SYSTEM] --> Start TCP connection on client to "+remoteHost+":"+remotePort);

              tcpConnection(wsConnectionForData, remoteHost, remotePort);

            }
          })(this));

        }
      });

    }
    
  })(this));



  //Management of WS Connection failed
  this.wsClientForControll.once('connectFailed', function(error) {
    logger.trace("[SYSTEM] --> WS connect error: " + error.toString());
    self.emit('connectFailed',error);
  });


};

function tcpConnection(wsConn, host, port){

  var tcpConn = net.connect( {port: port, host: host}, function(){});
  bindSockets(wsConn, tcpConn);

  tcpConn.on("connect",function(){
    //Resume of the WS Socket after the connection to WS Server
    wsConn.socket.resume();
  });

  tcpConn.on("close",function(){
    logger.trace("[SYSTEM] --> tcp connection closed");
  });

  tcpConn.on('error',(function(_this){
    return function(request){
      logger.trace("[SYSTEM] --> "+request);
    }
  })(this));

  //wst_client_reverse

}

module.exports = wst_client_reverse;
