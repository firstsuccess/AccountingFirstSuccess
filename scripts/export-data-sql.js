import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sql from 'mssql';
import {dbConfig,physicalTables} from '../lib/database.js';

// Read-only export. Example:
// node --env-file=.env scripts/export-data-sql.js --server 127.0.0.1 --port 1433
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){assert.ok(['--server','--port','--output'].includes(args[i])&&args[i+1],'Invalid export arguments');options[args[i]]=args[i+1];}
const config=dbConfig();if(options['--server'])config.server=options['--server'];if(options['--port'])config.port=Number(options['--port']);
config.connectionTimeout=10000;config.requestTimeout=30000;config.pool={max:1,min:0,idleTimeoutMillis:1000};
const order=['companies','accounts','years','periods','subaccounts','journals','lines','audit','tax_codes'];
const columns={companies:['id','owner','version','data'],accounts:['id','company_id','code','data'],journals:['id','company_id','number','data'],lines:['id','company_id','journal_id','data'],tax_codes:['id','company_id','code','data']};
for(const table of order)columns[table]||=['id','company_id','data'];
function literal(value){
 if(typeof value==='number'){assert.ok(Number.isSafeInteger(value));return String(value);}
 assert.equal(typeof value,'string');
 const chars=Array.from(value),chunks=[];for(let i=0;i<chars.length;i+=1000)chunks.push("N'"+chars.slice(i,i+1000).join('').replaceAll("'","''")+"'");
 const expression="CAST(N'' AS nvarchar(max))"+(chunks.length?' + '+chunks.join(' + '):'');
 // Verify all text, including apostrophes and long audit JSON, survives SQL quoting.
 assert.equal([...expression.matchAll(/N'((?:[^']|'')*)'/g)].map(m=>m[1].replaceAll("''","'")).join(''),value);
 return expression;
}
const db=new sql.ConnectionPool(config);let tx,begun=false;
try{
 await db.connect();tx=new sql.Transaction(db);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
 const request=()=>new sql.Request(tx);
 const identity=(await request().query("SELECT CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName')) AS instance_name, DB_NAME() AS database_name")).recordset[0];
 const actual=(await request().query("SELECT t.name AS table_name,c.name AS column_name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id WHERE s.name='dbo' AND c.is_computed=0")).recordset;
 assert.deepEqual([...new Set(actual.map(r=>r.table_name))].sort(),[...physicalTables].sort(),'Unexpected table set; refusing incomplete export');
 const snapshot={};
 for(const table of order){
  assert.deepEqual(actual.filter(r=>r.table_name===table).map(r=>r.column_name).sort(),[...columns[table]].sort(),`Unexpected schema: ${table}`);
  snapshot[table]=(await request().query(`SELECT ${columns[table].map(c=>'['+c+']').join(',')} FROM dbo.[${table}] WITH (TABLOCK,HOLDLOCK) ORDER BY id`)).recordset;
  const ids=new Set();for(const row of snapshot[table]){assert.ok(!ids.has(row.id),`Duplicate ID: ${table}`);ids.add(row.id);assert.equal(JSON.parse(row.data).id,row.id,`JSON ID mismatch: ${table}`);}
 }
 const companies=new Set(snapshot.companies.map(r=>r.id));
 const journalMap=new Map(snapshot.journals.map(r=>[r.id,r]));
 for(const table of order.filter(t=>t!=='companies'))for(const row of snapshot[table])assert.ok(companies.has(row.company_id),`Unknown company: ${table}`);
 for(const row of snapshot.companies){const c=JSON.parse(row.data);assert.equal(c.owner,row.owner);assert.equal(c.version,row.version);}
 for(const row of snapshot.accounts)assert.equal(JSON.parse(row.data).account_code,row.code);
 for(const row of snapshot.tax_codes)assert.equal(JSON.parse(row.data).tax_code,row.code);
 for(const row of snapshot.journals)assert.equal(JSON.parse(row.data).journal_number,row.number);
 for(const row of snapshot.lines){assert.equal(JSON.parse(row.data).journal_id,row.journal_id);assert.equal(journalMap.get(row.journal_id)?.company_id,row.company_id);}
 await tx.commit();begun=false;
 const counts=Object.fromEntries(order.map(t=>[t,snapshot[t].length]));
 const output=[
  '-- Snapshot of all current application tables in SQL Server. Historical records already absent from the source cannot be recovered.',
  `-- Exported at (UTC): ${new Date().toISOString()}`,
  `-- Row counts: ${JSON.stringify(counts)}`,
  '-- Run only in a NEW empty database after sql/01-create-tables.sql. Never run against the operating database.',
  'SET XACT_ABORT ON;','BEGIN TRY','BEGIN TRANSACTION;',
  ...order.map(t=>`IF EXISTS (SELECT 1 FROM dbo.[${t}] WITH (TABLOCK,HOLDLOCK)) THROW 51010, 'Import requires empty application tables', 1;`),
  ...order.flatMap(t=>snapshot[t].map(row=>`INSERT INTO dbo.[${t}](${columns[t].map(c=>'['+c+']').join(',')}) VALUES(${columns[t].map(c=>literal(row[c])).join(',')});`)),
  ...order.map(t=>`IF (SELECT COUNT_BIG(*) FROM dbo.[${t}]) <> ${counts[t]} THROW 51011, 'Imported row count mismatch: ${t}', 1;`),
  'COMMIT TRANSACTION;','END TRY','BEGIN CATCH','IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;','THROW;','END CATCH;',''
 ].join('\r\n');
 for(const t of order)assert.equal(output.split(`INSERT INTO dbo.[${t}](`).length-1,counts[t]);
 const destination=path.resolve(options['--output']||'sql/02-data-PARTIAL.sql');
 const temporary=destination+'.tmp';fs.writeFileSync(temporary,output,'utf8');assert.equal(fs.readFileSync(temporary,'utf8'),output);fs.renameSync(temporary,destination);
 console.log(JSON.stringify({output:destination,source:identity,counts,validation:'JSON, IDs, company references, physical columns, SQL text round-trip, INSERT counts; no source DB writes'},null,2));
}catch(error){if(begun)try{await tx.rollback();}catch{}console.error('Export failed:',error.code||error.message);process.exitCode=1;}
finally{await db.close();}
