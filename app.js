
(function(){
  const ufs = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
  const sel = id => document.getElementById(id);
  const fmtMoney = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const fmtPct = v => (v).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) + '%';
  const parsePt = (str)=>{
    if(!str) return 0;
    str = String(str).replace(/\./g,'').replace(',', '.');
    const n = parseFloat(str);
    return isFinite(n)? n: 0;
  };

  function fillUFs() {
    for (const id of ['ufOrigem','ufDestino']) {
      const el = sel(id);
      el.innerHTML = '<option value="">Selecione</option>' + ufs.map(u=>`<option value="${u}">${u}</option>`).join('');
    }
  }

  function calcular() {
    const valor = parsePt(sel('valor').value);
    const aliqInt = parsePt(sel('aliqInterna').value)/100;
    let aliqInter = parsePt(sel('aliqInter').value)/100;
    const fcp = parsePt(sel('fcp').value)/100;
    const redOrig = parsePt(sel('redOrigem').value)/100;
    const redDest = parsePt(sel('redDestino').value)/100;
    const merc4 = sel('quatro').value === 'sim';

    // regra simples para 4% se marcado
    if (merc4) aliqInter = 0.04;

    // Base origem/destino após reduções
    const baseOrig = valor * (1 - redOrig);
    const baseDest = valor * (1 - redDest);

    // Fórmula por-dentro (alíquota interna por dentro):
    // DIFAL = BaseDest * ( (ai - ae) / (1 - ai) )
    let difal = 0;
    if (aliqInt > 0 && aliqInter >= 0) {
      difal = baseDest * ((aliqInt - aliqInter) / (1 - aliqInt));
    }

    const fcpValor = baseDest * fcp;

    // KPIs
    sel('kBase').textContent = fmtMoney(baseDest);
    sel('kAliqInt').textContent = fmtPct(aliqInt*100);
    sel('kAliqInter').textContent = fmtPct(aliqInter*100);
    sel('kDifal').textContent = fmtMoney(difal);
    sel('kFcp').textContent = fmtMoney(fcpValor);

    // Detalhamento
    const rows = [
      ['Base no destino', 'Valor × (1 − Redução destino)', fmtMoney(baseDest)],
      ['Diferença de alíquotas "por dentro"', '(Aliq. interna − Aliq. inter) ÷ (1 − Aliq. interna)', ((aliqInt-aliqInter)/(1-aliqInt)*100).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) + '%'],
      ['DIFAL devido ao destino', 'Base destino × Diferença', fmtMoney(difal)],
      ['FCP', 'Base destino × FCP%', fmtMoney(fcpValor)]
    ];
    const tbody = sel('tDetalhe');
    tbody.innerHTML = rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');

    sel('resultado').hidden = false;
  }

  function limpar() {
    for (const id of ['valor','fcp','redOrigem','redDestino']) sel(id).value='';
    for (const id of ['ufOrigem','ufDestino','aliqInter','aliqInterna']) sel(id).selectedIndex=0;
    sel('resultado').hidden = true;
  }

  function copiarResumo(){
    const txt = [
      'Resumo DIFAL',
      'Base destino: ' + sel('kBase').textContent,
      'Aliq. interna: ' + sel('kAliqInt').textContent,
      'Aliq. inter: ' + sel('kAliqInter').textContent,
      'DIFAL: ' + sel('kDifal').textContent,
      'FCP: ' + sel('kFcp').textContent,
    ].join('\n');
    navigator.clipboard.writeText(txt).then(()=>{ alert('Resumo copiado.'); });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    fillUFs();
    sel('btnCalcular').addEventListener('click', calcular);
    sel('btnLimpar').addEventListener('click', limpar);
    sel('copiar').addEventListener('click', copiarResumo);
  });
})();
