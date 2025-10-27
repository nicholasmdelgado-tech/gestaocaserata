// script.js — Gestão Queijaria (completo)
// Compatível com index.html fornecido ao usuário
// Recursos:
// - Clientes (CRUD, duplicidade CPF/celular, busca inteligente)
// - Produtos (CRUD, categorias aprendidas)
// - Estoque (entradas por lote, saídas, somatório de lotes)
// - Movimentações (internas), vendas com múltiplos itens, gerar VEN-0001...
// - Reverter venda (ajusta saldo sem criar registro de movimentação)
// - Exportar (XLSX / PDF)
// - Dashboard dinâmico, máscaras IMask, toasts

(function(){
  'use strict';

  // ---------- Keys e inicialização ----------
  const LS = {
    clientes: 'gq_clientes',
    produtos: 'gq_produtos',
    movimentacoes: 'gq_movimentacoes', // entradas/saídas (para histórico e cálculo de lotes)
    vendas: 'gq_vendas',
    categorias: 'gq_categorias',
    lastUpdate: 'gq_lastUpdate'
  };

  if (!localStorage.getItem(LS.clientes)) localStorage.setItem(LS.clientes, JSON.stringify([]));
  if (!localStorage.getItem(LS.produtos)) localStorage.setItem(LS.produtos, JSON.stringify([]));
  if (!localStorage.getItem(LS.movimentacoes)) localStorage.setItem(LS.movimentacoes, JSON.stringify([]));
  if (!localStorage.getItem(LS.vendas)) localStorage.setItem(LS.vendas, JSON.stringify([]));
  if (!localStorage.getItem(LS.categorias)) localStorage.setItem(LS.categorias, JSON.stringify([]));

  // ---------- Helpers ----------
  function carregar(key){ return JSON.parse(localStorage.getItem(key) || '[]'); }
  function salvar(key, data){ localStorage.setItem(key, JSON.stringify(data)); }
  function nowISO(){ return new Date().toISOString(); }
  function salvarTimestamp(){ localStorage.setItem(LS.lastUpdate, new Date().toISOString()); }
  function escapeHtml(s){ if (s===null||s===undefined) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function onlyNumbers(s){ return String(s||'').replace(/\D/g,''); }
  function parseMoneyInput(str){ if (!str && str!==0) return NaN; const s = String(str).replace(/[^0-9,.-]/g,'').replace(',', '.'); return Number(s); }
  function formatMoney(n){ if (isNaN(n)) return 'R$ 0,00'; return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
  function uidPad(n, len=4){ return String(n).padStart(len,'0'); }

  // ---------- Toast ----------
  function showToast(message, type='info', time=3000){
    const container = document.getElementById('toastContainer'); if(!container) return;
    const colors = { info:'bg-blue-500', success:'bg-green-500', error:'bg-red-500', warn:'bg-yellow-500' };
    const el = document.createElement('div'); el.className = `text-white px-4 py-2 rounded shadow ${colors[type]||colors.info} max-w-xs`; el.textContent = message;
    container.appendChild(el);
    setTimeout(()=>{ el.style.opacity=0; setTimeout(()=>el.remove(),250); }, time);
  }

  // ---------- DOM elements (cache) ----------
  const els = {
    // dashboard
    dashClientes: document.getElementById('dashClientes'), dashProdutos: document.getElementById('dashProdutos'), dashValorEstoque: document.getElementById('dashValorEstoque'), dashLucroReal: document.getElementById('dashLucroReal'), dashLucroPct: document.getElementById('dashLucroPct'), dashTotalVendas: document.getElementById('dashTotalVendas'), dashUltAtual: document.getElementById('dashUltAtual'),
    // clientes
    formCliente: document.getElementById('formCliente'), listaClientes: document.getElementById('listaClientes'), buscarClienteSmart: document.getElementById('buscarClienteSmart'),
    // produtos
    formProduto: document.getElementById('formProduto'), listaProdutos: document.getElementById('listaProdutos'), buscarProduto: document.getElementById('buscarProduto'), datalistCategorias: document.getElementById('listaCategorias'),
    // estoque
    formEstoque: document.getElementById('formEstoque'), estProduto: document.getElementById('estProduto'), estLote: document.getElementById('estLote'), estQuantidade: document.getElementById('estQuantidade'), tabelaEstoque: document.getElementById('tabelaEstoque'), btnEntrada: document.getElementById('btnEntrada'), btnSaida: document.getElementById('btnSaida'),
    // vendas
    saleCliente: document.getElementById('saleCliente'), saleProduto: document.getElementById('saleProduto'), saleQuantidade: document.getElementById('saleQuantidade'), saleLote: document.getElementById('saleLote'), salePreco: document.getElementById('salePreco'), saleDesconto: document.getElementById('saleDesconto'), btnAddItem: document.getElementById('btnAddItem'), saleItens: document.getElementById('saleItens'), saleSubtotal: document.getElementById('saleSubtotal'), saleDescontoValor: document.getElementById('saleDescontoValor'), saleTotal: document.getElementById('saleTotal'), btnFinalizarVenda: document.getElementById('btnFinalizarVenda'), btnCancelarVenda: document.getElementById('btnCancelarVenda'), listaVendas: document.getElementById('listaVendas')
  };

  // ---------- IMask setup ----------
  function initMasks(){
    if (!window.IMask) return;
    try{
      IMask(document.getElementById('cliCPF'), { mask:'000.000.000-00' });
      IMask(document.getElementById('cliCelular'), { mask:'(00) 00000-0000' });
      IMask(document.getElementById('cliCEP'), { mask:'00000-000' });
      IMask(document.getElementById('prodQuantidadeMedia'), { mask:Number, scale:3, radix:'.', padFractionalZeros:true, thousandsSeparator:'' });
      IMask(document.getElementById('prodCusto'), { mask:Number, scale:2, radix:',', thousandsSeparator:'.', prefix:'R$ ', padFractionalZeros:true });
      IMask(document.getElementById('prodVenda'), { mask:Number, scale:2, radix:',', thousandsSeparator:'.', prefix:'R$ ', padFractionalZeros:true });
      IMask(document.getElementById('movQuantidade') || document.createElement('input'), { mask:Number, scale:3, radix:'.' });
      IMask(document.getElementById('saleQuantidade'), { mask:Number, scale:3, radix:'.' });
    }catch(e){ console.warn('IMask init error', e); }
  }

  // ---------- Clientes ----------
  let editingClienteIndex = null;

  function validarCPF(cpf){
    cpf = onlyNumbers(cpf);
    if (cpf.length !== 11) return false;
    if (/^(.)\1+$/.test(cpf)) return false;
    let soma=0, resto;
    for(let i=1;i<=9;i++) soma += parseInt(cpf.substring(i-1,i))*(11-i);
    resto = (soma*10)%11; if (resto===10) resto=0; if (resto!==parseInt(cpf.substring(9,10))) return false;
    soma=0; for(let i=1;i<=10;i++) soma += parseInt(cpf.substring(i-1,i))*(12-i);
    resto=(soma*10)%11; if(resto===10) resto=0; return resto===parseInt(cpf.substring(10,11));
  }

  function validarEmail(em){ return !em || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em); }

  function adicionarCliente(cliente){
    // validações
    if (!cliente.nome) { showToast('Informe o nome.', 'warn'); return false; }
    if (!/^\(\d{2}\) \d{5}-\d{4}$/.test(cliente.celular||'')) { showToast('Celular inválido.', 'warn'); return false; }
    if (!validarCPF(cliente.cpf)) { showToast('CPF inválido.', 'warn'); return false; }
    if (!cliente.cep || onlyNumbers(cliente.cep).length !== 8) { showToast('CEP inválido.', 'warn'); return false; }
    if (!cliente.numero) { showToast('Número da casa obrigatório.', 'warn'); return false; }
    if (cliente.email && !validarEmail(cliente.email)) { showToast('E-mail inválido.', 'warn'); return false; }

    const arr = carregar(LS.clientes);
    const cpfLimpo = onlyNumbers(cliente.cpf);
    const celLimpo = onlyNumbers(cliente.celular);
    const existe = arr.some((c, idx) => {
      if (editingClienteIndex !== null && idx === editingClienteIndex) return false; // allow same record when editing
      return onlyNumbers(c.cpf) === cpfLimpo || onlyNumbers(c.celular) === celLimpo;
    });
    if (existe) { showToast('Já existe cliente com este CPF ou celular.', 'error'); return false; }

    if (editingClienteIndex !== null){ arr[editingClienteIndex] = cliente; editingClienteIndex = null; showToast('Cliente atualizado.', 'success'); }
    else { arr.push(cliente); showToast('Cliente salvo.', 'success'); }
    salvar(LS.clientes, arr); salvarTimestamp(); atualizarListaClientes(); atualizarSaleClienteOptions(); atualizarDashboard();
    return true;
  }

  function atualizarListaClientes(){
    const termo = els.buscarClienteSmart && els.buscarClienteSmart.value.toLowerCase() || '';
    const arr = carregar(LS.clientes);
    const tbody = els.listaClientes; if(!tbody) return;
    tbody.innerHTML = '';
    arr.filter(c => {
      if (!termo) return true;
      const s = `${c.nome} ${c.celular} ${c.cpf}`.toLowerCase(); return s.indexOf(termo) !== -1;
    }).forEach((c,i)=>{
      const tr = document.createElement('tr'); tr.className='border-b';
      tr.innerHTML = `
        <td class="p-2">${escapeHtml(c.nome)}</td>
        <td class="p-2">${escapeHtml(c.celular)}</td>
        <td class="p-2">${escapeHtml(c.email||'-')}</td>
        <td class="p-2">${escapeHtml(c.cpf)}</td>
        <td class="p-2">${escapeHtml(c.rua||'')}, ${escapeHtml(c.numero||'')} ${c.bairro?('- '+escapeHtml(c.bairro)):'')}<br>${escapeHtml(c.cidade||'')}/${escapeHtml(c.estado||'')}</td>
        <td class="p-2 text-center">
          <button class="bg-blue-500 text-white px-2 py-1 rounded mr-1" onclick="window.editarCliente(${i})">📝</button>
          <button class="bg-red-500 text-white px-2 py-1 rounded" onclick="window.excluirCliente(${i})">🗑</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  window.editarCliente = function(i){
    const arr = carregar(LS.clientes); const c = arr[i]; if(!c) return showToast('Cliente não encontrado','error');
    editingClienteIndex = i;
    document.getElementById('cliNome').value = c.nome || '';
    document.getElementById('cliCelular').value = c.celular || '';
    document.getElementById('cliEmail').value = c.email || '';
    document.getElementById('cliCPF').value = c.cpf || '';
    document.getElementById('cliRG').value = c.rg || '';
    document.getElementById('cliCEP').value = c.cep || '';
    document.getElementById('cliRua').value = c.rua || '';
    document.getElementById('cliNumero').value = c.numero || '';
    document.getElementById('cliBairro').value = c.bairro || '';
    document.getElementById('cliCidade').value = c.cidade || '';
    document.getElementById('cliEstado').value = c.estado || '';
    document.getElementById('cliComplemento').value = c.complemento || '';
    document.getElementById('cliReferencia').value = c.referencia || '';
    showToast('Modo edição ativado.', 'info');
  };

  window.excluirCliente = function(i){
    const arr = carregar(LS.clientes); if(!arr[i]) return;
    if (!confirm(`Excluir ${arr[i].nome}?`)) return;
    arr.splice(i,1); salvar(LS.clientes, arr); atualizarListaClientes(); atualizarSaleClienteOptions(); atualizarDashboard(); showToast('Cliente excluído','success');
  };

  // ---------- Categorias ----------
  function addCategoriaIfNew(name){ if (!name) return; const cats = carregar(LS.categorias); if (!cats.some(c => c.toLowerCase()===name.toLowerCase())){ cats.push(name); salvar(LS.categorias, cats); atualizarCategoriasDatalist(); } }
  function atualizarCategoriasDatalist(){ const cats = carregar(LS.categorias) || []; if(els.datalistCategorias) els.datalistCategorias.innerHTML = cats.map(c=>`<option value="${escapeHtml(c)}">`).join(''); }

  // ---------- Produtos ----------
  let editingProdutoIndex = null;
  function adicionarProduto(prod){
    // validações mínimas
    if (!prod.nome) return showToast('Nome do produto obrigatório.','warn');
    if (!prod.categoria) return showToast('Categoria obrigatória.','warn');
    if (!prod.unidade) return showToast('Unidade obrigatória.','warn');
    if (!prod.precoCusto || prod.precoCusto<=0) return showToast('Preço de custo inválido.','warn');
    if (!prod.precoVenda || prod.precoVenda<=0) return showToast('Preço de venda inválido.','warn');
    if (prod.precoVenda <= prod.precoCusto) return showToast('Preço de venda deve ser maior que custo.','warn');
    const arr = carregar(LS.produtos);
    const lucro = ((prod.precoVenda - prod.precoCusto) / prod.precoCusto) * 100;
    const obj = { nome: prod.nome, categoria: prod.categoria, quantidadeMedia: Number(prod.quantidadeMedia)||0, unidade: prod.unidade, custo: prod.precoCusto, venda: prod.precoVenda, lucro: Number(lucro.toFixed(1)), obs: prod.obs||'', quantidade: 0 };
    if (editingProdutoIndex !== null){ arr[editingProdutoIndex] = Object.assign(arr[editingProdutoIndex], obj); editingProdutoIndex = null; showToast('Produto atualizado','success'); }
    else { arr.push(obj); showToast('Produto salvo','success'); }
    salvar(LS.produtos, arr); addCategoriaIfNew(prod.categoria); atualizarListaProdutos(); atualizarEstoqueUI(); atualizarSaleProductOptions(); atualizarDashboard();
  }

  function atualizarListaProdutos(){
    const termo = (els.buscarProduto && els.buscarProduto.value || '').toLowerCase();
    const arr = carregar(LS.produtos); const tbody = els.listaProdutos; if(!tbody) return; tbody.innerHTML='';
    arr.filter(p => !termo || p.nome.toLowerCase().includes(termo)).forEach((p,i)=>{
      const tr = document.createElement('tr'); tr.className='border-b';
      tr.innerHTML = `
        <td class="p-2">${escapeHtml(p.nome)}</td>
        <td class="p-2">${escapeHtml(p.categoria)}</td>
        <td class="p-2">${Number(p.quantidadeMedia).toFixed(3)} ${escapeHtml(p.unidade)}</td>
        <td class="p-2">${formatMoney(p.custo)}</td>
        <td class="p-2">${formatMoney(p.venda)}</td>
        <td class="p-2 font-semibold">${p.lucro}%</td>
        <td class="p-2">${Number(p.quantidade||0)}</td>
        <td class="p-2 text-center">
          <button class="bg-blue-500 text-white px-2 py-1 rounded mr-1" onclick="window.editarProduto(${i})">📝</button>
          <button class="bg-red-500 text-white px-2 py-1 rounded" onclick="window.excluirProduto(${i})">🗑</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  window.editarProduto = function(i){ const arr = carregar(LS.produtos); const p = arr[i]; if(!p) return showToast('Produto não encontrado','error'); editingProdutoIndex = i; document.getElementById('prodNome').value = p.nome; document.getElementById('prodCategoria').value = p.categoria; document.getElementById('prodQuantidadeMedia').value = p.quantidadeMedia; document.getElementById('prodUnidade').value = p.unidade; document.getElementById('prodCusto').value = p.custo; document.getElementById('prodVenda').value = p.venda; document.getElementById('prodObs').value = p.obs || ''; showToast('Modo edição produto','info'); };
  window.excluirProduto = function(i){ const arr = carregar(LS.produtos); if(!arr[i]) return; if(!confirm(`Excluir ${arr[i].nome}?`)) return; arr.splice(i,1); salvar(LS.produtos, arr); showToast('Produto excluído','success'); atualizarListaProdutos(); atualizarEstoqueUI(); atualizarSaleProductOptions(); atualizarDashboard(); };

  // ---------- Movimentações / Estoque por lote ----------
  // movimentacoes: array newest-first of { data, produto, tipo:'entrada'|'saida', quantidade, unidade, lote, obs }
  function registrarMovimentacao(mov){
    const movs = carregar(LS.movimentacoes); movs.unshift(mov); salvar(LS.movimentacoes, movs); salvarTimestamp(); atualizarEstoqueUI(); atualizarDashboard(); }

  // recompute estoque agregado por produto somando entradas e subtraindo saídas
  function recomputeEstoque(){
    const movs = carregar(LS.movimentacoes); const produtos = carregar(LS.produtos);
    const map = {};
    produtos.forEach(p => map[p.nome] = 0);
    movs.forEach(m => { if(!(m.produto in map)) map[m.produto]=0; if(m.tipo==='entrada') map[m.produto] += Number(m.quantidade||0); else map[m.produto] -= Number(m.quantidade||0); });
    // write back quantities into produtos list
    produtos.forEach(p => { p.quantidade = Number((map[p.nome]||0).toFixed(3)); });
    salvar(LS.produtos, produtos);
    return Object.keys(map).map(k => ({ produto:k, quantidade: map[k] }));
  }

  // obter lotes por produto com saldo atual (considera entradas e saídas com lote)
  function obterLotesPorProduto(){
    const movs = carregar(LS.movimentacoes).slice().reverse(); // chronological
    const byProd = {};
    movs.forEach(m => {
      if(!byProd[m.produto]) byProd[m.produto] = {};
      if(m.tipo==='entrada') { const l = m.lote||'SEM_LOTE'; byProd[m.produto][l] = (byProd[m.produto][l]||0) + Number(m.quantidade||0); }
    });
    // subtraia saídas que têm lote
    carregar(LS.movimentacoes).forEach(m => { if(m.tipo==='saida' && m.lote){ if(!byProd[m.produto]) byProd[m.produto] = {}; byProd[m.produto][m.lote] = (byProd[m.produto][m.lote]||0) - Number(m.quantidade||0); } });
    // normalize
    Object.keys(byProd).forEach(prod=>{ Object.keys(byProd[prod]).forEach(l=>{ byProd[prod][l] = Number(byProd[prod][l].toFixed(3)); if(Math.abs(byProd[prod][l])<1e-9) byProd[prod][l]=0; }); });
    return byProd;
  }

  // obter fila de lotes disponíveis (oldest-first) com saldo
  function obterFilaLotes(produtoNome){
    const movsChron = carregar(LS.movimentacoes).slice().reverse(); // oldest-first
    const filaOrig = movsChron.filter(m=>m.produto===produtoNome && m.tipo==='entrada').map(m=>({ lote: m.lote||'SEM_LOTE', quantidade:Number(m.quantidade||0), data:m.data }));
    const consumed = {};
    carregar(LS.movimentacoes).forEach(m=>{ if(m.produto===produtoNome && m.tipo==='saida' && m.lote) consumed[m.lote] = (consumed[m.lote]||0)+Number(m.quantidade||0); });
    const result = [];
    filaOrig.forEach(item=>{ const used = consumed[item.lote]||0; const remain = Math.max(0, item.quantidade - used); if(used>0) consumed[item.lote] = Math.max(0, used - item.quantidade); if(remain>0) result.push({ lote:item.lote, quantidade: Number(remain.toFixed(3)), data:item.data }); });
    return result;
  }

  // atualizar tabela de estoque (agregado por produto com colunas de lotes)
  function atualizarEstoqueUI(){
    recomputeEstoque(); const produtos = carregar(LS.produtos); const lots = obterLotesPorProduto();
    const tbody = els.tabelaEstoque; if(!tbody) return; tbody.innerHTML='';
    produtos.forEach(p=>{
      const lotObj = lots[p.nome]||{}; const lotText = Object.keys(lotObj).length ? Object.keys(lotObj).map(l=>`${l}: ${Number(lotObj[l]).toFixed(3)}`).join(' | ') : '';
      const tr = document.createElement('tr'); tr.className='border-b';
      tr.innerHTML = `<td class="p-2">${escapeHtml(p.nome)}</td><td class="p-2">${lotText}</td><td class="p-2">${Number(p.quantidade||0)}</td><td class="p-2">--</td>`;
      tbody.appendChild(tr);
    });
    // update dashboard values tied to estoque
    atualizarDashboard();
  }

  // ---------- Vendas (PDV) ----------
  let vendaTempItens = []; // items before finalizing

  function preencherSaleProductOptions(){
    const sel = els.saleProduto; if(!sel) return; const produtosArr = carregar(LS.produtos);
    sel.innerHTML = produtosArr.map(p=>`<option value="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</option>`).join('');
    // update saleCliente options too
    atualizarSaleClienteOptions();
    preencherSaleLoteAndPreco();
  }

  function atualizarSaleClienteOptions(){ const sel = els.saleCliente; if(!sel) return; const arr = carregar(LS.clientes); const prev = sel.value||''; sel.innerHTML = `<option value="">-- Consumidor Final --</option>` + arr.map(c=>`<option value="${escapeHtml(c.nome)}">${escapeHtml(c.nome)} — ${escapeHtml(c.celular||'')}</option>`).join(''); sel.value = prev; }

  function preencherSaleLoteAndPreco(){ const prodName = els.saleProduto && els.saleProduto.value; if(!prodName) { if(els.saleLote) els.saleLote.innerHTML = '<option value="">--</option>'; if(els.salePreco) els.salePreco.value=''; return; } const filas = obterFilaLotes(prodName); if(els.saleLote) { els.saleLote.innerHTML = filas.length ? filas.map(f=>`<option value="${escapeHtml(f.lote)}">${escapeHtml(f.lote)} — ${Number(f.quantidade).toFixed(3)}</option>`).join('') : '<option value="">-- Sem lotes --</option>'; }
    const prod = carregar(LS.produtos).find(p=>p.nome===prodName); if(prod && els.salePreco) els.salePreco.value = formatMoney(prod.venda || prod.venda===0 ? prod.venda : 0);
  }

  function adicionarItemTemp(prodName, qtd, lote){
    if(!prodName || !qtd || qtd<=0) return showToast('Produto/quantidade inválidos','warn');
    // check available
    const filas = obterFilaLotes(prodName);
    if(lote){ const f = filas.find(x=>x.lote===lote); if(!f || f.quantidade < qtd) return showToast(`Saldo insuficiente no lote ${lote}`,'warn'); }
    else { const totalDisponivel = filas.reduce((s,it)=>s+it.quantidade,0); if(totalDisponivel < qtd) return showToast('Estoque insuficiente (todas as lotes).','warn'); }
    const prod = carregar(LS.produtos).find(p=>p.nome===prodName); if(!prod) return showToast('Produto inválido','warn');
    const preco = prod.venda || 0; const lucroUnit = preco - (prod.custo||0);
    const item = { produto: prodName, lote: lote||null, quantidade: Number(qtd), unidade: prod.unidade||'', preco: Number(preco), total: Number((preco*qtd).toFixed(2)), lucroUnit: Number(lucroUnit.toFixed(2)), lucroTotal: Number((lucroUnit*qtd).toFixed(2)) };
    vendaTempItens.push(item); showToast('Item adicionado à venda (temporário).','success'); atualizarTabelaItensVenda();
  }

  function atualizarTabelaItensVenda(){ const tbody = els.saleItens; if(!tbody) return; tbody.innerHTML=''; let subtotal=0, lucroTotal=0; vendaTempItens.forEach((it,idx)=>{ subtotal += it.total; lucroTotal += it.lucroTotal; const tr = document.createElement('tr'); tr.className='border-b'; tr.innerHTML = `<td class="p-2">${escapeHtml(it.produto)}</td><td class="p-2">${escapeHtml(it.lote||'')}</td><td class="p-2">${it.quantidade}</td><td class="p-2">${escapeHtml(it.unidade)}</td><td class="p-2">${formatMoney(it.preco)}</td><td class="p-2">${formatMoney(it.total)}</td><td class="p-2">${formatMoney(it.lucroTotal)}</td><td class="p-2 text-center"><button class="bg-red-500 text-white px-2 py-1 rounded" onclick="window.removerItemVenda(${idx})">Remover</button></td>`; tbody.appendChild(tr); }); const descontoPct = Number(els.saleDesconto && els.saleDesconto.value) || 0; const descontoValor = subtotal*(descontoPct/100); const total = Number((subtotal - descontoValor).toFixed(2)); if(els.saleSubtotal) els.saleSubtotal.innerText = formatMoney(subtotal); if(els.saleDescontoValor) els.saleDescontoValor.innerText = formatMoney(descontoValor); if(els.saleTotal) els.saleTotal.innerText = formatMoney(total); }

  window.removerItemVenda = function(idx){ vendaTempItens.splice(idx,1); atualizarTabelaItensVenda(); showToast('Item removido','info'); };

  function gerarCodigoVenda(next){ return `VEN-${uidPad(next,4)}`; }

  function finalizarVenda(){ if(!vendaTempItens.length) return showToast('Adicione itens à venda','warn'); const cliente = els.saleCliente && els.saleCliente.value || 'Consumidor Final'; const descontoPct = Number(els.saleDesconto && els.saleDesconto.value) || 0; let subtotal = 0, lucroTotal=0; vendaTempItens.forEach(it=>{ subtotal += it.total; lucroTotal += it.lucroTotal; }); const descontoValor = Number((subtotal*(descontoPct/100)).toFixed(2)); const total = Number((subtotal - descontoValor).toFixed(2)); const vendasArr = carregar(LS.vendas); const nextId = vendasArr.length ? Math.max(...vendasArr.map(v=>v.id||0))+1 : 1; const codigo = gerarCodigoVenda(nextId);
    // create saída movimentations per item using FIFO or lote chosen
    const movs = carregar(LS.movimentacoes);
    vendaTempItens.forEach(it=>{
      let remaining = Number(it.quantidade);
      if(it.lote){ movs.unshift({ data: nowISO().slice(0,10), produto: it.produto, tipo:'saida', quantidade: remaining, unidade: it.unidade, lote: it.lote, obs: `Venda ${codigo}` }); remaining=0; }
      else {
        const fila = obterFilaLotes(it.produto); // oldest-first
        for(let i=0;i<fila.length && remaining>0;i++){ const entry=fila[i]; const take = Math.min(remaining, entry.quantidade); movs.unshift({ data: nowISO().slice(0,10), produto: it.produto, tipo:'saida', quantidade: take, unidade: it.unidade, lote: entry.lote, obs:`Venda ${codigo}` }); remaining -= take; }
        if(remaining>0){ if(!confirm(`Estoque insuficiente para ${it.produto}. Permitir saldo negativo e registrar restante?`)) { showToast('Finalização cancelada','info'); return; } else { movs.unshift({ data: nowISO().slice(0,10), produto: it.produto, tipo:'saida', quantidade: remaining, unidade: it.unidade, lote:'NEGATIVO', obs:`Venda ${codigo} (saldo negativo)` }); remaining=0; } }
      }
    });
    salvar(LS.movimentacoes, movs); salvarTimestamp();
    const vendaObj = { id: nextId, codigo, cliente, data: nowISO(), descontoPct, subtotal: Number(subtotal.toFixed(2)), descontoValor, total, lucroTotal: Number(lucroTotal.toFixed(2)), itens: vendaTempItens.map(it=>({ produto: it.produto, lote: it.lote||null, quantidade: it.quantidade, unidade: it.unidade, preco: it.preco, total: it.total, lucro: it.lucroTotal })), revertida: false };
    vendasArr.push(vendaObj); salvar(LS.vendas, vendasArr); vendaTempItens = []; atualizarTabelaItensVenda(); atualizarVendasLista(); recomputeAndRefreshAll(); showToast(`Venda ${codigo} finalizada.`,'success'); }

  function atualizarVendasLista(){ const arr = carregar(LS.vendas); const tbody = els.listaVendas; if(!tbody) return; tbody.innerHTML=''; arr.slice().reverse().forEach(v=>{ const tr = document.createElement('tr'); tr.className='border-b'; tr.innerHTML = `<td class="p-2">${new Date(v.data).toLocaleString()}</td><td class="p-2">${escapeHtml(v.codigo)}</td><td class="p-2">${escapeHtml(v.cliente)}</td><td class="p-2">${v.itens.length}</td><td class="p-2">${formatMoney(v.total)}</td><td class="p-2 text-center">${v.revertida?'<span class="text-sm text-yellow-600">Revertida</span>':'<button class="bg-yellow-600 text-white px-2 py-1 rounded mr-2" onclick="window.reverterVenda(\''+v.id+'\')">Reverter</button>'}<button class="bg-blue-500 text-white px-2 py-1 rounded ml-2" onclick="window.detalharVenda(\''+v.id+'\')">Detalhar</button></td>`; tbody.appendChild(tr); }); }

  window.detalharVenda = function(id){ const arr = carregar(LS.vendas); const v = arr.find(x=>String(x.id)===String(id)); if(!v) return showToast('Venda não encontrada','error'); const modal = document.createElement('div'); modal.className='fixed inset-0 flex items-center justify-center z-50'; modal.innerHTML = `<div class="modal-backdrop absolute inset-0"></div><div class="bg-white z-50 p-6 rounded shadow max-w-2xl w-11/12"><h3 class="font-semibold mb-2">Venda ${escapeHtml(v.codigo)}</h3><p><strong>Cliente:</strong> ${escapeHtml(v.cliente)}</p><p><strong>Total:</strong> ${formatMoney(v.total)} (Desconto: ${formatMoney(v.descontoValor||0)})</p><div class="mt-3"><table class="min-w-full text-sm"><thead class="bg-gray-100"><tr><th class="p-2">Produto</th><th class="p-2">Lote</th><th class="p-2">Qtd</th><th class="p-2">Preço</th><th class="p-2">Total</th></tr></thead><tbody>${v.itens.map(it=>`<tr class="border-b"><td class="p-2">${escapeHtml(it.produto)}</td><td class="p-2">${escapeHtml(it.lote||'')}</td><td class="p-2">${it.quantidade}</td><td class="p-2">${formatMoney(it.preco)}</td><td class="p-2">${formatMoney(it.total)}</td></tr>`).join('')}</tbody></table></div><div class="flex justify-end mt-4"><button id="closeModalVenda" class="px-4 py-2 rounded border">Fechar</button></div></div>`;
    document.body.appendChild(modal); document.getElementById('closeModalVenda').addEventListener('click', ()=>modal.remove()); };

  window.reverterVenda = function(id){ const arr = carregar(LS.vendas); const v = arr.find(x=>String(x.id)===String(id)); if(!v) return showToast('Venda não encontrada','error'); if(v.revertida) return showToast('Venda já está revertida','info'); if(!confirm('Deseja realmente reverter esta venda? O estoque será ajustado automaticamente.')) return; // adjust saldo without creating movimentacao record
    // We'll compute current lot balances and add back quantities to the aggregated quantity recorded on products (without writing movimentacoes)
    // Approach: for each item, increase product quantity by quantidade and adjust the matching lot balance in the movimentacoes internal representation by *not* adding movs (we'll instead keep a hidden map in localStorage 'gq_manual_stock_adjust' if needed). Simpler: add a special internal flag in vendas marking revertida=true and add synthetic adjustments to produtos.quantidade directly.
    const produtosArr = carregar(LS.produtos);
    v.itens.forEach(it=>{ const p = produtosArr.find(x=>x.nome===it.produto); if(p){ p.quantidade = Number((Number(p.quantidade||0) + Number(it.quantidade)).toFixed(3)); } });
    v.revertida = true; salvar(LS.vendas, arr); salvar(LS.produtos, produtosArr); // no movimentacoes created
    atualizarListaProdutos(); atualizarEstoqueUI(); atualizarVendasLista(); atualizarDashboard(); showToast('Venda revertida (saldos ajustados).','success'); };

  // ---------- Export (XLSX / PDF) ----------
  function exportarTabela(tipo, formato){ let dados = [];
    if(tipo==='clientes') dados = carregar(LS.clientes);
    else if(tipo==='produtos') dados = carregar(LS.produtos);
    else if(tipo==='movimentacoes') dados = carregar(LS.movimentacoes);
    else if(tipo==='vendas') dados = carregar(LS.vendas);
    else if(tipo==='estoque'){ const arr = recomputeEstoque(); const produtos = carregar(LS.produtos); const lots = obterLotesPorProduto(); dados = arr.map(e=>{ const p = produtos.find(x=>x.nome===e.produto)||{}; const lotStr = Object.keys(lots[e.produto]||{}).map(l=>`${l}: ${lots[e.produto][l]}`).join(' | '); return { produto:e.produto, quantidade:e.quantidade, unidade: p.unidade||'', custo: formatMoney(p.custo||0), valor_total: formatMoney((p.custo||0)*e.quantidade), lotes: lotStr }; }); }
    if(!dados || !dados.length){ showToast('Nada para exportar','warn'); return; }
    if(formato==='xlsx'){ const ws = XLSX.utils.json_to_sheet(dados); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, tipo); XLSX.writeFile(wb, `${tipo}.xlsx`); showToast('Exportado .xlsx','success'); return; }
    // PDF
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation:'landscape' }); const cols = Object.keys(dados[0]); const body = dados.map(d=>cols.map(c=>d[c]!==undefined?String(d[c]):'')); doc.text(`Relatório - ${tipo}`,14,15); doc.autoTable({ head:[cols], body, startY:20 }); doc.save(`${tipo}.pdf`); showToast('Exportado PDF','success'); }

  // ---------- Dashboard ----------
  function atualizarDashboard(){ const clientesArr = carregar(LS.clientes); const produtosArr = carregar(LS.produtos); const vendasArr = carregar(LS.vendas);
    if(els.dashClientes) els.dashClientes.innerText = clientesArr.length;
    if(els.dashProdutos) els.dashProdutos.innerText = produtosArr.length;
    // estoque value
    recomputeEstoque(); let valorTotal=0; let lucroPot=0; let peso=0; produtosArr.forEach(p=>{ const custo = Number(p.custo||0); const venda = Number(p.venda||0); const qtd = Number(p.quantidade||0); valorTotal += custo*qtd; lucroPot += (venda-custo)*qtd; peso += custo*qtd; });
    const lucroPct = peso?((lucroPot/peso)*100):0; if(els.dashValorEstoque) els.dashValorEstoque.innerText = formatMoney(valorTotal); if(els.dashLucroReal) els.dashLucroReal.innerText = formatMoney(lucroPot); if(els.dashLucroPct) els.dashLucroPct.innerText = `Lucro médio: ${Number(lucroPct.toFixed(1))}%`;
    const totalVendas = vendasArr.reduce((s,v)=> s + Number(v.total||0),0); if(els.dashTotalVendas) els.dashTotalVendas.innerText = `Total vendas: ${formatMoney(totalVendas)}`;
    const lastISO = localStorage.getItem(LS.lastUpdate); if(els.dashUltAtual) els.dashUltAtual.innerText = lastISO?`Última atual.: ${new Date(lastISO).toLocaleString()}`:'Última atual.: —'; }

  // recompute and refresh many parts
  function recomputeAndRefreshAll(){ recomputeEstoque(); atualizarListaClientes(); atualizarListaProdutos(); atualizarEstoqueUI(); atualizarVendasLista(); atualizarDashboard(); preencherSaleProductOptions(); }

  // ---------- Init bindings and events ----------
  function initBindings(){
    initMasks(); atualizarCategoriasDatalist(); atualizarListaClientes(); atualizarListaProdutos(); atualizarEstoqueUI(); atualizarVendasLista(); preencherSaleProductOptions();

    // clients form
    if(els.formCliente) els.formCliente.addEventListener('submit', e=>{ e.preventDefault(); const cliente = { nome: document.getElementById('cliNome').value.trim(), celular: document.getElementById('cliCelular').value.trim(), email: document.getElementById('cliEmail').value.trim(), cpf: document.getElementById('cliCPF').value.trim(), rg: document.getElementById('cliRG').value.trim(), cep: document.getElementById('cliCEP').value.trim(), rua: document.getElementById('cliRua').value.trim(), numero: document.getElementById('cliNumero').value.trim(), bairro: document.getElementById('cliBairro').value.trim(), cidade: document.getElementById('cliCidade').value.trim(), estado: document.getElementById('cliEstado').value.trim(), complemento: document.getElementById('cliComplemento').value.trim(), referencia: document.getElementById('cliReferencia').value.trim() }; const ok = adicionarCliente(cliente); if(ok){ els.formCliente.reset(); atualizarSaleClientOptionsAndSelect(); } });

    if(els.buscarClienteSmart) els.buscarClienteSmart.addEventListener('input', ()=>atualizarListaClientes());

    // produto form
    if(els.formProduto) els.formProduto.addEventListener('submit', e=>{ e.preventDefault(); const produto = { nome: document.getElementById('prodNome').value.trim(), categoria: document.getElementById('prodCategoria').value.trim(), quantidadeMedia: document.getElementById('prodQuantidadeMedia').value.trim(), unidade: document.getElementById('prodUnidade').value, precoCusto: parseMoneyInput(document.getElementById('prodCusto').value)||0, precoVenda: parseMoneyInput(document.getElementById('prodVenda').value)||0, obs: document.getElementById('prodObs').value.trim() }; adicionarProduto(produto); els.formProduto.reset(); atualizarSaleProductOptions(); });

    if(els.buscarProduto) els.buscarProduto.addEventListener('input', ()=>atualizarListaProdutos());

    // estoque entries
    if(els.btnEntrada) els.btnEntrada.addEventListener('click', e=>{ e.preventDefault(); const prodId = document.getElementById('estProduto').value; const produtosArr = carregar(LS.produtos); const p = produtosArr[Number(prodId)] || produtosArr.find(x=>x.nome===prodId); // support both id or name
      const nome = p? p.nome : null; const lote = (els.estLote && els.estLote.value.trim()) || null; const qtd = Number(els.estQuantidade && els.estQuantidade.value) || 0; if(!nome || !lote || !qtd) return showToast('Preencha produto, lote e quantidade.','warn'); registrarMovimentacao({ data: nowISO().slice(0,10), produto: nome, tipo:'entrada', quantidade: qtd, unidade: p? p.unidade:'', lote, obs:'Entrada manual'}); els.estLote.value=''; els.estQuantidade.value=''; showToast('Entrada registrada','success'); });

    if(els.btnSaida) els.btnSaida.addEventListener('click', e=>{ e.preventDefault(); const prodId = document.getElementById('estProduto').value; const produtosArr = carregar(LS.produtos); const p = produtosArr[Number(prodId)] || produtosArr.find(x=>x.nome===prodId); const nome = p? p.nome:null; const lote = (els.estLote && els.estLote.value.trim()) || null; const qtd = Number(els.estQuantidade && els.estQuantidade.value) || 0; if(!nome || !qtd) return showToast('Preencha produto e quantidade','warn'); // if lote provided, consume from lote; else consume FIFO
      if(lote){ registrarMovimentacao({ data: nowISO().slice(0,10), produto: nome, tipo:'saida', quantidade: qtd, unidade: p? p.unidade:'', lote, obs:'Saída manual' }); }
      else{
        // FIFO consumption
        let rem = qtd; const fila = obterFilaLotes(nome);
        for(let i=0;i<fila.length && rem>0;i++){ const take = Math.min(rem, fila[i].quantidade); registrarMovimentacao({ data: nowISO().slice(0,10), produto: nome, tipo:'saida', quantidade: take, unidade: p? p.unidade:'', lote: fila[i].lote, obs:'Saída manual (FIFO)'}); rem -= take; }
        if(rem>0){ if(!confirm('Estoque insuficiente. Permitir saldo negativo e registrar restante?')) return; registrarMovimentacao({ data: nowISO().slice(0,10), produto: nome, tipo:'saida', quantidade: rem, unidade: p? p.unidade:'', lote:'NEGATIVO', obs:'Saída manual (saldo negativo)'}); }
      }
      els.estLote.value=''; els.estQuantidade.value=''; showToast('Saída registrada','success');
    });

    // venda UI bindings
    if(els.saleProduto) els.saleProduto.addEventListener('change', ()=>{ preencherSaleLoteAndPreco(); });
    if(els.btnAddItem) els.btnAddItem.addEventListener('click', e=>{ e.preventDefault(); const prodName = els.saleProduto.value; const qtd = Number(els.saleQuantidade.value) || 0; const lote = els.saleLote && els.saleLote.value || null; if(!prodName || qtd<=0) return showToast('Produto/quantidade inválidos','warn'); adicionarItemTemp(prodName, qtd, lote); });
    if(els.btnCancelarVenda) els.btnCancelarVenda.addEventListener('click', ()=>{ if(!vendaTempItens.length) return showToast('Nenhum item para cancelar','info'); if(!confirm('Cancelar venda atual?')) return; vendaTempItens=[]; atualizarTabelaItensVenda(); showToast('Venda cancelada','success'); });
    if(els.btnFinalizarVenda) els.btnFinalizarVenda.addEventListener('click', ()=>finalizarVenda());

    // export buttons are inline in HTML and call exportarTabela

    window.addEventListener('storage', ()=>{ // when localStorage changes in another tab — refresh
      recomputeAndRefreshAll();
    });

    // expose some functions globally for inline onclick handlers in generated HTML
    window.adicionarCliente = adicionarCliente; window.atualizarListaClientes = atualizarListaClientes; window.editarCliente = window.editarCliente; window.excluirCliente = window.excluirCliente; window.adicionarProduto = adicionarProduto; window.atualizarListaProdutos = atualizarListaProdutos; window.editarProduto = window.editarProduto; window.excluirProduto = window.excluirProduto; window.registrarMovimentacao = registrarMovimentacao; window.atualizarEstoqueUI = atualizarEstoqueUI; window.atualizarVendasLista = atualizarVendasLista; window.reverterVenda = window.reverterVenda; window.detalharVenda = window.detalharVenda; window.exportarTabela = exportarTabela; window.removerItemVenda = window.removerItemVenda; window.atualizarTotaisVenda = atualizarTabelaItensVenda;

    // initial render
    recomputeAndRefreshAll();
  }

  // ---------- Run init ----------
  document.addEventListener('DOMContentLoaded', ()=>{ initBindings(); setTimeout(()=>{ // small delay to ensure select options are ready
    preencherSaleProductOptions(); atualizarSaleClientOptionsAndSelect(); },300); });

  // compatibility helper used in inline code
  function atualizarSaleClientOptionsAndSelect(){ atualizarSaleClientOptions(); }
  function atualizarSaleClientOptions(){ atualizarSaleClienteOptions(); }

})();
