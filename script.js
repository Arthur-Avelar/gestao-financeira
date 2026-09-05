import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  projectId: "minhas-finan-7e212"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Estado dos Dados
let lancamentos = [];
let contasFixas = [];
let valoresSeparados = [];
let categorias = [];
let entradasFuturas = [];

// Formatação BRL (Exemplo: R$ 1.000,00)
const formatarMoeda = (valor) => {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// --- NAVEGAÇÃO DE ABAS ---
function trocarAba(abaId, btn) {
  document.querySelectorAll('.aba-conteudo').forEach(aba => aba.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`aba-${abaId}`).classList.add('active');
  btn.classList.add('active');
}

document.getElementById('btn-resumo').addEventListener('click', (e) => trocarAba('resumo', e.target));
document.getElementById('btn-extrato').addEventListener('click', (e) => trocarAba('extrato', e.target));
document.getElementById('btn-novo').addEventListener('click', (e) => trocarAba('novo', e.target));
document.getElementById('btn-fixas').addEventListener('click', (e) => trocarAba('fixas', e.target));
document.getElementById('btn-futuros').addEventListener('click', (e) => trocarAba('futuros', e.target));
document.getElementById('btn-separados').addEventListener('click', (e) => trocarAba('separados', e.target));
document.getElementById('btn-calculadora').addEventListener('click', (e) => trocarAba('calculadora', e.target));

// --- LISTENERS FIRESTORE (Tempo Real) ---
onSnapshot(collection(db, "lancamentos"), (snapshot) => {
  lancamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  atualizarResumo();
  renderizarExtrato();
});

onSnapshot(collection(db, "contasFixas"), (snapshot) => {
  contasFixas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  atualizarResumo();
  renderizarFixas();
});

onSnapshot(collection(db, "valoresSeparados"), (snapshot) => {
  valoresSeparados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  atualizarResumo();
  renderizarSeparados();
});

onSnapshot(collection(db, "categorias"), (snapshot) => {
  categorias = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderizarDropdownCategorias();
  renderizarGerenciadorCategorias();
  atualizarResumo();
});

onSnapshot(collection(db, "entradasFuturas"), (snapshot) => {
  entradasFuturas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderizarFuturos();
  atualizarResumo();
});

// --- RESUMO & QUANTO POSSO GASTAR ---
function atualizarResumo() {
  const entradas = lancamentos.filter(l => l.tipo === "receita").reduce((acc, l) => acc + (parseFloat(l.valor) || 0), 0);
  const saidas = lancamentos.filter(l => l.tipo === "despesa").reduce((acc, l) => acc + (parseFloat(l.valor) || 0), 0);
  const separado = valoresSeparados.reduce((acc, s) => acc + (parseFloat(s.valor) || 0), 0);
  
  const fixasPendentes = contasFixas.filter(f => !f.paga).reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0);
  const totalFuturos = entradasFuturas.reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0);

  // 1. Saldo Atual: Apenas Entradas - Saídas (NÃO desconta o separado)
  const saldo = entradas - saidas;

  // 2. Quanto Posso Gastar: (Saldo Real + Futuros) - Separado - Fixas Pendentes
  const quantoPossoGastar = (saldo + totalFuturos) - separado - fixasPendentes;

  // Atualização dos elementos na tela
  document.getElementById("quanto-posso-gastar").innerText = formatarMoeda(quantoPossoGastar);
  document.getElementById("saldo-total").innerText = formatarMoeda(saldo);
  document.getElementById("total-futuros-card").innerText = formatarMoeda(totalFuturos);
  document.getElementById("total-entradas").innerText = formatarMoeda(entradas);
  document.getElementById("total-saidas").innerText = formatarMoeda(saidas);
  document.getElementById("total-separado").innerText = formatarMoeda(separado);

  renderizarResumoCategorias();
}

