// ==============================
// GESTÃO DE QUEIJARIA - script.js
// Funcionalidades: clientes, produtos, estoque, vendas (modal de cliente), buscas dinâmicas, máscaras, toasts
// ==============================

// ---------- Helpers ----------
function getData(key){ return JSON.parse(localStorage.getItem(key) || '[]'); }
function setData(key,val){ localStorage.setItem(key, JSON.stringify(val)); }
function gerarId(pref){ return `${pref}_${Date.now()}_${Math.floor(Math.random()*1000)}`; }
function onlyNumbers(s){ return String(s||'').replace(/\D/g,''); }
function formatMoney(n){ if(isNaN(n)) return 'R$ 0,00'; return Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

// Toast moderno
function toast(msg, type='info'){
  const colors = { info: '#3B82F6', sucesso: '#10B981', erro: '#EF4444', warn:'#F59E0B' };
  const el = document.createElement('div'); el.textContent = msg;
  el.style.position='fixed'; el.style.right='20px'; el.style.bottom='20px'; el.style.background = colors[type]||colors.info; el.style.color='#fff'; el.style.padding='10px 14px'; el.style.borderRadius='8px'; el.style.boxShadow='0 8px 30px rgba(0,0,0,0.12)'; el.style.zIndex=99999; el.style.opacity='0'; el.style.transform='translateY(8px)'; el.style.transition='all 220ms ease'; document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translateY(0)'; });
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(8px)'; setTimeout(()=>el.remove(),240); }, 3000);
}

// Ensure keys
if(!localStorage.getItem('clientes')) setData('clientes',[]);
if(!localStorage.getItem('produtos')) setData('produtos',[]);
if(!localStorage.getItem('estoque')) setData('estoque',[]);
if(!localStorage.getItem('vendas')) setData('vendas',[]);

// ---------- NAV ----------
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.menu-item').forEach(btn=>btn.addEventListener('click', ()=>{
    document.querySelectorAll('.content-section').forEach(s=>s.classList.add('hidden'));
    const t = btn.dataset.target; document.getElementById(t).classList.remove('hidden');
    // render views
    if(t==='clientes') renderClientes();
    if(t==='produtos') renderProdutos();
    if(t==='estoque') renderEstoque();
    if(t==='vendas'){ renderVendasUI(); renderVendasList(); }
    if(t==='dashboard') renderDashboard();
  }));

  // initial
  renderDashboard(); renderClientes(); renderProdutos(); renderEstoque(); renderVendasUI(); renderVendasList();

  // masks init (safe guards)
  try{
    if(window.IMask){ IMask(document.getElementById('clienteCelular')||document.createElement('input'), {mask:'(00) 00000-0000'});
      IMask(document.getElementById('clienteCPF')||document.createElement('input'), {mask:'000.000.000-00'});
      IMask(document.getElementById('clienteCEP')||document.createElement('input'), {mask:'00000-000'});
      // price & weight masks (simple number masks)
      IMask(document.getElementById('produtoPesoMedio')||document.createElement('input'), {mask:Number,scale:3,radix:'.'});
      IMask(document.getElementById('produtoPrecoCusto')||document.createElement('input'), {mask:Number,scale:2,radix:'.'});
      IMask(document.getElementById('produtoPrecoVenda')||document.createElement('input'), {mask:Number,scale:2,radix:'.'});
      IMask(document.getElementById('modalCelular')||document.createElement('input'), {mask:'(00) 00000-0000'});
      IMask(document.getElementById('modalCPF')||document.createElement('input'), {mask:'000.000.000-00'});
    }
  }catch(e){ console.warn('IMask not available', e); }

  // binds for search filters
  const buscarClientes = document.getElementById('buscarClientes'); if(buscarClientes) buscarClientes.addEventListener('input', ()=>renderClientes(buscarClientes.value));
  const buscarProdutos = document.getElementById('buscarProdutos'); if(buscarProdutos) buscarProdutos.addEventListener('input', ()=>renderProdutos(buscarProdutos.value));
});

