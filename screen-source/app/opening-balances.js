import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { openingPlan } from "@/lib/accounting/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function OpeningBalances({ s, year, act, busy }) {
  const plan = openingPlan(s, year.id);
  const [balances, setBalances] = useState(() => plan.rows.map((a) => ({ account_id: a.id, subaccount_name: a.subaccount_name, debit_amount: BigInt(a.target) > 0n ? a.target : "0", credit_amount: BigInt(a.target) < 0n ? String(-BigInt(a.target)) : "0" })));
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const startJournals = s.journals.filter((j) => j.status === "ACTIVE" && j.transaction_date === year.start && j.journal_kind !== "OPENING").length;
  const debit = balances.reduce((n, b) => n + BigInt(b.debit_amount || "0"), 0n);
  const credit = balances.reduce((n, b) => n + BigInt(b.credit_amount || "0"), 0n);
  const editable = year.status === "OPEN" && s.periods.find((p) => p.year_id === year.id && p.start === year.start)?.status === "OPEN" && s.years.filter((y) => y.end < year.start).every((y) => y.status === "LOCKED");
  const rowFor = b => plan.rows.find(a=>a.id===b.account_id && a.subaccount_name===(b.subaccount_name || '')) || {...s.accounts.find(a=>a.id===b.account_id),baseline:'0',target:'0'};
  const changed = balances.some(b=>String(BigInt(b.debit_amount || '0')-BigInt(b.credit_amount || '0'))!==rowFor(b).target);
  const add = a => setBalances([...balances,{account_id:a.id,subaccount_name:'',debit_amount:'0',credit_amount:'0',added:true}].sort((a,b)=>s.accounts.find(x=>x.id===a.account_id).account_code.localeCompare(s.accounts.find(x=>x.id===b.account_id).account_code,'ja',{numeric:true})));
  const validNames = balances.every((b,i)=>!b.subaccount_name.includes('*') && (!b.added || b.subaccount_name.trim()) && !balances.some((v,j)=>j!==i && v.account_id===b.account_id && v.subaccount_name.trim()===b.subaccount_name.trim()));
  const update = (index, key, value) => setBalances(balances.map((b, i) => i === index ? { ...b, [key]: value.replace(/\D/g, "").slice(0, 12) } : b));
  return jsxs("details", { className: "opening-settings", children: [
    jsx("summary", { children: "期首残高を設定（差額仕訳）" }),
    jsx("p", { children: "設定したい期首残高を借方・貸方で入力してください。繰越残高との差額だけを保存し、当期発生額には含めません。補助科目行を追加して内訳を入力できます。補助科目なしの行も含めた合計を設定してください。再保存は同じ仕訳を改訂します。" }),
    !editable && jsx("p", { className: "muted", children: "対象年度と期首月をOPENにし、前年度までをLOCKすると設定できます。" }),
    jsx("form", { onSubmit: (e) => { e.preventDefault(); act({ type: "opening", year_id: year.id, balances, reason, confirm_start_journals: confirmed }); }, children: jsxs("fieldset", { disabled: busy || !editable, children: [
      jsx("div", { className: "opening-table-scroll", children: jsxs("table", { className: "opening-table", children: [
        jsx("thead", { children: jsx("tr", { children: ["勘定科目", "補助科目", "繰越残高（借＋／貸−）", "設定残高・借方", "設定残高・貸方", "保存する差額（借＋／貸−）"].map((label) => jsx("th", { children: label }, label)) }) }),
        jsx("tbody", { children: balances.map((b, i) => { const a=rowFor(b); return jsx("tr", { children: [
          jsxs("td", { children: [a.account_code+' '+a.account_name, a.active && a.subaccount_input!=='NONE' && jsx(Button,{type:'button',onClick:()=>add(a),children:'補助科目行を追加'})] }),
          jsxs("td", { children: [b.added ? jsx(Input,{maxLength:300,placeholder:'補助科目名（自由入力）',value:b.subaccount_name,onChange:e=>setBalances(balances.map((v,n)=>n===i?{...v,subaccount_name:e.target.value}:v))}) : (b.subaccount_name || '（補助科目なし）'), b.added && jsx(Button,{type:'button',onClick:()=>setBalances(balances.filter((_,n)=>n!==i)),children:'行を削除'})] }),
          jsx("td", { children: a.baseline }),
          jsx("td", { children: jsx(Input, { "aria-label": `${a.account_name} 期首借方`, inputMode: "numeric", value: balances[i].debit_amount, disabled: !a.active, onChange: (e) => update(i, "debit_amount", e.target.value) }) }),
          jsx("td", { children: jsx(Input, { "aria-label": `${a.account_name} 期首貸方`, inputMode: "numeric", value: balances[i].credit_amount, disabled: !a.active, onChange: (e) => update(i, "credit_amount", e.target.value) }) }),
          jsx("td", { children: String(BigInt(balances[i].debit_amount || "0") - BigInt(balances[i].credit_amount || "0") - BigInt(a.baseline)) })
        ] }, i); }) })
      ] }) }),
      jsx("p", { role: "status", children: `借方合計 ${debit}円 ／ 貸方合計 ${credit}円 ／ 差額 ${debit - credit}円` }),
      startJournals > 0 && jsxs("label", { className: "row", children: [jsx("input", { type: "checkbox", required: true, checked: confirmed, onChange: (e) => setConfirmed(e.target.checked) }), `期首日に通常仕訳が${startJournals}件あります。開始残高の重複がないことを確認しました。既存の開始残高仕訳は自動変換されません。`] }),
      jsxs("label", { children: ["設定理由（必須）", jsx(Input, { required: true, maxLength: 300, value: reason, onChange: (e) => setReason(e.target.value) })] }),
      jsx(Button, { type: "submit", disabled: !validNames || !changed || debit !== credit || !reason.trim(), children: "差額を期首残高仕訳として保存" })
    ] }) })
  ] });
}
