import { assert, currentLines, mutate, date } from "./core.js";
import { rateBps, yen } from "./tax.js";
function parseJournalCSV(text) {
  assert(typeof text === "string" && text.length <= 5e6, "CSV\u306F5MB\u4EE5\u5185\u3067\u3059");
  const records = [];
  let row = [], cell = "", quoted = false, ended = false;
  text = text.replace(/^\uFEFF/, "");
  const finishCell = () => {
    row.push(cell);
    cell = "";
    ended = false;
  };
  const finishRow = () => {
    finishCell();
    if (row.some((x) => x !== "")) records.push(row);
    row = [];
    assert(records.length <= 1001, "1\u56DE\u306E\u53D6\u8FBC\u306F\u660E\u7D301000\u884C\u307E\u3067\u3067\u3059");
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          ended = true;
        }
      } else cell += ch;
    } else if (ch === ",") finishCell();
    else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      finishRow();
    } else {
      assert(!ended, "CSV\u306E\u5F15\u7528\u7B26\u306E\u5F8C\u306B\u4E0D\u6B63\u306A\u6587\u5B57\u304C\u3042\u308A\u307E\u3059");
      if (ch === '"') {
        assert(cell === "", "CSV\u306E\u5F15\u7528\u7B26\u304C\u4E0D\u6B63\u3067\u3059");
        quoted = true;
      } else cell += ch;
    }
  }
  assert(!quoted, "CSV\u306E\u5F15\u7528\u7B26\u304C\u9589\u3058\u3066\u3044\u307E\u305B\u3093");
  if (cell || row.length || ended) finishRow();
  const headers = records.shift();
  assert(headers && records.length, "\u30D8\u30C3\u30C0\u30FC\u3068\u4ED5\u8A33\u660E\u7D30\u304C\u5FC5\u8981\u3067\u3059");
  assert(headers.every((h) => /^[a-z_]+$/.test(h)) && new Set(headers).size === headers.length, "\u5217\u540D\u304C\u4E0D\u6B63\u3001\u307E\u305F\u306F\u91CD\u8907\u3057\u3066\u3044\u307E\u3059");
  for (const h of ["company_id", "journal_number", "transaction_date", "description", "account_code", "debit_amount", "credit_amount"]) assert(headers.includes(h), `\u5FC5\u9808\u5217\u304C\u3042\u308A\u307E\u305B\u3093\uFF1A${h}`);
  return records.map((values, i) => {
    assert(values.length === headers.length, `CSV ${i + 2}\u884C\u76EE\u306E\u5217\u6570\u304C\u4E0D\u6B63\u3067\u3059`);
    const r = /* @__PURE__ */ Object.create(null);
    headers.forEach((h, k) => {
      r[h] = values[k].replace(/^'(?=[=+\-@\t\r'])/, "");
    });
    r.csv_row = i + 2;
    return r;
  });
}
function integer(value, label) {
  assert(/^\d+$/.test(value), `${label}\u306F\u6574\u6570\u5186\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044`);
  return yen(value);
}
function inputLine(s, r) {
  assert(!r.is_tax_line || r.is_tax_line === "false", "\u81EA\u52D5\u7A0E\u660E\u7D30\u306F\u53D6\u8FBC\u3067\u304D\u307E\u305B\u3093\u3002\u518D\u53D6\u8FBC\u7528\u4ED5\u8A33CSV\u3092\u4F7F\u7528\u3057\u3066\u304F\u3060\u3055\u3044");
  assert(!r.journal_status || r.journal_status === "ACTIVE", "\u524A\u9664\u6E08\u307F\u4ED5\u8A33\u306F\u53D6\u8FBC\u3067\u304D\u307E\u305B\u3093");
  const a = s.accounts.find((a2) => a2.account_code === r.account_code);
  assert(a?.active, `\u6709\u52B9\u306A\u52D8\u5B9A\u79D1\u76EE\u304C\u3042\u308A\u307E\u305B\u3093\uFF1A${r.account_code}`);
  let sub = r.subaccount_id ? s.subaccounts.find((x) => x.id === r.subaccount_id) : void 0;
  assert(!r.subaccount_id || sub?.active && sub.account_id === a.id, "補助科目IDの所属・有効状態が不正です");
  const d = integer(r.debit_amount || "0", "\u501F\u65B9\u91D1\u984D"), c = integer(r.credit_amount || "0", "\u8CB8\u65B9\u91D1\u984D");
  assert(!(d && c), "\u501F\u65B9\u30FB\u8CB8\u65B9\u306E\u4E21\u5074\u306B\u91D1\u984D\u304C\u3042\u308A\u307E\u3059");
  const side = r.entry_side || (d ? "DEBIT" : c ? "CREDIT" : "");
  assert(["DEBIT", "CREDIT"].includes(side) && !(side === "DEBIT" ? c : d), "\u8CB8\u501F\u533A\u5206\u304C\u4E0D\u6B63\u3067\u3059");
  const input = integer(r.input_amount || String(d || c), "\u5165\u529B\u91D1\u984D");
  assert(input > 0, "\u5165\u529B\u91D1\u984D\u306F1\u5186\u4EE5\u4E0A\u3067\u3059");
  const code = r.tax_code || "UNSPECIFIED", known = code !== "UNSPECIFIED";
  assert(!r.tax_status || r.tax_status === (known ? "SET" : "UNSET"), "\u7A0E\u60C5\u5831\u306E\u8A2D\u5B9A\u72B6\u614B\u304C\u4E0D\u6B63\u3067\u3059");
  for (const key of ["tax_rate", "taxable_amount", "tax_amount", "gross_amount"]) assert(known ? r[key] !== void 0 && r[key] !== "" : !r[key], known ? `\u7A0E\u533A\u5206\u6307\u5B9A\u6642\u306F${key}\u304C\u5FC5\u8981\u3067\u3059` : "\u7A0E\u60C5\u5831\u672A\u8A2D\u5B9A\u306B\u306F\u7A0E\u7387\u30FB\u7A0E\u984D\u3092\u6307\u5B9A\u3067\u304D\u307E\u305B\u3093");
  if (known) {
    assert(s.tax_codes.some((t) => t.tax_code === code), "\u7A0E\u533A\u5206\u304C\u5B58\u5728\u3057\u307E\u305B\u3093");
    rateBps(r.tax_rate);
    assert(BigInt(integer(r.taxable_amount, "\u7A0E\u629C\u91D1\u984D")) + BigInt(integer(r.tax_amount, "\u7A0E\u984D")) === BigInt(integer(r.gross_amount, "\u7A0E\u8FBC\u91D1\u984D")), "\u7A0E\u8FBC\u91D1\u984D\u3068\u672C\u4F53\u91D1\u984D\uFF0B\u7A0E\u984D\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093");
  }
  const adjusted = known && r.calculated_tax_amount !== void 0 && r.calculated_tax_amount !== "" && integer(r.calculated_tax_amount, "\u8A08\u7B97\u7A0E\u984D") !== integer(r.tax_amount, "\u7A0E\u984D");
  return { account_id: a.id, subaccount_id: sub?.id || null, subaccount_name: r.subaccount_name ?? sub?.name ?? "", debit_amount: side === "DEBIT" ? input : 0, credit_amount: side === "CREDIT" ? input : 0, amount_input_type: r.amount_input_type || "NET", tax_code: code, line_description: r.line_description || "", original_line_id: r.line_id || void 0, tax_override: adjusted || known && r.tax_adjustment_reason ? r.tax_amount : "", tax_adjustment_reason: r.tax_adjustment_reason || "" };
}
function normalizeCSVDate(value) {
  const match=/^(\d{4})([-/])(\d{1,2})\2(\d{1,2})$/.exec(String(value || '').trim());
  assert(match,'日付が正しくありません（YYYY-M-D または YYYY/M/Dで指定してください）');
  return date(`${match[1]}-${match[3].padStart(2,'0')}-${match[4].padStart(2,'0')}`);
}
function prepareImport(before, text, user, reason, filename) {
  assert(before.company.owner === user, "\u4F1A\u793E\u3078\u306E\u30A2\u30AF\u30BB\u30B9\u6A29\u304C\u3042\u308A\u307E\u305B\u3093");
  assert(typeof reason === "string" && reason.trim() && reason.length <= 300, "\u53D6\u8FBC\u7406\u7531\u306F1\u301C300\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
  assert(typeof filename === "string" && filename.length <= 200, "\u30D5\u30A1\u30A4\u30EB\u540D\u304C\u4E0D\u6B63\u3067\u3059");
  const rows = parseJournalCSV(text), groups = /* @__PURE__ */ new Map();
  for (const r of rows) {
    assert(r.company_id === before.company.id && (!r.company_name || r.company_name === before.company.name), `CSV ${r.csv_row}\u884C\u76EE\u306E\u4F1A\u793E\u304C\u9078\u629E\u4E2D\u306E\u4F1A\u793E\u3068\u7570\u306A\u308A\u307E\u3059`);
    assert(!r.journal_number || /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(r.journal_number), `CSV ${r.csv_row}\u884C\u76EE\u306E\u4F1D\u7968\u756A\u53F7\u304C\u4E0D\u6B63\u3067\u3059`);
    assert(r.journal_number || r.import_group && r.import_group.length <= 100, `CSV ${r.csv_row}\u884C\u76EE\uFF1A\u4F1D\u7968\u756A\u53F7\u306A\u3057\u306E\u5834\u5408\u306Fimport_group\u304C\u5FC5\u8981\u3067\u3059`);
    const key = r.journal_number ? `number:${r.journal_number}` : `group:${r.import_group}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  assert(groups.size <= 500, "1\u56DE\u306E\u53D6\u8FBC\u306F500\u4F1D\u7968\u307E\u3067\u3067\u3059");
  let s = before;
  const summary = [];
  const ordered = [...groups.values()].sort((a, b) => Number(!a[0].journal_number) - Number(!b[0].journal_number));
  for (const rs of ordered) {
    const r = rs[0];
    try {
      for (const line of rs) line.transaction_date=normalizeCSVDate(line.transaction_date);
      for (const l of rs) for (const key of ["transaction_date", "description", "counterparty", "journal_kind"]) assert((l[key] || "") === (r[key] || ""), `\u540C\u4E00\u4F1D\u7968\u306E${key}\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093`);
      assert(r.description && r.description.length <= 300 && (!r.counterparty || r.counterparty.length <= 300), "\u6458\u8981\u30FB\u53D6\u5F15\u5148\u306F300\u6587\u5B57\u4EE5\u5185\u3067\u3059\u3002\u6458\u8981\u306F\u5FC5\u9808\u3067\u3059");
      const old = r.journal_number ? before.journals.find((j2) => j2.journal_number === r.journal_number) : void 0;
      assert(!old || old.status === "ACTIVE", "DELETED\u4F1D\u7968\u306F\u4E0A\u66F8\u304D\u30FB\u5FA9\u6D3B\u3067\u304D\u307E\u305B\u3093");
      const lines = rs.map((l) => {
        assert(!l.line_description || l.line_description.length <= 300, "\u660E\u7D30\u6458\u8981\u306F300\u6587\u5B57\u4EE5\u5185\u3067\u3059");
        return inputLine(s, l);
      });
      const next = mutate(s, { type: "journal", id: old?.id, import_number: r.journal_number || void 0, transaction_date: r.transaction_date, description: r.description, counterparty: r.counterparty, journal_kind: r.journal_kind || "STANDARD", lines, reason: reason.trim() }, user);
      const j = old ? next.journals.find((j2) => j2.id === old.id) : next.journals.at(-1);
      const all = currentLines(next, j), sources = all.filter((l) => !l.is_tax_line);
      rs.forEach((l, i) => {
        const saved = sources[i];
        assert(saved.debit_amount === integer(l.debit_amount || "0", "\u501F\u65B9\u91D1\u984D") && saved.credit_amount === integer(l.credit_amount || "0", "\u8CB8\u65B9\u91D1\u984D"), `CSV ${l.csv_row}\u884C\u76EE\uFF1A\u501F\u65B9\u30FB\u8CB8\u65B9\u306B\u306F\u5206\u89E3\u5F8C\u306E\u672C\u4F53\u91D1\u984D\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044`);
        if (saved.tax_status === "SET") {
          assert(rateBps(l.tax_rate) === rateBps(saved.tax_rate), `CSV ${l.csv_row}\u884C\u76EE\uFF1A\u7A0E\u7387\u304C\u78BA\u5B9A\u6642\u306E\u7A0E\u533A\u5206\u3068\u4E00\u81F4\u3057\u307E\u305B\u3093`);
          for (const key of ["taxable_amount", "tax_amount", "gross_amount", "calculated_tax_amount"]) if (l[key] !== void 0 && l[key] !== "") assert(integer(l[key], key) === saved[key], `CSV ${l.csv_row}\u884C\u76EE\uFF1A${key}\u304C\u8A08\u7B97\u7D50\u679C\u3068\u4E0D\u4E00\u81F4\u3067\u3059\u3002\u7AEF\u6570\u8ABF\u6574\u6642\u306F\u8ABF\u6574\u7406\u7531\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044`);
          assert(!l.rounding_method || l.rounding_method === saved.rounding_method, "\u7AEF\u6570\u51E6\u7406\u65B9\u5F0F\u304C\u4FDD\u5B58\u5024\u30FB\u8A2D\u5B9A\u3068\u4E00\u81F4\u3057\u307E\u305B\u3093");
        }
      });
      const beforeRecord = old ? { header: old, lines: currentLines(before, old) } : null;
      next.audit.push({ id: crypto.randomUUID(), event_type: old ? "CSV_OVERWRITE" : "CSV_CREATE", target_type: "journals", target_id: j.id, user, timestamp: (/* @__PURE__ */ new Date()).toISOString(), before: beforeRecord, after: { header: j, lines: all, filename }, reason: reason.trim() });
      const total = all.reduce((n, l) => n + BigInt(l.debit_amount), 0n).toString();
      summary.push({ journal_number: j.journal_number, action: old ? "\u4E0A\u66F8\u304D" : "\u65B0\u898F", transaction_date: j.transaction_date, description: j.description, old_lines: old ? currentLines(before, old).length : 0, new_lines: all.length, debit: total, credit: total, lines: all.map((l) => ({ account: s.accounts.find((a) => a.id === l.account_id)?.account_name, description: l.line_description, debit: l.debit_amount, credit: l.credit_amount, tax_code: l.tax_code, tax_rate: l.tax_rate, input_amount: l.input_amount, tax_amount: l.tax_amount })) });
      s = next;
    } catch (e) {
      throw new Error(`\u4F1D\u7968 ${r.journal_number || r.import_group}\uFF08CSV ${r.csv_row}\u884C\u76EE\u301C\uFF09\uFF1A${e instanceof Error ? e.message : "\u5165\u529B\u30A8\u30E9\u30FC"}`);
    }
  }
  s.company.version = before.company.version + 1;
  return { after: s, summary };
}
export {
  parseJournalCSV,
  prepareImport
};
