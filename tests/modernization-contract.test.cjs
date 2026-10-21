const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const template=read('src/index.template.html');
test('header shows version at mobile sizes, destination language and localized names',()=>{
 assert.doesNotMatch(template,/\.version-badge\s*\{\s*display\s*:\s*none/);
 assert.match(template,/language==='ja'\?'EN':'JA'/);
 assert.match(template,/switchLanguage:'英語に切り替え'/);
 assert.match(template,/switchLanguage:'Switch to Japanese'/);
 assert.match(template,/setAttribute\('aria-label',t\('switchLanguage'\)\)/);
 assert.match(template,/setAttribute\('title',t\('switchLanguage'\)\)/);
 assert.match(template,/id="helpButton"[^>]*data-i18n-aria="helpTitle"[^>]*data-i18n-title="helpTitle"/);
 assert.match(template,/localOnly:'完全ローカル処理'/);
});
test('project saves use the editable filename and store it in snapshots',()=>{
 assert.match(template,/id="projectFilenameInput"/);
 assert.match(template,/projectFilename:\$\('#projectFilenameInput'\)\.value/);
 assert.match(template,/function saveProject\(\)[^\n]*CORE\.projectFilename\(\$\('#projectFilenameInput'\)\.value\)/);
 assert.doesNotMatch(template,/window\.confirm\(t\('confirmOpenProject'\)\)/);
 assert.match(template,/id="appConfirmClose"[^>]*data-i18n-aria="close"/);
});
test('help stays scrollable within short viewports and documents import reset and backups',()=>{
 assert.match(template,/#helpDialog\[open\][^{]*\{[^}]*display:flex/);
 assert.match(template,/#helpDialog \.dialog-body\{[^}]*min-height:0/);
 assert.match(template,/APP:HELP:BEGIN/); assert.match(template,/APP:HELP:END/);
 assert.match(template,/helpImport/); assert.match(template,/Browser recovery storage can be cleared/);
});
test('template build produces and verifies the root HTML artifact',()=>{
 assert.match(read('build-standalone.ps1'),/rootHtmlOutputPath/);
 assert.match(read('build-standalone.ps1'),/__QC_CORE_JS__/);
 assert.match(read('scripts/check-repository.ps1'),/Repository-root HTML must be an exact copy/);
 assert.match(read('.github/workflows/build-standalone.yml'),/npm test/);
});
test('Cloudflare preview isolates PR code from credentials and keeps paired cleanup',()=>{
 const build=read('.github/workflows/preview.yml');
 const deploy=read('.github/workflows/preview-deploy.yml');
 const cleanup=read('.github/workflows/preview-cleanup.yml');
 assert.match(build,/head.repo.full_name == github.repository/);
 assert.match(build,/npm test/);
 assert.doesNotMatch(build,/secrets\.|pull-requests: write/);
 assert.match(deploy,/workflow_run:/);
 assert.match(deploy,/CLOUDFLARE_API_TOKEN/);
 assert.match(deploy,/CLOUDFLARE_ACCOUNT_ID/);
 assert.match(deploy,/needs\.deploy\.outputs\.preview_url/);
 assert.match(cleanup,/pull_request_target:/);
 assert.match(cleanup,/closed/);
 assert.match(cleanup,/ref: \$\{\{ github\.workflow_sha \}\}/);
 assert.doesNotMatch(cleanup,/ref: .*pull_request\.head/);
 assert.match(read('.github/scripts/preview-command.cjs'),/preview-control/);
 assert.match(deploy,/wrangler@4\.135\.0/);
 assert.equal(JSON.parse(read('wrangler.preview.jsonc')).assets.directory,'./dist');
});

test('header language and Help controls preserve 44-pixel interaction targets',()=>{
 assert.match(template,/\.language-button\{[^}]*min-width:44px[^}]*min-height:44px/);
 assert.match(template,/\.header-icon-button\{[^}]*width:44px[^}]*height:44px/);
});
