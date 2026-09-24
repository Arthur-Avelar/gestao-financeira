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
document.getElementById("btn-mes-anterior")?.addEventListener("click", () => {
  const [ano, mes] = mesSelecionado.split('-').map(Number);
  const novaData = new Date(ano, mes - 2, 1);
  mesSelecionado = `${novaData.getFullYear()}-${String(novaData.getMonth() + 1).padStart(2, '0')}`;
  atualizarInterfaceSeletorMes();
  atualizarTudo();
});

document.getElementById("btn-mes-proximo")?.addEventListener("click", () => {
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

  const alvoAba = document.getElementById(`aba-${abaId}`);
  if (alvoAba) alvoAba.classList.add('active');
  if (btn) btn.classList.add('active');
}

document.getElementById('btn-resumo')?.addEventListener('click', (e) => trocarAba('resumo', e.target));
document.getElementById('btn-extrato')?.addEventListener('click', (e) => trocarAba('extrato', e.target));
document.getElementById('btn-novo')?.addEventListener('click', (e) => trocarAba('novo', e.target));
document.getElementById('btn-fixas')?.addEventListener('click', (e) => trocarAba('fixas', e.target));
document.getElementById('btn-cartao')?.addEventListener('click', (e) => trocarAba('cartao', e.target));
document.getElementById('btn-futuros')?.addEventListener('click', (e) => trocarAba('futuros', e.target));
document.getElementById('btn-separados')?.addEventListener('click', (e) => trocarAba('separados', e.target));
document.getElementById('btn-calculadora')?.addEventListener('click', (e) => trocarAba('calculadora', e.target));

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
  renderizarFuturos();
  renderizarSeparados();
}

// --- RESUMO & QUANTO POSSO GASTAR ---
function atualizarResumo() {
  const lancamentosDoMes = lancamentos.filter(l => l.data && l.data.startsWith(mesSelecionado));

  const entradas = lancamentosDoMes.filter(l => l.tipo === "receita").reduce((acc, l) => acc + (parseFloat(l.valor) || 0), 0);
  const saidas = lancamentosDoMes.filter(l => l.tipo === "despesa").reduce((acc, l) => acc + (parseFloat(l.valor) || 0), 0);
  
  const saldoAtual = entradas - saidas;

  const totalFuturos = entradasFuturas.filter(f => {
    return f.mes === mesSelecionado || (f.data && f.data.startsWith(mesSelecionado));
  }).reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0);

  const separado = valoresSeparados
    .filter(s => s.ativa !== false && (!s.mes || s.mes === mesSelecionado))
    .reduce((acc, s) => acc + (parseFloat(s.valor) || 0), 0);

  const fixasPendentes = contasFixas.filter(f => {
    const isAtiva = f.ativa !== false;
    const jaCriada = !f.mesInicio || f.mesInicio <= mesSelecionado;
    const naoEncerrada = !f.mesFim || f.mesFim > mesSelecionado;
    const mesesPagos = f.mesesPagos || [];
    const jaPaga = mesesPagos.includes(mesSelecionado);

    return isAtiva && jaCriada && naoEncerrada && !jaPaga;
  }).reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0);

  const jaPagoCartao = lancamentos.some(l => 
    l.categoria === "Cartão de Crédito" && 
    l.desc.includes(formatarMesExibicao(mesSelecionado)) &&
    l.data.startsWith(mesSelecionado)
  );

  let faturaCartaoPendente = 0;
  if (!jaPagoCartao) {
    const parcelas = calcularParcelasDoMes();
    faturaCartaoPendente = parcelas.reduce((acc, p) => acc + p.valorParcela, 0);
  }

  const quantoPossoGastar = (saldoAtual + totalFuturos) - separado - fixasPendentes - faturaCartaoPendente;

  const elGastar = document.getElementById("quanto-posso-gastar");
  const elSaldo = document.getElementById("saldo-total");
  const elFuturos = document.getElementById("total-futuros-card");
  const elEntradas = document.getElementById("total-entradas");
  const elSaidas = document.getElementById("total-saidas");
  const elSeparado = document.getElementById("total-separado");

  if (elGastar) elGastar.innerText = formatarMoeda(quantoPossoGastar);
  if (elSaldo) elSaldo.innerText = formatarMoeda(saldoAtual);
  if (elFuturos) elFuturos.innerText = formatarMoeda(totalFuturos);
  if (elEntradas) elEntradas.innerText = formatarMoeda(entradas);
  if (elSaidas) elSaidas.innerText = formatarMoeda(saidas);
  if (elSeparado) elSeparado.innerText = formatarMoeda(separado);

  renderizarResumoCategorias(lancamentosDoMes);
}