// ---------- CLIENTES ----------
const formClientes = document.getElementById('formClientes');
if(formClientes) formClientes.addEventListener('submit', e=>{
  e.preventDefault();
  const nome = document.getElementById('clienteNome').value.trim();
  const celular = document.getElementById('clienteCelular').value.trim();
  const cpf = document.getElementById('clienteCPF').value.trim();
  const rg = document.getElementById('clienteRG').value.trim();
  const email = document.getElementById('clienteEmail').value.trim();
  const cep = document.getElementById('clienteCEP').value.trim();
  const endereco = document.getElementById('clienteEndereco').value.trim();
  const numero = document.getElementById('clienteNumero').value.trim();
  const complemento = document.getElementById('clienteComplemento').value.trim();
  const referencia = document.getElementById('clienteReferencia').value.trim();
  if(!nome || onlyNumbers(celular).length<10 || onlyNumbers(cpf).length!==11 || onlyNumbers(cep).length!==8 || !numero){ toast('Verifique campos obrigatórios','erro'); return; }
  const clientes = getData('clientes'); if(clientes.some(c=> onlyNumbers(c.cpf)===onlyNumbers(cpf) || onlyNumbers(c.celular)===onlyNumbers(celular))){ toast('CPF ou celular já cadastrado','erro'); return; }
  clientes.push({ id:gerarId('CLI'), nome, celular, cpf, rg, email, cep, endereco, numero, complemento, referencia }); setData('clientes', clientes); formClientes.reset(); renderClientes(); toast('Cliente cadastrado','sucesso');
});

function renderClientes(filter=''){
  const el = document.getElementById('clientesTable'); if(!el) return; const arr = getData('clientes'); filter = (filter||'').toLowerCase(); const filtered = arr.filter(c=>`${c.nome} ${c.cpf} ${c.celular}`.toLowerCase().includes(filter)); if(!filtered.length){ el.innerHTML='<p class="text-gray-600">Nenhum cliente encontrado.</p>'; return; }
  let html = '<table class="w-full bg-white rounded shadow"><thead class="bg-green-600 text-white"><tr><th class="p-2">Nome</th><th>Celular</th><th>CPF</th><th>Endereço</th><th>Ações</th></tr></thead><tbody>';
  filtered.forEach(c=>{ html += `<tr class="border-t hover:bg-gray-50"><td class="p-2">${c.nome}</td><td class="p-2">${c.celular}</td><td class="p-2">${c.cpf}</td><td class="p-2">${c.endereco||''} ${c.numero||''}</td><td class="p-2"><button class="bg-blue-500 text-white px-2 py-1 rounded mr-1" onclick="editarCliente('${c.id}')">Editar</button><button class="bg-red-500 text-white px-2 py-1 rounded" onclick="excluirCliente('${c.id}')">Excluir</button></td></tr>`; }); html += '</tbody></table>'; el.innerHTML = html; }

window.editarCliente = function(id){ const arr = getData('clientes'); const c = arr.find(x=>x.id===id); if(!c) return toast('Cliente não encontrado','erro'); // preenche o form e remove o antigo para re-salvar
  document.getElementById('clienteNome').value = c.nome; document.getElementById('clienteCelular').value = c.celular; document.getElementById('clienteCPF').value = c.cpf; document.getElementById('clienteRG').value = c.rg||''; document.getElementById('clienteEmail').value = c.email||''; document.getElementById('clienteCEP').value = c.cep||''; document.getElementById('clienteEndereco').value = c.endereco||''; document.getElementById('clienteNumero').value = c.numero||''; document.getElementById('clienteComplemento').value = c.complemento||''; document.getElementById('clienteReferencia').value = c.referencia||''; const restante = arr.filter(x=>x.id!==id); setData('clientes', restante); toast('Ajuste dados e clique em Salvar para atualizar','info'); };
window.excluirCliente = function(id){ if(!confirm('Excluir cliente?')) return; const restante = getData('clientes').filter(x=>x.id!==id); setData('clientes', restante); renderClientes(); toast('Cliente excluído','sucesso'); };

