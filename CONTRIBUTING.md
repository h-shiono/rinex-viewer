# Contributing to rinex-viewer

Thank you for your interest in improving rinex-viewer! Bug reports, feature requests and pull requests are welcome.

## Reporting issues

Please [open an issue](https://github.com/h-shiono/rinex-viewer/issues) and include:

- the RINEX version and file type (observation / navigation),
- what you expected and what you saw,
- if possible, a short excerpt of the file (the header and a few epochs or records) that reproduces the problem.

Only share data that you are allowed to share publicly.

## Development setup

Requirements: Node.js 22 or later, and VS Code.

```sh
npm install
npm run compile                                   # build dist/extension.js
code --extensionDevelopmentPath="$PWD" test/fixtures   # try the extension on the sample files
```

Use `npm run watch` to rebuild on every change. Reload the Extension Development Host window to pick up a new build.

## Project layout

| Path | Contents |
| --- | --- |
| `src/parser/` | The RINEX parser. It does **not** depend on the VS Code API, so it can be unit tested in Node. |
| `src/providers/` | VS Code integration: decorations, hovers, Outline, folding and the status bar summary. |
| `src/extension.ts` | Activation and wiring. |
| `syntaxes/` | TextMate grammar for header labels, comments and record lines. |
| `src/test/unit/` | Parser unit tests (`node:test`). |
| `src/test/suite/` | Integration tests that run inside VS Code. |
| `test/fixtures/` | Small RINEX files used by both test suites. |

## Tests

```sh
npm run lint
npm test                  # parser unit tests
npm run test:integration  # integration tests (downloads VS Code on the first run)
```

CI runs the same three commands on every pull request.

- If you change the parser, add or extend a unit test in `src/test/unit/`. If a new case needs data, add a small fixture to `test/fixtures/`: only the header and the few epochs or records that are needed, from data that can be redistributed.
- If you change how the extension behaves in the editor (activation, hovers, Outline and so on), add an integration test in `src/test/suite/`.

## Pull requests

1. Create a branch from `main`.
2. Make your change, together with its tests.
3. Add a line under `## [Unreleased]` in `CHANGELOG.md`.
4. Make sure `npm run lint`, `npm test` and `npm run test:integration` pass.
5. Open a pull request against `main`, describing the problem and how you tested the change.

Please do not change the version in `package.json`. The maintainer does that when preparing a release.
