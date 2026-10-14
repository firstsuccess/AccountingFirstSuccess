import { expandTaxLines, initialTaxCodes, taxFields, rateBps, roundingNames } from "./tax.js";
import {cleanSubaccount,subaccountName,inputModes,assistModes} from './subaccounts.js';
const tables = ["accounts", "subaccounts", "years", "periods", "journals", "lines", "audit", "tax_codes"];
const sections = { CURRENT_ASSET: "\u6D41\u52D5\u8CC7\u7523", FIXED_ASSET: "\u56FA\u5B9A\u8CC7\u7523", CURRENT_LIABILITY: "\u6D41\u52D5\u8CA0\u50B5", LONG_LIABILITY: "\u56FA\u5B9A\u8CA0\u50B5", EQUITY: "\u7D14\u8CC7\u7523", SALES: "\u58F2\u4E0A\u9AD8", COGS: "\u58F2\u4E0A\u539F\u4FA1", SGA: "\u8CA9\u58F2\u8CBB\u53CA\u3073\u4E00\u822C\u7BA1\u7406\u8CBB", OTHER_REVENUE: "\u55B6\u696D\u5916\u53CE\u76CA", OTHER_EXPENSE: "\u55B6\u696D\u5916\u8CBB\u7528", EXTRA_REVENUE: "\u7279\u5225\u5229\u76CA", EXTRA_EXPENSE: "\u7279\u5225\u640D\u5931", TAX: "\u6CD5\u4EBA\u7A0E\u7B49" };
const sectionTypes = { CURRENT_ASSET: "ASSET", FIXED_ASSET: "ASSET", CURRENT_LIABILITY: "LIABILITY", LONG_LIABILITY: "LIABILITY", EQUITY: "EQUITY", SALES: "REVENUE", COGS: "EXPENSE", SGA: "EXPENSE", OTHER_REVENUE: "REVENUE", OTHER_EXPENSE: "EXPENSE", EXTRA_REVENUE: "REVENUE", EXTRA_EXPENSE: "EXPENSE", TAX: "EXPENSE" };
function assert(ok, message) {
  if (!ok)
    throw new Error(message);
}
const uid = () => crypto.randomUUID();
function date(v) {
  assert(typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "\u65E5\u4ED8\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093");
  return v;
}
function str(v, max = 300) {
  assert(typeof v === "string" && v.trim().length > 0 && v.length <= max, "\u5FC5\u9808\u9805\u76EE\u304C\u672A\u5165\u529B\u3001\u307E\u305F\u306F\u6587\u5B57\u6570\u304C\u4E0A\u9650\u3092\u8D85\u3048\u3066\u3044\u307E\u3059");
  return v.trim();
}
function amount(v) {
  assert(typeof v === "number" && Number.isSafeInteger(v) || typeof v === "string" && /^\d+$/.test(v), "\u91D1\u984D\u306F0\u4EE5\u4E0A\u306E\u6574\u6570\u5186\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
  const n = BigInt(v);
  assert(n >= 0n && n <= 999999999999n, "1\u660E\u7D30\u306E\u91D1\u984D\u4E0A\u9650\u306F999,999,999,999\u5186\u3067\u3059");
  return Number(n);
}
const sum = (rs, key) => rs.reduce((a, r) => a + BigInt(r[key] || 0), 0n);
function allocateNumber(s, requested) {
  if (requested) {
    assert(typeof requested === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(requested), "\u4F1D\u7968\u756A\u53F7\u306F40\u6587\u5B57\u4EE5\u5185\u306E\u534A\u89D2\u82F1\u6570\u5B57\u30FB\u30CF\u30A4\u30D5\u30F3\u30FB\u4E0B\u7DDA\u3067\u3059");
    assert(!s.journals.some((j) => j.journal_number === requested), "\u4F1D\u7968\u756A\u53F7\u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059\uFF08\u524A\u9664\u6E08\u307F\u3092\u542B\u3080\uFF09");
    if (/^\d{1,10}$/.test(requested)) s.company.next_number = Math.max(s.company.next_number, Number(requested) + 1);
    return requested;
  }
  let number;
  do {
    assert(Number.isSafeInteger(s.company.next_number) && s.company.next_number > 0, "\u63A1\u756A\u4E0A\u9650\u3067\u3059");
    number = String(s.company.next_number++).padStart(10, "0");
  } while (s.journals.some((j) => j.journal_number === number));
  return number;
}
function currentLines(s, j) {
  return s.lines.filter((l) => l.journal_id === j.id && l.revision === j.revision);
}
function open(s, d) {
  const y = s.years.find((y2) => y2.start <= d && d <= y2.end);
  const p = s.periods.find((p2) => p2.start <= d && d <= p2.end);
  assert(y && p, "\u65E5\u4ED8\u306B\u5BFE\u5FDC\u3059\u308B\u4F1A\u8A08\u5E74\u5EA6\u30FB\u6708\u6B21\u671F\u9593\u304C\u3042\u308A\u307E\u305B\u3093");
  assert(y.status === "OPEN" && p.status === "OPEN", "\u5E74\u5EA6\u307E\u305F\u306F\u6708\u6B21\u671F\u9593\u304CCLOSED / LOCKED\u306E\u305F\u3081\u66F4\u65B0\u3067\u304D\u307E\u305B\u3093");
  return y;
}
function canEdit(s, j) {
  if (j.journal_kind === "OPENING") return false;
  try {
    open(s, j.transaction_date);
    return j.status === "ACTIVE";
  } catch {
    return false;
  }
}
function log(s, user, type, target, id, before, after, reason = "") {
  s.audit.push({ id: uid(), event_type: type, target_type: target, target_id: id, user, timestamp: (/* @__PURE__ */ new Date()).toISOString(), before: structuredClone(before), after: structuredClone(after), reason });
}
function addYear(s, start, end, user) {
  date(start);
  date(end);
  assert(start <= end && (Date.parse(end) - Date.parse(start)) / 864e5 <= 365, "\u5E74\u5EA6\u306F366\u65E5\u4EE5\u5185\u3067\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
  assert(!s.years.some((y2) => start <= y2.end && end >= y2.start), "\u4F1A\u8A08\u5E74\u5EA6\u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059");
  if (s.years.length) {
    const latest = [...s.years].sort((a, b) => a.end.localeCompare(b.end)).at(-1);
    const next = new Date(Date.parse(latest.end) + 864e5).toISOString().slice(0, 10);
    assert(start === next, "\u65B0\u5E74\u5EA6\u306F\u65E2\u5B58\u306E\u6700\u7D42\u5E74\u5EA6\u306E\u7FCC\u65E5\u304B\u3089\u958B\u59CB\u3057\u3066\u304F\u3060\u3055\u3044");
  }
  const y = { id: uid(), start, end, status: "OPEN" };
  s.years.push(y);
  log(s, user, "PERIOD_OPEN", "years", y.id, null, y, "\u5E74\u5EA6\u4F5C\u6210");
  let d = start;
  while (d <= end) {
    const n = new Date(d);
    n.setUTCMonth(n.getUTCMonth() + 1, 1);
    const e = new Date(n.getTime() - 864e5).toISOString().slice(0, 10);
    const p = { id: uid(), year_id: y.id, start: d, end: e < end ? e : end, status: "OPEN" };
    s.periods.push(p);
    log(s, user, "PERIOD_OPEN", "periods", p.id, null, p, "\u6708\u6B21\u671F\u9593\u4F5C\u6210");
    d = n.toISOString().slice(0, 10);
  }
  return y;
}
const defaults = [["1000", "\u73FE\u91D1", "CURRENT_ASSET", "CASH"], ["1100", "\u666E\u901A\u9810\u91D1", "CURRENT_ASSET", "CASH"], ["1200", "\u58F2\u639B\u91D1", "CURRENT_ASSET", "AR"], ["1300", "\u5546\u54C1", "CURRENT_ASSET", ""], ["1500", "\u5DE5\u5177\u5668\u5177\u5099\u54C1", "FIXED_ASSET", ""], ["2000", "\u8CB7\u639B\u91D1", "CURRENT_LIABILITY", "AP"], ["2100", "\u672A\u6255\u91D1", "CURRENT_LIABILITY", "AP"], ["2200", "\u77ED\u671F\u501F\u5165\u91D1", "CURRENT_LIABILITY", ""], ["2500", "\u9577\u671F\u501F\u5165\u91D1", "LONG_LIABILITY", ""], ["3000", "\u8CC7\u672C\u91D1", "EQUITY", ""], ["3100", "\u7E70\u8D8A\u5229\u76CA\u5270\u4F59\u91D1", "EQUITY", "RETAINED"], ["4000", "\u58F2\u4E0A\u9AD8", "SALES", ""], ["5000", "\u58F2\u4E0A\u539F\u4FA1", "COGS", ""], ["6100", "\u6D88\u8017\u54C1\u8CBB", "SGA", ""], ["6200", "\u901A\u4FE1\u8CBB", "SGA", ""], ["6300", "\u65C5\u8CBB\u4EA4\u901A\u8CBB", "SGA", ""], ["6400", "\u652F\u6255\u624B\u6570\u6599", "SGA", ""], ["6500", "\u5F79\u54E1\u5831\u916C", "SGA", ""], ["6600", "\u5730\u4EE3\u5BB6\u8CC3", "SGA", ""], ["6700", "\u6E1B\u4FA1\u511F\u5374\u8CBB", "SGA", ""], ["7100", "\u53D7\u53D6\u5229\u606F", "OTHER_REVENUE", ""], ["7200", "\u652F\u6255\u5229\u606F", "OTHER_EXPENSE", ""], ["8100", "\u56FA\u5B9A\u8CC7\u7523\u58F2\u5374\u76CA", "EXTRA_REVENUE", ""], ["8200", "\u56FA\u5B9A\u8CC7\u7523\u9664\u5374\u640D", "EXTRA_EXPENSE", ""], ["9000", "\u6CD5\u4EBA\u7A0E\u7B49", "TAX", ""]];
function createCompany(user, name, start, end, test = false) {
  const s = { company: { id: uid(), owner: user, name: str(name), currency: "JPY", start: date(start), end: date(end), version: 0, test, corporate_number: "", next_number: 1, created_at: (/* @__PURE__ */ new Date()).toISOString() }, accounts: [], subaccounts: [], years: [], periods: [], journals: [], lines: [], audit: [], tax_codes: [] };
  for (const [code, name2, section, tag] of defaults) {
    const type = sectionTypes[section];
    s.accounts.push({ id: uid(), account_code: code, account_name: name2, account_type: type, statement_type: ["ASSET", "LIABILITY", "EQUITY"].includes(type) ? "BS" : "PL", normal_balance: ["ASSET", "EXPENSE"].includes(type) ? "DEBIT" : "CREDIT", section, tag, default_tax_code: "UNSPECIFIED", display_order: Number(code), active: true });
  }
  addYear(s, start, end, user);
  log(s, user, "COMPANY_CREATE", "company", s.company.id, null, s.company);
  log(s, user, "ACCOUNT_INITIALIZE", "accounts", s.company.id, null, s.accounts);
  return s;
}
function orderedTaxCodes(s) {
  const rank = (t) => Number.isSafeInteger(t.display_order) && t.display_order >= 0 ? t.display_order : Number.MAX_SAFE_INTEGER;
  return [...s.tax_codes].sort((a, b) => rank(a) - rank(b) || a.tax_code.localeCompare(b.tax_code) || a.id.localeCompare(b.id));
}
function openingPlan(s, yearId, balances) {
  const y = s.years.find((year) => year.id === yearId);
  assert(y, "会計年度が見つかりません");
  const existing = s.journals.filter((j) => j.status === "ACTIVE" && j.year_id === y.id && j.journal_kind === "OPENING");
  assert(existing.length <= 1, "期首残高仕訳が重複しています");
  const old = existing[0];
  const baseline = reports({ ...s, journals: s.journals.filter((j) => j.id !== old?.id) }, y.start, y.start).rows;
  const accounts = baseline.filter((a) => a.statement_type === "BS");
  const rows = accounts.map((a) => {
    const adjustment = old ? currentLines(s, old).filter((l) => l.account_id === a.id).reduce((n, l) => n + BigInt(l.debit_amount) - BigInt(l.credit_amount), 0n) : 0n;
    return { ...a, baseline: a.opening, target: String(BigInt(a.opening) + adjustment) };
  });
  if (!balances) return { year: y, old, rows };
  assert(Array.isArray(balances) && balances.length === accounts.length, "全BS科目の期首残高を指定してください");
  assert(new Set(balances.map((b) => b.account_id)).size === accounts.length, "勘定科目が重複しています");
  let targetTotal = 0n;
  const targets = balances.map((b) => {
    const a = rows.find((a) => a.id === b.account_id);
    assert(a, "BS科目だけを指定してください");
    const debit = amount(b.debit_amount || 0), credit = amount(b.credit_amount || 0);
    assert(!debit || !credit, "同じ科目の借方・貸方を同時に入力できません");
    const target = BigInt(debit) - BigInt(credit), delta = target - BigInt(a.baseline);
    assert(a.active || target === BigInt(a.target), "無効科目の期首残高は変更できません");
    targetTotal += target;
    return { ...a, target: String(target), delta: String(delta) };
  });
  assert(targetTotal === 0n, "期首残高の貸借が一致していません");
  const lines = targets.filter((a) => BigInt(a.delta) !== 0n).map((a) => ({ account_id: a.id, debit_amount: amount(BigInt(a.delta) > 0n ? a.delta : "0"), credit_amount: amount(BigInt(a.delta) < 0n ? String(-BigInt(a.delta)) : "0"), tax_code: "UNSPECIFIED", line_description: "期首残高の差額調整" }));
  assert(lines.reduce((n, l) => n + BigInt(l.debit_amount) - BigInt(l.credit_amount), 0n) === 0n, "繰越残高の貸借が一致していません。元データを確認してください");
  return { year: y, old, rows: targets, lines, changed: targets.some((a) => a.target !== rows.find((r) => r.id === a.id).target) };
}
function mutate(input, command, user) {
  assert(input.company.owner === user, "\u3053\u306E\u4F1A\u793E\u3078\u306E\u6A29\u9650\u304C\u3042\u308A\u307E\u305B\u3093");
  const s = structuredClone(input);
  let c = command;
  assert(!s.company.archived || c.type === "company_archive", "アーカイブ済み会社は復元してから更新してください");
  if (c.type === "company_archive") {
    assert(typeof c.archived === "boolean" && c.archived !== (s.company.archived === true), "会社のアーカイブ状態に変更がありません");
    const before = structuredClone(s.company), reason = str(c.reason);
    s.company.archived = c.archived;
    s.company.archive_changed_at = new Date().toISOString();
    s.company.archive_changed_by = user;
    log(s, user, c.archived ? "COMPANY_ARCHIVE" : "COMPANY_RESTORE", "company", s.company.id, before, s.company, reason);
    s.company.version++;
    return s;
  }
  s.tax_codes ||= [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const isOpening = c.type === "opening";
  let plan;
  if (isOpening) {
    plan = openingPlan(s, c.year_id, c.balances);
    open(s, plan.year.start);
    assert(!s.journals.some((j) => j.status === "ACTIVE" && j.transaction_date === plan.year.start && j.journal_kind !== "OPENING") || c.confirm_start_journals === true, "期首日の通常仕訳を確認して、開始残高の重複がないことを確認してください");
    assert(s.years.filter((y) => y.end < plan.year.start).every((y) => y.status === "LOCKED"), "前年度までをLOCKしてから期首残高を設定してください");
    assert(!s.years.some((y) => y.start > plan.year.start && (y.status !== "OPEN" || s.periods.some((p) => p.year_id === y.id && p.status !== "OPEN"))), "後続年度に確定期間があるため期首残高を変更できません");
    assert(!s.journals.some((j) => j.status === "ACTIVE" && j.journal_kind === "OPENING" && j.transaction_date > plan.year.start), "後続年度の期首残高設定があるため変更できません");
    const reason = str(c.reason);
    assert(plan.changed, "期首残高に変更がありません。保存は不要です");
    if (!plan.lines.length && plan.old) {
      const before = structuredClone(plan.old);
      Object.assign(plan.old, { status: "DELETED", deleted_at: now, deleted_by: user, delete_reason: reason, updated_at: now, updated_by: user });
      log(s, user, "OPENING_RESET", "journals", plan.old.id, before, plan.old, reason);
      s.company.version++;
      return s;
    }
    c = { type: "journal", id: plan.old?.id, transaction_date: plan.year.start, description: "期首残高の差額調整", journal_kind: "OPENING", lines: plan.lines, reason };
  }
  if (c.type === "journal") {
    let old = s.journals.find((j2) => j2.id === c.id);
    assert(isOpening || (old?.journal_kind !== "OPENING" && c.journal_kind !== "OPENING"), "期首残高は専用画面で設定してください");
    assert(!c.id || old, "\u4ED5\u8A33\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
    if (old) {
      assert(old.status === "ACTIVE", "\u524A\u9664\u6E08\u307F\u4ED5\u8A33\u306F\u7DE8\u96C6\u3067\u304D\u307E\u305B\u3093");
      open(s, old.transaction_date);
    }
    const y = open(s, date(c.transaction_date));
    assert(Array.isArray(c.lines) && c.lines.length >= 2 && c.lines.length <= 100, "\u4ED5\u8A33\u660E\u7D30\u306F2\u301C100\u884C\u3067\u3059");
    const rev = (old?.revision || 0) + 1, id = old?.id || uid();
    assert(!c.lines.some(l => l.subaccount_search?.includes('*')), '補助科目の検索条件は保存できません。候補を選択してください');
    const expanded = expandTaxLines(s, c.lines, c.transaction_date, old ? currentLines(s, old) : [], old?.transaction_date);
    const ls = expanded.map((l) => {
      const a = s.accounts.find((a2) => a2.id === l.account_id);
      assert(a?.active || isOpening && plan.rows.some((r) => r.id === a?.id && !r.active), "\u6709\u52B9\u306A\u52D8\u5B9A\u79D1\u76EE\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
      const sub = l.subaccount_id ? s.subaccounts.find((a2) => a2.id === l.subaccount_id) : null;
      assert(!l.subaccount_id || sub?.active && sub.account_id === a.id, "\u88DC\u52A9\u79D1\u76EE\u306E\u6240\u5C5E\u30FB\u6709\u52B9\u72B6\u614B\u304C\u4E0D\u6B63\u3067\u3059");
      const previous = old && currentLines(s, old).find(x => x.id === l.original_line_id);
      const incoming = l.subaccount_name === undefined ? (sub?.name || '') : l.subaccount_name;
      const unchangedLegacy = previous && previous.account_id === a.id && subaccountName(s,previous) === incoming;
      const name = unchangedLegacy ? incoming : cleanSubaccount(incoming);
      if (!isOpening && !l.is_tax_line) {
        assert((a.subaccount_input || 'OPTIONAL') !== 'REQUIRED' || name.trim(), '補助科目が必須です：' + a.account_name);
        assert((a.subaccount_input || 'OPTIONAL') !== 'NONE' || !name || unchangedLegacy, '補助科目は不要の設定です：' + a.account_name);
      }
      return { id: l.id, journal_id: id, revision: rev, account_id: a.id, subaccount_id: sub?.id || null, subaccount_name: name, debit_amount: l.debit_amount, credit_amount: l.credit_amount, line_description: String(l.line_description || "").slice(0, 300), ...Object.fromEntries(taxFields.map((k) => [k, l[k] ?? null])), entry_side: l.entry_side || null, is_tax_line: l.is_tax_line, tax_source_line_id: l.tax_source_line_id };
    });
    assert(sum(ls, "debit_amount") === sum(ls, "credit_amount"), "\u8CB8\u501F\u304C\u4E00\u81F4\u3057\u3066\u3044\u307E\u305B\u3093");
    const journal_kind = c.journal_kind || old?.journal_kind || "STANDARD";
    assert(["STANDARD", "TAX_SETTLEMENT", "TAX_PAYMENT", ...(isOpening ? ["OPENING"] : [])].includes(journal_kind), "\u4ED5\u8A33\u7A2E\u5225\u304C\u4E0D\u6B63\u3067\u3059");
    const j = { journal_kind, id, journal_number: old?.journal_number || allocateNumber(s, c.import_number), transaction_date: c.transaction_date, year_id: y.id, description: str(c.description), counterparty: String(c.counterparty || "").slice(0, 300), status: "ACTIVE", revision: rev, created_at: old?.created_at || now, created_by: old?.created_by || user, updated_at: now, updated_by: user, deleted_at: null, deleted_by: null, delete_reason: null, source_type: old?.source_type || "MANUAL", source_id: null };
    if (isOpening) j.opening_targets = plan.rows.map((a) => ({ account_id: a.id, baseline: a.baseline, target: a.target }));
    const before = old ? { header: old, lines: currentLines(s, old) } : null;
    if (old)
      s.journals[s.journals.indexOf(old)] = j;
    else
      s.journals.push(j);
    s.lines.push(...ls);
    log(s, user, old ? "JOURNAL_EDIT" : "JOURNAL_CREATE", "journals", id, before, { header: j, lines: ls }, old ? str(c.reason) : "");
    if (ls.some((l) => l.tax_status === "SET") || before?.lines.some((l) => l.tax_status === "SET")) log(s, user, "JOURNAL_TAX_CHANGE", "journals", id, before, { header: j, lines: ls }, c.reason || "\u7A0E\u60C5\u5831\u78BA\u5B9A");
    for (const l of ls.filter((l2) => l2.tax_adjustment_reason)) log(s, user, "TAX_AMOUNT_ADJUST", "lines", l.id, { tax_amount: l.calculated_tax_amount }, { tax_amount: l.tax_amount, taxable_amount: l.taxable_amount, gross_amount: l.gross_amount }, l.tax_adjustment_reason);
    if (journal_kind !== "STANDARD") log(s, user, journal_kind, "journals", id, before, { header: j, lines: ls }, c.reason || j.description);
  } else if (c.type === "delete") {
    const j = s.journals.find((j2) => j2.id === c.id);
    assert(j?.journal_kind !== "OPENING", "期首残高は専用画面で変更してください");
    assert(j && j.status === "ACTIVE", "\u6709\u52B9\u306A\u4ED5\u8A33\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
    open(s, j.transaction_date);
    const before = structuredClone(j);
    j.status = "DELETED";
    j.deleted_at = now;
    j.deleted_by = user;
    j.delete_reason = str(c.reason);
    j.updated_at = now;
    j.updated_by = user;
    log(s, user, "JOURNAL_DELETE", "journals", j.id, before, j, j.delete_reason);
  } else if (c.type === "period") {
    if (c.status === "OPEN") {
      const target = s[c.target]?.find((p) => p.id === c.id);
      assert(!target || !s.journals.some((j) => j.status === "ACTIVE" && j.journal_kind === "OPENING" && j.transaction_date > target.end), "後続年度の期首残高設定があるため再OPENできません");
    }
    assert(c.target === "years" || c.target === "periods", "\u671F\u9593\u7A2E\u5225\u304C\u4E0D\u6B63\u3067\u3059");
    const p = s[c.target].find((p2) => p2.id === c.id);
    assert(p, "\u671F\u9593\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
    assert(p.status !== "LOCKED", "LOCKED\u306F\u89E3\u9664\u30FB\u5909\u66F4\u3067\u304D\u307E\u305B\u3093");
    assert(["OPEN", "CLOSED", "LOCKED"].includes(c.status) && p.status !== c.status, "\u72B6\u614B\u9077\u79FB\u304C\u4E0D\u6B63\u3067\u3059");
    if (c.target === "periods") {
      const y = s.years.find((y2) => y2.id === p.year_id);
      assert(y.status === "OPEN", "\u5E74\u5EA6\u3092\u5148\u306BOPEN\u306B\u3057\u3066\u304F\u3060\u3055\u3044");
    }
    if (c.target === "years" && c.status === "LOCKED")
      assert(s.periods.filter((x) => x.year_id === p.id).every((x) => x.status !== "OPEN"), "\u5E74\u5EA6LOCK\u524D\u306B\u5168\u6708\u6B21\u671F\u9593\u3092CLOSE\u3057\u3066\u304F\u3060\u3055\u3044");
    const reason = str(c.reason), before = structuredClone(p);
    p.status = c.status;
    p.changed_at = now;
    p.changed_by = user;
    log(s, user, c.status === "OPEN" ? "PERIOD_REOPEN" : c.status === "CLOSED" ? "PERIOD_CLOSE" : "PERIOD_LOCK", c.target, p.id, before, p, reason);
  } else if (c.type === "year") {
    addYear(s, c.start, c.end, user);
  } else if (c.type === "account") {
    const old = s.accounts.find((a2) => a2.id === c.id);
    assert(!c.id || old, "\u79D1\u76EE\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
    const section = c.section;
    assert(sectionTypes[section], "\u8CA1\u52D9\u8AF8\u8868\u533A\u5206\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
    const type = sectionTypes[section], code = str(c.account_code, 20);
    assert(!s.accounts.some((a2) => a2.id !== c.id && a2.account_code === code), "\u52D8\u5B9A\u79D1\u76EE\u30B3\u30FC\u30C9\u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059");
    const used = old && s.lines.some((l) => l.account_id === old.id);
    const normal = c.normal_balance || (["ASSET", "EXPENSE"].includes(type) ? "DEBIT" : "CREDIT");
    assert(["DEBIT", "CREDIT"].includes(normal), "\u8CB8\u501F\u533A\u5206\u304C\u4E0D\u6B63\u3067\u3059");
    if (used)
      assert(old.section === section && old.normal_balance === normal && old.tag === (c.tag || ""), "\u4F7F\u7528\u6E08\u307F\u79D1\u76EE\u306E\u8CA1\u52D9\u533A\u5206\u30FB\u901A\u5E38\u6B8B\u9AD8\u30FB\u96C6\u8A08\u533A\u5206\u306F\u5909\u66F4\u3067\u304D\u307E\u305B\u3093");
    assert(!old || old.tag !== "RETAINED" || c.tag === "RETAINED", "\u7E70\u8D8A\u5229\u76CA\u5270\u4F59\u91D1\u306E\u96C6\u8A08\u533A\u5206\u306F\u5909\u66F4\u3067\u304D\u307E\u305B\u3093");
    assert(c.tag !== "RETAINED" || section === "EQUITY" && !s.accounts.some((a2) => a2.id !== c.id && a2.tag === "RETAINED"), "\u7E70\u8D8A\u5229\u76CA\u5270\u4F59\u91D1\u306F\u7D14\u8CC7\u7523\u306E1\u79D1\u76EE\u306B\u9650\u5B9A\u3055\u308C\u307E\u3059");
    assert(!["CASH", "AR"].includes(c.tag) || section === "CURRENT_ASSET", "\u73FE\u9810\u91D1\u30FB\u58F2\u639B\u91D1\u306F\u6D41\u52D5\u8CC7\u7523\u3067\u3059");
    assert(c.tag !== "AP" || section === "CURRENT_LIABILITY", "\u8CB7\u639B\u91D1\u30FB\u672A\u6255\u91D1\u306F\u6D41\u52D5\u8CA0\u50B5\u3067\u3059");
    const a = { id: old?.id || uid(), account_code: code, account_name: str(c.account_name, 100), account_type: type, statement_type: ["ASSET", "LIABILITY", "EQUITY"].includes(type) ? "BS" : "PL", normal_balance: normal, section, tag: ["", "CASH", "AR", "AP", "RETAINED"].includes(c.tag) ? c.tag : "", default_tax_code: c.default_tax_code ?? old?.default_tax_code ?? "UNSPECIFIED", display_order: Number(code) || 0, active: c.active !== false };
    assert(a.default_tax_code === "UNSPECIFIED" || s.tax_codes.some((t) => t.tax_code === a.default_tax_code && t.active), "\u6709\u52B9\u306A\u30C7\u30D5\u30A9\u30EB\u30C8\u7A0E\u533A\u5206\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
    if (Object.values(s.company.tax_accounts || {}).includes(a.id)) assert(old?.section === a.section && a.default_tax_code === "OUT", "\u6D88\u8CBB\u7A0E\u79D1\u76EE\u306E\u533A\u5206\u30FB\u7A0E\u533A\u5206\u306F\u56FA\u5B9A\u3067\u3059");
    a.subaccount_input = c.subaccount_input ?? old?.subaccount_input ?? 'OPTIONAL';
    a.subaccount_assist = c.subaccount_assist ?? old?.subaccount_assist ?? 'NONE';
    assert(Object.hasOwn(inputModes,a.subaccount_input) && Object.hasOwn(assistModes,a.subaccount_assist), '補助科目設定が不正です');
    if (old)
      s.accounts[s.accounts.indexOf(old)] = a;
    else
      s.accounts.push(a);
    log(s, user, "ACCOUNT_CHANGE", "accounts", a.id, old || null, a, str(c.reason));
    if (old?.default_tax_code !== a.default_tax_code) log(s, user, "ACCOUNT_DEFAULT_TAX_CHANGE", "accounts", a.id, old || null, a, c.reason);
  } else if (c.type === "subaccount") {
    const old = s.subaccounts.find((a2) => a2.id === c.id);
    assert(!c.id || old, "\u88DC\u52A9\u79D1\u76EE\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
    assert(s.accounts.some((a2) => a2.id === c.account_id && a2.active), "\u6709\u52B9\u306A\u89AA\u79D1\u76EE\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
    if (old && s.lines.some((l) => l.subaccount_id === old.id))
      assert(old.account_id === c.account_id, "\u4F7F\u7528\u6E08\u307F\u88DC\u52A9\u79D1\u76EE\u306E\u89AA\u79D1\u76EE\u306F\u5909\u66F4\u3067\u304D\u307E\u305B\u3093");
    const name = str(c.name, 100);
    assert(!s.subaccounts.some((a2) => a2.id !== c.id && a2.account_id === c.account_id && a2.name === name), "\u88DC\u52A9\u79D1\u76EE\u540D\u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059");
    const a = { id: old?.id || uid(), account_id: c.account_id, name, active: c.active !== false };
    if (old)
      s.subaccounts[s.subaccounts.indexOf(old)] = a;
    else
      s.subaccounts.push(a);
    log(s, user, "SUBACCOUNT_CHANGE", "subaccounts", a.id, old || null, a, str(c.reason));
  } else if (c.type === "tax_setup") {
    assert(!s.company.tax_accounts, "\u6D88\u8CBB\u7A0E\u8A2D\u5B9A\u306F\u767B\u9332\u6E08\u307F\u3067\u3059");
    const before = structuredClone(s.company);
    s.company.tax_rounding = "FLOOR";
    s.company.accounting_method = "TAX_EXCLUSIVE";
    s.company.tax_accounts = {};
    for (const t of initialTaxCodes()) {
      assert(!s.tax_codes.some((x) => x.tax_code === t.tax_code), "\u7A0E\u533A\u5206\u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059");
      s.tax_codes.push(t);
      log(s, user, "TAX_CODE_CREATE", "tax_codes", t.id, null, t, "\u6D88\u8CBB\u7A0E\u521D\u671F\u8A2D\u5B9A");
    }
    for (const [key, name, section, base] of [["input", "\u4EEE\u6255\u6D88\u8CBB\u7A0E", "CURRENT_ASSET", 1400], ["output", "\u4EEE\u53D7\u6D88\u8CBB\u7A0E", "CURRENT_LIABILITY", 2400], ["payable", "\u672A\u6255\u6D88\u8CBB\u7A0E\u7B49", "CURRENT_LIABILITY", 2450]]) {
      let n = base;
      while (s.accounts.some((a2) => a2.account_code === String(n))) n++;
      const a = { id: uid(), account_code: String(n), account_name: name, account_type: sectionTypes[section], statement_type: "BS", normal_balance: key === "input" ? "DEBIT" : "CREDIT", section, tag: "", default_tax_code: "OUT", display_order: n, active: true };
      s.accounts.push(a);
      s.company.tax_accounts[key] = a.id;
      log(s, user, "ACCOUNT_CHANGE", "accounts", a.id, null, a, "\u6D88\u8CBB\u7A0E\u79D1\u76EE\u8FFD\u52A0");
    }
    log(s, user, "TAX_SETTINGS_CHANGE", "company", s.company.id, before, s.company, "\u7A0E\u629C\u7D4C\u7406\u3092\u6709\u52B9\u5316\u3002\u904E\u53BB\u4ED5\u8A33\u306F\u5909\u66F4\u3057\u306A\u3044");
  } else if (c.type === "tax_settings") {
    assert(roundingNames[c.tax_rounding], "\u7AEF\u6570\u51E6\u7406\u65B9\u5F0F\u304C\u4E0D\u6B63\u3067\u3059");
    const before = structuredClone(s.company);
    s.company.tax_rounding = c.tax_rounding;
    log(s, user, "TAX_SETTINGS_CHANGE", "company", s.company.id, before, s.company, str(c.reason));
  } else if (c.type === "tax_order") {
    assert(Array.isArray(c.ids) && c.ids.length === s.tax_codes.length && new Set(c.ids).size === s.tax_codes.length && c.ids.every((id) => s.tax_codes.some((t) => t.id === id)), "税区分の並び順が不正です。再読み込みしてください");
    const before = orderedTaxCodes(s).map((t) => ({ id: t.id, display_order: t.display_order ?? null }));
    c.ids.forEach((id, index) => { s.tax_codes.find((t) => t.id === id).display_order = index; });
    log(s, user, "TAX_CODE_REORDER", "tax_codes", s.company.id, before, orderedTaxCodes(s).map((t) => ({ id: t.id, display_order: t.display_order })), "税区分の表示順変更");
  } else if (c.type === "tax_code") {
    const old = s.tax_codes.find((t2) => t2.id === c.id);
    assert(!c.id || old, "\u7A0E\u533A\u5206\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
    const code = str(c.tax_code, 30);
    assert(/^[A-Z0-9_]+$/.test(code) && code !== "UNSPECIFIED", "\u7A0E\u533A\u5206\u30B3\u30FC\u30C9\u306F\u82F1\u5927\u6587\u5B57\u30FB\u6570\u5B57\u30FB\u30A2\u30F3\u30C0\u30FC\u30B9\u30B3\u30A2\u3067\u3059");
    assert(["SALES", "PURCHASE", "EXEMPT", "NON_TAXABLE", "OUT"].includes(c.tax_type), "\u7A0E\u533A\u5206\u7A2E\u5225\u304C\u4E0D\u6B63\u3067\u3059");
    rateBps(c.tax_rate);
    assert(["SALES", "PURCHASE"].includes(c.tax_type) || rateBps(c.tax_rate) === 0, "\u975E\u8AB2\u7A0E\u7B49\u306E\u7A0E\u7387\u306F0\u3067\u3059");
    assert(!s.tax_codes.some((t2) => t2.id !== c.id && t2.tax_code === code), "\u7A0E\u533A\u5206\u30B3\u30FC\u30C9\u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059");
    if (old) assert(old.tax_code === code && old.tax_type === c.tax_type && rateBps(old.tax_rate) === rateBps(c.tax_rate), "\u7A0E\u7387\u30FB\u7A2E\u5225\u30FB\u30B3\u30FC\u30C9\u306F\u4E0A\u66F8\u304D\u305B\u305A\u65B0\u3057\u3044\u7A0E\u533A\u5206\u3092\u8FFD\u52A0\u3057\u3066\u304F\u3060\u3055\u3044");
    const t = { id: old?.id || uid(), tax_code: code, tax_name: str(c.tax_name, 100), tax_type: c.tax_type, tax_rate: String(c.tax_rate), effective_from: date(c.effective_from), effective_to: c.effective_to ? date(c.effective_to) : null, active: c.active !== false };
    if (old?.display_order !== undefined) t.display_order = old.display_order;
    assert(!t.effective_to || t.effective_to >= t.effective_from, "\u9069\u7528\u671F\u9593\u304C\u4E0D\u6B63\u3067\u3059");
    if (old) s.tax_codes[s.tax_codes.indexOf(old)] = t;
    else s.tax_codes.push(t);
    log(s, user, !old ? "TAX_CODE_CREATE" : !t.active ? "TAX_CODE_DISABLE" : "TAX_CODE_CHANGE", "tax_codes", t.id, old || null, t, str(c.reason));
  } else if (c.type === "settings") {
    const before = structuredClone(s.company);
    s.company.name = str(c.name);
    assert(!c.currency || c.currency === "JPY", "\u57FA\u672C\u901A\u8CA8\u306FJPY\u306E\u307F\u3067\u3059");
    assert(!c.corporate_number || /^\d{13}$/.test(c.corporate_number), "\u6CD5\u4EBA\u756A\u53F7\u306F13\u6841\u3067\u3059");
    s.company.corporate_number = c.corporate_number || "";
    log(s, user, "COMPANY_CHANGE", "company", s.company.id, before, s.company, str(c.reason));
  } else
    throw new Error("\u8A31\u53EF\u3055\u308C\u3066\u3044\u306A\u3044\u64CD\u4F5C\u3067\u3059");
  s.company.version++;
  return s;
}
function postingLines(s, end = "9999-12-31") {
  return s.journals.filter((j) => j.status === "ACTIVE" && j.transaction_date <= end).flatMap((j) => currentLines(s, j).map((l) => ({ ...l, date: j.transaction_date, journal_number: j.journal_number, description: j.description, journal_kind: j.journal_kind, year_id: j.year_id })));
}
function reports(s, start, end) {
  date(start);
  date(end);
  assert(start <= end, "\u958B\u59CB\u65E5\u3068\u7D42\u4E86\u65E5\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044");
  const y = s.years.find((y2) => y2.start <= start && start <= y2.end);
  assert(y && end <= y.end, "\u96C6\u8A08\u671F\u9593\u306F1\u3064\u306E\u4F1A\u8A08\u5E74\u5EA6\u5185\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
  const ls = postingLines(s, end);
  const rows = s.accounts.map((a) => {
    const mine = ls.filter((l) => l.account_id === a.id);
    let opening = mine.filter((l) => (l.date < start || l.journal_kind === "OPENING" && l.year_id === y.id) && (a.statement_type === "BS" || l.date >= y.start)).reduce((n, l) => n + BigInt(l.debit_amount) - BigInt(l.credit_amount), 0n);
    if (a.tag === "RETAINED") {
      opening += ls.filter((l) => l.date < y.start && s.accounts.find((a2) => a2.id === l.account_id)?.statement_type === "PL").reduce((n, l) => n + BigInt(l.credit_amount) - BigInt(l.debit_amount), 0n) * -1n;
    }
    const period = mine.filter((l) => l.date >= start && !(l.journal_kind === "OPENING" && l.year_id === y.id)), debit = sum(period, "debit_amount"), credit = sum(period, "credit_amount");
    return { ...a, opening: opening.toString(), debit: debit.toString(), credit: credit.toString(), closing: (opening + debit - credit).toString() };
  });
  const groups = {};
  for (const a of rows) {
    const n = a.statement_type === "PL" ? BigInt(a.debit) - BigInt(a.credit) : BigInt(a.closing);
    groups[a.section] = (groups[a.section] || 0n) + (["ASSET", "EXPENSE"].includes(a.account_type) ? n : -n);
  }
  const g = (k) => groups[k] || 0n;
  const gross = g("SALES") - g("COGS"), op = gross - g("SGA"), ordinary = op + g("OTHER_REVENUE") - g("OTHER_EXPENSE"), pretax = ordinary + g("EXTRA_REVENUE") - g("EXTRA_EXPENSE"), net = pretax - g("TAX");
  const ytd = ls.filter((l) => l.date >= y.start && s.accounts.find((a) => a.id === l.account_id)?.statement_type === "PL").reduce((n, l) => n + BigInt(l.credit_amount) - BigInt(l.debit_amount), 0n);
  const assets = g("CURRENT_ASSET") + g("FIXED_ASSET"), liabilities = g("CURRENT_LIABILITY") + g("LONG_LIABILITY"), equity = g("EQUITY") + ytd;
  const openingDiff = rows.reduce((n, a) => n + BigInt(a.opening), 0n), movementDiff = rows.reduce((n, a) => n + BigInt(a.debit) - BigInt(a.credit), 0n), closingDiff = rows.reduce((n, a) => n + BigInt(a.closing), 0n);
  const tag = (t) => rows.filter((a) => a.tag === t).reduce((n, a) => n + BigInt(a.closing) * (t === "AP" ? -1n : 1n), 0n);
  return { rows, groups: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.toString()])), pl: { gross: String(gross), operating: String(op), ordinary: String(ordinary), pretax: String(pretax), net: String(net) }, bs: { assets: String(assets), liabilities: String(liabilities), equity: String(equity), ytd_profit: String(ytd), difference: String(assets - liabilities - equity) }, trial: { opening_difference: String(openingDiff), movement_difference: String(movementDiff), closing_difference: String(closingDiff) }, dashboard: { sales: String(g("SALES")), expenses: String(g("COGS") + g("SGA") + g("OTHER_EXPENSE") + g("EXTRA_EXPENSE") + g("TAX")), profit: String(net), ytd_profit: String(ytd), ytd_sales: String(ls.filter((l) => l.date >= y.start && s.accounts.find((a) => a.id === l.account_id)?.section === "SALES").reduce((n, l) => n + BigInt(l.credit_amount) - BigInt(l.debit_amount), 0n)), cash: String(tag("CASH")), ar: String(tag("AR")), ap: String(tag("AP")) } };
}
function ledger(s, accountId, start, end) {
  const r = reports(s, start, end), a = r.rows.find((a2) => a2.id === accountId);
  assert(a, "\u79D1\u76EE\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
  let balance = BigInt(a.opening);
  const rows = postingLines(s, end).filter((l) => l.account_id === accountId && l.date >= start && l.journal_kind !== "OPENING").sort((a2, b) => a2.date.localeCompare(b.date) || a2.journal_number.localeCompare(b.journal_number) || a2.id.localeCompare(b.id)).map((l) => {
    balance += BigInt(l.debit_amount) - BigInt(l.credit_amount);
    const j = s.journals.find((j2) => j2.id === l.journal_id);
    const opposite = currentLines(s, j).filter((x) => l.debit_amount > 0 ? x.credit_amount > 0 : x.debit_amount > 0).map((x) => s.accounts.find((a2) => a2.id === x.account_id)?.account_name).filter((x, i, arr) => arr.indexOf(x) === i);
    return { ...l, counter_account: opposite.join("\u30FB"), balance: String(balance) };
  });
  return { opening: a.opening, closing: String(balance), rows };
}
function csv(rows, columns) {
  const keys = columns || [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    let t = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r']/.test(t))
      t = "'" + t;
    return '"' + t.replaceAll('"', '""') + '"';
  };
  return "\uFEFF" + [keys.map(cell).join(","), ...rows.map((r) => keys.map((k) => cell(r[k])).join(","))].join("\r\n");
}
function seedTest(user) {
  let s = createCompany(user, "\u30C6\u30B9\u30C8\u682A\u5F0F\u4F1A\u793E", "2026-04-01", "2027-03-31", true);
  const acc = (code) => s.accounts.find((a) => a.account_code === code).id;
  for (const name of ["\u25CB\u25CB\u9280\u884C", "\u25B3\u25B3\u9280\u884C"])
    s = mutate(s, { type: "subaccount", account_id: acc("1100"), name, reason: "\u30C6\u30B9\u30C8\u521D\u671F\u8A2D\u5B9A" }, user);
  const bank = s.subaccounts;
  const samples = [["\u8CC7\u672C\u91D1\u306E\u5165\u91D1", "1100", "3000", 1e6], ["\u73FE\u91D1\u58F2\u4E0A", "1000", "4000", 1e5], ["\u639B\u58F2\u4E0A", "1200", "4000", 2e5], ["\u58F2\u639B\u91D1\u306E\u56DE\u53CE", "1100", "1200", 2e5], ["\u6D88\u8017\u54C1\u8CFC\u5165", "6100", "1000", 1e4], ["\u901A\u4FE1\u8CBB\u652F\u6255", "6200", "1100", 2e4], ["\u30AB\u30FC\u30C9\u5229\u7528\u30FB\u672A\u6255\u91D1\u8A08\u4E0A", "6100", "2100", 3e4], ["\u30AB\u30FC\u30C9\u4EE3\u91D1\u652F\u6255", "2100", "1100", 3e4], ["\u9280\u884C\u9593\u632F\u66FF", "1100", "1100", 1e5], ["\u5099\u54C1\u8CFC\u5165", "1500", "1100", 15e4]];
  samples.forEach(([description, d, c, n], i) => {
    s = mutate(s, { type: "journal", transaction_date: `2026-04-${String(i + 1).padStart(2, "0")}`, description, counterparty: "\u30C6\u30B9\u30C8\u53D6\u5F15\u5148", lines: [{ account_id: acc(d), subaccount_id: d === "1100" ? bank[i === 8 ? 1 : 0].id : null, debit_amount: n, credit_amount: 0 }, { account_id: acc(c), subaccount_id: c === "1100" ? bank[0].id : null, debit_amount: 0, credit_amount: n }] }, user);
  });
  return s;
}
const csvColumns = { company: ["id", "owner", "name", "currency", "start", "end", "version", "test", "corporate_number", "next_number", "created_at"], journals: ["id", "journal_number", "transaction_date", "year_id", "description", "counterparty", "status", "revision", "created_at", "created_by", "updated_at", "updated_by", "deleted_at", "deleted_by", "delete_reason", "source_type", "source_id"], lines: ["id", "journal_id", "revision", "account_id", "subaccount_id", "debit_amount", "credit_amount", "tax_code", "line_description"], accounts: ["id", "account_code", "account_name", "account_type", "statement_type", "normal_balance", "section", "tag", "default_tax_code", "display_order", "active"], subaccounts: ["id", "account_id", "name", "active"], years: ["id", "start", "end", "status", "changed_at", "changed_by"], periods: ["id", "year_id", "start", "end", "status", "changed_at", "changed_by"], audit: ["id", "event_type", "target_type", "target_id", "user", "timestamp", "before", "after", "reason"] };
csvColumns.tax_codes = ["id", "tax_code", "tax_name", "tax_type", "tax_rate", "effective_from", "effective_to", "active", "display_order"];
csvColumns.lines.push(...taxFields.filter((k) => !csvColumns.lines.includes(k)), "is_tax_line", "tax_source_line_id", "entry_side");
csvColumns.company.push("tax_rounding", "tax_accounts", "accounting_method", "archived", "archive_changed_at", "archive_changed_by");
csvColumns.journals.push("journal_kind");
csvColumns.lines.push("subaccount_name");
csvColumns.accounts.push("subaccount_input", "subaccount_assist");
export {
  assert,
  canEdit,
  createCompany,
  csv,
  csvColumns,
  currentLines,
  date,
  ledger,
  mutate,
  postingLines,
  reports,
  openingPlan,
  orderedTaxCodes,
  sectionTypes,
  sections,
  seedTest,
  tables
};