// ---------- PRODUTOS ----------
const formProdutosEl = document.getElementById('formProdutos'); if(formProdutosEl) formProdutosEl.addEventListener('submit', e=>{ e.preventDefault(); const nome = document.getElementById('produtoNome').value.trim(); const categoria = document.getElementById('produtoCategoria').value.trim(); const unidade = document.getElementById('produtoUnidade').value; const pesoMedio = Number((document.getElementById('produtoPesoMedio').value||'0').toString().replace(',','.'))||0; const precoCusto = Number((document.getElementById('produtoPrecoCusto').value||'0').toString().replace(',','.'))||0; const precoVenda = Number((document.getElementById('produtoPrecoVenda').value||'0').toString().replace(',','.'))||0; if(!nome||precoCusto<=0||precoVenda<=0){ toast('Verifique os dados do produto','erro'); return; } const arr = getData('produtos'); arr.push({ id:gerarId('PROD'), nome, categoria, unidade, pesoMedio, precoCusto, precoVenda }); setData('produtos', arr); formProdutosEl.reset(); renderProdutos(); carregarProdutosSelect(); toast('Produto adicionado','sucesso'); });

function renderProdutos(filter=''){ const el = document.getElementById('produtosTable'); if(!el) return; const arr = getData('produtos'); filter=(filter||'').toLowerCase(); const f = arr.filter(p=>`${p.nome} ${p.categoria}`.toLowerCase().includes(filter)); if(!f.length){ el.innerHTML='<p class="text-gray-600">Nenhum produto.</p>'; return; } let html='<table class="w-full bg-white rounded shadow"><thead class="bg-green-600 text-white"><tr><th class="p-2">Nome</th><th>Categoria</th><th>Unidade</th><th>Peso</th><th>Custo</th><th>Venda</th><th>Ações</th></tr></thead><tbody>'; f.forEach(p=>{ html += `<tr class="border-t hover:bg-gray-50"><td class="p-2">${p.nome}</td><td class="p-2">${p.categoria||''}</td><td class="p-2">${p.unidade}</td><td class="p-2">${p.pesoMedio}</td><td class="p-2">${formatMoney(p.precoCusto)}</td><td class="p-2">${formatMoney(p.precoVenda)}</td><td class="p-2"><button onclick="excluirProduto('${p.id}')" class="bg-red-500 text-white px-2 py-1 rounded">Excluir</button></td></tr>`; }); html += '</tbody></table>'; el.innerHTML = html; }

window.excluirProduto = function(id){ if(!confirm('Excluir produto?')) return; const restante = getData('produtos').filter(x=>x.id!==id); setData('produtos', restante); renderProdutos(); carregarProdutosSelect(); toast('Produto excluído','sucesso'); };

function carregarProdutosSelect(){ const sel = document.getElementById('estoqueProduto'); const sel2 = document.getElementById('vendaProduto'); const arr = getData('produtos'); if(sel) sel.innerHTML = arr.map(p=>`<option value="${p.id}">${p.nome}</option>`).join(''); if(sel2) sel2.innerHTML = '<option value="">-- selecione --</option>' + arr.map(p=>`<option value="${p.id}">${p.nome}</option>`).join(''); }

// ---------- ESTOQUE ----------
function atualizarEstoque(tipo){ const produtoId = document.getElementById('estoqueProduto').value; const lote = (document.getElementById('estoqueLote').value||'').trim(); const qtd = Number(document.getElementById('estoqueQtd').value)||0; if(!produtoId||!lote||!qtd){ toast('Preencha produto, lote e quantidade','erro'); return; } const stock = getData('estoque'); let reg = stock.find(s=>s.produtoId===produtoId && s.lote===lote); if(reg){ reg.qtd = tipo==='entrada'? Number((reg.qtd + qtd).toFixed(3)) : Number((reg.qtd - qtd).toFixed(3)); if(reg.qtd<0) reg.qtd=0; reg.updated = new Date().toISOString(); } else { reg = { produtoId, lote, qtd: tipo==='entrada'? Number(qtd.toFixed(3)) : 0, updated: new Date().toISOString() }; stock.push(reg); } setData('estoque', stock); renderEstoque(); toast('Movimentação registrada','sucesso'); }

