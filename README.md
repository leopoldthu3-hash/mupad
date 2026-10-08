# MuPad

A small Python editor for iPad. Open a `.py` file, write some code, and run it right on your device. Your code doesn't get sent to a server.

MuPad takes inspiration from the simple feel of [Mu Editor](https://codewith.mu/), but it's a separate project with its own interface and code. It runs real Python through [Pyodide](https://pyodide.org/), so you can use normal Python syntax, including `input()`. You don't need to learn a new language or rewrite your scripts around a special API.

![MuPad editor with Python code and program output](docs/images/editor-ipad.png)

*The editor running in WebKit at an iPad-sized viewport.*

## What you can do

- Create and rename Python files, with drafts saved automatically in the app.
- Open `.py` files and export them through the iPad share sheet.
- Edit with syntax highlighting, line numbers, four-space indentation, search, and undo/redo.
- Run Python locally, see output as it happens, and get tracebacks that point to your file.
- Use normal `input()` with a native input prompt.
- Import another `.py` file from your workspace.
- Stop an infinite loop without freezing the editor, then run another program.

The interpreter and standard library ship with the app. Once installed, running ordinary scripts doesn't need an internet connection.

## A few limits

MuPad is still a small project, not a replacement for every desktop Python setup. It uses CPython 3.14.2 through WebAssembly. Desktop GUI libraries such as `tkinter`, graphical `turtle`, pygame, hardware-specific modules, and arbitrary native packages aren't supported. There isn't a full REPL, debugger, or plotter yet.

Each run starts a fresh interpreter. Your editor files persist, but files created by a running script are currently temporary and don't survive the next run.

Saving a draft in MuPad isn't the same as exporting it to the Files app. Export anything important before deleting or reinstalling the app.

## Run it locally

You'll need Node.js 22 or newer and Python 3 for the development server.

```sh
git clone https://github.com/leopoldthu3-hash/mupad.git
cd mupad
npm ci
npm run bundle
python3 scripts/test-server.py
```

Open **http://127.0.0.1:4192**. The server supplies the isolation headers needed for interactive browser input. Keep it bound to localhost; it isn't intended as a public hosting service.

## Tests

```sh
npm run check
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

The tests execute the actual bundled Python interpreter. Browser checks cover drafts, file import/export, indentation, output, input, and stopping a runaway program. They include iPad portrait and landscape viewports.

The iOS build also installs the native app in an iPad simulator and checks worker/WASM loading, workspace imports, normal `input()` through the native prompt, and Stop/restart. Browser success alone doesn't count as proof that the packaged app works. The 0.2 build passed that native gate and was also reported working on an iPad by its owner.

## Build an IPA

You need macOS with Xcode 26 or newer to compile the iOS app. Linux can run the editor and tests, but it can't compile the device binary.

```sh
npm ci
npm run bundle
npx cap add ios
npx cap sync ios
node scripts/prepare-native.mjs
npx cap open ios
```

`prepare-native.mjs` applies the native input bridge and packaging changes after Capacitor generates the project. The generated `ios/` directory isn't committed; the Swift sources that get applied are in `native/`.

You can also fork this repository and run the **Build and test unsigned MuPad IPA** workflow from the Actions tab. It runs the tests, builds and exercises the simulator app, and only then packages an unsigned ARM64 device IPA. The minimum deployment target is iOS/iPadOS 17. The current app has been used on an iPad running iPadOS 26.

An unsigned IPA still needs a valid signature through your chosen sideloading setup. This repository doesn't include Apple certificates, provisioning profiles, or account credentials.

## How it works

CodeMirror handles the editor. A dedicated worker runs Pyodide so Python can't lock up the interface. Stop terminates that worker, and the next run gets a clean interpreter and workspace copy.

Browser input uses shared memory. On iPad, a small native HTTP bridge listens **only on 127.0.0.1**, behind a random per-launch path, and opens a native prompt. It doesn't send code or input to an external service. Native self-test checkpoints use a separate WebKit message channel so an interpreter failure can't hide the diagnostic report.

## Contributing

Pull requests are welcome. Bug fixes, better file handling, and iPad usability improvements are good places to start. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and test expectations.

Please don't commit passwords, tokens, signing material, personal scripts, or generated build artifacts.

## License

MuPad's original code is available under the [MIT license](LICENSE). You can use it, modify it, and share your own version, subject to that license.

The libraries it uses keep their own licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). MuPad is not affiliated with the Mu Editor project.
