import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCompany,mutate,reports,ledger,currentLines,openingPlan} from '../lib/core.js';
import {subaccountName,cleanSubaccount,wildcardLike,oppositeLines} from '../lib/subaccounts.js';
import {prepareImport} from '../lib/csv-import.js';
import {transferRows,transferColumns} from '../lib/csv-transfer.js';
import {csv} from '../lib/core.js';
const user='auxiliary-verification';
let s=createCompany(user,'Auxiliary test','2025-01-01','2025-12-31');
const acc=code=>s.accounts.find(a=>a.account_code===code);
const post=(date,d,c,n,dname='',cname='')=>{s=mutate(s,{type:'journal',transaction_date:date,description:'verification',lines:[{account_id:acc(d).id,debit_amount:n,credit_amount:0,subaccount_name:dname},{account_id:acc(c).id,debit_amount:0,credit_amount:n,subaccount_name:cname}]},user);return s.journals.at(-1);};
const setMode=(code,input,assist='NONE')=>{s=mutate(s,{...acc(code),type:'account',subaccount_input:input,subaccount_assist:assist,reason:'verification'},user);};
post('2025-01-02','1200','4000',200000,' A商事 ','A商事');
assert.equal(currentLines(s,s.journals[0])[0].subaccount_name,'A商事');
post('2025-01-03','1200','4000',150000,'B工業','B工業');
post('2025-01-04','1200','4000',100,'C産業','C産業');post('2025-01-05','1100','1200',100,'銀行','C産業');
post('2025-01-06','1100','4000',500);
setMode('1200','REQUIRED');assert.throws(()=>post('2025-01-07','1200','4000',1),/必須/);
post('2025-01-07','1200','4000',100,'自由入力');
setMode('1200','OPTIONAL');post('2025-01-08','1200','4000',10);
setMode('1200','NONE');assert.throws(()=>post('2025-01-09','1200','4000',1,'入力不可'),/不要/);
setMode('1200','OPTIONAL','COPY');assert.equal(acc('1200').subaccount_assist,'COPY');
setMode('1100','OPTIONAL','BALANCE');assert.equal(acc('1100').subaccount_assist,'BALANCE');
assert.throws(()=>cleanSubaccount('*山田*'),/検索/);assert.equal(cleanSubaccount('　山田商事　'),'山田商事');
assert.equal(wildcardLike('*山田*商事*'),'%山田%商事%');assert.equal(wildcardLike('100%_[x]~'), '100~%~_~[x]~~');
const pair=[{account_id:'a',entry_side:'DEBIT'},{account_id:'b',entry_side:'CREDIT'}];assert.equal(oppositeLines(pair,pair[0])[0].line,pair[1]);pair.push({account_id:'c',entry_side:'CREDIT'});assert.equal(oppositeLines(pair,pair[0]).length,2);
// Old master-linked immutable rows remain readable; no automatic migration.
s=mutate(s,{type:'subaccount',account_id:acc('1100').id,name:'旧銀行',reason:'verification'},user);
s=mutate(s,{type:'journal',transaction_date:'2025-02-01',description:'legacy',lines:[{account_id:acc('1100').id,subaccount_id:s.subaccounts.at(-1).id,debit_amount:1000,credit_amount:0},{account_id:acc('3000').id,debit_amount:0,credit_amount:1000}]},user);
delete s.lines.at(-2).subaccount_name;assert.equal(subaccountName(s,s.lines.at(-2)),'旧銀行');
const old=structuredClone(s.lines),legacyMaster=structuredClone(s.subaccounts);
// Revision and deletion exclude superseded postings.
const j=post('2025-02-02','1200','4000',20,'訂正前');
s=mutate(s,{type:'journal',id:j.id,transaction_date:j.transaction_date,description:'edited',reason:'verification',lines:[{account_id:acc('1200').id,debit_amount:30,credit_amount:0,subaccount_name:'訂正後'},{account_id:acc('4000').id,debit_amount:0,credit_amount:30}]},user);
const deleted=post('2025-02-03','1200','4000',50,'取消履歴');s=mutate(s,{type:'delete',id:deleted.id,reason:'verification'},user);
assert.deepEqual(s.lines.slice(0,old.length),old);assert.deepEqual(s.subaccounts,legacyMaster);
// Free names survive CSV roundtrip without a master.
const csvText=csv(transferRows(s),transferColumns);const imported=prepareImport(s,csvText,user,'verification','fixture.csv').after;
assert.equal(reports(imported,'2025-01-01','2025-12-31').bs.assets,reports(s,'2025-01-01','2025-12-31').bs.assets);
assert.ok(currentLines(imported,imported.journals.find(x=>x.id===j.id)).some(l=>l.subaccount_name==='訂正後'));
post('2025-03-01','1200','4000',11,'山田商事');post('2025-03-02','1200','4000',12,'山田工業商事');post('2025-03-03','1200','4000',13,'100%_[x]~');
// Withholding liabilities use the same mechanism as every other account.
s=mutate(s,{type:'account',account_code:'2250',account_name:'預り金',section:'CURRENT_LIABILITY',normal_balance:'CREDIT',tag:'',reason:'verification'},user);
post('2025-03-04','1100','2250',900,'銀行','源泉所得税');post('2025-03-05','1100','2250',600,'銀行','住民税');
const firstYear=structuredClone(s);
for(const p of s.periods)s=mutate(s,{type:'period',target:'periods',id:p.id,status:'CLOSED',reason:'verification'},user);
s=mutate(s,{type:'period',target:'years',id:s.years[0].id,status:'LOCKED',reason:'verification'},user);
s=mutate(s,{type:'year',start:'2026-01-01',end:'2026-12-31'},user);
const targets=openingPlan(s,s.years[1].id).rows.map(a=>({account_id:a.id,subaccount_name:a.subaccount_name,debit_amount:BigInt(a.target)>0n?a.target:'0',credit_amount:BigInt(a.target)<0n?String(-BigInt(a.target)):'0'}));
for(const code of ['1100','3000']){const b=targets.find(x=>x.account_id===acc(code).id);if(code==='1100')b.debit_amount=String(BigInt(b.debit_amount)+200n);else b.credit_amount=String(BigInt(b.credit_amount)+200n);}
s=mutate(s,{type:'opening',year_id:s.years[1].id,balances:targets,reason:'verification'},user);
post('2026-01-02','1100','1200',10000,'銀行','A商事');
let other=createCompany('another-owner','Other','2025-01-01','2025-12-31');
other=mutate(other,{type:'journal',transaction_date:'2025-01-02',description:'other company',lines:[{account_id:other.accounts.find(a=>a.account_code==='1200').id,debit_amount:999999,credit_amount:0,subaccount_name:'A商事'},{account_id:other.accounts.find(a=>a.account_code==='4000').id,debit_amount:0,credit_amount:999999,subaccount_name:'A商事'}]},'another-owner');
assert.throws(()=>mutate(s,{type:'account'},'another-owner'),/権限/);
for(const state of [firstYear,s])for(const y of state.years){const r=reports(state,y.start,y.end);assert.equal(r.bs.difference,'0');assert.equal(r.trial.closing_difference,'0');}
console.log('PASS: free names, required/optional/none, defaults, trimming, wildcard escaping, CSV, revisions/deletion, legacy data preservation, withholding, years and unchanged BS/PL/trial.');

