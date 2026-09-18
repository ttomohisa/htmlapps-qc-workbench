(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.QCCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function countDelimiter(line, delimiter) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && ch === delimiter) {
        count++;
      }
    }
    return count;
  }

  function detectDelimiter(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).slice(0, 8);
    if (!lines.length) return ',';
    const candidates = [',', '\t', ';'];
    let best = ',';
    let bestScore = -1;
    for (const delimiter of candidates) {
      const counts = lines.map(line => countDelimiter(line, delimiter));
      const positive = counts.filter(v => v > 0);
      if (!positive.length) continue;
      const first = positive[0];
      const consistent = positive.filter(v => v === first).length;
      const score = consistent * 100 + first;
      if (score > bestScore) {
        bestScore = score;
        best = delimiter;
      }
    }
    return best;
  }

  function parseDelimited(text, delimiter) {
    const source = String(text || '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (quoted) {
        if (ch === '"') {
          if (source[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            quoted = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === delimiter) {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field.replace(/\r$/, ''));
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
    if (field.length || row.length) {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
    }
    while (rows.length && rows[rows.length - 1].every(v => v === '')) rows.pop();
    return rows;
  }

  function isLeadingZeroIdentifier(value) {
    const s = String(value).trim();
    return /^[-+]?0\d+$/.test(s);
  }

  function isNumberLike(value) {
    const s = String(value).trim();
    if (!s || isLeadingZeroIdentifier(s)) return false;
    const cleaned = s.replace(/,/g, '');
    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(cleaned) && Number.isFinite(Number(cleaned));
  }

  function isUnambiguousDate(value) {
    const s = String(value).trim();
    if (!s) return false;
    return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(s)
      || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(s);
  }

  function inferColumnType(values) {
    const nonEmpty = values.map(v => String(v ?? '').trim()).filter(Boolean);
    if (!nonEmpty.length) return { type: 'text', confidence: 0 };
    const numberCount = nonEmpty.filter(isNumberLike).length;
    if (numberCount / nonEmpty.length >= 0.9) return { type: 'number', confidence: numberCount / nonEmpty.length };
    const dateCount = nonEmpty.filter(isUnambiguousDate).length;
    if (dateCount / nonEmpty.length >= 0.9) return { type: 'datetime', confidence: dateCount / nonEmpty.length };
    const uniqueCount = new Set(nonEmpty).size;
    if (nonEmpty.length >= 20 && uniqueCount <= 100 && uniqueCount / nonEmpty.length <= 0.20) {
      return { type: 'category', confidence: 1 - uniqueCount / nonEmpty.length };
    }
    if (nonEmpty.every(isLeadingZeroIdentifier)) return { type: 'category', confidence: 1 };
    return { type: 'text', confidence: 0.5 };
  }

  function normalizeHeaders(rawHeaders, width) {
    const used = new Map();
    const headers = [];
    for (let i = 0; i < width; i++) {
      const original = String(rawHeaders[i] ?? '').trim();
      const base = original || `Column ${i + 1}`;
      const seen = (used.get(base) || 0) + 1;
      used.set(base, seen);
      headers.push({ originalName: original, name: seen === 1 ? base : `${base} (${seen})` });
    }
    return headers;
  }

  function createDataset(rows, options = {}) {
    const cleanRows = Array.isArray(rows) ? rows.filter(row => Array.isArray(row)) : [];
    const width = cleanRows.reduce((max, row) => Math.max(max, row.length), 0);
    if (!width) return { id: 'dataset-empty', name: options.name || 'Untitled', source: options.source || 'unknown', columns: [], rows: [], metadata: { rowCount: 0, columnCount: 0 } };
    const hasHeader = options.hasHeader !== false;
    const headers = normalizeHeaders(hasHeader ? cleanRows[0] : [], width);
    const dataRows = (hasHeader ? cleanRows.slice(1) : cleanRows).map((row, rowIndex) => [
      rowIndex + 1,
      ...Array.from({ length: width }, (_, i) => String(row[i] ?? ''))
    ]);
    const columns = headers.map((header, columnIndex) => {
      const values = dataRows.map(row => row[columnIndex + 1]);
      const inferred = inferColumnType(values);
      const nonEmpty = values.map(v => String(v).trim()).filter(Boolean);
      return {
        id: `col-${columnIndex + 1}`,
        name: header.name,
        originalName: header.originalName,
        type: inferred.type,
        inferredType: inferred.type,
        typeOverridden: false,
        missingCount: values.length - nonEmpty.length,
        uniqueCount: new Set(nonEmpty).size
      };
    });
    return {
      id: `dataset-${Date.now().toString(36)}`,
      name: options.name || 'Untitled',
      source: options.source || 'import',
      columns,
      rows: dataRows,
      metadata: { rowCount: dataRows.length, columnCount: width }
    };
  }

  function decodeBytes(bytes, forcedEncoding) {
    const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const withoutBom = input.length >= 3 && input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf ? input.slice(3) : input;
    if (forcedEncoding) {
      return { text: new TextDecoder(forcedEncoding, { fatal: false }).decode(withoutBom), encoding: forcedEncoding.toLowerCase() };
    }
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(withoutBom), encoding: 'utf-8' };
    } catch {
      return { text: new TextDecoder('shift_jis', { fatal: false }).decode(input), encoding: 'shift_jis' };
    }
  }

  function overrideColumnType(dataset, columnId, nextType) {
    const allowed = new Set(['number', 'datetime', 'category', 'text']);
    if (!dataset || !allowed.has(nextType)) return dataset;
    const column = dataset.columns.find(item => item.id === columnId);
    if (!column) return dataset;
    column.type = nextType;
    column.typeOverridden = column.type !== column.inferredType;
    return dataset;
  }


  function getColumnIndex(dataset, columnId) {
    const index = dataset?.columns?.findIndex(column => column.id === columnId) ?? -1;
    if (index < 0) throw new Error(`Column not found: ${columnId}`);
    return index + 1;
  }

  function toFiniteNumber(value) {
    const s = String(value ?? '').trim();
    if (!s || !isNumberLike(s)) return null;
    const n = Number(s.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function quantileSorted(sorted, p) {
    if (!sorted.length) return NaN;
    if (sorted.length === 1) return sorted[0];
    const position = (sorted.length - 1) * p;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const weight = position - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  function calculatePareto(dataset, categoryColumnId) {
    const columnIndex = getColumnIndex(dataset, categoryColumnId);
    const counts = new Map();
    let excludedMissing = 0;
    for (const row of dataset.rows || []) {
      const label = String(row[columnIndex] ?? '').trim();
      if (!label) {
        excludedMissing += 1;
        continue;
      }
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    const items = [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
    const total = items.reduce((sum, item) => sum + item.value, 0);
    let cumulative = 0;
    items.forEach(item => {
      cumulative += item.value;
      item.cumulativePercent = total ? cumulative / total * 100 : 0;
    });
    return { items, total, excludedMissing };
  }

  function calculateHistogram(dataset, numericColumnId, requestedBinCount) {
    const columnIndex = getColumnIndex(dataset, numericColumnId);
    const values = [];
    let excludedMissing = 0;
    for (const row of dataset.rows || []) {
      const raw = row[columnIndex];
      const value = toFiniteNumber(raw);
      if (value === null) {
        excludedMissing += 1;
        continue;
      }
      values.push(value);
    }
    if (!values.length) return { n: 0, mean: NaN, median: NaN, sampleSd: NaN, min: NaN, max: NaN, bins: [], excludedMissing };
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const min = sorted[0];
    const max = sorted[n - 1];
    const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
    const median = quantileSorted(sorted, 0.5);
    const sampleSd = n > 1 ? Math.sqrt(sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)) : 0;
    let binCount = Number.isInteger(requestedBinCount) ? Math.min(100, Math.max(2, requestedBinCount)) : 0;
    if (min === max) {
      binCount = 1;
    } else if (!binCount) {
      const q1 = quantileSorted(sorted, 0.25);
      const q3 = quantileSorted(sorted, 0.75);
      const iqr = q3 - q1;
      const width = iqr > 0 ? 2 * iqr * Math.pow(n, -1 / 3) : 0;
      binCount = width > 0 ? Math.ceil((max - min) / width) : Math.ceil(Math.log2(n) + 1);
      binCount = Math.min(100, Math.max(2, binCount));
    }
    const width = binCount === 1 ? 1 : (max - min) / binCount;
    const bins = Array.from({ length: binCount }, (_, index) => ({
      start: binCount === 1 ? min : min + width * index,
      end: binCount === 1 ? max : (index === binCount - 1 ? max : min + width * (index + 1)),
      count: 0
    }));
    for (const value of sorted) {
      let index = binCount === 1 ? 0 : Math.floor((value - min) / width);
      if (index >= binCount) index = binCount - 1;
      bins[index].count += 1;
    }
    return { n, mean, median, sampleSd, min, max, bins, excludedMissing };
  }

  function calculateTrend(dataset, yColumnId, xColumnId) {
    const yIndex = getColumnIndex(dataset, yColumnId);
    const xIndex = xColumnId ? getColumnIndex(dataset, xColumnId) : 0;
    const points = [];
    let excludedMissing = 0;
    for (const row of dataset.rows || []) {
      const y = toFiniteNumber(row[yIndex]);
      if (y === null) {
        excludedMissing += 1;
        continue;
      }
      points.push({ x: xColumnId ? String(row[xIndex] ?? '') : row[0], y, rowId: row[0] });
    }
    const mean = points.length ? points.reduce((sum, point) => sum + point.y, 0) / points.length : NaN;
    return { points, mean, excludedMissing };
  }


  function createDatasetView(dataset, rows) {
    return {
      ...dataset,
      rows: rows.slice(),
      metadata: { ...(dataset.metadata || {}), rowCount: rows.length, columnCount: dataset.columns?.length || 0 }
    };
  }

  function isMissingValue(value) {
    return String(value ?? '').trim() === '';
  }

  function normalizeFilterValues(value) {
    return Array.isArray(value) ? value.map(item => String(item)) : [String(value ?? '')];
  }

  function matchesFilter(dataset, row, filter) {
    const columnIndex = getColumnIndex(dataset, filter.columnId);
    const column = dataset.columns[columnIndex - 1];
    const raw = row[columnIndex];
    const text = String(raw ?? '').trim();
    const operator = filter.operator || '=';
    if (operator === 'missing') return isMissingValue(raw);
    if (operator === 'not-missing') return !isMissingValue(raw);
    if (isMissingValue(raw)) return false;

    if (column.type === 'number') {
      const actual = toFiniteNumber(raw);
      const a = toFiniteNumber(filter.value);
      const b = toFiniteNumber(filter.value2);
      if (actual === null) return false;
      if (operator === 'between') return a !== null && b !== null && actual >= Math.min(a, b) && actual <= Math.max(a, b);
      if (a === null) return false;
      if (operator === '=') return actual === a;
      if (operator === '!=') return actual !== a;
      if (operator === '>') return actual > a;
      if (operator === '>=') return actual >= a;
      if (operator === '<') return actual < a;
      if (operator === '<=') return actual <= a;
      return false;
    }

    if (column.type === 'datetime') {
      const actual = Date.parse(text);
      const a = Date.parse(String(filter.value ?? ''));
      const b = Date.parse(String(filter.value2 ?? ''));
      if (!Number.isFinite(actual)) return false;
      if (operator === 'between') return Number.isFinite(a) && Number.isFinite(b) && actual >= Math.min(a, b) && actual <= Math.max(a, b);
      if (!Number.isFinite(a)) return false;
      if (operator === 'before' || operator === '<') return actual < a;
      if (operator === 'after' || operator === '>') return actual > a;
      if (operator === '=') return actual === a;
      if (operator === '!=') return actual !== a;
      return false;
    }

    if (operator === 'in' || operator === 'not in') {
      const values = new Set(normalizeFilterValues(filter.value));
      const contains = values.has(text);
      return operator === 'in' ? contains : !contains;
    }
    if (operator === 'contains') return text.toLocaleLowerCase().includes(String(filter.value ?? '').toLocaleLowerCase());
    if (operator === '=') return text === String(filter.value ?? '');
    if (operator === '!=') return text !== String(filter.value ?? '');
    return false;
  }

  function applyFilters(dataset, filters = []) {
    const active = Array.isArray(filters) ? filters.filter(filter => filter && filter.columnId && filter.operator) : [];
    if (!active.length) return { dataset: createDatasetView(dataset, dataset.rows || []), includedRows: dataset.rows?.length || 0, excludedRows: 0 };
    const rows = (dataset.rows || []).filter(row => active.every(filter => matchesFilter(dataset, row, filter)));
    return {
      dataset: createDatasetView(dataset, rows),
      includedRows: rows.length,
      excludedRows: (dataset.rows?.length || 0) - rows.length
    };
  }

  function hashRowId(value) {
    const text = String(value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function samplePointsDeterministically(points, maxPoints) {
    if (!Number.isFinite(maxPoints) || maxPoints <= 0 || points.length <= maxPoints) return points.slice();
    return points
      .map((point, index) => ({ point, index, score: hashRowId(point.rowId) }))
      .sort((a, b) => a.score - b.score || a.index - b.index)
      .slice(0, maxPoints)
      .sort((a, b) => a.index - b.index)
      .map(item => item.point);
  }

  function calculateScatter(dataset, xColumnId, yColumnId, options = {}) {
    const xIndex = getColumnIndex(dataset, xColumnId);
    const yIndex = getColumnIndex(dataset, yColumnId);
    const points = [];
    let excludedMissing = 0;
    for (const row of dataset.rows || []) {
      const x = toFiniteNumber(row[xIndex]);
      const y = toFiniteNumber(row[yIndex]);
      if (x === null || y === null) {
        excludedMissing += 1;
        continue;
      }
      points.push({ x, y, rowId: row[0] });
    }
    const n = points.length;
    let r = NaN;
    let slope = NaN;
    let intercept = NaN;
    if (n >= 2) {
      const meanX = points.reduce((sum, point) => sum + point.x, 0) / n;
      const meanY = points.reduce((sum, point) => sum + point.y, 0) / n;
      let ssX = 0;
      let ssY = 0;
      let cross = 0;
      for (const point of points) {
        const dx = point.x - meanX;
        const dy = point.y - meanY;
        ssX += dx * dx;
        ssY += dy * dy;
        cross += dx * dy;
      }
      if (ssX > 0 && ssY > 0) r = cross / Math.sqrt(ssX * ssY);
      if (ssX > 0) {
        slope = cross / ssX;
        intercept = meanY - slope * meanX;
      }
    }
    const maxDisplayPoints = Number.isFinite(options.maxDisplayPoints) ? Math.max(1, Math.floor(options.maxDisplayPoints)) : 10000;
    const displayPoints = samplePointsDeterministically(points, maxDisplayPoints);
    return { points, displayPoints, sampled: displayPoints.length < points.length, r, slope, intercept, excludedMissing };
  }

  function calculateIMR(dataset, numericColumnId, labelColumnId) {
    const valueIndex = getColumnIndex(dataset, numericColumnId);
    const labelIndex = labelColumnId ? getColumnIndex(dataset, labelColumnId) : 0;
    const values = [];
    let excludedMissing = 0;
    for (const row of dataset.rows || []) {
      const value = toFiniteNumber(row[valueIndex]);
      if (value === null) {
        excludedMissing += 1;
        continue;
      }
      values.push({
        rowId: row[0],
        label: labelColumnId ? String(row[labelIndex] ?? '') : String(row[0]),
        value
      });
    }
    if (values.length < 3) throw new Error('I-MR requires at least 3 valid measurements.');
    const mean = values.reduce((sum, point) => sum + point.value, 0) / values.length;
    const movingRanges = [];
    for (let i = 1; i < values.length; i += 1) {
      movingRanges.push({
        rowId: values[i].rowId,
        label: values[i].label,
        value: Math.abs(values[i].value - values[i - 1].value)
      });
    }
    const mrBar = movingRanges.reduce((sum, point) => sum + point.value, 0) / movingRanges.length;
    const sigmaEstimate = mrBar / 1.128;
    const iUcl = mean + 3 * sigmaEstimate;
    const iLcl = mean - 3 * sigmaEstimate;
    const mrUcl = 3.267 * mrBar;
    const mrLcl = 0;
    values.forEach(point => { point.outOfControl = point.value > iUcl || point.value < iLcl; });
    movingRanges.forEach(point => { point.outOfControl = point.value > mrUcl || point.value < mrLcl; });
    return { values, movingRanges, mean, mrBar, iUcl, iLcl, mrUcl, mrLcl, excludedMissing };
  }


  const XBAR_R_CONSTANTS = Object.freeze({
    2: { A2: 1.880, D3: 0, D4: 3.267 },
    3: { A2: 1.023, D3: 0, D4: 2.575 },
    4: { A2: 0.729, D3: 0, D4: 2.282 },
    5: { A2: 0.577, D3: 0, D4: 2.115 },
    6: { A2: 0.483, D3: 0, D4: 2.004 },
    7: { A2: 0.419, D3: 0.076, D4: 1.924 },
    8: { A2: 0.373, D3: 0.136, D4: 1.864 },
    9: { A2: 0.337, D3: 0.184, D4: 1.816 },
    10: { A2: 0.308, D3: 0.223, D4: 1.777 }
  });

  function calculateXbarR(dataset, valueColumnId, subgroupColumnId, labelColumnId) {
    const valueIndex = getColumnIndex(dataset, valueColumnId);
    const subgroupIndex = getColumnIndex(dataset, subgroupColumnId);
    const labelIndex = labelColumnId ? getColumnIndex(dataset, labelColumnId) : 0;
    const groups = new Map();
    const order = [];
    let excludedMissing = 0;
    for (const row of dataset.rows || []) {
      const subgroup = String(row[subgroupIndex] ?? '').trim();
      const value = toFiniteNumber(row[valueIndex]);
      if (!subgroup || value === null) {
        excludedMissing += 1;
        continue;
      }
      if (!groups.has(subgroup)) {
        groups.set(subgroup, []);
        order.push(subgroup);
      }
      groups.get(subgroup).push({ rowId: row[0], label: labelColumnId ? String(row[labelIndex] ?? '') : subgroup, value });
    }
    if (order.length < 2) throw new Error('Xbar-R requires at least 2 subgroups.');
    const size = groups.get(order[0]).length;
    if (size < 2 || size > 10) throw new Error('Xbar-R supports subgroup sizes from 2 to 10.');
    if (!order.every(key => groups.get(key).length === size)) throw new Error('Xbar-R requires constant subgroup size.');
    const constants = XBAR_R_CONSTANTS[size];
    if (!constants) throw new Error('Xbar-R supports subgroup sizes from 2 to 10.');
    const subgroups = order.map((key, index) => {
      const values = groups.get(key);
      const nums = values.map(item => item.value);
      const mean = nums.reduce((sum, value) => sum + value, 0) / nums.length;
      const range = Math.max(...nums) - Math.min(...nums);
      return {
        rowId: index + 1,
        key,
        label: key,
        n: nums.length,
        values: nums,
        mean,
        range
      };
    });
    const xDoubleBar = subgroups.reduce((sum, group) => sum + group.mean, 0) / subgroups.length;
    const rBar = subgroups.reduce((sum, group) => sum + group.range, 0) / subgroups.length;
    const xUcl = xDoubleBar + constants.A2 * rBar;
    const xLcl = xDoubleBar - constants.A2 * rBar;
    const rUcl = constants.D4 * rBar;
    const rLcl = constants.D3 * rBar;
    subgroups.forEach(group => {
      group.meanOutOfControl = group.mean > xUcl || group.mean < xLcl;
      group.rangeOutOfControl = group.range > rUcl || group.range < rLcl;
    });
    return { subgroups, subgroupSize: size, constants, xDoubleBar, rBar, xUcl, xLcl, rUcl, rLcl, excludedMissing };
  }

  function parseIntegerLike(value) {
    const text = String(value ?? '').trim();
    if (!/^\d+$/.test(text)) return null;
    const n = Number(text);
    return Number.isSafeInteger(n) ? n : null;
  }

  function calculatePChart(dataset, defectiveColumnId, sampleSizeColumnId, labelColumnId) {
    const defectiveIndex = getColumnIndex(dataset, defectiveColumnId);
    const sampleSizeIndex = getColumnIndex(dataset, sampleSizeColumnId);
    const labelIndex = labelColumnId ? getColumnIndex(dataset, labelColumnId) : 0;
    const subgroups = [];
    let excludedMissing = 0;
    for (const row of dataset.rows || []) {
      const defective = parseIntegerLike(row[defectiveIndex]);
      const sampleSize = parseIntegerLike(row[sampleSizeIndex]);
      if (defective === null || sampleSize === null || sampleSize <= 0 || defective > sampleSize) {
        excludedMissing += 1;
        continue;
      }
      subgroups.push({
        rowId: row[0],
        label: labelColumnId ? String(row[labelIndex] ?? '') : String(row[0]),
        defective,
        sampleSize,
        proportion: defective / sampleSize
      });
    }
    if (subgroups.length < 2) throw new Error('p chart requires at least 2 valid subgroups.');
    const totalDefective = subgroups.reduce((sum, item) => sum + item.defective, 0);
    const totalSampleSize = subgroups.reduce((sum, item) => sum + item.sampleSize, 0);
    const pBar = totalDefective / totalSampleSize;
    subgroups.forEach(group => {
      const sigma = Math.sqrt((pBar * (1 - pBar)) / group.sampleSize);
      group.ucl = Math.min(1, pBar + 3 * sigma);
      group.lcl = Math.max(0, pBar - 3 * sigma);
      group.outOfControl = group.proportion > group.ucl || group.proportion < group.lcl;
    });
    return { subgroups, pBar, totalDefective, totalSampleSize, excludedMissing };
  }

  function calculateNpChart(dataset, defectiveColumnId, sampleSizeColumnId, labelColumnId) {
    const pResult = calculatePChart(dataset, defectiveColumnId, sampleSizeColumnId, labelColumnId);
    const sampleSizes = new Set(pResult.subgroups.map(group => group.sampleSize));
    if (sampleSizes.size !== 1) throw new Error('np chart requires constant sample size.');
    const sampleSize = pResult.subgroups[0].sampleSize;
    const center = sampleSize * pResult.pBar;
    const sigma = Math.sqrt(sampleSize * pResult.pBar * (1 - pResult.pBar));
    const ucl = Math.min(sampleSize, center + 3 * sigma);
    const lcl = Math.max(0, center - 3 * sigma);
    pResult.subgroups.forEach(group => {
      group.ucl = ucl;
      group.lcl = lcl;
      group.outOfControl = group.defective > ucl || group.defective < lcl;
    });
    return { ...pResult, sampleSize, center, ucl, lcl };
  }

  function calculateCChart(dataset, defectCountColumnId, labelColumnId) {
    const countIndex = getColumnIndex(dataset, defectCountColumnId);
    const labelIndex = labelColumnId ? getColumnIndex(dataset, labelColumnId) : 0;
    const points = [];
    let excludedMissing = 0;
    for (const row of dataset.rows || []) {
      const raw = String(row[countIndex] ?? '').trim();
      if (!raw) {
        excludedMissing += 1;
        continue;
      }
      const value = parseIntegerLike(raw);
      if (value === null) throw new Error('c chart defect counts must be nonnegative integers.');
      points.push({ rowId: row[0], label: labelColumnId ? String(row[labelIndex] ?? '') : String(row[0]), value });
    }
    if (points.length < 2) throw new Error('c chart requires at least 2 valid observations.');
    const cBar = points.reduce((sum, point) => sum + point.value, 0) / points.length;
    const sigma = Math.sqrt(cBar);
    const ucl = cBar + 3 * sigma;
    const lcl = Math.max(0, cBar - 3 * sigma);
    points.forEach(point => { point.outOfControl = point.value > ucl || point.value < lcl; });
    return { points, cBar, ucl, lcl, excludedMissing };
  }

  function calculateUChart(dataset, defectCountColumnId, sampleSizeColumnId, labelColumnId) {
    const countIndex = getColumnIndex(dataset, defectCountColumnId);
    const sampleIndex = getColumnIndex(dataset, sampleSizeColumnId);
    const labelIndex = labelColumnId ? getColumnIndex(dataset, labelColumnId) : 0;
    const points = [];
    let excludedInvalid = 0;
    for (const row of dataset.rows || []) {
      const defects = parseIntegerLike(row[countIndex]);
      const sampleSize = parseIntegerLike(row[sampleIndex]);
      if (defects === null || sampleSize === null || sampleSize <= 0) {
        excludedInvalid += 1;
        continue;
      }
      points.push({
        rowId: row[0],
        label: labelColumnId ? String(row[labelIndex] ?? '') : String(row[0]),
        defects,
        sampleSize,
        rate: defects / sampleSize
      });
    }
    if (points.length < 1) throw new Error('u chart requires at least 1 valid observation.');
    const totalDefects = points.reduce((sum, point) => sum + point.defects, 0);
    const totalSampleSize = points.reduce((sum, point) => sum + point.sampleSize, 0);
    const uBar = totalDefects / totalSampleSize;
    points.forEach(point => {
      const sigma = Math.sqrt(uBar / point.sampleSize);
      point.ucl = uBar + 3 * sigma;
      point.lcl = Math.max(0, uBar - 3 * sigma);
      point.outOfControl = point.rate > point.ucl || point.rate < point.lcl;
    });
    return { points, uBar, totalDefects, totalSampleSize, excludedInvalid };
  }


  let fishboneSequence = 0;

  function createFishbone(template = 'blank', effect = '') {
    const templates = {
      '4m': ['Man', 'Machine', 'Method', 'Material'],
      '5m1e': ['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment'],
      'blank': []
    };
    const names = templates[template] || templates.blank;
    const fishboneId = `fishbone-${++fishboneSequence}`;
    return {
      id: fishboneId,
      template,
      title: String(effect || '').trim(),
      effect: String(effect || '').trim(),
      categories: names.map((name, index) => ({
        id: `${fishboneId}-category-${index + 1}`,
        name,
        causes: []
      }))
    };
  }

  function nextFishboneItemId(fishbone, prefix) {
    fishbone.__sequence = (fishbone.__sequence || 0) + 1;
    return `${fishbone.id || 'fishbone'}-${prefix}-${fishbone.__sequence}`;
  }

  function addFishboneCategory(fishbone, name) {
    if (!fishbone || !Array.isArray(fishbone.categories)) throw new Error('Invalid fishbone.');
    const text = String(name || '').trim();
    if (!text) throw new Error('Category name is required.');
    const category = { id: nextFishboneItemId(fishbone, 'category'), name: text, causes: [] };
    fishbone.categories.push(category);
    return category;
  }

  function removeFishboneCategory(fishbone, categoryId) {
    if (!fishbone || !Array.isArray(fishbone.categories)) return false;
    const index = fishbone.categories.findIndex(category => category.id === categoryId);
    if (index < 0) return false;
    fishbone.categories.splice(index, 1);
    return true;
  }

  function findCauseWithDepth(causes, causeId, depth = 1) {
    for (const cause of causes || []) {
      if (cause.id === causeId) return { cause, depth };
      const nested = findCauseWithDepth(cause.children || [], causeId, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  function addFishboneCause(fishbone, categoryId, text, parentCauseId) {
    if (!fishbone || !Array.isArray(fishbone.categories)) throw new Error('Invalid fishbone.');
    const category = fishbone.categories.find(item => item.id === categoryId);
    if (!category) throw new Error('Fishbone category not found.');
    const causeText = String(text || '').trim();
    if (!causeText) throw new Error('Cause text is required.');
    const cause = { id: nextFishboneItemId(fishbone, 'cause'), text: causeText, children: [] };
    if (!parentCauseId) {
      category.causes.push(cause);
      return cause;
    }
    const parent = findCauseWithDepth(category.causes, parentCauseId);
    if (!parent) throw new Error('Parent cause not found.');
    if (parent.depth >= 3) throw new Error('Fishbone maximum depth is 3 levels.');
    parent.cause.children.push(cause);
    return cause;
  }

  function removeCauseRecursive(causes, causeId) {
    const index = (causes || []).findIndex(cause => cause.id === causeId);
    if (index >= 0) {
      causes.splice(index, 1);
      return true;
    }
    for (const cause of causes || []) {
      if (removeCauseRecursive(cause.children || [], causeId)) return true;
    }
    return false;
  }

  function removeFishboneCause(fishbone, categoryId, causeId) {
    const category = fishbone?.categories?.find(item => item.id === categoryId);
    if (!category) return false;
    return removeCauseRecursive(category.causes, causeId);
  }


  function deepCloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createProjectSnapshot({ appVersion = '', dataset, analyses = [], fishbones = [], checkSheetDefinition = null, uiPreferences = {} } = {}) {
    if (!dataset || !Array.isArray(dataset.columns) || !Array.isArray(dataset.rows)) throw new Error('Project snapshot requires a dataset.');
    return deepCloneJson({
      schemaVersion: 1,
      appVersion: String(appVersion || ''),
      savedAt: new Date().toISOString(),
      dataset,
      analyses: Array.isArray(analyses) ? analyses : [],
      fishbones: Array.isArray(fishbones) ? fishbones : [],
      checkSheetDefinition: checkSheetDefinition || null,
      uiPreferences: uiPreferences && typeof uiPreferences === 'object' ? uiPreferences : {}
    });
  }

  function restoreProjectSnapshot(snapshot) {
    if (!snapshot || Number(snapshot.schemaVersion) !== 1) throw new Error('Unsupported project schema version.');
    if (!snapshot.dataset || !Array.isArray(snapshot.dataset.columns) || !Array.isArray(snapshot.dataset.rows)) throw new Error('Project dataset is missing or invalid.');
    const restored = deepCloneJson(snapshot);
    if (!Array.isArray(restored.analyses)) restored.analyses = [];
    if (!Array.isArray(restored.fishbones)) restored.fishbones = [];
    if (!restored.uiPreferences || typeof restored.uiPreferences !== 'object') restored.uiPreferences = {};
    return restored;
  }

  function csvField(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function datasetToCsv(dataset) {
    if (!dataset || !Array.isArray(dataset.columns) || !Array.isArray(dataset.rows)) throw new Error('Dataset is missing or invalid.');
    const header = dataset.columns.map(column => csvField(column.name)).join(',');
    const body = dataset.rows.map(row => dataset.columns.map((column, index) => csvField(row[index + 1])).join(','));
    return [header, ...body].join('\r\n');
  }


  function chooseDefaultXAxisColumn(columns) {
    const list = Array.isArray(columns) ? columns : [];
    return list.find(column => column?.type === 'datetime')?.id
      || list.find(column => column?.type === 'number')?.id
      || '';
  }

  function reserveFishboneIds(items) {
    for (const item of Array.isArray(items) ? items : []) {
      const match = /^fishbone-(\d+)$/.exec(String(item?.id || ''));
      if (match) fishboneSequence = Math.max(fishboneSequence, Number(match[1]));
    }
    return fishboneSequence;
  }

  function stratifyRows(dataset, columnId, selectedGroups) {
    const index = getColumnIndex(dataset, columnId);
    const wanted = Array.isArray(selectedGroups) ? selectedGroups.map(String) : null;
    const order = [];
    const groups = new Map();
    for (const row of dataset.rows || []) {
      const label = String(row[index] ?? '').trim();
      if (!label) continue;
      if (wanted && !wanted.includes(label)) continue;
      if (!groups.has(label)) {
        groups.set(label, []);
        order.push(label);
      }
      groups.get(label).push(row);
    }
    const labels = wanted ? wanted.filter(label => groups.has(label)) : order;
    return labels.map(label => ({ key: label, label, rows: groups.get(label).slice() }));
  }

  return Object.freeze({
    detectDelimiter,
    parseDelimited,
    inferColumnType,
    createDataset,
    decodeBytes,
    overrideColumnType,
    calculatePareto,
    calculateHistogram,
    calculateTrend,
    applyFilters,
    calculateScatter,
    calculateIMR,
    calculateXbarR,
    calculatePChart,
    calculateNpChart,
    calculateCChart,
    calculateUChart,
    createFishbone,
    addFishboneCategory,
    removeFishboneCategory,
    addFishboneCause,
    removeFishboneCause,
    createProjectSnapshot,
    restoreProjectSnapshot,
    datasetToCsv,
    reserveFishboneIds,
    chooseDefaultXAxisColumn,
    stratifyRows
  });
});
