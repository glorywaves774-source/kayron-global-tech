'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'site-data.json');
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const EMAIL_TO = process.env.CONTACT_EMAIL || 'info@kayronglobaltech.com';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '';
fs.mkdirSync(DATA_DIR, { recursive: true });
const initial = { enquiries: [], projects: [], services: [
 {id:'software',name:'Software Development & IT Solutions',description:'Custom software and practical technology solutions for organisations.'},
 {id:'web-mobile',name:'Website & Mobile Application Development',description:'Modern websites, mobile applications and digital platforms.'},
 {id:'marketing',name:'Digital Marketing & Branding',description:'Brand identity, digital campaigns and stronger online visibility.'},
 {id:'consultancy',name:'ICT Consultancy & Training',description:'Technology guidance, ICT training and capacity development.'}
]};
function readDB(){try{return JSON.parse(fs.readFileSync(DB_FILE,'utf8'));}catch{return structuredClone(initial);}}
let db=readDB();
if(!Array.isArray(db.testimonials))db.testimonials=[];
// One-time import of portfolio-seed.json. Runs only if the portfolio has never been seeded and is empty,
// so projects deleted later in the admin dashboard are not brought back on restart.
function seedPortfolio(){if(db.portfolioSeeded){fillSeedLinks();save();return;}if(!Array.isArray(db.projects))db.projects=[];if(!db.projects.length){try{const seed=JSON.parse(fs.readFileSync(path.join(ROOT,'portfolio-seed.json'),'utf8'));const base=Date.now();db.projects=seed.filter(p=>p&&String(p.name||'').trim().length>=2).map((p,i)=>({id:crypto.randomUUID(),name:String(p.name).trim().slice(0,120),description:String(p.description||'').trim().slice(0,1500),url:safeLink(p.url),createdAt:new Date(base-i*1000).toISOString()}));}catch(e){console.warn('Portfolio seed not loaded:',e.message);}}db.portfolioSeeded=true;fillSeedLinks();save();}
// Adds links from portfolio-seed.json to existing projects with the same name that have no link yet,
// or whose link is listed in the seed entry's "replaces" list (an outdated address).
function fillSeedLinks(){try{const seed=JSON.parse(fs.readFileSync(path.join(ROOT,'portfolio-seed.json'),'utf8'));for(const p of db.projects){const m=seed.find(s=>s&&String(s.name||'').trim()===p.name);if(!m)continue;const outdated=(Array.isArray(m.replaces)?m.replaces:[]).map(safeLink).filter(Boolean);if(p.url&&!outdated.includes(p.url))continue;const link=safeLink(m.url);if(link)p.url=link;}}catch(e){console.warn('Portfolio links not updated:',e.message);}}
function save(){const tmp=DB_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2),{mode:0o600});fs.renameSync(tmp,DB_FILE);}
function send(res,status,body,type='application/json; charset=utf-8',headers={}){res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY',...headers});res.end(type.startsWith('application/json')?JSON.stringify(body):body);}
function parseCookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));}
function sign(value){return crypto.createHmac('sha256',SESSION_SECRET).update(value).digest('hex');}
function validSession(req){if(!SESSION_SECRET)return false;const c=parseCookies(req).kayron_admin||'';const [value,mac]=c.split('.');return !!value&&!!mac&&crypto.timingSafeEqual(Buffer.from(mac),Buffer.from(sign(value)))&&Number(value)>Date.now();}
function sameOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host;}catch{return false;}}
async function body(req){let s='';for await(const chunk of req){s+=chunk;if(s.length>20000)throw new Error('Request too large');}return JSON.parse(s||'{}');}
// Only allow http(s) links so a stored project URL can never become a javascript: link on the public site.
function safeLink(value){value=String(value||'').trim();if(!value)return '';if(!/^[a-z][a-z0-9+.-]*:/i.test(value))value='https://'+value;try{const u=new URL(value);return (u.protocol==='http:'||u.protocol==='https:')&&u.hostname.includes('.')?u.href:'';}catch{return '';}}
// Render sits behind Cloudflare, which writes the visitor's real address to CF-Connecting-IP and overwrites any
// value the visitor sends. Without it (local runs) fall back to the socket address.
function clientIp(req){const cf=String(req.headers['cf-connecting-ip']||'').trim();return cf||req.socket.remoteAddress||'unknown';}
function projectFields(b){const t=(v,n)=>String(v||'').trim().slice(0,n);const name=t(b.name,200),description=String(b.description||'').trim(),rawUrl=String(b.url||'').trim(),urlValue=safeLink(rawUrl);
 if(name.length<2||name.length>120)return {error:'Project name must be 2–120 characters.'};if(description.length>3000)return {error:'Description must be at most 3000 characters.'};
 if(rawUrl.length>300||(rawUrl&&!urlValue))return {error:'Project link must be a web address starting with http:// or https://'};
 return {name,description,urlValue,project:t(b.project,120),client:t(b.client,120),industry:t(b.industry,80),service:t(b.service,120)};}
