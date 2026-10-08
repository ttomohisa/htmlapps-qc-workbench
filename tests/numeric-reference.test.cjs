const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../src/qc-core.js');
const expected = require('./fixtures/numeric-expected.json');
const csv = fs.readFileSync(path.join(__dirname,'fixtures/qc-synthetic.csv'),'utf8');
const dataset = Core.createDataset(Core.parseDelimited(csv,','),{name:'qc-synthetic.csv'});
const check = (actual, expected) => { for(const [key,value] of Object.entries(expected)) assert.ok(Math.abs(actual[key]-value)<1e-11,`${key}: ${actual[key]} != ${value}`); };
// Independent hand/Python-calculated oracles use NIST e-Handbook formulas:
// https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc322.htm
// https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc321.htm
// https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc332.htm
// https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc331.htm
// Statistical constants and existing missing-value/calculation semantics are unchanged.
test('synthetic QC results match independent numeric reference values',()=>{
 check(Core.calculateHistogram(dataset,'col-2'),expected.histogram);
 check(Core.calculateScatter(dataset,'col-1','col-2'),expected.scatter);
 check(Core.calculateIMR(dataset,'col-2'),expected.imr);
 const xr=Core.calculateXbarR(dataset,'col-2','col-3');check(xr,expected.xbarR);assert.deepEqual(xr.subgroups.map(p=>p.meanOutOfControl),[true,false,true]);
 const p=Core.calculatePChart(dataset,'col-5','col-6');check(p,{pBar:expected.p.pBar});check(p.subgroups[0],{ucl:expected.p.ucl,lcl:0});
 check(Core.calculateNpChart(dataset,'col-5','col-6'),expected.np);
 check(Core.calculateCChart(dataset,'col-7'),expected.c);
 const u=Core.calculateUChart(dataset,'col-7','col-6');check(u,{uBar:expected.u.uBar});check(u.points[0],{ucl:expected.u.ucl,lcl:0});
 const pareto=Core.calculatePareto(dataset,'col-4');assert.deepEqual(pareto.items.map(p=>[p.label,p.value]),[['Scratch',4],['Dent',2]]);assert.equal(pareto.total,6);
});
test('constant, missing, zero-count, insufficient and variable-size boundaries remain defined',()=>{
 const constant=Core.createDataset([['v','n'],['5','10'],['5','10'],['','10'],['5','10']]);
 assert.equal(Core.calculateHistogram(constant,'col-1').sampleSd,0);
 const imr=Core.calculateIMR(constant,'col-1');assert.equal(imr.mrBar,0);assert.equal(imr.excludedMissing,1);assert.equal(imr.iUcl,5);
 assert.ok(Number.isNaN(Core.calculateScatter(constant,'col-1','col-2').r));
 assert.throws(()=>Core.calculateIMR(Core.createDataset([['x'],['1'],['2']]),'col-1'),/3/);
 const zero=Core.createDataset([['d','n'],['0','10'],['0','20']]);
 assert.equal(Core.calculatePChart(zero,'col-1','col-2').pBar,0);
 assert.equal(Core.calculateUChart(zero,'col-1','col-2').points[0].ucl,0);
 assert.throws(()=>Core.calculateNpChart(zero,'col-1','col-2'),/constant/);
});
