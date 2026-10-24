const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Url } = require('postman-collection');
process.chdir(path.resolve(__dirname, '..'));
const collection = JSON.parse(fs.readFileSync('collections/rcb-admin-ui.postman_collection.json'));
const environment = JSON.parse(fs.readFileSync('environments/live.private.json'));
const execution = JSON.parse(fs.readFileSync('reports/execution.json'));
const output = 'exports/private';
fs.mkdirSync(output, { recursive: true });
const enabled = environment.values.filter(v => v.enabled !== false);
const values = Object.fromEntries(enabled.map(v => [v.key, v.key === 'allow_writes' ? 'false' : v.value]));
const credentialKey = /password|token|secret|key|email|mobile|client_id|bene_/i;
const inline = text => text.replace(/{{([^}]+)}}/g, (match, key) =>
  values[key] && (credentialKey.test(key) || /^(admin|player)_(api|root)$|url$/.test(key))
    ? String(values[key]) : match);
function transform(value) {
  if (typeof value === 'string') return inline(value);
  if (Array.isArray(value)) return value.map(transform);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,transform(v)]));
  return value;
}
function scripts(item) {
  for (const event of item.event || []) event.script.exec = event.script.exec.map(line => line
    .replace(/pm\.environment\.(get|set|unset|has)\(/g, 'pm.collectionVariables.$1(')
    .replace(/pm\.environment\.name/g, "'Embedded LIVE configuration'"));
  for (const child of item.item || []) scripts(child);
}
const all = [];
function flatten(items) { for (const item of items) { if (item.request) all.push(item); if (item.item) flatten(item.item); } }
flatten(collection.item);
const setup = all.filter(item => /^Sign in as admin|^Who am I ·/.test(item.name));
assert.equal(setup.length, 2);
for (const status of ['BLOCKED','SKIPPED']) {
  const selected = execution.rows.filter(row => row.status === status);
  const ids = new Set(selected.map(row => row.id));
  function filter(items) {
    return items.flatMap(item => {
      if (item.item) { const children=filter(item.item); return children.length ? [{...structuredClone(item), item:children}] : []; }
      return ids.has(item.id) ? [structuredClone(item)] : [];
    });
  }
  const result = structuredClone(collection);
  result.info.name = `RCB Admin UI APIs Automation ${status} PRIVATE`;
  result.info.description = `${selected.length} ${status.toLowerCase()} requests from execution ${execution.started}, plus 2 setup requests. Contains hardcoded supplied credentials. Production writes remain disabled. Missing credentials and fixtures are not invented. No environment selection is required; use collection variables. Results are historical, not a new execution.`;
  const variables = new Map((result.variable || []).map(v => [v.key,v]));
  for (const [key,value] of Object.entries(values)) variables.set(key, {key,value,type:'string'});
  result.variable = [...variables.values()];
  result.item = [{name:'00 Authentication prerequisites', item:structuredClone(setup)}, ...filter(collection.item)];
  function requests(items) {for(const item of items) {
    if(item.item)requests(item.item);
    if(!item.request)continue;
    const originalUrl=item.request.url;
    item.request=transform(item.request);
    item.request.url=new Url(inline(originalUrl.raw)).toJSON();
    if(originalUrl.variable)item.request.url.variable=transform(originalUrl.variable);
    // Saved local examples may contain customer records. They are not needed to run these exports.
    item.response=[];
    const row=selected.find(row=>row.id===item.id);
    if(row)item.request.description=`Previous result: ${row.status}. Reason: ${row.reason}\n\n${item.request.description||''}`;
  }}
  requests(result.item);scripts(result);
  const file=`${output}/rcb-admin-ui-${status.toLowerCase()}.private.postman_collection.json`;
  fs.writeFileSync(file,JSON.stringify(result,null,2));
  const written=JSON.parse(fs.readFileSync(file));
  let count=0;function countItems(items){for(const item of items){if(item.request)count++;if(item.item)countItems(item.item);}}countItems(written.item);
  assert.equal(count,selected.length+2);
  assert.equal(written.variable.find(v=>v.key==='allow_writes').value,'false');
  const login=written.item[0].item[0];
  assert.equal(JSON.parse(login.request.body.raw).password,values.admin_password);
  console.log(`${status}: ${selected.length} selected APIs + 2 setup requests; JSON and embedded login verified.`);
}
fs.writeFileSync(`${output}/credentials.private.json`,JSON.stringify({
  note:'Supplied credentials only. Missing provider keys and runtime tokens remain empty. Keep this file private.',
  credentials:Object.fromEntries(enabled.filter(v=>credentialKey.test(v.key)).map(v=>[v.key,v.value]))
},null,2));
fs.writeFileSync(`${output}/README.txt`,'RCB Admin UI APIs Automation private exports\n\nImport either collection into Postman. Clear any selected environment so older environment variables do not override embedded collection values. Run the Authentication prerequisites folder first. Credentials are hardcoded in login request bodies and embedded in collection variables. Session tokens are populated by login scripts.\n\nBLOCKED: 13 APIs plus 2 setup requests.\nSKIPPED: 106 APIs plus 2 setup requests.\n\nThese exports preserve the production write guard allow_writes=false. They do not resolve missing player, bank-account, image, or other fixtures. Some skipped requests require sub-admin credentials or intentionally disclose passwords; review individually before running. No new live requests were executed when exporting.\n\ncredentials.private.json contains the supplied credential values; unconfigured provider credentials remain blank. All files in this directory are ignored by Git.\n');