function renderizarResumoCategorias(lancamentosDoMes) {
  const container = document.getElementById("lista-categorias-resumo");
  if (!container) return;
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
  const select = document.getElementById("lanc-categoria") || document.getElementById("categoria-select");
  if (!select) return;
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

document.getElementById("form-categoria")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nomeInput = document.getElementById("categoria-nome");
  const nome = nomeInput ? nomeInput.value.trim() : "";
  if (nome) {
    await addDoc(collection(db, "categorias"), { nome });
    document.getElementById("form-categoria").reset();
  }
});

function renderizarGerenciadorCategorias() {
  const container = document.getElementById("lista-categorias-gerenciador");
  if (!container) return;
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

// --- EXTRATO AGRUPADO POR DATA ---
function renderizarExtrato() {
  const container = document.getElementById("lista-extrato");
  if (!container) return;
  container.innerHTML = "";

  const lancamentosDoMes = lancamentos.filter(l => l.data && l.data.startsWith(mesSelecionado));

  if (lancamentosDoMes.length === 0) {
    container.innerHTML = "<small>Nenhuma transação neste mês.</small>";
    return;
  }

  const agrupados = {};
  lancamentosDoMes.forEach(item => {
    if (!agrupados[item.data]) {
      agrupados[item.data] = [];
    }
    agrupados[item.data].push(item);
  });

  const datasOrdenadas = Object.keys(agrupados).sort((a, b) => {
    return new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00');
  });

  datasOrdenadas.forEach(data => {
    const tituloData = document.createElement("div");
    tituloData.className = "data-grupo-titulo";
    tituloData.innerText = formatarDataExibicao(data);
    container.appendChild(tituloData);

    const itensDoDia = agrupados[data];

    // Ordena do mais recente para o mais antigo dentro do dia
    itensDoDia.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

    itensDoDia.forEach(item => {
      const div = document.createElement("div");
      div.className = `item-lista ${item.tipo}`;

      const infoDiv = document.createElement("div");
      infoDiv.className = "item-info";

      // Exibe a hora do lançamento (se existir)
      const exibicaoHora = item.hora ? `<span style="font-size: 0.8em; color: #888; margin-right: 6px;">⏱️ ${item.hora}</span>` : '';

      infoDiv.innerHTML = `
        <strong>${item.desc || 'Sem descrição'}</strong>
        <div>
          ${exibicaoHora}
          <small style="color: #aaa;">(${item.categoria || 'Geral'})</small>
        </div>
      `;

      const acoesValorDiv = document.createElement("div");
      acoesValorDiv.className = "item-acoes-valor";

      const valorSpan = document.createElement("span");
      valorSpan.style.fontWeight = "bold";
      valorSpan.innerText = `${item.tipo === 'despesa' ? '-' : '+'} ${formatarMoeda(item.valor)}`;

      const botoesDiv = document.createElement("div");
      botoesDiv.className = "acoes-botoes";

      const btnEditar = document.createElement("button");
      btnEditar.className = "btn-icon";
      btnEditar.innerText = "✏️";
      btnEditar.onclick = () => prepararEdicaoLancamento(item);

      const btnExcluir = document.createElement("button");
      btnExcluir.className = "btn-icon";
      btnExcluir.innerText = "❌";
      btnExcluir.onclick = () => excluirLancamento(item.id);

      botoesDiv.appendChild(btnEditar);
      botoesDiv.appendChild(btnExcluir);

      acoesValorDiv.appendChild(valorSpan);
      acoesValorDiv.appendChild(botoesDiv);

      div.appendChild(infoDiv);
      div.appendChild(acoesValorDiv);

      container.appendChild(div);
    });
  });
}

function excluirLancamento(id) {
  if (confirm("Deseja realmente excluir este lançamento?")) {
    deleteDoc(doc(db, "lancamentos", id));
  }
}

function prepararEdicaoLancamento(item) {
  const elId = document.getElementById("edit-lancamento-id");
  const elDesc = document.getElementById("lanc-desc") || document.getElementById("desc");
  const elValor = document.getElementById("lanc-valor") || document.getElementById("valor");
  const elTipo = document.getElementById("lanc-tipo") || document.getElementById("tipo");
  const elCat = document.getElementById("lanc-categoria") || document.getElementById("categoria-select");
  const elData = document.getElementById("lanc-data") || document.getElementById("data");

  if (elId) elId.value = item.id;
  if (elDesc) elDesc.value = item.desc === "Sem descrição" ? "" : item.desc;
  if (elValor) elValor.value = item.valor;
  if (elTipo) elTipo.value = item.tipo;
  if (elCat) elCat.value = item.categoria;
  if (elData) elData.value = item.data;

  const titulo = document.getElementById("titulo-form-lancamento");
  const btnSalvar = document.getElementById("btn-salvar-lancamento");
  const btnCancelar = document.getElementById("btn-cancelar-edicao");

  if (titulo) titulo.innerText = "Editar Lançamento";
  if (btnSalvar) btnSalvar.innerText = "Atualizar Lançamento";
  if (btnCancelar) btnCancelar.style.display = "inline-block";

  trocarAba('novo', document.getElementById('btn-novo'));
}

document.getElementById("btn-cancelar-edicao")?.addEventListener("click", resetarFormLancamento);

function resetarFormLancamento() {
  const elId = document.getElementById("edit-lancamento-id");
  if (elId) elId.value = "";
  
  const form = document.getElementById("form-lancamento");
  if (form) form.reset();

  const titulo = document.getElementById("titulo-form-lancamento");
  const btnSalvar = document.getElementById("btn-salvar-lancamento");
  const btnCancelar = document.getElementById("btn-cancelar-edicao");

  if (titulo) titulo.innerText = "Novo Lançamento";
  if (btnSalvar) btnSalvar.innerText = "Salvar Lançamento";
  if (btnCancelar) btnCancelar.style.display = "none";
}

document.getElementById("form-lancamento")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const editId = document.getElementById("edit-lancamento-id")?.value;
  const descInput = document.getElementById("lanc-desc") || document.getElementById("desc");
  const valorInput = document.getElementById("lanc-valor") || document.getElementById("valor");
  const tipoInput = document.getElementById("lanc-tipo") || document.getElementById("tipo");
  const catInput = document.getElementById("lanc-categoria") || document.getElementById("categoria-select");
  const dataInput = document.getElementById("lanc-data") || document.getElementById("data");

  const desc = descInput ? descInput.value.trim() : "";
  const valor = valorInput ? parseFloat(valorInput.value) : 0;
  const tipo = tipoInput ? tipoInput.value : "despesa";
  const categoria = catInput ? catInput.value : "Geral";
  const data = dataInput && dataInput.value ? dataInput.value : `${mesSelecionado}-01`;

  if (isNaN(valor) || valor <= 0) {
    alert("Por favor, digite um valor válido.");
    return;
  }

  // Gera o horário no formato "14:30"
  const agora = new Date();
  const horaFormatada = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (editId) {
    await updateDoc(doc(db, "lancamentos", editId), {
      desc: desc || "Sem descrição",
      valor,
      tipo,
      categoria,
      data
    });
  } else {
    await addDoc(collection(db, "lancamentos"), {
      desc: desc || "Sem descrição",
      valor,
      tipo,
      categoria,
      data,
      hora: horaFormatada,
      criadoEm: agora.getTime()
    });
  }

  resetarFormLancamento();
  trocarAba('extrato', document.getElementById('btn-extrato'));
});

