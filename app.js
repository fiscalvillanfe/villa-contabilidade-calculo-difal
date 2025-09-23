// DIFAL calculator (clean, from-scratch).
// No external libs. No auto-print. Simple & reliable.

const ufList = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RN","RS","RJ","RO","RR","SC","SP","SE","TO"];

function $(id){ return document.getElementById(id); }
function toNumberBR(v){
  if (typeof v === "number") return v;
  if (!v) return 0;
  v = String(v).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
function fmtMoney(n){ return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtPct(n){ return n.toLocaleString("pt-BR",{minimumFractionDigits:2, maximumFractionDigits:2}) + "%"; }

function fillUFs(){
  const o = $("ufOrigem"), d = $("ufDestino");
  const opts = '<option value="">Selecione</option>' + ufList.map(u=>`<option>${u}</option>`).join("");
  o.innerHTML = opts; d.innerHTML = opts;
}

function calc(){
  const ufO = $("ufOrigem").value;
  const ufD = $("ufDestino").value;
  const aliqInter = toNumberBR($("aliqInter").value);
  const aliqInterna = toNumberBR($("aliqInterna").value);
  const valor = toNumberBR($("valor").value);
  const fcp = toNumberBR($("fcp").value || 0);
  const redDest = toNumberBR($("redDest").value || 0);
  const redOrig = toNumberBR($("redOrig").value || 0);

  if(!ufO || !ufD || !aliqInter || !aliqInterna || !valor){
    alert("Preencha os campos obrigatórios.");
    return;
  }

  // Aplicar reduções simples: percentual "em %"
  const baseOrig = valor * (1 - redOrig/100);
  const baseDest = valor * (1 - redDest/100);

  const difalAliq = Math.max(aliqInterna - aliqInter, 0);
  const difalValor = baseDest * (difalAliq/100);
  const fcpValor = baseDest * (fcp/100);

  const resumo = [
    {label:"Base destino", value: fmtMoney(baseDest)},
    {label:"Aliq. interna", value: fmtPct(aliqInterna)},
    {label:"Aliq. inter", value: fmtPct(aliqInter)},
    {label:"DIFAL", value: fmtMoney(difalValor)},
    {label:"FCP", value: fmtMoney(fcpValor)},
  ];

  $("resumo").innerHTML = resumo.map(r => `
    <div class="stat">
      <div class="label">${r.label}</div>
      <div class="value">${r.value}</div>
    </div>
  `).join("");

  $("detalhe").innerHTML = `
    <table>
      <thead><tr><th>Item</th><th>Fórmula</th><th>Valor</th></tr></thead>
      <tbody>
        <tr><td>Base no destino</td><td>Valor * (1 - Redução destino)</td><td>${fmtMoney(baseDest)}</td></tr>
        <tr><td>Diferença de alíquotas</td><td>(Aliq. interna - Aliq. inter)</td><td>${fmtPct(difalAliq)}</td></tr>
        <tr><td>DIFAL devido ao destino</td><td>Base destino * Diferença</td><td>${fmtMoney(difalValor)}</td></tr>
        <tr><td>FCP</td><td>Base destino * FCP%</td><td>${fmtMoney(fcpValor)}</td></tr>
      </tbody>
    </table>
  `;

  // Link de compartilhamento (preenche via URL)
  const params = new URLSearchParams({ ufO, ufD, aliqInter, aliqInterna, valor, fcp, redDest, redOrig });
  const shareUrl = location.origin + location.pathname + "?" + params.toString();
  const btnShare = $("btnShare"); btnShare.href = shareUrl;

  $("resultCard").hidden = false;
}

function restoreFromURL(){
  const q = new URLSearchParams(location.search);
  if(!q.size) return;
  const map = { ufOrigem:"ufO", ufDestino:"ufD", aliqInter:"aliqInter", aliqInterna:"aliqInterna", valor:"valor", fcp:"fcp", redDest:"redDest", redOrig:"redOrig" };
  Object.entries(map).forEach(([id,key])=>{
    const v = q.get(key);
    if (v !== null) {
      const el = $(id); if(el) el.value = v;
    }
  });
}

function copyResumo(){
  const text = document.querySelector("#resumo")?.innerText || "";
  if (!text) return;
  navigator.clipboard.writeText(text).then(()=> alert("Resumo copiado."));
}

function init(){
  fillUFs();
  restoreFromURL();
  $("btnCalc").addEventListener("click", calc);
  $("btnCopy").addEventListener("click", copyResumo);
}
document.addEventListener("DOMContentLoaded", init);
