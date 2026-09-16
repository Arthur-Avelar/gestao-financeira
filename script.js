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
let comprasCartao = [];

// Controle do Mês Atual (Formato: "YYYY-MM")
const dataHoje = new Date();
let mesSelecionado = `${dataHoje.getFullYear()}-${String(dataHoje.getMonth() + 1).padStart(2, '0')}`;

// Formatação BRL
const formatarMoeda = (valor) => {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Formatação de Nome do Mês
function formatarMesExibicao(chaveMes) {
  const [ano, mes] = chaveMes.split('-');
  const data = new Date(parseInt(ano), parseInt(mes) - 1, 1);
  const nomeMes = data.toLocaleString('pt-BR', { month: 'long' });
  return `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} de ${ano}`;
}

function atualizarInterfaceSeletorMes() {
  const label = document.getElementById("label-mes-atual");
  if (label) {
    label.innerText = formatarMesExibicao(mesSelecionado);
  }
}

// Navegação do Mês
document.getElementById("btn-mes-anterior").addEventListener("click", () => {
  const [ano, mes] = mesSelecionado.split('-').map(Number);
  const novaData = new Date(ano, mes - 2, 1);
  mesSelecionado = `${novaData.getFullYear()}-${String(novaData.getMonth() + 1).padStart(2, '0')}`;
  atualizarInterfaceSeletorMes();
  atualizarTudo();
});

document.getElementById("btn-mes-proximo").addEventListener("click", () => {
  const [ano, mes] = mesSelecionado.split('-').map(Number);
  const novaData = new Date(ano, mes, 1);
  mesSelecionado = `${novaData.getFullYear()}-${String(novaData.getMonth() + 1).padStart(2, '0')}`;
  atualizarInterfaceSeletorMes();
  atualizarTudo();
});

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
document.getElementById('btn-cartao').addEventListener('click', (e) => trocarAba('cartao', e.target));
document.getElementById('btn-futuros').addEventListener('click', (e) => trocarAba('futuros', e.target));
document.getElementById('btn-separados').addEventListener('click', (e) => trocarAba('separados', e.target));
document.getElementById('btn-calculadora').addEventListener('click', (e) => trocarAba('calculadora', e.target));

// --- LISTENERS FIRESTORE (Tempo Real) ---
onSnapshot(collection(db, "lancamentos"), (snapshot) => {
  lancamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  atualizarTudo();
});

onSnapshot(collection(db, "contasFixas"), (snapshot) => {
  contasFixas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  atualizarTudo();
});

onSnapshot(collection(db, "valoresSeparados"), (snapshot) => {
  valoresSeparados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  atualizarTudo();
});

onSnapshot(collection(db, "categorias"), (snapshot) => {
  categorias = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderizarDropdownCategorias();
  renderizarGerenciadorCategorias();
  atualizarTudo();
});

onSnapshot(collection(db, "entradasFuturas"), (snapshot) => {
  entradasFuturas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderizarFuturos();
  atualizarTudo();
});

onSnapshot(collection(db, "comprasCartao"), (snapshot) => {
  comprasCartao = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  atualizarTudo();
});

function atualizarTudo() {
  atualizarResumo();
  renderizarExtrato();
  renderizarFixas();
  renderizarCartao();
}

// --- RESUMO & QUANTO POSSO GASTAR ---
function atualizarResumo() {
  const lancamentosDoMes = lancamentos.filter(l => l.data && l.data.startsWith(mesSelecionado));

  const entradas = lancamentosDoMes.filter(l => l.tipo === "receita").reduce((acc, l) => acc + (parseFloat(l.valor) || 0), 0);
  const saidas = lancamentosDoMes.filter(l => l.tipo === "despesa").reduce((acc, l) => acc + (parseFloat(l.valor) || 0), 0);
  const separado = valoresSeparados.reduce((acc, s) => acc + (parseFloat(s.valor) || 0), 0);
  
  const fixasPendentes = contasFixas.filter(f => {
    const mesesPagos = f.mesesPagos || [];
    return !mesesPagos.includes(mesSelecionado);
  }).reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0);

  const totalFuturos = entradasFuturas.filter(f => f.data && f.data.startsWith(mesSelecionado))
    .reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0);

  // Calcula o total da fatura do cartão para o mês selecionado
  const parcelasDoMes = calcularParcelasDoMes();
  const totalFaturaCartao = parcelasDoMes.reduce((acc, p) => acc + p.valorParcela, 0);

  const saldo = entradas - saidas;
  
  // Subtrai a fatura do cartão junto com o valor separado e as contas fixas pendentes
  const quantoPossoGastar = (saldo + totalFuturos) - separado - fixasPendentes - totalFaturaCartao;

  document.getElementById("quanto-posso-gastar").innerText = formatarMoeda(quantoPossoGastar);
  document.getElementById("saldo-total").innerText = formatarMoeda(saldo);
  document.getElementById("total-futuros-card").innerText = formatarMoeda(totalFuturos);
  document.getElementById("total-entradas").innerText = formatarMoeda(entradas);
  document.getElementById("total-saidas").innerText = formatarMoeda(saidas);
  document.getElementById("total-separado").innerText = formatarMoeda(separado);

  renderizarResumoCategorias(lancamentosDoMes);
}