function renderEstoque(){ const el = document.getElementById('estoqueTable'); if(!el) return; const stock = getData('estoque'); const prods = getData('produtos'); if(!stock.length){ el.innerHTML='<p class="text-gray-600">Nenhum registro de estoque.</p>'; return; } let html = '<table class="w-full bg-white rounded shadow"><thead class="bg-green-600 text-white"><tr><th class="p-2">Produto</th><th>Lote</th><th>Quantidade</th><th>Últ. Mov</th></tr></thead><tbody>'; stock.forEach(s=>{ const p = prods.find(x=>x.id===s.produtoId); html += `<tr class="border-t hover:bg-gray-50"><td class="p-2">${p? p.nome : '—'}</td><td class="p-2">${s.lote}</td><td class="p-2">${s.qtd.toFixed(3)}</td><td class="p-2">${new Date(s.updated).toLocaleString()}</td></tr>`; }); html += '</tbody></table>'; el.innerHTML = html; }

// bind estoque buttons safely
const bE = document.getElementById('btnEntrada'); const bS = document.getElementById('btnSaida'); if(bE) bE.addEventListener('click', e=>{ e.preventDefault(); atualizarEstoque('entrada'); }); if(bS) bS.addEventListener('click', e=>{ e.preventDefault(); atualizarEstoque('saida'); });

// ---------- VENDAS ----------
function renderVendasUI(){ const cont = document.getElementById('vendasForm'); if(!cont) return; cont.innerHTML = `
  <div class="bg-white p-4 rounded shadow mb-4">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div>
        <label class="block text-sm">Cliente</label>
        <input id="vendaBuscarCliente" placeholder="Buscar por nome, CPF ou telefone" class="border p-2 rounded w-full" />
        <select id="vendaCliente" class="border p-2 rounded w-full mt-2"><option value="">-- Consumidor Final --</option></select>
        <button id="btnNovoClienteVenda" class="mt-2 text-sm text-blue-600">+ Novo Cliente</button>
      </div>
      <div>
        <label class="block text-sm">Produto</label>
        <select id="vendaProduto" class="border p-2 rounded w-full"></select>
      </div>
      <div>
        <label class="block text-sm">Lote</label>
        <select id="vendaLote" class="border p-2 rounded w-full"></select>
      </div>
      <div>
        <label class="block text-sm">Quantidade</label>
        <input id="vendaQtd" type="number" step="0.001" class="border p-2 rounded w-full" value="1" />
      </div>
      <div>
        <label class="block text-sm">Preço unit.</label>
        <input id="vendaPreco" class="border p-2 rounded w-full" readonly />
      </div>
      <div>
        <label class="block text-sm">Desconto (%)</label>
        <input id="vendaDesconto" type="number" step="0.1" class="border p-2 rounded w-full" value="0" />
      </div>
      <div>
        <label class="block text-sm">Frete (R$)</label>
        <input id="vendaFrete" type="number" step="0.01" class="border p-2 rounded w-full" value="0" />
      </div>
      <div>
        <label class="block text-sm">Forma de pagamento</label>
        <select id="vendaPagamento" class="border p-2 rounded w-full">
          <option value="dinheiro">Dinheiro</option>
          <option value="cartao_credito">Cartão de Crédito</option>
          <option value="cartao_debito">Cartão de Débito</option>
          <option value="pix">PIX</option>
        </select>
      </div>
      <div class="md:col-span-4 text-right">
        <button id="vendaAddItem" class="bg-blue-600 text-white px-4 py-2 rounded">Adicionar Item</button>
      </div>
    </div>
    <div class="mt-4 overflow-auto bg-gray-50 p-3 rounded">
      <table class="w-full bg-white"><thead class="bg-green-100"><tr><th class="p-2">Produto</th><th class="p-2">Lote</th><th class="p-2">Qtd</th><th class="p-2">Preço</th><th class="p-2">Total</th><th class="p-2">Ações</th></tr></thead><tbody id="vendaItensTable"></tbody></table>
    </div>
    <div class="mt-4 text-right">
      <div>Subtotal: <span id="vendaSubtotal">R$ 0,00</span></div>
      <div>Desconto: <span id="vendaDescontoVal">R$ 0,00</span></div>
      <div>Frete: <span id="vendaFreteVal">R$ 0,00</span></div>
      <div class="text-xl font-bold">Total: <span id="vendaTotal">R$ 0,00</span></div>
      <div class="mt-2">
        <button id="vendaCancelar" class="bg-gray-400 text-white px-3 py-1 rounded">Cancelar</button>
        <button id="vendaFinalizar" class="bg-green-700 text-white px-4 py-2 rounded">Finalizar Venda</button>
      </div>
    </div>
  </div>
`;
  // bind events
  carregarProdutosSelect(); atualizarClienteSelect(); atualizarLotesSelect();
  const selProd = document.getElementById('vendaProduto'); if(selProd) selProd.addEventListener('change', ()=>{ atualizarLotesSelect(); preencherPrecoSelecao(); });
  document.getElementById('vendaAddItem').addEventListener('click', e=>{ e.preventDefault(); adicionarItemVenda(); });
  document.getElementById('vendaFinalizar').addEventListener('click', e=>{ e.preventDefault(); finalizarVenda(); });
  document.getElementById('vendaCancelar').addEventListener('click', e=>{ e.preventDefault(); vendaTempItens=[]; renderItensVenda(); toast('Venda cancelada','info'); });
  const buscarCli = document.getElementById('vendaBuscarCliente'); if(buscarCli) buscarCli.addEventListener('input', ()=>{ filtrarClientesBusca(buscarCli.value); });
  const btnNovoCli = document.getElementById('btnNovoClienteVenda'); if(btnNovoCli) btnNovoCli.addEventListener('click', ()=>{ openModalNovoCliente(); });
}

