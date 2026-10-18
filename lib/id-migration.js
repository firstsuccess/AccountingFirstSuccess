import {sequentialCode,numberLines} from './numbering.js';

// Pure migration plan. Operational IDs and every historical reference are remapped together.
export function planIdMigration(before,newCompanyId) {
  if(!/^C\d{9}$/.test(newCompanyId)||newCompanyId==='C000000000')throw new Error('移行先会社IDが不正です');
  const after=structuredClone(before),oldCompanyId=before.company.id;
  if(oldCompanyId===newCompanyId)throw new Error('既に移行済みです');
  const journalNumbers=new Map(),used=new Set();
  const ordered=[...before.journals].sort((a,b)=>a.journal_number.localeCompare(b.journal_number,'en',{numeric:true})||a.id.localeCompare(b.id));
  for(const j of ordered) {
    const match=/^(?:J)?(\d{1,10})$/.exec(j.journal_number),n=match?Number(match[1]):0;
    if(n>0&&n<=999999999){const code=sequentialCode('J',n);if(!used.has(code)){used.add(code);journalNumbers.set(j.id,code);}}
  }
  let next=1;
  for(const j of ordered)if(!journalNumbers.has(j.id)){while(used.has(sequentialCode('J',next)))next++;const code=sequentialCode('J',next++);used.add(code);journalNumbers.set(j.id,code);}
  const lineIds=new Map(),ordinals=new Map();
  for(const j of before.journals){
    const revisions=[...new Set(before.lines.filter(l=>l.journal_id===j.id).map(l=>l.revision))];
    for(const revision of revisions){
      // Existing explicit order wins. Legacy rows are supplied in physical ID order by the runner.
      const lines=before.lines.filter(l=>l.journal_id===j.id&&l.revision===revision).sort((a,b)=>(a.line_number||0)-(b.line_number||0));
      const numbered=numberLines(lines,newCompanyId,journalNumbers.get(j.id),revision);
      lines.forEach((l,i)=>{lineIds.set(l.id,numbered[i].id);ordinals.set(l.id,i+1);});
    }
  }
  if(lineIds.size!==before.lines.length||new Set(lineIds.values()).size!==lineIds.size)throw new Error('孤立明細または移行IDの重複があります');
  function remap(value){
    if(typeof value==='string')return value===oldCompanyId?newCompanyId:lineIds.get(value)||value;
    if(Array.isArray(value))return value.map(remap);
    if(!value||typeof value!=='object')return value;
    const result=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,remap(item)]));
    const journalId=typeof value.id==='string'&&journalNumbers.has(value.id)?value.id:null;
    if(journalId&&Object.hasOwn(value,'journal_number'))result.journal_number=journalNumbers.get(journalId);
    if(lineIds.has(value.id))result.line_number=ordinals.get(value.id);
    return result;
  }
  const result=remap(after);
  result.company.legacy_id=oldCompanyId;
  result.company.version=before.company.version+1;
  result.company.next_number=Math.max(1,...[...used].map(code=>Number(code.slice(1))+1));
  for(const j of result.journals)j.legacy_journal_number=before.journals.find(old=>old.id===j.id).journal_number;
  for(let i=0;i<result.lines.length;i++)result.lines[i].legacy_line_id=before.lines[i].id;
  result.audit.push({id:crypto.randomUUID(),event_type:'IDENTIFIER_MIGRATION',target_type:'company',target_id:newCompanyId,user:before.company.owner,timestamp:new Date().toISOString(),before:{company_id:oldCompanyId},after:{company_id:newCompanyId,journals:Object.fromEntries(journalNumbers),lines:Object.fromEntries(lineIds)},reason:'会社・伝票・版・行番号の識別子へ移行。金額・日付・状態は保持'});
  return {after:result,journalNumbers,lineIds};
}
