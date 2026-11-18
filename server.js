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
const hits=new Map();function limited(ip){const now=Date.now(),a=(hits.get(ip)||[]).filter(t=>now-t<60000);a.push(now);hits.set(ip,a);return a.length>8;}
async function notify(item){if(!RESEND_KEY||!EMAIL_FROM)return false;const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${RESEND_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:EMAIL_FROM,to:[EMAIL_TO],reply_to:item.email,subject:`Website enquiry: ${item.service}`,text:`Name: ${item.name}\nEmail: ${item.email}\nService: ${item.service}\n\n${item.message}`})});return r.ok;}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');const ip=req.socket.remoteAddress||'unknown';
 try{
  if(req.method==='POST'&&!sameOrigin(req))return send(res,403,{error:'Request origin rejected'});
  if(url.pathname==='/api/health'&&req.method==='GET')return send(res,200,{ok:true});
  if(url.pathname==='/api/projects'&&req.method==='GET')return send(res,200,{projects:db.projects.map(({id,name,description,url,createdAt})=>({id,name,description,url:safeLink(url),createdAt}))},'application/json; charset=utf-8',{'Cache-Control':'no-cache'});
  if(url.pathname==='/api/enquiries'&&req.method==='POST'){
   if(limited(ip))return send(res,429,{error:'Too many submissions. Please try again later.'});
   const b=await body(req);const name=String(b.name||'').trim(),email=String(b.email||'').trim(),service=String(b.service||'').trim(),message=String(b.message||'').trim();
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
   if(url.pathname==='/api/admin/data'&&req.method==='GET')return send(res,200,{enquiries:db.enquiries,projects:db.projects,services:db.services});
   if(url.pathname==='/api/admin/projects'&&req.method==='POST'){
    const b=await body(req),name=String(b.name||'').trim(),description=String(b.description||'').trim(),rawUrl=String(b.url||'').trim(),urlValue=safeLink(rawUrl);if(name.length<2||name.length>120||description.length>1500||rawUrl.length>300)return send(res,400,{error:'Check project fields'});if(rawUrl&&!urlValue)return send(res,400,{error:'Project link must be a web address starting with http:// or https://'});
    const p={id:crypto.randomUUID(),name,description,url:urlValue,createdAt:new Date().toISOString()};db.projects.unshift(p);save();return send(res,201,p);
   }
   const sm=url.pathname.match(/^\/api\/admin\/services\/([\w-]+)$/);if(sm&&req.method==='PATCH'){const b=await body(req),item=db.services.find(x=>x.id===sm[1]);if(!item)return send(res,404,{error:'Not found'});const name=String(b.name||'').trim(),description=String(b.description||'').trim();if(name.length<2||name.length>120||description.length>500)return send(res,400,{error:'Check service fields'});item.name=name;item.description=description;save();return send(res,200,item);}
   const pm=url.pathname.match(/^\/api\/admin\/projects\/([\w-]+)$/);if(pm&&req.method==='DELETE'){db.projects=db.projects.filter(p=>p.id!==pm[1]);save();return send(res,200,{ok:true});}
   const em=url.pathname.match(/^\/api\/admin\/enquiries\/([\w-]+)$/);if(em&&req.method==='PATCH'){const b=await body(req),item=db.enquiries.find(x=>x.id===em[1]);if(!item)return send(res,404,{error:'Not found'});if(['new','in-progress','resolved'].includes(b.status))item.status=b.status;save();return send(res,200,item);}
   return send(res,404,{error:'Not found'});
  }
  let requested=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);const file=path.resolve(ROOT,'.'+requested);if(!file.startsWith(ROOT+path.sep))return send(res,403,'Forbidden','text/plain');
  fs.readFile(file,(err,data)=>{if(err)return send(res,404,'Not found','text/plain; charset=utf-8');send(res,200,data,mime[path.extname(file)]||'application/octet-stream');});
 }catch(e){send(res,e.message==='Request too large'?413:400,{error:e.message==='Request too large'?e.message:'Unable to process request'});}
});
seedPortfolio();
server.listen(PORT,()=>console.log(`Kayron site running on ${PORT}`));
