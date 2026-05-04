# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.2] - 2026-05-04

### Fixed
- Add proper cleanup of existing server on port before starting
- Replace console.log/warn/error with proper logger
- Improve error handling during server start/stop

### Changed
- Update @remotelinker/reverse-ws-tunnel from ^1.0.10 to ^1.0.11
- Add log context for each tunnel node

---

## [1.1.1] - 2025-??-??

### Changed
- Update @remotelinker/reverse-ws-tunnel from ^1.0.9 to ^1.0.10

---

## [1.1.0] - 2025-??-??

### Fixed
- Fix server configuration issues

### Changed
- Disable wstunnel client node temporarily
- Switch from local/beta package to published reverse-ws-tunnel package

### Documentation
- Update README to match current codebase

---

## [1.0.1-dev-3] - 2025-??-??

### Added
- Initial wstunnel client node for reverse WebSocket tunneling

### Changed
- Update version to 1.0.1-dev-3
- Update dependencies
- Improve documentation
- Disable wstunnel client node

---

## [1.0.1] - 2025-??-??

### Added
- Add configurable log level dropdown in wstunnel configuration (trace, debug, info, warning, error)

### Fixed
- Remove old connections when redeploying flows

### Changed
- First release with reverse tunnel functionality

---

## [1.0.0] - 2025-??-??

### Added
- Initial release with WebSocket tunnel support
- MSSQL integration

---

[1.1.2]: https://github.com/yousolution-cloud/node-red-contrib-you-tunnel-websocket/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/yousolution-cloud/node-red-contrib-you-tunnel-websocket/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/yousolution-cloud/node-red-contrib-you-tunnel-websocket/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/yousolution-cloud/node-red-contrib-you-tunnel-websocket/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/yousolution-cloud/node-red-contrib-you-tunnel-websocket/tree/v1.0.0