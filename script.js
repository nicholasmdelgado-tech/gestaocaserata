// ==============================
// GESTÃO DE QUEIJARIA - SCRIPT
// ==============================

// Utilitários ------------------
function getData(key) {
  return JSON.parse(localStorage.getItem(key) || '[]');
}
function setData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}
function gerarId(prefix) {
  return prefix + '_' + Date.now();
}
function toast(msg, tipo = 'info') {
  alert(msg); // Pode ser substituído futuramente por um componente visual
}

// Inicialização ------------------
const sections = document.querySelectorAll('.content-section');
const menuItems = document.querySelectorAll('.menu-item');
menuItems.forEach(btn => {
  btn.addEventListener('click', () => {
    sections.forEach(sec => sec.classList.add('hidden'));
    document.getElementById(btn.dataset.target).classList.remove('hidden');
  });
});

// ==============================
// CLIENTES
// ==============================
const formClientes = document.getElementById('formClientes');
const clientesTable = document.getElementById('clientesTable');

formClientes.addEventListener('submit', e => {
  e.preventDefault();
  const nome = clienteNome.value.trim();
  const celular = clienteCelular.value.trim();
  const cpf = clienteCPF.value.trim();
  const rg = clienteRG.value.trim();
  const email = clienteEmail.value.trim();
  const cep = clienteCEP.value.trim();
  const endereco = clienteEndereco.value.trim();
  const numero = clienteNumero.value.trim();
  const complemento = clienteComplemento.value.trim();
  const referencia = clienteReferencia.value.trim();

  if (!nome || !celular || !cpf || !cep || !numero) {
    return toast('Preencha todos os campos obrigatórios', 'erro');
  }

  let clientes = getData('clientes');
  if (clientes.some(c => c.celular === celular || c.cpf === cpf)) {
    return toast('Cliente já cadastrado com este celular ou CPF!', 'erro');
  }

  clientes.push({ id: gerarId('CLI'), nome, celular, cpf, rg, email, cep, endereco, numero, complemento, referencia });
  setData('clientes', clientes);
  formClientes.reset();
  renderClientes();
  toast('Cliente salvo com sucesso!', 'sucesso');
});

function renderClientes() {
  const clientes = getData('clientes');
  if (clientes.length === 0) {
    clientesTable.innerHTML = '<p class="text-gray-500">Nenhum cliente cadastrado.</p>';
    return;
  }
  clientesTable.innerHTML = `
    <table class="w-full bg-white rounded shadow">
      <thead><tr class="bg-green-600 text-white"><th class="p-2">Nome</th><th>Celular</th><th>CPF</th><th>E-mail</th></tr></thead>
      <tbody>
        ${clientes.map(c => `<tr class="border-t"><td class="p-2">${c.nome}</td><td>${c.celular}</td><td>${c.cpf}</td><td>${c.email || ''}</td></tr>`).join('')}
      </tbody>
    </table>`;
}

// ==============================
// PRODUTOS
// ==============================
const formProdutos = document.getElementById('formProdutos');
const produtosTable = document.getElementById('produtosTable');

formProdutos.addEventListener('submit', e => {
  e.preventDefault();
  const nome = produtoNome.value.trim();
  const categoria = produtoCategoria.value.trim();
  const unidade = produtoUnidade.value;
  const pesoMedio = parseFloat(produtoPesoMedio.value.replace(',', '.')) || 0;
  const precoCusto = parseFloat(produtoPrecoCusto.value.replace(',', '.')) || 0;
  const precoVenda = parseFloat(produtoPrecoVenda.value.replace(',', '.')) || 0;

  if (!nome || !pesoMedio || !precoCusto || !precoVenda) {
    return toast('Preencha todos os campos obrigatórios', 'erro');
  }

  let produtos = getData('produtos');
  produtos.push({ id: gerarId('PROD'), nome, categoria, unidade, pesoMedio, precoCusto, precoVenda });
  setData('produtos', produtos);
  formProdutos.reset();
  renderProdutos();
  carregarProdutosSelect();
  toast('Produto salvo com sucesso!', 'sucesso');
});