let vendaTempItens = [];
function atualizarClienteSelect(){ const sel = document.getElementById('vendaCliente'); if(!sel) return; const arr = getData('clientes'); sel.innerHTML = '<option value="">-- Consumidor Final --</option>' + arr.map(c=>`<option value="${c.id}">${c.nome} — ${c.celular} — ${c.cpf}</option>`).join(''); }
function filtrarClientesBusca(q){ q=(q||'').toLowerCase(); const arr=getData('clientes'); const sel=document.getElementById('vendaCliente'); if(!sel) return; const filtered = arr.filter(c=>`${c.nome} ${c.cpf} ${c.celular}`.toLowerCase().includes(q)); sel.innerHTML = '<option value="">-- Consumidor Final --</option>' + filtered.map(c=>`<option value="${c.id}">${c.nome} — ${c.celular} — ${c.cpf}</option>`).join(''); if(filtered.length) toast(`${filtered.length} cliente(s) encontrado(s)`,'info'); }

function atualizarLotesSelect(){ const prodId = document.getElementById('vendaProduto')? document.getElementById('vendaProduto').value : null; const sel = document.getElementById('vendaLote'); if(!sel) return; sel.innerHTML = ''; if(!prodId){ sel.innerHTML = '<option value="">--</option>'; return; } const estoque = getData('estoque').filter(s=>s.produtoId===prodId && s.qtd>0); if(!estoque.length){ sel.innerHTML = '<option value="">-- Sem lotes --</option>'; return; } sel.innerHTML = estoque.map(s=>`<option value="${s.lote}">${s.lote} — ${s.qtd.toFixed(3)}</option>`).join(''); }

function preencherPrecoSelecao(){ const prodId = document.getElementById('vendaProduto')? document.getElementById('vendaProduto').value : null; const inp = document.getElementById('vendaPreco'); if(!inp) return; const prod = getData('produtos').find(p=>p.id===prodId); inp.value = prod? formatMoney(prod.precoVenda) : ''; }

