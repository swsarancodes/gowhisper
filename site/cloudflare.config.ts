import { bindings, defineConfig, triggers } from "cf/config"
import { BASE_PATH, hostForMode } from "./src/base.ts"

// `--mode dev` builds and deploys the dev Worker on dev.goml.io; any other
// mode is production on goml.io. One Worker serves the site at /gospell and the
// files at /gospell/files: the installers and appcast built with the site, the dev
// notes, and the frozen 2.3.1 feeds and artifacts, which are read from the
// production files bucket from both environments. The account comes from
// CLOUDFLARE_ACCOUNT_ID.
export default defineConfig(({ mode }) => {
  const dev = mode === "dev"
  const host = hostForMode(mode)
  return {
    worker: {
      name: dev ? "gospell-dev-site" : "gospell-production-site",
      compatibilityDate: "2026-10-13",
      // /gospell/download/dev fetches the release service, another Worker on this zone.
      compatibilityFlags: ["global_fetch_strictly_public"],
      entrypoint: "./worker.ts",
      assets: { runWorkerFirst: true },
      env: {
        ASSETS: bindings.assets(),
        // The frozen 2.3.1 history is the same for both environments and is
        // only read. CI holds no R2 credential.
        FILES: bindings.r2({ name: dev ? "gospell-dev-files" : "gospell-production-files" }),
        CANONICAL_HOST: bindings.text(host),
      },
      triggers: [
        triggers.fetch({ pattern: `${host}${BASE_PATH}`, zone: host }),
        triggers.fetch({ pattern: `${host}${BASE_PATH}/*`, zone: host }),
      ],
      workersDev: false,
      previewUrls: false,
    },
  }
})
