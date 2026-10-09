const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const os = require("node:os");
const { planSchema, tableNames } = require("../tools/prepare_admin_schema");
const { syncCatalog, isComplete } = require("../tools/import_catalog_d1");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root,"worker/admin-api.js"),"utf8");
const workerModule = import("data:text/javascript;base64," + Buffer.from(source + "\nexport { publicRateAllowed, cleanupExpiredAuth };\n").toString("base64"));
function database(handler) {
  const calls = [];
  return { calls, prepare(sql) {
    const statement = { args:[], bind(...args) { this.args = args; return this; } };
    for (const method of ["first","all","run"]) statement[method] = async () => {
      calls.push({sql,args:statement.args,method});
      const result = await handler(sql,statement.args,method);
      return result === undefined ? (method === "all" ? {results:[]} : null) : result;
    };
    return statement;
  }, async batch(statements) { return Promise.all(statements.map(statement => statement.run())); } };
}
function authenticated(sql) {
  if (/SELECT username, expires_at FROM sessions/.test(sql)) return {username:"staff",expires_at:Math.floor(Date.now()/1000)+3600};
  if (/SELECT username, name, role, active, must_change FROM users/.test(sql)) return {username:"staff",role:"validator",active:1,name:"Staff"};
}
function request(route, body, cookie = false) {
  const headers = {Origin:"https://autoservicebettenduerf.lu","CF-Connecting-IP":"192.0.2.1"};
  if (cookie) headers.Cookie = "garage_session=test-session";
  if (body) headers["Content-Type"] = "application/json";
  return new Request("https://garage-admin.autoservicebettenduerf.lu"+route,{method:body?"POST":"GET",headers,body:body?JSON.stringify(body):undefined});
}
const edge = {PUBLIC_REQUEST_LIMITER:{limit:async()=>({success:true})},PUBLIC_GLOBAL_LIMITER:{limit:async()=>({success:true})}};
const context = () => {const jobs=[];return {jobs,waitUntil(p){jobs.push(p);}};};
const payload = () => ({name:"Test",email:"test@example.com",privacy:true,loadedAt:Date.now()-5000,service:"Service",vehicle:"Car",msg:"Question",phone:"123",kind:"inquiry"});

test("public and authenticated GET routes execute only SELECTs, even with missing snapshots",async()=>{
  const {default:worker} = await workerModule;
  const db = database(sql=>{
    assert.match(sql,/^SELECT /);
    const user = authenticated(sql); if(user)return user;
    if(sql==="SELECT * FROM bookings ORDER BY id DESC")return {results:[{id:1,status:"confirmed",contract_snapshot:null}]};
    if(/SELECT value FROM catalog_settings/.test(sql))return {value:"catalog-0000000000000000"};
    if(/SELECT product_count,remus_count,dba_count,meta_json/.test(sql))return {meta_json:"{}"};
  });
  for(const route of ["/fleet/public","/availability","/appointment-availability","/catalog/meta","/catalog/products?manufacturer=REMUS","/bookings","/appointments","/maintenance","/fleet-blocks","/appointment-blocks","/rental-inspections","/auth/me"]){
    const response=await worker.fetch(request(route,undefined,true),{DB:db},context());
    assert.equal(response.status,200,route);
  }
});

test("expired sessions are rejected without deleting during GET",async()=>{
  const {default:worker}=await workerModule;
  const db=database(sql=>{assert.match(sql,/^SELECT /);return {username:"staff",expires_at:1};});
  assert.equal((await worker.fetch(request("/auth/me",undefined,true),{DB:db},context())).status,401);
});

test("invalid and native-rate-limited forms never touch D1",async()=>{
  const {default:worker}=await workerModule;
  const db=database(()=>{assert.fail("unexpected D1 access");});
  for(const route of ["/bookings","/appointments"]){
    assert.equal((await worker.fetch(request(route,{}),{DB:db,...edge},context())).status,400);
    assert.equal((await worker.fetch(request(route,payload()),{DB:db,...edge,PUBLIC_GLOBAL_LIMITER:{limit:async()=>({success:false})}},context())).status,429);
    assert.equal((await worker.fetch(request(route,payload()),{DB:db},context())).status,429);
  }
});

test("hourly blocked forms only read their bucket and never bump it",async()=>{
  const {default:worker}=await workerModule;
  const db=database(sql=>{assert.match(sql,/^SELECT count FROM booking_rate_limits/);return {count:8};});
  assert.equal((await worker.fetch(request("/appointments",payload()),{DB:db,...edge},context())).status,429);
  assert.equal(db.calls.length,1);
});

