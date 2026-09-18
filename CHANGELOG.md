# Changelog

## v1.0.0 - 2026-09-18

- Promoted QC Workbench to the first stable release.
- Finalized the shared-dataset workflow for Pareto, histogram, trend, scatter, I-MR, X̄-R, p, np, c, and u analyses.
- Finalized filters, stratification, fishbone cause analysis, `.qcw.json` project persistence, local recovery, chart export, and standalone HTML reports.
- Kept the v0.9.1 report-export repair and standard chart labels / gridlines / axis titles / legends.
- Kept the v0.9.2 analysis-field visibility fix and built-in sample improvements for datetime and control-chart inputs.
- Rewrote the English and Japanese README files to match the release documentation structure used by `html-pdf-organizer`, including usage, build, privacy, limitations, and control-chart input requirements.

## v0.9.2 - 2026-09-18

- Fixed analysis-specific fields appearing for the wrong chart types because author CSS overrode the HTML `hidden` attribute.
- Trend charts now default to the first datetime column for the X axis when available; row order remains selectable.
- Adjusted the built-in sample so `subgroup` is inferred as a category while keeping constant subgroup sizes for X̄-R.
- Added regression tests for hidden settings, default X-axis selection, and sample column types.

## v0.9.1 - 2026-09-18

- Fixed HTML report export after the v0.9.0 UX refactor by restoring analysis SVG capture used by the report builder.
- Added compact chart display settings for data labels, gridlines, axis titles, and legends.
- Added a selectable label column for trend and scatter charts.
- Added standard axis ticks, gridlines, axis titles, and legends to Pareto, histogram, trend, scatter, and control charts.
- Limited rendered text labels on very large charts to preserve readability and performance.

## v0.9.0 - 2026-09-18

- Redesigned the dataset, analysis, cause-analysis, and report workflows for a more compact PC/mobile experience.
- Fixed report/project lists so analyses and fishbones stay synchronized after edits.
