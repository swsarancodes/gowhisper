---
name: gospell-personal-commands
description: Configure GoSpell personal deterministic transcript transformations in `~/.config/gospell/gospell.config.ts`. Use when the user wants to add or change custom text transformations for the GoSpell voice app.
license: MIT
---

# GoSpell Personal Transformations

This skill targets current GoSpell (dev builds now, and the next stable release).
GoSpell 2.3.1 uses an older runtime; its matching skill installs with
`npx skills add goml/gospell#app-v2.3.1 --skill gospell-personal-commands`.

GoSpell runs `~/.config/gospell/gospell.config.ts` itself, in an embedded JavaScript
engine. There is no package to install and no build step.

1. Check for `~/.config/gospell/gospell.config.ts` (or `gospell.config.js`). If it is
   missing, ask the user to open GoSpell's Modes pane and choose Create Config,
   or run `gospell commands init` if the `gospell` CLI is available.
2. Read `~/.config/gospell/AGENTS.md` for the current API and limits, and
   `gospell.d.ts` for exact types. GoSpell owns both and rewrites them; do not edit
   them.
3. Edit only the config and files it imports. Scripts are plain TypeScript or
   JavaScript: they can import `@goml/gospell-commands` and files in the folder, not
   npm packages, Effect, or Node APIs, and they have no filesystem, network,
   or timer access. Enums, namespaces, and constructor parameter properties are
   rejected.
4. Use `defineGoSpellConfig` from `@goml/gospell-commands` and declare pure `transformations`
   entries (`{ id, name, description?, transform(text, context) }`).
5. Transformations must be selected in the mode's Transformations section.
   They run after mode corrections and optional AI rewriting, not for meetings.
6. Run `gospell commands check` (macOS) after editing. It loads the config as GoSpell
   does and prints what it registers or the error with file, line, and column.
   Optionally type-check with `npx -y -p typescript tsc` in `~/.config/gospell`. A
   running GoSpell reloads the config on save and shows load errors in Modes'
   Transformations section.
   If `gospell` reports `commands check` as an unrecognized subcommand, stop: the
   user is on an older GoSpell (such as 2.3.1). Tell them to install the matching
   skill with `npx skills add goml/gospell#app-v2.3.1 --skill gospell-personal-commands`,
   or to switch to the dev build (https://github.com/goml/gospell#downloads).

Completion criterion: the requested behavior is represented in the config,
`gospell commands check` succeeds (or, without the CLI, the reload succeeded in
GoSpell), and any verification gap is reported.
