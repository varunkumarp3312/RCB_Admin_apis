module.exports=function evidence(environment){
 const secrets=environment.values.filter(v=>/password|token|secret|key|email|mobile|account|bene_/i.test(v.key)&&String(v.value).length>3).map(v=>String(v.value));
 const sensitive=/authorization|cookie|password|passwd|token|psd|secret|api.?key|email|mobile|phone|account.?no|accountnumber|ifsc|holder|beneficiary|device|username|latitude|longitude/i;
 const text=value=>{let s=String(value??'');for(const secret of secrets)s=s.split(secret).join('[REDACTED]');return s.replace(/Bearer\s+[^\s"<]+/gi,'Bearer [REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED JWT]');};
 function object(value){if(Array.isArray(value))return value.map(object);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,sensitive.test(k)?'[REDACTED]':object(v)]));return typeof value==='string'?text(value):value;}
 function body(raw){try{return JSON.stringify(object(JSON.parse(String(raw))),null,2)}catch{return text(raw)}}
 function headers(list){return list?list.all().filter(h=>!h.disabled).map(h=>({name:h.key,value:sensitive.test(h.key)?'[REDACTED]':text(h.value)})):[];}
 function request(req){let payload=null;if(req.body){if(req.body.mode==='raw')payload=body(req.body.raw);else if(req.body.mode==='urlencoded'||req.body.mode==='formdata')payload=req.body[req.body.mode].all().filter(v=>!v.disabled).map(v=>({name:v.key,type:v.type||'text',value:sensitive.test(v.key)?'[REDACTED]':text(v.type==='file'?v.src:v.value)}));else payload=object(req.body.toJSON());}return {method:req.method,url:text(req.url.toString()),headers:headers(req.headers),bodyMode:req.body?.mode||'none',body:payload};}
 return {text,body,headers,request};
};
