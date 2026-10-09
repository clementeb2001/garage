const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('worker/admin-api.js','utf8');
const workerModule=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('confirmed appointments use confirmed day, pending requests use preferred day',()=>{
 const s=fs.readFileSync('intern/intern.js','utf8'),ctx={Date};vm.createContext(ctx);
 vm.runInContext(s.match(/  function parseDay\(s\) \{[\s\S]*?\n  \}/)[0]+"\n"+s.match(/  function apptDay\(a\).*\n/)[0],ctx);
 assert.equal(ctx.apptDay({status:'confirmed',prefDate:'2030-01-07',confirmedDate:'2030-01-09'}).getDate(),9);
 assert.equal(ctx.apptDay({status:'new',prefDate:'2030-01-07',confirmedDate:'2030-01-09'}).getDate(),7);
});
async function submit({prefDate='2030-01-07',altDate='',timeSlot='',blocks=[]}){
 const calls=[],jobs=[],{default:worker}=await workerModule;
 const DB={prepare(sql){return {bind(){return this;},async all(){calls.push(sql);return {results:blocks};},async first(){calls.push(sql);return sql.startsWith('INSERT INTO booking_rate_limits')?{count:1}:null;},async run(){calls.push(sql);return {meta:{last_row_id:1,changes:1}};}};}};
 const response=await worker.fetch(new Request('https://garage-admin.autoservicebettenduerf.lu/appointments',{method:'POST',headers:{Origin:'https://autoservicebettenduerf.lu','CF-Connecting-IP':'192.0.2.1','Content-Type':'application/json'},body:JSON.stringify({name:'Synthetic',email:'test@example.com',privacy:true,loadedAt:Date.now()-5000,service:'Service',vehicle:'Car',msg:'Synthetic',kind:'appointment',prefDate,altDate,timeSlot})}),{DB,PUBLIC_REQUEST_LIMITER:{limit:async()=>({success:true})},PUBLIC_GLOBAL_LIMITER:{limit:async()=>({success:true})}},{waitUntil(p){jobs.push(p);}});
 await Promise.all(jobs);return {response,calls};
}
test('Sunday, closed days, blocked half-days and blocked alternatives produce zero D1 writes',async()=>{
 for(const input of [
  {prefDate:'2030-01-06'},
  {blocks:[{date:'2030-01-07',slot:'closed'}]},
  {timeSlot:'am',blocks:[{date:'2030-01-07',slot:'am'}]},
  {altDate:'2030-01-08',blocks:[{date:'2030-01-08',slot:'closed'}]},
  {blocks:[{date:'2030-01-07',slot:'am'},{date:'2030-01-07',slot:'pm'}]}
 ]){const {response,calls}=await submit(input);assert.equal(response.status,409);assert(calls.every(sql=>sql.startsWith('SELECT')));}
});
test('free half-day and flexible request with one free half-day remain accepted',async()=>{
 for(const timeSlot of ['pm',''])assert.equal((await submit({timeSlot,blocks:[{date:'2030-01-07',slot:'am'}]})).response.status,200);
});
function calendar(fetch){
 let s=fs.readFileSync('appt-calendar.js','utf8');s=s.replace('  if (document.readyState !== "loading") init();',`  render=function(){};
 globalThis.probe={dayInfo,selectDay,fetchBlocks,setup:function(){dateInput={value:'',dispatchEvent(){}};altInput={value:''};},input:function(){return dateInput.value;}};
  if (document.readyState !== "loading") init();`);
 const ctx={document:{readyState:'loading',addEventListener(){}},window:{},Date,Event,AbortController,setTimeout,clearTimeout,fetch};vm.createContext(ctx);vm.runInContext(s,ctx);ctx.probe.setup();return ctx;
}
test('loading, HTTP failure and malformed availability never show free days',async()=>{
 for(const result of [{ok:false},{ok:true,json:async()=>({})}]){
 const ctx=calendar(async()=>result);assert.equal(ctx.probe.dayInfo(new Date(2030,0,7)).selectable,false);
 await ctx.probe.fetchBlocks();assert.equal(ctx.probe.dayInfo(new Date(2030,0,7)).selectable,false);ctx.probe.selectDay('2030-01-07');assert.equal(ctx.probe.input(),'');}
});
test('refresh clears a selected date that has become closed, and permits recovery after an error',async()=>{
 let result={ok:true,json:async()=>({blocks:[]})};const ctx=calendar(async()=>result);
 await ctx.probe.fetchBlocks();ctx.probe.selectDay('2030-01-07');assert.equal(ctx.probe.input(),'2030-01-07');
 result={ok:true,json:async()=>({blocks:[{date:'2030-01-07',slot:'closed'}]})};await ctx.probe.fetchBlocks();assert.equal(ctx.probe.input(),'');
 result={ok:false};await ctx.probe.fetchBlocks();result={ok:true,json:async()=>({blocks:[]})};await ctx.probe.fetchBlocks();assert.equal(ctx.probe.dayInfo(new Date(2030,0,7)).selectable,true);
});
