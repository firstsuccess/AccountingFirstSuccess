import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scryptSync,timingSafeEqual} from 'node:crypto';
import {pool,query,load,save} from './lib/database.js';
import {tables,createCompany,mutate,csv,csvColumns} from './lib/core.js';
import {transferRows,transferColumns,backupLineRows,backupLineColumns} from './lib/csv-transfer.js';
import {prepareImport} from './lib/csv-import.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const users=JSON.parse(fs.readFileSync(path.resolve(root,process.env.AUTH_USERS_FILE||'users.json'),'utf8'));
if(!Array.isArray(users)||!users.length)throw new Error('認証ユーザーを設定してください');
for(const u of users)if(!u.username||!u.owner||!u.salt||!/^[a-f0-9]{128}$/.test(u.hash))throw new Error('users.jsonの設定が不正です');
const publicOrigin=process.env.PUBLIC_ORIGIN;
if(!publicOrigin||new URL(publicOrigin).origin!==publicOrigin)throw new Error('PUBLIC_ORIGIN must be an origin without trailing slash');
function authenticate(req){
 const a=req.headers.authorization;if(!a?.startsWith('Basic '))return null;
 const v=Buffer.from(a.slice(6),'base64').toString('utf8'),i=v.indexOf(':');if(i<0||v.length>1024)return null;
 const u=users.find(u=>u.username===v.slice(0,i));if(!u)return null;
 const hash=scryptSync(v.slice(i+1),u.salt,64);return timingSafeEqual(hash,Buffer.from(u.hash,'hex'))?u:null;
}
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
 const u=authenticate(req);if(!u){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Monja Accounting", charset="UTF-8"','Content-Type':'text/plain; charset=utf-8'});return res.end('サインインが必要です');}
 try{
 const url=new URL(req.url,publicOrigin);
 if(url.pathname==='/api/accounting'){
 const db=await pool();
 if(req.method==='GET'){
 const id=url.searchParams.get('company');
 if(!id){const r=await query(db,'SELECT data,version FROM dbo.companies WHERE owner=@p0 ORDER BY id',[u.owner]);return json(res,{companies:r.recordset.map(r=>({...JSON.parse(r.data),version:r.version})),user:u.displayName||u.username});}
 const s=await load(db,id,u.owner);
 if(!url.searchParams.has('export'))return json(res,s);
 const type=url.searchParams.get('export');let content,mime;
 if(type==='all'){content=JSON.stringify({format:'jp-ledger',schema_version:2,exported_at:new Date().toISOString(),...s},null,2);mime='application/json';}
 else {const data=type==='journal_transfer'?transferRows(s):type==='lines'?backupLineRows(s):type==='company'?[s.company]:tables.includes(type)?s[type]:null;if(!Array.isArray(data))throw new Error('不正な出力形式');content=csv(data,type==='journal_transfer'?transferColumns:type==='lines'?backupLineColumns:csvColumns[type]);mime='text/csv';}
 res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Content-Disposition':`attachment; filename="${type==='all'?'ledger-backup.json':type+'.csv'}"`});return res.end(content);
 }
 if(req.method!=='POST')return json(res,{error:'Method not allowed'},405);
 if(req.headers.origin!==publicOrigin)return json(res,{error:'異なるサイトからの更新は拒否しました'},403);
 if(!req.headers['content-type']?.startsWith('application/json'))return json(res,{error:'JSON形式が必要です'},415);
 let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>1000000){json(res,{error:'入力サイズが上限を超えています'},413);return;}chunks.push(chunk);}
 const body=Buffer.concat(chunks).toString('utf8'),c=JSON.parse(body);
 if(!['csv_preview','csv_execute'].includes(c.type)&&body.length>100000)return json(res,{error:'入力サイズが上限を超えています'},413);
 if(c.type==='test')throw new Error('新しいテスト会社は作成できません');
 if(c.type==='create'){const s=createCompany(u.owner,c.name,c.start,c.end);await save(db,null,s,u.owner);return json(res,s,201);}
 const before=await load(db,c.company_id,u.owner);if(before.company.version!==c.version)return json(res,{error:'別の操作で更新されています。再読み込みしてください'},409);
 if(['csv_preview','csv_execute'].includes(c.type)){const result=prepareImport(before,c.csv,u.owner,c.reason,c.filename);if(c.type==='csv_preview')return json(res,{summary:result.summary,version:before.company.version});await save(db,before,result.after,u.owner);return json(res,result.after);}
 const after=mutate(before,c,u.owner);await save(db,before,after,u.owner);return json(res,after);
 }
 if(!['GET','HEAD'].includes(req.method))return json(res,{error:'Method not allowed'},405);
 const files={'/':'index.html','/app.js':'app.js','/styles.css':'styles.css','/favicon.svg':'favicon.svg'};const f=files[url.pathname];if(!f){res.writeHead(404);return res.end();}
 const mime=f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.svg')?'image/svg+xml':'text/html';
 res.writeHead(200,{'Content-Type':mime+'; charset=utf-8'});if(req.method==='HEAD')return res.end();res.end(fs.readFileSync(path.join(root,'public',f)));
 }catch(e){console.error('Request failed:',e.code||e.message);json(res,{error:e.code?'保存先との処理に失敗しました。登録状況を確認してください。':e.message||'処理に失敗しました'},400);}
});
const host=process.env.LISTEN_HOST||'127.0.0.1',port=Number(process.env.PORT||3000);
if(host!=='127.0.0.1'&&host!=='::1')throw new Error('IIS経由で利用するためループバックアドレスに限定しています');
server.listen(port,host,()=>console.log(`Accounting server listening on ${host}:${port}`));