test("concurrent hourly attempts atomically stop at eight",async()=>{
  const {publicRateAllowed}=await workerModule;
  let count=7;
  const db=database(sql=>{
    if(sql.startsWith("SELECT"))return {count:7}; // both see the old value
    assert.match(sql,/WHERE count<8 RETURNING count/);
    return count<8?{count:++count}:null;
  });
  const results=await Promise.all([publicRateAllowed(request("/"),{DB:db}),publicRateAllowed(request("/"),{DB:db})]);
  assert.deepEqual(results.sort(),[false,true]);assert.equal(count,8);
});

test("duplicate booking and appointment status changes do not write or send email",async()=>{
  const {default:worker}=await workerModule;
  for(const route of ["/bookings/1/status","/appointments/1/status"]){
    const db=database(sql=>{
      assert.match(sql,/^SELECT /);
      return authenticated(sql)||{id:1,status:"confirmed",kind:"appointment",confirmed_date:"2026-11-01",confirmed_time:"10:00",email:"test@example.com"};
    });
    const ctx=context();
    const response=await worker.fetch(request(route,{status:"confirmed"},true),{DB:db},ctx);
    assert.equal(response.status,200);assert.equal((await response.json()).unchanged,true);assert.equal(ctx.jobs.length,0);
  }
});

test("losing a concurrent status change cannot send mail or append an audit event",async()=>{
  const {default:worker}=await workerModule;
  for(const route of ["/bookings/1/status","/appointments/1/status"]){
    const db=database(sql=>{
      if(sql.startsWith("UPDATE")){assert.match(sql,/AND status=/);return {meta:{changes:0}};}
      assert.match(sql,/^SELECT /);
      return authenticated(sql)||{id:1,status:"new",kind:"inquiry"};
    });
    const ctx=context();
    assert.equal((await worker.fetch(request(route,{status:"declined"},true),{DB:db},ctx)).status,409);
    assert.equal(ctx.jobs.length,0);
  }
});

test("cleanup stays bounded and outside request handling",async()=>{
  const {cleanupExpiredAuth}=await workerModule;
  const db=database(sql=>{assert.match(sql,/^DELETE /);assert.match(sql,/LIMIT 500/);return {meta:{changes:0}};});
  await cleanupExpiredAuth({DB:db});assert.equal(db.calls.length,2);
});

const manifest={version:"catalog-1111111111111111",legacyVersion:"catalog-2222222222222222",products:2,remus:1,dba:1,metadata:{makes:["Test"]},basicMeta:{version:"new"},legacyMeta:{version:"legacy"}};
function catalogResults(version,complete=true){
  return [{results:complete?[{product_count:2,remus_count:1,dba_count:1,meta_json:JSON.stringify(version===manifest.legacyVersion?manifest.legacyMeta:manifest.basicMeta)}]:[]},{results:[{n:complete?2:0,remus:complete?1:0,dba:complete?1:0}]},{results:complete?[{meta_key:"makes",value_json:'["Test"]'}]:[]}];
}
test("matching legacy catalog is reused without product import or deletion",()=>{
  const commands=[];
  const version=syncCatalog(manifest,"unused.sql",args=>{
    commands.push(args);assert.equal(args[0],"--command");assert.doesNotMatch(args[1],/DELETE /);
    if(args[1].startsWith("SELECT"))return catalogResults(args[1].includes(manifest.legacyVersion)?manifest.legacyVersion:manifest.version,args[1].includes(manifest.legacyVersion));
    assert.match(args[1],/WHERE value IS NOT excluded.value/);return [];
  });
  assert.equal(version,manifest.legacyVersion);assert.equal(commands.length,3);
});

test("incomplete new catalog never becomes active after failed verification",()=>{
  let imports=0;
  assert.throws(()=>syncCatalog(manifest,"seed.sql",args=>{
    if(args[0]==="--file"){imports++;return [];}
    assert.match(args[1],/^SELECT /);return catalogResults(manifest.version,false);
  }),/verification failed/);assert.equal(imports,1);
});

test("catalog completeness checks metadata as well as product counts",()=>{
  const results=catalogResults(manifest.version);assert.equal(isComplete(manifest,manifest.version,results),true);
  results[2].results[0].value_json='["Changed"]';assert.equal(isComplete(manifest,manifest.version,results),false);
});

