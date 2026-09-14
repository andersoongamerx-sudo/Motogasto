
import { Client, Account, TablesDB, ID, Query, Permission, Role } from 'https://cdn.jsdelivr.net/npm/appwrite@latest/+esm';

const ENDPOINT="https://nyc.cloud.appwrite.io/v1";
const PROJECT="6aa6f346003cb3186f6e";
const DB="motogasto";
const T={produtos:'produtos',checkins:'checkins',itens:'checkin_itens'};

const client=new Client().setEndpoint(ENDPOINT).setProject(PROJECT);
const account=new Account(client);
const db=new TablesDB(client);

let user=null, products=[], currentItems=[];
const $=s=>document.querySelector(s);
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const plateNorm=p=>(p||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const today=()=>new Date().toISOString().slice(0,10);

function bind(){
  $('#loginBtn').onclick=login; $('#signupBtn').onclick=signup; $('#logoutBtn').onclick=logout;
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  $('#saveProdBtn').onclick=saveProduct;
  $('#serviceProduct').onchange=productChanged;
  $('#addServiceBtn').onclick=addService;
  $('#saveCheckinBtn').onclick=saveCheckin;
  $('#applyVoiceBtn').onclick=applyVoice;
  $('#searchHistoryBtn').onclick=searchHistory;
  $('#loadReportBtn').onclick=loadReport;
  $('#exportBtn').onclick=exportCSV;
  setupMic();
}

function switchTab(id){
  document.querySelectorAll('.section').forEach(x=>x.classList.add('hidden'));
  $('#'+id).classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));
  if(id==='relatorios')loadReport();
}

async function login(){
  try{
    await account.createEmailPasswordSession({email:$('#email').value,password:$('#password').value});
    user=await account.get(); await showApp();
  }catch(e){$('#loginMsg').textContent=e.message}
}
async function signup(){
  try{
    await account.create({userId:ID.unique(),email:$('#email').value,password:$('#password').value});
    await login();
  }catch(e){$('#loginMsg').textContent=e.message}
}
async function logout(){try{await account.deleteSession({sessionId:'current'})}catch{};location.reload()}

async function list(table, queries=[]){
  const r=await db.listRows({databaseId:DB,tableId:table,queries:[Query.equal('userId',user.$id),...queries]});
  return r.rows||[];
}

async function showApp(){
  $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  $('#who').textContent=user.email;
  $('#checkinDate').value=today(); $('#reportDate').value=today();
  await refreshProducts();
}

async function refreshProducts(){
  products=await list(T.produtos);
  $('#serviceProduct').innerHTML='<option value="">Selecione um produto/serviço</option>'+products.map(p=>`<option value="${p.$id}">${p.nome} — ${money(p.valor)}</option>`).join('');
  $('#productsList').innerHTML=products.length?products.map(p=>`<div class="item"><b>${p.nome}</b> <span class="pill">${p.tipo}</span><br>${money(p.valor)}<br><span class="muted">${p.apelidos||''}</span></div>`).join(''):'Nenhum produto cadastrado.';
}

async function saveProduct(){
  const nome=$('#prodName').value.trim(),valor=Number($('#prodPrice').value);
  if(!nome||isNaN(valor)) return alert('Informe nome e valor.');
  await db.createRow({
    databaseId:DB,tableId:T.produtos,rowId:ID.unique(),
    data:{userId:user.$id,nome,tipo:$('#prodType').value,valor,apelidos:$('#prodAliases').value},
    permissions:[Permission.read(Role.user(user.$id)),Permission.update(Role.user(user.$id)),Permission.delete(Role.user(user.$id))]
  });
  $('#prodName').value=$('#prodPrice').value=$('#prodAliases').value='';
  await refreshProducts();
}

function productChanged(){
  const p=products.find(x=>x.$id===$('#serviceProduct').value);
  if(p) $('#servicePrice').value=Number(p.valor).toFixed(2);
}

function addService(){
  const p=products.find(x=>x.$id===$('#serviceProduct').value);
  const qty=Number($('#serviceQty').value||1);
  const price=Number($('#servicePrice').value);
  if(!p) return alert('Selecione um produto/serviço.');
  if(!qty||isNaN(price)) return alert('Confira quantidade e valor.');
  currentItems.push({productId:p.$id,nome:p.nome,quantidade:qty,valorUnitario:price,subtotal:qty*price});
  renderItems();
}

