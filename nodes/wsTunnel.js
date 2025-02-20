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
const WebSocket = require('ws');
const { Buffer } = require('buffer');
const net = require('net');
const { v4: uuidv4 } = require('uuid');
const tls = require('tls');

const PING_INTERVAL = 1000 * 30; // in seconds
const instances = {};
const HTTP_TIMEOUT = 1000 * 30; // in seconds
const RECONNECT_INTERVAL = 1000 * 5;

module.exports = function (RED) {
  'use strict';

  function WSTunnelNode(n) {
    RED.nodes.createNode(this, n);

    const [dstProtocol, dstHost, dstPort] = getProtocolAndHostAndDefautlPort(n.dstAddr);

    // console.log('{}{}{}{}{}{}{}{}');
    // console.log(dstProtocol);
    // console.log(dstHost);
    // console.log(dstPort);
    // console.log('{}{}{}{}{}{}{}{}');

    this.options = {
      name: n.name || 'websocket tunnel',
      host: n.host || 'localhost',
      port: n.port || 8083,

      srcAddr: n.srcAddr || 'localhost',
      srcPort: n.srcPort,
      dstAddr: dstHost || 'localhost',
      dstPort: n.dstPort || dstPort || 80,
      timeout: n.timeout || HTTP_TIMEOUT,
    };
  }

  RED.nodes.registerType('wstunnel', WSTunnelNode);

  function WSTunnelClient(n) {
    RED.nodes.createNode(this, n);
    let node = this;
    this.status({});

    const websocketURL = n.url;

    if (!websocketURL) {
      node.status({ fill: 'red', shape: 'dot', text: 'The URL is invalid or not defined.' });
      return;
    }

    function connectWebSocket() {
      let options = undefined;
      // Crea una connessione al server WebSocket
      const ws = new WebSocket(websocketURL, options);

      // Quando la connessione è aperta, invia un messaggio al server
      ws.on('open', () => {
        console.log('Connected to the WebSocket server');
        node.status({ fill: 'green', shape: 'dot', text: 'WebSocket tunnel established' });
      });

      // Quando ricevi un messaggio dal server, stampalo
      ws.on('message', async (data) => {
        // console.log('Received from server: ', data);
        // console.log('Received Base64 encoded HTTP RAW request:');

        // Decodifica la stringa Base64
        try {
          // const request = JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));
          // const rawHttpRequest = Buffer.from(request.httpRequest, 'base64').toString('utf-8');
          // console.log('Decoded HTTP RAW Request:', request.httpRequest);

          const extractedUUID = data.slice(0, 36);
          // console.log(extractedUUID);
          const res = await incomingRequest(data.slice(36)); // tolgo dal buffer uuid
          // console.log('======');
          // console.log(res.toString('utf-8'));
          // console.log('======');
          ws.send(Buffer.concat([extractedUUID, res]));
        } catch (error) {
          console.log(error);
        }
      });

      // Gestione degli errori di connessione
      ws.on('error', (error) => {
        node.status({ fill: 'red', shape: 'dot', text: 'Websocket error.' });
        console.error('Error occurred: ', error);
      });

      // Quando la connessione è chiusa, stampa un messaggio
      ws.on('close', () => {
        console.log('Disconnected from the WebSocket server');
        node.status({ fill: 'red', shape: 'ring', text: 'Disconnected from the WebSocket server' });
        setTimeout(connectWebSocket, RECONNECT_INTERVAL);
      });
    }

    connectWebSocket();

    async function incomingRequest(rawHttpRequest) {
      const { hostname, port } = extractHostAndPort(rawHttpRequest);

      if (port == 443) {
        return await tlsRequest(rawHttpRequest);
      }

      return await tcpRequest(rawHttpRequest);
    }

    function tlsRequest(rawHttpRequest) {
      return new Promise((resolve, reject) => {
        const { hostname, port } = extractHostAndPort(rawHttpRequest);

        let responseData = Buffer.alloc(0); // Inizializza un buffer vuoto per accumulare i dati

        // console.log(hostname);
        // console.log(port);
        // Creazione di un socket TCP
        const client = tls.connect(port, hostname, { servername: hostname }, () => {
          client.write(rawHttpRequest); // Invia la richiesta HTTP raw
        });

        // Ricevi i dati dalla risposta del server
        client.on('data', (data) => {
          // console.log('Received response from server:');
          // console.log(data.toString()); // Converte i dati ricevuti in stringa e li stampa
          // return resolve(data);
          responseData = Buffer.concat([responseData, data]); // Accumula i dati ricevuti
        });

        // Quando la connessione si chiude
        client.on('end', () => {
          console.log('Connection closed');
          resolve(responseData);
          // client.destroy()
        });

        // Gestione degli errori
        client.on('error', (err) => {
          reject(err);
          console.error('Error:', err);
        });
      });
    }

    function tcpRequest(rawHttpRequest) {
      return new Promise((resolve, reject) => {
        const { hostname, port } = extractHostAndPort(rawHttpRequest);

        let responseData = Buffer.alloc(0); // Inizializza un buffer vuoto per accumulare i dati

        // console.log(hostname);
        // console.log(port);

        // Creazione di un socket TCP
        const client = net.createConnection(port, hostname, () => {
          client.write(rawHttpRequest); // Invia la richiesta HTTP raw
        });

        // Ricevi i dati dalla risposta del server
        client.on('data', (data) => {
          responseData = Buffer.concat([responseData, data]); // Accumula i dati ricevuti
        });

        // Quando la connessione si chiude
        client.on('end', () => {
          console.log('Connection closed');
          resolve(responseData);
        });

        // Gestione degli errori
        client.on('error', (err) => {
          reject(err);
          console.error('Error:', err);
        });
      });
    }

    function extractHostAndPort(rawHttp) {
      const hostPattern = /Host:\s*([^\r\n]+)/i; // Regex per trovare la linea Host
      const rawHttpString = rawHttp.toString('utf-8');
      const match = rawHttpString.match(hostPattern);

      if (!match) {
        throw new Error('Host non trovato nella stringa HTTP raw');
      }

      const host = match[1];
      const [hostname, port = 443] = host.split(':'); // Porta di default 443 per HTTPS

      return { hostname, port: parseInt(port, 10) };
    }

    this.url = n.url;
    // this.operation = n.operation;
    // this.filename = n.filename;
    // this.fileExtension = n.fileExtension;
    // this.workdir = n.workdir;
    // this.tunnelConfig = RED.nodes.getNode(this.tunnel);

    // const globalContext = this.context().global;

    // if (!this.tunnelConfig) {
    //   this.error('missing tunnel Websocket configuration');
    //   return;
    // }

    // Hack for async function
    // setTimeout(async () => {
    //   await connect(node);
    // });

    // node.on('input', async (msg, send, done) => {
    //   setTimeout(async () => {
    //     await connect(node);
    //   }, node.tunnelConfig.options.reconnectTimeout);
    // });
  }
  RED.nodes.registerType('wstunnel client', WSTunnelClient);

  function WSTunnelServer(n) {
    instances[n.id] = instances[n.id] || {};
    instances[n.id].server = instances[n.id].server || null;
    instances[n.id].wss = instances[n.id].wss || null;
    instances[n.id].websocketServer = instances[n.id].websocketServer || null;

    RED.nodes.createNode(this, n);
    this.tunnelConfig = RED.nodes.getNode(n.wstunnel);
    let node = this;
    const id = n.id;

    node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });

    const port = node.tunnelConfig.options.port;
    const srcAddr = node.tunnelConfig.options.srcAddr || 'localhost';
    const srcPort = node.tunnelConfig.options.srcPort || 8083;
    const dstAddr = node.tunnelConfig.options.dstAddr || 'localhost';
    const dstPort = node.tunnelConfig.options.dstPort || 80;
    const timeout = node.tunnelConfig.options.timeout || HTTP_TIMEOUT;
    // const port = 4443;

    // console.log('+++++++++ OPTIONS ++++++++');
    // console.log(port);
    // console.log(dstPort);
    // console.log(dstAddr);
    // console.log(timeout);
    // console.log('+++++++++ OPTIONS ++++++++');
    const options = {
      id,
      port,
      srcAddr,
      srcPort,
      dstAddr,
      dstPort,
      timeout,
    };

    if (instances[options.id].server) {
      instances[options.id].server.close(() => {
        TCPServer(options);
      });
    } else {
      TCPServer(options);
    }

    if (instances[n.id].wss) {
      instances[n.id].wss.close(() => {
        webSocketServer(node, options);
      });
    } else {
      webSocketServer(node, options);
    }
  }

  function requestFromServer(message, options) {
    return new Promise((resolve, reject) => {
      if (!instances[options.id].websocketServer) {
        return reject(new WebsocketTunnelError('WebSocket connection not established.', 500));
      }

      const uuid = uuidv4();
      const uuidBuffer = Buffer.from(uuid);
      const resultBuffer = Buffer.concat([uuidBuffer, Buffer.from(message)]);

      const timeoutId = setTimeout(() => {
        clearTimeout(timeoutId);
        reject('Timeout: No response from the client.');
      }, options.timeout);

      const onMessage = (response) => {
        // console.log(response.toString());
        const extractedUUID = response.slice(0, 36);
        if (Buffer.compare(uuidBuffer, extractedUUID) === 0) {
          resolve(response.slice(36));
          instances[options.id].websocketServer.removeListener('message', onMessage);
          clearTimeout(timeoutId);
        }
      };
      instances[options.id].websocketServer.on('message', onMessage);

      instances[options.id].websocketServer.send(resultBuffer);
    });
  }

  function webSocketServer(node, options) {
    try {
      instances[node.id].wss = new WebSocket.Server({ port: options.port });
    } catch (error) {
      console.log(error);
    }

    instances[node.id].wss.on('listening', () => {
      console.log(`WebSocket server is listening on port ${options.port}`);
    });

    instances[node.id].wss.on('connection', (ws) => {
      if (instances[node.id].websocketServer) {
        console.log('WebSocket tunnel is already active');
        ws.close();
        return;
      }

      console.log('WebSocket tunnel established');
      node.status({ fill: 'green', shape: 'dot', text: 'WebSocket tunnel established' });
      instances[node.id].websocketServer = ws;

      // Invia un messaggio di benvenuto al client appena connesso
      // ws.send('Ciao dal server WebSocket!');

      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping(); // invia un ping al client
          console.log('Ping inviato al client');
        }
      }, PING_INTERVAL);

      // Quando si verifica un errore
      ws.on('error', function error(err) {
        instances[node.id].websocketServer = null;
        console.error('WebSocket error:', err);
        clearInterval(interval); // pulisci l'intervallo quando la connessione è chiusa
        node.error(err, { payload: 'Open websockeet tunnel error', message: err.message });
        node.status({ fill: 'red', shape: 'dot', text: 'Error' });
      });

      // Gestiamo i messaggi ricevuti dal client
      // ws.on('message', (message) => {
      //   console.log(`Messaggio ricevuto dal client: ${message}`);
      //   // Rispondiamo al client
      //   // ws.send(`Hai detto: ${message}`);
      // });

      // Gestiamo la chiusura della connessione
      ws.on('close', () => {
        console.log('WebSocket tunnel closed');
        instances[node.id].websocketServer = null;
        node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
        clearInterval(interval); // pulisci l'intervallo quando la connessione è chiusa
      });

      // Quando ricevi un pong dal client
      ws.on('pong', () => {
        console.log('Pong ricevuto dal client');
      });
    });

    instances[node.id].wss.on('error', (error) => {
      console.log(error);
    });
  }

  function TCPServer(options) {
    instances[options.id].server = net.createServer((socket) => {
      // console.log('Client connesso');

      // Variabile per memorizzare i dati grezzi della richiesta
      let rawRequestData = '';

      // Leggi i dati grezzi dal socket
      socket.on('data', async (data) => {
        rawRequestData += data.toString(); // Aggiungi i dati ricevuti alla variabile rawRequestData

        // Puoi scegliere di processare la richiesta solo quando hai ricevuto tutto il contenuto, ad esempio quando la richiesta termina
        if (rawRequestData.includes('\r\n\r\n')) {
          // Quando i dati contengono l'header completo, puoi trattarli come una richiesta completa

          // Sostituire il campo Host con il nuovo valore
          rawRequestData = rawRequestData.replace(/Host:\s*([^\r\n]*)/, `Host: ${options.dstAddr}:${options.dstPort}`);
          console.log('Richiesta HTTP raw ricevuta:');
          console.log(rawRequestData);

          try {
            const response = await requestFromServer(rawRequestData, options);
            // console.log('-----------');
            // console.log(response);
            // console.log('-----------');
            socket.write(response);
            // Rispondi al client (opzionale)
            // socket.write('HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nResponse OK');
            // Chiudi la connessione (opzionale)
          } catch (error) {
            console.log(error);
            let errorRespose =
              `HTTP/1.1 408 Request Timeout\r\n` +
              `Content-Type: text/plain; charset=utf-8\r\n` +
              // `Content-Length: 29\r\n` +
              `Connection: close\r\n` +
              `Date: ${new Date().toUTCString()}\r\n\r\n` + // usa toUTCString() invece di toGMTString
              `Request Timeout: The server timed out waiting for the request.`;

            if (error instanceof WebsocketTunnelError) {
              errorRespose =
                `HTTP/1.1 ${error.code} ${error.name}\r\n` +
                `Content-Type: text/plain; charset=utf-8\r\n` +
                // `Content-Length: 29\r\n` +
                `Connection: close\r\n` +
                `Date: ${new Date().toUTCString()}\r\n\r\n` + // usa toUTCString() invece di toGMTString
                `${error.message}`;
            }

            socket.write(errorRespose); // Invia la risposta di timeout
          }
          socket.end();
        }
      });

      socket.on('end', () => {
        console.log('Client disconnected');
      });

      socket.on('error', (err) => {
        console.error('Connection error:', err);
      });
    });

    try {
      instances[options.id].server.listen(options.srcPort, () => {
        console.log(`HTTP server listening on port ${options.srcPort}`);
      });
      instances[options.id].server.on('error', (error) => {
        console.log(error);
      });
    } catch (error) {
      console.log(error);
    }
  }

  function getProtocolAndHostAndDefautlPort(url) {
    try {
      const protocolPorts = {
        http: 80,
        https: 443,
        ftp: 21,
        ssh: 22,
      };
      // Add "http://" as a default protocol
      if (!/^https?:\/\//i.test(url)) {
        url = 'http://' + url;
      }
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol.replace(':', '');
      const host = parsedUrl.hostname;

      const port = parsedUrl.port || protocolPorts[protocol] || null;

      return [protocol, host, port];
    } catch (error) {
      console.error('Invalid URL:', error);
      return null;
    }
  }

  class WebsocketTunnelError extends Error {
    constructor(message, code) {
      super(message);
      this.name = this.constructor.name;
      this.code = code;
      Error.captureStackTrace(this, this.constructor);
    }
  }

  RED.nodes.registerType('wstunnel server', WSTunnelServer);
};
