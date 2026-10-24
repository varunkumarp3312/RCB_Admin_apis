const fs=require('node:fs');process.chdir(require('node:path').resolve(__dirname,'..'));
const data=JSON.parse(fs.readFileSync('reports/execution.json'));
require('./triage.cjs')(data.rows);data.counts=data.rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
data.triageNote='Empty LIVE data and missing fixture responses classified as execution blockers. Original HTTP, timings, responses, and assertion evidence are preserved.';
fs.writeFileSync('reports/execution.json',JSON.stringify(data,null,2));require('./report.cjs')(data);console.log(data.counts);
