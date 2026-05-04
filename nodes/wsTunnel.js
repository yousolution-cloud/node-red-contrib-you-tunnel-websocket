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
const { startWebSocketServer, stopWebSocketServer } = require('@remotelinker/reverse-ws-tunnel/server');
const { logger, setLogContext, setLogLevel } = require('@remotelinker/reverse-ws-tunnel/utils');

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
    setLogContext('TunnelNode-' + node.tunnelConfig.options.name);
    setLogLevel(logLevel);

    node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
    const port = node.tunnelConfig.options.port;
    const host = node.tunnelConfig.options.host ? '' : undefined;
    const path = node.tunnelConfig.options.path ? '' : undefined;
    const tunnelIdHeaderName = node.tunnelConfig.options.tunnelIdHeaderName;
    instances[id] = instances[id] || {};
    // Cleanup any existing server on this port before starting
    // This handles cases where previous deployment didn't cleanup properly
    stopWebSocketServer(port)
      .then(() => {
        logger.info(`Cleaned up any existing server on port ${port} before starting`);
        return startWebSocketServer({
          port,
          host,
          path,
          tunnelIdHeaderName,
        });
      })
      .then((state) => {
        instances[id].state = state;
        logger.info(`Started WebSocketServer for node ${id} on port ${port}`);
        if (instances[id].state[port].webSocketServer) {
          onListening();
        }
      })
      .catch((err) => {
        logger.error(`Error starting WebSocketServer on port ${port}:`, err);
        node.status({
          fill: 'red',
          shape: 'dot',
          text: `error: ${err.message}`,
        });
      });
    function onListening() {
      const server = instances[id].state[port].webSocketServer;
      server.on('listening', () => {
        logger.info('Listening ' + id);
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
        logger.info(`WebSocket connection from ${clientAddress}:${clientPort}`);
        logger.info(`Total connected clients: ${totalClients}`);
        ws.on('close', () => {
          const remainingClients = server.clients.size;
          node.status({
            fill: 'green',
            shape: 'dot',
            text: `clients ${remainingClients}`,
          });
          logger.info(`Client disconnected: ${clientAddress}:${clientPort}`);
          logger.info(`Remaining clients: ${remainingClients}`);
        });
      });
    }
    this.on('close', function (removed, done) {
      logger.info(`[DEBUG] Close called for node ${id}, removed=${removed}`);

      if (instances[id] && instances[id].state && instances[id].state[port]) {
        stopWebSocketServer(port)
          .then(() => {
            logger.info(`Cleaned up WebSocketServer on port ${port} for node ${id}`);
            delete instances[id];
            done();
          })
          .catch((err) => {
            console.error(`Error stopping server on port ${port}:`, err);
            delete instances[id];
            done();
          });
      } else {
        logger.info(`No server state found for node ${id} on port ${port}`);
        done();
      }
    });
  }
  RED.nodes.registerType('wstunnel server', WSTunnelServer);
};
