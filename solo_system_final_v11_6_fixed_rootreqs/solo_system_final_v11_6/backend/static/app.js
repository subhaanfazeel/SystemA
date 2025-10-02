/* app.js - Solo System v5 (cleaned) */
const VERSION = "v5";
const API = (p)=>`/api${p}`;
let STATE = { data:null, current:'main', notified:{} };

function el(id){ return document.getElementById(id); }
function setVh(){ document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px'); }
window.addEventListener('resize', setVh);
window.addEventListener('orientationchange', setVh);
setVh();

async function apiGet(path){ const r = await fetch(API(path)); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
async function apiPost(path, body){ const r = await fetch(API(path), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body||{}) }); return r.json(); }

function setActive(view){
  STATE.current = view;
  document.querySelectorAll('main > section').forEach(s=>s.classList.add('hidden'));
  const t = el(view); if(t) t.classList.remove('hidden');
  document.querySelectorAll('.dock-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  // always call renderer so content populates
  switch(view){
    case 'tasks': renderTasks(); break;
    case 'nonneg': renderNonneg(); break;
    case 'shop': renderShop(); break;
    case 'diary': renderDiary(); break;
    case 'stats': renderStats(); break;
    case 'settings': renderSettings(); break;
    default: renderMain(); break;
  }
}

function playSound(){ try{ if(!STATE.data || !STATE.data.settings || !STATE.data.settings.sounds) return; const p = el('ping'); p.currentTime = 0; p.play().catch(()=>{}); }catch(e){} }

function fmtDeadline(dl){
  if(!dl) return '';
  if(dl.indexOf('T')===-1 && dl.indexOf(' ')!==-1) dl = dl.replace(' ','T');
  const target = new Date(dl);
  if(isNaN(target)) return '<span class="deadline fail">BAD DATE</span>';
  const diff = target - new Date();
  if(diff < 0) return '<span class="deadline fail">FAILED</span>';
  const days = Math.floor(diff/86400000);
  const hours = Math.floor(diff/3600000);
  if(days > 0) return '<span class="deadline">'+days+'d left</span>';
  if(hours <= 6) return '<span class="deadline soon">'+hours+'h left</span>';
  return '<span class="deadline">'+hours+'h left</span>';
}

/* Renderers (unchanged logic, cleaned) */
function renderMain(){
  const d = STATE.data || {};
  const root = el('main');
  if(!root) return;
  root.innerHTML = '';
  const row = document.createElement('div'); row.className='row'; row.style.justifyContent='space-between';
  row.innerHTML = '<div class="badge">Streak: '+(d.streak||0)+' </div><div class="badge">Best: '+(d.best_streak||0)+'</div><div class="badge">Coins: '+((d.shop&&d.shop.coins)||0)+'</div>';
  root.appendChild(row);
  const h3 = document.createElement('h3'); h3.style.marginTop='12px'; h3.textContent='Non-Negotiables'; root.appendChild(h3);
  const ul = document.createElement('ul'); ul.className='list';
  const nn = (d.non_negotiables||[]);
  if(nn.length===0){ const li=document.createElement('li'); li.textContent='None yet'; ul.appendChild(li); }
  else { nn.forEach(n=>{ const li=document.createElement('li'); li.textContent = n.text; ul.appendChild(li); }); }
  root.appendChild(ul);
}

function renderTasks(){
  const d = STATE.data || {};
  const root = el('tasks'); if(!root) return; root.innerHTML='';
  const h = document.createElement('h3'); h.textContent='Tasks'; root.appendChild(h);

  const inputRow = document.createElement('div'); inputRow.className='row';
  const tInput = document.createElement('input'); tInput.id='newTask'; tInput.className='input'; tInput.placeholder='New task';
  const dlInput = document.createElement('input'); dlInput.id='newDeadline'; dlInput.className='input'; dlInput.placeholder='Deadline YYYY-MM-DD HH:MM (optional)';
  inputRow.appendChild(tInput); inputRow.appendChild(dlInput);
  root.appendChild(inputRow);

  const rewardRow = document.createElement('div'); rewardRow.className='row mt12';
  const coins = document.createElement('input'); coins.id='newCoins'; coins.className='input'; coins.placeholder='Coins reward (default 5)'; coins.style.width='120px';
  const xp = document.createElement('input'); xp.id='newXp'; xp.className='input'; xp.placeholder='XP reward (default 0)'; xp.style.width='120px';
  const stat = document.createElement('select'); stat.id='newStat'; stat.className='input'; stat.style.width='160px';
  ['discipline','strength','intelligence','spirituality'].forEach(s=>{ const o = document.createElement('option'); o.value=s; o.textContent = s.charAt(0).toUpperCase()+s.slice(1); stat.appendChild(o); });
  const addBtn = document.createElement('button'); addBtn.className='btn'; addBtn.textContent='Add'; addBtn.onclick = addTask;
  rewardRow.appendChild(coins); rewardRow.appendChild(xp); rewardRow.appendChild(stat); rewardRow.appendChild(addBtn);
  root.appendChild(rewardRow);

  const ul = document.createElement('ul'); ul.className='list';
  const tasks = d.tasks || [];
  if(tasks.length===0){ const li=document.createElement('li'); li.textContent='No tasks yet'; ul.appendChild(li); }
  tasks.forEach((t,i)=>{ 
    const li = document.createElement('li'); li.id = 'task-'+i;
    const title = document.createElement('div'); title.innerHTML = (t.done? '✅ ' : '⬜ ') + '<strong>'+t.task+'</strong>' + (t.deadline? ' ' + fmtDeadline(t.deadline):'');
    li.appendChild(title);
    const meta = document.createElement('div'); meta.className='muted'; meta.textContent = 'coins:'+ (t.coins||0) + ' xp:'+ (t.xp||0) + ' → ' + (t.stat||'discipline');
    li.appendChild(meta);
    const actions = document.createElement('div'); actions.className='row mt12';
    const toggle = document.createElement('button'); toggle.className='btn'; toggle.textContent = t.done? 'Mark Undone':'Mark Done'; toggle.onclick = ()=>toggleTask(i);
    const edit = document.createElement('button'); edit.className='btn'; edit.textContent='Edit'; edit.onclick = ()=>startEditTask(i);
    const del = document.createElement('button'); del.className='btn'; del.textContent='Delete'; del.onclick = ()=>deleteTask(i);
    actions.appendChild(toggle); actions.appendChild(edit); actions.appendChild(del);
    li.appendChild(actions);
    ul.appendChild(li);
  });
  root.appendChild(ul);
}

function renderNonneg(){
  const d = STATE.data || {};
  const root = el('nonneg'); if(!root) return; root.innerHTML='';
  const h = document.createElement('h3'); h.textContent='Non-Negotiables'; root.appendChild(h);
  const row = document.createElement('div'); row.className='row';
  const inp = document.createElement('input'); inp.id='nnText'; inp.className='input'; inp.placeholder='Add rule';
  const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Add'; btn.onclick = addNon;
  row.appendChild(inp); row.appendChild(btn); root.appendChild(row);
  const ul = document.createElement('ul'); ul.className='list';
  const nn = (d.non_negotiables||[]);
  if(nn.length===0){ const li=document.createElement('li'); li.textContent='None yet'; ul.appendChild(li); }
  else { nn.forEach((n,i)=>{ const li=document.createElement('li'); li.id='nn-'+i; const inner = document.createElement('div'); inner.style.display='flex'; inner.style.justifyContent='space-between'; inner.style.alignItems='center'; const left = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = n.text; left.appendChild(strong); const meta = document.createElement('div'); meta.className='muted'; meta.style.fontSize='12px'; meta.textContent = 'created: '+(n.created||''); left.appendChild(meta); inner.appendChild(left); const right = document.createElement('div'); const edit = document.createElement('button'); edit.className='btn'; edit.textContent='Edit'; edit.onclick = ()=>startEditNon(i); const del = document.createElement('button'); del.className='btn'; del.textContent='Delete'; del.onclick = ()=>delNon(i); right.appendChild(edit); right.appendChild(del); inner.appendChild(right); li.appendChild(inner); ul.appendChild(li); }); }
  root.appendChild(ul);
}

/* startEditNon, saveEditNon etc. */
function startEditNon(i){
  const li = el('nn-'+i);
  const current = STATE.data.non_negotiables[i].text;
  li.innerHTML = '';
  const row = document.createElement('div'); row.className='row';
  const inp = document.createElement('input'); inp.className='input'; inp.id='edit-'+i; inp.value = current;
  const save = document.createElement('button'); save.className='btn'; save.textContent='Save'; save.onclick = async ()=>{ await saveEditNon(i); };
  const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancel'; cancel.onclick = ()=>loadData(true);
  row.appendChild(inp); row.appendChild(save); row.appendChild(cancel); li.appendChild(row);
}

async function saveEditNon(i){
  const val = document.getElementById('edit-'+i).value.trim();
  if(!val) return alert('Empty');
  await apiPost('/nonneg/edit/'+i, {rule: val});
  await loadData(true);
}

async function renderShop(){
  const r = await apiGet('/shop');
  const root = el('shop'); if(!root) return; root.innerHTML='';
  const h = document.createElement('h3'); h.textContent='Shop'; root.appendChild(h);
  const p = document.createElement('p'); p.textContent = 'Coins: '+((STATE.data&&STATE.data.shop&&STATE.data.shop.coins)||0); root.appendChild(p);
  const manage = document.createElement('button'); manage.className='btn'; manage.textContent='Manage Shop'; manage.onclick = async ()=>{ const name = prompt('Item name:'); if(!name) return; const price = prompt('Price (number):', '10'); const effect = prompt('Effect (skip_punishment,cheat_meal,extra_time,xp_boost):','cheat_meal'); const val = prompt('Effect value (minutes for extra_time, magnitude for xp_boost):','1'); await apiPost('/shop/add', {name, price: parseInt(price||0), effect, value: parseInt(val||0)}); await loadData(true); };
  root.appendChild(manage);
  const ul = document.createElement('ul'); ul.className='list';
  (r.catalog||[]).forEach(it=>{ const li=document.createElement('li'); li.textContent = it.name + ' - ' + it.price + ' coins'; const b = document.createElement('button'); b.className='btn'; b.textContent = "Buy"; b.onclick = ()=>buy(it.id); li.appendChild(b); const del = document.createElement('button'); del.className="btn"; del.textContent='Delete'; del.onclick = async ()=>{ if(confirm('Delete item?')){ await apiPost('/shop/delete/'+it.id); await loadData(true);} }; li.appendChild(del); ul.appendChild(li); });
  root.appendChild(ul);
}

function renderDiary(){
  const d = STATE.data || {};
  const root = el('diary'); if(!root) return; root.innerHTML='';
  const h = document.createElement('h3'); h.textContent='Diary'; root.appendChild(h);
  const row = document.createElement('div'); row.className='row';
  const inp = document.createElement('input'); inp.id='diaryText'; inp.className='input'; inp.placeholder='Write something…';
  const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Add'; btn.onclick = addDiary;
  row.appendChild(inp); row.appendChild(btn); root.appendChild(row);
  const ul = document.createElement('ul'); ul.className='list';
  (d.diary||[]).forEach(e=>{ const li=document.createElement('li'); li.textContent = (e.ts||'') + ' — ' + e.text; ul.appendChild(li); });
  root.appendChild(ul);
}

function renderStats(){
  const d = STATE.data || {};
  const sp = d.stat_progress || {};
  const root = el('stats'); root.innerHTML='';

  const h = document.createElement('h3'); h.textContent='Stats'; 
  root.appendChild(h);

  const ul = document.createElement('ul'); ul.className='list';
  const li1 = document.createElement('li'); 
  li1.textContent = 'Tasks completed: ' + (d.stats?.tasks_completed || 0); 
  ul.appendChild(li1);

  ['strength','intelligence','spirituality','discipline'].forEach(k=>{
    const li = document.createElement('li');
    const s = sp[k] || {level:1,xp:0};
    const lvl = document.createElement('div'); 
    lvl.textContent = k.charAt(0).toUpperCase()+k.slice(1)+ ' — Level ' + (s.level||1);

    const bar = document.createElement('div'); bar.className='xpbar';
    const fill = document.createElement('div'); fill.className='xpfill';
    const pct = Math.round(((s.xp||0) / (100*(s.level||1))) * 100);
    fill.style.width = (pct>100?100:pct) + '%';
    bar.appendChild(fill);

    li.appendChild(lvl);
    li.appendChild(bar);
    const small = document.createElement('small'); 
    small.textContent = (s.xp||0) + ' / ' + (100*(s.level||1)) + ' XP';
    li.appendChild(small);
    ul.appendChild(li);
  });

  root.appendChild(ul);
}


function renderSettings(){
  const s = (STATE.data && STATE.data.settings) || {};
  const root = el('settings'); if(!root) return; root.innerHTML='';
  const h = document.createElement('h3'); h.textContent='Settings'; root.appendChild(h);
  const lab = document.createElement('label'); const ck = document.createElement('input'); ck.type='checkbox'; ck.id='setSounds'; if(s.sounds) ck.checked=true; lab.appendChild(ck); lab.appendChild(document.createTextNode(' Sounds')); root.appendChild(lab);
  const div = document.createElement('div'); div.className='mt12';
  const saveB = document.createElement('button'); saveB.className='btn'; saveB.textContent='Save'; saveB.onclick = saveSettings;
  const resetB = document.createElement('button'); resetB.className='btn'; resetB.textContent='Reset'; resetB.onclick = resetAll;
  div.appendChild(saveB); div.appendChild(resetB); root.appendChild(div);
  const hr = document.createElement('hr'); hr.style.margin='12px 0'; hr.style.borderColor='rgba(0,255,255,0.04)'; root.appendChild(hr);
  const h4 = document.createElement('h4'); h4.textContent='Punishments'; root.appendChild(h4);
  const prow = document.createElement('div'); prow.className='row';
  const pinp = document.createElement('input'); pinp.id='punishmentInput'; pinp.className='input'; pinp.placeholder='Add a punishment (e.g. 10m cold shower)';
  const pbtn = document.createElement('button'); pbtn.className='btn'; pbtn.textContent='Add'; pbtn.onclick = addPunishment;
  prow.appendChild(pinp); prow.appendChild(pbtn); root.appendChild(prow);
  const pul = document.createElement('ul'); pul.className='list'; (STATE.data.punishments||[]).forEach((p,idx)=>{ const li=document.createElement('li'); li.textContent = p + ' '; const db=document.createElement('button'); db.className='btn'; db.textContent='Delete'; db.onclick = ()=>deletePunishment(idx); li.appendChild(db); pul.appendChild(li); }); root.appendChild(pul);
}

/* CRUD + helpers */
async function loadData(force=false){
  try {
    await apiPost('/ping').catch(()=>{});
    const r = await apiGet('/data');
    STATE.data = r.data;

    const greet = el('greet');
    if (STATE.data.name) {
      greet.textContent = 'Hey ' + STATE.data.name;
    } else {
      greet.innerHTML = '<input id="nameInline" class="input" placeholder="Enter your name (optional)" style="width:160px;display:inline-block;vertical-align:middle"> <button class="btn" onclick="saveName()">Save</button>';
    }

    checkOverdue();
    setActive(STATE.current);   // <-- forces re-render current panel
    return STATE.data;
  } catch (e) {
    console.error(e);
    el('main').innerHTML = '<p>Backend offline. Check server console.</p>';
    return {};
  }
}

async function saveName(){ const eln = document.getElementById('nameInline'); const val = eln ? eln.value.trim() : ''; await apiPost('/name', {name: val}); await loadData(true); }

async function addTask(){ const ti = document.getElementById('newTask'); const di = document.getElementById('newDeadline'); if(!ti) return; const t = ti.value.trim(); let dl_raw = di ? di.value.trim() : ''; let dl = dl_raw; if(dl && dl.indexOf('T')===-1 && dl.indexOf(' ')!==-1) dl = dl.replace(' ','T'); if(!t) return; const coins = parseInt(document.getElementById('newCoins').value) || 5; const xp = parseInt(document.getElementById('newXp').value) || 0; const stat = document.getElementById('newStat').value || 'discipline'; await apiPost('/tasks/add', {task:t, deadline:dl, coins: coins, xp: xp, stat: stat}); if(ti) ti.value=''; if(di) di.value=''; const nc = document.getElementById('newCoins'); if(nc) nc.value=''; const nx = document.getElementById('newXp'); if(nx) nx.value=''; await loadData(true); }
async function toggleTask(i){ await apiPost('/tasks/toggle/'+i); await loadData(true); }
function startEditTask(i){ const t = STATE.data.tasks[i]; const li = document.getElementById('task-'+i); if(!li) return; li.innerHTML=''; const row = document.createElement('div'); row.className='row'; row.style.flexDirection='column'; const itask = document.createElement('input'); itask.className='input'; itask.id='edit-task-'+i; itask.value = t.task; const idl = document.createElement('input'); idl.className='input'; idl.id='edit-deadline-'+i; idl.value = t.deadline || ''; const actionRow = document.createElement('div'); actionRow.className='row mt12'; const icoins = document.createElement('input'); icoins.className='input'; icoins.id='edit-coins-'+i; icoins.style.width='100px'; icoins.value = t.coins||0; const ixp = document.createElement('input'); ixp.className='input'; ixp.id='edit-xp-'+i; ixp.style.width='100px'; ixp.value = t.xp||0; const istat = document.createElement('select'); istat.className='input'; istat.id='edit-stat-'+i; istat.style.width='160px'; ['discipline','strength','intelligence','spirituality'].forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent = s; istat.appendChild(o); }); istat.value = t.stat || 'discipline'; const save = document.createElement('button'); save.className='btn'; save.textContent='Save'; save.onclick = ()=>saveEditTask(i); const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Cancel'; cancel.onclick = ()=>loadData(true); actionRow.appendChild(icoins); actionRow.appendChild(ixp); actionRow.appendChild(istat); actionRow.appendChild(save); actionRow.appendChild(cancel); row.appendChild(itask); row.appendChild(idl); row.appendChild(actionRow); li.appendChild(row); }

