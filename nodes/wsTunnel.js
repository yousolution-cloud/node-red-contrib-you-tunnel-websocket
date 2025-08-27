/**
 * Copyright 2015 Atsushi Kojo.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
const { startWebSocketServer } = require('reverse-ws-tunnel/server');
const { setLogLevel } = require('reverse-ws-tunnel/utils');

const instances = {};

module.exports = function (RED) {
  'use strict';

  function WSTunnelNode(n) {
    RED.nodes.createNode(this, n);

    this.options = {
      name: n.name || 'websocket tunnel',
      host: n.host || 'localhost',
      port: n.port || 443,
      path: n.path || '',
      tunnelIdHeaderName: n.tunnelIdHeaderName || 'x-tunnel-id',
      logLevel: n.logLevel || 'info',
    };
  }

  RED.nodes.registerType('wstunnel', WSTunnelNode);

  function WSTunnelServer(n) {
    RED.nodes.createNode(this, n);
    this.tunnelConfig = RED.nodes.getNode(n.wstunnel);
    const node = this;
    const id = node.id;

    // Set the log level dynamically based on configuration
    const logLevel = node.tunnelConfig.options.logLevel || 'info';
    setLogLevel(logLevel);

    node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });

    const port = node.tunnelConfig.options.port;
    const tunnelIdHeaderName = node.tunnelConfig.options.tunnelIdHeaderName;

    instances[id] = instances[id] || { state: {} };

    if (instances[id].state[port]) {
      console.warn(`Server already running on port ${port} for node ${id}. Skipping creation.`);
      node.status({
        fill: 'green',
        shape: 'dot',
        text: `listening on port ${port}`,
      });
      return;
    }

    instances[id].state = startWebSocketServer({
      port,
      tunnelIdHeaderName,
    });

    console.log(`Started WebSocketServer for node ${id} on port ${port}`);

    if (instances[id].state[port].webSocketServer) {
      onListening();
    }

    function onListening() {
      const server = instances[id].state[port].webSocketServer;

      server.on('listening', () => {
        console.log('Listening ' + id);
        node.status({
          fill: 'green',
          shape: 'dot',
          text: `listening on port ${port}`,
        });
      });

      server.on('connection', (ws) => {
        const clientAddress = ws._socket.remoteAddress;
        const clientPort = ws._socket.remotePort;
        const totalClients = server.clients.size;

        node.status({
          fill: 'green',
          shape: 'dot',
          text: `clients ${totalClients}`,
        });

        console.log(`WebSocket connection from ${clientAddress}:${clientPort}`);
        console.log(`Total connected clients: ${totalClients}`);

        ws.on('close', () => {
          const remainingClients = server.clients.size;
          node.status({
            fill: 'green',
            shape: 'dot',
            text: `clients ${remainingClients}`,
          });
          console.log(`Client disconnected: ${clientAddress}:${clientPort}`);
          console.log(`Remaining clients: ${remainingClients}`);
        });
      });
    }

    this.on('close', function (removed, done) {
      if (instances[id] && instances[id].state && instances[id].state[port]) {
        const server = instances[id].state[port].webSocketServer;
        if (server) {
          try {
            for (const client of server.clients) {
              try {
                client.removeAllListeners();
                client.close();
              } catch (clientErr) {
                console.error(`Error terminating client on port ${port}:`, clientErr);
              }
            }

            server.close(() => {
              console.log(`Closed WebSocketServer on port ${port} during node shutdown`);
            });
          } catch (err) {
            console.error(`Error closing WebSocketServer on port ${port}:`, err);
          }
        }

        delete instances[id].state[port];

        // Se non ci sono più porte attive per questo nodo, cancella del tutto
        if (Object.keys(instances[id].state).length === 0) {
          delete instances[id];
        }
      }

      done();
    });
  }

  RED.nodes.registerType('wstunnel server', WSTunnelServer);
};
