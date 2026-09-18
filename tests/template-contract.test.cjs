const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const templatePath = path.join(__dirname, '..', 'src', 'index.template.html');
const template = fs.readFileSync(templatePath, 'utf8');

test('header brand icon keeps the canonical appBrandIcon marker', () => {
  assert.match(
    template,
    /<img\s+id=["']appBrandIcon["']\s+src=["']__APP_ICON_DATA_URI__["']\s+alt=["']["']\s*>/,
  );
});

test('template preserves standalone asset and toast contracts from htmlapps-template', () => {
  assert.match(template, /window\.StandaloneAssets\s*=\s*Object\.freeze/);
  assert.match(template, /async\s+bytesAsync\s*\(/);
  assert.match(template, /async\s+blobUrlAsync\s*\(/);
  assert.match(template, /window\.AppToast\s*=\s*Object\.freeze/);
});

test('repository checker validates QC Workbench markers instead of starter-only output filename UI', () => {
  const checker = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'check-repository.ps1'), 'utf8');
  assert.doesNotMatch(checker, /@\("bytesAsync",\s*"blobUrlAsync",\s*"outputFilename",\s*"window\.AppToast"\)/);
  assert.match(checker, /CORE\.createDataset/);
});

test('header follows canonical htmlapps-template structure', () => {
  assert.match(template, /<header class=["']app-header["']>/);
  assert.match(template, /<div class=["']brand-mark["'] aria-hidden=["']true["']>\s*<img id=["']appBrandIcon["']/s);
  assert.match(template, /<div class=["']brand-copy["']>/);
  assert.match(template, /class=["']version-badge["'] id=["']versionBadge["']/);
  assert.match(template, /class=["']brand-meta["']/);
  assert.match(template, /class=["']language-button["'] id=["']languageButton["']/);
  assert.match(template, /class=["']icon-button header-icon-button["'] id=["']helpButton["']/);
});

test('v0.2.0 analysis workspace exposes the three basic QC analyses and export controls', () => {
  assert.match(template, /data-analysis-type=["']pareto["']/);
  assert.match(template, /data-analysis-type=["']histogram["']/);
  assert.match(template, /data-analysis-type=["']trend["']/);
  assert.match(template, /id=["']saveSvgButton["']/);
  assert.match(template, /id=["']savePngButton["']/);
});

test('v0.3.0 analysis workspace exposes scatter, filters, stratification, and duplication controls', () => {
  assert.match(template, /data-analysis-type=["']scatter["']/);
  assert.match(template, /<option value=["']scatter["']/);
  assert.match(template, /id=["']secondaryColumnSelect["']/);
  assert.match(template, /id=["']filterColumnSelect["']/);
  assert.match(template, /id=["']filterOperatorSelect["']/);
  assert.match(template, /id=["']addFilterButton["']/);
  assert.match(template, /id=["']filterList["']/);
  assert.match(template, /id=["']stratifyColumnSelect["']/);
  assert.match(template, /id=["']stratifyGroups["']/);
  assert.match(template, /id=["']duplicateAnalysisButton["']/);
});

test('v0.4.0 exposes I-MR control chart controls and guidance', () => {
  assert.match(template, /data-analysis-type=["']imr["']/);
  assert.match(template, /<option value=["']imr["']/);
  assert.match(template, /id=["']controlOrderColumnSelect["']/);
  assert.match(template, /id=["']controlOrderField["']/);
  assert.match(template, /id=["']controlChartNote["']/);
  assert.match(template, /function\s+renderIMRSvg\s*\(/);
  assert.match(template, /CORE\.calculateIMR/);
});


test('v0.5.0 exposes X̄-R, p, and np control chart controls', () => {
  assert.match(template, /data-analysis-type=["']xbar-r["']/);
  assert.match(template, /data-analysis-type=["']p-chart["']/);
  assert.match(template, /data-analysis-type=["']np-chart["']/);
  assert.match(template, /<option value=["']xbar-r["']/);
  assert.match(template, /<option value=["']p-chart["']/);
  assert.match(template, /<option value=["']np-chart["']/);
  assert.match(template, /id=["']subgroupColumnSelect["']/);
  assert.match(template, /id=["']sampleSizeColumnSelect["']/);
  assert.match(template, /function\s+renderXbarRSvg\s*\(/);
  assert.match(template, /function\s+renderAttributeChartSvg\s*\(/);
  assert.match(template, /CORE\.calculateXbarR/);
  assert.match(template, /CORE\.calculatePChart/);
  assert.match(template, /CORE\.calculateNpChart/);
});

test('v0.6.0 exposes c and u charts and stratified control-chart rendering', () => {
  assert.match(template, /data-analysis-type=["']c-chart["']/);
  assert.match(template, /data-analysis-type=["']u-chart["']/);
  assert.match(template, /<option value=["']c-chart["']/);
  assert.match(template, /<option value=["']u-chart["']/);
  assert.match(template, /CORE\.calculateCChart/);
  assert.match(template, /CORE\.calculateUChart/);
  assert.match(template, /function\s+renderDefectControlSvg\s*\(/);
  assert.match(template, /function\s+renderStackedCharts\s*\(/);
  assert.doesNotMatch(template, /\$\('#stratifyColumnSelect'\)\.disabled=isControl/);
});

test('v0.7.0 exposes fishbone cause-analysis workspace and Pareto handoff', () => {
  assert.match(template, /id=["']fishboneWorkspace["']/);
  assert.match(template, /id=["']newFishbone4M["']/);
  assert.match(template, /id=["']newFishbone5M1E["']/);
  assert.match(template, /id=["']newFishboneBlank["']/);
  assert.match(template, /id=["']fishboneEffectInput["']/);
  assert.match(template, /id=["']fishboneCategoryList["']/);
  assert.match(template, /id=["']fishbonePreview["']/);
  assert.match(template, /id=["']saveFishboneSvgButton["']/);
  assert.match(template, /id=["']saveFishbonePngButton["']/);
  assert.match(template, /function\s+renderFishboneSvg\s*\(/);
  assert.match(template, /data-pareto-label=/);
  assert.match(template, /createFishboneFromPareto/);
});


test('v0.8.0 exposes project save/load, recovery, and HTML report controls', () => {
  assert.match(template, /id=["']saveProjectButton["']/);
  assert.match(template, /id=["']openProjectButton["']/);
  assert.match(template, /id=["']projectFileInput["']/);
  assert.match(template, /id=["']restoreSessionButton["']/);
  assert.match(template, /id=["']reportWorkspace["']/);
  assert.match(template, /id=["']reportAnalysisList["']/);
  assert.match(template, /id=["']reportFishboneList["']/);
  assert.match(template, /id=["']includeSourceDataCheckbox["']/);
  assert.match(template, /id=["']exportReportButton["']/);
  assert.match(template, /function\s+saveProject\s*\(/);
  assert.match(template, /function\s+loadProjectFile\s*\(/);
  assert.match(template, /function\s+openRecoveryDb\s*\(/);
  assert.match(template, /function\s+buildReportHtml\s*\(/);
  assert.match(template, /CORE\.createProjectSnapshot/);
  assert.match(template, /CORE\.restoreProjectSnapshot/);
  assert.match(template, /CORE\.datasetToCsv/);
});

test('v0.9.0 keeps report lists synchronized with analysis and fishbone changes', () => {
  assert.match(template, /function\s+renderReportWorkspace\s*\(/);
  assert.match(template, /const\s+reportExcludedAnalysisIds\s*=\s*new Set\(\)/);
  assert.match(template, /const\s+reportExcludedFishboneIds\s*=\s*new Set\(\)/);
  assert.match(template, /function\s+syncProjectViews\s*\(/);
  assert.match(template, /function\s+renderAnalyses\s*\(\)[\s\S]*?syncProjectViews\(\)/);
  assert.match(template, /function\s+renderFishbones\s*\(\)[\s\S]*?syncProjectViews\(\)/);
});

test('v0.9.0 uses compact column review and compact analysis settings layout', () => {
  assert.match(template, /class=["'][^"']*column-review[^"']*["']/);
  assert.match(template, /class=["']column-review-head["']/);
  assert.match(template, /class=["']analysis-settings-primary["']/);
  assert.match(template, /class=["']settings-disclosure["']/);
  assert.match(template, /grid-template-areas:[^;}]*settings[^;}]*chart/);
});

test('v0.9.0 adds workflow navigation for data analysis causes and report', () => {
  assert.match(template, /id=["']workflowNav["']/);
  assert.match(template, /href=["']#dataSection["']/);
  assert.match(template, /href=["']#analysisSection["']/);
  assert.match(template, /href=["']#causeSection["']/);
  assert.match(template, /href=["']#reportWorkspace["']/);
});

test('v0.9.1 restores report analysis SVG capture after UX refactor', () => {
  assert.match(template, /function\s+captureAnalysisSvg\s*\(/);
  assert.match(template, /buildReportHtml\(\)[\s\S]*?captureAnalysisSvg\(analysis\)/);
});

test('v0.9.1 exposes chart display controls for labels and standard chart furniture', () => {
  assert.match(template, /id=["']chartDisplayDisclosure["']/);
  assert.match(template, /id=["']chartLabelColumnSelect["']/);
  assert.match(template, /id=["']showDataLabelsCheckbox["']/);
  assert.match(template, /id=["']showGridCheckbox["']/);
  assert.match(template, /id=["']showAxisTitlesCheckbox["']/);
  assert.match(template, /id=["']showLegendCheckbox["']/);
  assert.match(template, /function\s+chartDisplayOptions\s*\(/);
});

test('hidden analysis fields cannot be made visible by field display rules', () => {
  assert.match(template, /\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*;?\s*\}/);
});

test('sample dataset exposes datetime, subgroup, and sample-size inputs with useful inferred types', () => {
  const match = template.match(/const sample=`([\s\S]*?)`;/);
  assert.ok(match, 'sample dataset is embedded');
  const Core = require('../src/qc-core.js');
  const rows = Core.parseDelimited(match[1].replace(/\\n/g, '\n'), ',');
  const dataset = Core.createDataset(rows, { hasHeader: true, name: 'sample.csv' });
  const byName = Object.fromEntries(dataset.columns.map(column => [column.name, column]));
  assert.equal(byName.datetime?.type, 'datetime');
  assert.equal(byName.subgroup?.type, 'category');
  assert.equal(byName.sample_size?.type, 'number');
  assert.equal(byName.defective_count?.type, 'number');
  assert.equal(byName.defects?.type, 'number');
});
