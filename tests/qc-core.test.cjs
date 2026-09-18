const test = require('node:test');
const assert = require('node:assert/strict');

const Core = require('../src/qc-core.js');

test('detectDelimiter chooses comma, tab, or semicolon from consistent rows', () => {
  assert.equal(Core.detectDelimiter('a,b,c\n1,2,3\n4,5,6'), ',');
  assert.equal(Core.detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
  assert.equal(Core.detectDelimiter('a;b;c\n1;2;3'), ';');
});

test('parseDelimited preserves quoted delimiters and escaped quotes', () => {
  const rows = Core.parseDelimited('name,note,count\nA,"x,y",1\nB,"said ""ok""",2', ',');
  assert.deepEqual(rows, [
    ['name', 'note', 'count'],
    ['A', 'x,y', '1'],
    ['B', 'said "ok"', '2']
  ]);
});

test('createDataset normalizes duplicate and blank headers without losing originals', () => {
  const dataset = Core.createDataset([
    ['name', 'name', '', 'code'],
    ['A', 'B', 'C', '00123'],
    ['D', 'E', 'F', '00456']
  ], { name: 'sample.csv', hasHeader: true });

  assert.deepEqual(dataset.columns.map(c => c.name), ['name', 'name (2)', 'Column 3', 'code']);
  assert.equal(dataset.rows.length, 2);
  assert.equal(dataset.columns[3].type, 'category');
});

test('inferColumnType treats leading-zero identifiers as category instead of number', () => {
  const result = Core.inferColumnType(['00123', '00456', '00999', '00100']);
  assert.equal(result.type, 'category');
});

test('inferColumnType recognizes numeric and unambiguous datetime columns', () => {
  assert.equal(Core.inferColumnType(['1.2', '3', '-4.5', '', '10']).type, 'number');
  assert.equal(Core.inferColumnType(['2026-09-17', '2026/09/18', '2026-09-19 13:45']).type, 'datetime');
});

test('inferColumnType uses category threshold for repeated text and text for mostly unique values', () => {
  const categories = Array.from({ length: 20 }, (_, i) => ['A', 'B', 'C'][i % 3]);
  const freeText = Array.from({ length: 20 }, (_, i) => `note-${i}`);
  assert.equal(Core.inferColumnType(categories).type, 'category');
  assert.equal(Core.inferColumnType(freeText).type, 'text');
});

test('decodeBytes decodes UTF-8 BOM and Shift_JIS fallback', () => {
  const utf8 = Uint8Array.from([0xef, 0xbb, 0xbf, 0x61, 0x2c, 0x62]);
  const utf8Result = Core.decodeBytes(utf8);
  assert.equal(utf8Result.text, 'a,b');
  assert.equal(utf8Result.encoding, 'utf-8');

  const sjis = Uint8Array.from([0x83, 0x65, 0x83, 0x58, 0x83, 0x67]);
  const sjisResult = Core.decodeBytes(sjis);
  assert.equal(sjisResult.text, 'テスト');
  assert.equal(sjisResult.encoding, 'shift_jis');
});

test('createDataset reports missing and unique counts for each column', () => {
  const dataset = Core.createDataset([
    ['line', 'weight'],
    ['A', '100.1'],
    ['A', ''],
    ['B', '101.0']
  ], { name: 'inspection.csv', hasHeader: true });

  assert.equal(dataset.columns[0].uniqueCount, 2);
  assert.equal(dataset.columns[0].missingCount, 0);
  assert.equal(dataset.columns[1].missingCount, 1);
  assert.equal(dataset.columns[1].type, 'number');
});

test('calculatePareto counts categories, sorts descending, and calculates cumulative percent', () => {
  const dataset = Core.createDataset([
    ['defect'],
    ['Scratch'],
    ['Dent'],
    ['Scratch'],
    [''],
    ['Stain'],
    ['Scratch'],
    ['Dent']
  ], { hasHeader: true });

  const result = Core.calculatePareto(dataset, 'col-1');
  assert.deepEqual(result.items.map(item => [item.label, item.value]), [
    ['Scratch', 3],
    ['Dent', 2],
    ['Stain', 1]
  ]);
  assert.equal(result.total, 6);
  assert.equal(result.excludedMissing, 1);
  assert.equal(result.items.at(-1).cumulativePercent, 100);
});

test('calculateHistogram uses Freedman-Diaconis bins and reports descriptive statistics', () => {
  const dataset = Core.createDataset([
    ['weight'],
    ['99'], ['100'], ['100'], ['101'], ['101'], ['102'], ['102'], ['103']
  ], { hasHeader: true });
  const result = Core.calculateHistogram(dataset, 'col-1');
  assert.equal(result.n, 8);
  assert.equal(result.min, 99);
  assert.equal(result.max, 103);
  assert.equal(result.bins.reduce((sum, bin) => sum + bin.count, 0), 8);
  assert.equal(result.excludedMissing, 0);
  assert.ok(Number.isFinite(result.mean));
  assert.ok(Number.isFinite(result.median));
  assert.ok(Number.isFinite(result.sampleSd));
});

test('calculateHistogram falls back safely when all values are identical', () => {
  const dataset = Core.createDataset([
    ['weight'], ['100'], ['100'], ['100'], ['100']
  ], { hasHeader: true });
  const result = Core.calculateHistogram(dataset, 'col-1');
  assert.equal(result.bins.length, 1);
  assert.equal(result.bins[0].count, 4);
  assert.equal(result.sampleSd, 0);
});

test('calculateTrend preserves source row order and excludes missing numeric values', () => {
  const dataset = Core.createDataset([
    ['date', 'weight'],
    ['2026-09-03', '101'],
    ['2026-09-01', '100'],
    ['2026-09-02', '']
  ], { hasHeader: true });
  const result = Core.calculateTrend(dataset, 'col-2', 'col-1');
  assert.deepEqual(result.points.map(point => [point.x, point.y]), [
    ['2026-09-03', 101],
    ['2026-09-01', 100]
  ]);
  assert.equal(result.excludedMissing, 1);
});

test('applyFilters supports numeric, category, datetime, and text conditions without mutating the source dataset', () => {
  const dataset = Core.createDataset([
    ['date', 'line', 'weight', 'note'],
    ['2026-09-01', 'A', '99.8', 'first lot'],
    ['2026-09-02', 'B', '100.5', 'recheck'],
    ['2026-09-03', 'A', '101.2', 'first lot'],
    ['2026-09-04', '', '102.0', 'final']
  ], { hasHeader: true });
  const originalRows = dataset.rows.length;
  const result = Core.applyFilters(dataset, [
    { columnId: 'col-3', operator: '>=', value: '100' },
    { columnId: 'col-2', operator: 'in', value: ['A', 'B'] },
    { columnId: 'col-1', operator: 'between', value: '2026-09-02', value2: '2026-09-03' },
    { columnId: 'col-4', operator: 'contains', value: 'lot' }
  ]);
  assert.deepEqual(result.dataset.rows.map(row => row[0]), [3]);
  assert.equal(result.includedRows, 1);
  assert.equal(result.excludedRows, 3);
  assert.equal(dataset.rows.length, originalRows);
});

test('applyFilters can select missing and not-missing values', () => {
  const dataset = Core.createDataset([
    ['line', 'weight'],
    ['A', '100'],
    ['', '101'],
    ['B', '']
  ], { hasHeader: true });
  assert.deepEqual(Core.applyFilters(dataset, [{ columnId: 'col-1', operator: 'missing' }]).dataset.rows.map(r => r[0]), [2]);
  assert.deepEqual(Core.applyFilters(dataset, [{ columnId: 'col-2', operator: 'not-missing' }]).dataset.rows.map(r => r[0]), [1, 2]);
});

test('calculateScatter calculates Pearson correlation and linear regression from all valid points', () => {
  const dataset = Core.createDataset([
    ['temperature', 'weight'],
    ['20', '40'],
    ['21', '42'],
    ['22', '44'],
    ['23', '46'],
    ['', '50']
  ], { hasHeader: true });
  const result = Core.calculateScatter(dataset, 'col-1', 'col-2');
  assert.equal(result.points.length, 4);
  assert.equal(result.excludedMissing, 1);
  assert.ok(Math.abs(result.r - 1) < 1e-12);
  assert.ok(Math.abs(result.slope - 2) < 1e-12);
  assert.ok(Math.abs(result.intercept) < 1e-12);
  assert.deepEqual(result.displayPoints, result.points);
});

test('calculateScatter uses deterministic row-id sampling for display while keeping full-data statistics', () => {
  const rows = [['x', 'y']];
  for (let i = 1; i <= 12050; i += 1) rows.push([String(i), String(i * 3 + 2)]);
  const dataset = Core.createDataset(rows, { hasHeader: true });
  const first = Core.calculateScatter(dataset, 'col-1', 'col-2', { maxDisplayPoints: 10000 });
  const second = Core.calculateScatter(dataset, 'col-1', 'col-2', { maxDisplayPoints: 10000 });
  assert.equal(first.points.length, 12050);
  assert.equal(first.displayPoints.length, 10000);
  assert.equal(first.sampled, true);
  assert.deepEqual(first.displayPoints.map(p => p.rowId), second.displayPoints.map(p => p.rowId));
  assert.ok(Math.abs(first.r - 1) < 1e-12);
});

test('stratifyRows groups category values and respects selected groups', () => {
  const dataset = Core.createDataset([
    ['machine', 'weight'],
    ['M01', '100'],
    ['M02', '101'],
    ['M01', '102'],
    ['M03', '103'],
    ['', '104']
  ], { hasHeader: true });
  const groups = Core.stratifyRows(dataset, 'col-1', ['M01', 'M03']);
  assert.deepEqual(groups.map(group => [group.label, group.rows.map(row => row[0])]), [
    ['M01', [1, 3]],
    ['M03', [4]]
  ]);
});

test('stratifyRows distinguishes all groups from an explicit empty group selection', () => {
  const dataset = Core.createDataset([
    ['machine', 'weight'],
    ['M01', '100'],
    ['M02', '101']
  ], { hasHeader: true });
  assert.deepEqual(Core.stratifyRows(dataset, 'col-1', null).map(group => group.label), ['M01', 'M02']);
  assert.deepEqual(Core.stratifyRows(dataset, 'col-1', []), []);
});

test('calculateIMR computes Individuals and Moving Range limits from ordered valid values', () => {
  const dataset = Core.createDataset([
    ['weight'],
    ['10'], ['11'], ['9'], ['10'], ['12']
  ], { hasHeader: true });
  const result = Core.calculateIMR(dataset, 'col-1');
  assert.equal(result.values.length, 5);
  assert.deepEqual(result.values.map(p => p.value), [10, 11, 9, 10, 12]);
  assert.deepEqual(result.movingRanges.map(p => p.value), [1, 2, 1, 2]);
  assert.ok(Math.abs(result.mean - 10.4) < 1e-12);
  assert.ok(Math.abs(result.mrBar - 1.5) < 1e-12);
  assert.ok(Math.abs(result.iUcl - (10.4 + 3 * 1.5 / 1.128)) < 1e-12);
  assert.ok(Math.abs(result.iLcl - (10.4 - 3 * 1.5 / 1.128)) < 1e-12);
  assert.ok(Math.abs(result.mrUcl - (3.267 * 1.5)) < 1e-12);
  assert.equal(result.mrLcl, 0);
});

test('calculateIMR preserves source order, excludes missing values, and flags points beyond control limits', () => {
  const dataset = Core.createDataset([
    ['date', 'weight'],
    ['2026-09-03', '10'],
    ['2026-09-01', '10'],
    ['2026-09-02', ''],
    ['2026-09-04', '10'],
    ['2026-09-05', '10'],
    ['2026-09-06', '10'],
    ['2026-09-07', '10'],
    ['2026-09-08', '10'],
    ['2026-09-09', '10'],
    ['2026-09-10', '10'],
    ['2026-09-11', '30']
  ], { hasHeader: true });
  const result = Core.calculateIMR(dataset, 'col-2', 'col-1');
  assert.deepEqual(result.values.map(p => [p.label, p.value]), [
    ['2026-09-03', 10],
    ['2026-09-01', 10],
    ['2026-09-04', 10],
    ['2026-09-05', 10],
    ['2026-09-06', 10],
    ['2026-09-07', 10],
    ['2026-09-08', 10],
    ['2026-09-09', 10],
    ['2026-09-10', 10],
    ['2026-09-11', 30]
  ]);
  assert.equal(result.excludedMissing, 1);
  assert.equal(result.values.at(-1).outOfControl, true);
  assert.ok(result.movingRanges.some(p => p.outOfControl));
});

test('calculateIMR requires at least three valid measurements', () => {
  const dataset = Core.createDataset([
    ['weight'], ['10'], ['11'], ['']
  ], { hasHeader: true });
  assert.throws(() => Core.calculateIMR(dataset, 'col-1'), /at least 3 valid measurements/i);
});


test('calculateXbarR computes subgroup means, ranges, and limits for constant subgroup size', () => {
  const dataset = Core.createDataset([
    ['subgroup', 'weight'],
    ['1', '10'],
    ['1', '12'],
    ['2', '11'],
    ['2', '13'],
    ['3', '12'],
    ['3', '14']
  ], { hasHeader: true });
  const result = Core.calculateXbarR(dataset, 'col-2', 'col-1');
  assert.equal(result.subgroupSize, 2);
  assert.deepEqual(result.subgroups.map(g => [g.key, g.mean, g.range]), [
    ['1', 11, 2],
    ['2', 12, 2],
    ['3', 13, 2]
  ]);
  assert.ok(Math.abs(result.xDoubleBar - 12) < 1e-12);
  assert.ok(Math.abs(result.rBar - 2) < 1e-12);
  assert.ok(Math.abs(result.xUcl - (12 + 1.880 * 2)) < 1e-12);
  assert.ok(Math.abs(result.xLcl - (12 - 1.880 * 2)) < 1e-12);
  assert.ok(Math.abs(result.rUcl - (3.267 * 2)) < 1e-12);
  assert.equal(result.rLcl, 0);
});

test('calculateXbarR rejects non-constant subgroup sizes', () => {
  const dataset = Core.createDataset([
    ['subgroup', 'weight'],
    ['1', '10'],
    ['1', '12'],
    ['2', '11'],
    ['3', '12'],
    ['3', '14']
  ], { hasHeader: true });
  assert.throws(() => Core.calculateXbarR(dataset, 'col-2', 'col-1'), /constant subgroup size/i);
});

test('calculatePChart computes proportions and varying control limits', () => {
  const dataset = Core.createDataset([
    ['day', 'defective', 'sample_size'],
    ['A', '2', '50'],
    ['B', '3', '60'],
    ['C', '1', '40']
  ], { hasHeader: true });
  const result = Core.calculatePChart(dataset, 'col-2', 'col-3', 'col-1');
  assert.equal(result.subgroups.length, 3);
  assert.ok(Math.abs(result.pBar - (6 / 150)) < 1e-12);
  assert.deepEqual(result.subgroups.map(g => g.label), ['A', 'B', 'C']);
  assert.ok(result.subgroups.every(g => Number.isFinite(g.ucl) && Number.isFinite(g.lcl)));
});

test('calculateNpChart computes constant-size count limits and rejects varying sample sizes', () => {
  const dataset = Core.createDataset([
    ['day', 'defective', 'sample_size'],
    ['A', '2', '50'],
    ['B', '3', '50'],
    ['C', '1', '50']
  ], { hasHeader: true });
  const result = Core.calculateNpChart(dataset, 'col-2', 'col-3', 'col-1');
  assert.equal(result.sampleSize, 50);
  assert.ok(Math.abs(result.center - (50 * (6 / 150))) < 1e-12);
  assert.ok(result.subgroups.every(g => g.ucl === result.ucl && g.lcl === result.lcl));

  const varying = Core.createDataset([
    ['day', 'defective', 'sample_size'],
    ['A', '2', '50'],
    ['B', '3', '60']
  ], { hasHeader: true });
  assert.throws(() => Core.calculateNpChart(varying, 'col-2', 'col-3', 'col-1'), /constant sample size/i);
});

test('calculateCChart computes count limits for nonnegative defect counts', () => {
  const dataset = Core.createDataset([
    ['day', 'defects'],
    ['A', '2'],
    ['B', '3'],
    ['C', '1'],
    ['D', '4']
  ], { hasHeader: true });
  const result = Core.calculateCChart(dataset, 'col-2', 'col-1');
  assert.equal(result.points.length, 4);
  assert.ok(Math.abs(result.cBar - 2.5) < 1e-12);
  assert.ok(Math.abs(result.ucl - (2.5 + 3 * Math.sqrt(2.5))) < 1e-12);
  assert.equal(result.lcl, 0);
  assert.deepEqual(result.points.map(p => p.label), ['A', 'B', 'C', 'D']);
});

test('calculateCChart allows defect counts to exceed one per inspected unit and rejects noninteger counts', () => {
  const valid = Core.createDataset([
    ['defects'], ['0'], ['7'], ['12']
  ], { hasHeader: true });
  assert.equal(Core.calculateCChart(valid, 'col-1').points.at(-1).value, 12);

  const invalid = Core.createDataset([
    ['defects'], ['1.5'], ['2']
  ], { hasHeader: true });
  assert.throws(() => Core.calculateCChart(invalid, 'col-1'), /nonnegative integer/i);
});

test('calculateUChart computes unit defect rates and varying control limits', () => {
  const dataset = Core.createDataset([
    ['day', 'defects', 'sample_size'],
    ['A', '4', '10'],
    ['B', '3', '20'],
    ['C', '5', '10']
  ], { hasHeader: true });
  const result = Core.calculateUChart(dataset, 'col-2', 'col-3', 'col-1');
  assert.equal(result.points.length, 3);
  assert.ok(Math.abs(result.uBar - (12 / 40)) < 1e-12);
  assert.deepEqual(result.points.map(p => p.rate), [0.4, 0.15, 0.5]);
  assert.ok(result.points[0].ucl > result.points[1].ucl);
  assert.ok(result.points.every(p => p.lcl >= 0));
});

test('calculateUChart rejects missing or invalid opportunities instead of treating them as zero', () => {
  const dataset = Core.createDataset([
    ['defects', 'sample_size'],
    ['2', '10'],
    ['3', '0'],
    ['1.5', '5']
  ], { hasHeader: true });
  const result = Core.calculateUChart(dataset, 'col-1', 'col-2');
  assert.equal(result.points.length, 1);
  assert.equal(result.excludedInvalid, 2);
});

test('createFishbone builds 4M, 5M1E, and blank templates without inventing causes', () => {
  const fourM = Core.createFishbone('4m', 'Scratch');
  assert.equal(fourM.effect, 'Scratch');
  assert.deepEqual(fourM.categories.map(c => c.name), ['Man', 'Machine', 'Method', 'Material']);
  assert.ok(fourM.categories.every(c => c.causes.length === 0));

  const fiveM1E = Core.createFishbone('5m1e', 'Dent');
  assert.deepEqual(fiveM1E.categories.map(c => c.name), ['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment']);

  const blank = Core.createFishbone('blank', 'Issue');
  assert.deepEqual(blank.categories, []);
});

test('addFishboneCause supports up to three cause levels and rejects deeper nesting', () => {
  const fishbone = Core.createFishbone('4m', 'Scratch');
  const categoryId = fishbone.categories[0].id;
  const level1 = Core.addFishboneCause(fishbone, categoryId, 'Training');
  const level2 = Core.addFishboneCause(fishbone, categoryId, 'New operator', level1.id);
  const level3 = Core.addFishboneCause(fishbone, categoryId, 'Night shift', level2.id);
  assert.equal(fishbone.categories[0].causes[0].children[0].children[0].text, 'Night shift');
  assert.throws(() => Core.addFishboneCause(fishbone, categoryId, 'Too deep', level3.id), /maximum depth/i);
});

test('removeFishboneCause removes a cause subtree', () => {
  const fishbone = Core.createFishbone('4m', 'Scratch');
  const categoryId = fishbone.categories[1].id;
  const root = Core.addFishboneCause(fishbone, categoryId, 'Blade wear');
  Core.addFishboneCause(fishbone, categoryId, 'Long use', root.id);
  assert.equal(Core.removeFishboneCause(fishbone, categoryId, root.id), true);
  assert.equal(fishbone.categories[1].causes.length, 0);
});

test('addFishboneCategory supports blank diagrams and removeFishboneCategory removes a category', () => {
  const fishbone = Core.createFishbone('blank', 'Issue');
  const category = Core.addFishboneCategory(fishbone, 'Process');
  assert.equal(category.name, 'Process');
  assert.equal(fishbone.categories.length, 1);
  assert.equal(Core.removeFishboneCategory(fishbone, category.id), true);
  assert.equal(fishbone.categories.length, 0);
});


test('createProjectSnapshot and restoreProjectSnapshot preserve dataset analyses and fishbones without sharing references', () => {
  const dataset = Core.createDataset([
    ['line', 'weight'],
    ['A', '100.1'],
    ['B', '101.2']
  ], { name: 'inspection.csv', hasHeader: true });
  dataset.columns[1].type = 'number';
  dataset.columns[1].typeOverridden = true;
  const fishbone = Core.createFishbone('4m', 'Scratch');
  Core.addFishboneCause(fishbone, fishbone.categories[0].id, 'Training');
  const analyses = [{ id: 'analysis-7', type: 'histogram', columnId: 'col-2', filters: [], stratification: { columnId: '', selectedGroups: null } }];
  const snapshot = Core.createProjectSnapshot({
    appVersion: '0.8.0', dataset, analyses, fishbones: [fishbone], uiPreferences: { language: 'ja' }
  });
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.appVersion, '0.8.0');
  assert.equal(snapshot.dataset.name, 'inspection.csv');
  assert.equal(snapshot.analyses[0].id, 'analysis-7');
  assert.equal(snapshot.fishbones[0].effect, 'Scratch');

  const restored = Core.restoreProjectSnapshot(snapshot);
  restored.dataset.columns[0].name = 'changed';
  restored.analyses[0].type = 'pareto';
  restored.fishbones[0].effect = 'Changed';
  assert.equal(snapshot.dataset.columns[0].name, 'line');
  assert.equal(snapshot.analyses[0].type, 'histogram');
  assert.equal(snapshot.fishbones[0].effect, 'Scratch');
});