function renderizarResumoCategorias(lancamentosDoMes) {
  const container = document.getElementById("lista-categorias-resumo");
  container.innerHTML = "";

  const gastosPorCat = {};

  lancamentosDoMes.filter(l => l.tipo === "despesa").forEach(item => {
    gastosPorCat[item.categoria] = (gastosPorCat[item.categoria] || 0) + (parseFloat(item.valor) || 0);
  });

  const chaves = Object.keys(gastosPorCat);
  if (chaves.length === 0) {
    container.innerHTML = "<small>Nenhuma despesa registrada neste mês.</small>";
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

  const lancamentosDoMes = lancamentos.filter(l => l.data && l.data.startsWith(mesSelecionado));
  const ordenados = [...lancamentosDoMes].sort((a,b) => new Date(b.data) - new Date(a.data));

  if (ordenados.length === 0) {
    container.innerHTML = "<small>Nenhuma transação encontrada para este mês.</small>";
    return;
  }

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

// --- CARTÃO DE CRÉDITO ---
document.getElementById("form-cartao").addEventListener("submit", async (e) => {
  e.preventDefault();
  const desc = document.getElementById("cartao-desc").value;
  const valor = parseFloat(document.getElementById("cartao-valor").value);
  const parcelas = parseInt(document.getElementById("cartao-parcelas").value) || 1;
  const fechamento = parseInt(document.getElementById("cartao-fechamento").value);
  const data = document.getElementById("cartao-data").value;

  await addDoc(collection(db, "comprasCartao"), { desc, valor, parcelas, fechamento, data });
  document.getElementById("form-cartao").reset();
});

function calcularParcelasDoMes() {
  const parcelasDoMes = [];

  comprasCartao.forEach(compra => {
    const [ano, mes, dia] = compra.data.split('-').map(Number);
    let dataPrimeiraFatura = new Date(ano, mes - 1, 1);

    // Se comprou após o fechamento, joga a 1ª parcela pro mês seguinte
    if (dia >= compra.fechamento) {
      dataPrimeiraFatura.setMonth(dataPrimeiraFatura.getMonth() + 1);
    }

    const valorParcela = compra.valor / compra.parcelas;

    for (let i = 0; i < compra.parcelas; i++) {
      const dataParcela = new Date(dataPrimeiraFatura.getFullYear(), dataPrimeiraFatura.getMonth() + i, 1);
      const chaveMes = `${dataParcela.getFullYear()}-${String(dataParcela.getMonth() + 1).padStart(2, '0')}`;

      if (chaveMes === mesSelecionado) {
        parcelasDoMes.push({
          idCompra: compra.id,
          desc: compra.desc,
          numeroParcela: i + 1,
          totalParcelas: compra.parcelas,
          valorParcela: valorParcela
        });
      }
    }
  });

  return parcelasDoMes;
}

// Ajuste na renderização para identificar se o mês atual já foi pago
function renderizarCartao() {
  const container = document.getElementById("lista-cartao-mes");
  const labelRef = document.getElementById("cartao-mes-ref");
  const totalDisplay = document.getElementById("total-fatura-mes");
  const btnPagar = document.getElementById("btn-pagar-fatura");

  if (!container || !labelRef || !totalDisplay) return;

  container.innerHTML = "";
  labelRef.innerText = formatarMesExibicao(mesSelecionado);

  const parcelas = calcularParcelasDoMes();
  const totalFatura = parcelas.reduce((acc, p) => acc + p.valorParcela, 0);

  // Verifica no Extrato se já existe um pagamento de fatura lançado para este mês
  const jaPago = lancamentos.some(l => 
    l.categoria === "Cartão de Crédito" && 
    l.desc.includes(formatarMesExibicao(mesSelecionado)) &&
    l.data.startsWith(mesSelecionado)
  );

  if (jaPago) {
    totalDisplay.innerText = "R$ 0,00 (Paga)";
    totalDisplay.style.color = "#22c55e"; // Verde para fatura paga
    btnPagar.innerText = "Fatura Paga ✅";
    btnPagar.disabled = true;
    btnPagar.style.opacity = "0.6";
    container.innerHTML = "<small style='color: #22c55e;'>A fatura deste mês já foi paga e lançada no extrato.</small>";
    return;
  }

  // Restaura o botão caso a fatura não esteja paga
  btnPagar.innerText = "Pagar Fatura";
  btnPagar.disabled = false;
  btnPagar.style.opacity = "1";
  totalDisplay.style.color = "#c084fc";
  totalDisplay.innerText = formatarMoeda(totalFatura);

  if (parcelas.length === 0) {
    container.innerHTML = "<small>Nenhuma fatura ou compra neste mês.</small>";
    return;
  }

  parcelas.forEach(p => {
    const div = document.createElement("div");
    div.className = "item-lista despesa";

    const info = document.createElement("div");
    info.innerHTML = `<strong>${p.desc}</strong> (Parcela ${p.numeroParcela}/${p.totalParcelas})<br><span>${formatarMoeda(p.valorParcela)}</span>`;

    const acoes = document.createElement("div");
    const btnDel = document.createElement("button");
    btnDel.className = "btn-excluir";
    btnDel.innerText = "❌";
    btnDel.onclick = () => deleteDoc(doc(db, "comprasCartao", p.idCompra));

    acoes.appendChild(btnDel);
    div.appendChild(info);
    div.appendChild(acoes);
    container.appendChild(div);
  });
}

document.getElementById("btn-pagar-fatura").addEventListener("click", async () => {
  const parcelas = calcularParcelasDoMes();
  const totalFatura = parcelas.reduce((acc, p) => acc + p.valorParcela, 0);

  if (totalFatura <= 0) {
    alert("Não há fatura a ser paga neste mês.");
    return;
  }

  if (confirm(`Deseja lançar a fatura de ${formatarMoeda(totalFatura)} do mês (${mesSelecionado}) no extrato?`)) {
    await addDoc(collection(db, "lancamentos"), {
      desc: `[Fatura Cartão] ${formatarMesExibicao(mesSelecionado)}`,
      valor: totalFatura,
      tipo: "despesa",
      categoria: "Cartão de Crédito",
      data: `${mesSelecionado}-05`
    });

    trocarAba('extrato', document.getElementById('btn-extrato'));
  }
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

// --- CONTAS FIXAS (COM SUPORTE A DESATIVAR/EXCLUIR) ---
document.getElementById("form-fixa")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("fixa-nome").value;
  const valor = parseFloat(document.getElementById("fixa-valor").value);
  const vencimento = parseInt(document.getElementById("fixa-vencimento").value);

  // Criamos a conta marcada como ativa (ativa: true)
  await addDoc(collection(db, "contasFixas"), { 
    nome, 
    valor, 
    vencimento, 
    mesesPagos: [],
    ativa: true 
  });
  document.getElementById("form-fixa").reset();
});

function renderizarFixas() {
  const container = document.getElementById("lista-fixas");
  if (!container) return;
  container.innerHTML = "";

  // Filtra apenas as contas que estão ATIVAS OU que já foram pagas neste mês específico
  const fixasVisiveis = contasFixas.filter(f => {
    const isAtiva = f.ativa !== false; // Se não tiver a propriedade, considera ativa
    const jaPagaNesteMes = (f.mesesPagos || []).includes(mesSelecionado);
    return isAtiva || jaPagaNesteMes;
  });

  const totalGeral = fixasVisiveis.reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0);
  const pendentesArr = fixasVisiveis.filter(f => !(f.mesesPagos || []).includes(mesSelecionado));
  const totalPendente = pendentesArr.reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0);
  const pagasArr = fixasVisiveis.filter(f => (f.mesesPagos || []).includes(mesSelecionado));
  const totalPago = pagasArr.reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0);

  const elVal = document.getElementById("total-fixas-valor");
  const elQtd = document.getElementById("total-fixas-qtd");
  const elPen = document.getElementById("total-fixas-pendente");
  const elPenQtd = document.getElementById("qtd-fixas-pendente");
  const elPag = document.getElementById("total-fixas-pago");
  const elPagQtd = document.getElementById("qtd-fixas-pago");

  if (elVal) elVal.innerText = formatarMoeda(totalGeral);
  if (elQtd) elQtd.innerText = `${fixasVisiveis.length} contas`;
  if (elPen) elPen.innerText = formatarMoeda(totalPendente);
  if (elPenQtd) elPenQtd.innerText = `${pendentesArr.length} pendentes`;
  if (elPag) elPag.innerText = formatarMoeda(totalPago);
  if (elPagQtd) elPagQtd.innerText = `${pagasArr.length} pagas`;

  fixasVisiveis.sort((a,b) => a.vencimento - b.vencimento).forEach(item => {
    const mesesPagos = item.mesesPagos || [];
    const estaPagaNesteMes = mesesPagos.includes(mesSelecionado);

    const div = document.createElement("div");
    div.className = `item-lista ${estaPagaNesteMes ? 'item-pago' : ''}`;

    const info = document.createElement("div");
    info.innerHTML = `<strong>${item.nome}</strong> - Vence dia ${item.vencimento}<br><span>${formatarMoeda(item.valor)}</span>`;

    const acoes = document.createElement("div");
    const btnPagar = document.createElement("button");
    btnPagar.className = "btn-primary";
    btnPagar.innerText = estaPagaNesteMes ? 'Desmarcar' : 'Pagar';
    
    btnPagar.onclick = async () => {
      let novosMeses = [...mesesPagos];
      if (estaPagaNesteMes) {
        novosMeses = novosMeses.filter(m => m !== mesSelecionado);
      } else {
        novosMeses.push(mesSelecionado);
        const diaVenc = String(item.vencimento).padStart(2, '0');
        await addDoc(collection(db, "lancamentos"), {
          desc: `[Conta Fixa] ${item.nome}`,
          valor: parseFloat(item.valor),
          tipo: "despesa",
          categoria: "Contas Fixas",
          data: `${mesSelecionado}-${diaVenc}`
        });
      }
      await updateDoc(doc(db, "contasFixas", item.id), { mesesPagos: novosMeses });
    };

    // Botão de Encerrar/Desativar para meses futuros
    const btnEncerrar = document.createElement("button");
    btnEncerrar.className = "btn-excluir";
    btnEncerrar.innerText = "🚫";
    btnEncerrar.title = "Encerrar conta (não aparecerá nos próximos meses)";
    btnEncerrar.onclick = async () => {
      if (confirm(`Deseja encerrar a conta "${item.nome}"? Ela deixará de aparecer nos próximos meses, mas o histórico passado será mantido.`)) {
        await updateDoc(doc(db, "contasFixas", item.id), { ativa: false });
      }
    };

    acoes.appendChild(btnPagar);
    acoes.appendChild(btnEncerrar);
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

// Inicialização da interface do mês ao carregar
atualizarInterfaceSeletorMes();
