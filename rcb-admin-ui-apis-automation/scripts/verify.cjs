const fs=require('node:fs'),assert=require('node:assert/strict');
process.chdir(require('node:path').resolve(__dirname,'..'));
const data=JSON.parse(fs.readFileSync('reports/execution.json'));
const ids=new Set(data.rows.map(r=>r.id));assert.equal(ids.size,data.rows.length,'Duplicate request IDs');
assert.equal(data.rows.length,JSON.parse(fs.readFileSync('config/endpoint-inventory.json')).length);
assert.equal(Object.values(data.counts).reduce((a,b)=>a+b,0),data.rows.length);
for(const r of data.rows){if(r.writeGuard)assert(['SKIPPED','EXCLUDED'].includes(r.status),`Production write sent: ${r.name}`);if(r.status==='PASS')assert(r.assertions.length>0&&r.assertions.every(a=>a.passed));if(r.status==='FAIL'){assert(r.assertions.some(a=>!a.passed)||r.response?.transportError||r.scriptError);if(data.setupResults){assert(r.request,'Missing failed request evidence');assert(r.response,'Missing failed response evidence');}}}
if(data.setupResults){assert(!data.rows.some(r=>['BLOCKED','SKIPPED','NOT_RUN'].includes(r.status)),'An in-scope API was not attempted');assert.equal(data.rows.filter(r=>r.request).length,data.rows.filter(r=>!r.writeGuard).length);}
for(const file of fs.readdirSync('environments')){if(!file.includes('.template.'))continue;const env=JSON.parse(fs.readFileSync('environments/'+file));assert.equal(env.values.find(v=>v.key==='allow_writes').value,'false');for(const v of env.values)if(/password|token|secret|key|email|mobile|account|bene_|image/i.test(v.key))assert.equal(v.value,'');}
const original=JSON.parse(fs.readFileSync('../rcb-matka-live.postman_environment.json'));
const evidence=fs.readFileSync('reports/execution.json','utf8');for(const v of original.values)if(/password|token|secret|key|email|mobile|account|bene_/i.test(v.key)&&String(v.value).length>3)assert(!evidence.includes(String(v.value)),`Secret leaked: ${v.key}`);
console.log('Verified coverage totals, unique IDs, write protection, assertions, environment sanitization and evidence redaction.');
