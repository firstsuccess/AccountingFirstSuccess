// Shared rules; existing master IDs remain readable without rewriting history.
export const inputModes = { NONE: '不要', OPTIONAL: '任意', REQUIRED: '必須' };
export const assistModes = { COPY: '選択した補助科目を相手科目へ提案', BALANCE: '相手科目の残高がある補助科目を提案', NONE: '提案しない' };
export function subaccountName(s, line) {
  return line.subaccount_name ?? s.subaccounts.find(x => x.id === line.subaccount_id && x.account_id === line.account_id)?.name ?? '';
}
export function cleanSubaccount(value) {
  if (typeof value !== 'string') throw new Error('補助科目名は文字列で指定してください');
  const name = value.trim();
  if (name.length > 300 || name.includes('*')) throw new Error('補助科目名は300文字以内です。検索条件の * は保存できません');
  return name;
}
export function wildcardLike(pattern) {
  if (typeof pattern !== 'string' || pattern.length > 300) throw new Error('検索条件は300文字以内です');
  return pattern.replace(/[~%_\[]/g, c => '~' + c).replaceAll('*', '%');
}
export function oppositeLines(lines, source) {
  const side = source.entry_side || (source.credit_amount ? 'CREDIT' : 'DEBIT');
  return lines.map((line, index) => ({ line, index })).filter(x => x.line !== source && x.line.account_id && (x.line.entry_side || (x.line.credit_amount ? 'CREDIT' : 'DEBIT')) !== side);
}
