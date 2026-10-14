import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {subaccountName,oppositeLines} from '../lib/subaccounts.js';
const bundle=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=bundle.indexOf('function SubaccountInput('),end=bundle.indexOf('\n}',start)+2,code=bundle.slice(start,end);
let hooks=[],cursor=0,effects=[],timers=[],patches=[],requests=[];
const jsx=(type,props,key)=>({type,props,key});
const context=vm.createContext({BigInt,URLSearchParams,AbortController,Set,subaccountName,oppositeLines,subMoney:String,
 import_jsx_runtime31:{jsx,jsxs:jsx},import_react8:{useState:init=>{const i=cursor++;if(hooks[i]===undefined)hooks[i]=init;return [hooks[i],v=>{hooks[i]=v;}];},useEffect:fn=>effects.push(fn)},
 setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{},fetch:async url=>{requests.push(new URL(url,'http://localhost'));return {ok:true,json:async()=>({rows:[{name:'残高候補',balance:'200000'}]})};}
});vm.runInContext(code,context);
const s={company:{id:'company-one',version:1},subaccounts:[],accounts:[{id:'target',subaccount_input:'OPTIONAL'},{id:'source',subaccount_assist:'COPY'}]};
const line={account_id:'target',entry_side:'DEBIT',subaccount_name:''},source={account_id:'source',entry_side:'CREDIT',subaccount_name:'A商事'},editor={transaction_date:'2026-10-13',lines:[line,source]};
const render=()=>{cursor=0;effects=[];return context.SubaccountInput({s,editor,line,inputId:0,onChange:p=>{patches.push(p);Object.assign(line,p);}});};
function nodes(tree){const out=[];function walk(n){if(Array.isArray(n))n.forEach(walk);else if(n?.props){out.push(n);walk(n.props.children);}}walk(tree);return out;}
let tree=render();nodes(tree).find(x=>x.type==='input').props.onFocus();tree=render();
assert.equal(patches.length,0);const proposal=nodes(tree).find(x=>x.props.children==='相手明細からの提案：A商事');assert.ok(proposal);proposal.props.onClick();assert.equal(line.subaccount_name,'A商事');
tree=render();nodes(tree).find(x=>x.type==='input').props.onChange({target:{value:'手動変更'}});assert.equal(line.subaccount_name,'手動変更');
tree=render();nodes(tree).find(x=>x.type==='input').props.onFocus();tree=render();assert.ok(!nodes(tree).some(x=>x.props.children==='相手明細からの提案：A商事'));
nodes(tree).find(x=>x.type==='input').props.onChange({target:{value:'*山田*'}});assert.equal(line.subaccount_name,'手動変更');assert.equal(line.subaccount_search,'*山田*');
tree=render();nodes(tree).find(x=>x.type==='input').props.onChange({target:{value:''}});assert.equal(line.subaccount_name,'');assert.equal(line.subaccount_search,'');
editor.lines.push({account_id:'source',entry_side:'CREDIT',subaccount_name:'B商事'});tree=render();assert.equal(nodes(tree).filter(x=>typeof x.props.children==='string'&&x.props.children.startsWith('相手明細からの提案：')).length,2);assert.equal(line.subaccount_name,'');
s.accounts[1].subaccount_assist='NONE';tree=render();assert.ok(!nodes(tree).some(x=>typeof x.props.children==='string'&&x.props.children.startsWith('相手明細からの提案：')));
s.accounts[1].subaccount_assist='BALANCE';tree=render();effects.forEach(fn=>fn());await Promise.all(timers.splice(0).map(fn=>fn()));tree=render();
assert.equal(line.subaccount_name,'');assert.equal(requests.at(-1).searchParams.get('account'),'target');assert.equal(requests.at(-1).searchParams.get('all'),'false');assert.equal(requests.at(-1).searchParams.get('company'),'company-one');assert.equal(requests.at(-1).searchParams.get('end'),'2026-10-13');
nodes(tree).find(x=>x.props.children==='残高候補 / 200000 円').props.onClick();assert.equal(line.subaccount_name,'残高候補');
line.subaccount_name='';s.accounts[0].subaccount_input='NONE';assert.equal(render(),null);
console.log('PASS: shipped browser input, editable/deletable proposals, no manual overwrite, no circular automatic copying, compound candidates, no-assist, balance query scope/date, explicit choice and wildcard/value separation.');
