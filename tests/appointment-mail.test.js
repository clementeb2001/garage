const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('worker/admin-api.js','utf8');
const workerModule=import('data:text/javascript;base64,'+Buffer.from(source+'\nexport function setTestMailer(fn) { sendEmail = fn; }\n').toString('base64'));
const confirmed={id:1,kind:'appointment',status:'confirmed',email:'test@example.com',pref_date:'2030-01-07',confirmed_date:'2030-01-07',confirmed_time:'10:00',lang:'de'};
async function invoke(body,{appointment=confirmed,path='/appointments/1/status',role='validator',loggedIn=true,limited=false,mailOK=true,changes=1}={}){
 const {default:worker,setTestMailer}=await workerModule,calls=[],mails=[],jobs=[];
 setTestMailer(async(...args)=>{mails.push(args);return mailOK?{ok:true,id:'mock-mail'}:{ok:false,error:'mock-failure'};});
 const DB={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){calls.push({sql,args});
  if(sql.includes('FROM sessions'))return loggedIn?{username:'staff',expires_at:Math.floor(Date.now()/1000)+3600}:null;
  if(sql.includes('FROM users'))return {username:'staff',role,active:1,name:'Staff'};
  return appointment;
 },async run(){calls.push({sql,args});return {meta:{changes}};}};}};
 const response=await worker.fetch(new Request('https://garage-admin.autoservicebettenduerf.lu'+path,{method:'POST',headers:{Origin:'https://autoservicebettenduerf.lu',Cookie:'garage_session=mock','Content-Type':'application/json'},body:JSON.stringify(body)}),{DB,PUBLIC_REQUEST_LIMITER:{limit:async()=>({success:!limited})}},{waitUntil(p){jobs.push(p);}});
 await Promise.all(jobs);return {response,data:await response.json(),calls,mails,jobs};
}
test('first confirmation and saved date/time changes send exactly one automatic mail',async()=>{
 for(const [appointment,body] of [
  [{...confirmed,status:'new',confirmed_date:null,confirmed_time:null},{status:'confirmed',date:'2030-01-07',time:'10:00'}],
  [confirmed,{status:'confirmed',date:'2030-01-09',time:'10:00',note:'Rescheduled'}],
  [confirmed,{status:'confirmed',date:'2030-01-07',time:'11:00'}]
 ]){
 const r=await invoke(body,{appointment});assert.equal(r.response.status,200);assert.equal(r.data.mailQueued,true);assert.equal(r.mails.length,1);
 assert(r.mails[0][4].includes(body.time));
 const expectedDate=new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Luxembourg'}).format(new Date(body.date+'T12:00:00Z'));
 assert(r.mails[0][4].includes(expectedDate));
 assert.equal(r.calls.filter(c=>c.sql.startsWith('UPDATE appointments')).length,1);
 }
});
test('notes and unchanged saves send no mail; finishing an appointment sends no mail',async()=>{
 const note=await invoke({status:'confirmed',date:confirmed.confirmed_date,time:confirmed.confirmed_time,note:'Internal note'});
 assert.equal(note.response.status,200);assert.equal(note.data.mailQueued,false);assert.equal(note.mails.length,0);
 assert.equal(note.calls.filter(c=>!c.sql.startsWith('SELECT')).length,1);assert(note.calls.at(-1).sql.includes("'Notiz'"));
 const unchanged=await invoke({status:'confirmed',date:confirmed.confirmed_date,time:confirmed.confirmed_time});
 assert.equal(unchanged.data.unchanged,true);assert.equal(unchanged.mails.length,0);assert(unchanged.calls.every(c=>c.sql.startsWith('SELECT')));
 const done=await invoke({status:'done',note:'Completed'});assert.equal(done.mails.length,0);
});
test('lost concurrent schedule update cannot send mail',async()=>{
 const r=await invoke({status:'confirmed',date:'2030-01-09',time:'11:00'},{changes:0});
 assert.equal(r.response.status,409);assert.equal(r.mails.length,0);assert(!r.calls.some(c=>c.sql.startsWith('INSERT')));
});
const resendBody={date:confirmed.confirmed_date,time:confirmed.confirmed_time},resendPath='/appointments/1/confirmation-email';
test('manual resend is authenticated and restricted to complete confirmed appointments',async()=>{
 for(const [options,status] of [
  [{loggedIn:false},401],[{role:'viewer'},403],
  [{appointment:{...confirmed,status:'new'}},409],
  [{appointment:{...confirmed,status:'done'}},409],
  [{appointment:{...confirmed,kind:'inquiry'}},409],
  [{appointment:{...confirmed,email:''}},400],
  [{appointment:{...confirmed,confirmed_time:''}},400],
  [{limited:true},429]
 ]){
 const r=await invoke(resendBody,{path:resendPath,...options});assert.equal(r.response.status,status);assert.equal(r.mails.length,0);assert(r.calls.every(c=>c.sql.startsWith('SELECT')));
 }
 const stale=await invoke({...resendBody,time:'11:00'},{path:resendPath});assert.equal(stale.response.status,409);assert.equal(stale.mails.length,0);
});
test('explicit resend mails saved schedule and records the user without modifying the appointment',async()=>{
 const r=await invoke(resendBody,{path:resendPath});assert.equal(r.response.status,200);assert.equal(r.data.mailSent,true);assert.equal(r.mails.length,1);
 const writes=r.calls.filter(c=>!c.sql.startsWith('SELECT'));assert.equal(writes.length,1);assert(writes[0].sql.startsWith('INSERT INTO appointment_events'));assert.equal(writes[0].args[2],'staff');
 const failure=await invoke(resendBody,{path:resendPath,mailOK:false});assert.equal(failure.response.status,502);assert.equal(failure.data.error,'mail_failed');assert(failure.calls.at(-1).args[1].includes('feelgeschloen'));
});
const intern=fs.readFileSync('intern/intern.js','utf8');
function ui(){
 const ctx={Map,Promise,Array,Math,Number,String,STORE:{},can:()=>true,toast:()=>{},renderReq:()=>{},errMsg:x=>x,REQCFG:{appointment:{noun:'Termin'},inquiry:{noun:'Inquiry'}},STATUS:{confirmed:'Confirmed'},reqRef:()=> 'T-1001',document:{createElement:()=>({querySelectorAll:()=>[],querySelector:()=>null})},esc:x=>String(x||''),fmt:x=>x,pad:n=>n<10?'0'+n:''+n,staffList:[],staffName:x=>x,VEH_COLORS:['#000'],defaultDurationMin:()=>60};
 vm.createContext(ctx);
 vm.runInContext(intern.slice(intern.indexOf('  var pendingReqActions'),intern.indexOf('  function reqCard')),ctx);
 vm.runInContext(intern.slice(intern.indexOf('  function reqCard'),intern.indexOf('  function renderReq(kind')),ctx);
 return ctx;
}
test('resend button appears only after confirmation; saved changes are described separately',()=>{
 const ctx=ui();for(const status of ['new','confirmed','done','declined']){
 const html=ctx.reqCard('appointment',{id:1,status,events:[]}).innerHTML;
 assert.equal(html.includes('data-resend-appt'),status==='confirmed');
 if(status==='confirmed'){assert(html.includes('Späicheren'));assert(!html.includes('Zäit setzen &amp; Mail'));}
 }assert(!ctx.reqCard('inquiry',{id:1,status:'confirmed',events:[]}).innerHTML.includes('data-resend-appt'));
});
test('resend does not discard unsaved changes and double clicks share one operation',async()=>{
 const ctx=ui(),a={id:1,status:'confirmed',confirmedDate:resendBody.date,confirmedTime:resendBody.time};
 let note='Unsaved',calls=0,release;
 ctx.$=id=>({value:id.startsWith('rdate')?a.confirmedDate:id.startsWith('rtime')?a.confirmedTime:note});
 ctx.STORE.resendApptConfirmation=()=>{calls++;return new Promise(resolve=>{release=()=>resolve({ok:true});});};
 ctx.doResendAppt(a);assert.equal(calls,0);
 note='';const one=ctx.doResendAppt(a),two=ctx.doResendAppt(a);assert.equal(one,two);await Promise.resolve();assert.equal(calls,1);release();await one;
});
