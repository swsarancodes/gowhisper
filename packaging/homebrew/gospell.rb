cask "gospell" do
  version "@VERSION@"
  sha256 "@SHA256@"

  url "@URL@"
  name "GoSpell"
  desc "Local voice dictation"
  homepage "https://gospell.goml.io/"

  livecheck do
    url "https://goml.io/release/gospell/desktop/stable.json"
    strategy :json do |json|
      json.dig("release", "version")
    end
  end

  auto_updates true
  depends_on arch: :arm64
  depends_on macos: :sequoia

  app "GoSpell.app"
  binary "#{appdir}/GoSpell.app/Contents/MacOS/gospell"

  uninstall quit: "com.goml.gospell"

  zap trash: [
    "~/.config/gospell",
    "~/Library/Application Support/gospell",
    "~/Library/Caches/com.goml.gospell",
    "~/Library/HTTPStorages/com.goml.gospell",
    "~/Library/Preferences/com.goml.gospell.plist",
    "~/Library/Saved Application State/com.goml.gospell.savedState",
  ]
end
