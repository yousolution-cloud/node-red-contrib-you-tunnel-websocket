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
    };
  }

  RED.nodes.registerType('wstunnel', WSTunnelNode);

  function WSTunnelServer(n) {
    //const wsPort = parseInt(process.env.WS_PORT || "4443", 10);

    // instances[n.id] = instances[n.id] || {};
    // instances[n.id].server = instances[n.id].server || null;
    // instances[n.id].wss = instances[n.id].wss || null;
    // instances[n.id].websocketServer = instances[n.id].websocketServer || null;

    RED.nodes.createNode(this, n);
    this.tunnelConfig = RED.nodes.getNode(n.wstunnel);
    let node = this;
    const id = n.id;

    node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });

    const name = node.tunnelConfig.options.name;
    const host = node.tunnelConfig.options.host;
    const port = node.tunnelConfig.options.port;
    const path = node.tunnelConfig.options.path;
    const tunnelIdHeaderName = node.tunnelConfig.options.tunnelIdHeaderName;

    instances[node.id] = instances[node.id] || { state: {} };

    for (const p in instances[node.id].state) {
      const old = instances[node.id].state[p];
      if (old.webSocketServer) {
        old.webSocketServer.close(() => {
          console.log(`Closed old WebSocketServer on port ${p}`);
        });
      }
      delete instances[node.id].state[p];
    }

    instances[node.id].state = startWebSocketServer({
      port,
      tunnelIdHeaderName,
    });

    console.log(`node id: ${node.id}`);

    // if (instances[node.id].state[port].webSocketServer) {
    //   console.log('A');
    //   instances[node.id].state[port].webSocketServer.close(() => {
    //     console.log(`Server closed ${node.id} ${port}. Reconnecting...`);

    //     instances[node.id].state = startWebSocketServer({
    //       port,
    //       tunnelIdHeaderName,
    //     });
    //     onListening();
    //   });
    // }

    // if (!instances[node.id].state[port].webSocketServer) {
    //   console.log('B');

    //   instances[node.id].state = startWebSocketServer({
    //     port,
    //     tunnelIdHeaderName,
    //   });
    // }

    if (instances[node.id].state[port].webSocketServer) {
      onListening();
    }

    function onListening() {
      instances[node.id].state[port].webSocketServer.on('listening', () => {
        node.status({
          fill: 'green',
          shape: 'dot',
          text: `listening on port ${port}`,
        });
      });

      instances[node.id].state[port].webSocketServer.on('connection', (ws) => {
        // node.status({
        //   fill: "green",
        //   shape: "dot",
        //   text: `listening on port ${port}`,
        // });
        const clientAddress = ws._socket.remoteAddress;
        const clientPort = ws._socket.remotePort;
        const totalClients = instances[node.id].state[port].webSocketServer.clients.size;

        node.status({
          fill: 'green',
          shape: 'dot',
          text: `clients ${totalClients}`,
        });

        console.log(`WebSocket connection established from ${clientAddress}:${clientPort}`);
        console.log(`Total connected clients: ${totalClients}`);

        ws.on('close', () => {
          const remainingClients = instances[node.id].state[port].webSocketServer.clients.size;

          node.status({
            fill: 'green',
            shape: 'dot',
            text: `clients ${remainingClients}`,
          });
          console.log(`WebSocket client disconnected: ${clientAddress}:${clientPort}`);
          console.log(`Total connected clients: ${remainingClients}`);
        });
      });
    }
  }

  RED.nodes.registerType('wstunnel server', WSTunnelServer);
};