// One-time content updates from content-updates.json. Each update has an id and is applied once (recorded in db.appliedUpdates),
// so later edits made in the admin dashboard are never overwritten by a restart.
function applyContentUpdates(){let list=[];try{list=JSON.parse(fs.readFileSync(path.join(ROOT,'content-updates.json'),'utf8'));}catch{return;}
 if(!Array.isArray(db.appliedUpdates))db.appliedUpdates=[];let changed=false;
 for(const u of list){if(!u||!u.id||db.appliedUpdates.includes(u.id))continue;
  if(u.project){const f=projectFields(u.project);if(!f.error){const names=[f.name,...(u.project.match||[])];const item=db.projects.find(p=>names.includes(p.name));
   const keepUrl=item&&item.url;const data={name:f.name,project:f.project,client:f.client,industry:f.industry,service:f.service,description:f.description,url:f.urlValue||keepUrl||''};
   if(item)Object.assign(item,data);else db.projects.push({id:crypto.randomUUID(),...data,createdAt:new Date().toISOString()});}}
  if(u.testimonial){const name=String(u.testimonial.name||'').trim(),role=String(u.testimonial.role||'').trim(),quote=String(u.testimonial.quote||'').trim();
   if(name&&quote&&!db.testimonials.some(t=>t.quote===quote))db.testimonials.push({id:crypto.randomUUID(),name,role,quote,createdAt:new Date().toISOString()});}
  db.appliedUpdates.push(u.id);changed=true;}
 if(changed)save();}
