import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createCompany,mutate,openingPlan,currentLines,reports,journalBalances} from '../lib/core.js';
import {assignCompanyId} from '../lib/numbering.js';
const user='journal-balance-test';
let s=assignCompanyId(createCompany(user,'Journal balances','2026-01-01','2026-12-31'),'C000000001');
const account=code=>s.accounts.find(a=>a.account_code===code).id;
const targets=openingPlan(s,s.years[0].id).rows.map(a=>({account_id:a.id,debit_amount:a.account_code==='1100'?1000:0,credit_amount:a.account_code==='3000'?1000:0}));
s=mutate(s,{type:'opening',year_id:s.years[0].id,balances:targets,reason:'test'},user);const opening=s.journals.at(-1);
const post=(date,d,c,n)=>{s=mutate(s,{type:'journal',transaction_date:date,description:'test',lines:[{account_id:account(d),debit_amount:n,credit_amount:0},{account_id:account(c),debit_amount:0,credit_amount:n}]},user);return s.journals.at(-1);};
let sale=post('2026-01-02','1200','4000',200),receipt=post('2026-01-03','1100','1200',50),expense=post('2026-01-03','6100','1100',20);
s=mutate(s,{type:'journal',transaction_date:'2026-01-04',description:'compound',lines:[{account_id:account('6100'),debit_amount:10,credit_amount:0},{account_id:account('1200'),debit_amount:30,credit_amount:0},{account_id:account('1100'),debit_amount:0,credit_amount:40}]},user);const compound=s.journals.at(-1);
const transfer=post('2026-01-05','1100','1100',2),before=JSON.stringify(s);
let balances=journalBalances(s,'2026-01-01','2026-12-31');
assert.equal(balances.get(opening.id)[account('1100')],'1000');assert.equal(balances.get(opening.id)[account('3000')],'1000');
assert.equal(balances.get(sale.id)[account('1200')],'200');assert.equal(balances.get(sale.id)[account('4000')],'200');
assert.equal(balances.get(receipt.id)[account('1100')],'1050');assert.equal(balances.get(receipt.id)[account('1200')],'150');
assert.equal(balances.get(expense.id)[account('1100')],'1030');assert.equal(balances.get(compound.id)[account('1100')],'990');assert.equal(balances.get(compound.id)[account('6100')],'30');assert.equal(balances.get(compound.id)[account('1200')],'180');assert.equal(balances.get(transfer.id)[account('1100')],'990');assert.equal(JSON.stringify(s),before);
// Only current revisions and ACTIVE journals contribute.
s=mutate(s,{type:'journal',id:sale.id,transaction_date:sale.transaction_date,description:'edited',reason:'test',lines:[{account_id:account('1200'),debit_amount:220,credit_amount:0},{account_id:account('4000'),debit_amount:0,credit_amount:220}]},user);
s=mutate(s,{type:'delete',id:expense.id,reason:'test'},user);
balances=journalBalances(s,'2026-01-01','2026-12-31');assert.equal(balances.has(expense.id),false);assert.equal(balances.get(compound.id)[account('1200')],'200');assert.equal(balances.get(transfer.id)[account('1100')],'1010');
const partial=journalBalances(s,'2026-01-04','2026-12-31');assert.deepEqual(partial.get(compound.id),balances.get(compound.id));
// Changing which journal rows are shown must not alter the computed balances.
const shown=s.journals.filter(j=>j.id===compound.id);assert.equal(balances.get(shown[0].id)[account('1100')],'1010');
s=mutate(s,{type:'year',start:'2027-01-01',end:'2027-12-31'},user);const next=post('2027-01-02','1100','4000',100);
const nextBalances=journalBalances(s,'2027-01-01','2027-12-31');assert.equal(nextBalances.get(next.id)[account('1100')],'1110');assert.equal(nextBalances.get(next.id)[account('4000')],'100');
const expected=reports(s,'2027-01-01','2027-12-31');for(const [id,value] of Object.entries(nextBalances.get(next.id))){const a=expected.rows.find(a=>a.id===id);assert.equal(value,String(BigInt(a.closing)*(a.normal_balance==='CREDIT'?-1n:1n)));}
const bundle=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),start=bundle.indexOf('function journalBalances('),code=bundle.slice(start,bundle.indexOf('\n}',start)+2),context=vm.createContext({reports,BigInt});vm.runInContext(code,context);assert.equal(JSON.stringify([...context.journalBalances(s,'2026-01-01','2026-12-31')]),JSON.stringify([...journalBalances(s,'2026-01-01','2026-12-31')]));
assert.ok(bundle.includes('借方科目の残高（円）'));assert.ok(bundle.includes('貸方科目の残高（円）'));
console.log('PASS: opening, debit/credit normal signs, same-day order, compound accounts, same-account transfers, revisions/deletion, hidden journals, mid-period opening, year carryforward and shipped calculation parity. No DB writes.');
