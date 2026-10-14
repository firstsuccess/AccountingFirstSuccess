"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import {SubaccountWorkspace} from "./subaccount-ui.js";
import {subaccountName,inputModes,assistModes} from "../lib/accounting/subaccounts.js";
import { OpeningBalances } from "./opening-balances";
import { CSVImport } from "./csv-import";
import { TaxLineEditor, TaxWorkspace, TaxDetails, editorLines } from "./tax-ui";
import { BookOpen, LayoutDashboard, PenLine, List, BookText, Scale, ChartNoAxesCombined, Landmark, Tags, FolderTree, CalendarDays, History, Settings, Download, Plus, CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { sections, sectionTypes, currentLines, orderedTaxCodes, canEdit, reports, ledger, csv } from "@/lib/accounting/core";
const nav = [["\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9", LayoutDashboard], ["\u4ED5\u8A33\u5165\u529B", PenLine], ["\u4ED5\u8A33\u5E33", List], ["\u7DCF\u52D8\u5B9A\u5143\u5E33", BookText], ["\u8A66\u7B97\u8868", Scale], ["P/L", ChartNoAxesCombined], ["B/S", Landmark], ["\u52D8\u5B9A\u79D1\u76EE", Tags], ["補助元帳・残高", FolderTree], ["\u88DC\u52A9\u79D1\u76EE", FolderTree], ["\u4F1A\u8A08\u671F\u9593", CalendarDays], ["\u6D88\u8CBB\u7A0E\u96C6\u8A08\u8868", Scale], ["\u7A0E\u533A\u5206\u30FB\u8A2D\u5B9A", Tags], ["CSV\u53D6\u8FBC", Download], ["\u76E3\u67FB\u30ED\u30B0", History], ["\u8A2D\u5B9A", Settings]];
const money = (n) => BigInt(n || 0).toLocaleString("ja-JP");
function Choice({ value, onChange, options, label = "\u9078\u629E" }) {
  return /* @__PURE__ */ jsxs(Select, { value: value || "_", onValueChange: (v) => onChange(v === "_ " ? "" : v === "_" ? "" : v), children: [
    /* @__PURE__ */ jsx(SelectTrigger, { "aria-label": label, children: /* @__PURE__ */ jsx(SelectValue, { placeholder: label }) }),
    /* @__PURE__ */ jsx(SelectContent, { children: options.map((o) => /* @__PURE__ */ jsx(SelectItem, { value: o[0] || "_", children: o[1] }, o[0] || "_")) })
  ] });
}
function Field({ label, children }) {
  return /* @__PURE__ */ jsxs("label", { className: "field", children: [
    /* @__PURE__ */ jsx("span", { children: label }),
    children
  ] });
}
function GridTable({ heads, rows }) {
  return /* @__PURE__ */ jsxs(Table, { children: [
    /* @__PURE__ */ jsx(TableHeader, { children: /* @__PURE__ */ jsx(TableRow, { children: heads.map((h, i) => /* @__PURE__ */ jsx(TableHead, { children: h }, i)) }) }),
    /* @__PURE__ */ jsx(TableBody, { children: rows.length ? rows.map((r, i) => /* @__PURE__ */ jsx(TableRow, { children: r.map((v, k) => /* @__PURE__ */ jsx(TableCell, { children: v }, k)) }, i)) : /* @__PURE__ */ jsx(TableRow, { children: /* @__PURE__ */ jsx(TableCell, { colSpan: heads.length, className: "empty", children: "\u8A72\u5F53\u3059\u308B\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093" }) }) })
  ] });
}
function Check({ ok, label }) {
  return /* @__PURE__ */ jsxs("div", { className: ok ? "check good" : "check bad", children: [
    /* @__PURE__ */ jsx(CheckCircle2, { size: 18 }),
    label,
    "\uFF1A",
    ok ? "\u4E00\u81F4" : "\u4E0D\u4E00\u81F4\u30FB\u8981\u78BA\u8A8D"
  ] });
}
function download(text, name, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function AccountingApp() {
  const [companies, setCompanies] = useState([]), [s, setS] = useState(null), [page, setPage] = useState("\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9"), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [start, setStart] = useState(""), [end, setEnd] = useState(""), [yearId, setYearId] = useState(""), [editor, setEditor] = useState(null), [modal, setModal] = useState(null), [confirm, setConfirm] = useState(null), [reason, setReason] = useState(""), [detail, setDetail] = useState(null), [user, setUser] = useState("");
  const [filters, setFilters] = useState({ number: "", account: "", sub: "", description: "", counterparty: "", min: "", max: "", deleted: false }), [ledgerId, setLedgerId] = useState("");
  const [archivedCompanies, setArchivedCompanies] = useState([]);
  const blank = () => ({ type: "journal", transaction_date: start, description: "", counterparty: "", lines: [{ account_id: "", subaccount_id: "", debit_amount: "", credit_amount: "", line_description: "" }, { account_id: "", subaccount_id: "", debit_amount: "", credit_amount: "", line_description: "" }], reason: "" });
  async function listCompanies() {
    const r = await fetch("/api/accounting");
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setCompanies(d.companies);
    setArchivedCompanies(d.archived_companies || []);
    setUser(d.user);
    return d.companies;
  }
  function selectYear(state, id) {
    const y = state.years.find((y2) => y2.id === id) || [...state.years].sort((a, b) => a.start.localeCompare(b.start))[0];
    setYearId(y.id);
    setStart(y.start);
    setEnd(state.periods.filter((p) => p.year_id === y.id).sort((a, b) => a.start.localeCompare(b.start))[0]?.end || y.end);
  }
  async function loadCompany(id, reset = true) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/accounting?company=${id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setS(d);
      if (reset) {
        selectYear(d);
        setLedgerId(d.accounts[0]?.id || "");
        setEditor(null);
        setFilters({ number: "", account: "", sub: "", description: "", counterparty: "", min: "", max: "", deleted: false });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    listCompanies().then(async (cs) => {
      if (cs[0]) await loadCompany(cs[0].id);
    }).catch((e) => setError(e.message));
  }, []);
  async function act(command) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/accounting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...command, company_id: command.company_id || s?.company.id, version: command.version ?? s?.company.version }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setS(d);
      if (command.type === "create" || command.type === "test") {
        selectYear(d);
        setLedgerId(d.accounts[0]?.id || "");
      }
      const available = await listCompanies();
      if (command.type === "company_archive") {
        setEditor(null); setDetail(null);
        if (d.company.archived) {
          setS(null);
          if (available[0]) await loadCompany(available[0].id);
        } else { selectYear(d); setLedgerId(d.accounts[0]?.id || ""); }
        setPage("\u8A2D\u5B9A");
      }
      setNotice("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
      setModal(null);
      setConfirm(null);
      if (command.type === "journal") {
        setEditor(null);
        setPage("\u4ED5\u8A33\u5E33");
      }
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const report = useMemo(() => {
    if (!s || !start || !end) return null;
    try {
      return reports(s, start, end);
    } catch {
      return null;
    }
  }, [s, start, end]);
  const accountName = (id) => s?.accounts.find((a) => a.id === id)?.account_name || id;
  const subName = (id) => s?.subaccounts.find((a) => a.id === id)?.name || "";
  const filtered = useMemo(() => s?.journals.filter((j) => {
    if (j.transaction_date < start || j.transaction_date > end || !filters.deleted && j.status === "DELETED") return false;
    const ls = currentLines(s, j);
    const n = ls.reduce((n2, l) => n2 + BigInt(l.debit_amount), 0n);
    return j.journal_number.includes(filters.number) && j.description.includes(filters.description) && j.counterparty.includes(filters.counterparty) && (!filters.account || ls.some((l) => l.account_id === filters.account && (!filters.sub || l.subaccount_id === filters.sub))) && (!filters.sub || ls.some((l) => l.subaccount_id === filters.sub)) && (!filters.subname || ls.some(l=>subaccountName(s,l).includes(filters.subname))) && (!filters.min || n >= BigInt(filters.min)) && (!filters.max || n <= BigInt(filters.max));
  }).sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.journal_number.localeCompare(b.journal_number)) || [], [s, start, end, filters]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const ac = new AbortController();
    Promise.resolve(context.registerTool({ name: "read_accounting_summary", title: "\u8868\u793A\u4E2D\u306E\u4F1A\u8A08\u96C6\u8A08\u3092\u8AAD\u3080", description: "\u73FE\u5728\u9078\u629E\u4E2D\u306E\u4F1A\u793E\u30FB\u671F\u9593\u306E\u8A66\u7B97\u8868\u6574\u5408\u6027\u3068P/L\u30FBB/S\u3092\u8AAD\u307F\u53D6\u308A\u307E\u3059\u3002\u78BA\u5B9A\u4ED5\u8A33\u3092\u5909\u66F4\u3057\u307E\u305B\u3093\u3002", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute(input) {
      if (!input || Object.keys(input).length) throw new Error("\u5165\u529B\u30D1\u30E9\u30E1\u30FC\u30BF\u30FC\u306F\u4E0D\u8981\u3067\u3059");
      if (!s || !report) throw new Error("\u4F1A\u793E\u3068\u6709\u52B9\u306A\u671F\u9593\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
      return { company: s.company.name, start, end, pl: report.pl, bs: report.bs, trial: report.trial };
    } }, { signal: ac.signal })).catch(() => {
    });
    return () => ac.abort();
  }, [s, report, start, end]);
  function go(p) {
    setPage(p);
    setNotice("");
    if (p === "\u4ED5\u8A33\u5165\u529B" && !editor) setEditor(blank());
  }
  function edit(j) {
    setEditor({ ...j, type: "journal", lines: editorLines(s, j), reason: "" });
    setPage("\u4ED5\u8A33\u5165\u529B");
  }
  function ask(c) {
    setConfirm(c);
    setReason("");
  }
  const exports = ["company", "journals", "lines", "accounts", "subaccounts", "years", "periods", "audit", "tax_codes"];
  return /* @__PURE__ */ jsxs(SidebarProvider, { children: [
    /* @__PURE__ */ jsxs(Sidebar, { children: [
      /* @__PURE__ */ jsxs(SidebarHeader, { className: "brand", children: [
        /* @__PURE__ */ jsx(BookOpen, {}),
        /* @__PURE__ */ jsxs("div", { children: [
          "もんじゃ会計",
          /* @__PURE__ */ jsx("small", { children: "/ Ver 0.1" })
        ] })
      ] }),
      /* @__PURE__ */ jsx(SidebarContent, { children: /* @__PURE__ */ jsx(SidebarMenu, { children: nav.map(([name, Icon]) => /* @__PURE__ */ jsx(SidebarMenuItem, { children: /* @__PURE__ */ jsxs(SidebarMenuButton, { isActive: page === name, onClick: () => go(name), children: [
        /* @__PURE__ */ jsx(Icon, {}),
        /* @__PURE__ */ jsx("span", { children: name })
      ] }) }, name)) }) }),
      /* @__PURE__ */ jsxs(SidebarFooter, { children: [
        /* @__PURE__ */ jsxs("div", { className: "private-note", children: [
          /* @__PURE__ */ jsx(ShieldCheck, { size: 16 }),
          "©ﾌｧｰｽﾄｻｸｾｽ合同会社"
        ] }),
        /* @__PURE__ */ jsx("small", { children: user })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(SidebarInset, { children: [
      /* @__PURE__ */ jsxs("header", { className: "topbar", children: [
        /* @__PURE__ */ jsxs("div", { className: "row", children: [
          /* @__PURE__ */ jsx(SidebarTrigger, {}),
          /* @__PURE__ */ jsx("span", { className: "muted", children: "\u30EF\u30FC\u30AF\u30B9\u30DA\u30FC\u30B9" }),
          /* @__PURE__ */ jsx(Choice, { label: "\u4F1A\u793E", value: s?.company.id || "", onChange: (id) => loadCompany(id), options: companies.length ? companies.map((c) => [c.id, c.name + (c.test ? "\uFF08\u30C6\u30B9\u30C8\uFF09" : "")]) : [["", "\u4F1A\u793E\u672A\u767B\u9332"]] })
      ] }),
        /* @__PURE__ */ jsxs(Button, { variant: "outline", disabled: busy, onClick: () => s && loadCompany(s.company.id, false), children: [
          /* @__PURE__ */ jsx(RefreshCw, { size: 15 }),
          "\u518D\u8AAD\u8FBC"
        ] })
          , /* @__PURE__ */ jsx(Button, { variant: "outline", className: "logout-button", onClick: async () => {
          try {
            const response = await fetch("/api/logout", { method: "POST" });
            if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || `ログアウトできませんでした（HTTP ${response.status}）`); }
            window.location.replace("/login");
          } catch (error) { setError(error.message || "ログアウトできませんでした"); }
        }, children: "ログアウト" })
      ] }),
      /* @__PURE__ */ jsxs("main", { className: "workspace", children: [
        /* @__PURE__ */ jsxs("div", { className: "page-heading", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("p", { className: "eyebrow", children: [
              s?.company.name || "\u521D\u671F\u8A2D\u5B9A",
              " ",
              s?.company.test && /* @__PURE__ */ jsx("span", { className: "badge", children: "\u30C6\u30B9\u30C8\u4F1A\u793E" })
            ] }),
            /* @__PURE__ */ jsx("h1", { children: page })
          ] }),
          s && /* @__PURE__ */ jsxs(Button, { disabled: busy, onClick: () => {
            setEditor(blank());
            setPage("\u4ED5\u8A33\u5165\u529B");
          }, children: [
            /* @__PURE__ */ jsx(Plus, { size: 16 }),
            "\u4ED5\u8A33\u3092\u5165\u529B"
          ] })
        ] }),
        error && /* @__PURE__ */ jsx("div", { className: "alert", role: "alert", children: error }),
        notice && /* @__PURE__ */ jsx("div", { className: "success", role: "status", children: notice }),
        (page === "\u8A2D\u5B9A" || !s) && jsxs("section", { className: "panel", children: [
          jsx("h2", { children: "会社のアーカイブ・復元" }),
          jsx("p", { children: "アーカイブすると通常の会社選択から非表示になります。仕訳・残高・設定・履歴は保存され、復元後も引き継がれます。年度のCLOSED・LOCKED状態も維持されます。" }),
          s && !s.company.archived && jsx(Button, { variant: "outline", disabled: busy, onClick: () => ask({ type: "company_archive", archived: true, company_id: s.company.id, version: s.company.version, title: s.company.name + " をアーカイブ" }), children: "この会社をアーカイブ" }),
          jsx("h3", { children: "アーカイブ済み会社" }),
          archivedCompanies.length ? jsx(GridTable, { heads: ["会社名", "操作"], rows: archivedCompanies.map((company) => [company.name, jsx(Button, { variant: "outline", disabled: busy, onClick: () => ask({ type: "company_archive", archived: false, company_id: company.id, version: company.version, title: company.name + " を復元" }), children: "復元して運用を再開" })]) }) : jsx("p", { className: "muted", children: "アーカイブ済み会社はありません。" })
        ] }),
        !s ? /* @__PURE__ */ jsxs("section", { className: "panel onboarding", children: [
          /* @__PURE__ */ jsx("h2", { children: "\u4F1A\u793E\u3068\u4F1A\u8A08\u5E74\u5EA6\u3092\u767B\u9332" }),
          /* @__PURE__ */ jsx("p", { children: "\u4F1A\u793E\u3054\u3068\u306B\u5E33\u7C3F\u3092\u5206\u3051\u3066\u4FDD\u5B58\u3057\u307E\u3059\u3002\u307E\u305A\u30C6\u30B9\u30C8\u4F1A\u793E\u306710\u7A2E\u985E\u306E\u53D6\u5F15\u3092\u78BA\u8A8D\u3059\u308B\u3053\u3068\u3082\u3067\u304D\u307E\u3059\u3002" }),
          /* @__PURE__ */ jsx(Button, { disabled: busy, onClick: () => setModal({ type: "create", name: "", start: "2026-04-01", end: "2027-03-31" }), children: "\u4F1A\u793E\u3092\u767B\u9332" }),
          /* @__PURE__ */ jsx(Button, { variant: "outline", disabled: busy, onClick: () => {
            const t = companies.find((c) => c.name === "\u30C6\u30B9\u30C8");
            if (t) loadCompany(t.id);
            else setError("\u65E2\u5B58\u306E\u300C\u30C6\u30B9\u30C8\u300D\u4F1A\u793E\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
          }, children: "\u65E2\u5B58\u306E\u30C6\u30B9\u30C8\u4F1A\u793E\u3092\u958B\u304F" })
        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          ["\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9", "\u4ED5\u8A33\u5E33", "\u7DCF\u52D8\u5B9A\u5143\u5E33", "\u8A66\u7B97\u8868", "P/L", "B/S", "\u6D88\u8CBB\u7A0E\u96C6\u8A08\u8868"].includes(page) && /* @__PURE__ */ jsxs("section", { className: "periodbar", children: [
            /* @__PURE__ */ jsx(Field, { label: "\u4F1A\u8A08\u5E74\u5EA6", children: /* @__PURE__ */ jsx(Choice, { value: yearId, onChange: (id) => selectYear(s, id), options: [...s.years].sort((a, b) => a.start.localeCompare(b.start)).map((y) => [y.id, `${y.start} \u301C ${y.end}`]) }) }),
            /* @__PURE__ */ jsx(Field, { label: "\u958B\u59CB\u65E5", children: /* @__PURE__ */ jsx(Input, { type: "date", value: start, onChange: (e) => setStart(e.target.value) }) }),
            /* @__PURE__ */ jsx(Field, { label: "\u7D42\u4E86\u65E5", children: /* @__PURE__ */ jsx(Input, { type: "date", value: end, onChange: (e) => setEnd(e.target.value) }) }),
            /* @__PURE__ */ jsx(Field, { label: "\u6708\u6B21\u30FB\u5E74\u5EA6", children: /* @__PURE__ */ jsx(Choice, { value: s.periods.find((p) => p.start === start && p.end === end)?.id || "year", onChange: (id) => {
              const p = s.periods.find((p2) => p2.id === id) || s.years.find((y) => y.id === yearId);
              setStart(p.start);
              setEnd(p.end);
            }, options: [["year", "\u5E74\u5EA6\u5168\u4F53"], ...s.periods.filter((p) => p.year_id === yearId).sort((a, b) => a.start.localeCompare(b.start)).map((p) => [p.id, `${p.start.slice(0, 7)} / ${p.status}`])] }) })
          ] }),
          !report && ["\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9", "\u4ED5\u8A33\u5E33", "\u7DCF\u52D8\u5B9A\u5143\u5E33", "\u8A66\u7B97\u8868", "P/L", "B/S", "\u6D88\u8CBB\u7A0E\u96C6\u8A08\u8868"].includes(page) && /* @__PURE__ */ jsx("div", { className: "alert", children: "\u96C6\u8A08\u671F\u9593\u306F\u540C\u4E00\u4F1A\u8A08\u5E74\u5EA6\u5185\u3067\u6B63\u3057\u304F\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }),
          page === "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9" && report && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("div", { className: "metrics", children: [["\u671F\u9593\u58F2\u4E0A", report.dashboard.sales], ["\u671F\u9593\u8CBB\u7528", report.dashboard.expenses], ["\u671F\u9593\u5229\u76CA", report.dashboard.profit], ["\u5E74\u5EA6\u7D2F\u8A08\u5229\u76CA", report.dashboard.ytd_profit]].map(([title, n], i) => /* @__PURE__ */ jsxs("section", { className: "metric " + (i === 2 ? "highlight" : ""), children: [
              /* @__PURE__ */ jsx("span", { children: title }),
              /* @__PURE__ */ jsxs("strong", { children: [
                money(n),
                /* @__PURE__ */ jsx("small", { children: "\u5186" })
              ] }),
              /* @__PURE__ */ jsx("small", { children: i === 3 ? "\u5E74\u5EA6\u958B\u59CB\u65E5\u301C\u6307\u5B9A\u7D42\u4E86\u65E5" : "\u6307\u5B9A\u671F\u9593\u306E\u78BA\u5B9A\u4ED5\u8A33\u304B\u3089\u96C6\u8A08" })
            ] }, title)) }),
            /* @__PURE__ */ jsxs("div", { className: "two-col", children: [
              /* @__PURE__ */ jsxs("section", { className: "panel", children: [
                /* @__PURE__ */ jsxs("div", { className: "section-title", children: [
                  /* @__PURE__ */ jsx("h2", { children: "\u6B8B\u9AD8\u306E\u78BA\u8A8D" }),
                  /* @__PURE__ */ jsxs("span", { className: "muted", children: [
                    end,
                    " \u6642\u70B9"
                  ] })
                ] }),
                /* @__PURE__ */ jsx(GridTable, { heads: ["\u9805\u76EE", "\u6B8B\u9AD8\uFF08\u5186\uFF09"], rows: [["\u73FE\u9810\u91D1", money(report.dashboard.cash)], ["\u58F2\u639B\u91D1", money(report.dashboard.ar)], ["\u8CB7\u639B\u91D1\u30FB\u672A\u6255\u91D1", money(report.dashboard.ap)], ["\u5E74\u5EA6\u7D2F\u8A08\u58F2\u4E0A", money(report.dashboard.ytd_sales)]] })
              ] }),
              /* @__PURE__ */ jsxs("section", { className: "panel", children: [
                /* @__PURE__ */ jsx("h2", { children: "\u5E33\u7C3F\u306E\u6574\u5408\u6027" }),
                /* @__PURE__ */ jsx(Check, { ok: Object.values(report.trial).every((v) => v === "0"), label: "\u8A66\u7B97\u8868\u306E\u8CB8\u501F" }),
                /* @__PURE__ */ jsx(Check, { ok: report.bs.difference === "0", label: "\u8CC7\u7523 = \u8CA0\u50B5 + \u7D14\u8CC7\u7523" }),
                /* @__PURE__ */ jsx("p", { className: "muted", children: "\u524A\u9664\u6E08\u307F\u4ED5\u8A33\u306F\u96C6\u8A08\u304B\u3089\u9664\u5916\u3057\u3066\u3044\u307E\u3059\u3002" }),
                /* @__PURE__ */ jsx("p", { className: "muted", children: "\u7A0E\u60C5\u5831\u3092\u8A2D\u5B9A\u3057\u305F\u53D6\u5F15\u306F\u7A0E\u629C\u672C\u4F53\u3092\u96C6\u8A08\u3002\u65E7\u4ED5\u8A33\u306E\u91D1\u984D\u306F\u5909\u66F4\u3057\u307E\u305B\u3093\u3002" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("section", { className: "panel", children: [
              /* @__PURE__ */ jsx("h2", { children: "\u76F4\u8FD1\u306E\u4ED5\u8A33" }),
              /* @__PURE__ */ jsx(GridTable, { heads: ["\u65E5\u4ED8", "\u4ED5\u8A33\u756A\u53F7", "\u6458\u8981", "\u91D1\u984D\uFF08\u5186\uFF09", "\u72B6\u614B"], rows: filtered.slice(-6).reverse().map((j) => [j.transaction_date, /* @__PURE__ */ jsx("button", { className: "textlink", onClick: () => setDetail(j), children: j.journal_number }), j.description, money(currentLines(s, j).reduce((n, l) => n + BigInt(l.debit_amount), 0n)), j.status]) })
            ] })
          ] }),
          page === "\u4ED5\u8A33\u5165\u529B" && editor && /* @__PURE__ */ jsxs("section", { className: "panel", children: [
            /* @__PURE__ */ jsxs("div", { className: "section-title", children: [
              /* @__PURE__ */ jsx("h2", { children: editor.id ? `\u4ED5\u8A33 ${editor.journal_number} \u306E\u7DE8\u96C6` : "\u65B0\u898F\u4ED5\u8A33" }),
              /* @__PURE__ */ jsx("span", { className: "muted", children: "\u8907\u5408\u4ED5\u8A33\u5BFE\u5FDC\u30FBJPY" })
            ] }),
            /* @__PURE__ */ jsx("form", { onSubmit: (e) => {
              e.preventDefault();
              act(editor);
            }, children: /* @__PURE__ */ jsxs("fieldset", { disabled: busy, children: [
              /* @__PURE__ */ jsxs("div", { className: "formgrid", children: [
                /* @__PURE__ */ jsx(Field, { label: "\u53D6\u5F15\u65E5", children: /* @__PURE__ */ jsx(Input, { type: "date", required: true, value: editor.transaction_date, onChange: (e) => setEditor({ ...editor, transaction_date: e.target.value }) }) }),
                /* @__PURE__ */ jsx(Field, { label: "\u6458\u8981", children: /* @__PURE__ */ jsx(Input, { required: true, maxLength: 300, value: editor.description, onChange: (e) => setEditor({ ...editor, description: e.target.value }) }) }),
                /* @__PURE__ */ jsx(Field, { label: "\u53D6\u5F15\u5148", children: /* @__PURE__ */ jsx(Input, { maxLength: 300, value: editor.counterparty, onChange: (e) => setEditor({ ...editor, counterparty: e.target.value }) }) })
              ] }),
              /* @__PURE__ */ jsx(TaxLineEditor, { s, editor, setEditor }),
              editor.id && /* @__PURE__ */ jsx(Field, { label: "\u5909\u66F4\u7406\u7531\uFF08\u5FC5\u9808\uFF09", children: /* @__PURE__ */ jsx(Input, { required: true, value: editor.reason, onChange: (e) => setEditor({ ...editor, reason: e.target.value }) }) }),
              /* @__PURE__ */ jsxs("div", { className: "formactions", children: [
                /* @__PURE__ */ jsx(Button, { type: "submit", children: busy ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4ED5\u8A33\u3092\u78BA\u5B9A\u767B\u9332" }),
                /* @__PURE__ */ jsx(Button, { variant: "outline", type: "button", onClick: () => {
                  setEditor(null);
                  setPage("\u4ED5\u8A33\u5E33");
                }, children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }),
                /* @__PURE__ */ jsx("span", { className: "muted", children: "\u5E74\u5EA6\u30FB\u6708\u6B21\u671F\u9593\u304C\u3068\u3082\u306BOPEN\u306E\u5834\u5408\u306E\u307F\u767B\u9332\u3067\u304D\u307E\u3059\u3002" })
              ] })
            ] }) })
          ] }),
          page === "\u4ED5\u8A33\u5E33" && /* @__PURE__ */ jsxs("section", { className: "panel", children: [
            /* @__PURE__ */ jsxs("div", { className: "filters", children: [
              [["number", "\u4ED5\u8A33\u756A\u53F7"], ["description", "\u6458\u8981"], ["counterparty", "\u53D6\u5F15\u5148"], ["min", "\u6700\u5C0F\u91D1\u984D"], ["max", "\u6700\u5927\u91D1\u984D"]].map(([key, label]) => /* @__PURE__ */ jsx(Field, { label, children: /* @__PURE__ */ jsx(Input, { value: filters[key], inputMode: key === "min" || key === "max" ? "numeric" : void 0, onChange: (e) => setFilters({ ...filters, [key]: key === "min" || key === "max" ? e.target.value.replace(/\D/g, "") : e.target.value }) }) }, key)),
              /* @__PURE__ */ jsx(Field, { label: "\u52D8\u5B9A\u79D1\u76EE", children: /* @__PURE__ */ jsx(Choice, { value: filters.account, onChange: (v) => setFilters({ ...filters, account: v, sub: "" }), options: [["", "\u3059\u3079\u3066"], ...s.accounts.map((a) => [a.id, a.account_name])] }) }),
              /* @__PURE__ */ jsx(Field, { label: "\u88DC\u52A9\u79D1\u76EE", children: /* @__PURE__ */ jsx(Choice, { value: filters.sub, onChange: (v) => setFilters({ ...filters, sub: v }), options: [["", "\u3059\u3079\u3066"], ...s.subaccounts.filter((a) => !filters.account || a.account_id === filters.account).map((a) => [a.id, a.name])] }) }),
              jsx(Field,{label:"補助科目名検索",children:jsx(Input,{value:filters.subname||"",onChange:e=>setFilters({...filters,subname:e.target.value})})})
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "section-title", children: [
              /* @__PURE__ */ jsxs("label", { className: "row", children: [
                /* @__PURE__ */ jsx(Checkbox, { checked: filters.deleted, onCheckedChange: (v) => setFilters({ ...filters, deleted: v === true }) }),
                "\u524A\u9664\u6E08\u307F\u3092\u8868\u793A"
              ] }),
              /* @__PURE__ */ jsxs(Button, { variant: "outline", onClick: () => download(csv(filtered.flatMap((j) => currentLines(s, j).map((l) => ({ ...j, ...l, line_id: l.id, journal_id: j.id })))), "journal-view.csv"), children: [
                /* @__PURE__ */ jsx(Download, { size: 15 }),
                "\u8868\u793A\u7D50\u679CCSV"
              ] })
            ] }),
            /* @__PURE__ */ jsx(GridTable, { heads: ["\u65E5\u4ED8 / \u4ED5\u8A33\u756A\u53F7", "\u6458\u8981 / \u53D6\u5F15\u5148", "\u501F\u65B9\u79D1\u76EE", "\u8CB8\u65B9\u79D1\u76EE", "\u91D1\u984D\uFF08\u5186\uFF09", "\u72B6\u614B", "\u64CD\u4F5C"], rows: filtered.map((j) => {
              const ls = currentLines(s, j);
              return [/* @__PURE__ */ jsxs("div", { className: j.status === "DELETED" ? "deleted" : "", children: [
                j.transaction_date,
                /* @__PURE__ */ jsx("br", {}),
                /* @__PURE__ */ jsx("button", { className: "textlink", onClick: () => setDetail(j), children: j.journal_number })
              ] }), /* @__PURE__ */ jsxs("div", { className: j.status === "DELETED" ? "deleted" : "", children: [
                j.description,
                /* @__PURE__ */ jsx("small", { className: "block muted", children: j.counterparty })
              ] }), ls.filter((l) => l.debit_amount).map((l) => accountName(l.account_id)).join("\u30FB"), ls.filter((l) => l.credit_amount).map((l) => accountName(l.account_id)).join("\u30FB"), money(ls.reduce((n, l) => n + BigInt(l.debit_amount), 0n)), /* @__PURE__ */ jsx("span", { className: "status " + j.status, children: j.status }), /* @__PURE__ */ jsxs("div", { className: "row", children: [
                /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "sm", onClick: () => setDetail(j), children: "\u8A73\u7D30" }),
                canEdit(s, j) && /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "sm", onClick: () => edit(j), children: "\u7DE8\u96C6" }),
                  /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "sm", onClick: () => ask({ type: "delete", id: j.id, title: `\u4ED5\u8A33 ${j.journal_number} \u3092\u8AD6\u7406\u524A\u9664` }), children: "\u8AD6\u7406\u524A\u9664" })
                ] })
              ] })];
            }) })
          ] }),
          page === "補助元帳・残高" && jsx(SubaccountWorkspace,{s,start,end},s.company.id),
          page === "\u7DCF\u52D8\u5B9A\u5143\u5E33" && report && /* @__PURE__ */ jsxs("section", { className: "panel", children: [
            /* @__PURE__ */ jsxs("div", { className: "section-title", children: [
              /* @__PURE__ */ jsx(Choice, { value: ledgerId, onChange: setLedgerId, options: s.accounts.map((a) => [a.id, `${a.account_code} ${a.account_name}`]) }),
              /* @__PURE__ */ jsx("span", { className: "muted", children: "\u6B8B\u9AD8\u306F\u501F\u65B9\u3092\u6B63\u3001\u8CB8\u65B9\u3092\u8CA0\u3068\u3057\u3066\u8868\u793A" })
            ] }),
            (() => {
              if (!ledgerId) return null;
              const l = ledger(s, ledgerId, start, end);
              return /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsxs("p", { children: [
                  "\u671F\u9996\u6B8B\u9AD8\uFF1A",
                  money(l.opening),
                  " \u5186"
                ] }),
                /* @__PURE__ */ jsx(GridTable, { heads: ["\u65E5\u4ED8", "\u4ED5\u8A33\u756A\u53F7", "\u6458\u8981", "\u76F8\u624B\u79D1\u76EE", "\u501F\u65B9\uFF08\u5186\uFF09", "\u8CB8\u65B9\uFF08\u5186\uFF09", "\u6B8B\u9AD8\uFF08\u5186\uFF09"], rows: l.rows.map((r) => [r.date, r.journal_number, r.description, r.counter_account, money(r.debit_amount), money(r.credit_amount), money(r.balance)]) }),
                /* @__PURE__ */ jsxs("p", { className: "total", children: [
                  "\u671F\u672B\u6B8B\u9AD8\uFF1A",
                  money(l.closing),
                  " \u5186"
                ] })
              ] });
            })()
          ] }),
          page === "\u8A66\u7B97\u8868" && report && /* @__PURE__ */ jsxs("section", { className: "panel", children: [
            /* @__PURE__ */ jsx(Check, { ok: Object.values(report.trial).every((v) => v === "0"), label: "\u671F\u9996\u30FB\u767A\u751F\u984D\u30FB\u671F\u672B\u306E\u8CB8\u501F" }),
            /* @__PURE__ */ jsx("p", { className: "muted", children: "\u671F\u9996\u30FB\u671F\u672B\u6B8B\u9AD8\u306F\u501F\u65B9\u3092\u6B63\u3001\u8CB8\u65B9\u3092\u8CA0\u3068\u3057\u3066\u8868\u793A\uFF08\u5186\uFF09" }),
            /* @__PURE__ */ jsx(GridTable, { heads: ["\u30B3\u30FC\u30C9", "\u52D8\u5B9A\u79D1\u76EE", "\u671F\u9996\u6B8B\u9AD8", "\u501F\u65B9\u767A\u751F\u984D", "\u8CB8\u65B9\u767A\u751F\u984D", "\u671F\u672B\u6B8B\u9AD8"], rows: [...report.rows.map((a) => [a.account_code, a.account_name, money(a.opening), money(a.debit), money(a.credit), money(a.closing)]), ["", "\u5408\u8A08", money(report.trial.opening_difference), money(report.rows.reduce((n, a) => n + BigInt(a.debit), 0n)), money(report.rows.reduce((n, a) => n + BigInt(a.credit), 0n)), money(report.trial.closing_difference)]] })
          ] }),
          page === "P/L" && report && /* @__PURE__ */ jsxs("section", { className: "panel statement", children: [
            /* @__PURE__ */ jsx("p", { className: "muted", children: "\u7A0E\u8A2D\u5B9A\u6E08\u307F\u53D6\u5F15\u306F\u7A0E\u629C\u3002\u7A0E\u60C5\u5831\u672A\u8A2D\u5B9A\u306E\u65E7\u53D6\u5F15\u306F\u5143\u306E\u91D1\u984D\u3067\u3059\u3002" }),
            /* @__PURE__ */ jsxs("h2", { children: [
              "\u640D\u76CA\u8A08\u7B97\u66F8 ",
              /* @__PURE__ */ jsx("small", { children: "\u5358\u4F4D\uFF1A\u5186" })
            ] }),
            /* @__PURE__ */ jsx(GridTable, { heads: ["\u9805\u76EE", "\u91D1\u984D"], rows: [[sections.SALES, report.groups.SALES], [sections.COGS, report.groups.COGS], ["\u58F2\u4E0A\u7DCF\u5229\u76CA", report.pl.gross], [sections.SGA, report.groups.SGA], ["\u55B6\u696D\u5229\u76CA", report.pl.operating], [sections.OTHER_REVENUE, report.groups.OTHER_REVENUE], [sections.OTHER_EXPENSE, report.groups.OTHER_EXPENSE], ["\u7D4C\u5E38\u5229\u76CA", report.pl.ordinary], [sections.EXTRA_REVENUE, report.groups.EXTRA_REVENUE], [sections.EXTRA_EXPENSE, report.groups.EXTRA_EXPENSE], ["\u7A0E\u5F15\u524D\u5F53\u671F\u7D14\u5229\u76CA", report.pl.pretax], [sections.TAX, report.groups.TAX], ["\u5F53\u671F\u7D14\u5229\u76CA", report.pl.net]].map(([k, n]) => [k, money(n)]) }),
            /* @__PURE__ */ jsx("p", { className: "muted", children: "\u6307\u5B9A\u671F\u9593\u306E\u640D\u76CA\u3002B/S\u306E\u5F53\u671F\u5229\u76CA\u306F\u5E74\u5EA6\u958B\u59CB\u65E5\u304B\u3089\u306E\u7D2F\u8A08\u3067\u3059\u3002" })
          ] }),
          page === "B/S" && report && /* @__PURE__ */ jsxs("section", { className: "panel statement", children: [
            /* @__PURE__ */ jsxs("h2", { children: [
              "\u8CB8\u501F\u5BFE\u7167\u8868 ",
              /* @__PURE__ */ jsxs("small", { children: [
                end,
                " \u6642\u70B9 / \u5186"
              ] })
            ] }),
            /* @__PURE__ */ jsx(Check, { ok: report.bs.difference === "0", label: "\u8CC7\u7523 = \u8CA0\u50B5 + \u7D14\u8CC7\u7523" }),
            /* @__PURE__ */ jsx(GridTable, { heads: ["\u9805\u76EE", "\u91D1\u984D"], rows: [[sections.CURRENT_ASSET, report.groups.CURRENT_ASSET], [sections.FIXED_ASSET, report.groups.FIXED_ASSET], ["\u8CC7\u7523\u5408\u8A08", report.bs.assets], [sections.CURRENT_LIABILITY, report.groups.CURRENT_LIABILITY], [sections.LONG_LIABILITY, report.groups.LONG_LIABILITY], ["\u8CA0\u50B5\u5408\u8A08", report.bs.liabilities], ["\u7D14\u8CC7\u7523\uFF08\u5F53\u671F\u5229\u76CA\u3092\u9664\u304F\uFF09", report.groups.EQUITY], ["\u5F53\u671F\u7D14\u5229\u76CA\uFF08\u5E74\u5EA6\u7D2F\u8A08\uFF09", report.bs.ytd_profit], ["\u7D14\u8CC7\u7523\u5408\u8A08", report.bs.equity], ["\u8CA0\u50B5\u30FB\u7D14\u8CC7\u7523\u5408\u8A08", String(BigInt(report.bs.liabilities) + BigInt(report.bs.equity))], ["\u8CB8\u501F\u5DEE\u984D", report.bs.difference]].map(([k, n]) => [k, money(n)]) })
          ] }),
          page === "\u52D8\u5B9A\u79D1\u76EE" && /* @__PURE__ */ jsxs("section", { className: "panel", children: [
            /* @__PURE__ */ jsxs("div", { className: "section-title", children: [
              /* @__PURE__ */ jsx("h2", { children: "\u52D8\u5B9A\u79D1\u76EE\u30DE\u30B9\u30BF\u30FC" }),
              /* @__PURE__ */ jsx(Button, { onClick: () => setModal({ type: "account", account_code: "", account_name: "", section: "CURRENT_ASSET", tag: "", active: true, reason: "" }), children: "\u79D1\u76EE\u3092\u8FFD\u52A0" })
            ] }),
            /* @__PURE__ */ jsx(GridTable, { heads: ["\u30B3\u30FC\u30C9", "\u79D1\u76EE\u540D", "\u8CA1\u52D9\u533A\u5206", "\u901A\u5E38\u6B8B\u9AD8", "\u30C7\u30D5\u30A9\u30EB\u30C8\u7A0E\u533A\u5206", "\u72B6\u614B", "\u64CD\u4F5C"], rows: [...s.accounts].sort((a, b) => a.account_code.localeCompare(b.account_code)).map((a) => [a.account_code, a.account_name, sections[a.section], a.normal_balance === "DEBIT" ? "\u501F\u65B9" : "\u8CB8\u65B9", s.tax_codes.find((t) => t.tax_code === a.default_tax_code)?.tax_name || "\u7A0E\u60C5\u5831\u672A\u8A2D\u5B9A", a.active ? "\u6709\u52B9" : "\u7121\u52B9", /* @__PURE__ */ jsx(Button, { variant: "ghost", onClick: () => setModal({ ...a, type: "account", reason: "" }), children: "\u7DE8\u96C6" })]) })
          ] }),
          page === "\u88DC\u52A9\u79D1\u76EE" && /* @__PURE__ */ jsxs("section", { className: "panel", children: [
            /* @__PURE__ */ jsxs("div", { className: "section-title", children: [
              /* @__PURE__ */ jsx("h2", { children: "\u88DC\u52A9\u79D1\u76EE" }),
              /* @__PURE__ */ jsx(Button, { onClick: () => setModal({ type: "subaccount", account_id: "", name: "", active: true, reason: "" }), children: "\u88DC\u52A9\u79D1\u76EE\u3092\u8FFD\u52A0" })
            ] }),
            /* @__PURE__ */ jsx(GridTable, { heads: ["\u89AA\u79D1\u76EE", "\u88DC\u52A9\u79D1\u76EE\u540D", "\u72B6\u614B", "\u64CD\u4F5C"], rows: s.subaccounts.map((a) => [accountName(a.account_id), a.name, a.active ? "\u6709\u52B9" : "\u7121\u52B9", /* @__PURE__ */ jsx(Button, { variant: "ghost", onClick: () => setModal({ ...a, type: "subaccount", reason: "" }), children: "\u7DE8\u96C6" })]) })
          ] }),
          page === "\u4F1A\u8A08\u671F\u9593" && /* @__PURE__ */ jsxs("section", { className: "panel", children: [
            /* @__PURE__ */ jsxs("div", { className: "section-title", children: [
              /* @__PURE__ */ jsx("h2", { children: "\u5E74\u5EA6\u30FB\u6708\u6B21\u306E\u7DE0\u3081\u7BA1\u7406" }),
              /* @__PURE__ */ jsx(Button, { onClick: () => setModal({ type: "year", start: "", end: "" }), children: "\u7FCC\u5E74\u5EA6\u3092\u8FFD\u52A0" })
            ] }),
            /* @__PURE__ */ jsx("p", { className: "muted", children: "CLOSED\u306F\u7406\u7531\u3092\u8A18\u9332\u3057\u3066\u518DOPEN\u3067\u304D\u307E\u3059\u3002LOCKED\u306F\u89E3\u9664\u3067\u304D\u307E\u305B\u3093\u3002\u5E74\u5EA6\u3068\u6708\u6B21\u306E\u4E21\u65B9\u304COPEN\u306E\u5834\u5408\u3060\u3051\u4ED5\u8A33\u3092\u66F4\u65B0\u3067\u304D\u307E\u3059\u3002" }),
            [...s.years].sort((a, b) => a.start.localeCompare(b.start)).map((y) => /* @__PURE__ */ jsxs("div", { className: "year-block", children: [
              jsx(OpeningBalances, { s, year: y, act, busy }, `${s.company.id}:${y.id}:${s.company.version}`),
              /* @__PURE__ */ jsxs("h3", { children: [
                y.start,
                " \u301C ",
                y.end
              ] }),
              /* @__PURE__ */ jsx(GridTable, { heads: ["\u7A2E\u5225", "\u671F\u9593", "\u72B6\u614B", "\u6700\u7D42\u5909\u66F4", "\u64CD\u4F5C"], rows: [[y, "years"], ...s.periods.filter((p) => p.year_id === y.id).sort((a, b) => a.start.localeCompare(b.start)).map((p) => [p, "periods"])].map(([p, target]) => [target === "years" ? "\u4F1A\u8A08\u5E74\u5EA6" : "\u6708\u6B21", `${p.start} \u301C ${p.end}`, /* @__PURE__ */ jsx("span", { className: "status " + p.status, children: p.status }), p.changed_at ? new Date(p.changed_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "\u4F5C\u6210\u6642", /* @__PURE__ */ jsx("div", { className: "row", children: p.status !== "LOCKED" && ["OPEN", "CLOSED", "LOCKED"].filter((v) => v !== p.status).map((status) => /* @__PURE__ */ jsx(Button, { variant: "outline", size: "sm", disabled: busy || target === "periods" && y.status !== "OPEN", onClick: () => ask({ type: "period", target, id: p.id, status, title: `${p.start} \u301C ${p.end} \u3092 ${status} \u306B\u5909\u66F4` }), children: status === "OPEN" ? "\u518DOPEN" : status === "CLOSED" ? "CLOSE" : "LOCK" }, status)) })]) })
            ] }, y.id))
          ] }),
          ["\u6D88\u8CBB\u7A0E\u96C6\u8A08\u8868", "\u7A0E\u533A\u5206\u30FB\u8A2D\u5B9A"].includes(page) && /* @__PURE__ */ jsx(TaxWorkspace, { s, start, end, page, act, onPrepare: (c) => {
            setEditor(c);
            setPage("\u4ED5\u8A33\u5165\u529B");
          } }),
          page === "\u76E3\u67FB\u30ED\u30B0" && /* @__PURE__ */ jsxs("section", { className: "panel", children: [
            /* @__PURE__ */ jsx("h2", { children: "\u5909\u66F4\u5C65\u6B74" }),
            /* @__PURE__ */ jsx("p", { className: "muted", children: "\u5909\u66F4\u30FB\u524A\u9664\u3067\u304D\u306A\u3044\u5C65\u6B74\u3067\u3059\u3002\u8A73\u7D30\u304B\u3089\u5909\u66F4\u524D\u30FB\u5909\u66F4\u5F8C\u306E\u5024\u3092\u78BA\u8A8D\u3067\u304D\u307E\u3059\u3002" }),
            /* @__PURE__ */ jsx(GridTable, { heads: ["\u5B9F\u884C\u65E5\u6642\uFF08\u65E5\u672C\u6642\u9593\uFF09", "\u64CD\u4F5C", "\u5BFE\u8C61", "\u5B9F\u884C\u8005", "\u7406\u7531", "\u8A73\u7D30"], rows: [...s.audit].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map((a) => [new Date(a.timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }), a.event_type, a.target_type, /* @__PURE__ */ jsx("span", { title: a.user, children: a.user === s.company.owner ? "Administrator" : a.user }), a.reason, /* @__PURE__ */ jsx(Button, { variant: "ghost", onClick: () => setDetail({ ...a, audit: true }), children: "\u8A73\u7D30" })]) })
          ] }),
          page === "CSV\u53D6\u8FBC" && /* @__PURE__ */ jsx(CSVImport, { s, onSaved: (after) => {
            setS((current) => current?.company.id === after.company.id ? after : current);
            listCompanies().catch(() => {
            });
          } }, s.company.id),
          page === "\u8A2D\u5B9A" && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs("section", { className: "panel", children: [
              /* @__PURE__ */ jsxs("div", { className: "section-title", children: [
                /* @__PURE__ */ jsx("h2", { children: "\u4F1A\u793E\u57FA\u672C\u60C5\u5831" }),
                /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: () => setModal({ type: "settings", name: s.company.name, corporate_number: s.company.corporate_number, reason: "" }), children: "\u5909\u66F4" })
              ] }),
              /* @__PURE__ */ jsx(GridTable, { heads: ["\u9805\u76EE", "\u8A2D\u5B9A\u5024"], rows: [["\u4F1A\u793E\u540D", s.company.name], ["\u57FA\u672C\u901A\u8CA8", "JPY\uFF08\u65E5\u672C\u5186\uFF09"], ["\u521D\u5E74\u5EA6", `${s.company.start} \u301C ${s.company.end}`], ["\u6CD5\u4EBA\u756A\u53F7", s.company.corporate_number || "\u672A\u8A2D\u5B9A"], ["\u5229\u7528\u6A29\u9650", "Administrator\uFF08\u4F1A\u793E\u4F5C\u6210\u8005\uFF09"]] }),
              /* @__PURE__ */ jsx("p", { className: "muted", children: "\u5E74\u5EA6\u65E5\u4ED8\u306F\u767B\u9332\u5F8C\u306B\u5909\u66F4\u3067\u304D\u307E\u305B\u3093\u3002\u7FCC\u5E74\u5EA6\u306F\u300C\u4F1A\u8A08\u671F\u9593\u300D\u304B\u3089\u8FFD\u52A0\u3057\u3066\u304F\u3060\u3055\u3044\u3002" })
            ] }),
            /* @__PURE__ */ jsxs("section", { className: "panel", children: [
              /* @__PURE__ */ jsx("h2", { children: "\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u30FB\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8" }),
              /* @__PURE__ */ jsx("p", { children: "\u5B8C\u5168\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u306B\u306FJSON\u3092\u4F7F\u7528\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u524A\u9664\u6E08\u307F\u4ED5\u8A33\u3001\u904E\u53BB\u306E\u660E\u7D30\u7248\u3001\u76E3\u67FB\u30ED\u30B0\u3001\u4F1A\u793E\u8A2D\u5B9A\u3092\u542B\u307F\u307E\u3059\u3002" }),
              /* @__PURE__ */ jsxs("a", { className: "primary-link", href: `/api/accounting?company=${s.company.id}&export=all`, children: [
                /* @__PURE__ */ jsx(Download, { size: 16 }),
                "\u5168\u30C7\u30FC\u30BFJSON\u3092\u4FDD\u5B58"
              ] }),
              /* @__PURE__ */ jsxs("a", { className: "primary-link", href: `/api/accounting?company=${s.company.id}&export=journal_transfer`, children: [
                /* @__PURE__ */ jsx(Download, { size: 16 }),
                "\u518D\u53D6\u8FBC\u7528\u4ED5\u8A33CSV\uFF08ACTIVE\u30FB\u73FE\u884C\u5165\u529B\u660E\u7D30\uFF09"
              ] }),
              /* @__PURE__ */ jsx("p", { className: "muted", children: "期首残高仕訳は再取込用CSVから除外されます。期首設定はJSONバックアップに含まれます。\u518D\u53D6\u8FBC\u7528CSV\u306F\u81EA\u52D5\u7A0E\u660E\u7D30\u3092\u9664\u304D\u3001\u5165\u529B\u91D1\u984D\u3068\u4FDD\u5B58\u6E08\u307F\u7A0E\u984D\u3092\u542B\u307F\u307E\u3059\u3002\u5168\u660E\u7D30\u7248CSV\u306F\u524A\u9664\u6E08\u307F\u30FB\u904E\u53BB\u7248\u30FB\u81EA\u52D5\u7A0E\u660E\u7D30\u3092\u542B\u3080\u76E3\u67FB\u7528\u3067\u3059\u3002\u4F1D\u7968\u756A\u53F7\u306E\u306A\u3044\u8907\u5408\u4ED5\u8A33\u306Fimport_group\u3067\u307E\u3068\u3081\u308B\u5F62\u5F0F\u3067\u3059\u3002" }),
              /* @__PURE__ */ jsx("div", { className: "export-links", children: exports.map((x, i) => /* @__PURE__ */ jsxs("a", { href: `/api/accounting?company=${s.company.id}&export=${x}`, children: [
                ["\u4F1A\u793E\u8A2D\u5B9A", "\u5168\u4ED5\u8A33", "\u5168\u660E\u7D30\u7248", "\u52D8\u5B9A\u79D1\u76EE", "\u88DC\u52A9\u79D1\u76EE", "\u4F1A\u8A08\u5E74\u5EA6", "\u6708\u6B21\u671F\u9593", "\u76E3\u67FB\u30ED\u30B0", "\u7A0E\u533A\u5206"][i],
                " CSV"
              ] }, x)) }),
              /* @__PURE__ */ jsx("p", { className: "muted", children: "CSV\u306FUTF-8 BOM\u4ED8\u304D\u3002\u8868\u8A08\u7B97\u30BD\u30D5\u30C8\u306E\u6570\u5F0F\u5B9F\u884C\u3092\u9632\u3050\u305F\u3081\u4E00\u90E8\u6587\u5B57\u5217\u306E\u5148\u982D\u306B\u300C'\u300D\u3092\u4ED8\u52A0\u3057\u307E\u3059\u3002\u5B8C\u5168\u306A\u5024\u306E\u5FA9\u5143\u306B\u306FJSON\u3092\u4F7F\u7528\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u518D\u53D6\u8FBC\u7528\u4ED5\u8A33CSV\u306F\u300CCSV\u53D6\u8FBC\u300D\u304B\u3089\u767B\u9332\u3067\u304D\u307E\u3059\u3002\u5168\u660E\u7D30\u7248CSV\u306F\u76F4\u63A5\u53D6\u8FBC\u3057\u306A\u3044\u3067\u304F\u3060\u3055\u3044\u3002" })
            ] }),
            /* @__PURE__ */ jsxs("section", { className: "panel", children: [
              /* @__PURE__ */ jsx("h2", { children: "\u5229\u7528\u7BC4\u56F2\u3068\u7FCC\u671F\u7E70\u8D8A" }),
              /* @__PURE__ */ jsx("p", { children: "\u524D\u671F\u307E\u3067\u306EB/S\u6B8B\u9AD8\u3092\u5F15\u304D\u7D99\u304E\u3001\u904E\u5E74\u5EA6\u306E\u640D\u76CA\u3092\u7E70\u8D8A\u5229\u76CA\u5270\u4F59\u91D1\u306B\u81EA\u52D5\u96C6\u8A08\u3057\u307E\u3059\u3002\u640D\u76CA\u632F\u66FF\u4ED5\u8A33\u3092\u91CD\u306D\u3066\u767B\u9332\u3057\u306A\u3044\u3067\u304F\u3060\u3055\u3044\u3002期首残高は「会計期間」の各年度にある専用設定で入力できます。繰越残高との差額だけを期首残高仕訳として保存します。既存の開始残高仕訳は自動変換されません。" }),
              /* @__PURE__ */ jsx("p", { children: "\u7A0E\u629C\u30FB\u7A0E\u8FBC\u5165\u529B\u306B\u5BFE\u5FDC\u3057\u307E\u3059\u3002\u7A0E\u60C5\u5831\u672A\u8A2D\u5B9A\u306E\u904E\u53BB\u4ED5\u8A33\u306F\u5F93\u6765\u91D1\u984D\u3092\u4FDD\u6301\u3057\u307E\u3059\u3002\u7533\u544A\u66F8\u4F5C\u6210\u30FB\u8A3C\u6191\u4FDD\u5B58\u306E\u6CD5\u4EE4\u5BFE\u5FDC\u306F\u542B\u307F\u307E\u305B\u3093\u3002\u521D\u5E74\u5EA6\u306E\u671F\u9593\u4F5C\u6210\u3068\u4F1A\u8A08\u79D1\u76EE\u3092\u78BA\u8A8D\u3057\u3066\u304B\u3089\u5B9F\u30C7\u30FC\u30BF\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }),
              /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: () => setModal({ type: "create", name: "", start: "2026-04-01", end: "2027-03-31" }), children: "\u5225\u306E\u4F1A\u793E\u3092\u767B\u9332" }),
              /* @__PURE__ */ jsx(Button, { variant: "outline", disabled: busy, onClick: () => {
                const t = companies.find((c) => c.name === "\u30C6\u30B9\u30C8");
                if (t) loadCompany(t.id);
                else setError("\u65E2\u5B58\u306E\u300C\u30C6\u30B9\u30C8\u300D\u4F1A\u793E\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
              }, children: "\u65E2\u5B58\u306E\u30C6\u30B9\u30C8\u4F1A\u793E\u3092\u958B\u304F" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("footer", { className: "workspace-footer", children: [
          "JPY / \u5186\u5358\u4F4D ",
          /* @__PURE__ */ jsx("span", { children: "\u5E33\u7C3F\u306E\u78BA\u5B9A\u30FB\u5909\u66F4\u306F\u76E3\u67FB\u5C65\u6B74\u306B\u8A18\u9332" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Dialog, { open: !!modal, onOpenChange: (v) => !v && setModal(null), children: /* @__PURE__ */ jsxs(DialogContent, { children: [
      /* @__PURE__ */ jsxs(DialogHeader, { children: [
        /* @__PURE__ */ jsx(DialogTitle, { children: modal?.type === "create" ? "\u4F1A\u793E\u767B\u9332" : modal?.type === "year" ? "\u7FCC\u5E74\u5EA6\u306E\u8FFD\u52A0" : "\u8A2D\u5B9A\u306E\u767B\u9332\u30FB\u5909\u66F4" }),
        /* @__PURE__ */ jsx(DialogDescription, { children: "\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044\u3002" })
      ] }),
      modal && /* @__PURE__ */ jsx("form", { onSubmit: (e) => {
        e.preventDefault();
        act(modal);
      }, children: /* @__PURE__ */ jsxs("fieldset", { disabled: busy, children: [
        /* @__PURE__ */ jsxs("div", { className: "modalfields", children: [
          (modal.type === "create" || modal.type === "settings") && /* @__PURE__ */ jsx(Field, { label: "\u4F1A\u793E\u540D", children: /* @__PURE__ */ jsx(Input, { required: true, maxLength: 300, value: modal.name, onChange: (e) => setModal({ ...modal, name: e.target.value }) }) }),
          modal.type === "settings" && /* @__PURE__ */ jsx(Field, { label: "\u6CD5\u4EBA\u756A\u53F7\uFF08\u4EFB\u610F\uFF09", children: /* @__PURE__ */ jsx(Input, { value: modal.corporate_number, onChange: (e) => setModal({ ...modal, corporate_number: e.target.value }) }) }),
          (modal.type === "create" || modal.type === "year") && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Field, { label: "\u5E74\u5EA6\u958B\u59CB\u65E5", children: /* @__PURE__ */ jsx(Input, { required: true, type: "date", value: modal.start, onChange: (e) => setModal({ ...modal, start: e.target.value }) }) }),
            /* @__PURE__ */ jsx(Field, { label: "\u5E74\u5EA6\u7D42\u4E86\u65E5", children: /* @__PURE__ */ jsx(Input, { required: true, type: "date", value: modal.end, onChange: (e) => setModal({ ...modal, end: e.target.value }) }) })
          ] }),
          modal.type === "account" && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Field, { label: "\u52D8\u5B9A\u79D1\u76EE\u30B3\u30FC\u30C9", children: /* @__PURE__ */ jsx(Input, { required: true, value: modal.account_code, onChange: (e) => setModal({ ...modal, account_code: e.target.value }) }) }),
            /* @__PURE__ */ jsx(Field, { label: "\u52D8\u5B9A\u79D1\u76EE\u540D", children: /* @__PURE__ */ jsx(Input, { required: true, value: modal.account_name, onChange: (e) => setModal({ ...modal, account_name: e.target.value }) }) }),
            /* @__PURE__ */ jsx(Field, { label: "\u30C7\u30D5\u30A9\u30EB\u30C8\u7A0E\u533A\u5206", children: /* @__PURE__ */ jsx(Choice, { value: modal.default_tax_code || "UNSPECIFIED", onChange: (v) => setModal({ ...modal, default_tax_code: v }), options: [["UNSPECIFIED", "\u7A0E\u60C5\u5831\u672A\u8A2D\u5B9A"], ...orderedTaxCodes(s).map((t) => [t.tax_code, t.tax_name + (t.active ? "" : "\uFF08\u7121\u52B9\uFF09")])] }) }),
            jsx(Field,{label:"補助科目入力設定",children:jsx(Choice,{value:modal.subaccount_input||"OPTIONAL",onChange:v=>setModal({...modal,subaccount_input:v}),options:Object.entries(inputModes)})}),
            jsx(Field,{label:"相手勘定科目への補助科目入力支援",children:jsx(Choice,{value:modal.subaccount_assist||"NONE",onChange:v=>setModal({...modal,subaccount_assist:v}),options:Object.entries(assistModes)})}),
            /* @__PURE__ */ jsx(Field, { label: "\u8CA1\u52D9\u8AF8\u8868\u533A\u5206", children: /* @__PURE__ */ jsx(Choice, { value: modal.section, onChange: (v) => setModal({ ...modal, section: v, normal_balance: ["ASSET", "EXPENSE"].includes(sectionTypes[v]) ? "DEBIT" : "CREDIT" }), options: Object.entries(sections) }) }),
            /* @__PURE__ */ jsx(Field, { label: "\u901A\u5E38\u6B8B\u9AD8", children: /* @__PURE__ */ jsx(Choice, { value: modal.normal_balance || (["ASSET", "EXPENSE"].includes(sectionTypes[modal.section]) ? "DEBIT" : "CREDIT"), onChange: (v) => setModal({ ...modal, normal_balance: v }), options: [["DEBIT", "\u501F\u65B9"], ["CREDIT", "\u8CB8\u65B9"]] }) }),
            /* @__PURE__ */ jsx(Field, { label: "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u96C6\u8A08\u533A\u5206", children: /* @__PURE__ */ jsx(Choice, { value: modal.tag, onChange: (v) => setModal({ ...modal, tag: v }), options: [["", "\u6307\u5B9A\u306A\u3057"], ["CASH", "\u73FE\u9810\u91D1"], ["AR", "\u58F2\u639B\u91D1"], ["AP", "\u8CB7\u639B\u91D1\u30FB\u672A\u6255\u91D1"], ["RETAINED", "\u7E70\u8D8A\u5229\u76CA\u5270\u4F59\u91D1"]] }) })
          ] }),
          modal.type === "subaccount" && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Field, { label: "\u89AA\u79D1\u76EE", children: /* @__PURE__ */ jsx(Choice, { value: modal.account_id, onChange: (v) => setModal({ ...modal, account_id: v }), options: [["", "\u79D1\u76EE\u3092\u9078\u629E"], ...s.accounts.filter((a) => a.active).map((a) => [a.id, a.account_name])] }) }),
            /* @__PURE__ */ jsx(Field, { label: "\u88DC\u52A9\u79D1\u76EE\u540D", children: /* @__PURE__ */ jsx(Input, { required: true, value: modal.name, onChange: (e) => setModal({ ...modal, name: e.target.value }) }) })
          ] }),
          ["account", "subaccount"].includes(modal.type) && /* @__PURE__ */ jsxs("label", { className: "row", children: [
            /* @__PURE__ */ jsx(Checkbox, { checked: modal.active, onCheckedChange: (v) => setModal({ ...modal, active: v === true }) }),
            "\u6709\u52B9"
          ] }),
          !["create", "year"].includes(modal.type) && /* @__PURE__ */ jsx(Field, { label: "\u5909\u66F4\u7406\u7531\uFF08\u5FC5\u9808\uFF09", children: /* @__PURE__ */ jsx(Input, { required: true, maxLength: 300, value: modal.reason, onChange: (e) => setModal({ ...modal, reason: e.target.value }) }) })
        ] }),
        error && /* @__PURE__ */ jsx("p", { className: "alert", children: error }),
        /* @__PURE__ */ jsx(Button, { type: "submit", children: busy ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58" })
      ] }) })
    ] }) }),
    /* @__PURE__ */ jsx(AlertDialog, { open: !!confirm, onOpenChange: (v) => !v && setConfirm(null), children: /* @__PURE__ */ jsxs(AlertDialogContent, { children: [
      /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
        /* @__PURE__ */ jsx(AlertDialogTitle, { children: confirm?.title }),
        /* @__PURE__ */ jsx(AlertDialogDescription, { children: confirm?.status === "LOCKED" ? "\u3053\u306E\u671F\u9593\u306F\u901A\u5E38\u64CD\u4F5C\u3067\u89E3\u9664\u3067\u304D\u306A\u304F\u306A\u308A\u307E\u3059\u3002" : confirm?.type === "delete" ? "\u4ED5\u8A33\u306F\u4FDD\u5B58\u3055\u308C\u305F\u307E\u307E\u96C6\u8A08\u5BFE\u8C61\u304B\u3089\u9664\u5916\u3055\u308C\u307E\u3059\u3002" : "\u5909\u66F4\u5185\u5BB9\u3068\u5B9F\u884C\u8005\u3092\u76E3\u67FB\u30ED\u30B0\u306B\u8A18\u9332\u3057\u307E\u3059\u3002" })
      ] }),
      /* @__PURE__ */ jsx(Field, { label: "\u7406\u7531\uFF08\u5FC5\u9808\uFF09", children: /* @__PURE__ */ jsx(Input, { maxLength: 300, value: reason, onChange: (e) => setReason(e.target.value) }) }),
      error && /* @__PURE__ */ jsx("p", { className: "alert", children: error }),
      /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
        /* @__PURE__ */ jsx(AlertDialogCancel, { disabled: busy, children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }),
        /* @__PURE__ */ jsx(AlertDialogAction, { disabled: busy || !reason.trim(), onClick: (e) => {
          e.preventDefault();
          act({ ...confirm, reason });
        }, children: "\u5909\u66F4\u3092\u78BA\u5B9A" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(Dialog, { open: !!detail, onOpenChange: (v) => !v && setDetail(null), children: /* @__PURE__ */ jsxs(DialogContent, { className: "detail-dialog", children: [
      /* @__PURE__ */ jsxs(DialogHeader, { children: [
        /* @__PURE__ */ jsx(DialogTitle, { children: detail?.audit ? "\u76E3\u67FB\u30ED\u30B0\u8A73\u7D30" : `\u4ED5\u8A33 ${detail?.journal_number}` }),
        /* @__PURE__ */ jsx(DialogDescription, { children: detail?.audit ? detail.event_type : detail?.description })
      ] }),
      detail && (detail.audit ? /* @__PURE__ */ jsx("pre", { children: JSON.stringify(detail, null, 2) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("p", { children: [
          detail.transaction_date,
          " / ",
          detail.status,
          " / ",
          detail.counterparty
        ] }),
        detail.status === "DELETED" && /* @__PURE__ */ jsxs("div", { className: "alert", children: [
          "\u524A\u9664\u7406\u7531\uFF1A",
          detail.delete_reason,
          /* @__PURE__ */ jsx("br", {}),
          detail.deleted_at,
          " / ",
          detail.deleted_by
        ] }),
        /* @__PURE__ */ jsx(GridTable, { heads: ["\u79D1\u76EE", "\u88DC\u52A9\u79D1\u76EE", "\u501F\u65B9", "\u8CB8\u65B9", "\u660E\u7D30\u6458\u8981"], rows: currentLines(s, detail).map((l) => [accountName(l.account_id), subaccountName(s,l), money(l.debit_amount), money(l.credit_amount), l.line_description]) }),
        /* @__PURE__ */ jsx(TaxDetails, { lines: currentLines(s, detail) }),
        /* @__PURE__ */ jsxs("p", { className: "muted", children: [
          "\u660E\u7D30\u7248\uFF1A",
          detail.revision,
          " / \u4F5C\u6210\uFF1A",
          detail.created_at,
          " / \u66F4\u65B0\uFF1A",
          detail.updated_at
        ] })
      ] }))
    ] }) })
  ] });
}
export {
  AccountingApp as default
};