test("schema planner preserves business data and becomes a no-op when current",()=>{
  const initial={tables:{bookings:["id"]},indexes:[]};
  const statements=planSchema(initial);
  assert(statements.length>0);assert(statements.every(sql=>/^(CREATE|ALTER) /.test(sql)));
  const tables={};for(const name of tableNames())tables[name]=["id"];
  const schema=require("../worker/admin-schema.json");
  for(const group of schema)for(const column of group.columns)tables[column.table].push(column.definition.split(" ")[0]);
  const indexes=schema.flatMap(group=>group.indexes.map(sql=>sql.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (\w+)/)[1]));
  assert.deepEqual(planSchema({tables,indexes}),[]);
  assert.throws(()=>planSchema({tables:{},indexes:[]}),/bookings/);
});

test("internal API coalesces simultaneous identical requests",async()=>{
  const frontend=fs.readFileSync(path.join(root,"intern/intern.js"),"utf8");
  const snippet=frontend.slice(frontend.indexOf("  var pendingRequests ="),frontend.indexOf("  function uploadImage"));
  let calls=0,release;
  const ctx={API_BASE:"https://example.test",session:{},Map,setTimeout,onAuthLost(){},fetch(){calls++;return new Promise(resolve=>{release=()=>resolve({status:200,json:async()=>({ok:true})});});}};
  vm.createContext(ctx);vm.runInContext(snippet,ctx);
  const first=ctx.api("/bookings/1/status",{method:"POST",body:{status:"done"}}),second=ctx.api("/bookings/1/status",{method:"POST",body:{status:"done"}});
  assert.equal(first,second);assert.equal(calls,1);release();await first;
  const third=ctx.api("/bookings/1/status",{method:"POST",body:{status:"done"}});assert.equal(calls,2);release();await third;
});

test("search filtering reuses loaded booking lists without any new API calls",async()=>{
  const frontend=fs.readFileSync(path.join(root,"intern/intern.js"),"utf8");
  const snippet=frontend.slice(frontend.indexOf("  function renderBookings(useCache)"),frontend.indexOf("  /* ---------- Dashboard"));
  const elements=new Map();const ctx={Promise,bookingListCache:[[],[],[]],bookingQuery:"abc",activeFilter:"all",inspections:[],fleetCache:[],can:()=>true,updateNewBadge(){},renderFilters(){},document:{createElement:()=>({})},$:id=>{if(!elements.has(id))elements.set(id,{appendChild(){},addEventListener(){}});return elements.get(id);},STORE:{listBookings(){assert.fail("search fetched bookings");},listInspections(){assert.fail("search fetched inspections");},listMaintenance(){assert.fail("search fetched maintenance");}}};
  vm.createContext(ctx);vm.runInContext(snippet,ctx);ctx.renderBookings(true);await new Promise(resolve=>setImmediate(resolve));
  assert(elements.get("booking-list"));
});