function adicionarItemVenda(){ const prodId = document.getElementById('vendaProduto').value; const lote = document.getElementById('vendaLote').value || null; const qtd = Number(document.getElementById('vendaQtd').value) || 0; if(!prodId||qtd<=0){ toast('Selecione produto e quantidade válida','warn'); return; } const prod = getData('produtos').find(p=>p.id===prodId); if(!prod){ toast('Produto inválido','erro'); return; } const estoque = getData('estoque'); if(lote){ const reg = estoque.find(s=>s.produtoId===prodId && s.lote===lote); if(!reg||reg.qtd<qtd){ toast('Estoque insuficiente no lote','warn'); return; } } else { const total = estoque.filter(s=>s.produtoId===prodId).reduce((a,b)=>a+b.qtd,0); if(total<qtd){ toast('Estoque insuficiente','warn'); return; } } const preco = prod.precoVenda; const total = Number((preco * qtd).toFixed(2)); vendaTempItens.push({ produtoId:prodId, produtoNome:prod.nome, lote, qtd, preco, total }); renderItensVenda(); toast('Item adicionado','sucesso'); }

function renderItensVenda(){ const tbody = document.getElementById('vendaItensTable'); if(!tbody) return; tbody.innerHTML=''; let subtotal=0; vendaTempItens.forEach((it,idx)=>{ subtotal += it.total; const tr = document.createElement('tr'); tr.className='border-t'; tr.innerHTML = `<td class="p-2">${it.produtoNome}</td><td class="p-2">${it.lote||''}</td><td class="p-2">${it.qtd}</td><td class="p-2">${formatMoney(it.preco)}</td><td class="p-2">${formatMoney(it.total)}</td><td class="p-2"><button class="bg-red-500 text-white px-2 py-1 rounded" onclick="removerItemVenda(${idx})">Remover</button></td>`; tbody.appendChild(tr); }); const descontoPct = Number(document.getElementById('vendaDesconto')? document.getElementById('vendaDesconto').value : 0) || 0; const frete = Number(document.getElementById('vendaFrete')? document.getElementById('vendaFrete').value : 0) || 0; const descontoVal = Number((subtotal*(descontoPct/100)).toFixed(2)); const total = Number((subtotal - descontoVal + frete).toFixed(2)); document.getElementById('vendaSubtotal').innerText = formatMoney(subtotal); document.getElementById('vendaDescontoVal').innerText = formatMoney(descontoVal); document.getElementById('vendaFreteVal').innerText = formatMoney(frete); document.getElementById('vendaTotal').innerText = formatMoney(total); }

window.removerItemVenda = function(i){ vendaTempItens.splice(i,1); renderItensVenda(); };

function gerarNumeroVenda(){ const arr = getData('vendas'); const n = arr.length + 1; return `VEN-${String(n).padStart(4,'0')}`; }

function finalizarVenda(){ if(!vendaTempItens.length) return toast('Adicione itens antes de finalizar','warn'); const clienteId = document.getElementById('vendaCliente').value || null; const descontoPct = Number(document.getElementById('vendaDesconto')? document.getElementById('vendaDesconto').value:0) || 0; const frete = Number(document.getElementById('vendaFrete')? document.getElementById('vendaFrete').value:0) || 0; let subtotal=0; let lucro=0; vendaTempItens.forEach(it=>{ subtotal += it.total; const prod = getData('produtos').find(p=>p.id===it.produtoId); if(prod) lucro += (prod.precoVenda - prod.precoCusto)*it.qtd; }); const descontoVal = Number((subtotal*(descontoPct/100)).toFixed(2)); const total = Number((subtotal - descontoVal + frete).toFixed(2)); const vendas = getData('vendas'); const codigo = gerarNumeroVenda(); const vendaObj = { id:gerarId('VND'), codigo, clienteId, data:new Date().toISOString(), itens:vendaTempItens.slice(), subtotal, descontoPct, descontoVal, frete, total, lucro, pagamento: document.getElementById('vendaPagamento').value || 'dinheiro', revertida:false };
  // ajustar estoque
  let estoque = getData('estoque'); vendaTempItens.forEach(it=>{ let rem = it.qtd; if(it.lote){ const reg = estoque.find(s=>s.produtoId===it.produtoId && s.lote===it.lote); if(reg){ reg.qtd = Number((reg.qtd - it.qtd).toFixed(3)); if(reg.qtd<0) reg.qtd=0; } } else { for(let i=0;i<estoque.length && rem>0;i++){ const reg = estoque[i]; if(reg.produtoId!==it.produtoId) continue; const take = Math.min(rem, reg.qtd); reg.qtd = Number((reg.qtd - take).toFixed(3)); rem -= take; } if(rem>0){ /* ignored */ } } }); setData('estoque', estoque);
  vendas.push(vendaObj); setData('vendas', vendas); vendaTempItens = []; renderItensVenda(); renderVendasList(); renderEstoque(); renderDashboard(); toast(`Venda ${codigo} registrada`,'sucesso'); }

