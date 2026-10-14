import {sql} from './database.js';
import {date} from './core.js';
import {wildcardLike} from './subaccounts.js';

// Only ACTIVE current revisions participate. Explicit empty names override legacy IDs.
export const postingSQL = `WITH posted AS (
 SELECT l.id, l.journal_id, CONVERT(nvarchar(64),JSON_VALUE(l.data,'$.account_id')) AS account_id,
 COALESCE(JSON_VALUE(l.data,'$.subaccount_name'),JSON_VALUE(sub.data,'$.name'),N'') COLLATE Latin1_General_100_BIN2 AS name,
 JSON_VALUE(j.data,'$.transaction_date') AS date, j.number,
 JSON_VALUE(j.data,'$.description') AS description, JSON_VALUE(l.data,'$.line_description') AS line_description,
 JSON_VALUE(j.data,'$.journal_kind') AS kind,JSON_VALUE(j.data,'$.year_id') AS year_id,
 CONVERT(decimal(38,0),JSON_VALUE(l.data,'$.debit_amount')) AS debit,
 CONVERT(decimal(38,0),JSON_VALUE(l.data,'$.credit_amount')) AS credit
 FROM dbo.lines l JOIN dbo.journals j ON j.id=l.journal_id AND j.company_id=l.company_id
 LEFT JOIN dbo.subaccounts sub ON sub.id=JSON_VALUE(l.data,'$.subaccount_id') COLLATE Latin1_General_100_BIN2 AND sub.company_id=l.company_id AND JSON_VALUE(sub.data,'$.account_id')=JSON_VALUE(l.data,'$.account_id')
 WHERE l.company_id=@company AND (CONVERT(nvarchar(64),JSON_VALUE(l.data,'$.account_id'))=@account OR @retained=1) AND JSON_VALUE(j.data,'$.status')='ACTIVE'
 AND JSON_VALUE(l.data,'$.revision')=JSON_VALUE(j.data,'$.revision')
 AND JSON_VALUE(j.data,'$.transaction_date')<=@end
), relevant AS (
 SELECT *, CASE WHEN date<@start OR kind='OPENING' AND year_id=@year THEN 1 ELSE 0 END AS is_opening
 FROM posted WHERE account_id=@account AND (@statement='BS' OR date>=@year_start)
), totals AS (
 SELECT name,SUM(CASE WHEN is_opening=1 THEN debit-credit ELSE 0 END) AS opening,
 SUM(CASE WHEN is_opening=0 THEN debit ELSE 0 END) AS debit,
 SUM(CASE WHEN is_opening=0 THEN credit ELSE 0 END) AS credit FROM relevant GROUP BY name
 UNION ALL
 SELECT COALESCE(JSON_VALUE(l.data,'$.subaccount_name'),JSON_VALUE(sub.data,'$.name'),N'') COLLATE Latin1_General_100_BIN2,0,0,0
 FROM dbo.lines l JOIN dbo.journals j ON j.id=l.journal_id AND j.company_id=l.company_id
 LEFT JOIN dbo.subaccounts sub ON sub.id=JSON_VALUE(l.data,'$.subaccount_id') COLLATE Latin1_General_100_BIN2 AND sub.company_id=l.company_id AND JSON_VALUE(sub.data,'$.account_id')=JSON_VALUE(l.data,'$.account_id')
 WHERE l.company_id=@company AND CONVERT(nvarchar(64),JSON_VALUE(l.data,'$.account_id'))=@account
 GROUP BY COALESCE(JSON_VALUE(l.data,'$.subaccount_name'),JSON_VALUE(sub.data,'$.name'),N'') COLLATE Latin1_General_100_BIN2
 UNION ALL
 SELECT N'',SUM(p.debit-p.credit),0,0 FROM posted p JOIN dbo.accounts a ON a.id=p.account_id COLLATE Latin1_General_100_BIN2 AND a.company_id=@company
 WHERE @retained=1 AND p.date<@year_start AND JSON_VALUE(a.data,'$.statement_type')='PL' HAVING COUNT(*)>0
), balances AS (
 SELECT name,SUM(opening) AS opening,SUM(debit) AS debit,SUM(credit) AS credit,
 SUM(opening+debit-credit) AS closing FROM totals GROUP BY name
)`;

