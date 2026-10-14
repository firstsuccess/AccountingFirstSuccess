import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {sql,dbConfig,physicalTables} from '../lib/database.js';
const db=await new sql.ConnectionPool({...dbConfig(),server:process.env.DB_SERVER_OVERRIDE||'127.0.0.1',connectionTimeout:10000}).connect();
async function fingerprint(){const hash=createHash('sha256');for(const table of physicalTables){const r=await db.request().query(`SELECT id,data FROM dbo.[${table}] ORDER BY id`);hash.update(table);for(const row of r.recordset){hash.update(row.id);hash.update(row.data);}}return hash.digest('hex');}
try {
 const before=await fingerprint();
 await db.request().batch(fs.readFileSync(new URL('../sql/03-subaccount-search-index.sql',import.meta.url),'utf8'));
 const after=await fingerprint();assert.equal(after,before,'Existing data changed during index migration; investigate concurrent writers');
 const result=await db.request().query("SELECT c.name,c.is_computed FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.lines') AND c.name IN ('search_account_id','subaccount_name'); SELECT name FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.lines') AND name IN ('idx_lines_subaccount_search','idx_lines_subaccount_name');");
 assert.equal(result.recordsets[0].length,2);assert.ok(result.recordsets[0].every(r=>r.is_computed));assert.equal(result.recordsets[1].length,2);
 console.log('PASS: additive computed column/index installed; all nine tables have identical row IDs and JSON before/after.');
}finally{await db.close();}
