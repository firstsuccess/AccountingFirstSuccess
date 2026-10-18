import sql from 'mssql';
import {tables} from './core.js';
import {sequentialCode,assignCompanyId} from './numbering.js';
export {sql};
export const physicalTables=['companies',...tables];
export function dbConfig(){
 for(const key of ['DB_SERVER','DB_NAME','DB_USER','DB_PASSWORD'])if(!process.env[key])throw new Error(`${key} is required`);
 return {server:process.env.DB_SERVER,port:Number(process.env.DB_PORT||1433),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,options:{encrypt:process.env.DB_ENCRYPT!=='false',trustServerCertificate:process.env.DB_TRUST_CERT==='true'},pool:{max:10,min:0,idleTimeoutMillis:30000}};
}
let connection;
export function pool(){return connection??=new sql.ConnectionPool(dbConfig()).connect();}
export async function query(db,text,values=[]){const r=new sql.Request(db);values.forEach((v,i)=>r.input('p'+i,typeof v==='number'?sql.Int:sql.NVarChar(sql.MAX),v));return r.query(text);}
export async function load(db,id,user){
 const tx=new sql.Transaction(db);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try{
 const result=await query(tx,'SELECT * FROM dbo.companies WHERE id=@p0 AND owner=@p1',[id,user]);
 const c=result.recordset[0];if(!c)throw new Error('会社が見つからないか、アクセス権がありません');
 const state={company:{...JSON.parse(c.data),version:c.version}};
 for(const t of tables)state[t]=(await query(tx,`SELECT data FROM dbo.[${t}] WHERE company_id=@p0`,[id])).recordset.map(r=>JSON.parse(r.data));
 await tx.commit();return state;
 }catch(e){try{await tx.rollback();}catch{}throw e;}
}
export async function save(db,before,after,user,transaction=null){
 // A caller-owned transaction is used by migration rehearsal; the caller must commit/rollback.
 const tx=transaction||new sql.Transaction(db);if(!transaction)await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try{
 const c=after.company;
 if(c.owner!==user)throw new Error('会社所有者が一致しません');
 if(before){
 const r=await query(tx,'UPDATE dbo.companies SET version=version+1,data=@p0 WHERE id=@p1 AND owner=@p2 AND version=@p3',[JSON.stringify(c),c.id,user,before.company.version]);
 if(r.rowsAffected[0]!==1)throw new Error('同時更新を検出しました。再読み込みしてください。');
 }else {
 const allocation=await query(tx,"SELECT COALESCE(MAX(TRY_CONVERT(int,SUBSTRING(id,2,9))),0)+1 AS next_id FROM dbo.companies WITH (UPDLOCK,HOLDLOCK) WHERE LEN(id)=10 AND id LIKE 'C[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'");
 assignCompanyId(after,sequentialCode('C',allocation.recordset[0].next_id));
 await query(tx,'INSERT INTO dbo.companies(id,owner,version,data) VALUES(@p0,@p1,@p2,@p3)',[c.id,user,c.version,JSON.stringify(c)]);
 }
 for(const t of tables){
 const old=new Map((before?.[t]||[]).map(r=>[r.id,r]));
 for(const r of after[t]){
 const prior=old.get(r.id);if(prior&&JSON.stringify(prior)===JSON.stringify(r))continue;
 const extra=t==='accounts'||t==='tax_codes'?'code':t==='journals'?'number':t==='lines'?'journal_id':null;
 const value=t==='accounts'?r.account_code:t==='tax_codes'?r.tax_code:t==='journals'?r.journal_number:r.journal_id;
 if(prior){
 if(t==='lines'||t==='audit')throw new Error('不変データの変更は禁止されています');
 const values=[JSON.stringify(r)];if(extra)values.push(value);values.push(r.id,c.id);
 const n=extra?2:1;
 const result=await query(tx,`UPDATE dbo.[${t}] SET data=@p0${extra?`,[${extra}]=@p1`:''} WHERE id=@p${n} AND company_id=@p${n+1}`,values);
 if(result.rowsAffected[0]!==1)throw new Error('保存対象が見つかりません');
 }else{
 const cols=['id','company_id','data'],values=[r.id,c.id,JSON.stringify(r)];if(extra){cols.push(extra);values.push(value);}
 await query(tx,`INSERT INTO dbo.[${t}](${cols.map(c=>'['+c+']').join(',')}) VALUES(${values.map((_,i)=>'@p'+i).join(',')})`,values);
 }
 }
 if([...old.keys()].some(id=>!after[t].some(r=>r.id===id)))throw new Error('物理削除は禁止されています');
 }
 if(!transaction)await tx.commit();
 }catch(e){if(!transaction)try{await tx.rollback();}catch{}throw e;}
}
