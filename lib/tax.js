const taxTypes = { SALES: "\u8AB2\u7A0E\u58F2\u4E0A", PURCHASE: "\u8AB2\u7A0E\u4ED5\u5165", EXEMPT: "\u975E\u8AB2\u7A0E", NON_TAXABLE: "\u4E0D\u8AB2\u7A0E", OUT: "\u5BFE\u8C61\u5916" };
const roundingNames = { FLOOR: "\u5207\u6368\u3066", ROUND: "\u56DB\u6368\u4E94\u5165", CEIL: "\u5207\u4E0A\u3052" };
function yen(v) {
  if (!(typeof v === "number" && Number.isSafeInteger(v) || typeof v === "string" && /^\d+$/.test(v))) throw new Error("\u91D1\u984D\u306F\u6574\u6570\u5186\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
  const n = BigInt(v);
  if (n < 0n || n > 999999999999n) throw new Error("\u91D1\u984D\u306F0\u301C999,999,999,999\u5186\u3067\u3059");
  return Number(n);
}
function rateBps(v) {
  const str = String(v);
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(str)) throw new Error("\u7A0E\u7387\u306F0\u301C100%\u3001\u5C0F\u6570\u70B9\u4EE5\u4E0B2\u6841\u4EE5\u5185\u3067\u3059");
  const [a, b = ""] = str.split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (n > 1e4) throw new Error("\u7A0E\u7387\u306F100%\u4EE5\u5185\u3067\u3059");
  return n;
}
function round(n, d, mode) {
  if (!roundingNames[mode]) throw new Error("\u7AEF\u6570\u51E6\u7406\u65B9\u5F0F\u304C\u4E0D\u6B63\u3067\u3059");
  return mode === "CEIL" ? (n + d - 1n) / d : mode === "ROUND" ? (n * 2n + d) / (d * 2n) : n / d;
}
function calculateTax(value, inputType, tax, rounding = "FLOOR", override = "", adjustReason = "") {
  const input = yen(value);
  if (!["NET", "GROSS"].includes(inputType)) throw new Error("\u5165\u529B\u65B9\u5F0F\u306F\u7A0E\u629C\u307E\u305F\u306F\u7A0E\u8FBC\u3067\u3059");
  if (!tax || tax.tax_code === "UNSPECIFIED") return { tax_status: "UNSET", tax_code: "UNSPECIFIED", tax_type: null, tax_rate: null, taxable_amount: null, tax_amount: null, gross_amount: null, amount_input_type: inputType, input_amount: input, calculated_tax_amount: null, tax_adjustment_reason: null, rounding_method: null };
  const bps = rateBps(tax.tax_rate), charged = ["SALES", "PURCHASE"].includes(tax.tax_type);
  const calculated = charged ? Number(round(BigInt(input) * BigInt(bps), BigInt(inputType === "NET" ? 1e4 : 1e4 + bps), rounding)) : 0;
  const adjusted = override !== "" && override !== void 0 && override !== null;
  const taxAmount = adjusted ? yen(override) : calculated;
  if (!charged && taxAmount !== 0) throw new Error("\u975E\u8AB2\u7A0E\u30FB\u4E0D\u8AB2\u7A0E\u30FB\u5BFE\u8C61\u5916\u306E\u7A0E\u984D\u306F0\u5186\u3067\u3059");
  if (taxAmount !== calculated && (!adjustReason.trim() || adjustReason.length > 300)) throw new Error("\u7A0E\u984D\u8ABF\u6574\u7406\u7531\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
  const net = inputType === "GROSS" ? input - taxAmount : input, gross = inputType === "GROSS" ? input : input + taxAmount;
  if (net < 0 || gross > 999999999999) throw new Error("\u7A0E\u984D\u30FB\u7A0E\u8FBC\u91D1\u984D\u304C\u8A31\u5BB9\u7BC4\u56F2\u5916\u3067\u3059");
  return { tax_status: "SET", tax_code: tax.tax_code, tax_name: tax.tax_name, tax_type: tax.tax_type, tax_rate: String(tax.tax_rate), taxable_amount: net, tax_amount: taxAmount, gross_amount: gross, amount_input_type: inputType, input_amount: input, calculated_tax_amount: calculated, tax_adjustment_reason: taxAmount !== calculated ? adjustReason.trim() : null, rounding_method: rounding };
}
function initialTaxCodes() {
  return [["SALE10", "\u8AB2\u7A0E\u58F2\u4E0A10%", "SALES", "10"], ["SALE8", "\u8AB2\u7A0E\u58F2\u4E0A8%", "SALES", "8"], ["BUY10", "\u8AB2\u7A0E\u4ED5\u516510%", "PURCHASE", "10"], ["BUY8", "\u8AB2\u7A0E\u4ED5\u51658%", "PURCHASE", "8"], ["EXEMPT", "\u975E\u8AB2\u7A0E", "EXEMPT", "0"], ["NON_TAXABLE", "\u4E0D\u8AB2\u7A0E", "NON_TAXABLE", "0"], ["OUT", "\u5BFE\u8C61\u5916", "OUT", "0"]].map(([tax_code, tax_name, tax_type, tax_rate]) => ({ id: crypto.randomUUID(), tax_code, tax_name, tax_type, tax_rate, effective_from: ["SALES", "PURCHASE"].includes(tax_type) ? "2019-10-01" : "1900-01-01", effective_to: null, active: true }));
}
function expandTaxLines(s, inputs, transactionDate, previous = [], previousDate) {
  const out = [];
  for (const l of inputs) {
    if (l.is_tax_line) throw new Error("\u81EA\u52D5\u7A0E\u660E\u7D30\u3092\u76F4\u63A5\u5165\u529B\u3057\u306A\u3044\u3067\u304F\u3060\u3055\u3044");
    const debit = yen(l.debit_amount || 0), credit = yen(l.credit_amount || 0);
    if (!(debit > 0 && credit === 0 || credit > 0 && debit === 0)) throw new Error("\u5404\u660E\u7D30\u306F\u501F\u65B9\u307E\u305F\u306F\u8CB8\u65B9\u306E\u7247\u5074\u3060\u3051\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
    const side = debit ? "DEBIT" : "CREDIT", input = debit || credit;
    const code = l.tax_code || "UNSPECIFIED", mode = l.amount_input_type || "NET";
    const original = previous.find((p) => p.id === l.original_line_id && !p.is_tax_line);
    const same = original && previousDate === transactionDate && original.account_id === l.account_id && original.tax_code === code && (original.amount_input_type || "NET") === mode && (original.input_amount ?? (original.debit_amount || original.credit_amount)) === input && (original.entry_side || (original.debit_amount ? "DEBIT" : "CREDIT")) === side && String(l.tax_override ?? "") === String(original.tax_amount !== original.calculated_tax_amount ? original.tax_amount : "") && (l.tax_adjustment_reason || "") === (original.tax_adjustment_reason || "");
    let snapshot;
    if (same && original.tax_status === "SET") {
      snapshot = Object.fromEntries(taxFields.map((k) => [k, original[k]]));
    } else {
      const tax = s.tax_codes.find((t) => t.tax_code === code);
      if (code !== "UNSPECIFIED" && (!tax || !tax.active || tax.effective_from > transactionDate || tax.effective_to && tax.effective_to < transactionDate)) throw new Error("\u7A0E\u533A\u5206\u304C\u7121\u52B9\u3001\u307E\u305F\u306F\u53D6\u5F15\u65E5\u304C\u9069\u7528\u671F\u9593\u5916\u3067\u3059");
      snapshot = calculateTax(input, mode, tax, s.company.tax_rounding || "FLOOR", l.tax_override, l.tax_adjustment_reason || "");
    }
    const account = s.accounts.find((a) => a.id === l.account_id);
    if (snapshot.tax_type === "SALES" && account?.account_type !== "REVENUE") throw new Error("\u8AB2\u7A0E\u58F2\u4E0A\u306F\u53CE\u76CA\u79D1\u76EE\u306B\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    if (snapshot.tax_type === "PURCHASE" && !["ASSET", "EXPENSE"].includes(account?.account_type)) throw new Error("\u8AB2\u7A0E\u4ED5\u5165\u306F\u8CC7\u7523\u30FB\u8CBB\u7528\u79D1\u76EE\u306B\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    if (Object.values(s.company.tax_accounts || {}).includes(l.account_id) && ["SALES", "PURCHASE"].includes(snapshot.tax_type)) throw new Error("\u6D88\u8CBB\u7A0E\u52D8\u5B9A\u3078\u306E\u4E8C\u91CD\u8AB2\u7A0E\u306F\u3067\u304D\u307E\u305B\u3093");
    const id = crypto.randomUUID(), net = snapshot.tax_status === "SET" ? snapshot.taxable_amount : input;
    out.push({ ...l, ...snapshot, id, is_tax_line: false, tax_source_line_id: null, entry_side: side, debit_amount: side === "DEBIT" ? net : 0, credit_amount: side === "CREDIT" ? net : 0 });
    if (snapshot.tax_amount > 0) {
      const key = snapshot.tax_type === "SALES" ? "output" : "input";
      const target = s.company.tax_accounts?.[key];
      if (!target || !s.accounts.some((a) => a.id === target && a.active && a.statement_type === "BS")) throw new Error("\u6D88\u8CBB\u7A0E\u8A2D\u5B9A\u3067\u4EEE\u6255\u30FB\u4EEE\u53D7\u79D1\u76EE\u3092\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044");
      out.push({ id: crypto.randomUUID(), account_id: target, subaccount_id: null, debit_amount: side === "DEBIT" ? snapshot.tax_amount : 0, credit_amount: side === "CREDIT" ? snapshot.tax_amount : 0, line_description: `${snapshot.tax_name} \u81EA\u52D5\u7A0E\u660E\u7D30`, is_tax_line: true, tax_source_line_id: id, tax_status: "GENERATED", tax_code: "OUT", tax_type: "OUT", tax_rate: "0", taxable_amount: null, tax_amount: null, gross_amount: null, amount_input_type: null, input_amount: null, calculated_tax_amount: null, tax_adjustment_reason: null, rounding_method: null });
    }
  }
  return out;
}
const taxFields = ["tax_status", "tax_code", "tax_name", "tax_type", "tax_rate", "taxable_amount", "tax_amount", "gross_amount", "amount_input_type", "input_amount", "calculated_tax_amount", "tax_adjustment_reason", "rounding_method"];
function taxReport(s, start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw new Error("\u671F\u9593\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
  const headers = new Map(s.journals.filter((j) => j.status === "ACTIVE" && j.transaction_date <= end).map((j) => [j.id, j]));
  const all = s.lines.filter((l) => headers.get(l.journal_id)?.revision === l.revision).map((l) => ({ ...l, date: headers.get(l.journal_id).transaction_date }));
  const period = all.filter((l) => l.date >= start && headers.get(l.journal_id)?.journal_kind !== "OPENING");
  const groups = /* @__PURE__ */ new Map();
  let unknown = 0;
  const snapshot = { input: 0n, output: 0n };
  for (const l of period) {
    if (l.is_tax_line) continue;
    if (l.tax_status !== "SET") {
      unknown++;
      continue;
    }
    const key = `${l.tax_code}|${l.tax_rate}|${l.tax_type}`;
    if (!groups.has(key)) groups.set(key, { tax_code: l.tax_code, tax_name: l.tax_name, tax_type: l.tax_type, tax_rate: l.tax_rate, taxable_amount: 0n, tax_amount: 0n, gross_amount: 0n, count: 0, journals: /* @__PURE__ */ new Set() });
    const g = groups.get(key);
    const a = s.accounts.find((a2) => a2.id === l.account_id);
    const creditNormal = l.tax_type === "SALES" || !["PURCHASE"].includes(l.tax_type) && ["REVENUE", "LIABILITY", "EQUITY"].includes(a?.account_type);
    const sign = (creditNormal ? l.entry_side ? l.entry_side === "CREDIT" : l.credit_amount > 0 : l.entry_side ? l.entry_side === "DEBIT" : l.debit_amount > 0) ? 1n : -1n;
    for (const k of ["taxable_amount", "tax_amount", "gross_amount"]) g[k] += sign * BigInt(l[k]);
    g.count++;
    g.journals.add(l.journal_id);
    if (l.tax_type === "SALES") snapshot.output += sign * BigInt(l.tax_amount);
    if (l.tax_type === "PURCHASE") snapshot.input += sign * BigInt(l.tax_amount);
  }
  const balances = {};
  for (const key of ["input", "output", "payable"]) {
    const aid = s.company.tax_accounts?.[key], normal = key === "input" ? 1n : -1n;
    const lines = all.filter((l) => l.account_id === aid), flow = (xs) => xs.reduce((n, l) => n + (BigInt(l.debit_amount) - BigInt(l.credit_amount)) * normal, 0n);
    const isOpening = (l) => headers.get(l.journal_id)?.journal_kind === "OPENING";
    const inPeriod = lines.filter((l) => l.date >= start && !isOpening(l)), opening = flow(lines.filter((l) => l.date < start || isOpening(l) && l.date === start)), movement = flow(inPeriod), manual = flow(inPeriod.filter((l) => !l.is_tax_line)), expected = key === "payable" ? 0n : snapshot[key];
    balances[key] = { opening: String(opening), movement: String(movement), closing: String(opening + movement), snapshot: String(expected), manual: String(manual), difference: String(movement - expected), unexplained: String(movement - expected - manual) };
  }
  return { rows: [...groups.values()].map((g) => ({ ...g, taxable_amount: String(g.taxable_amount), tax_amount: String(g.tax_amount), gross_amount: String(g.gross_amount), journal_count: g.journals.size, journals: void 0 })), unknown, balances, net_balance: String(BigInt(balances.output.closing) - BigInt(balances.input.closing)) };
}
export {
  calculateTax,
  expandTaxLines,
  initialTaxCodes,
  rateBps,
  roundingNames,
  taxFields,
  taxReport,
  taxTypes,
  yen
};
