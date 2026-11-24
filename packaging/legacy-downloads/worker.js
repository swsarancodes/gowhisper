// Kit's old GoSpell hosts, all redirected to goml.io:
// - downloads.gospell.goml.io and .com (the bucket GoSpell 2.3.1 and earlier
//   read): every path, 302, to https://gospell.goml.io/files, where the site
//   Worker serves the frozen 2.3.1 history from gospell-production-files and the
//   appcast and installers from the site build.
// - gospell.goml.io and .dev (the old website): 301 to https://gospell.goml.io,
//   with the download and installer paths kept working.
const WEBSITE = {
  "/download": "/gospell/download/macos-arm64-dmg",
  "/install-linux.sh": "/gospell/files/install-linux.sh",
  "/install-windows.ps1": "/gospell/files/install-windows.ps1",
}

export default {
  fetch(request) {
    const { hostname, pathname, search } = new URL(request.url)
    if (hostname.startsWith("downloads.")) {
      return Response.redirect(`https://gospell.goml.io/files${pathname}${search}`, 302)
    }
    const path = WEBSITE[pathname.replace(/\/+$/, "")] ?? "/gospell/"
    return Response.redirect(`https://goml.io${path}`, 301)
  },
}
