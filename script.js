// CONFIGURAÇÃO DO FIREBASE COM AS SUAS CREDENCIAIS REAIS
const firebaseConfig = {
  apiKey: "AIzaSyAoyYqQ0CRJKFPB7GjbEC0Bp_TrY7zWxs0",
  authDomain: "minhas-finan-7e212.firebaseapp.com",
  projectId: "minhas-finan-7e212",
  storageBucket: "minhas-finan-7e212.firebasestorage.app",
  messagingSenderId: "134299617081",
  appId: "1:134299617081:web:1024238d910eac2f9ecae8",
  measurementId: "G-YER58ZQ7M0"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ESTADO DA APLICAÇÃO
let lancamentos = [];
let contasFixas = [];
let separados = [];
let categorias = ["Alimentação", "Transporte", "Moradia", "Lazer", "Outros"];

// CARREGAR DADOS DO FIREBASE
function carregarDados() {
  db.collection("financeiro").doc("dados").onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      lancamentos = data.lancamentos || [];
      contasFixas = data.contasFixas || [];
      separados = data.separados || [];
      if (data.categorias && data.categorias.length > 0) {
        categorias = data.categorias;
      }
    }
    atualizarInterface();
  });
}

function salvarDados() {
  db.collection("financeiro").doc("dados").set({
    lancamentos,
    contasFixas,
    separados,
    categorias
  });
}

