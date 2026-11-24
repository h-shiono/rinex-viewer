# Change Log

All notable changes to the "rinex-viewer" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [1.1.0] - 2026-11-24

### Added
- RINEX navigation file support (RINEX 2, 3 and 4, all GNSS) with per-field hovers.
- Outline / breadcrumbs, folding, status bar summary and `RINEX: Show File Summary`, `RINEX: Go to Epoch...`,
  `RINEX: Toggle Decorations` commands.
- Hovers for header labels and observation type codes, LLI / SSI decoding.
- Detection by file name pattern (`*.YYo`, `*.YYn`, ...), `.rnx` / `.nav` and the first line of the file.
- Theme-aware, customizable colors and settings.
- Fixes issue #1: `.rnx` and other RINEX navigation files are supported.

### Changed
- Observation values are colored by frequency band.
- The RINEX version is shown with two decimals (e.g. `2.10`).
- The file summary moved from the end-of-file hover to the status bar and the summary command.
- Only the visible part of the editor is decorated and hovers are computed on demand
  (23 MB / 1 Hz observation file: about 1 s and 600 MB of decoration objects per update before;
  now the parser index takes about 13 ms / 4 MB and one screen is about 7k decorations).

### Fixed
- Decoration types were created on every keystroke and never disposed.
- RINEX 2 observation types continued on a second header line were read from the first line.
- CRLF files, RINEX 2 years 1980-1999, fractional seconds and invalid epochs.
- Special event records (epoch flag 2-5) were parsed as observations.
- Crash on RINEX 2 files without `# / TYPES OF OBSERV` (e.g. navigation files).
- Non-RINEX editors were parsed and decorated after activation.

## [1.0.0] - 2024-02-15

- Initial release.