export async function querySubaccounts(db, owner, params) {
 const company=params.get('company'),account=params.get('account');
 const end=date(params.get('end')),start=date(params.get('start')||end);
 if(start>end)throw new Error('開始日と終了日を確認してください');
 const request=()=>new sql.Request(db).input('company',sql.NVarChar(64),company).input('owner',sql.NVarChar(300),owner).input('account',sql.NVarChar(64),account);
 const metadata=await request().input('start',sql.NVarChar(10),start).query(`SELECT a.data AS account,y.data AS year FROM dbo.companies c JOIN dbo.accounts a ON a.company_id=c.id JOIN dbo.years y ON y.company_id=c.id WHERE c.id=@company AND c.owner=@owner AND a.id=@account AND JSON_VALUE(y.data,'$.start')<=@start AND JSON_VALUE(y.data,'$.end')>=@start`);
 if(metadata.recordset.length!==1)throw new Error('会社・科目・会計年度へのアクセスを確認してください');
 const a=JSON.parse(metadata.recordset[0].account),y=JSON.parse(metadata.recordset[0].year);
 // Non-retained accounts can seek the company/account index directly.
 const scopedSQL=a.tag==='RETAINED'?postingSQL:postingSQL.replace(' OR @retained=1','');
 if(end>y.end)throw new Error('集計期間は1つの会計年度内で指定してください');
 const sign=a.normal_balance==='CREDIT'?-1n:1n;
 const base=()=>request().input('start',sql.NVarChar(10),start).input('end',sql.NVarChar(10),end).input('year',sql.NVarChar(64),y.id).input('year_start',sql.NVarChar(10),y.start).input('statement',sql.NVarChar(2),a.statement_type).input('retained',sql.Bit,a.tag==='RETAINED');
 const pattern=params.get('search')||'',like=wildcardLike(pattern),limit=50;
 const offset=Number(params.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>2147483400)throw new Error('ページ指定が不正です');
 if(params.get('view')==='subaccount-ledger') {
  const name=params.get('name')||'';if(name.length>300)throw new Error('補助科目名が長すぎます');
  const offset=Number(params.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0)throw new Error('ページ指定が不正です');
  const q=base().input('name',sql.NVarChar(300),name).input('offset',sql.Int,offset);
  const result=await q.query(scopedSQL+` SELECT CONVERT(varchar(50),COALESCE(SUM(opening),0)) AS opening,CONVERT(varchar(50),COALESCE(SUM(closing),0)) AS closing FROM balances WHERE name=@name COLLATE Latin1_General_100_BIN2;
  `+scopedSQL+`, movements AS (SELECT *,SUM(debit-credit) OVER(ORDER BY date,number,id ROWS UNBOUNDED PRECEDING) AS running,COUNT(*) OVER() AS total FROM relevant WHERE name=@name COLLATE Latin1_General_100_BIN2 AND is_opening=0)
  SELECT id,journal_id,date,number,description,line_description,CONVERT(varchar(50),debit) AS debit,CONVERT(varchar(50),credit) AS credit,CONVERT(varchar(50),running) AS running,total FROM movements ORDER BY date,number,id OFFSET @offset ROWS FETCH NEXT 200 ROWS ONLY;`);
  const b=result.recordsets[0][0];return {account:a,name,opening:String(BigInt(b.opening)*sign),closing:String(BigInt(b.closing)*sign),offset,rows:result.recordsets[1].map(r=>({...r,balance:String((BigInt(b.opening)+BigInt(r.running))*sign)}))};
 }
 const q=base().input('pattern',sql.NVarChar(620),like).input('filter',sql.Bit,!!pattern).input('search_zero',sql.Bit,params.get('candidates')==='true').input('all',sql.Bit,params.get('all')==='true').input('offset',sql.Int,offset);
 const result=await q.query(scopedSQL+` SELECT name,CONVERT(varchar(50),opening) AS opening,CONVERT(varchar(50),debit) AS debit,CONVERT(varchar(50),credit) AS credit,CONVERT(varchar(50),closing) AS closing FROM balances WHERE (@filter=0 OR name LIKE @pattern ESCAPE N'~') AND (@all=1 OR @filter=1 AND @search_zero=1 OR closing<>0) ORDER BY CASE WHEN closing<>0 THEN 0 ELSE 1 END,name OFFSET @offset ROWS FETCH NEXT ${limit+1} ROWS ONLY;
 `+scopedSQL+` SELECT CONVERT(varchar(50),COALESCE(SUM(closing),0)) AS total FROM balances;`);
 return {account:a,has_more:result.recordsets[0].length>limit,total:String(BigInt(result.recordsets[1][0].total)*sign),rows:result.recordsets[0].slice(0,limit).map(r=>({...r,balance:String(BigInt(r.closing)*sign)}))};
}
