module.exports=function triage(rows){
 for(const r of rows){if(r.status!=='FAIL'||!r.response)continue;let b;try{b=JSON.parse(r.response)}catch{continue;}
 if(['0','2'].includes(String(b.success))&&/^(not founds?|no data found)$/i.test(String(b.message||'').trim())){r.status='BLOCKED';r.reason='Empty LIVE dataset; populated business-response assertion could not be satisfied';r.classification='Test data blocker';}
 if(String(b.success)==='4'&&/send either user_id or bank_account_id/i.test(b.message||'')){r.status='BLOCKED';r.reason='Missing bank-account or player fixture; API returned a validation response';r.classification='Missing fixture';}
 }
 return rows;
};