test("catalog generator uses conditional inserts and hashes metadata (two synthetic products)",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"garage-catalog-test-"));
  try{
    fs.mkdirSync(path.join(dir,"tools"));fs.mkdirSync(path.join(dir,"worker"));
    fs.copyFileSync(path.join(root,"tools/build_catalog_d1.js"),path.join(dir,"tools/build_catalog_d1.js"));
    fs.writeFileSync(path.join(dir,"shop-data.js"),'window.SHOP_PRODUCTS=[{i:"A",p:100},{i:"B",mf:"DBA",p:200}];window.SHOP_META={updated:"today"};window.SHOP_MAKES=["Before"];');
    fs.writeFileSync(path.join(dir,"shop-data-dba.js"),'window.SHOP_IMAGES=[];');
    vm.runInNewContext(fs.readFileSync(path.join(dir,"tools/build_catalog_d1.js"),"utf8"),{require,Buffer,__dirname:path.join(dir,"tools"),process:{argv:["node","build"]},console:{log(){}}});
    const seed=fs.readFileSync(path.join(dir,"worker/catalog-seed.sql"),"utf8");
    const before=JSON.parse(fs.readFileSync(path.join(dir,"worker/catalog-seed.sql.json"),"utf8"));
    assert.doesNotMatch(seed,/REPLACE|DELETE FROM|INSERT INTO catalog_settings/);
    fs.appendFileSync(path.join(dir,"shop-data.js"),'window.SHOP_MAKES=["After"];');
    vm.runInNewContext(fs.readFileSync(path.join(dir,"tools/build_catalog_d1.js"),"utf8"),{require,Buffer,__dirname:path.join(dir,"tools"),process:{argv:["node","build"]},console:{log(){}}});
    const after=JSON.parse(fs.readFileSync(path.join(dir,"worker/catalog-seed.sql.json"),"utf8"));
    assert.notEqual(before.version,after.version);assert.equal(before.legacyVersion,after.legacyVersion);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test("native login rejection also avoids D1",async()=>{
  const {default:worker}=await workerModule;
  const db=database(()=>{assert.fail("login touched D1 despite edge rejection");});
  const response=await worker.fetch(request("/auth/login",{username:"test",password:"wrong"}),{DB:db,...edge,PUBLIC_REQUEST_LIMITER:{limit:async()=>({success:false})}},context());
  assert.equal(response.status,429);
});

test("valid inquiries are still stored and acknowledged without request-time schema writes",async()=>{
  const {default:worker}=await workerModule;
  const writes=[];
  const db=database(sql=>{
    assert.doesNotMatch(sql,/^(CREATE|ALTER|DELETE) /);
    if(sql.startsWith("SELECT count"))return null;
    if(sql.startsWith("INSERT INTO booking_rate_limits")){writes.push(sql);return {count:1};}
    if(sql.startsWith("INSERT")){writes.push(sql);return {meta:{last_row_id:42,changes:1}};}
    assert.fail(sql);
  });
  const ctx=context();const response=await worker.fetch(request("/appointments",payload()),{DB:db,...edge},ctx);
  assert.equal(response.status,200);assert.equal((await response.json()).id,42);
  await Promise.all(ctx.jobs);
  assert(writes.some(sql=>sql.startsWith("INSERT INTO appointments")));
  assert(writes.some(sql=>sql.startsWith("INSERT OR REPLACE INTO request_consents")));
});

test("identical inspection requests never rewrite their state or append audit events",async()=>{
  const {default:worker}=await workerModule;
  const media="https://garage-admin.autoservicebettenduerf.lu/media/protocol/test/";
  const body={bookingId:1,stage:"pickup",inspectedAt:"2026-11-01T10:00",odometer:10,fuelLevel:"full",customerSignature:media+"customer.png",staffSignature:media+"staff.png",staffName:"Staff",extraKm:"",extraCosts:""};
  const previous={booking_id:1,stage:"pickup",inspected_at:body.inspectedAt,odometer:10,fuel_level:"full",condition_note:"",damage_note:"",photo_refs:"",accessories:"",license_checked:0,extra_km:null,extra_costs:null,customer_signature:body.customerSignature,staff_signature:body.staffSignature,staff_name:"Staff",note:"",deposit_amount:null,checklist_json:JSON.stringify({keyCount:"",cleanliness:"",documentsChecked:false,lightsChecked:false,tyresChecked:false,jointInspection:false,damageMarkers:[]})};
  const db=database(sql=>{assert.match(sql,/^SELECT /);return authenticated(sql)||(/FROM rental_inspections/.test(sql)?previous:{id:1});});
  const response=await worker.fetch(request("/rental-inspections",body,true),{DB:db},context());
  assert.equal(response.status,200);assert.equal((await response.json()).unchanged,true);
});

test("double-clicking protocol save shares signature uploads as well as the D1 write",async()=>{
  const frontend=fs.readFileSync(path.join(root,"intern/intern.js"),"utf8");
  const snippet=frontend.slice(frontend.indexOf("  var protocolSaves ="),frontend.indexOf("  function saveProtocolOnce"));
  let calls=0,release;const ctx={Set,Promise,saveProtocolOnce(){calls++;return new Promise(resolve=>{release=resolve;});}};
  vm.createContext(ctx);vm.runInContext(snippet,ctx);
  const first=ctx.saveProtocol({id:1},"pickup");ctx.saveProtocol({id:1},"pickup");assert.equal(calls,1);release();await first;
  const second=ctx.saveProtocol({id:1},"pickup");assert.equal(calls,2);release();await second;
});


test("Wrangler file-import progress does not break JSON result parsing",()=>{
  const {parseOutput}=require("../tools/d1_cli");
  const result=[{success:true,results:[{"Total queries executed":2}],meta:{rows_written:0}}];
  assert.deepEqual(parseOutput("├ Checking if file needs uploading\n🌀 Processed 2 queries.\n"+JSON.stringify(result,null,2)),result);
  assert.deepEqual(parseOutput(JSON.stringify(result)),result);
  assert.throws(()=>parseOutput("Progress without any result"),/valid D1 JSON/);
  assert.throws(()=>parseOutput('├ Checking\n[{"success":false,"error":"failed"}]'),/D1 command failed/);
});
