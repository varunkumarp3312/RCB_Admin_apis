const fs=require('node:fs'),path=require('node:path'),newman=require('newman');
process.chdir(path.resolve(__dirname,'..'));
const inventory=JSON.parse(fs.readFileSync('config/endpoint-inventory.json'));
const source=JSON.parse(fs.readFileSync('collections/rcb-admin-ui.postman_collection.json'));
let environment=JSON.parse(fs.readFileSync(process.env.RCB_ENVIRONMENT||'environments/live.private.json'));
environment.values.find(v=>v.key==='allow_writes').value='false';
const evidence=require('./evidence.cjs')(environment);
const started=new Date().toISOString();
const rows=inventory.map(i=>({...i,status:i.writeGuard?'EXCLUDED':'NOT_RUN',reason:i.writeGuard?'Not executed per user instruction: production-changing operation. Production writes disabled.':'Awaiting execution',assertions:[]}));
const byId=new Map(rows.map(r=>[r.id,r]));const responses=new Map();const setupResults=[];
const all=[];function flatten(items){for(const i of items){if(i.request)all.push(i);if(i.item)flatten(i.item);}}flatten(source.item);
const setup=structuredClone(source);setup.item=['Sign in as admin','Who am I ·','List players ·','List chats in the inbox','List chats with their times','Show one chat\'s timeline','List approved deposits','List verified bank accounts'].map(name=>structuredClone(all.find(i=>i.name.startsWith(name)))).filter(Boolean);
setup.item.find(i=>i.name.startsWith('List players ·')).event.push({listen:'test',script:{exec:["const body=pm.response.json();const list=Array.isArray(body.data)?body.data:(body.data?.rows||[]);const target=list.find(u=>String(u.mobile)===String(pm.environment.get('player_mobile')))||list[0];if(target?.user_id){pm.environment.set('player_user_id',target.user_id);pm.environment.set('player_id',target._id||'');}"]}});
setup.item.find(i=>i.name.startsWith('List approved deposits')).event.push({listen:'test',script:{exec:["const b=pm.response.json();const rows=Array.isArray(b.data)?b.data:(b.data?.rows||[]);const row=rows.find(r=>r.image);if(row)pm.environment.set('deposit_image',row.image);"]}});
setup.item.find(i=>i.name.startsWith('List verified bank accounts')).event.push({listen:'test',script:{exec:["const b=pm.response.json();const rows=Array.isArray(b.data)?b.data:(b.data?.rows||[]);if(rows[0]?._id)pm.environment.set('bank_account_id',rows[0]._id);"]}});
setup.item.find(i=>i.name.startsWith('Show one chat\'s timeline')).event.push({listen:'test',script:{exec:["const b=pm.response.json();function find(o){if(!o||typeof o!=='object')return '';if(typeof o.image==='string'&&/^[a-f0-9]{24}$/i.test(o.image))return o.image;for(const v of Object.values(o)){if(v&&typeof v==='object'){const r=find(v);if(r)return r;}}return '';}const id=find(b);if(id)pm.environment.set('chat_file_id',id);"]}});
const runSetup=newman.run({collection:setup,environment,timeoutRequest:15000,insecure:false,reporters:[],delayRequest:150},(err,summary)=>{
 if(summary?.environment)environment=summary.environment.toJSON();
 const collection=structuredClone(source);
 function configure(items){return items.flatMap(i=>{
  if(i.item){i.item=configure(i.item);return i.item.length?[i]:[];}
  const row=byId.get(i.id);if(!row||row.writeGuard)return [];
  i.event=i.event||[];
  if(/\/bankAccount-history$/.test(i.request.url.raw))i.event.push({listen:'prerequest',script:{exec:["if(!pm.variables.get('bank_account_id')&&pm.variables.get('player_user_id'))pm.request.body.update(JSON.stringify({user_id:pm.variables.get('player_user_id')}));"]}});
  i.event.push({listen:'test',script:{exec:[
   "pm.test('HTTP 200',()=>pm.response.to.have.status(200));",
   "pm.test('Response within 10 seconds',()=>pm.expect(pm.response.responseTime).to.be.below(10000));",
   "if((pm.response.headers.get('Content-Type')||'').includes('json')){pm.test('JSON response parses to an object or array',()=>{const b=pm.response.json();pm.expect(b!==null&&typeof b==='object').to.eql(true);});const b=pm.response.json();if(Object.prototype.hasOwnProperty.call(b,'success'))pm.test('Business response follows success or empty-data convention',()=>{const ok=['1','true'].includes(String(b.success));const empty=['0','2'].includes(String(b.success))&&/^(no data found|not founds?|no permissions assigned yet)$/i.test(String(b.message||'').trim());pm.expect(ok||empty).to.eql(true);});if(b.error)pm.test('No error returned in successful HTTP response',()=>pm.expect(b.error).to.eql(null));}",
   ...(/Sign in as/.test(i.name)?["pm.test('Successful login supplies a token',()=>{pm.expect(pm.response.json().token).to.be.a('string').and.not.empty;});"]:[])
  ]}});
  return [i];
 });}
 collection.item=configure(collection.item);
 const run=newman.run({collection,environment,timeoutRequest:15000,delayRequest:150,insecure:false,reporters:[],color:'off'},(fatal,summary)=>{
  const finished=new Date().toISOString();for(const r of rows){if(r.status==='NOT_RUN')r.reason='Runner did not send this request; inspect execution errors. This is not counted as tested.';if(r.status==='FAIL'){
   r.response=responses.get(r.id)||r.response||null;r.classification='Potential API defect pending triage';
   if(r.response){try{const body=JSON.parse(r.response.body);if(String(body.success)==='4'||/required|send either|invalid.*id/i.test(body.message||''))r.classification='Request validation or fixture failure';}catch{}}
   if(r.request&&/\{\{|\/(?:chat-file|uploads)\/?(?:\?|$)|[?&]user_id=(?:&|$)/.test(r.request.url))r.classification='Missing fixture in request';
  }}
  const counts=rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
  const result={title:'RCB Admin UI APIs Automation',started,finished,timezone:'Asia/Calcutta',environment:environment.name,mode:'All non-mutating APIs; production-changing APIs excluded per user instruction',counts,fatal:fatal?evidence.text(fatal.message):null,setupResults,scopeNote:'Every non-mutating request is attempted, including role switching and endpoints with absent fixtures. No synthetic fixture IDs are supplied. EXCLUDED operations are not executed. Empty-data conventions can pass smoke checks without certifying populated-data behavior. Failed HTTP, transport, script, or business assertions remain FAIL; fixture failures are classified separately from potential product defects.',bases:environment.values.filter(v=>/^(admin|player)_(api|root)$|url$/.test(v.key)).map(v=>({key:v.key,value:v.value})),rows};
  const archive='reports/archive/'+started.replace(/[:.]/g,'-');fs.mkdirSync(archive,{recursive:true});for(const file of fs.readdirSync('reports'))if(fs.statSync('reports/'+file).isFile())fs.copyFileSync('reports/'+file,archive+'/'+file);
  fs.writeFileSync('reports/execution.json',JSON.stringify(result,null,2));require('./report.cjs')(result);console.log(JSON.stringify(counts));process.exitCode=fatal||counts.FAIL||counts.NOT_RUN?1:0;
 });
 run.on('request',(err,args)=>{const r=byId.get(args.item.id);if(!r)return;r.request=evidence.request(args.request);r.url=r.request.url;r.http=args.response?.code;r.durationMs=args.response?.responseTime;r.status=err?'FAIL':'PASS';r.reason=err?evidence.text(err.message):'All configured assertions passed';
  if(args.response){let body=evidence.body(args.response.stream.toString());if(/user-password-view/.test(r.url))body='[REDACTED sensitive password response]';responses.set(r.id,{status:args.response.code,statusText:args.response.status,headers:evidence.headers(args.response.headers),body});}else r.response={status:null,headers:[],body:null,transportError:evidence.text(err?.message||'No HTTP response received')};
  console.log(`${r.method} ${r.name}: ${r.http||'TRANSPORT FAILURE'}`);
 });
 run.on('assertion',(err,args)=>{const r=byId.get(args.item.id);if(!r)return;r.assertions.push({name:args.assertion,passed:!err,error:err?evidence.text(err.message):undefined});if(err){r.status='FAIL';r.reason='One or more execution assertions failed';}});
 run.on('exception',(_,args)=>{const r=byId.get(args?.item?.id);if(r){r.status='FAIL';r.reason='Collection script exception';r.scriptError=evidence.text(args.error?.message||'Script exception');}});
});
runSetup.on('request',(err,args)=>{setupResults.push({name:args.item.name,http:args.response?.code||null,error:err?evidence.text(err.message):null});console.log(`SETUP ${args.item.name}: ${args.response?.code||'ERROR'}`);});