async function saveEditTask(i){ const task = document.getElementById('edit-task-'+i).value.trim(); const dl = document.getElementById('edit-deadline-'+i).value.trim(); const coins = parseInt(document.getElementById('edit-coins-'+i).value) || 0; const xp = parseInt(document.getElementById('edit-xp-'+i).value) || 0; const stat = document.getElementById('edit-stat-'+i).value || 'discipline'; await apiPost('/tasks/edit/'+i, {task:task, deadline: dl, coins: coins, xp: xp, stat: stat}); await loadData(true); }
async function deleteTask(i){ if(!confirm('Delete task?')) return; await apiPost('/tasks/delete/'+i); await loadData(true); }

async function addNon(){ const inp = document.getElementById('nnText'); const rule = inp ? inp.value.trim() : ''; if(!rule) return; await apiPost('/nonneg/add', {rule}); if(inp) inp.value=''; await loadData(true); }
async function delNon(i){ if(!confirm('Delete this non-negotiable?')) return; await apiPost('/nonneg/delete/'+i); await loadData(true); }

async function buy(id){ const r = await apiPost('/shop/buy/'+id); if(r.error) alert(r.error); await loadData(true); }
async function addDiary(){ const txtEl = document.getElementById('diaryText'); const txt = txtEl ? txtEl.value.trim() : ''; if(!txt) return; await apiPost('/diary/add', {entry: txt}); if(txtEl) txtEl.value = ''; await loadData(true); }
async function saveSettings(){ const soundsEl = document.getElementById('setSounds'); const sounds = soundsEl ? soundsEl.checked : false; await apiPost('/settings', {settings:{sounds}}); await loadData(true); alert('Saved'); }
async function resetAll(){ if(!confirm('Reset all data to defaults? This cannot be undone.')) return; await apiPost('/reset'); await loadData(true); alert('Reset complete'); }