function renderVendasList(){ const el = document.getElementById('vendasTable'); if(!el) return; const arr = getData('vendas'); if(!arr.length){ el.innerHTML = '<p class="text-gray-600">Nenhuma venda registrada.</p>'; return; } let html = '<table class="w-full bg-white rounded shadow"><thead class="bg-green-600 text-white"><tr><th class="p-2">Data</th><th>Código</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Ações</th></tr></thead><tbody>'; arr.slice().reverse().forEach(v=>{ const cliente = v.clienteId ? (getData('clientes').find(c=>c.id===v.clienteId)||{}).nome : 'Consumidor Final'; html += `<tr class="border-t"><td class="p-2">${new Date(v.data).toLocaleString()}</td><td class="p-2">${v.codigo}</td><td class="p-2">${cliente}</td><td class="p-2">${v.itens.length}</td><td class="p-2">${formatMoney(v.total)}</td><td class="p-2"><button class="bg-yellow-600 text-white px-2 py-1 rounded mr-1" onclick="reverterVenda('${v.id}')">Reverter</button><button class="bg-blue-500 text-white px-2 py-1 rounded" onclick="detalharVenda('${v.id}')">Detalhar</button></td></tr>`; }); html += '</tbody></table>'; el.innerHTML = html; }

window.detalharVenda = function(id){ const v = getData('vendas').find(x=>x.id===id); if(!v) return toast('Venda não encontrada','erro'); let html = `<div class="p-4 bg-white rounded shadow"><h3 class="font-semibold">Detalhes ${v.codigo}</h3><p>Data: ${new Date(v.data).toLocaleString()}</p><p>Pagamento: ${v.pagamento}</p><p>Itens:</p><ul>`; v.itens.forEach(it=> html += `<li>${it.produtoNome} — ${it.qtd} (${it.lote||'sem lote'}) — ${formatMoney(it.total)}</li>`); html += `</ul><p>Total: ${formatMoney(v.total)}</p><div class="mt-2"><button onclick="document.getElementById('modalVendaDetalhe').remove()" class="px-3 py-1 rounded bg-gray-200">Fechar</button></div></div>`; const modal = document.createElement('div'); modal.id='modalVendaDetalhe'; modal.style.position='fixed'; modal.style.left='0'; modal.style.top='0'; modal.style.right='0'; modal.style.bottom='0'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center'; modal.style.background='rgba(0,0,0,0.4)'; modal.innerHTML = html; document.body.appendChild(modal); };

window.reverterVenda = function(id){ if(!confirm('Deseja reverter esta venda? O estoque será ajustado.')) return; const arr = getData('vendas'); const v = arr.find(x=>x.id===id); if(!v) return toast('Venda não encontrada','erro'); if(v.revertida){ toast('Venda já revertida','info'); return; } let estoque = getData('estoque'); v.itens.forEach(it=>{ if(it.lote){ const reg = estoque.find(s=>s.produtoId===it.produtoId && s.lote===it.lote); if(reg){ reg.qtd = Number((reg.qtd + it.qtd).toFixed(3)); } else { estoque.push({ produtoId: it.produtoId, lote: it.lote||'RETORNO', qtd: it.qtd, updated: new Date().toISOString() }); } } else { const reg = estoque.find(s=>s.produtoId===it.produtoId && s.lote==='RETORNO'); if(reg) reg.qtd = Number((reg.qtd + it.qtd).toFixed(3)); else estoque.push({ produtoId: it.produtoId, lote:'RETORNO', qtd: it.qtd, updated: new Date().toISOString() }); } }); v.revertida = true; setData('vendas', arr); setData('estoque', estoque); renderVendasList(); renderEstoque(); renderDashboard(); toast('Venda revertida e estoque ajustado','sucesso'); };

// ---------- Modal Novo Cliente (vendas) ----------
function openModalNovoCliente(){ const modal = document.getElementById('modalNovoCliente'); if(!modal) return; modal.classList.remove('hidden'); modal.classList.add('flex'); }
function closeModalNovoCliente(){ const modal = document.getElementById('modalNovoCliente'); if(!modal) return; modal.classList.remove('flex'); modal.classList.add('hidden'); }

const formModal = document.getElementById('formModalCliente'); if(formModal){ formModal.addEventListener('submit', e=>{ e.preventDefault(); const nome = document.getElementById('modalNome').value.trim(); const celular = document.getElementById('modalCelular').value.trim(); const cpf = document.getElementById('modalCPF').value.trim(); if(!nome||onlyNumbers(celular).length<10||onlyNumbers(cpf).length!==11){ toast('Verifique os dados do cliente','erro'); return; } const arr = getData('clientes'); if(arr.some(c=> onlyNumbers(c.cpf)===onlyNumbers(cpf) || onlyNumbers(c.celular)===onlyNumbers(celular))){ toast('CPF ou celular já cadastrado','erro'); return; } arr.push({ id:gerarId('CLI'), nome, celular, cpf }); setData('clientes', arr); closeModalNovoCliente(); atualizarClienteSelect(); toast('Cliente cadastrado','sucesso'); }); }
const modalCancelar = document.getElementById('modalCancelar'); if(modalCancelar) modalCancelar.addEventListener('click', ()=>{ closeModalNovoCliente(); });

// ---------- DASHBOARD ----------
function renderDashboard(){ const clientes = getData('clientes').length; const produtos = getData('produtos').length; const estoque = getData('estoque'); const totalEstoque = estoque.reduce((a,b)=>a + (Number(b.qtd)||0),0); const vendas = getData('vendas'); const totalVendas = vendas.reduce((s,v)=>s + (Number(v.total)||0),0); const container = document.getElementById('cardsDashboard'); if(!container) return; container.innerHTML = `<div class="bg-white p-4 rounded shadow text-center hover:scale-105 transition"><div class="text-sm text-gray-500">Clientes</div><div class="text-2xl font-bold text-green-700">${clientes}</div></div><div class="bg-white p-4 rounded shadow text-center hover:scale-105 transition"><div class="text-sm text-gray-500">Produtos</div><div class="text-2xl font-bold text-green-700">${produtos}</div></div><div class="bg-white p-4 rounded shadow text-center hover:scale-105 transition"><div class="text-sm text-gray-500">Estoque total (unid.)</div><div class="text-2xl font-bold text-green-700">${totalEstoque.toFixed(3)}</div></div><div class="bg-white p-4 rounded shadow text-center hover:scale-105 transition"><div class="text-sm text-gray-500">Total Vendas (R$)</div><div class="text-2xl font-bold text-green-700">${formatMoney(totalVendas)}</div></div>`; }

// initial render
renderClientes(); renderProdutos(); renderEstoque(); renderVendasList(); renderDashboard();

// expose for console/debug
window.toast = toast; window.gerarId = gerarId; window.openModalNovoCliente = openModalNovoCliente; window.fecharModal = closeModalNovoCliente;
