const fs=require('node:fs'),path=require('node:path'),newman=require('newman');
process.chdir(path.resolve(__dirname,'..'));
const inventory=JSON.parse(fs.readFileSync('config/endpoint-inventory.json'));
const collection=JSON.parse(fs.readFileSync('collections/rcb-admin-ui.postman_collection.json'));
const envPath=process.env.RCB_ENVIRONMENT||'environments/live.private.json';
const environment=JSON.parse(fs.readFileSync(envPath));
environment.values.find(v=>v.key==='allow_writes').value='false';
const secrets=environment.values.filter(v=>/password|token|secret|key|email|mobile|account|bene_/i.test(v.key)&&String(v.value).length>3).map(v=>String(v.value));
function redact(value){let s=typeof value==='string'?value:JSON.stringify(value);for(const v of secrets)s=s.split(v).join('[REDACTED]');return s.replace(/Bearer\s+[^\s"<]+/gi,'Bearer [REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED JWT]');}
function cleanBody(raw){try{const visit=o=>{if(Array.isArray(o))return o.map(visit);if(o&&typeof o==='object')return Object.fromEntries(Object.entries(o).map(([k,v])=>[k,/password|token|psd|secret|key|email|mobile|phone|account|ifsc|address|device|username|lat|long|ip$|user_id/i.test(k)?'[REDACTED]':visit(v)]));return o};return redact(JSON.stringify(visit(JSON.parse(raw)),null,2))}catch{return redact(raw)}}
const rows=inventory.map(i=>({...i,status:'SKIPPED',reason:i.writeGuard?'LIVE write guard':i.sensitiveRead?'Sensitive password disclosure endpoint excluded':'Not executed',assertions:[]}));
const byId=new Map(rows.map(r=>[r.id,r]));const bodies=new Map();
function walk(items){for(const i of items){if(i.item)walk(i.item);if(!i.request)continue;const row=byId.get(i.id);const skip=row.writeGuard||row.sensitiveRead||/Sign in as sub-admin|as the sub-admin|Go back to the tech admin/.test(i.name);if(skip){if(!row.writeGuard&&!row.sensitiveRead)row.reason='Role switch excluded to preserve admin session';i.event=[{listen:'prerequest',script:{exec:['pm.execution.skipRequest();']}}];continue;}
 i.event=i.event||[];const urlTemplates=[i.request.url.raw,...(i.request.url.variable||[]).map(v=>v.value)].join(' ');i.event.push({listen:'prerequest',script:{exec:[`const required=${JSON.stringify([...urlTemplates.matchAll(/{{(.*?)}}/g)].map(m=>m[1]))}; if(required.some(k=>!pm.variables.get(k))) { console.warn('RCB_BLOCKED_UNRESOLVED'); pm.execution.skipRequest(); }`]}});
 i.event.push({listen:'test',script:{exec:["pm.test('Response is not a server error',()=>pm.expect(pm.response.code).to.be.below(500));","pm.test('Response within 10 seconds',()=>pm.expect(pm.response.responseTime).to.be.below(10000));",`if ((pm.response.headers.get('Content-Type')||'').includes('json')) { pm.test('JSON parses',()=>pm.response.json()); const b=pm.response.json(); if(Object.prototype.hasOwnProperty.call(b,'success')) pm.test('Business response indicates success or documented empty data',()=>{const ok=['1','true'].includes(String(b.success));const empty=${/no data|no record|no permissions assigned/i.test(i.request.description||'')} && /no data|no record|no permissions assigned/i.test(String(b.message||'')) && ['0','2'].includes(String(b.success));pm.expect(ok||empty).to.eql(true);}); }`]}});
}}
walk(collection.item);const started=new Date().toISOString();
const run=newman.run({collection,environment,timeoutRequest:15000,delayRequest:150,insecure:false,reporters:[],color:'off'},(err,summary)=>{
 const finished=new Date().toISOString();for(const r of rows)if(r.status==='SKIPPED'&&r.reason==='Not executed')r.reason='Missing prerequisite or unresolved path variable; request not sent';
 require('./triage.cjs')(rows);const counts=rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
 const result={title:'RCB Admin UI APIs Automation',started,finished,timezone:'Asia/Calcutta',environment:environment.name,mode:'Production read-only with admin login',counts,fatal:err?redact(err.message):null,bases:environment.values.filter(v=>/^(admin|player)_(api|root)$|url$/.test(v.key)).map(v=>({key:v.key,value:v.value})),rows};
 fs.writeFileSync('reports/execution.json',JSON.stringify(result,null,2));require('./report.cjs')(result);console.log(JSON.stringify(counts));process.exitCode=err||counts.FAIL||counts.BLOCKED?1:0;
});
run.on('request',(err,args)=>{const r=byId.get(args.item.id);if(!r)return;r.url=redact(args.request.url.toString());r.http=args.response?.code;r.durationMs=args.response?.responseTime;r.status=err?'BLOCKED':'PASS';r.reason=err?redact(err.message):'';if(err)r.error=redact(err.message);else {bodies.set(r.id,cleanBody(args.response.stream.toString()).slice(0,8000));if(r.http>=400)r.response=bodies.get(r.id);}console.log(`${r.method} ${r.name}: ${r.http||r.status}`)});
run.on('assertion',(err,args)=>{const r=byId.get(args.item.id);if(!r)return;r.assertions.push({name:args.assertion,passed:!err,error:err?redact(err.message):undefined});if(err){r.status='FAIL';r.reason='Assertion failure';r.response=bodies.get(r.id)}});
run.on('exception',(_,args)=>{const r=byId.get(args?.item?.id);if(r){r.status='BLOCKED';r.reason='Collection script exception';}});
