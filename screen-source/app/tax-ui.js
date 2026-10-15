"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import {SubaccountInput} from "./subaccount-ui.js";
import {subaccountName} from "../lib/accounting/subaccounts.js";
import { currentLines, orderedTaxCodes } from "@/lib/accounting/core";
import { expandTaxLines, calculateTax, taxReport, taxTypes, roundingNames } from "@/lib/accounting/tax";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
const money = (x) => x === null || x === void 0 ? "\u672A\u8A2D\u5B9A" : BigInt(x).toLocaleString("ja-JP");
function Choose({ value, options, onChange, label }) {
  return /* @__PURE__ */ jsxs(Select, { value: value || "_", onValueChange: (v) => onChange(v === "_" ? "" : v), children: [
    /* @__PURE__ */ jsx(SelectTrigger, { "aria-label": label, children: /* @__PURE__ */ jsx(SelectValue, {}) }),
    /* @__PURE__ */ jsx(SelectContent, { children: options.map(([v, n]) => /* @__PURE__ */ jsx(SelectItem, { value: v || "_", children: n }, v || "_")) })
  ] });
}
function DataTable({ heads, rows }) {
  return /* @__PURE__ */ jsxs(Table, { children: [
    /* @__PURE__ */ jsx(TableHeader, { children: /* @__PURE__ */ jsx(TableRow, { children: heads.map((h) => /* @__PURE__ */ jsx(TableHead, { children: h }, h)) }) }),
    /* @__PURE__ */ jsx(TableBody, { children: rows.map((r, i) => /* @__PURE__ */ jsx(TableRow, { children: r.map((x, k) => /* @__PURE__ */ jsx(TableCell, { children: x }, k)) }, i)) })
  ] });
}
function editorLines(s, j) {
  return currentLines(s, j).filter((l) => !l.is_tax_line).map((l) => {
    const side = l.entry_side || (l.debit_amount ? "DEBIT" : "CREDIT");
    const n = l.input_amount ?? (l.debit_amount || l.credit_amount);
    return { ...l, subaccount_name: subaccountName(s,l), original_line_id: l.id, debit_amount: side === "DEBIT" ? n : 0, credit_amount: side === "CREDIT" ? n : 0, amount_input_type: l.amount_input_type || "NET", tax_override: l.tax_status === "SET" && l.tax_amount !== l.calculated_tax_amount ? String(l.tax_amount) : "", tax_adjustment_reason: l.tax_adjustment_reason || "" };
  });
}
function TaxLineEditor({ s, editor, setEditor }) {
  const old = s.journals.find((j) => j.id === editor.id);
  let preview = [];
  let error = "";
  try {
    preview = expandTaxLines(s, editor.lines, editor.transaction_date, old ? currentLines(s, old) : [], old?.transaction_date);
  } catch (e) {
    error = e.message;
  }
  const sum = (key) => preview.reduce((n, l) => n + BigInt(l[key] || 0), 0n);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("p", { className: "muted", children: [
      "\u6D88\u8CBB\u7A0E\uFF1A",
      roundingNames[s.company.tax_rounding || "FLOOR"],
      "\uFF08\u660E\u7D30\u5358\u4F4D\uFF09\u3002\u7A0E\u60C5\u5831\u672A\u8A2D\u5B9A\u306E\u660E\u7D30\u306F\u5165\u529B\u984D\u3092\u305D\u306E\u307E\u307E\u8A18\u5E33\u3057\u307E\u3059\u3002"
    ] }),
    /* @__PURE__ */ jsx("div", { className: "line-editor tax-entry", children: /* @__PURE__ */ jsxs(Table, { children: [
      /* @__PURE__ */ jsx(TableHeader, { children: /* @__PURE__ */ jsx(TableRow, { children: ["\u52D8\u5B9A\u79D1\u76EE / \u88DC\u52A9\u79D1\u76EE", "\u501F\u8CB8", "\u5165\u529B\u65B9\u5F0F", "\u7A0E\u533A\u5206 / \u7A0E\u7387", "\u5165\u529B\u91D1\u984D\uFF08\u5186\uFF09", "\u8A08\u7B97\u7D50\u679C\uFF08\u5186\uFF09", "\u7A0E\u984D\u8ABF\u6574\uFF08\u4EFB\u610F\uFF09", "\u660E\u7D30\u6458\u8981", ""].map((h) => /* @__PURE__ */ jsx(TableHead, { children: h }, h)) }) }),
      /* @__PURE__ */ jsx(TableBody, { children: editor.lines.map((l, i) => {
        const side = l.entry_side || (l.credit_amount ? "CREDIT" : "DEBIT"), value = side === "DEBIT" ? l.debit_amount : l.credit_amount;
        function update(p) {
          const ls = [...editor.lines];
          ls[i] = { ...l, ...p };
          setEditor({ ...editor, lines: ls });
        }
        function fillCounterAmount() {
          if (editor.lines.length !== 2 || !value || Number(value) <= 0) return;
          const other = editor.lines[1-i];
          const otherSide = other.entry_side || (other.credit_amount ? "CREDIT" : "DEBIT");
          if (other.debit_amount || other.credit_amount) return;
          const ls = [...editor.lines];
          ls[1-i] = {...other, debit_amount:otherSide === "DEBIT" ? value : 0, credit_amount:otherSide === "CREDIT" ? value : 0};
          setEditor({...editor,lines:ls});
        }
        let calc = preview.filter((x) => !x.is_tax_line)[i];
        if (!calc) {
          try {
            calc = calculateTax(value || 0, l.amount_input_type || "NET", s.tax_codes.find((t) => t.tax_code === l.tax_code), s.company.tax_rounding || "FLOOR", l.tax_override, l.tax_adjustment_reason || "");
          } catch {
          }
        }
        return /* @__PURE__ */ jsxs(TableRow, { children: [
          /* @__PURE__ */ jsxs(TableCell, { children: [
            /* @__PURE__ */ jsx(Choose, { label: "\u52D8\u5B9A\u79D1\u76EE", value: l.account_id, options: [["", "\u79D1\u76EE\u3092\u9078\u629E"], ...s.accounts.filter((a) => a.active).sort((a,b) => a.account_code.localeCompare(b.account_code, "ja", {numeric:true})).map((a) => [a.id, a.account_name])], onChange: (v) => update({ account_id: v, subaccount_id: "", subaccount_name: "", subaccount_search: "", tax_code: s.accounts.find((a) => a.id === v)?.default_tax_code || "UNSPECIFIED", tax_override: "", tax_adjustment_reason: "" }) }),
            jsx(SubaccountInput, { s, editor, line: l, inputId:i, onChange:update })
          ] }),
          /* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsx(Choose, { label: "\u501F\u8CB8", value: side, options: [["DEBIT", "\u501F\u65B9"], ["CREDIT", "\u8CB8\u65B9"]], onChange: (v) => update({ entry_side: v, debit_amount: v === "DEBIT" ? value : 0, credit_amount: v === "CREDIT" ? value : 0 }) }) }),
          /* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsx(Choose, { label: "\u5165\u529B\u65B9\u5F0F", value: l.amount_input_type || "NET", options: [["NET", "\u7A0E\u629C"], ["GROSS", "\u7A0E\u8FBC"]], onChange: (v) => update({ amount_input_type: v }) }) }),
          /* @__PURE__ */ jsxs(TableCell, { children: [
            /* @__PURE__ */ jsx(Choose, { label: "\u7A0E\u533A\u5206", value: l.tax_code || "UNSPECIFIED", options: [["UNSPECIFIED", "\u7A0E\u60C5\u5831\u672A\u8A2D\u5B9A"], ...orderedTaxCodes(s).filter((t) => t.active || t.tax_code === l.tax_code).map((t) => [t.tax_code, t.tax_name + (t.active ? "" : "\uFF08\u7121\u52B9\uFF09")])], onChange: (v) => update({ tax_code: v, tax_override: "", tax_adjustment_reason: "" }) }),
            /* @__PURE__ */ jsx("small", { children: calc?.tax_rate != null ? `${calc.tax_rate}%\uFF08\u4FDD\u5B58\u6642\u70B9\uFF09` : "\u7A0E\u7387\u672A\u8A2D\u5B9A" })
          ] }),
          /* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsx(Input, { "aria-label": `${i + 1}\u884C\u76EE\u306E\u5165\u529B\u91D1\u984D`, type: "number", min: "1", step: "1", value: value || "", onBlur: fillCounterAmount, onChange: (e) => update({ debit_amount: side === "DEBIT" ? e.target.value : 0, credit_amount: side === "CREDIT" ? e.target.value : 0 }) }) }),
          /* @__PURE__ */ jsx(TableCell, { children: calc?.tax_status === "SET" ? /* @__PURE__ */ jsxs("div", { className: "tax-breakdown", children: [
            "\u7A0E\u8FBC ",
            money(calc.gross_amount),
            /* @__PURE__ */ jsx("br", {}),
            "\uFF1D\u7A0E\u629C ",
            money(calc.taxable_amount),
            /* @__PURE__ */ jsx("br", {}),
            "\uFF0B\u6D88\u8CBB\u7A0E ",
            money(calc.tax_amount)
          ] }) : /* @__PURE__ */ jsxs("span", { className: "muted", children: [
            "\u5165\u529B\u984D\u3092\u8A18\u5E33",
            /* @__PURE__ */ jsx("br", {}),
            "\u7A0E\u60C5\u5831\u672A\u8A2D\u5B9A"
          ] }) }),
          /* @__PURE__ */ jsxs(TableCell, { children: [
            /* @__PURE__ */ jsx(Input, { "aria-label": "\u8ABF\u6574\u5F8C\u7A0E\u984D", type: "number", min: "0", step: "1", placeholder: "\u81EA\u52D5\u8A08\u7B97", value: l.tax_override ?? "", onChange: (e) => update({ tax_override: e.target.value }) }),
            l.tax_override !== "" && l.tax_override != null && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsxs("small", { children: [
                "\u8ABF\u6574\u524D ",
                money(calc?.calculated_tax_amount),
                " \u5186"
              ] }),
              /* @__PURE__ */ jsx(Input, { "aria-label": "\u7A0E\u984D\u8ABF\u6574\u7406\u7531", placeholder: "\u8ABF\u6574\u7406\u7531", maxLength: 300, value: l.tax_adjustment_reason || "", onChange: (e) => update({ tax_adjustment_reason: e.target.value }) })
            ] })
          ] }),
          /* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsx(Input, { "aria-label": "\u660E\u7D30\u6458\u8981", value: l.line_description || "", onChange: (e) => update({ line_description: e.target.value }) }) }),
          /* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsx(Button, { type: "button", variant: "ghost", disabled: editor.lines.length <= 2, onClick: () => setEditor({ ...editor, lines: editor.lines.filter((_, k) => i !== k) }), children: "\u884C\u3092\u5916\u3059" }) })
        ] }, i);
      }) })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "entry-total", children: [
      /* @__PURE__ */ jsx(Button, { type: "button", variant: "outline", disabled: editor.lines.length >= 100, onClick: () => setEditor({ ...editor, lines: [...editor.lines, { account_id: "", subaccount_id: "", debit_amount: "", credit_amount: 0, entry_side: "DEBIT", amount_input_type: "NET", tax_code: "UNSPECIFIED", tax_override: "", tax_adjustment_reason: "" }] }), children: "\u660E\u7D30\u884C\u3092\u8FFD\u52A0" }),
      /* @__PURE__ */ jsxs("strong", { children: [
        "\u78BA\u5B9A\u6642\u306E\u501F\u65B9 ",
        money(sum("debit_amount")),
        " / \u8CB8\u65B9 ",
        money(sum("credit_amount")),
        " \u5186"
      ] })
    ] }),
    error && /* @__PURE__ */ jsxs("p", { className: "alert", children: [
      "\u5165\u529B\u78BA\u8A8D\uFF1A",
      error
    ] }),
    !error && sum("debit_amount") !== sum("credit_amount") && /* @__PURE__ */ jsxs("p", { className: "alert", children: [
      "\u8CB8\u501F\u5DEE\u984D ",
      money(sum("debit_amount") - sum("credit_amount")),
      " \u5186\u3002\u73FE\u9810\u91D1\u30FB\u58F2\u639B\u91D1\u7B49\u306E\u76F8\u624B\u5074\u306B\u306F\u7A0E\u8FBC\u7DCF\u984D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
    ] }),
    preview.some((l) => l.is_tax_line) && /* @__PURE__ */ jsxs("details", { children: [
      /* @__PURE__ */ jsx("summary", { children: "\u78BA\u5B9A\u3059\u308B\u4ED5\u8A33\uFF08\u81EA\u52D5\u7A0E\u660E\u7D30\u3092\u542B\u3080\uFF09\u3092\u78BA\u8A8D" }),
      /* @__PURE__ */ jsx(DataTable, { heads: ["\u79D1\u76EE", "\u501F\u65B9", "\u8CB8\u65B9", "\u533A\u5206"], rows: preview.map((l) => [s.accounts.find((a) => a.id === l.account_id)?.account_name, money(l.debit_amount), money(l.credit_amount), l.is_tax_line ? "\u81EA\u52D5\u7A0E\u660E\u7D30" : "\u672C\u4F53\u660E\u7D30"]) })
    ] })
  ] });
}
function TaxDetails({ lines }) {
  return /* @__PURE__ */ jsx(DataTable, { heads: ["\u5165\u529B\u65B9\u5F0F", "\u5165\u529B\u984D", "\u7A0E\u533A\u5206", "\u7A0E\u7387", "\u7A0E\u629C", "\u7A0E\u984D", "\u7A0E\u8FBC", "\u7A0E\u984D\u8ABF\u6574"], rows: lines.map((l) => [l.is_tax_line ? "\u81EA\u52D5\u7A0E\u660E\u7D30" : l.amount_input_type === "GROSS" ? "\u7A0E\u8FBC" : l.amount_input_type === "NET" ? "\u7A0E\u629C" : "\u65E7\u660E\u7D30", money(l.input_amount), l.tax_status === "SET" ? l.tax_code : l.is_tax_line ? "\u5BFE\u8C61\u5916" : "\u7A0E\u60C5\u5831\u672A\u8A2D\u5B9A", l.tax_rate == null ? "\u672A\u8A2D\u5B9A" : l.tax_rate + "%", money(l.taxable_amount), money(l.tax_amount), money(l.gross_amount), l.tax_adjustment_reason ? `${money(l.calculated_tax_amount)} \u2192 ${money(l.tax_amount)} / ${l.tax_adjustment_reason}` : "\u2014"]) });
}
function TaxWorkspace({ s, start, end, page, act, onPrepare }) {
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  function moveTaxCode(index, direction) {
    const ids = orderedTaxCodes(s).map((t) => t.id);
    const next = index + direction;
    if (busy || next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    submit({ type: "tax_order", ids });
  }
  async function submit(c) {
    setBusy(true);
    setError("");
    try {
      if (await act(c)) setForm(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!s.company.tax_accounts) return /* @__PURE__ */ jsxs("section", { className: "panel", children: [
    /* @__PURE__ */ jsx("h2", { children: "\u6D88\u8CBB\u7A0E\u6A5F\u80FD\u306E\u521D\u671F\u8A2D\u5B9A" }),
    /* @__PURE__ */ jsx("p", { children: "\u3053\u306E\u4F1A\u793E\u306B7\u3064\u306E\u7A0E\u533A\u5206\u3068\u4EEE\u6255\u6D88\u8CBB\u7A0E\u30FB\u4EEE\u53D7\u6D88\u8CBB\u7A0E\u30FB\u672A\u6255\u6D88\u8CBB\u7A0E\u7B49\u3092\u8FFD\u52A0\u3057\u307E\u3059\u3002\u904E\u53BB\u4ED5\u8A33\u306F\u7A0E\u60C5\u5831\u672A\u8A2D\u5B9A\u306E\u307E\u307E\u4FDD\u6301\u3057\u307E\u3059\u3002" }),
    /* @__PURE__ */ jsx(Button, { disabled: busy, onClick: () => submit({ type: "tax_setup" }), children: "\u3053\u306E\u4F1A\u793E\u3067\u7A0E\u629C\u7D4C\u7406\u3092\u6709\u52B9\u306B\u3059\u308B" })
  ] });
  let r = null;
  try {
    r = taxReport(s, start, end);
  } catch {
  }
  function candidate(payment) {
    if (!r) return;
    const a = s.company.tax_accounts;
    const n = BigInt(payment ? r.balances.payable.closing : r.net_balance), out = BigInt(r.balances.output.closing), input = BigInt(r.balances.input.closing);
    if (n <= 0n || !payment && (out < 0n || input < 0n)) {
      setError("\u6B63\u306E\u7D0D\u4ED8\u898B\u8FBC\u307F\u984D\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u9084\u4ED8\u30FB\u30DE\u30A4\u30CA\u30B9\u6B8B\u9AD8\u306F\u901A\u5E38\u4ED5\u8A33\u3067\u6574\u7406\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      return;
    }
    const line = (id, d, c) => ({ account_id: id, debit_amount: String(d), credit_amount: String(c), entry_side: d > 0n ? "DEBIT" : "CREDIT", tax_code: "OUT", amount_input_type: "NET", tax_override: "", line_description: "" });
    const ls = payment ? [line(a.payable, n, 0n), line(s.accounts.find((x) => x.account_code === "1100")?.id || "", 0n, n)] : [line(a.output, out, 0n), ...input > 0n ? [line(a.input, 0n, input)] : [], line(a.payable, 0n, n)];
    onPrepare({ type: "journal", journal_kind: payment ? "TAX_PAYMENT" : "TAX_SETTLEMENT", transaction_date: end, description: payment ? "\u6D88\u8CBB\u7A0E\u7D0D\u4ED8" : "\u6D88\u8CBB\u7A0E\u6C7A\u7B97\u6574\u7406\uFF08\u5E33\u7C3F\u6B8B\u9AD8\u304B\u3089\u4F5C\u6210\u30FB\u672A\u78BA\u5B9A\uFF09", counterparty: "", lines: ls, reason: "" });
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    error && /* @__PURE__ */ jsx("p", { className: "alert", children: error }),
    page === "\u6D88\u8CBB\u7A0E\u96C6\u8A08\u8868" && r ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("section", { className: "panel", children: [
        /* @__PURE__ */ jsx("h2", { children: "\u6D88\u8CBB\u7A0E\u96C6\u8A08\u8868" }),
        /* @__PURE__ */ jsx("p", { className: "muted", children: "\u78BA\u5B9A\u6642\u306E\u7A0E\u60C5\u5831\u3092\u96C6\u8A08\u3002\u81EA\u52D5\u7A0E\u660E\u7D30\u3068\u524A\u9664\u6E08\u307F\u4ED5\u8A33\u306F\u9664\u5916\u3002\u8FD4\u54C1\u30FB\u53D6\u6D88\u65B9\u5411\u306F\u30DE\u30A4\u30CA\u30B9\u3067\u96C6\u8A08\u3057\u307E\u3059\u3002" }),
        r.unknown > 0 && /* @__PURE__ */ jsxs("p", { className: "alert", children: [
          "\u7A0E\u60C5\u5831\u672A\u8A2D\u5B9A\uFF1A",
          r.unknown,
          "\u660E\u7D30\u3002\u904E\u53BB\u4ED5\u8A33\u306E\u7A0E\u60C5\u5831\u306F\u63A8\u6E2C\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u3053\u306E\u96C6\u8A08\u3060\u3051\u3067\u306F\u7533\u544A\u7A0E\u984D\u3092\u78BA\u5B9A\u3067\u304D\u307E\u305B\u3093\u3002"
        ] }),
        /* @__PURE__ */ jsx(DataTable, { heads: ["\u7A0E\u533A\u5206", "\u7A0E\u7387", "\u7A0E\u629C\u53D6\u5F15\u91D1\u984D", "\u6D88\u8CBB\u7A0E\u984D", "\u7A0E\u8FBC\u91D1\u984D", "\u660E\u7D30\u4EF6\u6570", "\u4ED5\u8A33\u4EF6\u6570"], rows: r.rows.map((g) => [g.tax_name, `${g.tax_rate}%`, money(g.taxable_amount), money(g.tax_amount), money(g.gross_amount), g.count, g.journal_count]) })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "panel", children: [
        /* @__PURE__ */ jsx("h2", { children: "\u6D88\u8CBB\u7A0E\u52D8\u5B9A\u3068\u306E\u7167\u5408" }),
        /* @__PURE__ */ jsx(DataTable, { heads: ["\u52D8\u5B9A", "\u671F\u9996\u6B8B\u9AD8", "\u7A0E\u60C5\u5831\u306E\u671F\u9593\u7A0E\u984D", "\u5143\u5E33\u306E\u671F\u9593\u5897\u6E1B", "\u3046\u3061\u624B\u52D5\u4ED5\u8A33", "\u671F\u672B\u6B8B\u9AD8", "\u5DEE\u984D\uFF08\u5897\u6E1B\u2212\u7A0E\u60C5\u5831\uFF09"], rows: ["input", "output", "payable"].map((k, i) => {
          const b = r.balances[k];
          return [["\u4EEE\u6255\u6D88\u8CBB\u7A0E", "\u4EEE\u53D7\u6D88\u8CBB\u7A0E", "\u672A\u6255\u6D88\u8CBB\u7A0E\u7B49"][i], money(b.opening), k === "payable" ? "\u2014" : money(b.snapshot), money(b.movement), money(b.manual), money(b.closing), k === "payable" ? "\u2014" : money(b.difference)];
        }) }),
        /* @__PURE__ */ jsxs("p", { children: [
          "\u4EEE\u53D7\u2212\u4EEE\u6255\u306E\u671F\u672B\u6B8B\u9AD8\u5DEE\uFF1A",
          /* @__PURE__ */ jsxs("strong", { children: [
            money(r.net_balance),
            " \u5186"
          ] })
        ] }),
        ["input", "output"].some((k) => r.balances[k].difference !== "0") && /* @__PURE__ */ jsx("p", { className: "alert", children: "\u7A0E\u60C5\u5831\u96C6\u8A08\u3068\u5143\u5E33\u5897\u6E1B\u306B\u5DEE\u984D\u304C\u3042\u308A\u307E\u3059\u3002\u6C7A\u7B97\u6574\u7406\u30FB\u624B\u52D5\u8ABF\u6574\u30FB\u958B\u59CB\u6B8B\u9AD8\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u81EA\u52D5\u4FEE\u6B63\u306F\u884C\u3044\u307E\u305B\u3093\u3002" }),
        /* @__PURE__ */ jsx("p", { className: "muted", children: "\u671F\u672B\u6B8B\u9AD8\u306F\u671F\u9996\u6B8B\u9AD8\u3092\u542B\u307F\u307E\u3059\u3002\u6D88\u8CBB\u7A0E\u7533\u544A\u306E\u7D0D\u4ED8\u984D\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002" }),
        /* @__PURE__ */ jsxs("div", { className: "row", children: [
          /* @__PURE__ */ jsx(Button, { onClick: () => candidate(false), children: "\u6C7A\u7B97\u6574\u7406\u4ED5\u8A33\u306E\u5019\u88DC\u3092\u958B\u304F" }),
          /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: () => candidate(true), children: "\u7D0D\u4ED8\u4ED5\u8A33\u306E\u5019\u88DC\u3092\u958B\u304F" })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "muted", children: "\u5019\u88DC\u306F\u672A\u78BA\u5B9A\u3067\u3059\u3002\u7533\u544A\u30FB\u78BA\u5B9A\u7A0E\u984D\u3068\u306E\u5DEE\u984D\u306F\u901A\u5E38\u4ED5\u8A33\u3067\u8ABF\u6574\u3057\u3001\u78BA\u8A8D\u5F8C\u306B\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002" })
      ] })
    ] }) : page === "\u7A0E\u533A\u5206\u30FB\u8A2D\u5B9A" ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("section", { className: "panel", children: [
        /* @__PURE__ */ jsxs("div", { className: "section-title", children: [
          /* @__PURE__ */ jsx("h2", { children: "\u7A0E\u533A\u5206\u30DE\u30B9\u30BF\u30FC" }),
          /* @__PURE__ */ jsx(Button, { onClick: () => setForm({ type: "tax_code", tax_code: "", tax_name: "", tax_type: "SALES", tax_rate: "10", effective_from: "2026-01-01", effective_to: "", active: true, reason: "" }), children: "\u65B0\u3057\u3044\u7A0E\u533A\u5206" })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "muted", children: "\u7A0E\u7387\u30FB\u7A2E\u5225\u30FB\u30B3\u30FC\u30C9\u306F\u4F5C\u6210\u5F8C\u306B\u4E0A\u66F8\u304D\u3067\u304D\u307E\u305B\u3093\u3002\u7A0E\u7387\u5909\u66F4\u306F\u65B0\u3057\u3044\u533A\u5206\u3092\u8FFD\u52A0\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }),
        /* @__PURE__ */ jsx(DataTable, { heads: ["\u30B3\u30FC\u30C9", "\u540D\u79F0", "\u7A2E\u5225", "\u7A0E\u7387", "\u9069\u7528\u671F\u9593", "\u72B6\u614B", "\u64CD\u4F5C"], rows: orderedTaxCodes(s).map((t, index) => [t.tax_code, t.tax_name, taxTypes[t.tax_type], `${t.tax_rate}%`, `${t.effective_from} \u301C ${t.effective_to || "\u671F\u9650\u306A\u3057"}`, t.active ? "\u6709\u52B9" : "\u7121\u52B9", /* @__PURE__ */ jsxs("div", { className: "row", children: [ jsx(Button, { variant: "ghost", onClick: () => setForm({ ...t, type: "tax_code", effective_to: t.effective_to || "", reason: "" }), children: "\u5909\u66F4" }), ...[-1, 1].map((direction) => jsx(Button, { variant: "outline", size: "sm", disabled: busy || index + direction < 0 || index + direction >= s.tax_codes.length, "aria-label": `${t.tax_name}を${direction < 0 ? "上" : "下"}へ移動`, onClick: () => moveTaxCode(index, direction), children: direction < 0 ? "↑" : "↓" }, direction)) ] })]) })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "panel", children: [
        /* @__PURE__ */ jsx("h2", { children: "\u8A08\u7B97\u8A2D\u5B9A" }),
        /* @__PURE__ */ jsxs("p", { children: [
          "\u4F1A\u8A08\u65B9\u5F0F\uFF1A\u7A0E\u629C\u7D4C\u7406 / \u7AEF\u6570\u51E6\u7406\uFF1A",
          roundingNames[s.company.tax_rounding || "FLOOR"],
          "\uFF08\u660E\u7D30\u306E\u7A0E\u984D\u5358\u4F4D\uFF09"
        ] }),
        /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: () => setForm({ type: "tax_settings", tax_rounding: s.company.tax_rounding || "FLOOR", reason: "" }), children: "\u7AEF\u6570\u51E6\u7406\u3092\u5909\u66F4" }),
        /* @__PURE__ */ jsx("p", { className: "muted", children: "\u8A2D\u5B9A\u5909\u66F4\u306F\u904E\u53BB\u4ED5\u8A33\u3092\u518D\u8A08\u7B97\u3057\u307E\u305B\u3093\u3002\u8ACB\u6C42\u66F8\u5358\u4F4D\u30FB\u7A0E\u7387\u3054\u3068\u306E\u7AEF\u6570\u3068\u306E\u5DEE\u306F\u5165\u529B\u6642\u306B\u7A0E\u984D\u8ABF\u6574\u3057\u3066\u304F\u3060\u3055\u3044\u3002" })
      ] })
    ] }) : null,
    /* @__PURE__ */ jsx(Dialog, { open: !!form, onOpenChange: (v) => !v && setForm(null), children: /* @__PURE__ */ jsxs(DialogContent, { children: [
      /* @__PURE__ */ jsxs(DialogHeader, { children: [
        /* @__PURE__ */ jsx(DialogTitle, { children: form?.type === "tax_settings" ? "\u7AEF\u6570\u51E6\u7406\u8A2D\u5B9A" : "\u7A0E\u533A\u5206\u306E\u767B\u9332\u30FB\u5909\u66F4" }),
        /* @__PURE__ */ jsx(DialogDescription, { children: "\u5909\u66F4\u306F\u76E3\u67FB\u5C65\u6B74\u306B\u8A18\u9332\u3057\u307E\u3059\u3002" })
      ] }),
      form && /* @__PURE__ */ jsx("form", { onSubmit: (e) => {
        e.preventDefault();
        submit(form);
      }, children: /* @__PURE__ */ jsxs("fieldset", { disabled: busy, children: [
        /* @__PURE__ */ jsxs("div", { className: "modalfields", children: [
          form.type === "tax_settings" ? /* @__PURE__ */ jsx(Choose, { label: "\u7AEF\u6570\u51E6\u7406", value: form.tax_rounding, options: Object.entries(roundingNames), onChange: (v) => setForm({ ...form, tax_rounding: v }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs("label", { className: "field", children: [
              "\u30B3\u30FC\u30C9",
              /* @__PURE__ */ jsx(Input, { required: true, disabled: !!form.id, value: form.tax_code, onChange: (e) => setForm({ ...form, tax_code: e.target.value }) })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "field", children: [
              "\u540D\u79F0",
              /* @__PURE__ */ jsx(Input, { required: true, value: form.tax_name, onChange: (e) => setForm({ ...form, tax_name: e.target.value }) })
            ] }),
            form.id ? /* @__PURE__ */ jsxs("p", { children: [
              taxTypes[form.tax_type],
              " / ",
              form.tax_rate,
              "%\uFF08\u5909\u66F4\u4E0D\u53EF\uFF09"
            ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(Choose, { label: "\u7A0E\u533A\u5206\u7A2E\u5225", value: form.tax_type, options: Object.entries(taxTypes), onChange: (v) => setForm({ ...form, tax_type: v, tax_rate: ["SALES", "PURCHASE"].includes(v) ? "10" : "0" }) }),
              /* @__PURE__ */ jsxs("label", { className: "field", children: [
                "\u7A0E\u7387\uFF08%\uFF09",
                /* @__PURE__ */ jsx(Input, { required: true, type: "number", step: "0.01", min: "0", max: "100", value: form.tax_rate, onChange: (e) => setForm({ ...form, tax_rate: e.target.value }) })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "field", children: [
              "\u9069\u7528\u958B\u59CB\u65E5",
              /* @__PURE__ */ jsx(Input, { required: true, type: "date", value: form.effective_from, onChange: (e) => setForm({ ...form, effective_from: e.target.value }) })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "field", children: [
              "\u9069\u7528\u7D42\u4E86\u65E5\uFF08\u4EFB\u610F\uFF09",
              /* @__PURE__ */ jsx(Input, { type: "date", value: form.effective_to, onChange: (e) => setForm({ ...form, effective_to: e.target.value }) })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "row", children: [
              /* @__PURE__ */ jsx(Checkbox, { checked: form.active, onCheckedChange: (v) => setForm({ ...form, active: v === true }) }),
              "\u6709\u52B9"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "field", children: [
            "\u7406\u7531",
            /* @__PURE__ */ jsx(Input, { required: true, maxLength: 300, value: form.reason, onChange: (e) => setForm({ ...form, reason: e.target.value }) })
          ] })
        ] }),
        /* @__PURE__ */ jsx(Button, { type: "submit", children: "\u4FDD\u5B58" })
      ] }) })
    ] }) })
  ] });
}
export {
  TaxDetails,
  TaxLineEditor,
  TaxWorkspace,
  editorLines
};
