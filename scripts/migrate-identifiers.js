// Default mode rehearses every write and rolls back. --apply commits only after validation.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {sql,dbConfig,query,physicalTables,save} from '../lib/database.js';
import {tables,reports,currentLines,mutate,createCompany} from '../lib/core.js';
import {taxReport} from '../lib/tax.js';
import {planIdMigration} from '../lib/id-migration.js';
const oldId='07ef8dfe-62fc-4168-bb72-255150495541',newId='C000000001',apply=process.argv.includes('--apply');
const db=await new sql.ConnectionPool({...dbConfig(),server:process.env.DB_SERVER_OVERRIDE||'127.0.0.1',connectionTimeout:10000,requestTimeout:60000}).connect();
const tx=new sql.Transaction(db);let begun=false;
const signature=s=>s.years.map(y=>{const tax=taxReport(s,y.start,y.end);tax.rows.sort((a,b)=>(a.tax_code+'|'+a.tax_rate).localeCompare(b.tax_code+'|'+b.tax_rate));return {year:y.id,report:reports(s,y.start,y.end),tax};});
function validate(s){
 assert.equal(new Set(s.lines.map(l=>l.id)).size,s.lines.length);
 for(const l of s.lines){assert.equal(l.id.length<=64,true);assert.ok(s.journals.some(j=>j.id===l.journal_id));if(l.tax_source_line_id)assert.ok(s.lines.some(source=>source.id===l.tax_source_line_id&&source.journal_id===l.journal_id&&source.revision===l.revision));}
 for(const j of s.journals){const ls=currentLines(s,j);assert.equal(ls.reduce((n,l)=>n+BigInt(l.debit_amount)-BigInt(l.credit_amount),0n),0n);}
}
try {
 await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
 const snapshot={};for(const table of physicalTables)snapshot[table]=(await query(tx,`SELECT * FROM dbo.[${table}] WITH (TABLOCKX,HOLDLOCK) ORDER BY id`)).recordset;
 const c=snapshot.companies.find(c=>c.id===oldId);assert.ok(c,'移行元会社が存在しません。移行済みの場合は再実行しないでください');assert.ok(!snapshot.companies.some(c=>c.id===newId),'移行先会社IDは既に使用されています');
 const unexpected=(await query(tx,"SELECT name FROM sys.foreign_keys WHERE referenced_object_id=OBJECT_ID('dbo.lines')")).recordset;assert.equal(unexpected.length,0,'明細IDを参照する追加FKがあるため手動確認が必要です');
 const before={company:{...JSON.parse(c.data),version:c.version}};for(const table of tables)before[table]=snapshot[table].filter(r=>r.company_id===oldId).map(r=>JSON.parse(r.data));
 const {after,lineIds,journalNumbers}=planIdMigration(before,newId);validate(before);validate(after);assert.deepEqual(signature(after),signature(before),'移行計画で帳票残高が変化しています');
 const backupDir=path.resolve('backups');fs.mkdirSync(backupDir,{recursive:true});
 const backupFile=path.join(backupDir,`identifier-${apply?'apply':'rehearsal'}-${new Date().toISOString().replaceAll(/[:.]/g,'-')}.json`);
 fs.writeFileSync(backupFile,JSON.stringify({format:'monja-physical-id-migration-backup',exported_at:new Date().toISOString(),oldId,newId,snapshot,mapping:{journals:Object.fromEntries(journalNumbers),lines:Object.fromEntries(lineIds)}},null,2),{flag:'wx'});
 assert.deepEqual(JSON.parse(fs.readFileSync(backupFile,'utf8')).snapshot,snapshot);
 const triggers=['companies_no_delete','lines_immutable','audit_immutable'];
 const status=(await query(tx,"SELECT name,is_disabled FROM sys.triggers WHERE name IN ('companies_no_delete','lines_immutable','audit_immutable') AND OBJECT_SCHEMA_NAME(object_id)='dbo'")).recordset;
 assert.equal(status.length,3);assert.ok(status.every(t=>!t.is_disabled),'保護トリガーの初期状態が不正です');
 // DDL and data changes are transactional; rollback restores the original enabled guards.
 for(const name of triggers)await query(tx,`DISABLE TRIGGER dbo.[${name}] ON dbo.[${name==='companies_no_delete'?'companies':name==='lines_immutable'?'lines':'audit'}]`);
 await query(tx,'INSERT dbo.companies(id,owner,version,data) VALUES(@p0,@p1,@p2,@p3)',[newId,c.owner,after.company.version,JSON.stringify(after.company)]);
 for(const table of tables){
  for(let i=0;i<before[table].length;i++){
   const original=before[table][i],row=after[table][i];
   const extra=table==='journals'?',number=@p4':'';
   const values=[row.id,newId,JSON.stringify(row),original.id];if(table==='journals')values.push(row.journal_number);
   const idChange=row.id===original.id?'':'id=@p0,';
   const update=await query(tx,`UPDATE dbo.[${table}] SET ${idChange}company_id=@p1,data=@p2${extra} WHERE id=@p3 AND company_id=@p5`,[...values,...(table==='journals'?[]:[null]),oldId]);
   assert.equal(update.rowsAffected[0],1,'移行中の対象行が一致しません：'+table);
  }
 }
 const audit=after.audit.at(-1);await query(tx,'INSERT dbo.audit(id,company_id,data) VALUES(@p0,@p1,@p2)',[audit.id,newId,JSON.stringify(audit)]);
 const removed=await query(tx,'DELETE dbo.companies WHERE id=@p0',[oldId]);assert.equal(removed.rowsAffected[0],1);
 for(const name of triggers)await query(tx,`ENABLE TRIGGER dbo.[${name}] ON dbo.[${name==='companies_no_delete'?'companies':name==='lines_immutable'?'lines':'audit'}]`);
 const migrated={company:after.company};
 for(const table of tables){const rows=(await query(tx,`SELECT id,data FROM dbo.[${table}] WHERE company_id=@p0 ORDER BY id`,[newId])).recordset;migrated[table]=rows.map(r=>{const row=JSON.parse(r.data);assert.equal(row.id,r.id);return row;});}
 validate(migrated);assert.deepEqual(signature(migrated),signature(before));
 for(const table of tables){assert.equal((await query(tx,`SELECT COUNT(*) AS n FROM dbo.[${table}] WHERE company_id=@p0`,[oldId])).recordset[0].n,0);}
 // Other companies must retain their exact original physical rows.
 for(const table of physicalTables){const rows=(await query(tx,`SELECT * FROM dbo.[${table}] WHERE ${table==='companies'?'id':'company_id'} NOT IN (@p0,@p1) ORDER BY id`,[oldId,newId])).recordset;assert.deepEqual(rows,snapshot[table].filter(r=>(table==='companies'?r.id:r.company_id)!==oldId&&(table==='companies'?r.id:r.company_id)!==newId));}
 assert.ok((await query(tx,"SELECT is_disabled FROM sys.triggers WHERE name IN ('companies_no_delete','lines_immutable','audit_immutable')")).recordset.every(t=>!t.is_disabled));
 // Exercise the real persistence code inside a savepoint, then remove all test data.
 await query(tx,'SAVE TRANSACTION runtime_verification');
 const openPeriod=migrated.periods.find(p=>p.status==='OPEN'&&migrated.years.some(y=>y.id===p.year_id&&y.status==='OPEN'));
 assert.ok(openPeriod,'新規仕訳のDB検証に使用できるOPEN期間がありません');
 const accounts=migrated.accounts.filter(a=>a.active&&!Object.values(migrated.company.tax_accounts||{}).includes(a.id));assert.ok(accounts.length>=2);
 const command={type:'journal',transaction_date:openPeriod.start,description:'rollback-only identifier verification',lines:accounts.slice(0,2).map((a,i)=>({account_id:a.id,debit_amount:i===0?1:0,credit_amount:i===1?1:0,subaccount_name:a.subaccount_input==='REQUIRED'?'採番検証':'',tax_code:'UNSPECIFIED'}))};
 const created=mutate(migrated,command,c.owner);await save(db,migrated,created,c.owner,tx);const added=created.journals.at(-1);
 assert.match(added.journal_number,/^J\d{9}$/);assert.ok(currentLines(created,added).every(l=>l.id.startsWith(newId+'-'+added.journal_number+'-R00001-')));
 const edited=mutate(created,{...command,id:added.id,reason:'rollback verification'},c.owner);await save(db,created,edited,c.owner,tx);
 assert.ok(currentLines(edited,edited.journals.at(-1)).every(l=>l.id.includes('-R00002-')));
 const deleted=mutate(edited,{type:'delete',id:added.id,reason:'rollback verification'},c.owner);await save(db,edited,deleted,c.owner,tx);
 await assert.rejects(()=>save(db,migrated,created,c.owner,tx),/同時更新/);
 const second=createCompany(c.owner,'rollback-only company','2026-01-01','2026-12-31');await save(db,null,second,c.owner,tx);assert.equal(second.company.id,'C000000002');
 await query(tx,'ROLLBACK TRANSACTION runtime_verification');
 assert.equal((await query(tx,'SELECT COUNT(*) AS n FROM dbo.companies WHERE id=@p0',['C000000002'])).recordset[0].n,0);
 for(const table of tables)assert.equal((await query(tx,`SELECT COUNT(*) AS n FROM dbo.[${table}] WHERE company_id=@p0`,[newId])).recordset[0].n,after[table].length,'検証データが残っています：'+table);
 if(apply)await tx.commit();else await tx.rollback();begun=false;
 console.log(JSON.stringify({mode:apply?'COMMITTED':'REHEARSED_AND_ROLLED_BACK',company_id:newId,journals:after.journals.length,all_revision_lines:after.lines.length,backup:backupFile,validation:'BS/PL/trial/tax unchanged; references valid; other companies unchanged; guards enabled; new/edit/delete/stale-version/company-number persistence verified and rolled back'},null,2));
}catch(e){if(begun)try{await tx.rollback();}catch{}console.error(e);process.exitCode=1;}
finally{await db.close();}
