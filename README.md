# MuPad — original Python 3 editor for iPad

MuPad uses real local CPython 3.14.2 through bundled Pyodide. Mu Editor's normal Python 3 mode also uses Python; Mu does not have a separate programming language. Use ordinary `.py` files, not a MuPad-only syntax.

## Current source features

- Python highlighting, line numbers, four-space autoindent, undo/redo, search and touch indentation helpers.
- Autosaved workspace; New/Rename and UTF-8 `.py` import/export.
- Native iPad exports use the share sheet, allowing Save to Files.
- A dedicated worker runs Python without locking the editor. Stop terminates a runaway program, including infinite loops.
- Live stdout/stderr, retained output before exceptions, real source filenames and traceback line numbers.
- Workspace `.py` modules are available to `import` and file reads.
- Normal `input()` syntax. Shared-memory input is exercised in isolated browser tests; native same-origin synchronous stdin bridge awaits the simulator build gate. Optional pre-supplied lines also work without changing Python code.

## Honest limits

This is not a complete Mu clone. Desktop `tkinter`/`turtle`, pygame modes, micro:bit/CircuitPython hardware access, debugger, plotter, full desktop REPL and arbitrary desktop packages are not implemented. Only the bundled Python standard library is offline. Pyodide/WASM has operating-system and package restrictions. Runtime-created files are currently ephemeral; editor workspace files persist. Each run starts a fresh interpreter, so globals do not leak between programs.

Saving inside the app is separate from exporting a file to iPad Files. Export backups before deleting or reinstalling the app.

## Reproducible checks

```sh
npm ci
npm run bundle
npm run check
npx playwright install chromium webkit
npx playwright test
```

Browser tests use `scripts/test-server.py` on localhost:4192. They assert real Python execution and editor workflows at desktop and iPad landscape/portrait sizes. WebKit-on-Linux is not a physical iPad test.

## iOS build

The private GitHub Actions workflow installs dependencies, runs tests, generates/syncs Capacitor iOS, and runs `node scripts/prepare-native.mjs`. Native patches are applied deterministically after installation; do not rely on ignored local `ios/` modifications.

The workflow selects Xcode 26+, then builds an iPad simulator app and runs native self-tests against the actual custom-scheme WKWebView: local worker/module/WASM loading, unmodified nested `input()`, imports, output, Stop/restart. It creates the unsigned device IPA only after that gate passes. iOS minimum is 17.

The IPA must still be signed with the user's chosen legitimate sideload signer. A successful build does not establish installation success.
