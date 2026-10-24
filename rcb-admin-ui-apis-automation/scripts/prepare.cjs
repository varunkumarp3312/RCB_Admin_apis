const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');process.chdir(root);
for(const d of ['collections','environments','config','reports'])fs.mkdirSync(d,{recursive:true});
const c=JSON.parse(fs.readFileSync('../admin-console-api.postman_collection.json','utf8'));
const e=JSON.parse(fs.readFileSync('../rcb-matka-live.postman_environment.json','utf8'));
c.info.name='RCB Admin UI APIs Automation';
const secrets=/password|token|secret|key|email|mobile|account|bene_|image/i;
const template=structuredClone(e);template.name='RCB Admin UI APIs Automation LIVE template';
template.values.forEach(v=>{if(secrets.test(v.key))v.value='';if(v.key==='allow_writes')v.value='false'});
fs.writeFileSync('environments/live.template.postman_environment.json',JSON.stringify(template,null,2));
const local=structuredClone(template);local.name='RCB Admin UI APIs Automation TEST template';
local.values.forEach(v=>{if(/^(admin|player)_(api|root)$/.test(v.key))v.value='http://localhost:'+ (v.key.startsWith('admin')?'3000':'3001')+(v.key.endsWith('api')?'/api':'');else if(/url$/.test(v.key))v.value=''});
fs.writeFileSync('environments/test.template.postman_environment.json',JSON.stringify(local,null,2));
fs.writeFileSync('collections/rcb-admin-ui.postman_collection.json',JSON.stringify(c,null,2));
const vars=Object.fromEntries(e.values.filter(v=>v.enabled!==false).map(v=>[v.key,v.value]));let inventory=[];
function walk(items,folder=''){for(const i of items){if(i.item)walk(i.item,[folder,i.name].filter(Boolean).join(' / '));if(!i.request)continue;const script=(i.event||[]).filter(e=>e.listen==='prerequest').map(e=>e.script.exec.join('\n')).join('\n');inventory.push({id:i.id,name:i.name,folder,method:i.request.method,url:i.request.url.raw,resolvedUrl:i.request.url.raw.replace(/{{(.*?)}}/g,(m,k)=>vars[k]||m),writeGuard:script.includes('allow_writes'),sensitiveRead:/password-view/.test(i.request.url.raw)});}}
walk(c.item);fs.writeFileSync('config/endpoint-inventory.json',JSON.stringify(inventory,null,2));
console.log(`Prepared ${inventory.length} requests. Private credentials remain in the original environment.`);