function renderizarResumoCategorias() {
  const container = document.getElementById("lista-categorias-resumo");
  container.innerHTML = "";

  const gastosPorCat = {};

  lancamentos.filter(l => l.tipo === "despesa").forEach(item => {
    gastosPorCat[item.categoria] = (gastosPorCat[item.categoria] || 0) + (parseFloat(item.valor) || 0);
  });

  const chaves = Object.keys(gastosPorCat);
  if (chaves.length === 0) {
    container.innerHTML = "<small>Nenhuma despesa registrada.</small>";
    return;
  }

  chaves.forEach(cat => {
    const div = document.createElement("div");
    div.className = "item-lista";
    div.innerHTML = `
      <span><strong>${cat}</strong></span>
      <span>${formatarMoeda(gastosPorCat[cat])}</span>
    `;
    container.appendChild(div);
  });
}

// --- CATEGORIAS ---
function renderizarDropdownCategorias() {
  const select = document.getElementById("categoria-select");
  select.innerHTML = "";

  if (categorias.length === 0) {
    select.innerHTML = `<option value="Geral">Geral</option>`;
    return;
  }

  categorias.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.nome;
    opt.innerText = c.nome;
    select.appendChild(opt);
  });
}

document.getElementById("form-categoria").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("categoria-nome").value.trim();
  if (nome) {
    await addDoc(collection(db, "categorias"), { nome });
    document.getElementById("form-categoria").reset();
  }
});

function renderizarGerenciadorCategorias() {
  const container = document.getElementById("lista-categorias-gerenciador");
  container.innerHTML = "";

  categorias.forEach(item => {
    const div = document.createElement("div");
    div.className = "item-lista";
    div.innerHTML = `
      <span>${item.nome}</span>
      <button class="btn-excluir">❌</button>
    `;
    div.querySelector(".btn-excluir").onclick = () => deleteDoc(doc(db, "categorias", item.id));
    container.appendChild(div);
  });
}

// --- EXTRATO ---
function renderizarExtrato() {
  const container = document.getElementById("lista-extrato");
  container.innerHTML = "";

  const ordenados = [...lancamentos].sort((a,b) => new Date(b.data) - new Date(a.data));

  ordenados.forEach(item => {
    const div = document.createElement("div");
    div.className = `item-lista ${item.tipo}`;
    
    const info = document.createElement("div");
    info.innerHTML = `<strong>${item.desc}</strong> (${item.categoria})<br><small>${item.data}</small>`;

    const acoes = document.createElement("div");
    acoes.innerHTML = `<strong>${item.tipo === 'receita' ? '+' : '-'} ${formatarMoeda(item.valor)}</strong>`;

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn-editar";
    btnEdit.innerText = "✏️";
    btnEdit.onclick = () => prepararEdicaoLancamento(item);

    const btnDel = document.createElement("button");
    btnDel.className = "btn-excluir";
    btnDel.innerText = "❌";
    btnDel.onclick = () => deleteDoc(doc(db, "lancamentos", item.id));

    acoes.appendChild(btnEdit);
    acoes.appendChild(btnDel);
    div.appendChild(info);
    div.appendChild(acoes);
    container.appendChild(div);
  });
}

function prepararEdicaoLancamento(item) {
  document.getElementById("edit-lancamento-id").value = item.id;
  document.getElementById("desc").value = item.desc === "Sem descrição" ? "" : item.desc;
  document.getElementById("valor").value = item.valor;
  document.getElementById("tipo").value = item.tipo;
  document.getElementById("categoria-select").value = item.categoria;
  document.getElementById("data").value = item.data;

  document.getElementById("titulo-form-lancamento").innerText = "Editar Lançamento";
  document.getElementById("btn-salvar-lancamento").innerText = "Atualizar Lançamento";
  document.getElementById("btn-cancelar-edicao").style.display = "inline-block";

  trocarAba('novo', document.getElementById('btn-novo'));
}

document.getElementById("btn-cancelar-edicao").addEventListener("click", resetarFormLancamento);

function resetarFormLancamento() {
  document.getElementById("edit-lancamento-id").value = "";
  document.getElementById("form-lancamento").reset();
  document.getElementById("titulo-form-lancamento").innerText = "Novo Lançamento";
  document.getElementById("btn-salvar-lancamento").innerText = "Salvar Lançamento";
  document.getElementById("btn-cancelar-edicao").style.display = "none";
}

