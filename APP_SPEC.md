# QC Workbench / QC七つ道具 — App Spec

- **Version:** v1.0.0
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
