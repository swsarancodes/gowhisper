# GoSpell landing page

The website for GoSpell. Vite, React, TypeScript, Geist, Framer Motion, GSAP, and dithered WebGPU scenes (WGSL, with a WebGL 2 fallback).

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # type-checks, then writes dist/
```

## Downloads

The download buttons read the visitor's system and link to the newest file on the repo's latest GitHub release:

```
https://github.com/swsarancodes/gowhisper/releases/latest/download/<name>
```

The names never change (`src/lib/download.ts`), and the release workflow publishes them:

| System | File |
| --- | --- |
| macOS, Apple silicon | `GoSpell-macos-arm64.dmg` |
| Windows x64 / ARM64 | `GoSpell-windows-x64-setup.exe`, `GoSpell-windows-arm64-setup.exe` |
| Linux x64 / ARM64 | `GoSpell-linux-<arch>.deb`, `.rpm`, and the bare `GoSpell-linux-<arch>` executable |

To cut a release, open Actions, choose **Release to GitHub**, and run it with a tag such as `v3.4.0-goml.2`. The builds are unsigned, so macOS and Windows ask to confirm once (see `docs/install-without-developer-id.md`).

## Hosting

Vercel builds this folder (root directory `landing`) on every push to `main`.
