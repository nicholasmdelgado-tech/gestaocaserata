// script.js — Gestão Queijaria com Vendas (PDV)
// Inclui: Clientes, Produtos, Estoque (lotes), Movimentações (FIFO), Vendas (múltiplos itens), Dashboard, Export, Toasts

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const sections = document.querySelectorAll(".content-section");
  const menuButtons = document.querySelectorAll(".menu-btn");

  // Clientes
  const formCliente = document.getElementById("formCliente");
  const listaClientes = document.getElementById("listaClientes");
  const buscarCliente = document.getElementById("buscarCliente");

  // Produtos
  const formProduto = document.getElementById("formProduto");
  const listaProdutos = document.getElementById("listaProdutos");
  const buscarProduto = document.getElementById("buscarProduto");
  const datalistCategorias = document.getElementById("listaCategorias");

  // Estoque UI
  const tabelaEstoque = document.getElementById("tabelaEstoque");
  const tabelaMovs = document.getElementById("tabelaMovs");
  const txtTotalItens = document.getElementById("txtTotalItens");
  const txtValorTotalEstoque = document.getElementById("txtValorTotalEstoque");

  // Dashboard
  const dashClientes = document.getElementById("dashClientes");
  const dashProdutos = document.getElementById("dashProdutos");
  const dashValorEstoque = document.getElementById("dashValorEstoque");
  const dashLucroReal = document.getElementById("dashLucroReal");
  const dashLucroPct = document.getElementById("dashLucroPct");
  const dashUltAtual = document.getElementById("dashUltAtual");

  // Mov modal
  const modalMov = document.getElementById("modalMov"); // not used in this variant (we use PDV modal)
  const formMov = document.getElementById("formMov");

  // Vendas UI
  const saleCliente = document.getElementById("saleCliente");
  const saleProduto = document.getElementById("saleProduto");
  const saleQuantidade = document.getElementById("saleQuantidade");
  const saleLote = document.getElementById("saleLote");
  const salePreco = document.getElementById("salePreco");
  const saleDesconto = document.getElementById("saleDesconto");
  const btnAddItem = document.getElementById("btnAddItem");
  const saleItens = document.getElementById("saleItens");
  const saleSubtotal = document.getElementById("saleSubtotal");
  const saleDescontoValor = document.getElementById("saleDescontoValor");
  const saleTotal = document.getElementById("saleTotal");
  const btnFinalizarVenda = document.getElementById("btnFinalizarVenda");
  const btnCancelarVenda = document.getElementById("btnCancelarVenda");
  const listaVendas = document.getElementById("listaVendas");

  const modalVendaDetalhe = document.getElementById("modalVendaDetalhe");
  const modalVendaTitle = document.getElementById("modalVendaTitle");
  const modalVendaBody = document.getElementById("modalVendaBody");

  // prod inputs
  const prodQuantidadeMedia = document.getElementById("prodQuantidadeMedia");

  // state
  let editandoCliente = null;
  let editandoProduto = null;
  let vendaItensTemp = []; // items being added to the current sale

  // LocalStorage keys
  const LS = {
    clientes: "clientes",
    produtos: "produtos",
    categorias: "categorias",
    movimentacoes: "movimentacoes", // newest-first
    vendas: "vendas",
    lastUpdate: "lastUpdate"
  };

  // --------- Toast ----------
  function showToast(message, type = "info", timeout = 3500) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const colors = { info: "bg-blue-500", success: "bg-green-500", error: "bg-red-500", warn: "bg-yellow-500" };
    const el = document.createElement("div");
    el.className = `text-white px-4 py-2 rounded shadow ${colors[type] || colors.info} max-w-xs`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 300); }, timeout);
  }

  // -------- storage helpers ----------
  function carregar(key) { return JSON.parse(localStorage.getItem(key) || "[]"); }
  function salvar(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
  function salvarTimestampNow() { localStorage.setItem(LS.lastUpdate, new Date().toISOString()); }

  // money helpers
  function parseMoney(str) {
    if (!str) return NaN;
    return parseFloat(String(str).replace(/\s/g, "").replace("R$", "").replace(/\./g, "").replace(",", "."));
  }
  function formatMoney(num) {
    if (isNaN(num)) return "R$ 0,00";
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // small utils
  function escapeHtml(s) { if (s === null || s === undefined) return ""; return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function uidPad(n, len = 4) { return String(n).padStart(len, "0"); }

  // ---------- IMASK ----------
  if (window.IMask) {
    IMask(document.getElementById("cliCPF"), { mask: "000.000.000-00" });
    IMask(document.getElementById("cliRG"), { mask: "00.000.000-0" });
    IMask(document.getElementById("cliCelular"), { mask: "(00) 00000-0000" });
    IMask(document.getElementById("cliCEP"), { mask: "00000-000" });
    if (prodQuantidadeMedia) IMask(prodQuantidadeMedia, { mask: Number, scale: 3, radix: ".", padFractionalZeros: true, min: 0, max: 1000000, thousandsSeparator: "" });
    IMask(document.getElementById("prodCusto"), { mask: Number, scale: 2, radix: ",", thousandsSeparator: ".", prefix: "R$ ", padFractionalZeros: true });
    IMask(document.getElementById("prodVenda"), { mask: Number, scale: 2, radix: ",", thousandsSeparator: ".", prefix: "R$ ", padFractionalZeros: true });
    IMask(document.getElementById("movQuantidade") || document.createElement("input"), { mask: Number, scale: 3, radix: ".", thousandsSeparator: "" });
    IMask(document.getElementById("saleQuantidade") || document.createElement("input"), { mask: Number, scale: 3, radix: ".", thousandsSeparator: "" });
  }

  // ---------- validation ----------
  function validarCPF(cpf) {
    cpf = (cpf || "").replace(/\D/g, "");
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
    resto = (soma * 10) % 11; if (resto === 10) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
    resto = (soma * 10) % 11; if (resto === 10) resto = 0;
    return resto === parseInt(cpf[10]);
  }

  // -------- CEP via ViaCEP ----------
  window.buscarCEP = async function(value) {
    const cepRaw = (value || document.getElementById("cliCEP").value || "").replace(/\D/g, "");
    if (!cepRaw || cepRaw.length !== 8) { showToast("CEP inválido.", "warn"); return; }
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cepRaw}/json/`);
      const data = await resp.json();
      if (data.erro) { showToast("CEP não encontrado.", "error"); return; }
      document.getElementById("cliRua").value = data.logradouro || "";
      document.getElementById("cliBairro").value = data.bairro || "";
      document.getElementById("cliCidade").value = data.localidade || "";
      document.getElementById("cliEstado").value = data.uf || "";
      showToast("CEP preenchido.", "success");
    } catch {
      showToast("Erro ao buscar CEP.", "error");
    }
  };

  // ---------- CLIENTES ----------
  if (formCliente) {
    formCliente.addEventListener("submit", e => {
      e.preventDefault();
      const cliente = {
        nome: document.getElementById("cliNome").value.trim(),
        celular: document.getElementById("cliCelular").value.trim(),
        email: document.getElementById("cliEmail").value.trim(),
        rg: document.getElementById("cliRG").value.trim(),
        cpf: document.getElementById("cliCPF").value.trim(),
        cep: document.getElementById("cliCEP").value.trim(),
        rua: document.getElementById("cliRua").value.trim(),
        numero: document.getElementById("cliNumero").value.trim(),
        bairro: document.getElementById("cliBairro").value.trim(),
        cidade: document.getElementById("cliCidade").value.trim(),
        estado: document.getElementById("cliEstado").value.trim(),
        complemento: document.getElementById("cliComplemento").value.trim(),
        referencia: document.getElementById("cliReferencia").value.trim()
      };

      if (!cliente.nome) return showToast("Informe o nome.", "warn");
      if (!cliente.celular || !/^\(\d{2}\) \d{5}-\d{4}$/.test(cliente.celular)) return showToast("Celular inválido.", "warn");
      if (cliente.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email)) return showToast("E-mail inválido.", "warn");
      if (!validarCPF(cliente.cpf)) return showToast("CPF inválido.", "warn");
      if (!cliente.cep || cliente.cep.replace(/\D/g,"").length !== 8) return showToast("CEP inválido.", "warn");
      if (!cliente.numero) return showToast("Número da casa obrigatório.", "warn");

      const clientes = carregar(LS.clientes);
      if (editandoCliente !== null) {
        clientes[editandoCliente] = cliente; editandoCliente = null; showToast("Cliente atualizado.", "success");
      } else {
        clientes.push(cliente); showToast("Cliente salvo.", "success");
      }
      salvar(LS.clientes, clientes);
      formCliente.reset();
      atualizarListaClientes();
      atualizarDashboard();
    });
  }

  function atualizarListaClientes() {
    if (!listaClientes) return;
    const termo = (buscarCliente?.value || "").toLowerCase();
    const clientes = carregar(LS.clientes);
    listaClientes.innerHTML = "";
    clientes.filter(c => c.nome.toLowerCase().includes(termo)).forEach((c,i) => {
      const tr = document.createElement("tr"); tr.className="border-b";
      tr.innerHTML = `
        <td class="p-2">${escapeHtml(c.nome)}</td>
        <td class="p-2">${escapeHtml(c.celular)}</td>
        <td class="p-2">${escapeHtml(c.email||"-")}</td>
        <td class="p-2">${escapeHtml(c.cpf)}</td>
        <td class="p-2">${escapeHtml(c.rua)}, ${escapeHtml(c.numero)} ${c.bairro?("- "+escapeHtml(c.bairro)):""}<br>${escapeHtml(c.cidade)}/${escapeHtml(c.estado)}</td>
        <td class="p-2 text-center">
          <button class="bg-blue-500 text-white px-2 py-1 rounded mr-1" onclick="editarCliente(${i})">📝</button>
          <button class="bg-red-500 text-white px-2 py-1 rounded" onclick="excluirCliente(${i})">🗑</button>
        </td>`;
      listaClientes.appendChild(tr);
    });

    // populate saleCliente select
    const sel = saleCliente;
    if (sel) {
      const prev = sel.value || "";
      sel.innerHTML = `<option value="">-- Consumidor Final --</option>` + carregar(LS.clientes).map(c => `<option value="${escapeHtml(c.nome)}">${escapeHtml(c.nome)}</option>`).join("");
      sel.value = prev;
    }
  }

  window.editarCliente = i => {
    const clientes = carregar(LS.clientes); const c = clientes[i];
    if (!c) return showToast("Cliente não encontrado.","error");
    editandoCliente = i;
    document.getElementById("cliNome").value = c.nome;
    document.getElementById("cliCelular").value = c.celular;
    document.getElementById("cliEmail").value = c.email;
    document.getElementById("cliRG").value = c.rg;
    document.getElementById("cliCPF").value = c.cpf;
    document.getElementById("cliCEP").value = c.cep;
    document.getElementById("cliRua").value = c.rua;
    document.getElementById("cliNumero").value = c.numero;
    document.getElementById("cliBairro").value = c.bairro;
    document.getElementById("cliCidade").value = c.cidade;
    document.getElementById("cliEstado").value = c.estado;
    document.getElementById("cliComplemento").value = c.complemento;
    document.getElementById("cliReferencia").value = c.referencia;
    showToast("Modo edição ativado para cliente.", "info");
  };

  window.excluirCliente = i => {
    const clientes = carregar(LS.clientes);
    if (!confirm(`Excluir ${clientes[i].nome}?`)) return;
    clientes.splice(i,1); salvar(LS.clientes, clientes);
    atualizarListaClientes(); atualizarDashboard(); showToast("Cliente excluído.", "success");
  };

  if (buscarCliente) buscarCliente.addEventListener("input", atualizarListaClientes);

  // ---------- CATEGORIES ----------
  function addCategoriaIfNew(name) {
    if (!name) return;
    const cats = carregar(LS.categorias);
    const exists = cats.some(c => c.toLowerCase() === name.toLowerCase());
    if (!exists) { cats.push(name); salvar(LS.categorias, cats); atualizarCategorias(); }
  }
  function atualizarCategorias() {
    const cats = carregar(LS.categorias);
    if (!datalistCategorias) return;
    datalistCategorias.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join('');
  }

  // ---------- PRODUTOS ----------
  if (formProduto) {
    formProduto.addEventListener("submit", e => {
      e.preventDefault();
      const nome = document.getElementById("prodNome").value.trim();
      const categoria = document.getElementById("prodCategoria").value.trim();
      const quantidadeMediaRaw = document.getElementById("prodQuantidadeMedia").value.trim();
      const unidade = document.getElementById("prodUnidade").value;
      const custoRaw = document.getElementById("prodCusto").value.trim();
      const vendaRaw = document.getElementById("prodVenda").value.trim();
      const obs = document.getElementById("prodObs").value.trim();

      const quantidadeMediaVal = parseFloat(String(quantidadeMediaRaw).replace(",", "."));
      const custoVal = parseMoney(custoRaw);
      const vendaVal = parseMoney(vendaRaw);

      if (!nome) return showToast("Informe o nome do produto.", "warn");
      if (!categoria) return showToast("Informe a categoria.", "warn");
      if (isNaN(quantidadeMediaVal) || quantidadeMediaVal <= 0) return showToast("Quantidade média inválida.", "warn");
      if (!unidade) return showToast("Selecione a unidade.", "warn");
      if (isNaN(custoVal) || custoVal <= 0) return showToast("Preço de custo inválido.", "warn");
      if (isNaN(vendaVal) || vendaVal <= 0) return showToast("Preço de venda inválido.", "warn");
      if (vendaVal <= custoVal) return showToast("Preço de venda deve ser maior que custo.", "warn");

      const lucroPerc = (((vendaVal - custoVal) / custoVal) * 100);
      const lucroText = `${Number(lucroPerc.toFixed(1))}%`;

      const produtos = carregar(LS.produtos);
      let quantidadeAtual = 0;
      if (editandoProduto !== null) { quantidadeAtual = produtos[editandoProduto].quantidade || 0; }

      const produtoObj = {
        nome, categoria, quantidadeMedia: quantidadeMediaVal.toFixed(3), unidade,
        custo: formatMoney(custoVal), venda: formatMoney(vendaVal), lucro: lucroText, obs,
        quantidade: quantidadeAtual
      };

      if (editandoProduto !== null) { produtos[editandoProduto] = produtoObj; editandoProduto = null; showToast("Produto atualizado.", "success"); }
      else { produtos.push(produtoObj); showToast("Produto salvo.", "success"); }
      salvar(LS.produtos, produtos);
      addCategoriaIfNew(categoria);

      formProduto.reset();
      atualizarListaProdutos();
      recomputeEstoqueFromMovs();
      atualizarEstoqueUI();
      atualizarDashboard();
    });
  }

  function atualizarListaProdutos() {
    if (!listaProdutos) return;
    const termo = (buscarProduto?.value || "").toLowerCase();
    const produtos = carregar(LS.produtos);
    listaProdutos.innerHTML = "";
    produtos.filter(p => p.nome.toLowerCase().includes(termo)).forEach((p,i) => {
      const tr = document.createElement("tr"); tr.className="border-b";
      tr.innerHTML = `
        <td class="p-2">${escapeHtml(p.nome)}</td>
        <td class="p-2">${escapeHtml(p.categoria)}</td>
        <td class="p-2">${Number(p.quantidadeMedia).toFixed(3)} ${escapeHtml(p.unidade)}</td>
        <td class="p-2">${escapeHtml(p.custo)}</td>
        <td class="p-2">${escapeHtml(p.venda)}</td>
        <td class="p-2 font-semibold">${escapeHtml(p.lucro)}</td>
        <td class="p-2">${Number(p.quantidade||0)}</td>
        <td class="p-2 text-center">
          <button class="bg-blue-500 text-white px-2 py-1 rounded mr-1" onclick="editarProduto(${i})">📝</button>
          <button class="bg-red-500 text-white px-2 py-1 rounded" onclick="excluirProduto(${i})">🗑</button>
        </td>`;
      listaProdutos.appendChild(tr);
    });

    // populate sale product select
    const sel = saleProduto;
    if (sel) {
      const prev = sel.value || "";
      sel.innerHTML = carregar(LS.produtos).map(p => `<option value="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</option>`).join("");
      sel.value = prev;
      // also update salePreco and lote when product changes
      preencherSaleProdutoDependencias();
    }
  }

  window.editarProduto = i => {
    const produtos = carregar(LS.produtos); const p = produtos[i];
    if (!p) return showToast("Produto não encontrado.","error");
    editandoProduto = i;
    document.getElementById("prodNome").value = p.nome;
    document.getElementById("prodCategoria").value = p.categoria;
    document.getElementById("prodQuantidadeMedia").value = p.quantidadeMedia;
    document.getElementById("prodUnidade").value = p.unidade;
    document.getElementById("prodCusto").value = p.custo;
    document.getElementById("prodVenda").value = p.venda;
    document.getElementById("prodObs").value = p.obs;
    showToast("Modo edição ativado para produto.", "info");
  };

  window.excluirProduto = i => {
    const produtos = carregar(LS.produtos);
    if (!confirm(`Excluir ${produtos[i].nome}?`)) return;
    produtos.splice(i,1); salvar(LS.produtos, produtos);
    showToast("Produto excluído.", "success");
    atualizarListaProdutos(); recomputeEstoqueFromMovs(); atualizarEstoqueUI(); atualizarDashboard();
  };

  if (buscarProduto) buscarProduto.addEventListener("input", atualizarListaProdutos);

  // ---------- MOVIMENTAÇÕES / LOTES / FIFO ----------
  // recompute stock by aggregating movimentacoes (newest-first in storage)
  function recomputeEstoqueFromMovs() {
    const movs = carregar(LS.movimentacoes);
    const produtos = carregar(LS.produtos);
    const map = {};
    produtos.forEach(p => map[p.nome] = 0);
    movs.forEach(m => {
      if (!(m.produto in map)) map[m.produto] = 0;
      if (m.tipo === 'entrada') map[m.produto] += Number(m.quantidade || 0);
      else map[m.produto] -= Number(m.quantidade || 0);
    });
    const estoque = [];
    produtos.forEach(p => {
      const q = map[p.nome] || 0;
      p.quantidade = q;
      estoque.push({ produto: p.nome, quantidade: q });
    });
    salvar(LS.produtos, produtos);
    salvar('estoque', estoque);
    return { map, estoque };
  }

  // returns object: product -> { lote: qtyRemaining }
  function obterLotesPorProduto() {
    const movs = carregar(LS.movimentacoes);
    const byProd = {};
    // accumulate entradas
    movs.slice().reverse().forEach(m => { // chronological old->new
      if (!byProd[m.produto]) byProd[m.produto] = {};
      if (m.tipo === 'entrada') {
        const lote = m.lote || 'SEM_LOTE';
        byProd[m.produto][lote] = (byProd[m.produto][lote] || 0) + Number(m.quantidade || 0);
      }
    });
    // subtract saídas that have lote assigned
    movs.forEach(m => {
      if (m.tipo === 'saida' && m.lote) {
        if (!byProd[m.produto]) byProd[m.produto] = {};
        byProd[m.produto][m.lote] = (byProd[m.produto][m.lote] || 0) - Number(m.quantidade || 0);
      }
    });
    // normalize small negatives to zero
    Object.keys(byProd).forEach(prod => {
      Object.keys(byProd[prod]).forEach(l => {
        byProd[prod][l] = Number(Number(byProd[prod][l]).toFixed(3));
        if (Math.abs(byProd[prod][l]) < 1e-9) byProd[prod][l] = 0;
      });
    });
    return byProd;
  }

  // build FIFO queue for product (oldest entrada first) with available amounts after prior saídas
  function obterFilaLotes(productName) {
    const movsChron = carregar(LS.movimentacoes).slice().reverse(); // oldest-first
    const fila = [];
    movsChron.forEach(m => {
      if (m.produto !== productName) return;
      if (m.tipo === 'entrada') fila.push({ lote: m.lote || 'SEM_LOTE', quantidade: Number(m.quantidade || 0), data: m.data });
    });
    // subtract consumption by saída (with lote) so fila is accurate
    const consumed = {};
    carregar(LS.movimentacoes).forEach(m => {
      if (m.produto !== productName) return;
      if (m.tipo === 'saida' && m.lote) consumed[m.lote] = (consumed[m.lote] || 0) + Number(m.quantidade || 0);
    });
    const result = [];
    fila.forEach(item => {
      const c = consumed[item.lote] || 0;
      const remain = Math.max(0, item.quantidade - c);
      // reduce consumed map accordingly
      if (c > 0) consumed[item.lote] = Math.max(0, c - item.quantidade);
      if (remain > 0) result.push({ lote: item.lote, quantidade: Number(remain.toFixed(3)), data: item.data });
    });
    return result;
  }

  // atualizar Estoque UI
  function atualizarEstoqueUI() {
    const { estoque } = recomputeEstoqueFromMovs();
    const produtos = carregar(LS.produtos);
    tabelaEstoque.innerHTML = "";
    let totalItens = 0;
    let valorTotal = 0;
    const lots = obterLotesPorProduto();

    estoque.forEach(e => {
      const prod = produtos.find(p => p.nome === e.produto);
      const custoVal = prod ? parseMoney(prod.custo) : 0;
      const valor = custoVal * Number(e.quantidade || 0);
      totalItens += Number(e.quantidade || 0);
      valorTotal += valor;
      const lotsObj = lots[e.produto] || {};
      const lotsText = Object.keys(lotsObj).length ? Object.keys(lotsObj).map(l => `${l}: ${Number(lotsObj[l]).toFixed(3)}`).join(" | ") : "";
      const tr = document.createElement("tr"); tr.className="border-b";
      tr.innerHTML = `
        <td class="p-2">${escapeHtml(e.produto)}</td>
        <td class="p-2">${escapeHtml(prod ? prod.categoria : "")}</td>
        <td class="p-2">${Number(e.quantidade||0)}</td>
        <td class="p-2">${escapeHtml(prod ? prod.unidade : "")}</td>
        <td class="p-2">${formatMoney(custoVal)}</td>
        <td class="p-2">${formatMoney(valor)}</td>
        <td class="p-2">${escapeHtml(lotsText)}</td>
        <td class="p-2 text-center">
          <button class="bg-green-500 text-white px-2 py-1 rounded mr-1" onclick="abrirModalMovFromEstoque('${escapeHtml(e.produto)}','entrada')">➕ Entrada</button>
          <button class="bg-orange-500 text-white px-2 py-1 rounded" onclick="abrirModalMovFromEstoque('${escapeHtml(e.produto)}','saida')">➖ Saída</button>
        </td>`;
      tabelaEstoque.appendChild(tr);
    });

    txtTotalItens && (txtTotalItens.innerText = totalItens);
    txtValorTotalEstoque && (txtValorTotalEstoque.innerText = formatMoney(valorTotal));
    dashValorEstoque && (dashValorEstoque.innerText = formatMoney(valorTotal));
    atualizarMovsTable();
  }

  window.abrirModalMovFromEstoque = function(prodEsc, tipo) {
    // open PDV modal prefilled — reuse sale modal for quick adjustments
    // set saleProduto, quantity default, lote selection etc.
    if (saleProduto) {
      saleProduto.value = prodEsc;
      preencherSaleProdutoDependencias();
      movTipo = tipo;
    }
    // show vendas section
    document.querySelectorAll(".content-section").forEach(s => s.classList.add("hidden"));
    document.getElementById("vendas").classList.remove("hidden");
    menuButtons.forEach(b => b.classList.remove("bg-yellow-400"));
    document.querySelector('[data-section="vendas"]').classList.add("bg-yellow-400");
    showToast("Preencha quantidade e clique em Adicionar Item.", "info");
  };

  function atualizarMovsTable() {
    const movs = carregar(LS.movimentacoes);
    tabelaMovs.innerHTML = "";
    movs.forEach(m => {
      const tr = document.createElement("tr"); tr.className="border-b";
      tr.innerHTML = `
        <td class="p-2">${escapeHtml(m.data)}</td>
        <td class="p-2">${escapeHtml(m.produto)}</td>
        <td class="p-2">${escapeHtml(m.tipo)}</td>
        <td class="p-2">${Number(m.quantidade)}</td>
        <td class="p-2">${escapeHtml(m.unidade || "")}</td>
        <td class="p-2">${escapeHtml(m.lote || "")}</td>
        <td class="p-2">${escapeHtml(m.obs || "")}</td>`;
      tabelaMovs.appendChild(tr);
    });
  }

  // ---------- VENDAS (PDV) ----------
  // helper: fill sale product dependent fields (price + lote options)
  function preencherSaleProdutoDependencias() {
    const prodName = saleProduto?.value;
    const produtos = carregar(LS.produtos);
    const p = produtos.find(x => x.nome === prodName);
    if (p) {
      salePreco.value = p.venda || "";
      // populate saleLote with available lots (with positive qty)
      const fila = obterFilaLotes(prodName); // oldest-first available
      if (saleLote) {
        const prev = saleLote.value || "";
        saleLote.innerHTML = fila.length ? fila.map(f => `<option value="${escapeHtml(f.lote)}">${escapeHtml(f.lote)} — ${Number(f.quantidade).toFixed(3)}</option>`).join("") : `<option value="">-- Sem lotes com saldo --</option>`;
        saleLote.value = prev || (fila[0] ? fila[0].lote : "");
      }
    } else {
      salePreco.value = "";
      saleLote && (saleLote.innerHTML = `<option value="">-- Sem produto --</option>`);
    }
  }

  if (saleProduto) saleProduto.addEventListener("change", preencherSaleProdutoDependencias);

  // add item to vendaItensTemp
  if (btnAddItem) {
    btnAddItem.addEventListener("click", e => {
      e.preventDefault();
      const prodName = saleProduto.value;
      const qtd = Number(saleQuantidade.value);
      const lote = saleLote.value || undefined;
      const preco = parseMoney(salePreco.value) || 0;
      if (!prodName) return showToast("Selecione um produto.", "warn");
      if (!qtd || qtd <= 0) return showToast("Quantidade inválida.", "warn");
      // check available qty in selected lote (if provided) and total product stock
      const filas = obterFilaLotes(prodName);
      let availableInLote = null;
      if (lote) {
        const f = filas.find(x => x.lote === lote);
        availableInLote = f ? Number(f.quantidade) : 0;
        if (availableInLote < qtd) {
          return showToast(`Saldo insuficiente no lote ${lote} (${availableInLote.toFixed(3)} disponível).`, "warn");
        }
      } else {
        // if no lote selected, ensure total stock >= qtd
        const produtos = carregar(LS.produtos);
        const p = produtos.find(x => x.nome === prodName);
        if (!p || Number(p.quantidade || 0) < qtd) {
          return showToast("Estoque insuficiente.", "warn");
        }
      }

      // compute lucro per unit: venda - custo
      const produtos = carregar(LS.produtos);
      const p = produtos.find(x => x.nome === prodName);
      const custo = parseMoney(p.custo || "R$ 0,00");
      const lucroUnit = preco - custo;
      const item = { produto: prodName, lote, quantidade: qtd, unidade: p.unidade || "", preco, total: Number((preco * qtd).toFixed(2)), lucroUnit: Number(lucroUnit.toFixed(2)), lucroTotal: Number((lucroUnit * qtd).toFixed(2)) };
      vendaItensTemp.push(item);
      showToast("Item adicionado.", "success");
      atualizarTabelaItensVenda();
      // reset qty for quick next
      saleQuantidade.value = 1;
      preencherSaleProdutoDependencias();
    });
  }

  function atualizarTabelaItensVenda() {
    saleItens.innerHTML = "";
    let subtotal = 0;
    let lucroTotal = 0;
    vendaItensTemp.forEach((it, idx) => {
      subtotal += Number(it.total || 0);
      lucroTotal += Number(it.lucroTotal || 0);
      const tr = document.createElement("tr"); tr.className="border-b";
      tr.innerHTML = `
        <td class="p-2">${escapeHtml(it.produto)}</td>
        <td class="p-2">${escapeHtml(it.lote||"")}</td>
        <td class="p-2">${Number(it.quantidade)}</td>
        <td class="p-2">${escapeHtml(it.unidade)}</td>
        <td class="p-2">${formatMoney(it.preco)}</td>
        <td class="p-2">${formatMoney(it.total)}</td>
        <td class="p-2">${formatMoney(it.lucroTotal)}</td>
        <td class="p-2 text-center">
          <button class="bg-red-500 text-white px-2 py-1 rounded" onclick="removerItemVenda(${idx})">Remover</button>
        </td>`;
      saleItens.appendChild(tr);
    });
    const descontoPct = Number(saleDesconto.value) || 0;
    const descontoValor = subtotal * (descontoPct / 100);
    const total = subtotal - descontoValor;
    saleSubtotal.innerText = formatMoney(subtotal);
    saleDescontoValor.innerText = formatMoney(descontoValor);
    saleTotal.innerText = formatMoney(total);
  }

  window.removerItemVenda = function(idx) {
    vendaItensTemp.splice(idx,1);
    atualizarTabelaItensVenda();
    showToast("Item removido.", "info");
  };

  // cancel sale
  if (btnCancelarVenda) btnCancelarVenda.addEventListener("click", () => {
    if (!vendaItensTemp.length) { showToast("Nenhum item para cancelar.", "info"); return; }
    if (!confirm("Cancelar venda atual e remover itens?")) return;
    vendaItensTemp = []; atualizarTabelaItensVenda(); showToast("Venda cancelada.", "success");
  });

  // finalize sale: create venda record + apply stock FIFO (generate saídas per lote) + save movimentacoes
  if (btnFinalizarVenda) btnFinalizarVenda.addEventListener("click", () => {
    if (!vendaItensTemp.length) return showToast("Adicione ao menos 1 item.", "warn");
    const clienteNome = saleCliente.value || "Consumidor Final";
    const descontoPct = Number(saleDesconto.value) || 0;
    // compute subtotal and totals
    let subtotal = 0, lucroTotal = 0;
    vendaItensTemp.forEach(it => { subtotal += Number(it.total); lucroTotal += Number(it.lucroTotal); });
    const descontoValor = subtotal * (descontoPct / 100);
    const total = Number((subtotal - descontoValor).toFixed(2));

    // create venda id
    const vendas = carregar(LS.vendas);
    const nextId = (vendas.length ? Math.max(...vendas.map(v => v.id)) + 1 : 1);
    const codigo = `VEN-${uidPad(nextId,4)}`;

    // For each item, create saída movimentacoes using FIFO algorithm:
    // If item.lote provided, consume from that lote only.
    // If no lote provided, consume from FIFO available lots.
    const movs = carregar(LS.movimentacoes); // newest-first
    // We'll produce newSaidas array (to unshift into movs)
    const newSaidas = [];

    vendaItensTemp.forEach(it => {
      let remaining = Number(it.quantidade);
      if (it.lote) {
        // consume from that lote
        newSaidas.push({ data: new Date().toISOString().slice(0,10), produto: it.produto, tipo: 'saida', quantidade: Number(it.quantidade), unidade: it.unidade, lote: it.lote, obs: `Venda ${codigo}` });
        remaining = 0;
      } else {
        // consume FIFO from available entries
        const fila = obterFilaLotes(it.produto); // oldest-first available
        for (let i=0; i < fila.length && remaining > 0; i++) {
          const entry = fila[i];
          const take = Math.min(remaining, entry.quantidade);
          newSaidas.push({ data: new Date().toISOString().slice(0,10), produto: it.produto, tipo: 'saida', quantidade: take, unidade: it.unidade, lote: entry.lote, obs: `Venda ${codigo}` });
          remaining -= take;
        }
        if (remaining > 0) {
          // not enough — ask user to allow negative (will create a NEGATIVO lote)
          if (!confirm(`Estoque insuficiente para ${it.produto}. Permitir saldo negativo e registrar restante?`)) {
            showToast("Finalização abortada.", "info");
            return;
          } else {
            newSaidas.push({ data: new Date().toISOString().slice(0,10), produto: it.produto, tipo: 'saida', quantidade: remaining, unidade: it.unidade, lote: 'NEGATIVO', obs: `Venda ${codigo} (saldo negativo)` });
            remaining = 0;
          }
        }
      }
    });

    // If user aborted during negative prompt, we should detect that — but above returns only inside handler; proceed.
    // Prepend newSaidas to movs (unshift in order so newest-first)
    newSaidas.forEach(s => movs.unshift(s));
    salvar(LS.movimentacoes, movs);
    salvarTimestampNow();

    // save venda record
    const vendaRecord = {
      id: nextId,
      codigo,
      cliente: clienteNome,
      data: new Date().toISOString(),
      descontoPct,
      subtotal: Number(subtotal.toFixed(2)),
      descontoValor: Number(descontoValor.toFixed(2)),
      total,
      lucroTotal: Number(lucroTotal.toFixed(2)),
      itens: vendaItensTemp.map(it => ({ produto: it.produto, lote: it.lote || null, quantidade: it.quantidade, unidade: it.unidade, preco: it.preco, total: it.total, lucro: it.lucroTotal }))
    };
    vendas.push(vendaRecord);
    salvar(LS.vendas, vendas);

    // clear temp items and update UI
    vendaItensTemp = [];
    atualizarTabelaItensVenda();
    recomputeEstoqueFromMovs();
    atualizarEstoqueUI();
    atualizarListaProdutos();
    atualizarVendasLista();
    atualizarDashboard();
    showToast(`Venda ${codigo} finalizada.`, "success");
  });

  // listar vendas
  function atualizarVendasLista() {
    const vendas = carregar(LS.vendas);
    listaVendas.innerHTML = "";
    vendas.slice().reverse().forEach(v => { // newest first for display
      const tr = document.createElement("tr"); tr.className="border-b";
      tr.innerHTML = `
        <td class="p-2">${new Date(v.data).toLocaleString()}</td>
        <td class="p-2">${escapeHtml(v.codigo)}</td>
        <td class="p-2">${escapeHtml(v.cliente)}</td>
        <td class="p-2">${v.itens.length}</td>
        <td class="p-2">${formatMoney(v.total)}</td>
        <td class="p-2">${formatMoney(v.lucroTotal)}</td>
        <td class="p-2">
          <button class="bg-blue-500 text-white px-2 py-1 rounded mr-2" onclick="detalharVenda(${v.id})">Detalhar</button>
          <button class="bg-red-500 text-white px-2 py-1 rounded" onclick="excluirVenda(${v.id})">Excluir</button>
        </td>`;
      listaVendas.appendChild(tr);
    });
  }

  window.detalharVenda = function(id) {
    const vendas = carregar(LS.vendas);
    const v = vendas.find(x => x.id === id);
    if (!v) return showToast("Venda não encontrada.", "error");
    modalVendaTitle.innerText = `Venda ${v.codigo} — ${new Date(v.data).toLocaleString()}`;
    modalVendaBody.innerHTML = `
      <p><strong>Cliente:</strong> ${escapeHtml(v.cliente)}</p>
      <p><strong>Total:</strong> ${formatMoney(v.total)} — Desconto: ${formatMoney(v.descontoValor)}</p>
      <div class="mt-3">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-100"><tr><th class="p-2">Produto</th><th class="p-2">Lote</th><th class="p-2">Qtd</th><th class="p-2">Preço</th><th class="p-2">Total</th></tr></thead>
          <tbody>${v.itens.map(it => `<tr class="border-b"><td class="p-2">${escapeHtml(it.produto)}</td><td class="p-2">${escapeHtml(it.lote||"")}</td><td class="p-2">${it.quantidade}</td><td class="p-2">${formatMoney(it.preco)}</td><td class="p-2">${formatMoney(it.total)}</td></tr>`).join("")}</tbody>
        </table>
      </div>`;
    modalVendaDetalhe.classList.remove("hidden"); modalVendaDetalhe.style.display = "flex";
  };

  window.fecharModalVenda = function() { modalVendaDetalhe.classList.add("hidden"); modalVendaDetalhe.style.display = "none"; };

  window.excluirVenda = function(id) {
    if (!confirm("Excluir venda e NÃO reverter movimentações? (ATENÇÃO: não reverte estoques)")) return;
    const vendas = carregar(LS.vendas);
    const idx = vendas.findIndex(v => v.id === id);
    if (idx === -1) return showToast("Venda não encontrada.", "error");
    vendas.splice(idx,1); salvar(LS.vendas, vendas);
    atualizarVendasLista(); showToast("Venda excluída.", "success");
    // NOTE: we intentionally do not revert movimentacoes automatically
  };

  // ---------- EXPORT ----------
  window.exportarTabela = function(tipo, formato) {
    let dados = [];
    if (tipo === 'estoque') {
      const { estoque } = recomputeEstoqueFromMovs();
      const produtos = carregar(LS.produtos);
      const lots = obterLotesPorProduto();
      dados = estoque.map(e => {
        const p = produtos.find(x => x.nome === e.produto) || {};
        const custoVal = parseMoney(p.custo || "R$ 0,00");
        const lotesObj = lots[e.produto] || {};
        const lotesStr = Object.keys(lotesObj).map(l => `${l}: ${Number(lotesObj[l]).toFixed(3)}`).join(" | ");
        return { produto: e.produto, categoria: p.categoria||"", quantidade_total: e.quantidade, unidade: p.unidade||"", custo_unitario: formatMoney(custoVal), valor_total: formatMoney(custoVal * Number(e.quantidade||0)), lotes: lotesStr };
      });
    } else if (tipo === 'movimentacoes') {
      dados = carregar(LS.movimentacoes);
    } else if (tipo === 'vendas') {
      dados = carregar(LS.vendas);
    } else {
      dados = carregar(tipo);
    }

    if (!dados || !dados.length) { showToast("Nada para exportar.", "warn"); return; }

    if (formato === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(dados);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, tipo);
      XLSX.writeFile(wb, `${tipo}.xlsx`);
      showToast("Exportado .xlsx", "success");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    const cols = Object.keys(dados[0]);
    const body = dados.map(d => cols.map(c => d[c] !== undefined ? String(d[c]) : ""));
    doc.text(`Relatório - ${tipo}`, 14, 15);
    doc.autoTable({ head: [cols], body, startY: 20 });
    doc.save(`${tipo}.pdf`);
    showToast("Exportado PDF", "success");
  };

  // ---------- DASHBOARD ----------
  function atualizarDashboard() {
    const clientes = carregar(LS.clientes);
    const produtos = carregar(LS.produtos);
    dashClientes && (dashClientes.innerText = clientes.length);
    dashProdutos && (dashProdutos.innerText = produtos.length);

    const resultado = recomputeEstoqueFromMovs();
    const estoque = resultado.estoque;
    let valorTotal = 0;
    let lucroTotal = 0;
    let pesoLucro = 0;
    estoque.forEach(e => {
      const p = produtos.find(x => x.nome === e.produto);
      const custoVal = p ? parseMoney(p.custo) : 0;
      const vendaVal = p ? parseMoney(p.venda) : 0;
      const qtd = Number(e.quantidade || 0);
      valorTotal += custoVal * qtd;
      lucroTotal += (vendaVal - custoVal) * qtd;
      pesoLucro += custoVal * qtd;
    });

    const lucroPctMedio = pesoLucro ? (lucroTotal / pesoLucro) * 100 : 0;
    dashValorEstoque && (dashValorEstoque.innerText = formatMoney(valorTotal));
    dashLucroReal && (dashLucroReal.innerText = formatMoney(lucroTotal));
    dashLucroPct && (dashLucroPct.innerText = `Lucro médio: ${Number(lucroPctMedio.toFixed(1))}%`);
    const lastISO = localStorage.getItem(LS.lastUpdate);
    dashUltAtual && (dashUltAtual.innerText = lastISO ? `Última atual.: ${new Date(lastISO).toLocaleString()}` : "Última atual.: —");
  }

  // ---------- UTIL ----------
  // ensure keys exist
  if (!localStorage.getItem(LS.clientes)) salvar(LS.clientes, []);
  if (!localStorage.getItem(LS.produtos)) salvar(LS.produtos, []);
  if (!localStorage.getItem(LS.categorias)) salvar(LS.categorias, []);
  if (!localStorage.getItem(LS.movimentacoes)) salvar(LS.movimentacoes, []);
  if (!localStorage.getItem(LS.vendas)) salvar(LS.vendas, []);

  // ----------
  // INITIALIZE / BIND UI
  // ----------
  atualizarCategorias();
  atualizarListaClientes();
  atualizarListaProdutos();
  recomputeEstoqueFromMovs();
  atualizarEstoqueUI();
  atualizarVendasLista();
  atualizarDashboard();
  atualizarMovsTable();

  // navigation default to dashboard
  menuButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const sec = btn.dataset.section;
      sections.forEach(s => s.classList.add("hidden"));
      const target = document.getElementById(sec);
      if (target) target.classList.remove("hidden");
      menuButtons.forEach(b => b.classList.remove("bg-yellow-400"));
      btn.classList.add("bg-yellow-400");
      // refresh dependent UIs
      atualizarDashboard();
      atualizarListaProdutos();
      atualizarListaClientes();
      atualizarVendasLista();
    });
  });

  // fill sale selects initially
  preencherSaleProdutoDependencias();
  atualizarListaClientes();

  // expose some functions to global for HTML buttons
  window.atualizarListaProdutos = atualizarListaProdutos;
  window.atualizarListaClientes = atualizarListaClientes;
  window.atualizarEstoqueUI = atualizarEstoqueUI;
  window.atualizarMovsTable = atualizarMovsTable;
  window.atualizarCategorias = atualizarCategorias;
  window.abrirModalMovFromEstoque = abrirModalMovFromEstoque;
  window.exportarTabela = exportarTabela;
  window.detalharVenda = window.detalharVenda;
  window.excluirVenda = window.excluirVenda;
  window.removerItemVenda = window.removerItemVenda;
  window.editarCliente = window.editarCliente;
  window.excluirCliente = window.excluirCliente;
  window.editarProduto = window.editarProduto;
  window.excluirProduto = window.excluirProduto;
  window.fecharModalVenda = window.fecharModalVenda;

});
