const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../src/qc-core.js');
function snapshot() { return Core.createProjectSnapshot({appVersion:'1.0.0', dataset:Core.createDataset([['weight'],['10'],['11']],{name:'inspection.csv'})}); }
for (const [name, mutate] of [
 ['missing metadata',s=>delete s.dataset.metadata],
 ['null column',s=>s.dataset.columns[0]=null],
 ['duplicate column IDs',s=>s.dataset.columns.push({...s.dataset.columns[0]})],
 ['invalid row shape',s=>s.dataset.rows[0]=null],
 ['null analysis',s=>s.analyses=[null]],
 ['invalid filter list',s=>s.analyses=[{id:'analysis-1',type:'histogram',columnId:'col-1',filters:{}}]],
 ['malformed fishbone',s=>s.fishbones=[{id:'fishbone-1',effect:'scratch',categories:[null]}]],
 ['invalid report selection',s=>s.uiPreferences.reportExcludedAnalysisIds=3]
]) test(`project restore rejects ${name} before touching active state`,()=>{const s=snapshot();mutate(s);assert.throws(()=>Core.restoreProjectSnapshot(s),/project|dataset/i);});
test('valid legacy project remains compatible and independent',()=>{const s=snapshot();const restored=Core.restoreProjectSnapshot(s);assert.deepEqual(restored,s);restored.dataset.rows[0][1]='changed';assert.equal(s.dataset.rows[0][1],'10');});
test('project filenames keep a fixed extension without paths or control characters',()=>{
 assert.equal(Core.projectFilename('検査 10月.qcw.json'),'検査 10月.qcw.json');
 assert.equal(Core.projectFilename('../qc\\run:\u0000*?.json'),'_qc_run____.qcw.json');
 assert.equal(Core.projectFilename(' . '),'qc-project.qcw.json');
 assert.equal(Core.projectFilename('CON'),'_CON.qcw.json');
 assert.ok(Core.projectFilename('x'.repeat(500)).length<=129);
});
test('malformed nested display settings and deep fishbone causes are rejected',()=>{
 const s=snapshot();s.analyses=[{id:'analysis-1',type:'histogram',columnId:'col-1',display:'invalid'}];
 assert.throws(()=>Core.restoreProjectSnapshot(s),/project/i);
});