// --- CARTÃO DE CRÉDITO ---
document.getElementById("form-cartao")?.addEventListener("submit", async (e) => {
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

  const jaPago = lancamentos.some(l => 
    l.categoria === "Cartão de Crédito" && 
    l.desc.includes(formatarMesExibicao(mesSelecionado)) &&
    l.data.startsWith(mesSelecionado)
  );

  if (jaPago) {
    totalDisplay.innerText = "R$ 0,00 (Paga)";
    totalDisplay.style.color = "#22c55e";
    if (btnPagar) {
      btnPagar.innerText = "Fatura Paga ✅";
      btnPagar.disabled = true;
      btnPagar.style.opacity = "0.6";
    }
    container.innerHTML = "<small style='color: #22c55e;'>A fatura deste mês já foi paga e lançada no extrato.</small>";
    return;
  }

  if (btnPagar) {
    btnPagar.innerText = "Pagar Fatura";
    btnPagar.disabled = false;
    btnPagar.style.opacity = "1";
  }
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

document.getElementById("btn-pagar-fatura")?.addEventListener("click", async () => {
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
      data: `${mesSelecionado}-05`,
      criadoEm: new Date().getTime()
    });

    trocarAba('extrato', document.getElementById('btn-extrato'));
  }
});

// --- ENTRADAS FUTURAS ---
document.getElementById("form-futuro")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const desc = document.getElementById("futuro-desc").value;
  const valor = parseFloat(document.getElementById("futuro-valor").value);
  const data = document.getElementById("futuro-data").value;

  if (!desc || isNaN(valor)) return;

  await addDoc(collection(db, "entradasFuturas"), { 
    desc, 
    valor, 
    data: data || `${mesSelecionado}-01`,
    mes: mesSelecionado
  });

  document.getElementById("form-futuro").reset();
});

