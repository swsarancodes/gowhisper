import { useEffect, useState } from "react";

// Downloads come straight from the repo's latest GitHub release. The release
// workflow (.github/workflows/release-github.yml) publishes every file under a
// name that never changes, so these links always serve the newest build.
export const REPO = "swsarancodes/gowhisper";
export const REPO_URL = `https://github.com/${REPO}`;
const FILE = (name: string) => `${REPO_URL}/releases/latest/download/${name}`;

export type OS = "mac" | "windows" | "linux" | "other";
export type Arch = "x64" | "arm64";
export type System = { os: OS; arch: Arch };

type UAData = { platform?: string; mobile?: boolean; getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }> };

/** Reads the visitor's system. Phones and tablets count as "other", since GoSpell runs on computers. */
export async function detectSystem(): Promise<System> {
  const nav = navigator as Navigator & { userAgentData?: UAData };
  const ua = navigator.userAgent;
  const platform = (nav.userAgentData?.platform || navigator.platform || "").toLowerCase();
  const touchMac = /mac/.test(platform) && navigator.maxTouchPoints > 1; // iPadOS reports a Mac
  const phone = nav.userAgentData?.mobile || /android|iphone|ipad|ipod/i.test(ua) || touchMac;
  let os: OS = "other";
  if (!phone) {
    if (/win/.test(platform) || /windows/i.test(ua)) os = "windows";
    else if (/mac/.test(platform)) os = "mac";
    else if (/linux|x11|cros/.test(platform) || /linux/i.test(ua)) os = "linux";
  }
  let arch: Arch = /aarch64|arm64|\barm\b/i.test(ua) ? "arm64" : "x64";
  try {
    const hi = await nav.userAgentData?.getHighEntropyValues?.(["architecture"]);
    if (hi?.architecture) arch = hi.architecture.toLowerCase().startsWith("arm") ? "arm64" : "x64";
  } catch { /* the user agent string above stays the answer */ }
  return { os, arch };
}

export type Pick = { label: string; href: string; note: string };

/** The one file to offer first for a system. GoSpell for Mac is built for Apple silicon only. */
export function primaryFor({ os, arch }: System): Pick | null {
  if (os === "mac") return { label: "Download for Mac", href: FILE("GoSpell-macos-arm64.dmg"), note: "Apple silicon" };
  if (os === "windows") return { label: "Download for Windows", href: FILE(`GoSpell-windows-${arch}-setup.exe`), note: arch === "arm64" ? "ARM64" : "64-bit" };
  if (os === "linux") return { label: "Download for Linux", href: FILE(`GoSpell-linux-${arch}.deb`), note: arch === "arm64" ? "ARM64 .deb" : "x86_64 .deb" };
  return null;
}

export const files = {
  mac: FILE("GoSpell-macos-arm64.dmg"),
  windows: { x64: FILE("GoSpell-windows-x64-setup.exe"), arm64: FILE("GoSpell-windows-arm64-setup.exe") },
  linux: (a: Arch) => ({ deb: FILE(`GoSpell-linux-${a}.deb`), rpm: FILE(`GoSpell-linux-${a}.rpm`), bin: FILE(`GoSpell-linux-${a}`) }),
  checksums: FILE("SHA256SUMS"),
  releases: `${REPO_URL}/releases/latest`,
};

/** The visitor's system, once it has been read. */
export function useSystem(): System | null {
  const [sys, setSys] = useState<System | null>(null);
  useEffect(() => { let on = true; detectSystem().then(s => on && setSys(s)); return () => { on = false; }; }, []);
  return sys;
}
