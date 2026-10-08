#!/usr/bin/env node
const fs=require("fs"),path=require("path"),vm=require("vm"),crypto=require("crypto");
const root=path.resolve(__dirname,".."),out=path.resolve(process.argv[2]||path.join(root,"worker","catalog-seed.sql"));
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,"shop-data.js"),"utf8"),context);
vm.runInContext(fs.readFileSync(path.join(root,"shop-data-dba.js"),"utf8"),context);
const w=context.window,products=w.SHOP_PRODUCTS||[],ids=new Set();
for(const product of products){
  if(!product.i||ids.has(product.i))throw new Error(`Duplicate or empty SKU: ${product.i||"(empty)"}`);
  if(!Number.isInteger(product.p)||product.p<=0)throw new Error(`Invalid price for ${product.i}`);
  ids.add(product.i);
}
const remus=products.filter(p=>p.mf!=="DBA").length,dba=products.filter(p=>p.mf==="DBA").length;
const version=`catalog-${crypto.createHash("sha256").update(JSON.stringify(products)).digest("hex").slice(0,16)}`;
const sql=value=>`'${String(value).replace(/'/g,"''")}'`;
const basicMeta=Object.assign({},w.SHOP_META,{count:products.length,priceSource:"D1",version});
const lines=[`INSERT OR REPLACE INTO catalog_versions(version,product_count,remus_count,dba_count,meta_json) VALUES(${sql(version)},${products.length},${remus},${dba},${sql(JSON.stringify(basicMeta))});`];
const metadata={makes:w.SHOP_MAKES||[],brands:w.SHOP_BRANDS||{},engines:w.SHOP_ENGINES||[],variants:w.SHOP_VARIANTS||[],generations:w.SHOP_GENS||[]};
for(const [key,value] of Object.entries(metadata)) lines.push(`INSERT OR REPLACE INTO catalog_metadata(version,meta_key,value_json) VALUES(${sql(version)},${sql(key)},${sql(JSON.stringify(value))});`);
for(let start=0;start<(w.SHOP_IMAGES||[]).length;start+=300){
  const key=`images:${String(start/300).padStart(4,"0")}`;
  lines.push(`INSERT OR REPLACE INTO catalog_metadata(version,meta_key,value_json) VALUES(${sql(version)},${sql(key)},${sql(JSON.stringify(w.SHOP_IMAGES.slice(start,start+300)))});`);
}
for(let start=0;start<products.length;start+=40){
  const values=products.slice(start,start+40).map(source=>{const payload=Object.assign({},source);delete payload.p;return `(${sql(version)},${sql(source.i)},${sql(source.mf||"REMUS")},${source.p},${sql(JSON.stringify(payload))})`;});
  lines.push("INSERT OR REPLACE INTO catalog_products(version,sku,manufacturer,price_cents,payload_json) VALUES\n"+values.join(",\n")+";");
}
lines.push(`INSERT OR REPLACE INTO catalog_settings(key,value,updated_at) VALUES('active_catalog_version',${sql(version)},CURRENT_TIMESTAMP);`);
lines.push(`DELETE FROM catalog_products WHERE version <> ${sql(version)};`);
lines.push(`DELETE FROM catalog_metadata WHERE version <> ${sql(version)};`);
lines.push(`DELETE FROM catalog_versions WHERE version <> ${sql(version)};`);
const tooLong=lines.find(line=>Buffer.byteLength(line,"utf8")>95000);
if(tooLong)throw new Error(`D1 statement exceeds safe 95 KB limit (${Buffer.byteLength(tooLong,"utf8")} bytes)`);
fs.writeFileSync(out,lines.join("\n")+"\n");
console.log(JSON.stringify({version,products:products.length,remus,dba,output:out}));