async function addPunishment(){ const txtEl = document.getElementById('punishmentInput'); const txt = txtEl ? txtEl.value.trim() : ''; if(!txt) return alert('Enter a punishment'); await apiPost('/punishments/add', {punishment: txt}); if(txtEl) txtEl.value=''; await loadData(true); }
async function deletePunishment(idx){ if(!confirm('Delete punishment?')) return; await apiPost('/punishments/delete/'+idx); await loadData(true); }

/* overdue check & notification modal */
async function checkOverdue(){
  try {
    const tasks = (STATE.data && Array.isArray(STATE.data.tasks)) ? STATE.data.tasks : [];
    const now = Date.now();
    for (let t of tasks) {
      if (!t || !t.deadline) continue;
      if (t.__overdueNotified) continue; // don’t repeat

      let d = Date.parse(t.deadline);
      if (isNaN(d)) continue;

      if (d < now) {
        t.__overdueNotified = true;

        // Pick a punishment (if any)
        let punishmentText = "";
        if (STATE.data && Array.isArray(STATE.data.punishments) && STATE.data.punishments.length > 0) {
          const randomIndex = Math.floor(Math.random() * STATE.data.punishments.length);
          const chosen = STATE.data.punishments[randomIndex];
          punishmentText = `  Your punishment is: ${chosen}`;
        }

        // Show custom modal
        showNotification(
          "Missed deadline!",
          `You missed the task: ${t.task || "Unnamed Task"}${punishmentText}`
        );

        // Optionally inform backend
        if (typeof apiPost === 'function' && t.id !== undefined) {
          try { await apiPost('/tasks/mark_overdue/' + t.id); } catch(e) {}
        }
      }
    }
  } catch(e) {
    console.error("Overdue check failed:", e);
  }
}


