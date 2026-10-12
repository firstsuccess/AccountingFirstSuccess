import fs from 'node:fs';
import {pool,sql,query,physicalTables} from '../lib/database.js';
import {tables} from '../lib/core.js';
const files=process.argv.slice(2);if(!files.length)throw new Error('Specify full company JSON backups from Site Settings, one file per company.');
const states=files.map(f=>JSON.parse(fs.readFileSync(f,'utf8')));
for(const s of states){
 if(s.format!=='jp-ledger'||!s.company?.id||!s.company?.owner)throw new Error('A full jp-ledger JSON backup is required; partial physical exports are refused.');
 for(const t of tables)if(!Array.isArray(s[t]))throw new Error(`Missing table ${t}`);
}
const db=await pool(),tx=new sql.Transaction(db);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
try{
 // Whole import is atomic and only targets an empty database.
 for(const t of physicalTables){const r=await query(tx,`SELECT COUNT(*) AS n FROM dbo.[${t}]`);if(r.recordset[0].n)throw new Error('Import requires empty tables; existing data is never overwritten.');}
 const order=['accounts','years','periods','subaccounts','journals','lines','audit','tax_codes'];
 for(const s of states){const c=s.company;await query(tx,'INSERT INTO dbo.companies(id,owner,version,data) VALUES(@p0,@p1,@p2,@p3)',[c.id,c.owner,c.version,JSON.stringify(c)]);
 for(const t of order)for(const row of s[t]){const columns=['id','company_id','data'],values=[row.id,c.id,JSON.stringify(row)];
 if(t==='accounts'||t==='tax_codes'){columns.push('code');values.push(t==='accounts'?row.account_code:row.tax_code);}
 if(t==='journals'){columns.push('number');values.push(row.journal_number);}
 if(t==='lines'){columns.push('journal_id');values.push(row.journal_id);}
 await query(tx,`INSERT INTO dbo.[${t}](${columns.map(x=>'['+x+']').join(',')}) VALUES(${values.map((_,i)=>'@p'+i).join(',')})`,values);
 }}
 await tx.commit();console.log('Imported full company backups:',states.map(s=>s.company.name).join(', '));
}catch(e){try{await tx.rollback();}catch{}throw e;}finally{await db.close();}
