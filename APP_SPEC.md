# QC Workbench / QC七つ道具 — App Spec

- **Version:** v1.0.1
- **App name:** QC Workbench / QC七つ道具
- **Repository:** `ttomohisa/htmlapps-qc-workbench`
- **Distribution:** Single HTML / self-extracting single HTML
- **Runtime:** Browser-only, no account, no installation
- **Data handling:** Imported user data is processed locally; runtime network connections are blocked with `connect-src 'none'`.

## v1.0.0 scope

### Data
- CSV / TSV / text file import
- Spreadsheet-range paste
- UTF-8 / Shift_JIS handling
- Number / datetime / category / text inference with manual override
- Built-in manufacturing sample covering trend and X̄-R / p / np / c / u chart inputs

### Analysis
- Pareto chart
- Histogram
- Trend chart
- Scatter plot with Pearson correlation / regression
- I-MR chart
- X̄-R chart (constant subgroup size 2–10)
- p / np / c / u charts
- Per-analysis filters
- Category stratification
- Separate control limits for stratified control charts
- SVG / PNG chart export
- Gridlines, axis titles, legends, selectable labels, and optional data labels

### Cause analysis
- Fishbone diagrams
- 4M / 5M1E / blank templates
- Causes up to three levels deep
- Pareto category → fishbone effect handoff

### Project / report
- `.qcw.json` project save / restore
- IndexedDB recovery snapshot with explicit resume action
- Selectable analysis / fishbone report content
- Standalone static HTML report
- Source CSV excluded by default; optional local embedding

## Non-goals for v1.0.0
- Excel `.xlsx` direct import
- Cp/Cpk / Pp/Ppk
- CUSUM / EWMA
- Gage R&R
- DOE / ANOVA / advanced regression
- MES / PLC / server collaboration
- Automatic AI root-cause generation

## Release requirements
- Japanese / English UI
- Current Chromium / Firefox / Safari
- Direct `file://` opening
- Responsive UI down to 320 px
- Canonical `assets/favicon.svg` reused by the header brand icon
- `dist/index.html` and `dist/index.self-extract.html`
- No unresolved build placeholders
- Runtime `connect-src 'none'`
- README / README.ja / CHANGELOG aligned with implemented behavior

## v1.0.1 reliability and template alignment
- A source-generation guard discards stale CSV/project reads and stale errors after a newer file, paste, sample, reparse, or restored project.
- PNG export captures chart geometry and filename before asynchronous decoding; a source replacement cancels stale chart/fishbone downloads and still releases temporary URLs.
- Original imported bytes are retained so changing encoding actually decodes the file again.
- Invalid/empty replacement input and malformed project structures leave the last valid workspace intact. Header-only CSV is rejected as having no observations.
- Project restore validates the schema-v1 dataset, analysis/filter/display structure, fishbone structure, and report selection arrays before replacing active state. Valid v1.0.0 exports stay compatible.
- The Report section has an editable project backup filename, stored in the project and recovery snapshot. Downloads use a safe basename with exactly one `.qcw.json` suffix. Names are never used as filesystem paths.
- Project replacement uses the canonical accessible confirmation dialog, including Cancel, Escape, backdrop cancellation, and focus restoration.
- Header keeps the actual version visible at narrow widths, destination labels EN/JA, localized accessible names, and truthful local-processing text.
- Help is internally scrollable on short mobile viewports and documents import-reset and backup behavior.
- Build pipeline adopts htmlapps-template `cb908779682fa315ccd0f1eb58549f6c208f36f0` root-artifact generation and exact-copy verification while retaining the QC core embedding.
- Standard same-repository Cloudflare PR previews and PR-close cleanup use existing `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets. Missing credentials skip hosting with a visible workflow notice. No production hosting or Browser Kitty catalog changes are made by this release.
- QC calculation formulas, control-chart constants, and existing statistical missing-value semantics are unchanged. Synthetic tests include independent NIST-formula oracles and constant/missing/zero-count/insufficient/variable-size edge cases; these are software checks, not medical or regulatory validation.
