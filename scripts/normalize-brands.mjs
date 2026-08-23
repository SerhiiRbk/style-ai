// Detect and merge duplicate brand labels in public.products.
//   node scripts/normalize-brands.mjs           # dry-run (default): print plan
//   node scripts/normalize-brands.mjs --apply    # write brand updates to prod
// Rules: (1) exact-normalised clusters (case/space/punctuation) → canonical is
// the highest-count variant; (2) edit-distance-1 typos where the minor variant
// is tiny (≤5) and the major ≥10× → merge minor into major. Placeholder brands
// ("My Store") are reported, not auto-merged.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
function loadEnv(p){const o={};for(const raw of readFileSync(p,"utf8").split("\n")){const l=raw.trim();if(!l||l.startsWith("#"))continue;const i=l.indexOf("=");if(i===-1)continue;let v=l.slice(i+1).trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);o[l.slice(0,i).trim()]=v;}return o;}
const e=loadEnv(".env.local");
const key=e.SUPABASE_SERVICE_ROLE_KEY;
let url=e.NEXT_PUBLIC_SUPABASE_URL;
if(!url&&key&&key.split(".").length===3)url=`https://${JSON.parse(Buffer.from(key.split(".")[1],"base64url").toString()).ref}.supabase.co`;
const sb=createClient(url,key,{auth:{persistSession:false}});
const APPLY=process.argv.includes("--apply");

const norm=(b)=>String(b||"").toLowerCase().replace(/[^a-z0-9]/g,"");
function lev(a,b){const m=a.length,n=b.length;const d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);for(let j=0;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n];}

// counts per raw brand
const counts={};
for(let from=0;;from+=1000){const{data,error}=await sb.from("products").select("brand").range(from,from+999);if(error)throw new Error(error.message);if(!data?.length)break;for(const r of data){const b=r.brand??"(null)";counts[b]=(counts[b]||0)+1;}if(data.length<1000)break;}
const brands=Object.keys(counts).filter(b=>b!=="(null)");

// (1) exact-normalised clusters
const byNorm={};
for(const b of brands){(byNorm[norm(b)]??=[]).push(b);}
const mapping={}; // from -> to
for(const k of Object.keys(byNorm)){
  const variants=byNorm[k];
  if(variants.length<2) continue;
  const canonical=variants.slice().sort((a,b)=> counts[b]-counts[a] || (b.includes(" ")?1:0)-(a.includes(" ")?1:0))[0];
  for(const v of variants) if(v!==canonical) mapping[v]=canonical;
}
// (2) edit-distance-1 typos among the surviving canonicals
const survivors=brands.filter(b=>!(b in mapping));
for(const a of survivors) for(const b of survivors){
  if(a===b||norm(a)===norm(b)) continue;
  if(counts[a]<=5 && counts[b]>=10*counts[a] && lev(norm(a),norm(b))===1){
    mapping[a]=b;
  }
}

const PLACEHOLDER=new Set(["my store","mystore"]);
const placeholders=brands.filter(b=>PLACEHOLDER.has(norm(b)));

console.log(`Brands: ${brands.length} distinct. Proposed merges: ${Object.keys(mapping).length}\n`);
let affected=0;
for(const [from,to] of Object.entries(mapping).sort((x,y)=>counts[x[0]]-counts[y[0]])){
  console.log(`  "${from}" (${counts[from]}) → "${to}" (${counts[to]})`);
  affected+=counts[from];
}
console.log(`\nRows to relabel: ${affected}`);
if(placeholders.length){
  console.log(`\nPlaceholder brands (NOT auto-merged — inspect source):`);
  for(const b of placeholders){
    const {data}=await sb.from("products").select("source,deeplink").eq("brand",b).limit(3);
    console.log(`  "${b}" (${counts[b]}) e.g. ${(data||[]).map(r=>r.source+" "+(r.deeplink||"").slice(0,50)).join(" | ")}`);
  }
}

if(!APPLY){ console.log("\n(dry-run — pass --apply to write)"); process.exit(0); }
console.log("\nApplying…");
for(const [from,to] of Object.entries(mapping)){
  const {error,count}=await sb.from("products").update({brand:to},{count:"exact"}).eq("brand",from);
  if(error){console.error(`  FAILED "${from}"→"${to}": ${error.message}`);process.exit(1);}
  console.log(`  "${from}" → "${to}": ${count} rows`);
}
console.log("Done.");