function renderItems(){
  $('#servicesList').innerHTML=currentItems.map((i,idx)=>`<div class="service-row">
    <div><b>${i.nome}</b></div>
    <div>${i.quantidade}x</div>
    <div>${money(i.subtotal)}</div>
    <button class="danger" data-del="${idx}">×</button>
  </div>`).join('');
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{currentItems.splice(Number(b.dataset.del),1);renderItems()});
  $('#checkinTotal').textContent=money(currentItems.reduce((s,i)=>s+i.subtotal,0));
}

async function saveCheckin(){
  const owner=$('#ownerName').value.trim();
  const model=$('#motoModel').value.trim();
  const plate=plateNorm($('#plate').value);
  const pilot=$('#pilotName').value.trim();
  const km=Number($('#km').value);
  const date=$('#checkinDate').value||today();
  const time=$('#arrivalTime').value||'';
  if(!owner||!model||!plate||!pilot||!km) return alert('Preencha dono, modelo, placa, piloto e KM.');
  if(!currentItems.length) return alert('Adicione pelo menos um serviço/produto.');

  const total=currentItems.reduce((s,i)=>s+i.subtotal,0);
  const checkinId=ID.unique();

  await db.createRow({
    databaseId:DB,tableId:T.checkins,rowId:checkinId,
    data:{
      userId:user.$id,dono:owner,modelo:model,placa:plate,piloto:pilot,km,
      data:date,horaChegada:time,total,observacao:$('#checkinObs').value
    },
    permissions:[Permission.read(Role.user(user.$id)),Permission.update(Role.user(user.$id)),Permission.delete(Role.user(user.$id))]
  });

  for(const item of currentItems){
    await db.createRow({
      databaseId:DB,tableId:T.itens,rowId:ID.unique(),
      data:{
        userId:user.$id,checkinId,placa:plate,data:date,
        productId:item.productId,nome:item.nome,quantidade:item.quantidade,
        valorUnitario:item.valorUnitario,subtotal:item.subtotal
      },
      permissions:[Permission.read(Role.user(user.$id)),Permission.update(Role.user(user.$id)),Permission.delete(Role.user(user.$id))]
    });
  }

  alert('Check-in salvo com sucesso.');
  clearCheckin();
}

function clearCheckin(){
  $('#ownerName').value=$('#motoModel').value=$('#plate').value=$('#pilotName').value=$('#km').value=$('#arrivalTime').value=$('#checkinObs').value='';
  $('#checkinDate').value=today();
  currentItems=[];renderItems();
}

function setupMic(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){$('#micBtn').textContent='🎙️ Voz não suportada neste navegador';$('#micBtn').disabled=true;return}
  const r=new SR();r.lang='pt-BR';r.interimResults=false;r.continuous=false;
  r.onresult=e=>$('#voiceText').value=e.results[0][0].transcript;
  r.onerror=e=>alert('Erro de voz: '+e.error);
  $('#micBtn').onclick=()=>{r.start();$('#micBtn').textContent='🎙️ Ouvindo...'};
  r.onend=()=>$('#micBtn').textContent='🎙️ Falar';
}

const numWords={um:1,uma:1,dois:2,duas:2,'três':3,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10};
function qtyBefore(text,term){
  const idx=text.toLowerCase().indexOf(term.toLowerCase());if(idx<0)return 1;
  const left=text.slice(Math.max(0,idx-30),idx).toLowerCase();
  const m=left.match(/(\d+|um|uma|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove|dez)\s*$/);
  return m?(Number(m[1])||numWords[m[1]]||1):1;
}

function extractField(text,labelPatterns){
  for(const re of labelPatterns){
    const m=text.match(re); if(m) return m[1].trim();
  }
  return '';
}

