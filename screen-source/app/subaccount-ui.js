"use client";
import {jsx,jsxs,Fragment} from 'react/jsx-runtime';
import {useEffect,useState} from 'react';
import {subaccountName,oppositeLines} from '../lib/accounting/subaccounts.js';
const subMoney=n=>BigInt(n||0).toLocaleString('ja-JP');
function SubaccountInput({s,editor,line,onChange,inputId}) {
 const [query,setQuery]=useState(subaccountName(s,line)),[rows,setRows]=useState([]),[error,setError]=useState(''),[focused,setFocused]=useState(false),[highlight,setHighlight]=useState(-1);
 const account=s.accounts.find(a=>a.id===line.account_id),mode=account?.subaccount_input||'OPTIONAL';
 const opposites=oppositeLines(editor.lines,line);
 const balanceAssist=opposites.some(x=>s.accounts.find(a=>a.id===x.line.account_id)?.subaccount_assist==='BALANCE');
 const copies=[...new Set(opposites.filter(x=>s.accounts.find(a=>a.id===x.line.account_id)?.subaccount_assist==='COPY').map(x=>subaccountName(s,x.line)).filter(Boolean))];
 useEffect(()=>{setQuery(subaccountName(s,line));},[line.subaccount_name,line.subaccount_id,line.account_id,s.company.id]);
 useEffect(()=>{
  setRows([]);setError('');if(!focused||!account||!editor.transaction_date||mode==='NONE')return;
  const controller=new AbortController();const timer=setTimeout(async()=>{
   try{const p=new URLSearchParams({company:s.company.id,account:account.id,view:'subaccount-balances',start:editor.transaction_date,end:editor.transaction_date,search:query,candidates:'true',all:balanceAssist?'false':'true'});
    const r=await fetch('/api/accounting?'+p,{signal:controller.signal});const d=await r.json();if(!r.ok)throw new Error(d.error);setRows(d.rows);
   }catch(e){if(e.name!=='AbortError')setError(e.message);}
  },250);return()=>{clearTimeout(timer);controller.abort();};
 },[focused,query,account?.id,editor.transaction_date,s.company.id,s.company.version,balanceAssist,mode]);
 function choose(name){setQuery(name);onChange({subaccount_name:name,subaccount_id:'',subaccount_search:''});setFocused(false);setHighlight(-1);}
 const candidateNames=[...copies.filter(name=>!subaccountName(s,line)),...rows.map(r=>r.name)];
 if(mode==='NONE'&&!subaccountName(s,line))return null;
 return jsxs('div',{className:'subaccount-combo',children:[
  jsx('input',{className:'subaccount-text',role:'combobox','aria-label':'補助科目名','aria-expanded':focused,'aria-controls':'sub-options-'+inputId,'aria-autocomplete':'list',maxLength:300,placeholder:mode==='REQUIRED'?'補助科目（必須）':'補助科目（自由入力）',value:query,onFocus:()=>setFocused(true),onBlur:()=>setFocused(false),onKeyDown:e=>{if(e.key==='Escape'){setFocused(false);setHighlight(-1);}else if((e.key==='ArrowDown'||e.key==='ArrowUp')&&candidateNames.length){e.preventDefault();setFocused(true);setHighlight(e.key==='ArrowDown'?Math.min(highlight+1,candidateNames.length-1):Math.max(highlight-1,0));}else if(e.key==='Enter'&&focused&&highlight>=0&&candidateNames[highlight]!==undefined){e.preventDefault();choose(candidateNames[highlight]);}},onChange:e=>{const q=e.target.value;setQuery(q);setFocused(true);setHighlight(-1);onChange(q.includes('*')?{subaccount_search:q}:{subaccount_name:q,subaccount_id:'',subaccount_search:''});}}),
  query.includes('*')&&jsx('small',{children:'検索条件です。候補を選択するか、* を除いて名前を入力してください。'}),
  focused&&jsxs('div',{id:'sub-options-'+inputId,role:'listbox',className:'subaccount-options',children:[
   ...copies.filter(name=>!subaccountName(s,line)).map(name=>jsx('button',{type:'button',role:'option','aria-selected':false,onMouseDown:e=>e.preventDefault(),onClick:()=>choose(name),children:'相手明細からの提案：'+name},'copy:'+name)),
   ...rows.map(r=>jsx('button',{type:'button',role:'option','aria-selected':r.name===subaccountName(s,line),onMouseDown:e=>e.preventDefault(),onClick:()=>choose(r.name),children:(r.name||'（補助科目なし）')+' / '+subMoney(r.balance)+' 円'},r.name)),
   error&&jsx('small',{className:'alert',children:error}),
   jsx('small',{children:'* で前方・後方・部分一致検索。候補がなくても自由入力できます。'})
  ]})
 ]});
}
function SubaccountWorkspace({s,start,end}) {
 const [account,setAccount]=useState(s.accounts[0]?.id||''),[search,setSearch]=useState(''),[all,setAll]=useState(false),[data,setData]=useState(null),[name,setName]=useState(null),[ledgerData,setLedgerData]=useState(null),[offset,setOffset]=useState(0),[error,setError]=useState('');
 useEffect(()=>{setName(null);setOffset(0);},[account,start,end,s.company.id]);
 useEffect(()=>{
  setData(null);setLedgerData(null);setError('');const c=new AbortController();
  const timer=setTimeout(async()=>{try{
   const p=new URLSearchParams({company:s.company.id,account,start,end,view:name===null?'subaccount-balances':'subaccount-ledger',search:search?'*'+search+'*':'',all:String(all),name:name||'',offset:String(offset)});
   const r=await fetch('/api/accounting?'+p,{signal:c.signal});const d=await r.json();if(!r.ok)throw new Error(d.error);if(name===null)setData(d);else setLedgerData(d);
  }catch(e){if(e.name!=='AbortError')setError(e.message);}},250);return()=>{clearTimeout(timer);c.abort();};
 },[account,start,end,s.company.id,s.company.version,search,all,name,offset]);
 return jsxs('section',{className:'panel subaccount-report',children:[
  jsx('h2',{children:name===null?'補助科目別残高':'補助元帳'}),
  jsx('p',{className:'muted',children:'補助科目は仕訳明細の自由入力で使用できます。旧マスタのデータは保持しています。残高は科目の通常残高方向で表示します。期首差額・繰越損益の補助未配分分は「補助科目なし」に含みます。'}),
  jsxs('div',{className:'filters',children:[jsx('select',{'aria-label':'勘定科目',value:account,onChange:e=>{setAccount(e.target.value);setOffset(0);},children:s.accounts.map(a=>jsx('option',{value:a.id,children:a.account_code+' '+a.account_name},a.id))}),jsx('input',{'aria-label':'補助科目名の部分一致検索',placeholder:'補助科目名の部分一致検索',value:search,onChange:e=>{setSearch(e.target.value);setName(null);setOffset(0);}}),jsxs('label',{children:[jsx('input',{type:'checkbox',checked:all,onChange:e=>{setAll(e.target.checked);setOffset(0);}}),'全件表示（残高ゼロを含む）']})]}),
  error&&jsx('p',{className:'alert',children:error}),
  data&&jsxs(Fragment,{children:[jsx('p',{children:'勘定科目残高（全補助・空白合計）：'+subMoney(data.total)+' 円'}),jsx('table',{children:jsxs(Fragment,{children:[jsx('thead',{children:jsx('tr',{children:['補助科目','期首残高','借方','貸方','残高'].map(h=>jsx('th',{children:h},h))})}),jsx('tbody',{children:data.rows.map(r=>jsx('tr',{children:[jsx('td',{children:jsx('button',{type:'button',onClick:()=>{setName(r.name);setOffset(0);},children:r.name||'（補助科目なし）'})}),...['opening','debit','credit','balance'].map(k=>jsx('td',{children:subMoney(k==='opening'&&data.account.normal_balance==='CREDIT'?String(-BigInt(r[k])):r[k])},k))]},r.name))})]})}),data.has_more&&jsx('p',{children:'次のページに続きます。'}),jsx('button',{type:'button',disabled:offset===0,onClick:()=>setOffset(Math.max(0,offset-50)),children:'前の50件'}),jsx('button',{type:'button',disabled:!data.has_more,onClick:()=>setOffset(offset+50),children:'次の50件'})]}),
  ledgerData&&jsxs(Fragment,{children:[jsx('button',{type:'button',onClick:()=>{setName(null);setOffset(0);},children:'残高一覧へ'}),jsx('h3',{children:ledgerData.account.account_name+' / '+(name||'（補助科目なし）')}),jsx('p',{children:'繰越残高：'+subMoney(ledgerData.opening)+' 円'}),jsx('table',{children:jsxs(Fragment,{children:[jsx('thead',{children:jsx('tr',{children:['仕訳日','仕訳番号','勘定科目','補助科目','摘要','借方','貸方','残高'].map(h=>jsx('th',{children:h},h))})}),jsx('tbody',{children:ledgerData.rows.map(r=>jsx('tr',{children:[r.date,r.number,ledgerData.account.account_name,name||'（補助科目なし）',r.description+(r.line_description?' / '+r.line_description:''),subMoney(r.debit),subMoney(r.credit),subMoney(r.balance)].map((v,i)=>jsx('td',{children:v},i))},r.id))})]})}),jsx('p',{children:'期末残高：'+subMoney(ledgerData.closing)+' 円'}),jsx('button',{type:'button',disabled:offset===0,onClick:()=>setOffset(Math.max(0,offset-200)),children:'前の200件'}),jsx('button',{type:'button',disabled:offset+ledgerData.rows.length>=(ledgerData.rows[0]?.total||0),onClick:()=>setOffset(offset+200),children:'次の200件'})]})
 ]});
}
export {SubaccountInput,SubaccountWorkspace};
