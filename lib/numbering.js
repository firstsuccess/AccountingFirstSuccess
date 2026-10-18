// Human-readable identifiers use a fixed prefix and nine decimal digits.
export function sequentialCode(prefix, value) {
  if (!['J','C'].includes(prefix) || !Number.isSafeInteger(value) || value < 1 || value > 999999999) throw new Error('採番上限または採番値が不正です');
  return prefix + String(value).padStart(9,'0');
}
export function assignCompanyId(state, newId) {
  if (!/^C\d{9}$/.test(newId) || newId === 'C000000000') throw new Error('会社IDが不正です');
  const previous=state.company.id;
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (['id','company_id','target_id'].includes(key) && item===previous) value[key]=newId;
      else if (['id','target_id','tax_source_line_id','original_line_id'].includes(key) && typeof item==='string' && item.startsWith(previous+'-')) value[key]=newId+item.slice(previous.length);
      else visit(item);
    }
  }
  visit(state);
  return state;
}
export function lineIdentifier(companyId,journalNumber,revision,row) {
  if (!Number.isSafeInteger(revision) || revision<1 || revision>99999 || !Number.isSafeInteger(row) || row<1 || row>99999) throw new Error('明細の版番号または行番号が採番上限を超えています');
  const id=`${companyId}-${journalNumber}-R${String(revision).padStart(5,'0')}-${String(row).padStart(5,'0')}`;
  if (id.length>64) throw new Error('会社IDと伝票番号を含む明細IDが64文字を超えています');
  return id;
}
export function numberLines(lines,companyId,journalNumber,revision) {
  const ids=new Map(lines.map((l,i)=>[l.id,lineIdentifier(companyId,journalNumber,revision,i+1)]));
  return lines.map((l,i)=>({...l,id:ids.get(l.id),line_number:i+1,tax_source_line_id:l.tax_source_line_id?ids.get(l.tax_source_line_id)||l.tax_source_line_id:null}));
}
