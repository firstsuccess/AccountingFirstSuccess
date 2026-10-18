"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
function CSVImport({ s, onSaved, start, end }) {
  const [exportFrom,setExportFrom]=useState(start||s.company.start),[exportTo,setExportTo]=useState(end||s.company.end);
  const validExportRange=!!exportFrom && !!exportTo && exportFrom<=exportTo;
  const [text, setText] = useState(""), [filename, setFilename] = useState(""), [reason, setReason] = useState(""), [preview, setPreview] = useState(null), [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  async function choose(file) {
    setPreview(null);
    setText("");
    setFilename("");
    setError("");
    setMessage("");
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 5e6) throw new Error("CSV\u306F5MB\u4EE5\u5185\u3067\u3059");
      const bytes = await file.arrayBuffer();
      let decoded;
      try {
        decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        decoded = new TextDecoder("shift_jis", { fatal: true }).decode(bytes);
      }
      setText(decoded);
      setFilename(file.name);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function run(execute) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/accounting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: execute ? "csv_execute" : "csv_preview", company_id: s.company.id, version: execute ? preview?.version : s.company.version, csv: text, filename, reason }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "\u51E6\u7406\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      if (execute) {
        onSaved(data);
        setPreview(null);
        setText("");
        setMessage("\u53D6\u8FBC\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002\u5404\u4F1D\u7968\u306E\u5909\u66F4\u524D\u5F8C\u306F\u76E3\u67FB\u30ED\u30B0\u3067\u78BA\u8A8D\u3067\u304D\u307E\u3059\u3002");
      } else setPreview(data);
    } catch (e) {
      setError(e.message);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs("section", { className: "panel", children: [
    /* @__PURE__ */ jsx("h2", { children: "\u4ED5\u8A33CSV\u53D6\u8FBC" }),
    /* @__PURE__ */ jsxs("p", { children: [
      "\u5BFE\u8C61\u4F1A\u793E\uFF1A",
      /* @__PURE__ */ jsx("strong", { children: s.company.name }),
      "\u3002\u30D5\u30A1\u30A4\u30EB\u9078\u629E\u3060\u3051\u3067\u306F\u767B\u9332\u3057\u307E\u305B\u3093\u3002"
    ] }),
    jsxs("div",{className:"filters",children:[
      jsxs("label",{className:"field",children:[jsx("span",{children:"取引日 From"}),jsx(Input,{type:"date","aria-label":"取引日 From",value:exportFrom,max:exportTo||undefined,onChange:e=>setExportFrom(e.target.value)})]}),
      jsxs("label",{className:"field",children:[jsx("span",{children:"取引日 To"}),jsx(Input,{type:"date","aria-label":"取引日 To",value:exportTo,min:exportFrom||undefined,onChange:e=>setExportTo(e.target.value)})]})
    ]}),
    /* @__PURE__ */ jsxs("p", { children: [
      /* @__PURE__ */ jsx("a", { className: "textlink", href: validExportRange ? `/api/accounting?${new URLSearchParams({company:s.company.id,export:"journal_transfer",from:exportFrom,to:exportTo})}` : undefined, "aria-disabled": !validExportRange, onClick:e=>{if(!validExportRange){e.preventDefault();setError("取引日From・Toを正しく指定してください");}}, children: "\u518D\u53D6\u8FBC\u7528\u4ED5\u8A33CSV\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9" }),
      "\u3057\u3066\u7DE8\u96C6\u3057\u3066\u304F\u3060\u3055\u3044\u30021\u56DE\u306B\u3064\u304D\u660E\u7D301000\u884C\u30FB500\u4F1D\u7968\u30FB5MB\u307E\u3067\u3002"
    ] }),
    /* @__PURE__ */ jsx("p", { className: "muted", children: "\u4F1D\u7968\u756A\u53F7\u3042\u308A\uFF1A\u65E2\u5B58ACTIVE\u4F1D\u7968\u306E\u5168\u660E\u7D30\u3092\u7F6E\u304D\u63DB\u3048\u3001\u5B58\u5728\u3057\u306A\u3044\u756A\u53F7\u306F\u65B0\u898F\u767B\u9332\u3002\u756A\u53F7\u306A\u3057\uFF1A\u540C\u3058import_group\u306E\u884C\u3092\u65B0\u898F\u8907\u5408\u4ED5\u8A33\u3068\u3057\u3066\u81EA\u52D5\u63A1\u756A\u3057\u307E\u3059\u3002\u524A\u9664\u6E08\u307F\u30FBCLOSED\u30FBLOCKED\u306F\u767B\u9332\u3067\u304D\u307E\u305B\u3093\u3002" }),
    /* @__PURE__ */ jsx("p", { className: "muted", children: "\u501F\u65B9\u30FB\u8CB8\u65B9\u306F\u7A0E\u629C\u672C\u4F53\u306E\u8A18\u5E33\u91D1\u984D\u3001input_amount\u306F\u5165\u529B\u91D1\u984D\u3067\u3059\u3002\u7A0E\u60C5\u5831\u3092\u6307\u5B9A\u3059\u308B\u5834\u5408\u306F\u7A0E\u7387\u30FB\u672C\u4F53\u30FB\u7A0E\u984D\u30FB\u7A0E\u8FBC\u984D\u3082\u5FC5\u9808\u3067\u3059\u3002\u81EA\u52D5\u7A0E\u660E\u7D30\u3092CSV\u306B\u542B\u3081\u306A\u3044\u3067\u304F\u3060\u3055\u3044\u3002Excel\u3067\u306F\u4F1D\u7968\u756A\u53F7\u30FB\u79D1\u76EE\u30B3\u30FC\u30C9\u3092\u6587\u5B57\u5217\u3068\u3057\u3066\u8AAD\u307F\u8FBC\u307F\u3001\u5148\u982D\u306E0\u3092\u4FDD\u6301\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }),
    /* @__PURE__ */ jsxs("label", { className: "field", children: [
      /* @__PURE__ */ jsx("span", { children: "CSV\u30D5\u30A1\u30A4\u30EB\uFF08UTF-8 / Shift_JIS\uFF09" }),
      /* @__PURE__ */ jsx(Input, { type: "file", accept: ".csv,text/csv", disabled: busy, onChange: (e) => choose(e.target.files?.[0]) })
    ] }),
    /* @__PURE__ */ jsxs("label", { className: "field", children: [
      /* @__PURE__ */ jsx("span", { children: "\u53D6\u8FBC\u30FB\u4E0A\u66F8\u304D\u7406\u7531\uFF08\u5FC5\u9808\uFF09" }),
      /* @__PURE__ */ jsx(Input, { value: reason, maxLength: 300, disabled: busy, onChange: (e) => {
        setReason(e.target.value);
        setPreview(null);
      } })
    ] }),
    /* @__PURE__ */ jsx(Button, { disabled: busy || !text || !reason.trim(), onClick: () => run(false), children: "\u5F62\u5F0F\u30FB\u767B\u9332\u5185\u5BB9\u3092\u78BA\u8A8D" }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert", role: "alert", children: [
      error,
      "\u3000\u767B\u9332\u72B6\u6CC1\u304C\u4E0D\u660E\u306A\u901A\u4FE1\u30A8\u30E9\u30FC\u306E\u5834\u5408\u306F\u3001\u518D\u8AAD\u8FBC\u3057\u3066\u4ED5\u8A33\u5E33\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
    ] }),
    message && /* @__PURE__ */ jsx("div", { className: "success", role: "status", children: message }),
    preview && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("h3", { children: [
        "\u767B\u9332\u5185\u5BB9\u306E\u78BA\u8A8D\uFF1A",
        preview.summary.length,
        "\u4F1D\u7968"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        filename,
        " \u2014 ",
        s.company.name
      ] }),
      /* @__PURE__ */ jsx("p", { children: "\u30A8\u30E9\u30FC\u304C\u3042\u308B\u5834\u5408\u306F\u30D5\u30A1\u30A4\u30EB\u5168\u4F53\u3092\u767B\u9332\u3057\u307E\u305B\u3093\u3002\u4E0A\u66F8\u304D\u524D\u306E\u660E\u7D30\u306F\u904E\u53BB\u7248\u3068\u3057\u3066\u4FDD\u6301\u3057\u307E\u3059\u3002" }),
      preview.summary.map((j) => /* @__PURE__ */ jsxs("details", { open: true, children: [
        /* @__PURE__ */ jsxs("summary", { children: [
          j.action,
          " / ",
          j.journal_number,
          " / ",
          j.transaction_date,
          " / ",
          j.description,
          " \u2014 \u501F\u65B9\u30FB\u8CB8\u65B9\u5404 ",
          BigInt(j.debit).toLocaleString(),
          "\u5186\uFF08\u65E7",
          j.old_lines,
          "\u884C \u2192 \u65B0",
          j.new_lines,
          "\u884C\uFF09"
        ] }),
        /* @__PURE__ */ jsx("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxs("table", { children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { children: ["\u52D8\u5B9A\u79D1\u76EE", "\u660E\u7D30\u6458\u8981", "\u501F\u65B9", "\u8CB8\u65B9", "\u7A0E\u533A\u5206", "\u7A0E\u7387", "\u5165\u529B\u91D1\u984D", "\u7A0E\u984D"].map((x) => /* @__PURE__ */ jsx("th", { children: x }, x)) }) }),
          /* @__PURE__ */ jsx("tbody", { children: j.lines.map((l, i) => /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { children: l.account }),
            /* @__PURE__ */ jsx("td", { children: l.description }),
            /* @__PURE__ */ jsx("td", { children: l.debit }),
            /* @__PURE__ */ jsx("td", { children: l.credit }),
            /* @__PURE__ */ jsx("td", { children: l.tax_code }),
            /* @__PURE__ */ jsx("td", { children: l.tax_rate ?? "\u672A\u8A2D\u5B9A" }),
            /* @__PURE__ */ jsx("td", { children: l.input_amount }),
            /* @__PURE__ */ jsx("td", { children: l.tax_amount ?? "\u672A\u8A2D\u5B9A" })
          ] }, i)) })
        ] }) })
      ] }, j.journal_number)),
      preview.version !== s.company.version && /* @__PURE__ */ jsx("div", { className: "alert", children: "\u78BA\u8A8D\u5F8C\u306B\u5E33\u7C3F\u304C\u66F4\u65B0\u3055\u308C\u307E\u3057\u305F\u3002\u767B\u9332\u5185\u5BB9\u3092\u518D\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }),
      /* @__PURE__ */ jsxs(Button, { disabled: busy || preview.version !== s.company.version, onClick: () => run(true), children: [
        "\u78BA\u8A8D\u3057\u305F\u5185\u5BB9\u3067",
        preview.summary.length,
        "\u4F1D\u7968\u3092\u767B\u9332\u30FB\u4E0A\u66F8\u304D\u3059\u308B"
      ] })
    ] })
  ] });
}
export {
  CSVImport
};
