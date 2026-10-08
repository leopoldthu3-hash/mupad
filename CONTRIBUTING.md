# Contributing to MuPad

Fork the repository, create a branch, and open a pull request against `main`. Keep each PR focused on one fix or improvement and explain what you changed.

## Before opening a PR

```sh
npm ci
npm run bundle
npm run check
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

For a bug fix, add a regression test that fails before the fix and passes afterward. Include reproduction steps in the PR. For interface changes, a screenshot helps.

If you change Python execution or iOS input, test the actual interpreter rather than a mocked response. Run the iOS build and simulator gate for native changes when you have access to macOS/Xcode. If you only tested in a browser, say so; that doesn't prove WKWebView behavior.

The iOS project is generated during the build. Put reproducible native changes in `native/` and `scripts/prepare-native.mjs`, not just an ignored local `ios/` directory.

## Reporting a bug

Open an issue with the app version, your iPadOS or browser version, what you expected, and what happened. A short Python example is useful. Strip personal information from examples and screenshots. Never include passwords, tokens, or signing certificates.

## License

By submitting a contribution, you agree that your original contribution can be distributed under the repository's MIT license. Preserve the notices and licenses of any third-party code you include.
