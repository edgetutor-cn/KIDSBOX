const path=require('path');const pw=require(path.join('C:/Users/范特西/.workbuddy/binaries/node/workspace/node_modules','playwright-core'));
const T=[{n:'KIDSBOX',c:'KidsBox',u:'http://127.0.0.1:8131/'},{n:'POWERUP',c:'PowerUp',u:'http://127.0.0.1:8132/'},{n:'WONDERSKILLS',c:'WonderSkills',u:'http://127.0.0.1:8133/'}];
(async()=>{const b=await pw.chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
for(const t of T){const ctx=await b.newContext();const p=await ctx.newPage();
await p.addInitScript(c=>{try{localStorage.setItem(c==='PowerUp'?'edge_gate_powerup_v1':c==='WonderSkills'?'edge_gate_wonderskills_v1':'edge_gate_kidsbox_v1','1')}catch{}},t.c);
try{await p.goto(t.u,{waitUntil:'networkidle',timeout:30000});await p.waitForSelector('.level',{timeout:20000});
const r=await p.evaluate(()=>({hero:document.getElementById('heroTitle')?.textContent,lvls:[...document.querySelectorAll('.level h2')].slice(0,3).map(e=>e.textContent)}));
console.log(`\n=== ${t.n} ===`);console.log(' hero:',JSON.stringify(r.hero));console.log(' 级别卡:',JSON.stringify(r.lvls));
const bad=r.hero+' '+r.lvls.join(' ');console.log(' 露全名?', (/(Kid'?s Box|Kids Box|Power Up|Wonder Skills)/.test(bad))?'是⚠️':'否✓');
}catch(e){console.log(`\n=== ${t.n} 失败 ===\n`+e.message.split('\n')[0])}await ctx.close()}
await b.close();})();
