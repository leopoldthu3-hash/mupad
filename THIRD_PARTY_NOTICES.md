# Third-party software

The MIT license at the root of this repository applies to MuPad's original code. It doesn't replace the licenses of its dependencies.

The project installs dependencies through npm; the lockfile records exact versions. Generated interpreter binaries, standard-library archives, editor bundles, and the generated iOS project aren't stored in this source repository.

- **Pyodide** (`pyodide` 314.0.7): Mozilla Public License 2.0. Source and license: https://github.com/pyodide/pyodide. Pyodide includes CPython and other components under their respective licenses. Consult the matching upstream release and its notices when redistributing the runtime.
- **CPython** (3.14.2 in the bundled runtime): Python Software Foundation license and included historical/component notices. See https://docs.python.org/3.14/license.html and https://github.com/python/cpython/tree/v3.14.2.
- **Capacitor** (`@capacitor/core`, `@capacitor/ios`, and the filesystem/share plugins): MIT. Sources: https://github.com/ionic-team/capacitor and https://github.com/ionic-team/capacitor-plugins.
- **CodeMirror** (`@codemirror/*`) and its editor dependencies, including Lezer: MIT. Sources: https://github.com/codemirror and https://github.com/lezer-parser.

- **Electron** (44.7.0, Windows/Linux shell): MIT. Chromium components retain their own licenses; desktop packages preserve their bundled notices. Source: https://github.com/electron/electron.

Build tools include electron-builder (MIT), Playwright (Apache 2.0), esbuild (MIT), and TypeScript (Apache 2.0). Versions are in package-lock.json.

`npm run bundle` generates `www/third-party-notices.txt` from the license files of the actual bundled editor dependencies, MuPad's license, and the interpreter license texts in `licenses/`. Capacitor copies that file into the packaged app alongside the runtime.

Anyone distributing a built app must preserve the applicable dependency copyright notices and license texts, and meet any source-availability requirements such as those in the MPL. Dependency source links above identify the upstream projects; use the versions recorded in the lockfile rather than assuming every upstream default branch matches the app.

MuPad's reference to Mu Editor describes its inspiration. This repository does not contain Mu Editor's source, logos, or branding assets, and is not affiliated with that project.
