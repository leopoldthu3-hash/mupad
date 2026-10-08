# MuPad

An original, Mu-inspired local Python editor for iPad.

## What it does

- Creates, renames, edits, and saves `.py` files locally on the device.
- Runs ordinary Python locally in the app through the bundled Pyodide runtime.
- Does not send source code to a server to run it.
- Has an iPad-first editor, file list, output pane, Tab indentation, and save shortcut.

## Build an IPA without a Mac

This project includes `.github/workflows/build-ipa.yml`. It uses GitHub's official `macos-14` runner, which has Xcode, to build an **unsigned** `MuPad-unsigned.ipa`.

1. Create a new **private** GitHub repository named `mupad` in your own GitHub account.
2. Upload the contents of this folder to that repository. Do not upload `node_modules/`.
3. Open **Actions** → **Build unsigned MuPad IPA** → **Run workflow**.
4. Wait for the macOS job to finish, then download the artifact named `MuPad-unsigned-ipa`.
5. In FlekSt0re, use its signer/import flow to sign and install the IPA with your own certificate.

No Apple-ID password, signing certificate, or account secret belongs in this project or chat.

## Local development

```bash
npm ci
npm run bundle
npx cap sync ios
npm run check
```

The actual IPA compilation step requires macOS/Xcode, which is why the GitHub Actions workflow uses a macOS runner.
