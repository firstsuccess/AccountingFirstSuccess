import { currentLines, csvColumns } from "./core.js";
const transferColumns = ["company_id", "company_name", "journal_number", "import_group", "transaction_date", "description", "counterparty", "journal_kind", "line_id", "account_code", "account_name", "subaccount_id", "subaccount_name", "debit_amount", "credit_amount", "entry_side", "amount_input_type", "input_amount", "tax_status", "tax_code", "tax_rate", "taxable_amount", "tax_amount", "gross_amount", "calculated_tax_amount", "tax_adjustment_reason", "rounding_method", "line_description"];
function context(s, j, l) {
  const account = s.accounts.find((a) => a.id === l.account_id);
  const sub = s.subaccounts.find((a) => a.id === l.subaccount_id);
  return { company_id: s.company.id, company_name: s.company.name, journal_number: j.journal_number, transaction_date: j.transaction_date, description: j.description, counterparty: j.counterparty, journal_status: j.status, journal_kind: j.journal_kind || "STANDARD", account_code: account?.account_code, account_name: account?.account_name, subaccount_name: sub?.name || "" };
}
function transferRows(s) {
  return s.journals.filter((j) => j.status === "ACTIVE" && j.journal_kind !== "OPENING").flatMap((j) => currentLines(s, j).filter((l) => !l.is_tax_line).map((l) => ({
    ...l,
    ...context(s, j, l),
    line_id: l.id,
    import_group: j.id,
    entry_side: l.entry_side || (l.debit_amount ? "DEBIT" : "CREDIT"),
    amount_input_type: l.amount_input_type || "NET",
    input_amount: l.input_amount ?? (l.debit_amount || l.credit_amount),
    tax_status: l.tax_status || "UNSET",
    tax_code: l.tax_status === "SET" ? l.tax_code : "UNSPECIFIED"
  })));
}
const backupLineColumns = [.../* @__PURE__ */ new Set(["company_id", "company_name", "journal_number", "transaction_date", "description", "counterparty", "journal_status", "journal_kind", "account_code", "account_name", "subaccount_name", ...csvColumns.lines])];
function backupLineRows(s) {
  return s.lines.map((l) => ({ ...l, ...context(s, s.journals.find((j) => j.id === l.journal_id) || {}, l) }));
}
export {
  backupLineColumns,
  backupLineRows,
  transferColumns,
  transferRows
};