/* Single Notification handler */
function showNotification(title, body, requireOk=true){
  const notif = document.getElementById("notif");
  const notifTitle = document.getElementById("notif-title");
  const notifBody = document.getElementById("notif-body");
  const okBtn = document.getElementById("notif-ok");
  if(!notif || !notifTitle || !notifBody || !okBtn) {
    // fallback
    try{ if(requireOk) alert((title||'') + '\n\n' + (body||'')); else console.info(title, body); } catch(e){}
    return;
  }
  notifTitle.textContent = title || "Notice";
  notifBody.textContent = body || "";
  if(requireOk){
    okBtn.style.display = 'inline-block';
    okBtn.onclick = () => { notif.classList.add('hidden'); notif.style.display='none'; };
  } else {
    okBtn.style.display = 'none';
  }
  notif.classList.remove('hidden');
  notif.style.display = 'flex';
}

function hideNotification(){
  const notif = document.getElementById("notif");
  const okBtn = document.getElementById("notif-ok");
  if(notif) notif.classList.add('hidden');
  if(okBtn) okBtn.style.display = 'none';
}

/* Dock hook -> uses setActive */
function bindDock(){
  document.querySelectorAll('.dock-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const view = btn.dataset.view;
      setActive(view);
    });
  });
}
async function resetAll(){
  if(!confirm('Reset all data to defaults? This cannot be undone.')) return;
  await apiPost('/reset');
  STATE.current = 'main'; // go back to home screen
  await loadData(true);
  alert('All data has been reset!');
}


