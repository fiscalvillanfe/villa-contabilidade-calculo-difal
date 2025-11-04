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

const fmtPercent = v =>
  ((isNaN(v) ? 0 : v) * 100).toFixed(2).replace(".", ",") + "%";

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

// Lê campo de porcentagem em % e devolve decimal (18 → 0.18)
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
let MVA_LIST = []; // { key, digits, mva }

// Normaliza NCM pra só dígitos
function normalizarNcm(str) {
  if (!str) return "";
  return String(str).replace(/\D/g, "");
}

// Carrega os 4 JSONs
async function carregarTabelas() {
  try {
    const [intRes, interRes, ncmRes, mvaRes] = await Promise.all([
      fetch("Aliquota_interna.json"),
      fetch("Tabela_Aliquota_interestadual.json"),
      fetch("Tabela_NCM_Vigente_20251104.json"),
      fetch("Tabela_MVA.json")
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
    if (mvaRes.ok) {
      const mvaData = await mvaRes.json();
      MVA_LIST = Object.entries(mvaData)
        .map(([k, v]) => {
          const digits = normalizarNcm(k);
          const mva = Number(v);
          if (!digits || isNaN(mva)) return null;
          return { key: k, digits, mva };
        })
        .filter(Boolean)
        // ordena por especificidade (mais dígitos primeiro)
        .sort((a, b) => b.digits.length - a.digits.length);
    }
  } catch (e) {
    console.error("Erro ao carregar JSONs:", e);
  } finally {
    atualizarCamposAliquotas();
    atualizarDescricaoNcm();
  }
}

// Procura MVA mais específico pra um NCM (prefix match)
function findMvaForNcm(ncmDigits) {
  if (!ncmDigits || !MVA_LIST.length) return null;
  for (const item of MVA_LIST) {
    if (ncmDigits.startsWith(item.digits)) {
      return item; // primeiro já é o mais específico, porque lista está ordenada
    }
  }
  return null;
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

// Usa JSON pra preencher alíquota interna e interestadual
function atualizarCamposAliquotas() {
  const ufOrigemEl = document.getElementById("ufOrigem");
  const ufDestinoEl = document.getElementById("ufDestino");
  const aliqIntEl = document.getElementById("aliqInt");
  const aliqInterEl = document.getElementById("aliqInter");

  if (!ufOrigemEl || !ufDestinoEl) return;

  const ufO = ufOrigemEl.value;
  const ufD = ufDestinoEl.value;

  // Alíquota interna automática (em %)
  if (ufD && Object.prototype.hasOwnProperty.call(ALIQUOTA_INTERNA, ufD) && aliqIntEl) {
    const aliqInt = ALIQUOTA_INTERNA[ufD]; // ex: 18, 17.5...
    aliqIntEl.value = String(aliqInt).replace(".", ",");
  }

  // Alíquota interestadual automática (em %)
  if (
    ufO &&
    ufD &&
    ALIQUOTA_INTERESTADUAL[ufO] &&
    ALIQUOTA_INTERESTADUAL[ufO][ufD] != null &&
    aliqInterEl
  ) {
    const aliq = ALIQUOTA_INTERESTADUAL[ufO][ufD]; // ex: 7, 12...
    aliqInterEl.value = String(aliq).replace(".", ",");
  }

  // Se não achar nada, deixo em branco
}

// Atualiza descrição do NCM e MVA automático
function atualizarDescricaoNcm() {
  const ncmInput = document.getElementById("ncm");
  const descEl = document.getElementById("ncmDescricao");
  const mvaEl = document.getElementById("mva");
  const usarMvaEl = document.getElementById("usarMva");

  if (!ncmInput || !descEl) return;

  const keyDigits = normalizarNcm(ncmInput.value);

  if (!keyDigits) {
    descEl.textContent = "Digite o NCM para buscar";
    if (mvaEl) {
      mvaEl.value = "";
      mvaEl.title = "";
    }
    if (usarMvaEl) usarMvaEl.checked = false;
    return;
  }

  if (!Object.keys(NCM_MAP).length) {
    descEl.textContent = "Tabela de NCM ainda não carregada.";
    return;
  }

  const item = NCM_MAP[keyDigits];
  if (!item) {
    descEl.textContent = "NCM não encontrado na tabela vigente.";
    if (mvaEl) {
      mvaEl.value = "";
      mvaEl.title = "NCM não encontrado na tabela de NCM.";
    }
    if (usarMvaEl) usarMvaEl.checked = false;
    return;
  }

  descEl.textContent = `${item.Codigo} - ${item.Descricao}`;

  // MVA automático pela tabela
  if (mvaEl && usarMvaEl) {
    const mvaInfo = findMvaForNcm(keyDigits);
    if (mvaInfo) {
      mvaEl.value = String(mvaInfo.mva).replace(".", ",");
      usarMvaEl.checked = true;
      mvaEl.readOnly = true;
      mvaEl.title = `MVA automático (${mvaInfo.key})`;
    } else {
      mvaEl.value = "0";
      usarMvaEl.checked = false;
      mvaEl.readOnly = true;
      mvaEl.title = "NCM sem MVA cadastrado na tabela.";
    }
  }
}

// Cálculo principal
function calcular(e) {
  e.preventDefault();

  const valorEl = document.getElementById("valor");
  const aliqIntEl = document.getElementById("aliqInt");
  const aliqInterEl = document.getElementById("aliqInter");
  const fcpEl = document.getElementById("fcp");
  const redDestinoEl = document.getElementById("redDestino");
  const mvaEl = document.getElementById("mva");
  const usarMvaEl = document.getElementById("usarMva");
  const ufOrigemEl = document.getElementById("ufOrigem");
  const ufDestinoEl = document.getElementById("ufDestino");
  const ncmEl = document.getElementById("ncm");

  const valor = getNumberFromBRL(valorEl && valorEl.value);
  const aliqInt = parsePercentField(aliqIntEl);     // decimal
  const aliqInter = parsePercentField(aliqInterEl); // decimal
  const fcpPct = parsePercentField(fcpEl);          // decimal
  const redDestino = parsePercentField(redDestinoEl); // decimal
  const mvaPct = parsePercentField(mvaEl);          // decimal
  const usarMva = usarMvaEl && usarMvaEl.checked;

  if (!ufOrigemEl.value || !ufDestinoEl.value) {
    alert("Selecione UF de origem e destino.");
    return;
  }

  if (!valor) {
    alert("Informe o valor da operação.");
    if (valorEl) valorEl.focus();
    return;
  }

  if (!aliqInt && !aliqInter) {
    alert("Não foi possível determinar as alíquotas. Verifique os JSON de alíquotas.");
    return;
  }

  // Base com ou sem MVA
  let base = valor;
  if (usarMva && mvaPct > 0) {
    base = base * (1 + mvaPct);
  }

  const baseDestino = base * (1 - redDestino);

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

  // Cards
  const outBase = document.getElementById("outBase");
  const outAliqInt = document.getElementById("outAliqInt");
  const outAliqInter = document.getElementById("outAliqInter");
  const outDifal = document.getElementById("outDifal");
  const outFcp = document.getElementById("outFcp");

  if (outBase) outBase.textContent = fmtMoney(baseDestino);
  if (outAliqInt) outAliqInt.textContent = fmtPercent(aliqInt);
  if (outAliqInter) outAliqInter.textContent = fmtPercent(aliqInter);
  if (outDifal) outDifal.textContent = fmtMoney(difal);
  if (outFcp) outFcp.textContent = fmtMoney(fcpValor);

  // Tabela
  const rowBase = document.getElementById("rowBase");
  const rowPct = document.getElementById("rowPct");
  const rowDifal = document.getElementById("rowDifal");
  const rowFcp = document.getElementById("rowFcp");

  if (rowBase) rowBase.textContent = fmtMoney(baseDestino);
  if (rowPct) rowPct.textContent = ((difPct || 0) * 100).toFixed(2) + "%";
  if (rowDifal) rowDifal.textContent = fmtMoney(difal);
  if (rowFcp) rowFcp.textContent = fmtMoney(fcpValor);

  // Resumo para copiar
  const resumo = [
    `UF Origem: ${ufOrigemEl.value}`,
    `UF Destino: ${ufDestinoEl.value}`,
    `NCM: ${(ncmEl && ncmEl.value) || ""}`,
    `Base no destino: ${fmtMoney(baseDestino)}`,
    `MVA aplicado: ${(mvaPct * 100).toFixed(2).replace(".", ",")}%`,
    `Alíquota interna: ${(aliqInt * 100).toFixed(2).replace(".", ",")}%`,
    `Alíquota interestadual: ${(aliqInter * 100).toFixed(2).replace(".", ",")}%`,
    `Diferença por dentro: ${(difPct * 100).toFixed(2).replace(".", ",")}%`,
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

  // Link de compartilhamento (guarda sempre em decimal)
  const params = new URLSearchParams({
    valor: String(valor),
    aliqInt: String(aliqInt),
    aliqInter: String(aliqInter),
    fcp: String(fcpPct),
    redDestino: String(redDestino),
    ufOrigem: ufOrigemEl && ufOrigemEl.value || "",
    ufDestino: ufDestinoEl && ufDestinoEl.value || "",
    ncm: ncmEl && ncmEl.value || "",
    mva: String(mvaPct),
    usarMva: usarMva ? "1" : "0"
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

  const aliqIntEl = document.getElementById("aliqInt");
  if (aliqIntEl && q.has("aliqInt")) {
    aliqIntEl.value = ((Number(q.get("aliqInt")) || 0) * 100).toFixed(2);
  }

  const aliqInterEl = document.getElementById("aliqInter");
  if (aliqInterEl && q.has("aliqInter")) {
    aliqInterEl.value = ((Number(q.get("aliqInter")) || 0) * 100).toFixed(2);
  }

  const fcpEl = document.getElementById("fcp");
  if (fcpEl && q.has("fcp")) {
    fcpEl.value = ((Number(q.get("fcp")) || 0) * 100).toFixed(2);
  }

  const redDestinoEl = document.getElementById("redDestino");
  if (redDestinoEl && q.has("redDestino")) {
    redDestinoEl.value = ((Number(q.get("redDestino")) || 0) * 100).toFixed(2);
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

  const mvaEl = document.getElementById("mva");
  if (mvaEl && q.has("mva")) {
    mvaEl.value = ((Number(q.get("mva")) || 0) * 100).toFixed(2);
  }

  const usarMvaEl = document.getElementById("usarMva");
  if (usarMvaEl && q.has("usarMva")) {
    usarMvaEl.checked = q.get("usarMva") === "1";
  }

  atualizarDescricaoNcm();
  atualizarCamposAliquotas();
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

      const mvaEl = document.getElementById("mva");
      const usarMvaEl = document.getElementById("usarMva");
      if (mvaEl) mvaEl.value = "";
      if (usarMvaEl) usarMvaEl.checked = false;
    });
  }

  const ufOrigemEl = document.getElementById("ufOrigem");
  const ufDestinoEl = document.getElementById("ufDestino");
  if (ufOrigemEl) ufOrigemEl.addEventListener("change", atualizarCamposAliquotas);
  if (ufDestinoEl) ufDestinoEl.addEventListener("change", atualizarCamposAliquotas);

  const ncmInput = document.getElementById("ncm");
  if (ncmInput) {
    ncmInput.addEventListener("blur", atualizarDescricaoNcm);
    ncmInput.addEventListener("change", atualizarDescricaoNcm);
  }

  fillUFs();
  carregarTabelas();
  restoreFromURL();
});
