import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {scryptSync,randomBytes} from 'node:crypto';
import {tables,reports} from '../lib/core.js';
const data=JSON.parse(fs.readFileSync(new URL('../data/database-partial.json',import.meta.url),'utf8'));
for(const [t,rows] of Object.entries(data.tables)){assert.equal(new Set(rows.map(r=>r.id)).size,rows.length,t);for(const r of rows)JSON.parse(r.data);}
const test=data.tables.companies.find(r=>JSON.parse(r.data).name==='テスト');assert.ok(test);
const s={company:{...JSON.parse(test.data),version:test.version}};for(const t of tables)s[t]=data.tables[t].filter(r=>r.company_id===test.id).map(r=>JSON.parse(r.data));
const report=reports(s,s.company.start,s.company.end);assert.equal(report.bs.difference,'0');assert.equal(s.journals.length,10);assert.equal(s.lines.length,20);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'monja-check-')),salt=randomBytes(32).toString('hex'),password=randomBytes(24).toString('hex'),users=path.join(dir,'users.json');
fs.writeFileSync(users,JSON.stringify([{username:'verification',owner:test.owner,salt,hash:scryptSync(password,salt,64).toString('hex')}]));
const server=spawn(process.execPath,['server.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,AUTH_USERS_FILE:users,PUBLIC_ORIGIN:'https://localhost',PORT:'3137'},stdio:['ignore','pipe','pipe']});
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error('Server exited '+code)));setTimeout(()=>reject(new Error('Start timed out')),5000).unref();});
 let r=await fetch('http://127.0.0.1:3137/',{redirect:'manual'});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/login');assert.equal(r.headers.get('www-authenticate'),null);
 r=await fetch('http://127.0.0.1:3137/');assert.equal(r.status,200);assert.equal(new URL(r.url).pathname,'/login');assert.match(await r.text(),/autocomplete="current-password"/);
 r=await fetch('http://127.0.0.1:3137/api/accounting');assert.equal(r.status,401);assert.equal(r.headers.get('www-authenticate'),null);assert.equal((await r.json()).error,'サインインが必要です');
 for(const file of ['../screen-source/app/accounting-app.js','../public/app.js'])assert.match(fs.readFileSync(new URL(file,import.meta.url),'utf8'),/"もんじゃ会計"/);
 const headers={Authorization:'Basic '+Buffer.from('verification:'+password).toString('base64')};
 r=await fetch('http://127.0.0.1:3137/',{headers});assert.equal(r.status,200);assert.match(await r.text(),/id="root"/);
 for(const file of ['app.js','styles.css']){r=await fetch('http://127.0.0.1:3137/'+file,{headers});assert.equal(r.status,200);assert.ok((await r.text()).length>1000);}
 r=await fetch('http://127.0.0.1:3137/data/database-partial.json',{headers});assert.equal(r.status,404);
 const origin='http://127.0.0.1:3137';
 for(const deniedOrigin of [undefined,'https://evil.example','http://localhost:3137']){
 r=await fetch(origin+'/api/logout',{method:'POST',headers:deniedOrigin?{Origin:deniedOrigin}:{}});assert.equal(r.status,403);
 }
 r=await fetch(origin+'/api/logout',{method:'POST',headers:{...headers,Origin:origin}});assert.equal(r.status,200);
 const logoutCookies=r.headers.getSetCookie();assert.ok(!logoutCookies[0].includes('Secure'));
 const loggedOut=logoutCookies[0].split(';')[0];
 r=await fetch(origin,{headers:{...headers,Cookie:loggedOut},redirect:'manual'});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/login');
 r=await fetch(origin+'/api/accounting',{headers:{...headers,Cookie:loggedOut}});assert.equal(r.status,401);
 r=await fetch(origin+'/login');assert.equal(r.status,200);assert.match(await r.text(),/autocomplete="current-password"/);
 r=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,Authorization:'Basic '+Buffer.from('verification:incorrect').toString('base64')}});assert.equal(r.status,401);
 r=await fetch(origin+'/api/login',{method:'POST',headers:{...headers,Origin:origin,Cookie:loggedOut}});assert.equal(r.status,200);
 const sessionCookie=r.headers.getSetCookie().find(c=>c.startsWith('accounting_session='));assert.ok(sessionCookie);assert.ok(!sessionCookie.includes('Secure'));
 const session=sessionCookie.split(';')[0];
 r=await fetch(origin,{headers:{Cookie:session}});assert.equal(r.status,200);
 r=await fetch(origin+'/api/logout',{method:'POST',headers:{Origin:origin,Cookie:session}});assert.equal(r.status,200);
 r=await fetch(origin,{headers:{Cookie:session},redirect:'manual'});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/login');assert.equal(r.headers.get('www-authenticate'),null);
 r=await fetch(origin+'/api/logout',{method:'POST',headers:{Origin:'https://localhost'}});assert.equal(r.status,200);assert.ok(r.headers.getSetCookie()[0].includes('Secure'));
 console.log('PASS: logout, cached Basic credential blocking, relogin, session revocation, local HTTP access with HTTPS configuration, cross-origin rejection, HTTPS secure cookies.');
 console.log('PASS: JavaScript HTTP startup, authentication, static assets, private-file isolation, existing test-company balanced report, snapshot JSON. SQL Server integration NOT tested.');
}finally{server.kill();fs.rmSync(dir,{recursive:true,force:true});}