// NAVEGAÇÃO DE ABAS
function mudarAba(idAba, elementoBtn) {
  document.querySelectorAll('.conteudo-aba').forEach(aba => aba.classList.remove('ativa'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('ativo'));
  
  document.getElementById(idAba).classList.add('ativa');
  if (elementoBtn) elementoBtn.classList.add('ativo');
}

// ATUALIZAÇÃO GERAL DA INTERFACE
function atualizarInterface() {
  renderizarCategoriasSelect();
  renderizarResumo();
  renderizarContasFixas();
  renderizarSeparados();
  renderizarExtrato();
}

function renderizarCategoriasSelect() {
  const select = document.getElementById("categoria");
  select.innerHTML = "";
  categorias.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

// RENDERIZAR RESUMO
function renderizarResumo() {
  let entradas = 0;
  let saidas = 0;
  let futuros = 0;
  let totalSeparados = 0;
  const gastosPorCat = {};

  lancamentos.forEach(l => {
    const val = parseFloat(l.valor) || 0;
    if (l.tipo === "entrada") {
      entradas += val;
    } else if (l.tipo === "saida") {
      saidas += val;
      gastosPorCat[l.categoria] = (gastosPorCat[l.categoria] || 0) + val;
    } else if (l.tipo === "futuro") {
      futuros += val;
    }
  });

  separados.forEach(s => {
    totalSeparados += (parseFloat(s.valor) || 0);
  });

  const saldoReal = entradas - saidas;
  const disponivelGastar = saldoReal + futuros - totalSeparados;

  document.getElementById("saldo-real-conta").textContent = formatarMoeda(saldoReal);
  document.getElementById("saldo-para-gastar").textContent = formatarMoeda(disponivelGastar);
  document.getElementById("total-entradas").textContent = formatarMoeda(entradas);
  document.getElementById("total-saidas").textContent = formatarMoeda(saidas);
  document.getElementById("total-futuros").textContent = "+ " + formatarMoeda(futuros);
  document.getElementById("total-separados").textContent = "- " + formatarMoeda(totalSeparados);

  // Lista de Categorias no Resumo
  const divCats = document.getElementById("lista-categorias");
  divCats.innerHTML = "";
  if (Object.keys(gastosPorCat).length === 0) {
    divCats.innerHTML = "<small style='color: #94a3b8;'>Nenhum gasto cadastrado ainda.</small>";
  } else {
    for (const [cat, val] of Object.entries(gastosPorCat)) {
      divCats.innerHTML += `
        <div class="item-cat">
          <span>${cat}</span>
          <strong class="txt-vermelho">${formatarMoeda(val)}</strong>
        </div>
      `;
    }
  }
}

// RENDERIZAR CONTAS FIXAS
function renderizarContasFixas() {
  let totalFixas = 0;
  let pagoFixas = 0;

  const divLista = document.getElementById("lista-contas-fixas");
  divLista.innerHTML = "";

  if (contasFixas.length === 0) {
    divLista.innerHTML = "<small style='color: #94a3b8;'>Nenhuma conta fixa cadastrada.</small>";
  }

  // Ordenar contas por dia de vencimento
  contasFixas.sort((a, b) => (parseInt(a.vencimento) || 0) - (parseInt(b.vencimento) || 0));

  contasFixas.forEach((cf, idx) => {
    const val = parseFloat(cf.valor) || 0;
    totalFixas += val;
    if (cf.paga) pagoFixas += val;

    const vencTexto = cf.vencimento ? ` • Vence dia ${cf.vencimento}` : "";

    divLista.innerHTML += `
      <div class="item" style="${cf.paga ? 'opacity: 0.6;' : ''}">
        <div>
          <input type="checkbox" ${cf.paga ? 'checked' : ''} onchange="togglePagoFixa(${idx})" style="width: auto; margin-right: 8px;">
          <strong style="${cf.paga ? 'text-decoration: line-through;' : ''}">${cf.nome}</strong>
          <small style="display: block; color: #64748b;">${formatarMoeda(val)}${vencTexto}</small>
        </div>
        <button onclick="removerContaFixa(${idx})" class="btn-excluir">🗑️</button>
      </div>
    `;
  });

  const restanteFixas = totalFixas - pagoFixas;
  document.getElementById("total-contas-fixas").textContent = formatarMoeda(totalFixas);
  document.getElementById("pago-contas-fixas").textContent = formatarMoeda(pagoFixas);
  document.getElementById("restante-contas-fixas").textContent = formatarMoeda(restanteFixas);
}

function togglePagoFixa(idx) {
  contasFixas[idx].paga = !contasFixas[idx].paga;
  salvarDados();
}

function removerContaFixa(idx) {
  if (confirm("Deseja remover esta conta fixa?")) {
    contasFixas.splice(idx, 1);
    salvarDados();
  }
}

// RENDERIZAR SEPARADOS
function renderizarSeparados() {
  const divLista = document.getElementById("lista-separados");
  divLista.innerHTML = "";

  if (separados.length === 0) {
    divLista.innerHTML = "<small style='color: #94a3b8;'>Nenhum valor reservado.</small>";
  }

  separados.forEach((s, idx) => {
    divLista.innerHTML += `
      <div class="item">
        <div>
          <strong>${s.desc}</strong>
          <small style="display: block; color: #0284c7;">${formatarMoeda(s.valor)}</small>
        </div>
        <button onclick="removerSeparado(${idx})" class="btn-excluir">🗑️</button>
      </div>
    `;
  });
}

function removerSeparado(idx) {
  if (confirm("Deseja remover este valor separado?")) {
    separados.splice(idx, 1);
    salvarDados();
  }
}

// RENDERIZAR EXTRATO DE LANÇAMENTOS
function renderizarExtrato() {
  const divLista = document.getElementById("lista-lancamentos");
  divLista.innerHTML = "";

  if (lancamentos.length === 0) {
    divLista.innerHTML = "<small style='color: #94a3b8;'>Nenhum lançamento registrado.</small>";
    return;
  }

  // Ordenar por data (mais recentes primeiro)
  const copia = [...lancamentos].sort((a, b) => new Date(b.data) - new Date(a.data));

  copia.forEach(l => {
    const corClasse = l.tipo === "entrada" ? "txt-verde" : l.tipo === "saida" ? "txt-vermelho" : "txt-azul";
    const sinal = l.tipo === "entrada" ? "+" : l.tipo === "saida" ? "-" : "⏳";

    divLista.innerHTML += `
      <div class="item">
        <div>
          <strong>${l.desc || l.categoria}</strong>
          <small style="display: block; color: #64748b;">${formatarData(l.data)} • ${l.categoria}</small>
        </div>
        <div class="item-acoes">
          <strong class="${corClasse}">${sinal} ${formatarMoeda(l.valor)}</strong>
          <button onclick="prepararEdicao('${l.id}')" class="btn-editar">✏️</button>
          <button onclick="removerLancamento('${l.id}')" class="btn-excluir">🗑️</button>
        </div>
      </div>
    `;
  });
}

// MANIPULAÇÃO DE FORMULÁRIOS
document.getElementById("form-lancamento").addEventListener("submit", (e) => {
  e.preventDefault();
  const editId = document.getElementById("edit-id").value;
  const desc = document.getElementById("desc").value;
  const valor = parseFloat(document.getElementById("valor").value);
  const data = document.getElementById("data").value;
  const tipo = document.getElementById("tipo").value;
  const categoria = document.getElementById("categoria").value;

  if (editId) {
    const idx = lancamentos.findIndex(l => l.id === editId);
    if (idx !== -1) {
      lancamentos[idx] = { id: editId, desc, valor, data, tipo, categoria };
    }
  } else {
    const novo = {
      id: Date.now().toString(),
      desc,
      valor,
      data,
      tipo,
      categoria
    };
    lancamentos.push(novo);
  }

  cancelarEdicao();
  salvarDados();
});

function prepararEdicao(id) {
  const item = lancamentos.find(l => l.id === id);
  if (!item) return;

  document.getElementById("edit-id").value = item.id;
  document.getElementById("desc").value = item.desc || "";
  document.getElementById("valor").value = item.valor;
  document.getElementById("data").value = item.data;
  document.getElementById("tipo").value = item.tipo;
  document.getElementById("categoria").value = item.categoria;

  document.getElementById("titulo-form-lancamento").textContent = "✏️ Editar Lançamento";
  document.getElementById("btn-submit-lancamento").textContent = "Salvar Alterações";
  document.getElementById("btn-cancelar-edicao").style.display = "block";

  mudarAba("aba-novo", document.getElementById("btn-nav-novo"));
}

function cancelarEdicao() {
  document.getElementById("edit-id").value = "";
  document.getElementById("form-lancamento").reset();
  document.getElementById("data").valueAsDate = new Date();
  document.getElementById("titulo-form-lancamento").textContent = "🛒 Registrar Lançamento";
  document.getElementById("btn-submit-lancamento").textContent = "Adicionar Lançamento";
  document.getElementById("btn-cancelar-edicao").style.display = "none";
}

function removerLancamento(id) {
  if (confirm("Deseja apagar este lançamento?")) {
    lancamentos = lancamentos.filter(l => l.id !== id);
    salvarDados();
  }
}

// ADICIONAR CONTA FIXA
document.getElementById("form-conta-fixa").addEventListener("submit", (e) => {
  e.preventDefault();
  const nome = document.getElementById("fixa-nome").value;
  const valor = parseFloat(document.getElementById("fixa-valor").value);
  const vencimento = document.getElementById("fixa-vencimento").value;

  contasFixas.push({ nome, valor, vencimento, paga: false });
  document.getElementById("form-conta-fixa").reset();
  salvarDados();
});

// ADICIONAR SEPARADO
document.getElementById("form-separado").addEventListener("submit", (e) => {
  e.preventDefault();
  const desc = document.getElementById("sep-desc").value;
  const valor = parseFloat(document.getElementById("sep-valor").value);

  separados.push({ desc, valor });
  document.getElementById("form-separado").reset();
  salvarDados();
});

// CATEGORIAS
document.getElementById("form-nova-categoria").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("nova-cat-nome");
  const nomeCat = input.value.trim();

  if (nomeCat && !categorias.includes(nomeCat)) {
    categorias.push(nomeCat);
    input.value = "";
    salvarDados();
  }
});

function removerCategoriaSelecionada() {
  const sel = document.getElementById("categoria");
  const cat = sel.value;
  if (!cat) return;

  if (confirm(`Deseja apagar a categoria "${cat}"?`)) {
    categorias = categorias.filter(c => c !== cat);
    salvarDados();
  }
}

// UTILITÁRIOS DE FORMATAÇÃO
function formatarMoeda(val) {
  return (parseFloat(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataISO) {
  if (!dataISO) return "";
  const partes = dataISO.split("-");
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataISO;
}

// INICIALIZAÇÃO
window.onload = () => {
  document.getElementById("data").valueAsDate = new Date();
  carregarDados();
};