const hits=new Map();setInterval(()=>{const now=Date.now();for(const [k,a] of hits){const r=a.filter(t=>now-t<60000);if(r.length)hits.set(k,r);else hits.delete(k);}},300000).unref();function limited(ip){const now=Date.now(),a=(hits.get(ip)||[]).filter(t=>now-t<60000);a.push(now);hits.set(ip,a);return a.length>8;}
async function notify(item){if(!RESEND_KEY||!EMAIL_FROM)return false;const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${RESEND_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:EMAIL_FROM,to:[EMAIL_TO],reply_to:item.email,subject:`Website enquiry: ${item.service}`,text:`Name: ${item.name}\nEmail: ${item.email}\nService: ${item.service}\n\n${item.message}`})});return r.ok;}
// Public files: the site's pages, everything under /assets/, and the search-engine files. Nothing else in the project folder is served.
const PUBLIC_PAGES=new Set(['/index.html','/about.html','/services.html','/products.html','/portfolio.html','/contact.html','/privacy.html','/admin.html','/404.html','/robots.txt','/sitemap.xml']);
function isPublic(p){return PUBLIC_PAGES.has(p)||(p.startsWith('/assets/')&&!p.includes('..'));}
function notFound(res){fs.readFile(path.join(ROOT,'404.html'),(err,data)=>err?send(res,404,'Not found','text/plain; charset=utf-8'):send(res,404,data,'text/html; charset=utf-8'));}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.json':'application/json; charset=utf-8','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');const ip=clientIp(req);
 try{
  if(req.method==='POST'&&!sameOrigin(req))return send(res,403,{error:'Request origin rejected'});
  if(url.pathname==='/api/health'&&req.method==='GET')return send(res,200,{ok:true});
  if(url.pathname==='/api/testimonials'&&req.method==='GET')return send(res,200,{testimonials:db.testimonials.map(({id,name,role,quote})=>({id,name,role,quote}))},'application/json; charset=utf-8',{'Cache-Control':'no-cache'});
  if(url.pathname==='/api/projects'&&req.method==='GET')return send(res,200,{projects:db.projects.map(({id,name,project,client,industry,service,description,url,createdAt})=>({id,name,project:project||'',client:client||'',industry:industry||'',service:service||'',description,url:safeLink(url),createdAt}))},'application/json; charset=utf-8',{'Cache-Control':'no-cache'});
  if(url.pathname==='/api/enquiries'&&req.method==='POST'){
   if(limited(ip))return send(res,429,{error:'Too many submissions. Please try again later.'});
   const b=await body(req);if(String(b.website||'').trim())return send(res,201,{ok:true,message:'Thank you. Your enquiry has been received.'});
   const name=String(b.name||'').trim(),email=String(b.email||'').trim(),service=String(b.service||'').trim(),message=String(b.message||'').trim();
   if(name.length<2||name.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||service.length>120||message.length<10||message.length>5000)return send(res,400,{error:'Please provide a valid name, email, service and message (10–5000 characters).'});
   const item={id:crypto.randomUUID(),name,email,service,message,createdAt:new Date().toISOString(),status:'new',emailSent:false};db.enquiries.unshift(item);save();try{item.emailSent=await notify(item);save();}catch{}return send(res,201,{ok:true,message:'Thank you. Your enquiry has been received.'});
  }
  if(url.pathname==='/api/admin/login'&&req.method==='POST'){
   if(!ADMIN_PASSWORD||!SESSION_SECRET)return send(res,503,{error:'Admin login is not configured. Set ADMIN_PASSWORD and SESSION_SECRET.'});
   const b=await body(req);const supplied=Buffer.from(String(b.password||''));const expected=Buffer.from(ADMIN_PASSWORD);if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return send(res,401,{error:'Incorrect password'});
   const value=String(Date.now()+8*60*60*1000);return send(res,200,{ok:true},'application/json; charset=utf-8', {'Set-Cookie':`kayron_admin=${encodeURIComponent(value+'.'+sign(value))}; HttpOnly; ${process.env.NODE_ENV==='production'?'Secure; ':''}SameSite=Strict; Path=/; Max-Age=28800`});
  }
  if(url.pathname==='/api/admin/logout'&&req.method==='POST')return send(res,200,{ok:true},'application/json; charset=utf-8',{'Set-Cookie':`kayron_admin=; HttpOnly; ${process.env.NODE_ENV==='production'?'Secure; ':''}SameSite=Strict; Path=/; Max-Age=0`});
  if(url.pathname.startsWith('/api/admin/')){
   if(!validSession(req))return send(res,401,{error:'Please sign in'});
   if(url.pathname==='/api/admin/data'&&req.method==='GET')return send(res,200,{enquiries:db.enquiries,projects:db.projects,services:db.services,testimonials:db.testimonials});
   if(url.pathname==='/api/admin/projects'&&req.method==='POST'){
    const b=await body(req),f=projectFields(b);if(f.error)return send(res,400,{error:f.error});const {name,description,urlValue}=f;
    const p={id:crypto.randomUUID(),name,project:f.project,client:f.client,industry:f.industry,service:f.service,description,url:urlValue,createdAt:new Date().toISOString()};db.projects.unshift(p);save();return send(res,201,p);
   }
   if(url.pathname==='/api/admin/testimonials'&&req.method==='POST'){
    const b=await body(req),name=String(b.name||'').trim(),role=String(b.role||'').trim(),quote=String(b.quote||'').trim();
    if(name.length<2||name.length>120||role.length>160||quote.length<10||quote.length>2000)return send(res,400,{error:'Please give a name (2–120 characters) and a quote (10–2000 characters).'});
    const t={id:crypto.randomUUID(),name,role,quote,createdAt:new Date().toISOString()};db.testimonials.unshift(t);save();return send(res,201,t);
   }
   const tm=url.pathname.match(/^\/api\/admin\/testimonials\/([\w-]+)$/);if(tm&&req.method==='DELETE'){db.testimonials=db.testimonials.filter(t=>t.id!==tm[1]);save();return send(res,200,{ok:true});}
   const sm=url.pathname.match(/^\/api\/admin\/services\/([\w-]+)$/);if(sm&&req.method==='PATCH'){const b=await body(req),item=db.services.find(x=>x.id===sm[1]);if(!item)return send(res,404,{error:'Not found'});const name=String(b.name||'').trim(),description=String(b.description||'').trim();if(name.length<2||name.length>120||description.length>500)return send(res,400,{error:'Check service fields'});item.name=name;item.description=description;save();return send(res,200,item);}
   const pe=url.pathname.match(/^\/api\/admin\/projects\/([\w-]+)$/);if(pe&&req.method==='PATCH'){const item=db.projects.find(x=>x.id===pe[1]);if(!item)return send(res,404,{error:'Not found'});const f=projectFields(await body(req));if(f.error)return send(res,400,{error:f.error});Object.assign(item,{name:f.name,project:f.project,client:f.client,industry:f.industry,service:f.service,description:f.description,url:f.urlValue});save();return send(res,200,item);}
   const pm=url.pathname.match(/^\/api\/admin\/projects\/([\w-]+)$/);if(pm&&req.method==='DELETE'){db.projects=db.projects.filter(p=>p.id!==pm[1]);save();return send(res,200,{ok:true});}
   const em=url.pathname.match(/^\/api\/admin\/enquiries\/([\w-]+)$/);if(em&&req.method==='PATCH'){const b=await body(req),item=db.enquiries.find(x=>x.id===em[1]);if(!item)return send(res,404,{error:'Not found'});if(['new','in-progress','resolved'].includes(b.status))item.status=b.status;save();return send(res,200,item);}
   return send(res,404,{error:'Not found'});
  }
  let requested=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);const file=path.resolve(ROOT,'.'+requested);if(!file.startsWith(ROOT+path.sep)||!isPublic(requested))return notFound(res);
  fs.readFile(file,(err,data)=>{if(err)return notFound(res);send(res,200,data,mime[path.extname(file)]||'application/octet-stream');});
 }catch(e){send(res,e.message==='Request too large'?413:400,{error:e.message==='Request too large'?e.message:'Unable to process request'});}
});
seedPortfolio();
applyContentUpdates();
server.listen(PORT,()=>console.log(`Kayron site running on ${PORT}`));