function renderizarFuturos() {
  const container = document.getElementById("lista-futuros");
  if (!container) return;
  container.innerHTML = "";

  const futurosDoMes = entradasFuturas.filter(f => {
    return f.mes === mesSelecionado || (f.data && f.data.startsWith(mesSelecionado));
  });

  if (futurosDoMes.length === 0) {
    container.innerHTML = "<small>Nenhum lançamento a receber neste mês.</small>";
    return;
  }

  const ordenados = [...futurosDoMes].sort((a, b) => new Date(a.data) - new Date(b.data));

  ordenados.forEach(item => {
    const div = document.createElement("div");
    div.className = "item-lista receita";

    const info = document.createElement("div");
    info.innerHTML = `<strong>${item.desc}</strong><br><small>Previsto: ${item.data}</small><br><span>${formatarMoeda(item.valor)}</span>`;

    const acoes = document.createElement("div");

    const btnReceber = document.createElement("button");
    btnReceber.className = "btn-primary";
    btnReceber.innerText = "✅ Receber";
    btnReceber.style.marginRight = "8px";
    btnReceber.onclick = async () => {
      await addDoc(collection(db, "lancamentos"), {
        desc: `[Depósito] ${item.desc}`,
        valor: parseFloat(item.valor),
        tipo: "receita",
        categoria: "Receita",
        data: item.data || `${mesSelecionado}-01`,
        criadoEm: new Date().getTime()
      });
      await deleteDoc(doc(db, "entradasFuturas", item.id));
    };

    const btnDel = document.createElement("button");
    btnDel.className = "btn-excluir";
    btnDel.innerText = "❌";
    btnDel.onclick = async () => {
      if (confirm(`Deseja excluir "${item.desc}" de ${formatarMesExibicao(mesSelecionado)}?`)) {
        await deleteDoc(doc(db, "entradasFuturas", item.id));
      }
    };

    acoes.appendChild(btnReceber);
    acoes.appendChild(btnDel);
    div.appendChild(info);
    div.appendChild(acoes);
    container.appendChild(div);
  });
}

// --- CONTAS FIXAS ---
document.getElementById("form-fixa")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("fixa-nome").value;
  const valor = parseFloat(document.getElementById("fixa-valor").value);
  const vencimento = parseInt(document.getElementById("fixa-vencimento").value);

  await addDoc(collection(db, "contasFixas"), { 
    nome, 
    valor, 
    vencimento, 
    mesesPagos: [],
    mesInicio: mesSelecionado,
    ativa: true 
  });
  document.getElementById("form-fixa").reset();
});