test('restoreProjectSnapshot rejects unsupported schema versions and missing datasets', () => {
  assert.throws(() => Core.restoreProjectSnapshot({ schemaVersion: 2, dataset: {} }), /schema version/i);
  assert.throws(() => Core.restoreProjectSnapshot({ schemaVersion: 1 }), /dataset/i);
});

test('datasetToCsv emits RFC-style quoted CSV from the current dataset', () => {
  const dataset = Core.createDataset([
    ['name', 'note'],
    ['A', 'plain'],
    ['B', 'with,comma'],
    ['C', 'with "quote"'],
    ['D', 'line\nbreak']
  ], { hasHeader: true });
  const csv = Core.datasetToCsv(dataset);
  assert.equal(csv, 'name,note\r\nA,plain\r\nB,"with,comma"\r\nC,"with ""quote"""\r\nD,"line\nbreak"');
});

test('reserveFishboneIds advances generated fishbone IDs beyond restored projects', () => {
  Core.reserveFishboneIds([{ id: 'fishbone-25' }, { id: 'fishbone-8' }]);
  const fishbone = Core.createFishbone('blank', 'Next');
  const numeric = Number(String(fishbone.id).split('-').pop());
  assert.ok(numeric > 25);
});

test('chooseDefaultXAxisColumn prefers datetime, then numeric columns, otherwise row order', () => {
  assert.equal(Core.chooseDefaultXAxisColumn([
    { id: 'col-1', type: 'text' },
    { id: 'col-2', type: 'number' },
    { id: 'col-3', type: 'datetime' }
  ]), 'col-3');
  assert.equal(Core.chooseDefaultXAxisColumn([
    { id: 'col-1', type: 'text' },
    { id: 'col-2', type: 'number' }
  ]), 'col-2');
  assert.equal(Core.chooseDefaultXAxisColumn([{ id: 'col-1', type: 'text' }]), '');
});
