// Lista de UFs
const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG",
  "MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR",
  "RS","SC","SE","SP","TO"
];

// Helpers de formatação
const fmtMoney = v =>
  (isNaN(v) ? 0 : v).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

// Máscara de dinheiro
function maskMoney(el) {
  const only = String(el.value || "").replace(/[^\d]/g, "");
  const n = parseInt(only || "0", 10) / 100;
  el.value = n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Converte "1.234,56" → 1234.56
function getNumberFromBRL(str) {
  if (!str) return 0;
  return Number(
    String(str).replace(/\./g, "").replace(",", ".")
  ) || 0;
}

// Lê campo em % e devolve decimal (18 → 0.18)
function parsePercentField(el) {
  if (!el) return 0;
  const raw = String(el.value || "").replace(",", ".").trim();
  const n = Number(raw);
  if (isNaN(n)) return 0;
  return n / 100;
}

// Tabelas carregadas dos JSON
let ALIQUOTA_INTERNA = {};
let ALIQUOTA_INTERESTADUAL = {};
let NCM_MAP = {};
let NCM_META = { dataAtualizacao: "", ato: "" };

// Normaliza NCM pra só dígitos
function normalizarNcm(str) {
  if (!str) return "";
  return String(str).replace(/\D/g, "");
}

// Carrega os 3 JSONs (interna, interestadual, NCM)
async function carregarTabelas() {
  try {
    const [intRes, interRes, ncmRes] = await Promise.all([
      fetch("Aliquota_interna.json"),
      fetch("Tabela_Aliquota_interestadual.json"),
      fetch("Tabela_NCM_Vigente_20251104.json")
    ]);

    if (intRes.ok) {
      ALIQUOTA_INTERNA = await intRes.json();
    }
    if (interRes.ok) {
      ALIQUOTA_INTERESTADUAL = await interRes.json();
    }
    if (ncmRes.ok) {
      const ncmData = await ncmRes.json();
      NCM_META.dataAtualizacao =
        ncmData.Data_Ultima_Atualizacao_NCM || "";
      NCM_META.ato = ncmData.Ato || "";
      NCM_MAP = {};
      if (Array.isArray(ncmData.Nomenclaturas)) {
        for (const item of ncmData.Nomenclaturas) {
          const key = normalizarNcm(item.Codigo);
          if (key) NCM_MAP[key] = item;
        }
      }
    }
  } catch (e) {
    console.error("Erro ao carregar JSONs:", e);
  } finally {
    atualizarDescricaoNcm();
  }
}

function fillUFs() {
  const o = document.getElementById("ufOrigem");
  const d = document.getElementById("ufDestino");
  if (!o || !d) return;

  const opts = ['<option value="">Selecione</option>']
    .concat(UFS.map(u => `<option value="${u}">${u}</option>`))
    .join("");

  o.innerHTML = opts;
  d.innerHTML = opts;
}

// Atualiza descrição do NCM (somente visual)
function atualizarDescricaoNcm() {
  const ncmInput = document.getElementById("ncm");
  const descEl = document.getElementById("ncmDescricao");
  if (!ncmInput || !descEl) return;

  const keyDigits = normalizarNcm(ncmInput.value);

  if (!keyDigits) {
    descEl.textContent = "Digite o NCM para buscar";
    return;
  }

  if (!Object.keys(NCM_MAP).length) {
    descEl.textContent = "Tabela de NCM ainda não carregada.";
    return;
  }

  const item = NCM_MAP[keyDigits];
  if (!item) {
    descEl.textContent = "NCM não encontrado na tabela vigente.";
    return;
  }

  descEl.textContent = `${item.Codigo} - ${item.Descricao}`;
}

// Cálculo principal (alíquotas 100% internas)
function calcular(e) {
  e.preventDefault();

  const valorEl = document.getElementById("valor");
  const fcpEl = document.getElementById("fcp");
  const redDestinoEl = document.getElementById("redDestino");
  const redOrigemEl = document.getElementById("redOrigem");
  const ufOrigemEl = document.getElementById("ufOrigem");
  const ufDestinoEl = document.getElementById("ufDestino");
  const ncmEl = document.getElementById("ncm");

  const valor = getNumberFromBRL(valorEl && valorEl.value);
  const fcpPct = parsePercentField(fcpEl);          // decimal
  const redDestino = parsePercentField(redDestinoEl); // decimal
  const redOrigem = parsePercentField(redOrigemEl);   // decimal (usado só no resumo)

  const ufO = ufOrigemEl && ufOrigemEl.value;
  const ufD = ufDestinoEl && ufDestinoEl.value;

  if (!ufO || !ufD) {
    alert("Selecione UF de origem e destino.");
    return;
  }

  if (!valor) {
    alert("Informe o valor da operação.");
    if (valorEl) valorEl.focus();
    return;
  }

  // Pega alíquotas dos JSON (em %)
  const aliqIntPct = ALIQUOTA_INTERNA[ufD];
  const aliqInterPct =
    ALIQUOTA_INTERESTADUAL[ufO] &&
    ALIQUOTA_INTERESTADUAL[ufO][ufD];

  if (aliqIntPct == null || aliqInterPct == null) {
    alert("Não foi possível determinar as alíquotas para essa combinação de UF. Verifique os JSON de alíquotas.");
    return;
  }

  const aliqInt = aliqIntPct / 100;     // decimal
  const aliqInter = aliqInterPct / 100; // decimal

  // Base de cálculo no destino (sem MVA, só redução destino)
  const baseDestino = valor * (1 - redDestino);

  // Diferença por dentro
  let difPct = 0;
  if (aliqInt > 0) {
    difPct = (aliqInt - aliqInter) / (1 - aliqInt);
  }

  const difal = baseDestino * difPct;
  const fcpValor = baseDestino * fcpPct;

  // Mostra cards
  const cards = document.getElementById("cards");
  const detalhe = document.getElementById("detalhe");
  if (cards) cards.classList.remove("hidden");
  if (detalhe) detalhe.classList.remove("hidden");

  // Cards (sem mostrar % de alíquota)
  const outBase = document.getElementById("outBase");
  const outDifal = document.getElementById("outDifal");
  const outFcp = document.getElementById("outFcp");

  if (outBase) outBase.textContent = fmtMoney(baseDestino);
  if (outDifal) outDifal.textContent = fmtMoney(difal);
  if (outFcp) outFcp.textContent = fmtMoney(fcpValor);

  // Tabela (sem mostrar % de alíquota)
  const rowBase = document.getElementById("rowBase");
  const rowDifal = document.getElementById("rowDifal");
  const rowFcp = document.getElementById("rowFcp");

  if (rowBase) rowBase.textContent = fmtMoney(baseDestino);
  if (rowDifal) rowDifal.textContent = fmtMoney(difal);
  if (rowFcp) rowFcp.textContent = fmtMoney(fcpValor);

  // NCM + descrição pra resumo
  const ncmDigits = normalizarNcm(ncmEl && ncmEl.value);
  let ncmDescricao = "";
  if (ncmDigits && NCM_MAP[ncmDigits]) {
    ncmDescricao = `${NCM_MAP[ncmDigits].Codigo} - ${NCM_MAP[ncmDigits].Descricao}`;
  }

  // Resumo para copiar (aqui SIM aparecem as alíquotas)
  const resumo = [
    `UF Origem: ${ufO}`,
    `UF Destino: ${ufD}`,
    `NCM: ${ncmDescricao || (ncmEl && ncmEl.value) || "Não informado"}`,
    `Valor da operação: ${fmtMoney(valor)}`,
    ``,
    `Alíquota interna destino (JSON): ${aliqIntPct.toFixed(2).replace(".", ",")}%`,
    `Alíquota interestadual (JSON): ${aliqInterPct.toFixed(2).replace(".", ",")}%`,
    `Diferença por dentro: ${(difPct * 100).toFixed(2).replace(".", ",")}%`,
    ``,
    `Redução base origem: ${(redOrigem * 100).toFixed(2).replace(".", ",")}%`,
    `Redução base destino: ${(redDestino * 100).toFixed(2).replace(".", ",")}%`,
    `FCP destino: ${(fcpPct * 100).toFixed(2).replace(".", ",")}%`,
    ``,
    `Base de cálculo no destino: ${fmtMoney(baseDestino)}`,
    `DIFAL devido ao destino: ${fmtMoney(difal)}`,
    `FCP: ${fmtMoney(fcpValor)}`
  ].join("\n");

  const btnCopy = document.getElementById("btnCopy");
  if (btnCopy) {
    btnCopy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(resumo);
        alert("Resumo copiado!");
      } catch (err) {
        alert("Não foi possível copiar.");
      }
    };
  }

  // Link de compartilhamento (guarda parâmetros básicos)
  const params = new URLSearchParams({
    valor: String(valor),
    fcp: String(fcpPct),
    redDestino: String(redDestino),
    redOrigem: String(redOrigem),
    ufOrigem: ufO,
    ufDestino: ufD,
    ncm: (ncmEl && ncmEl.value) || ""
  });

  const btnShare = document.getElementById("btnShare");
  if (btnShare) {
    btnShare.href =
      location.origin + location.pathname + "?" + params.toString();
  }
}