document.getElementById("form-lancamento").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("edit-lancamento-id").value;
  
  // Descrição Opcional
  const descInput = document.getElementById("desc").value.trim();
  const desc = descInput !== "" ? descInput : "Sem descrição";

  const valor = parseFloat(document.getElementById("valor").value);
  const tipo = document.getElementById("tipo").value;
  const categoria = document.getElementById("categoria-select").value;
  const data = document.getElementById("data").value;

  if (id) {
    await updateDoc(doc(db, "lancamentos", id), { desc, valor, tipo, categoria, data });
  } else {
    await addDoc(collection(db, "lancamentos"), { desc, valor, tipo, categoria, data });
  }

  resetarFormLancamento();
  trocarAba('extrato', document.getElementById('btn-extrato'));
});

// --- ENTRADAS FUTURAS ---
document.getElementById("form-futuro").addEventListener("submit", async (e) => {
  e.preventDefault();
  const desc = document.getElementById("futuro-desc").value;
  const valor = parseFloat(document.getElementById("futuro-valor").value);
  const data = document.getElementById("futuro-data").value;

  await addDoc(collection(db, "entradasFuturas"), { desc, valor, data });
  document.getElementById("form-futuro").reset();
});

function renderizarFuturos() {
  const container = document.getElementById("lista-futuros");
  container.innerHTML = "";

  const ordenados = [...entradasFuturas].sort((a,b) => new Date(a.data) - new Date(b.data));

  ordenados.forEach(item => {
    const div = document.createElement("div");
    div.className = "item-lista receita";

    const info = document.createElement("div");
    info.innerHTML = `<strong>${item.desc}</strong><br><small>Previsto: ${item.data}</small><br><span>${formatarMoeda(item.valor)}</span>`;

    const acoes = document.createElement("div");

    const btnReceber = document.createElement("button");
    btnReceber.className = "btn-primary";
    btnReceber.innerText = "✅ Receber";
    btnReceber.onclick = async () => {
      await addDoc(collection(db, "lancamentos"), {
        desc: `[Depósito] ${item.desc}`,
        valor: parseFloat(item.valor),
        tipo: "receita",
        categoria: "Receita",
        data: item.data
      });
      await deleteDoc(doc(db, "entradasFuturas", item.id));
    };

    const btnDel = document.createElement("button");
    btnDel.className = "btn-excluir";
    btnDel.innerText = "❌";
    btnDel.onclick = () => deleteDoc(doc(db, "entradasFuturas", item.id));

    acoes.appendChild(btnReceber);
    acoes.appendChild(btnDel);
    div.appendChild(info);
    div.appendChild(acoes);
    container.appendChild(div);
  });
}

// --- CONTAS FIXAS ---
document.getElementById("form-fixa").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("fixa-nome").value;
  const valor = parseFloat(document.getElementById("fixa-valor").value);
  const vencimento = parseInt(document.getElementById("fixa-vencimento").value);

  await addDoc(collection(db, "contasFixas"), { nome, valor, vencimento, paga: false });
  document.getElementById("form-fixa").reset();
});

