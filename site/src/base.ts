// The site lives under /gospell on goml.io (production) and dev.goml.io (dev), and
// the release files under /gospell/files. Pages keep root-relative paths internally;
// these helpers add and remove the prefix at the edges.
export const BASE_PATH = "/gospell"
export const FILES_PATH = `${BASE_PATH}/files`
// The GoML release service. Its dev stage (dev.goml.io/release) is only for
// testing the service itself, so both site environments read production.
export const RELEASE_SERVICE = "https://goml.io/release"
// Redirects to the latest dev channel Mac download (worker.ts).
export const DEV_DOWNLOAD_PATH = `${BASE_PATH}/download/dev`
// The dev builds' changelog (worker.ts, src/dev-notes.ts).
export const DEV_NOTES_PATH = `${BASE_PATH}/dev`
// The Release workflow publishes the dev builds' notes to this one-commit
// branch (publish-dev-notes.sh), which the Worker serves at
// `${FILES_PATH}/dev-notes.json` and renders at `DEV_NOTES_PATH`, so neither
// the app nor the changelog waits for a site deploy.
export const DEV_NOTES_URL = "https://raw.githubusercontent.com/goml/gospell/dev-notes/dev-notes.json"
// Redirects to the current release's file for a target (worker.ts).
export const DOWNLOAD_PATH = `${BASE_PATH}/download`

// The build mode (`--mode dev`) picks the environment; every other mode builds production.
export function hostForMode(mode: string | undefined): string {
  return mode === "dev" ? "dev.goml.io" : "goml.io"
}

export function originForMode(mode: string | undefined): string {
  return `https://${hostForMode(mode)}${BASE_PATH}`
}

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`
}

// Returns the site path for a request path, or undefined when it is outside the base.
export function stripBase(pathname: string): string | undefined {
  if (pathname === BASE_PATH) return "/"
  if (!pathname.startsWith(`${BASE_PATH}/`)) return undefined
  return pathname.slice(BASE_PATH.length)
}