function applyVoice(){
  const text=$('#voiceText').value.trim();
  if(!text) return alert('Fale ou digite as informações.');

  const plateMatch=text.toUpperCase().match(/\b[A-Z]{3}\s*[- ]?\s*[0-9A-Z]{4}\b/);
  const owner=extractField(text,[/dono(?: da moto)?\s+([^,.;]+)/i]);
  const pilot=extractField(text,[/piloto\s+([^,.;]+)/i,/condutor\s+([^,.;]+)/i]);
  const model=extractField(text,[/moto(?: modelo)?\s+([^,.;]+)/i,/modelo\s+([^,.;]+)/i]);
  const kmMatch=text.match(/(?:km|quilometragem)\s*[:\-]?\s*([\d\.]+)/i);

  if(owner) $('#ownerName').value=owner;
  if(pilot) $('#pilotName').value=pilot;
  if(model) $('#motoModel').value=model;
  if(plateMatch) $('#plate').value=plateNorm(plateMatch[0]);
  if(kmMatch) $('#km').value=kmMatch[1].replace(/\./g,'');

  let found=[];
  for(const p of products){
    const terms=[p.nome,...(p.apelidos||'').split(',')].map(x=>x.trim()).filter(Boolean);
    const term=terms.find(t=>text.toLowerCase().includes(t.toLowerCase()));
    if(term){
      const q=qtyBefore(text,term);
      let price=Number(p.valor);
      const after=text.slice(text.toLowerCase().indexOf(term.toLowerCase())+term.length, text.toLowerCase().indexOf(term.toLowerCase())+term.length+30);
      const priceMatch=after.match(/(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)\s*(?:reais|real)?/i);
      if(priceMatch) price=Number(priceMatch[1].replace(',','.'));
      found.push({productId:p.$id,nome:p.nome,quantidade:q,valorUnitario:price,subtotal:q*price});
    }
  }

  if(found.length){currentItems.push(...found);renderItems();}
  $('#voiceResult').innerHTML='<div class="ok">Informações reconhecidas foram colocadas no CHECK-IN. Confira antes de salvar.</div>';
  switchTab('checkin');
}

async function searchHistory(){
  const plate=plateNorm($('#historyPlate').value);
  if(!plate) return alert('Digite a placa.');
  const rows=await list(T.checkins,[Query.equal('placa',plate),Query.orderDesc('data')]);
  if(!rows.length){$('#historyResult').innerHTML='<p class="muted">Nenhum check-in encontrado.</p>';return}
  const html=[];
  for(const c of rows){
    const items=await list(T.itens,[Query.equal('checkinId',c.$id)]);
    html.push(`<div class="item">
      <b>${c.data} — ${c.placa}</b><br>
      Dono: ${c.dono}<br>
      Moto: ${c.modelo}<br>
      Piloto: ${c.piloto}<br>
      KM: ${Number(c.km).toLocaleString('pt-BR')}<br>
      Hora chegada: ${c.horaChegada||'-'}<br><br>
      <b>Serviços:</b><br>
      ${items.map(i=>`${i.quantidade}x ${i.nome} — ${money(i.subtotal)}`).join('<br>')}
      <hr><b>Total: ${money(c.total)}</b>
    </div>`);
  }
  $('#historyResult').innerHTML=html.join('');
}

async function loadReport(){
  const date=$('#reportDate').value||today();
  const rows=await list(T.checkins,[Query.equal('data',date),Query.orderDesc('$createdAt')]);
  window._reportRows=rows;
  if(!rows.length){$('#reportResult').innerHTML='<p class="muted">Nenhum check-in no dia.</p>';return}
  let total=0;
  $('#reportResult').innerHTML=rows.map(c=>{total+=Number(c.total);return `<div class="item"><b>${c.placa}</b> — ${c.modelo}<br>Piloto: ${c.piloto} | KM: ${Number(c.km).toLocaleString('pt-BR')}<br>Total: ${money(c.total)}</div>`}).join('')+`<div class="big">TOTAL DO DIA: ${money(total)}</div>`;
}

function exportCSV(){
  const rows=window._reportRows||[];
  let csv='Data;Placa;Dono;Modelo;Piloto;KM;Hora Chegada;Total\n';
  for(const c of rows) csv+=`${c.data};${c.placa};"${c.dono}";"${c.modelo}";"${c.piloto}";${c.km};${c.horaChegada||''};${Number(c.total).toFixed(2).replace('.',',')}\n`;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download=`motogasto-${$('#reportDate').value||today()}.csv`;a.click();
}

async function boot(){
  bind(); $('#checkinDate').value=today(); $('#reportDate').value=today();
  try{user=await account.get();await showApp()}catch{}
}
boot();