function renderProdutos() {
  const produtos = getData('produtos');
  if (produtos.length === 0) {
    produtosTable.innerHTML = '<p class="text-gray-500">Nenhum produto cadastrado.</p>';
    return;
  }
  produtosTable.innerHTML = `
    <table class="w-full bg-white rounded shadow">
      <thead><tr class="bg-green-600 text-white"><th class="p-2">Nome</th><th>Categoria</th><th>Unidade</th><th>Peso</th><th>Custo</th><th>Venda</th></tr></thead>
      <tbody>
        ${produtos.map(p => `<tr class="border-t"><td class="p-2">${p.nome}</td><td>${p.categoria}</td><td>${p.unidade}</td><td>${p.pesoMedio}</td><td>${p.precoCusto.toFixed(2)}</td><td>${p.precoVenda.toFixed(2)}</td></tr>`).join('')}
      </tbody>
    </table>`;
}

// ==============================
// ESTOQUE
// ==============================
const btnEntrada = document.getElementById('btnEntrada');
const btnSaida = document.getElementById('btnSaida');
const estoqueTable = document.getElementById('estoqueTable');

btnEntrada.addEventListener('click', () => atualizarEstoque('entrada'));
btnSaida.addEventListener('click', () => atualizarEstoque('saida'));

function atualizarEstoque(tipo) {
  const produtoId = estoqueProduto.value;
  const lote = estoqueLote.value.trim();
  const qtd = parseFloat(estoqueQtd.value);
  if (!produtoId || !lote || !qtd) {
    return toast('Preencha todos os campos do estoque!', 'erro');
  }
  let estoque = getData('estoque');
  const item = estoque.find(e => e.produtoId === produtoId && e.lote === lote);
  if (item) {
    item.qtd = tipo === 'entrada' ? item.qtd + qtd : item.qtd - qtd;
  } else {
    estoque.push({ id: gerarId('EST'), produtoId, lote, qtd });
  }
  setData('estoque', estoque);
  renderEstoque();
  toast('Movimentação registrada com sucesso!', 'sucesso');
}

function renderEstoque() {
  const produtos = getData('produtos');
  const estoque = getData('estoque');
  if (estoque.length === 0) {
    estoqueTable.innerHTML = '<p class="text-gray-500">Nenhum registro de estoque.</p>';
    return;
  }
  estoqueTable.innerHTML = `
    <table class="w-full bg-white rounded shadow">
      <thead><tr class="bg-green-600 text-white"><th class="p-2">Produto</th><th>Lote</th><th>Quantidade</th></tr></thead>
      <tbody>
        ${estoque.map(e => {
          const produto = produtos.find(p => p.id === e.produtoId);
          return `<tr class="border-t"><td class="p-2">${produto ? produto.nome : 'Produto removido'}</td><td>${e.lote}</td><td>${e.qtd}</td></tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function carregarProdutosSelect() {
  const produtos = getData('produtos');
  estoqueProduto.innerHTML = produtos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
}

// ==============================
// DASHBOARD
// ==============================
function renderDashboard() {
  const clientes = getData('clientes').length;
  const produtos = getData('produtos').length;
  const estoque = getData('estoque');
  const totalEstoque = estoque.reduce((acc, e) => acc + e.qtd, 0);
  document.getElementById('cardsDashboard').innerHTML = `
    <div class='bg-white p-4 rounded shadow text-center'><h2 class='text-lg font-bold'>Clientes</h2><p class='text-2xl'>${clientes}</p></div>
    <div class='bg-white p-4 rounded shadow text-center'><h2 class='text-lg font-bold'>Produtos</h2><p class='text-2xl'>${produtos}</p></div>
    <div class='bg-white p-4 rounded shadow text-center'><h2 class='text-lg font-bold'>Itens em Estoque</h2><p class='text-2xl'>${totalEstoque}</p></div>`;
}

// ==============================
// INICIALIZAÇÃO AO CARREGAR
// ==============================
document.addEventListener('DOMContentLoaded', () => {
  renderClientes();
  renderProdutos();
  renderEstoque();
  renderDashboard();
  carregarProdutosSelect();

  IMask(document.getElementById('clienteCelular'), { mask: '(00) 00000-0000' });
  IMask(document.getElementById('clienteCPF'), { mask: '000.000.000-00' });
  IMask(document.getElementById('clienteCEP'), { mask: '00000-000' });
});