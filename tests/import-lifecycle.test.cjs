const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CORE = require('../src/qc-core.js');
const template = fs.readFileSync(process.env.TEST_HTML || require('node:path').join(__dirname, '../src/index.template.html'), 'utf8');

// Execute real import functions; substitute only DOM/rendering boundaries.
function harness() {
  const fields = { '#delimiterSelect': { value: 'auto' }, '#encodingSelect': { value: 'auto' }, '#headerCheckbox': { checked: true }, '#projectFilenameInput': { value: '' }, '#reportTitleInput': { value: '' }, '#includeSourceDataCheckbox': { checked: false }, '#restoreSessionButton': { hidden: false } };
  const state = { loading: false, errors: [], rendered: [] };
  const context = vm.createContext({ CORE, Uint8Array, Blob, console, APP_CONFIG:{version:'1.0.1'}, window:{AppConfirm:{ask:async()=>true}}, applyLanguage(){}, renderReportWorkspace(){}, scheduleRecoverySave(){}, downloadBlob:(blob,name)=>state.download={blob,name}, $: selector => fields[selector], t: key => key,
    setLoading: value => state.loading = value, showError: error => state.errors.push(error), clearError() {}, toast() {},
    renderDataset() { state.rendered.push(context.dataset?.name); },
    reportExcludedAnalysisIds: new Set(), reportExcludedFishboneIds: new Set() });
  vm.runInContext(`var dataset=null, rawSource=null, rawSourceName='', rawSourceKind='', detectedEncoding='utf-8', detectedDelimiter=',', analyses=[], fishbones=[], activeAnalysisId=null, activeFishboneId=null, sourceGeneration=0, language='en', analysisSeq=0;\n` + template.slice(template.indexOf('    function parseText('), template.indexOf('    function renderDataset(')), context);
  const helper = template.match(/    function beginSourceChange\([^\n]+/);
  if (helper) vm.runInContext(helper[0], context);
  vm.runInContext(template.slice(template.indexOf('    function currentProjectSnapshot('), template.indexOf('    function openRecoveryDb(')),context);
  return { context, fields, state };
}
function pendingFile(name) { let resolve, reject; const promise = new Promise((res, rej) => { resolve=res; reject=rej; }); return { file: { name, arrayBuffer: () => promise }, resolve: text => resolve(new TextEncoder().encode(text).buffer), reject }; }

test('a late file read cannot replace the newer file', async () => {
  const { context:c, state } = harness(); const a=pendingFile('old.csv'), b=pendingFile('new.csv');
  const pa=c.loadFile(a.file), pb=c.loadFile(b.file); b.resolve('weight\n20\n21'); await pb; a.resolve('weight\n1\n2'); await pa;
  assert.equal(c.dataset.name,'new.csv'); assert.equal(c.dataset.rows[0][1],'20'); assert.equal(state.loading,false);
});
test('pasted input invalidates a pending file and stale failures stay silent', async () => {
  const { context:c, state } = harness(); const a=pendingFile('old.csv'); const pa=c.loadFile(a.file);
  c.parseText('weight\n30\n31','Pasted table','paste'); a.reject(new Error('stale error')); await pa;
  assert.equal(c.dataset.name,'Pasted table'); assert.deepEqual(state.errors,[]); assert.equal(state.loading,false);
});
test('encoding changes decode original bytes rather than previously decoded text', async () => {
  const { context:c, fields } = harness(); const bytes=new Uint8Array([0x6e,0x61,0x6d,0x65,0x0a,0x83,0x65,0x83,0x58,0x83,0x67]);
  fields['#encodingSelect'].value='utf-8'; await c.loadFile({name:'sjis.csv',arrayBuffer:async()=>bytes.buffer});
  assert.notEqual(c.dataset.rows[0][1],'テスト'); fields['#encodingSelect'].value='shift_jis'; c.reparse();
  assert.equal(c.dataset.rows[0][1],'テスト'); assert.ok(c.rawSource instanceof Uint8Array);
});
test('a rejected replacement retains the last valid dataset and reparse source', async () => {
  const { context:c } = harness(); c.parseText('weight\n10\n11','good.csv','paste'); const oldRaw=c.rawSource;
  await c.loadFile({name:'empty.csv',arrayBuffer:async()=>new ArrayBuffer(0)});
  assert.equal(c.dataset.name,'good.csv'); assert.equal(c.rawSource,oldRaw);
});

function projectSnapshot(name='project.csv') { return CORE.createProjectSnapshot({dataset:CORE.createDataset([['weight'],['40'],['42']],{name}),analyses:[{id:'analysis-1',type:'histogram',columnId:'col-1',filters:[]}],uiPreferences:{projectFilename:'saved-name'}}); }
test('malformed project metadata cannot partially replace the active workspace',async()=>{
 const {context:c,state}=harness();c.parseText('weight\n10\n11','good.csv','paste');const before=c.dataset,raw=c.rawSource;
 const bad=projectSnapshot();bad.dataset.name=123;
 await c.loadProjectFile({name:'invalid.qcw.json',text:async()=>JSON.stringify(bad)});
 assert.equal(c.dataset,before);assert.equal(c.rawSource,raw);assert.equal(state.loading,false);assert.equal(state.errors.length,1);
});
test('a deferred project read cannot overwrite a newer pasted dataset',async()=>{
 const {context:c,state}=harness();let resolve;const pending=c.loadProjectFile({name:'slow.qcw.json',text:()=>new Promise(r=>resolve=r)});
 c.parseText('weight\n10\n11','new.csv','paste');resolve(JSON.stringify(projectSnapshot()));await pending;
 assert.equal(c.dataset.name,'new.csv');assert.deepEqual(state.errors,[]);assert.equal(state.loading,false);
});
test('a deferred CSV read cannot overwrite a project restored in the meantime',async()=>{
 const {context:c}=harness();const csv=pendingFile('old.csv');const pending=c.loadFile(csv.file);
 c.applyProjectSnapshot(projectSnapshot());csv.resolve('weight\n1\n2');await pending;
 assert.equal(c.dataset.name,'project.csv');assert.equal(c.analyses.length,1);
});
test('cancel leaves state unchanged and project save persists the edited safe filename',async()=>{
 const {context:c,fields,state}=harness();c.applyProjectSnapshot(projectSnapshot());const before=c.dataset;
 c.window.AppConfirm.ask=async()=>false;await c.loadProjectFile({name:'other.qcw.json',text:async()=>JSON.stringify(projectSnapshot('other.csv'))});
 assert.equal(c.dataset,before);fields['#projectFilenameInput'].value='review/backup';c.saveProject();
 assert.equal(state.download.name,'review_backup.qcw.json');const saved=JSON.parse(await state.download.blob.text());
 assert.equal(saved.uiPreferences.projectFilename,'review_backup');c.applyProjectSnapshot(saved);assert.equal(fields['#projectFilenameInput'].value,'review_backup');
});
test('a PNG awaiting image decode is discarded after the source changes',async()=>{
 const {context:c,state}=harness();const images=[];let revoked=0;
 c.currentSvg='<svg viewBox="0 0 900 420"></svg>';c.activeAnalysis=()=>({title:'old analysis'});c.slugifyFile=value=>value;
 c.URL={createObjectURL:()=> 'blob:test',revokeObjectURL:()=>revoked++};c.Image=class {constructor(){images.push(this);}set src(value){}};
 c.document={createElement:()=>({getContext:()=>({fillRect(){},drawImage(){}}),toBlob:callback=>callback(new Blob(['png']))})};
 vm.runInContext(template.slice(template.indexOf('    async function savePng('),template.indexOf('    function saveFishboneSvg(')),c);
 const pending=c.savePng();c.parseText('weight\n1\n2','new.csv','paste');images[0].onload();await pending;
 assert.equal(state.download,undefined);assert.equal(revoked,1);
});
test('PNG export keeps the captured geometry and filename when another analysis is selected',async()=>{
 const {context:c,state}=harness();const images=[];let canvas;const analysis={title:'captured'};
 c.currentSvg='<svg viewBox="0 0 900 900"></svg>';c.activeAnalysis=()=>analysis;c.slugifyFile=value=>value;
 c.URL={createObjectURL:()=> 'blob:test',revokeObjectURL(){}};c.Image=class {constructor(){images.push(this);}set src(value){}};
 c.document={createElement:()=>canvas={getContext:()=>({fillRect(){},drawImage(){}}),toBlob:callback=>callback(new Blob(['png']))}};
 vm.runInContext(template.slice(template.indexOf('    async function savePng('),template.indexOf('    function saveFishboneSvg(')),c);
 const pending=c.savePng();c.currentSvg='<svg viewBox="0 0 900 420"></svg>';analysis.title='changed';images[0].onload();await pending;
 assert.equal(canvas.height,1800);assert.equal(state.download.name,'captured.png');
});
