# Attribution and source

Based on [Desktop Commander MCP](https://github.com/wonderwhy-er/DesktopCommanderMCP), npm package `@wonderwhy-er/desktop-commander` **0.2.52**, MIT, Copyright (c) 2024–2025 Eduard Ruzga and Desktop Commander Contributors.

The build downloads the pinned dependency, copies its distributed JavaScript, and replaces only `dist/ui/contracts.js`. The replacement source is in `dc-preview-lab/patches/contracts.js`; it suppresses automatic UI advertisement. Tool handlers are inherited from upstream. Upstream TypeScript source is available at the linked repository; dependency provenance is recorded in the runtime-deps lockfile.

This repository also contains the integration launcher, startup scripts and comparison tests. It is an unofficial integration, not an OpenAI or Anthropic product. No tunnel binary, credential, personal app binding, runtime log, user configuration or upstream node_modules is distributed here.
