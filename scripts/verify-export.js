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
const server=spawn(process.execPath,['server.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,AUTH_USERS_FILE:users,PUBLIC_ORIGIN:'http://127.0.0.1:3137',PORT:'3137'},stdio:['ignore','pipe','pipe']});
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error('Server exited '+code)));setTimeout(()=>reject(new Error('Start timed out')),5000).unref();});
 let r=await fetch('http://127.0.0.1:3137/');assert.equal(r.status,401);
 const headers={Authorization:'Basic '+Buffer.from('verification:'+password).toString('base64')};
 r=await fetch('http://127.0.0.1:3137/',{headers});assert.equal(r.status,200);assert.match(await r.text(),/id="root"/);
 for(const file of ['app.js','styles.css']){r=await fetch('http://127.0.0.1:3137/'+file,{headers});assert.equal(r.status,200);assert.ok((await r.text()).length>1000);}
 r=await fetch('http://127.0.0.1:3137/data/database-partial.json',{headers});assert.equal(r.status,404);
 console.log('PASS: JavaScript HTTP startup, authentication, static assets, private-file isolation, existing test-company balanced report, snapshot JSON. SQL Server integration NOT tested.');
}finally{server.kill();fs.rmSync(dir,{recursive:true,force:true});}