function renderizarFixas() {
  const container = document.getElementById("lista-fixas");
  if (!container) return;
  container.innerHTML = "";

  const fixasVisiveis = contasFixas.filter(f => {
    const isAtiva = f.ativa !== false;
    const jaCriada = !f.mesInicio || f.mesInicio <= mesSelecionado;
    const naoEncerrada = !f.mesFim || f.mesFim > mesSelecionado;
    const jaPagaNesteMes = (f.mesesPagos || []).includes(mesSelecionado);

    return (isAtiva && jaCriada && naoEncerrada) || jaPagaNesteMes;
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

  if (fixasVisiveis.length === 0) {
    container.innerHTML = "<small>Nenhuma conta fixa cadastrada para este mês.</small>";
    return;
  }

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
    btnPagar.style.marginRight = "8px";
    
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
          data: `${mesSelecionado}-${diaVenc}`,
          criadoEm: new Date().getTime()
        });
      }
      await updateDoc(doc(db, "contasFixas", item.id), { mesesPagos: novosMeses });
    };

    const btnEncerrar = document.createElement("button");
    btnEncerrar.className = "btn-excluir";
    btnEncerrar.innerText = "❌";
    btnEncerrar.title = "Remover conta";
    btnEncerrar.onclick = async () => {
      if (confirm(`Deseja remover a conta "${item.nome}" de ${formatarMesExibicao(mesSelecionado)} em diante?`)) {
        await updateDoc(doc(db, "contasFixas", item.id), { mesFim: mesSelecionado });
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
document.getElementById("form-separado")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nomeInput = document.getElementById("separado-nome");
  const valorInput = document.getElementById("separado-valor");

  const nome = nomeInput ? nomeInput.value.trim() : "";
  const valor = valorInput ? parseFloat(valorInput.value) : 0;

  if (!nome || isNaN(valor)) return;

  await addDoc(collection(db, "valoresSeparados"), { 
    nome, 
    valor, 
    mes: mesSelecionado,
    ativa: true 
  });
  document.getElementById("form-separado").reset();
});

function renderizarSeparados() {
  const container = document.getElementById("lista-separados");
  if (!container) return;
  container.innerHTML = "";

  const separadosDoMes = valoresSeparados.filter(s => {
    const isAtivo = s.ativa !== false;
    const pertenceAoMes = !s.mes || s.mes === mesSelecionado;
    return isAtivo && pertenceAoMes;
  });

  if (separadosDoMes.length === 0) {
    container.innerHTML = "<small>Nenhum valor separado/reservado para este mês.</small>";
    return;
  }

  separadosDoMes.forEach(item => {
    const divItem = document.createElement("div");
    divItem.className = "item-lista";

    const info = document.createElement("div");
    info.innerHTML = `<strong>${item.nome}</strong><br><span>${formatarMoeda(item.valor)}</span>`;

    const acoes = document.createElement("div");

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn-editar";
    btnEdit.innerText = "✏️";
    btnEdit.style.marginRight = "8px";
    btnEdit.onclick = async () => {
      const novoNome = prompt("Novo nome do objetivo:", item.nome);
      if (novoNome === null) return;

      const novoValorStr = prompt("Novo valor reservado (R$):", item.valor);
      if (novoValorStr === null) return;

      const novoValor = parseFloat(novoValorStr.replace(',', '.'));
      if (!isNaN(novoValor)) {
        await updateDoc(doc(db, "valoresSeparados", item.id), { 
          nome: novoNome.trim() || item.nome, 
          valor: novoValor 
        });
      } else {
        alert("Valor inválido inserido.");
      }
    };

    const btnDel = document.createElement("button");
    btnDel.className = "btn-excluir";
    btnDel.innerText = "❌";
    btnDel.onclick = async () => {
      if (confirm(`Deseja remover "${item.nome}" dos Separados deste mês?`)) {
        await updateDoc(doc(db, "valoresSeparados", item.id), { ativa: false });
      }
    };

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
    if (display) {
      if (display.value === "0" && val !== ".") {
        calcExpressao = val;
      } else {
        calcExpressao += val;
      }
      display.value = calcExpressao;
    }
  });
});

document.getElementById("calc-c")?.addEventListener("click", () => {
  calcExpressao = "";
  if (display) display.value = "0";
});

document.getElementById("calc-back")?.addEventListener("click", () => {
  calcExpressao = calcExpressao.slice(0, -1);
  if (display) display.value = calcExpressao || "0";
});

document.getElementById("calc-eq")?.addEventListener("click", () => {
  try {
    const res = eval(calcExpressao);
    if (display) display.value = res;
    calcExpressao = res.toString();
  } catch {
    if (display) display.value = "Erro";
    calcExpressao = "";
  }
});

// Helper de exibição da data
function formatarDataExibicao(dataStr) {
  if (!dataStr) return "";
  const [ano, mes, dia] = dataStr.split("-");
  const data = new Date(ano, mes - 1, dia);
  return data.toLocaleDateString("pt-BR", { 
    weekday: "short", 
    day: "2-digit", 
    month: "2-digit", 
    year: "numeric" 
  });
}

// Inicialização
atualizarInterfaceSeletorMes();
