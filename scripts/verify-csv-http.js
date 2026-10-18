// Read-only integration: downloads and csv_preview only. No csv_execute or save.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {scryptSync,randomBytes} from 'node:crypto';
import {sql,dbConfig,load,query} from '../lib/database.js';
import {csv} from '../lib/core.js';
import {parseJournalCSV} from '../lib/csv-import.js';
import {transferRows} from '../lib/csv-transfer.js';
const db=await new sql.ConnectionPool({...dbConfig(),server:'127.0.0.1',connectionTimeout:10000}).connect();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'monja-csv-http-'));let server;
try {
 const c=(await query(db,'SELECT TOP (1) id,owner,version FROM dbo.companies ORDER BY id DESC')).recordset[0];assert.ok(c);
 const s=await load(db,c.id,c.owner),salt=randomBytes(32).toString('hex'),password=randomBytes(24).toString('hex'),users=path.join(temp,'users.json');
 fs.writeFileSync(users,JSON.stringify([{username:'csv-http-test',owner:c.owner,salt,hash:scryptSync(password,salt,64).toString('hex')}]));
 const origin='http://127.0.0.1:3139',headers={Authorization:'Basic '+Buffer.from('csv-http-test:'+password).toString('base64')};
 server=spawn(process.execPath,['server.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'3139',DB_SERVER:'127.0.0.1',PUBLIC_ORIGIN:origin,AUTH_USERS_FILE:users},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error('Test server exited '+code)));setTimeout(()=>reject(new Error('Test startup timeout')),10000).unref();});
 const sample=s.journals.find(j=>j.status==='ACTIVE'&&j.journal_kind!=='OPENING');assert.ok(sample);const day=sample.transaction_date;
 let r=await fetch(origin+'/api/accounting?'+new URLSearchParams({company:c.id,export:'journal_transfer',from:day,to:day}),{headers});assert.equal(r.status,200);const download=await r.text();const exported=parseJournalCSV(download),expected=transferRows(s,{from:day,to:day});assert.equal(exported.length,expected.length);assert.ok(exported.every(row=>row.transaction_date===day));
 r=await fetch(origin+'/api/accounting?'+new URLSearchParams({company:c.id,export:'journal_transfer',from:'2026-12-31',to:'2026-01-01'}),{headers});assert.equal(r.status,400);
 const p=s.periods.find(p=>p.status==='OPEN'&&s.years.some(y=>y.id===p.year_id&&y.status==='OPEN'));assert.ok(p);
 const accounts=s.accounts.filter(a=>a.active&&!Object.values(s.company.tax_accounts||{}).includes(a.id)).slice(0,2);assert.equal(accounts.length,2);
 const text=csv(Array.from({length:500},(_,i)=>accounts.map((a,k)=>({company_id:c.id,journal_number:'',import_group:'http-'+i,transaction_date:p.start,description:'確認'.repeat(150),line_description:'明細'.repeat(150),account_code:a.account_code,subaccount_name:a.subaccount_input==='REQUIRED'?'検証':'',debit_amount:k===0?1:0,credit_amount:k===1?1:0}))).flat());
 const body=JSON.stringify({type:'csv_preview',company_id:c.id,version:s.company.version,csv:text,reason:'read-only preview verification',filename:'1000-lines.csv'});assert.ok(Buffer.byteLength(body)>1000000);
 r=await fetch(origin+'/api/accounting',{method:'POST',headers:{...headers,Origin:origin,'Content-Type':'application/json'},body});const preview=await r.json();assert.equal(r.status,200,preview.error);assert.equal(preview.summary.length,500);
 r=await fetch(origin+'/api/accounting',{method:'POST',headers:{...headers,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({type:'csv_preview',company_id:c.id,version:s.company.version,csv:'x'.repeat(5000001),reason:'oversize verification',filename:'oversize.csv'})});assert.equal(r.status,400);assert.match((await r.json()).error,/5MB/);
 const after=await load(db,c.id,c.owner);assert.deepEqual(after,s);
 console.log('PASS: HTTP date-filtered download, invalid date rejection, >1MB JSON preview with 1000 lines/500 journals, >5MB CSV rejection and unchanged real DB.');
}finally{if(server){server.kill();await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,3000).unref();});}fs.rmSync(temp,{recursive:true,force:true});await db.close();}
