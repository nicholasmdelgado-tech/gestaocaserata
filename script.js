// ===========================
// GESTÃO DE QUEIJARIA - SCRIPT PRINCIPAL
// ===========================

// ===========================
// ESTRUTURA BASE E NAVEGAÇÃO
// ===========================
document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(".content-section");
  const menuButtons = document.querySelectorAll(".menu-item");

  menuButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      sections.forEach(sec => sec.classList.add("hidden"));
      document.getElementById(target).classList.remove("hidden");
    });
  });

  atualizarDashboard();
  carregarProdutosSelect();
  carregarTabelas();
});

// ===========================
// UTILITÁRIOS GERAIS
// ===========================
function salvarLocal(nome, dados) {
  localStorage.setItem(nome, JSON.stringify(dados));
}

function lerLocal(nome) {
  return JSON.parse(localStorage.getItem(nome) || "[]");
}

function gerarId(prefixo) {
  return `${prefixo}-${Date.now()}`;
}

function toast(msg, tipo = "info") {
  const cor = tipo === "erro" ? "bg-red-600" : tipo === "sucesso" ? "bg-green-600" : "bg-blue-600";
  const div = document.createElement("div");
  div.className = `${cor} text-white px-4 py-2 rounded shadow-lg fixed bottom-4 right-4 z-50 animate-fade-in`;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// ===========================
// CLIENTES
// ===========================
function cadastrarCliente(cliente) {
  let clientes = lerLocal("clientes");
  const existe = clientes.find(c => c.cpf === cliente.cpf || c.celular === cliente.celular);
  if (existe) return toast("Cliente com CPF ou celular já cadastrado!", "erro");
  clientes.push(cliente);
  salvarLocal("clientes", clientes);
  toast("Cliente cadastrado com sucesso!", "sucesso");
  atualizarDashboard();
}

// ===========================
// PRODUTOS
// ===========================
function cadastrarProduto(produto) {
  let produtos = lerLocal("produtos");
  produtos.push(produto);
  salvarLocal("produtos", produtos);
  carregarProdutosSelect();
  toast("Produto cadastrado!", "sucesso");
  atualizarDashboard();
}

// ===========================
// ESTOQUE
// ===========================
document.addEventListener("DOMContentLoaded", () => {
  const btnEntrada = document.getElementById("btnEntrada");
  const btnSaida = document.getElementById("btnSaida");

  if (btnEntrada)
    btnEntrada.addEventListener("click", e => {
      e.preventDefault();
      registrarMovimentoEstoque("entrada");
    });

  if (btnSaida)
    btnSaida.addEventListener("click", e => {
      e.preventDefault();
      registrarMovimentoEstoque("saida");
    });
});

function registrarMovimentoEstoque(tipo) {
  const produtoSelect = document.getElementById("estoqueProduto");
  const lote = document.getElementById("estoqueLote").value.trim();
  const qtd = parseFloat(document.getElementById("estoqueQtd").value);

  if (!produtoSelect.value || !lote || isNaN(qtd) || qtd <= 0) {
    toast("Preencha todos os campos corretamente!", "erro");
    return;
  }

  let estoque = lerLocal("estoque");
  const produto = produtoSelect.value;

  let registro = estoque.find(e => e.produto === produto && e.lote === lote);

  if (!registro) {
    registro = { produto, lote, quantidade: 0, data: new Date().toLocaleString() };
    estoque.push(registro);
  }

  if (tipo === "entrada") registro.quantidade += qtd;
  else if (tipo === "saida") registro.quantidade -= qtd;

  if (registro.quantidade < 0) registro.quantidade = 0;
  registro.data = new Date().toLocaleString();

  salvarLocal("estoque", estoque);
  carregarTabelas();
  toast(`Movimentação de ${tipo} registrada com sucesso!`, "sucesso");
}

// ===========================
// VENDAS
// ===========================
function registrarVenda(venda) {
  let vendas = lerLocal("vendas");
  vendas.push(venda);
  salvarLocal("vendas", vendas);
  atualizarDashboard();
  toast("Venda registrada com sucesso!", "sucesso");
}

// ===========================
// TABELAS E DASHBOARD
// ===========================
function carregarProdutosSelect() {
  const select = document.getElementById("estoqueProduto");
  if (!select) return;
  const produtos = lerLocal("produtos");
  select.innerHTML = produtos.map(p => `<option value="${p.nome}">${p.nome}</option>`).join("");
}

function carregarTabelas() {
  const estoqueDiv = document.getElementById("estoqueTable");
  const estoque = lerLocal("estoque");

  if (estoqueDiv) {
    if (estoque.length === 0) {
      estoqueDiv.innerHTML = "<p class='text-gray-600'>Nenhum registro de estoque ainda.</p>";
      return;
    }

    let html = `
      <table class="min-w-full bg-white border border-gray-200 rounded shadow">
        <thead class="bg-green-600 text-white">
          <tr>
            <th class="px-4 py-2 text-left">Produto</th>
            <th class="px-4 py-2 text-left">Lote</th>
            <th class="px-4 py-2 text-right">Quantidade</th>
            <th class="px-4 py-2 text-right">Última Movimentação</th>
          </tr>
        </thead>
        <tbody>
    `;

    let total = 0;
    estoque.forEach(item => {
      total += item.quantidade;
      html += `
        <tr class="border-b">
          <td class="px-4 py-2">${item.produto}</td>
          <td class="px-4 py-2">${item.lote}</td>
          <td class="px-4 py-2 text-right">${item.quantidade.toFixed(2)}</td>
          <td class="px-4 py-2 text-right">${item.data}</td>
        </tr>`;
    });

    html += `
        </tbody>
        <tfoot>
          <tr class="font-bold bg-gray-100">
            <td colspan="2" class="px-4 py-2 text-right">Total:</td>
            <td colspan="2" class="px-4 py-2 text-right">${total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    `;
    estoqueDiv.innerHTML = html;
  }

  atualizarDashboard();
}

function atualizarDashboard() {
  const clientes = lerLocal("clientes");
  const produtos = lerLocal("produtos");
  const estoque = lerLocal("estoque");
  const vendas = lerLocal("vendas");

  const cardsDiv = document.getElementById("cardsDashboard");
  if (!cardsDiv) return;

  const totalEstoque = estoque.reduce((acc, e) => acc + e.quantidade, 0);
  const totalVendas = vendas.length;
  const totalClientes = clientes.length;

  cardsDiv.innerHTML = `
    <div class="bg-white p-4 rounded-lg shadow text-center">
      <h3 class="text-gray-600">Clientes</h3>
      <p class="text-2xl font-bold text-green-700">${totalClientes}</p>
    </div>
    <div class="bg-white p-4 rounded-lg shadow text-center">
      <h3 class="text-gray-600">Produtos</h3>
      <p class="text-2xl font-bold text-green-700">${produtos.length}</p>
    </div>
    <div class="bg-white p-4 rounded-lg shadow text-center">
      <h3 class="text-gray-600">Total em Estoque</h3>
      <p class="text-2xl font-bold text-green-700">${totalEstoque.toFixed(2)}</p>
    </div>
    <div class="bg-white p-4 rounded-lg shadow text-center">
      <h3 class="text-gray-600">Vendas</h3>
      <p class="text-2xl font-bold text-green-700">${totalVendas}</p>
    </div>
  `;
}
// ==========================================
// COMPATIBILIDADE: Funções chamadas no HTML
// ==========================================

// Compatibilidade com versões antigas do HTML
function adicionarProduto() {
  const nome = prompt("Nome do produto:");
  if (!nome) return toast("Nome obrigatório", "erro");

  const categoria = prompt("Categoria:");
  const unidade = prompt("Unidade (Kg, L, mL):");
  const pesoMedio = parseFloat(prompt("Peso médio:") || 0);
  const precoCusto = parseFloat(prompt("Preço de custo:") || 0);
  const precoVenda = parseFloat(prompt("Preço de venda:") || 0);

  const produto = {
    id: gerarId("PROD"),
    nome,
    categoria,
    unidade,
    pesoMedio,
    precoCusto,
    precoVenda,
    data: new Date().toLocaleDateString()
  };

  cadastrarProduto(produto);
  carregarTabelas();
  toast("Produto adicionado com sucesso!", "sucesso");
}

// Mesmo para clientes, caso o HTML use esse nome
function adicionarCliente() {
  const nome = prompt("Nome do cliente:");
  const celular = prompt("Celular:");
  const cpf = prompt("CPF:");
  const cliente = { id: gerarId("CLI"), nome, celular, cpf };
  cadastrarCliente(cliente);
  carregarTabelas();
}