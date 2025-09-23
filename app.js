// Robust DIFAL calculator (no libs)

(function(){
  var ufList = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RN","RS","RJ","RO","RR","SC","SP","SE","TO"];

  function $(id){ return document.getElementById(id); }
  function toNumberBR(v){
    if (typeof v === "number") return v;
    if (!v) return 0;
    v = String(v).replace(/\./g, "").replace(",", ".");
    var n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
  function fmtMoney(n){ return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
  function fmtPct(n){ return n.toLocaleString("pt-BR",{minimumFractionDigits:2, maximumFractionDigits:2}) + "%"; }

  function fillUFs(){
    var o = $("ufOrigem"), d = $("ufDestino");
    var opts = '<option value="">Selecione</option>' + ufList.map(function(u){return "<option>"+u+"</option>";}).join("");
    if (o) o.innerHTML = opts;
    if (d) d.innerHTML = opts;
  }

  function calc(){
    var ufO = $("ufOrigem").value;
    var ufD = $("ufDestino").value;
    var aliqInter = toNumberBR($("aliqInter").value);
    var aliqInterna = toNumberBR($("aliqInterna").value);
    var valor = toNumberBR($("valor").value);
    var fcp = toNumberBR($("fcp").value || 0);
    var redDest = toNumberBR($("redDest").value || 0);
    var redOrig = toNumberBR($("redOrig").value || 0);

    if(!ufO || !ufD || !aliqInter || !aliqInterna || !valor){
      alert("Preencha UF origem, UF destino, alíquotas e valor.");
      return;
    }

    var baseOrig = valor * (1 - redOrig/100);
    var baseDest = valor * (1 - redDest/100);

    var difalAliq = Math.max(aliqInterna - aliqInter, 0);
    var difalValor = baseDest * (difalAliq/100);
    var fcpValor = baseDest * (fcp/100);

    var resumo = [
      {label:"Base destino", value: fmtMoney(baseDest)},
      {label:"Aliq. interna", value: fmtPct(aliqInterna)},
      {label:"Aliq. inter", value: fmtPct(aliqInter)},
      {label:"DIFAL", value: fmtMoney(difalValor)},
      {label:"FCP", value: fmtMoney(fcpValor)}
    ];

    var rs = $("resumo");
    rs.innerHTML = resumo.map(function(r){
      return '<div class="stat"><div class="label">'+r.label+'</div><div class="value">'+r.value+'</div></div>';
    }).join("");

    $("detalhe").innerHTML = ''
      + '<table>'
      + '<thead><tr><th>Item</th><th>Fórmula</th><th>Valor</th></tr></thead>'
      + '<tbody>'
      + '<tr><td>Base no destino</td><td>Valor * (1 - Redução destino)</td><td>'+fmtMoney(baseDest)+'</td></tr>'
      + '<tr><td>Diferença de alíquotas</td><td>(Aliq. interna - Aliq. inter)</td><td>'+fmtPct(difalAliq)+'</td></tr>'
      + '<tr><td>DIFAL devido ao destino</td><td>Base destino * Diferença</td><td>'+fmtMoney(difalValor)+'</td></tr>'
      + '<tr><td>FCP</td><td>Base destino * FCP%</td><td>'+fmtMoney(fcpValor)+'</td></tr>'
      + '</tbody></table>';

    var params = new URLSearchParams({ ufO:ufO, ufD:ufD, aliqInter:aliqInter, aliqInterna:aliqInterna, valor:valor, fcp:fcp, redDest:redDest, redOrig:redOrig });
    var shareUrl = location.origin + location.pathname + "?" + params.toString();
    var btnShare = $("btnShare"); if (btnShare) btnShare.href = shareUrl;

    $("resultCard").hidden = false;
  }

  function restoreFromURL(){
    var q = new URLSearchParams(location.search);
    if(!q.size) return;
    var map = { ufOrigem:"ufO", ufDestino:"ufD", aliqInter:"aliqInter", aliqInterna:"aliqInterna", valor:"valor", fcp:"fcp", redDest:"redDest", redOrig:"redOrig" };
    for (var id in map){
      var el = $(id); if (!el) continue;
      var v = q.get(map[id]); if (v !== null) el.value = v;
    }
  }

  function copyResumo(){
    var r = document.querySelector("#resumo");
    var text = r ? r.innerText : "";
    if (!text) return;
    navigator.clipboard.writeText(text).then(function(){ alert("Resumo copiado."); });
  }

  function init(){
    fillUFs();
    restoreFromURL();
    var bc = $("btnCalc"); if (bc) bc.addEventListener("click", calc);
    var cp = $("btnCopy"); if (cp) cp.addEventListener("click", copyResumo);
  }

  window.__difal_init = init;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