function renderizarFixas() {
  const container = document.getElementById("lista-fixas");
  container.innerHTML = "";

  // Cálculo do total e quantidades
  const totalValor = contasFixas.reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0);
  const qtdTotal = contasFixas.length;
  const qtdPendentes = contasFixas.filter(f => !f.paga).length;

  // Atualiza os indicadores no topo da aba Fixas
  const elemValor = document.getElementById("total-fixas-valor");
  const elemQtd = document.getElementById("total-fixas-qtd");
  if (elemValor) elemValor.innerText = formatarMoeda(totalValor);
  if (elemQtd) elemQtd.innerText = `${qtdTotal} ${qtdTotal === 1 ? 'conta' : 'contas'} (${qtdPendentes} ${qtdPendentes === 1 ? 'pendente' : 'pendentes'})`;

  contasFixas.sort((a,b) => a.vencimento - b.vencimento).forEach(item => {
    const div = document.createElement("div");
    div.className = `item-lista ${item.paga ? 'item-pago' : ''}`;

    const info = document.createElement("div");
    info.innerHTML = `<strong>${item.nome}</strong> - Vence dia ${item.vencimento}<br><span>${formatarMoeda(item.valor)}</span>`;

    const acoes = document.createElement("div");

    const btnPagar = document.createElement("button");
    btnPagar.className = "btn-primary";
    btnPagar.innerText = item.paga ? 'Desmarcar' : 'Pagar';
    btnPagar.onclick = async () => {
      const novoStatus = !item.paga;
      await updateDoc(doc(db, "contasFixas", item.id), { paga: novoStatus });

      if (novoStatus) {
        const hoje = new Date().toISOString().split('T')[0];
        await addDoc(collection(db, "lancamentos"), {
          desc: `[Conta Fixa] ${item.nome}`,
          valor: parseFloat(item.valor),
          tipo: "despesa",
          categoria: "Contas Fixas",
          data: hoje
        });
      }
    };

    const btnDel = document.createElement("button");
    btnDel.className = "btn-excluir";
    btnDel.innerText = "❌";
    btnDel.onclick = () => deleteDoc(doc(db, "contasFixas", item.id));

    acoes.appendChild(btnPagar);
    acoes.appendChild(btnDel);
    div.appendChild(info);
    div.appendChild(acoes);
    container.appendChild(div);
  });
}

// --- VALORES SEPARADOS ---
document.getElementById("form-separado").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("separado-nome").value;
  const valor = parseFloat(document.getElementById("separado-valor").value);

  await addDoc(collection(db, "valoresSeparados"), { nome, valor });
  document.getElementById("form-separado").reset();
});

function renderizarSeparados() {
  const container = document.getElementById("lista-separados");
  container.innerHTML = "";

  valoresSeparados.forEach(item => {
    const divItem = document.createElement("div");
    divItem.className = "item-lista";

    const info = document.createElement("div");
    info.innerHTML = `<strong>${item.nome}</strong><br><span>${formatarMoeda(item.valor)}</span>`;

    const acoes = document.createElement("div");

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn-primary";
    btnEdit.innerText = "✏️ Editar";
    btnEdit.onclick = async () => {
      const novoNome = prompt("Novo nome do objetivo:", item.nome);
      const novoValorStr = prompt("Novo valor reservado (R$):", item.valor);
      
      if (novoNome !== null && novoValorStr !== null) {
        const novoValor = parseFloat(novoValorStr);
        if (!isNaN(novoValor)) {
          await updateDoc(doc(db, "valoresSeparados", item.id), { nome: novoNome, valor: novoValor });
        }
      }
    };

    const btnDel = document.createElement("button");
    btnDel.className = "btn-excluir";
    btnDel.innerText = "❌";
    btnDel.onclick = () => deleteDoc(doc(db, "valoresSeparados", item.id));

    acoes.appendChild(btnEdit);
    acoes.appendChild(btnDel);
    divItem.appendChild(info);
    divItem.appendChild(acoes);
    container.appendChild(divItem);
  });
}

// --- CALCULADORA ---
let calcExpressao = "";
const display = document.getElementById("calc-display");

document.querySelectorAll(".calc-num").forEach(btn => {
  btn.addEventListener("click", () => {
    const val = btn.getAttribute("data-val");
    if (display.value === "0" && val !== ".") {
      calcExpressao = val;
    } else {
      calcExpressao += val;
    }
    display.value = calcExpressao;
  });
});

document.getElementById("calc-c").addEventListener("click", () => {
  calcExpressao = "";
  display.value = "0";
});

document.getElementById("calc-back").addEventListener("click", () => {
  calcExpressao = calcExpressao.slice(0, -1);
  display.value = calcExpressao || "0";
});

document.getElementById("calc-eq").addEventListener("click", () => {
  try {
    const res = eval(calcExpressao);
    display.value = res;
    calcExpressao = res.toString();
  } catch {
    display.value = "Erro";
    calcExpressao = "";
  }
});