/* init wrapper with fallback so UI never locks */
(function(){
  const FALLBACK_MS = 9000;
  async function safeInit(){
    let done=false;
    const to = setTimeout(()=>{ if(!done){ console.warn('init fallback triggered'); try{ document.querySelectorAll('button, input, a').forEach(n=>n.removeAttribute('disabled')); }catch(e){}; hideNotification(); } }, FALLBACK_MS);
    try {
      bindDock();
      if (typeof loadData === 'function') await loadData();
      // register service worker safely (non-blocking)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js?v'+VERSION).catch(()=>{});
      }
      done = true;
      clearTimeout(to);
    } catch(err) {
      console.error('safeInit error', err);
      done = true;
      clearTimeout(to);
    }
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') safeInit();
  else document.addEventListener('DOMContentLoaded', safeInit);
})();

/* periodic overdue checks */
setInterval(()=>{ try{ checkOverdue(); }catch(e){} }, 30000);

/* gentle fallback: hide stuck OK after 8s (does NOT simulate click) */
window.addEventListener('load', ()=> {
  setTimeout(()=> {
    const okBtn = document.getElementById('notif-ok');
    const notif = document.getElementById('notif');
    if(okBtn && notif && !notif.classList.contains('hidden')){
      console.warn('Hiding stuck notification OK button (fallback)');
      okBtn.style.display = 'none';
    }
  }, 8000);
});
