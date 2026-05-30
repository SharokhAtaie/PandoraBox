# Changelog

All notable changes to PandoraBox will be documented in this file.

The format is based on Keep a Changelog, and this project follows semantic
versioning for public releases.

## [1.0.0] - 2026-05-30

First public release.

### Added

- Programmable HTTP/HTTPS MITM proxy with intercept, replay, scope, sitemap,
  match-and-replace, Python middleware, flows, Intruder, Collaborator, and team
  synchronization.
- Electron and embedded web UI modes backed by the same Go binary.
- MCP server over streamable HTTP with legacy SSE compatibility, live generated
  tool documentation, and project-level MCP access controls.
- Request and response inspection with decoded body views, raw views, hex views,
  syntax highlighting, and WebSocket frame capture.
- Local SQLite project storage with importable project configuration files.
- Replay queue persists per project across reloads, with an HTTP/HTTPS scheme
  switch, a Cancel button for in-flight sends, and an editable raw-packet history.

### Fixed

- Replay traffic is now stored self-contained and no longer leaks into History,
  the SiteMap, or request counts; existing projects are migrated and cleaned on
  first launch. Match-and-replace and middleware now apply to every replay, and
  concurrent replays no longer wedge the server.
- Replay responses now survive leaving and returning to the Replay page, and the
  back/forward arrows restore each sent packet together with the response it
  produced.
- The selection-to-Converter popup now tracks a changed selection and dismisses
  on deselect instead of leaving a stale popup, while staying open when you click
  into it.
