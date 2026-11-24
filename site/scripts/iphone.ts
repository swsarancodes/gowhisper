// Writes the GoSpell for iPhone pages into the built site: iphone.html
// (/gospell/iphone, the App Store support URL), privacy.html (/gospell/privacy, its
// privacy policy URL), a social card beside each (scripts/card.ts), and both
// in the sitemap.
//
//   bun scripts/iphone.ts --mode dev
import { getWorkerAssetsDir } from "@cloudflare/build-output-utils"
import { readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { originForMode } from "../src/base"
import { CARDS, IPHONE_PATH, PRIVACY_PATH, renderIphone, renderPrivacy } from "../src/iphone"
import { card } from "./card"

const { values } = parseArgs({ options: { mode: { type: "string" }, out: { type: "string" } } })
const origin = originForMode(values.mode)
const assets = values.out ?? getWorkerAssetsDir(resolve(import.meta.dirname, ".."))
const address = (path: string) => `${origin.replace("https://", "")}${path.slice("/gospell".length)}`
const site = (path: string) => join(assets, path.slice("/gospell/".length))

writeFileSync(site(`${IPHONE_PATH}.html`), renderIphone(origin))
writeFileSync(site(`${IPHONE_PATH}.png`), await card("GoSpell for iPhone", CARDS.iphone.title, CARDS.iphone.line, address(IPHONE_PATH)))
writeFileSync(site(`${PRIVACY_PATH}.html`), renderPrivacy(origin))
writeFileSync(site(`${PRIVACY_PATH}.png`), await card("GoSpell for iPhone", CARDS.privacy.title, CARDS.privacy.line, address(PRIVACY_PATH)))

const sitemap = join(assets, "sitemap.xml")
const urls = [IPHONE_PATH, PRIVACY_PATH].map((path) => `  <url><loc>${origin}${path.slice("/gospell".length)}</loc></url>`)
writeFileSync(sitemap, readFileSync(sitemap, "utf8").replace("</urlset>", `${urls.join("\n")}\n</urlset>`))
console.log("iPhone: 2 pages (iphone, privacy).")
