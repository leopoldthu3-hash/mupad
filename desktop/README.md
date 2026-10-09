# MuPad desktop wrapper

The desktop app serves only the bundled `www/` tree at the **stable** origin
`mupad-desktop://app/`. It does not use a changing localhost port, preload script,
IPC bridge, Node integration, native Python process or external CDN. Chromium's
sandbox, context isolation and web security remain enabled. All permission
requests, popups, remote navigation and remote network requests are denied.

Every protocol response carries COOP `same-origin`, COEP `require-corp`, CORP
`same-origin`, MIME types, `nosniff` and a restrictive CSP. Pyodide needs
`unsafe-eval`/`wasm-unsafe-eval`; it does **not** gain Node privileges. Path
normalization and realpath confinement prevent assets escaping `www/`.

## Parent-owned package.json changes

Stable versions were checked against the official npm registry:

```sh
npm install --save-dev --save-exact electron@44.7.0 electron-builder@26.15.3
```

Recommended scripts (the CI uses direct commands and does not depend on these
names):

```json
{
  "desktop": "electron desktop/main.mjs",
  "test:desktop": "node desktop/selftest.mjs",
  "build:desktop": "npm run bundle && electron-builder --config electron-builder.json --publish never",
  "build:desktop:windows": "npm run bundle && electron-builder --config electron-builder.json --win --x64 --publish never",
  "build:desktop:linux": "npm run bundle && electron-builder --config electron-builder.json --linux --x64 --publish never"
}
```

`main: "desktop/main.mjs"` is optional in the source package; the builder injects
it into packaged metadata. Add `node --check desktop/main.mjs`,
`node --check desktop/assets.mjs`, `node --check desktop/security.mjs`,
`node --check desktop/runtime-selftest.mjs`, and
`node --check desktop/selftest.mjs` to `check`. The existing `test/*.test.mjs`
glob already picks up desktop unit/security tests.

## Real runtime verification

Run `npm run bundle` first; the tests exercise the actual editor and bundled
CPython/WASM, not a mocked Python result. Linux needs an X display (or Xvfb) and
working Chromium sandbox support. Do not run Electron as root.

```sh
node --test test/desktop-server.test.mjs
# Windows / Linux with an existing display:
node desktop/selftest.mjs --report dist/desktop/selftest-development.json
# Headless Linux:
xvfb-run -a node desktop/selftest.mjs --report dist/desktop/selftest-development-linux.json
# After packaging on Linux:
xvfb-run -a node desktop/selftest.mjs --executable dist/desktop/linux-unpacked/mupad --require-packaged --report dist/desktop/selftest-packaged-linux.json
# After packaging on Windows:
node desktop/selftest.mjs --executable dist/desktop/win-unpacked/mupad.exe --require-packaged --report dist/desktop/selftest-packaged-windows.json
```

The selftest opens a real BrowserWindow, asserts a secure isolated page and
worker with SharedArrayBuffer, verifies Node is unavailable, denies a popup and
remote fetch, executes real Python imports/comprehensions, Unicode interactive
`input()`, blank input and EOF, stops an infinite loop, and runs again. It saves
a real editor buffer, **exits Electron**, then launches a second process with
the same isolated profile and executes the recovered program. JSON evidence
records Electron/app versions, packaged state, environment and actual Python
output. `--require-packaged` rejects development binaries. The disposable test
profile never touches the user's normal saved workspace.

If Electron fails with a Chromium sandbox-helper error, configure the setuid
helper or the operating system's user-namespace policy; do not add
`--no-sandbox`. CI configures ownership/mode on only its ephemeral Electron
helpers (`root:root`, `4755`) and runs the app as the unprivileged runner user.
On Ubuntu systems that restrict unprivileged namespaces, prefer the `.deb`
installation or an administrator-managed per-application AppArmor policy for
AppImage. AppImage mounts cannot supply a usable setuid sandbox by themselves.

## Packaging / CI

`electron-builder.json` produces Windows x64 NSIS and Linux x64 `.deb` +
AppImage. The archive includes the actual `www/pyodide` WASM, Python standard
library and notices, and excludes `node_modules`; no Python runtime download
is required. Outputs are in `dist/desktop/`. Builds are unsigned unless an
external signing setup is provided, so Windows can show SmartScreen warnings.

`.github/workflows/build-desktop.yml` runs native Windows and Ubuntu jobs,
bundles/checks source, verifies the development runtime, builds installers,
verifies the packaged executable, and uploads **MuPad-windows** and
**MuPad-linux**, including runtime JSON evidence. It never publishes a release.
