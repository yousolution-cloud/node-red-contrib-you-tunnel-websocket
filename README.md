# node-red-contrib-you-tunnel-websocket

[![npm version](https://badge.fury.io/js/%40yousolution%2Fnode-red-contrib-you-tunnel-websocket.svg)](https://badge.fury.io/js/%40yousolution%2Fnode-red-contrib-you-tunnel-websocket)
[![npm downloads](https://img.shields.io/npm/dm/@yousolution/node-red-contrib-you-tunnel-websocket.svg)](https://www.npmjs.com/package/@yousolution/node-red-contrib-you-tunnel-websocket)

A Node-RED node collection for creating WebSocket tunnels that enable HTTP traffic routing over WebSocket connections.

## Install

Install via Node-RED palette manager, or:

```bash
npm install @yousolution/node-red-contrib-you-tunnel-websocket
```

## Nodes

### wstunnel

Configuration node for WebSocket tunnel server settings.

#### Properties

- **Name**: Descriptive name for the tunnel configuration *(required)*
- **Host**: Hostname or IP address to bind the WebSocket server (default: `localhost`)
- **Port**: Port number for the WebSocket server (default: `443`)
- **Path**: Optional path component for the WebSocket URL
- **Tunnel ID Header**: HTTP header name used to identify tunnel connections (default: `x-tunnel-id`)
- **Log Level**: Logging verbosity level (`trace`, `debug`, `info`, `warning`, `error`)

### wstunnel server

Creates a WebSocket server that can tunnel HTTP traffic over WebSocket connections.

#### Properties

- **Name**: Optional name for the node
- **wstunnel**: Reference to a wstunnel configuration node *(required)*

#### Inputs

*none*

#### Outputs

*none*

#### Details

The server node creates a WebSocket server that listens for client connections. HTTP traffic can be tunneled through established WebSocket connections using tunnel ID headers.

Status indicators:
- 🔴 **disconnected**: Server is not running
- 🟢 **listening on port [port]**: Server is active and listening
- 🟢 **clients [count]**: Number of connected WebSocket clients

## Usage

### Basic Setup

1. Add a **wstunnel** configuration node:
   - Set Name, Host, Port, and other options

2. Add a **wstunnel server** node:
   - Select the configuration node
   - Deploy the flow

3. The server will start listening for WebSocket connections

### Connection URLs

WebSocket servers are accessible at:
```
ws://[host]:[port][/path]
```

For secure connections:
```
wss://[host]:[port][/path]
```

## Requirements

- **Node-RED**: >= 2.0.0
- **Node.js**: >= 12.0.0

## License

Apache-2.0

## Author

Andrea Trentin (<andrea.trentin@yousolution.cloud>)

Repository: [yousolution-cloud/node-red-contrib-you-tunnel-websocket](https://github.com/yousolution-cloud/node-red-contrib-you-tunnel-websocket)</content>
<parameter name="filePath">README.md