// Restaura parâmetros da URL (se houver)
function restoreFromURL() {
  const q = new URLSearchParams(location.search);
  if (![...q.keys()].length) return;

  const valor = Number(q.get("valor") || 0);
  const valorEl = document.getElementById("valor");
  if (valorEl && valor) {
    valorEl.value = valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  const fcpEl = document.getElementById("fcp");
  if (fcpEl && q.has("fcp")) {
    fcpEl.value = ((Number(q.get("fcp")) || 0) * 100).toFixed(2);
  }

  const redDestinoEl = document.getElementById("redDestino");
  if (redDestinoEl && q.has("redDestino")) {
    redDestinoEl.value = ((Number(q.get("redDestino")) || 0) * 100).toFixed(2);
  }

  const redOrigemEl = document.getElementById("redOrigem");
  if (redOrigemEl && q.has("redOrigem")) {
    redOrigemEl.value = ((Number(q.get("redOrigem")) || 0) * 100).toFixed(2);
  }

  const ufOrigemEl = document.getElementById("ufOrigem");
  const ufDestinoEl = document.getElementById("ufDestino");
  if (ufOrigemEl && q.has("ufOrigem")) {
    ufOrigemEl.value = q.get("ufOrigem") || "";
  }
  if (ufDestinoEl && q.has("ufDestino")) {
    ufDestinoEl.value = q.get("ufDestino") || "";
  }

  const ncmEl = document.getElementById("ncm");
  if (ncmEl && q.has("ncm")) {
    ncmEl.value = q.get("ncm") || "";
  }

  atualizarDescricaoNcm();
}

// Boot
document.addEventListener("DOMContentLoaded", () => {
  const valorEl = document.getElementById("valor");
  if (valorEl) {
    valorEl.addEventListener("input", e => maskMoney(e.target));
  }

  const form = document.getElementById("form");
  if (form) {
    form.addEventListener("submit", calcular);
    form.addEventListener("reset", () => {
      const cards = document.getElementById("cards");
      const detalhe = document.getElementById("detalhe");
      if (cards) cards.classList.add("hidden");
      if (detalhe) detalhe.classList.add("hidden");
    });
  }

  const ncmInput = document.getElementById("ncm");
  if (ncmInput) {
    ncmInput.addEventListener("blur", atualizarDescricaoNcm);
    ncmInput.addEventListener("change", atualizarDescricaoNcm);
  }

  fillUFs();
  carregarTabelas();
  restoreFromURL();
});
