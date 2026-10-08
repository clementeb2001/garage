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
const legacyVersion=`catalog-${crypto.createHash("sha256").update(JSON.stringify(products)).digest("hex").slice(0,16)}`;
const metadata={makes:w.SHOP_MAKES||[],brands:w.SHOP_BRANDS||{},engines:w.SHOP_ENGINES||[],variants:w.SHOP_VARIANTS||[],generations:w.SHOP_GENS||[]};
for(let start=0;start<(w.SHOP_IMAGES||[]).length;start+=300) metadata[`images:${String(start/300).padStart(4,"0")}`]=w.SHOP_IMAGES.slice(start,start+300);
// Every imported value participates, including metadata and images.
const version=`catalog-${crypto.createHash("sha256").update(JSON.stringify({products,metadata,meta:w.SHOP_META})).digest("hex").slice(0,16)}`;
const sql=value=>`'${String(value).replace(/'/g,"''")}'`;
const basicMeta=Object.assign({},w.SHOP_META,{count:products.length,priceSource:"D1",version});
const lines=[`INSERT INTO catalog_versions(version,product_count,remus_count,dba_count,meta_json) VALUES(${sql(version)},${products.length},${remus},${dba},${sql(JSON.stringify(basicMeta))}) ON CONFLICT(version) DO NOTHING;`];
for(const [key,value] of Object.entries(metadata)) lines.push(`INSERT INTO catalog_metadata(version,meta_key,value_json) VALUES(${sql(version)},${sql(key)},${sql(JSON.stringify(value))}) ON CONFLICT(version,meta_key) DO UPDATE SET value_json=excluded.value_json WHERE value_json IS NOT excluded.value_json;`);
for(let start=0;start<products.length;start+=40){
  const values=products.slice(start,start+40).map(source=>{const payload=Object.assign({},source);delete payload.p;return `(${sql(version)},${sql(source.i)},${sql(source.mf||"REMUS")},${source.p},${sql(JSON.stringify(payload))})`;});
  lines.push("INSERT INTO catalog_products(version,sku,manufacturer,price_cents,payload_json) VALUES\n"+values.join(",\n")+" ON CONFLICT(version,sku) DO UPDATE SET manufacturer=excluded.manufacturer,price_cents=excluded.price_cents,payload_json=excluded.payload_json WHERE manufacturer IS NOT excluded.manufacturer OR price_cents IS NOT excluded.price_cents OR payload_json IS NOT excluded.payload_json;");
}
const tooLong=lines.find(line=>Buffer.byteLength(line,"utf8")>95000);
if(tooLong)throw new Error(`D1 statement exceeds safe 95 KB limit (${Buffer.byteLength(tooLong,"utf8")} bytes)`);
fs.writeFileSync(out,lines.join("\n")+"\n");
const manifest={version,legacyVersion,products:products.length,remus,dba,metadata,basicMeta,legacyMeta:Object.assign({},basicMeta,{version:legacyVersion})};
fs.writeFileSync(out+".json",JSON.stringify(manifest));
console.log(JSON.stringify({version,products:products.length,remus,dba,output:out}));

