// Sync only the affected source components into the existing dependency bundle.
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
const write=(p,s)=>fs.writeFileSync(p,s);
let bundle=read('public/app.js');
function fn(source,name){const start=source.indexOf('function '+name+'('),end=source.indexOf('\n}\n',start);if(start<0||end<0)throw new Error('Missing function '+name);return source.slice(start,end+2);}
const trans=(runtime,react)=>s=>s.replace(/\b(jsxs|jsx)\(/g,`(0, ${runtime}.$1)(`).replace(/\bFragment\b/g,react+'.Fragment').replace(/\b(useState|useEffect|useMemo)\(/g,`(0, ${react}.$1)(`).replace(/\bHistory\b/g,'RotateCcwClock');
bundle=bundle.replace(fn(bundle,'currentLines'),fn(read('lib/core.js'),'currentLines'));
const balanceFunction=fn(read('lib/core.js'),'journalBalances');
bundle=bundle.includes('function journalBalances(')?bundle.replace(fn(bundle,'journalBalances'),balanceFunction):bundle.replace('function ledger(',balanceFunction+'\nfunction ledger(');
for(const name of ['subaccountName','cleanSubaccount','wildcardLike','oppositeLines'])bundle=bundle.replace(fn(bundle,name),fn(read('lib/subaccounts.js'),name));
for(const [file,names,runtime,react] of [
 ['screen-source/app/csv-import.js',['CSVImport'],'import_jsx_runtime19','import_react3'],
 ['screen-source/app/tax-ui.js',['editorLines','TaxLineEditor'],'import_jsx_runtime24','import_react7'],
 ['screen-source/app/subaccount-ui.js',['SubaccountInput','SubaccountWorkspace'],'import_jsx_runtime31','import_react8'],
 ['screen-source/app/accounting-app.js',['AccountingApp'],'import_jsx_runtime31','import_react8']
])for(const name of names){
 let code=trans(runtime,react)(fn(read(file),name));
 if(name==='AccountingApp')for(const [from,to] of Object.entries({money:'money2',Check:'Check2',Checkbox:'Checkbox3',Dialog:'Dialog2',DialogContent:'DialogContent3',DialogTitle:'DialogTitle3',DialogDescription:'DialogDescription3',AlertDialog:'AlertDialog2',AlertDialogContent:'AlertDialogContent3',AlertDialogTitle:'AlertDialogTitle3',AlertDialogDescription:'AlertDialogDescription3',AlertDialogCancel:'AlertDialogCancel3',AlertDialogAction:'AlertDialogAction3'}))code=code.replace(new RegExp('\\b'+from+'\\b','g'),to);
 bundle=bundle.replace(fn(bundle,name),code);
}
write('public/app.js',bundle);
for(const file of ['core.js','numbering.js','subaccounts.js','csv-import.js','csv-transfer.js'])write('screen-source/lib/accounting/'+file,read('lib/'+file));
console.log('Synced auxiliary-account components and shared modules.');
