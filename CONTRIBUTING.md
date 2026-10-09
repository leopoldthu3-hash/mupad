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

## Course and desktop changes

Keep lessons in `www/learning-catalog.mjs`: explanation, runnable example, prompt, starter, at least two hints, solution, and meaningful Python assertions. Name any required variables/functions in the prompt. `npm run check` runs every solution in the real interpreter and checks that empty answers fail. Add browser regression tests for learning-state changes; don't replace Python grading with a button that increments progress.

Desktop changes belong in `desktop/` and `electron-builder.json`. Keep the renderer sandboxed and without Node access; never work around a failed test using `--no-sandbox`. Exercise the built Windows/Linux application and restart it with the same isolated test profile to verify persistence.

## Reporting a bug

Open an issue with the app version, your iPadOS or browser version, what you expected, and what happened. A short Python example is useful. Strip personal information from examples and screenshots. Never include passwords, tokens, or signing certificates.

## License

By submitting a contribution, you agree that your original contribution can be distributed under the repository's MIT license. Preserve the notices and licenses of any third-party code you include.