if(process.argv.includes('--sql')) {
 const {sql,dbConfig,load,query}=await import('../lib/database.js');const {postingSQL,querySubaccounts}=await import('../lib/subaccount-query.js');
 const db=await new sql.ConnectionPool({...dbConfig(),server:'127.0.0.1',connectionTimeout:10000,pool:{max:2,min:0}}).connect();
 try {
  const states=[s,other],fixtures=Object.fromEntries(['companies','accounts','years','journals','lines','subaccounts'].map(t=>[t,states.flatMap(st=>t==='companies'?[{id:st.company.id,company_id:st.company.id,owner:st.company.owner,data:JSON.stringify(st.company)}]:st[t].map(row=>({id:row.id,company_id:st.company.id,journal_id:row.journal_id||'',number:row.journal_number||'',data:JSON.stringify(row)})))]));
  let setup='SET NOCOUNT ON;';for(const t of Object.keys(fixtures))setup+=`CREATE TABLE #${t}(id nvarchar(64),company_id nvarchar(64),journal_id nvarchar(64),number nvarchar(40),owner nvarchar(300),data nvarchar(max)); INSERT #${t} SELECT id,company_id,journal_id,number,owner,data FROM OPENJSON(@fixture,'$.${t}') WITH(id nvarchar(64),company_id nvarchar(64),journal_id nvarchar(64),number nvarchar(40),owner nvarchar(300),data nvarchar(max));`;
  const cte=postingSQL.replaceAll('dbo.','#');
  for(const y of s.years)for(const account of s.accounts)for(const rangeStart of [y.start,y.start.slice(0,4)+'-06-01']){
   const r=await new sql.Request(db).input('fixture',sql.NVarChar(sql.MAX),JSON.stringify(fixtures)).input('company',sql.NVarChar(64),s.company.id).input('account',sql.NVarChar(64),account.id).input('start',sql.NVarChar(10),rangeStart).input('end',sql.NVarChar(10),y.end).input('year',sql.NVarChar(64),y.id).input('year_start',sql.NVarChar(10),y.start).input('statement',sql.NVarChar(2),account.statement_type).input('retained',sql.Bit,account.tag==='RETAINED').query(setup+cte+` SELECT name,CONVERT(varchar(50),opening) AS opening,CONVERT(varchar(50),debit) AS debit,CONVERT(varchar(50),credit) AS credit,CONVERT(varchar(50),closing) AS closing FROM balances;`+cte+` SELECT id,name,CONVERT(varchar(50),SUM(debit-credit) OVER(PARTITION BY name ORDER BY date,number,id ROWS UNBOUNDED PRECEDING)) AS running FROM relevant WHERE is_opening=0 ORDER BY date,number,id;`);
   const sum=k=>r.recordsets[0].reduce((n,row)=>n+BigInt(row[k]),0n).toString();const total=reports(s,rangeStart,y.end).rows.find(a=>a.id===account.id);
   for(const k of ['opening','debit','credit','closing'])assert.equal(sum(k),total[k],account.account_code+' '+y.start+' '+k);
   const expectedLines=ledger(s,account.id,rangeStart,y.end).rows;assert.equal(r.recordsets[1].length,expectedLines.length);
   const running=new Map();for(const row of r.recordsets[1]){const line=expectedLines.find(x=>x.id===row.id);assert.ok(line);assert.equal(subaccountName(s,line),row.name);running.set(row.name,(running.get(row.name)||0n)+BigInt(line.debit_amount)-BigInt(line.credit_amount));assert.equal(row.running,String(running.get(row.name)));}
   if(account.account_code==='1200'&&y.start==='2025-01-01'){assert.equal(r.recordsets[0].find(x=>x.name==='C産業').closing,'0');assert.equal(r.recordsets[0].find(x=>x.name==='訂正前').closing,'0');assert.equal(r.recordsets[0].find(x=>x.name==='訂正後').closing,'30');assert.equal(r.recordsets[0].find(x=>x.name==='取消履歴').closing,'0');}
  }
  for(const pattern of ['*山田*','山田*','*商事','*山田*商事*','山田商事','100%_[x]~']){
   const result=await new sql.Request(db).input('pattern',sql.NVarChar(620),wildcardLike(pattern)).query(`SELECT name FROM (VALUES(N'山田商事'),(N'山田工業商事'),(N'100%_[x]~'),(N'他')) v(name) WHERE name COLLATE Latin1_General_100_BIN2 LIKE @pattern ESCAPE N'~';`);
   assert.equal(result.recordset.length,pattern==='山田商事'||pattern==='100%_[x]~'?1:2);
  }
  // Read-only reconciliation against the existing database. No existing row is edited.
  const companies=(await query(db,'SELECT id,owner FROM dbo.companies')).recordset;
  let checked=0;for(const company of companies){const state=await load(db,company.id,company.owner);for(const year of state.years)for(const account of state.accounts){
   const p=new URLSearchParams({view:'subaccount-balances',company:company.id,account:account.id,start:year.start,end:year.end,all:'true'});
   const result=await querySubaccounts(db,company.owner,p),expected=reports(state,year.start,year.end).rows.find(a=>a.id===account.id).closing;
   assert.equal(result.total,String(BigInt(expected)*(account.normal_balance==='CREDIT'?-1n:1n)));checked++;
   const item=result.rows[0];if(item){p.set('view','subaccount-ledger');p.set('name',item.name);const l=await querySubaccounts(db,company.owner,p);assert.equal(l.closing,item.balance);}
   const mid=new Date(Math.min(Date.parse(year.start)+14*86400000,Date.parse(year.end))).toISOString().slice(0,10);p.set('start',mid);p.set('view','subaccount-balances');
   const midway=await querySubaccounts(db,company.owner,p),midExpected=reports(state,mid,year.end).rows.find(a=>a.id===account.id).closing;
   assert.equal(midway.total,String(BigInt(midExpected)*(account.normal_balance==='CREDIT'?-1n:1n)));checked++;
   await assert.rejects(()=>querySubaccounts(db,'wrong-owner',p),/アクセス/);
  }}
  console.log('PASS: SQL Server temporary fixtures, GROUP BY/SUM reconciliation for all accounts/years, wildcard search and real DB read-only reconciliation ('+checked+' account-years). Existing DB rows unchanged.');
 }finally{await db.close();}
}
