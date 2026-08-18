// Wildflower Hub — global quick-capture
// A floating "+" available on every page (loaded alongside nav.js and
// hub-auth.js) so nothing has to wait for a trip to the right page to get
// captured. Adds directly to the same Google Tasks lists / journal /
// goals board that the real pages use — nothing is a separate, orphaned
// store.

(function(){
  const SUPABASE_URL = 'https://trwprtzbcuoqydgjphpr.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_4CT647Bp6_UUUd4ipLOAmA_D5Z8Ml1Z';
  const AUTH_FN_URL = `${SUPABASE_URL}/functions/v1/google-tasks-auth`;
  const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1';
  const WEEKLY_LIST_TITLE = 'Weekly To-Dos (Wildflower Hub)';

  const isoDate = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const todayStr = isoDate(new Date());

  async function callAuthFn(body){
    const res = await fetch(AUTH_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if(!res.ok || data.error) throw new Error(data.error || ('HTTP '+res.status));
    return data;
  }

  let cachedToken = null;
  async function getAccessToken(){
    if(cachedToken) return cachedToken;
    const result = await callAuthFn({ action: 'access_token' });
    if(!result.connected) return null;
    cachedToken = result.access_token;
    return cachedToken;
  }

  let cachedWeeklyListId = null;
  async function getWeeklyListId(token){
    if(cachedWeeklyListId) return cachedWeeklyListId;
    const res = await fetch(`${TASKS_BASE}/users/@me/lists`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const existing = (data.items||[]).find(l=>l.title===WEEKLY_LIST_TITLE);
    if(existing){ cachedWeeklyListId = existing.id; return existing.id; }
    const createRes = await fetch(`${TASKS_BASE}/users/@me/lists`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: WEEKLY_LIST_TITLE })
    });
    const created = await createRes.json();
    cachedWeeklyListId = created.id;
    return created.id;
  }

  async function addTodoToday(title){
    const token = await getAccessToken();
    if(!token) throw new Error('not_connected');
    await fetch(`${TASKS_BASE}/lists/@default/tasks`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    window.hubCacheClear && window.hubCacheClear('tasks_list');
    window.hubCacheClear && window.hubCacheClear('landing_stats');
  }
  async function addTodoWeekly(title){
    const token = await getAccessToken();
    if(!token) throw new Error('not_connected');
    const listId = await getWeeklyListId(token);
    await fetch(`${TASKS_BASE}/lists/${listId}/tasks`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    window.hubCacheClear && window.hubCacheClear('weekly_tasks_list');
  }
  async function addJournalNote(text){
    const raw = await window.hubGet('journal');
    const data = raw ? JSON.parse(raw) : { entries:{} };
    data.entries = data.entries || {};
    const existing = data.entries[todayStr] || { text:'', mood:null, tags:[] };
    existing.text = existing.text ? existing.text + '\n' + text : text;
    data.entries[todayStr] = existing;
    await window.hubSet('journal', JSON.stringify(data));
  }
  async function addGoal(title){
    const raw = await window.hubGet('goals_board');
    const data = raw ? JSON.parse(raw) : { cards: [] };
    data.cards = data.cards || [];
    data.cards.push({
      id: 'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
      title, notes:'', column:'not-started', linkedTasks:[], createdAt: new Date().toISOString()
    });
    await window.hubSet('goals_board', JSON.stringify(data));
    window.hubCacheClear && window.hubCacheClear('landing_stats');
  }

  const TYPES = [
    { key:'todo-today',  label:'to-do — today',      placeholder:"what needs doing today…" },
    { key:'todo-weekly', label:'to-do — this week',  placeholder:"what needs doing sometime this week…" },
    { key:'journal',     label:'journal note',       placeholder:"quick thought for today's entry…" },
    { key:'goal',        label:'new goal',           placeholder:"what's the goal…" },
  ];

  function injectStyles(){
    const style = document.createElement('style');
    style.textContent = `
      #qcFab{ position:fixed; bottom:22px; right:22px; z-index:40; width:48px; height:48px; border-radius:0;
        background: var(--moss,#5C7A52); color:#fff; border:1px solid var(--moss-deep,#3B5636); font-family:'JetBrains Mono',monospace; font-size:22px; line-height:1; cursor:pointer;
        box-shadow: 0 8px 22px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; }
      #qcFab:hover{ background: var(--moss-deep,#3B5636); }
      #qcOverlay{ position:fixed; inset:0; z-index:45; display:flex; align-items:flex-end; justify-content:center;
        background: rgba(47,66,50,0.45); padding:0; }
      @media (min-width:600px){ #qcOverlay{ align-items:center; } }
      #qcPanel{ background: var(--parchment,#F6F0DE); border-radius:0; padding:20px 22px 26px; max-width:420px; width:100%;
        box-shadow:0 -10px 40px rgba(0,0,0,0.3); border:1px solid rgba(70,57,44,0.35); border-bottom:none; }
      @media (min-width:600px){ #qcPanel{ border-bottom:1px solid rgba(70,57,44,0.35); } }
      #qcPanel h4{ font-family:'Fraunces',serif; font-style:italic; font-weight:700; font-size:18px; color: var(--forest,#2F4232); margin:0 0 10px; text-transform:lowercase; }
      .qc-types{ display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }
      .qc-type-btn{ background:#fff; border:1px solid rgba(70,57,44,0.35); border-radius:0; padding:6px 12px;
        font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:500; color: var(--muted,#8a7d64); cursor:pointer; text-transform:lowercase; }
      .qc-type-btn.is-active{ background: var(--moss,#5C7A52); color:#fff; border-color: var(--moss,#5C7A52); }
      #qcInput{ width:100%; box-sizing:border-box; font-family:'JetBrains Mono',monospace; font-size:13.5px; padding:10px 12px;
        border:1px solid rgba(70,57,44,0.35); border-radius:0; margin-bottom:10px; }
      #qcSaveBtn{ background: var(--honey,#D6A94A); color:#4a3b12; border:none; font-weight:700; font-size:13px;
        padding:10px 18px; border-radius:0; cursor:pointer; text-transform:lowercase; }
      #qcSaveBtn:hover{ filter:brightness(0.95); }
      #qcCloseBtn{ background:none; border:none; color: var(--muted,#8a7d64); font-family:'JetBrains Mono',monospace; font-size:12px; cursor:pointer; float:right; text-transform:lowercase; }
      #qcStatus{ font-family:'JetBrains Mono',monospace; font-size:11px; color: var(--muted,#8a7d64); margin-top:8px; min-height:14px; }
    `;
    document.head.appendChild(style);
  }

  let activeType = 'todo-today';

  function openPanel(){
    if(document.getElementById('qcOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'qcOverlay';
    overlay.innerHTML = `
      <div id="qcPanel">
        <button id="qcCloseBtn">close ✕</button>
        <h4>quick capture</h4>
        <div class="qc-types">${TYPES.map(t=>`<button class="qc-type-btn ${t.key===activeType?'is-active':''}" data-type="${t.key}">${t.label}</button>`).join('')}</div>
        <input type="text" id="qcInput" placeholder="${TYPES.find(t=>t.key===activeType).placeholder}" autofocus>
        <button id="qcSaveBtn">+ add</button>
        <div id="qcStatus"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = document.getElementById('qcInput');
    input.focus();

    overlay.querySelectorAll('.qc-type-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        activeType = btn.dataset.type;
        overlay.querySelectorAll('.qc-type-btn').forEach(b=>b.classList.toggle('is-active', b===btn));
        input.placeholder = TYPES.find(t=>t.key===activeType).placeholder;
        input.focus();
      });
    });

    document.getElementById('qcCloseBtn').addEventListener('click', ()=>overlay.remove());
    overlay.addEventListener('click', (ev)=>{ if(ev.target===overlay) overlay.remove(); });

    async function submit(){
      const text = input.value.trim();
      if(!text) return;
      const status = document.getElementById('qcStatus');
      status.textContent = 'saving…';
      input.disabled = true;
      try{
        if(activeType==='todo-today') await addTodoToday(text);
        else if(activeType==='todo-weekly') await addTodoWeekly(text);
        else if(activeType==='journal') await addJournalNote(text);
        else if(activeType==='goal') await addGoal(text);
        status.textContent = 'added ✓';
        input.value = '';
      } catch(e){
        status.textContent = (e.message==='not_connected')
          ? "connect Google from the To-Dos page first for to-dos"
          : "couldn't save — try again";
      }
      input.disabled = false;
      input.focus();
      setTimeout(()=>{ if(status) status.textContent=''; }, 2200);
    }
    document.getElementById('qcSaveBtn').addEventListener('click', submit);
    input.addEventListener('keydown', ev=>{ if(ev.key==='Enter') submit(); });
  }

  function init(){
    // Skip on pages that don't have the lock/lookup infra yet, or if
    // something else already added a FAB.
    if(document.getElementById('qcFab')) return;
    injectStyles();
    const fab = document.createElement('button');
    fab.id = 'qcFab';
    fab.title = 'quick capture';
    fab.innerHTML = '+';
    fab.addEventListener('click', openPanel);
    document.body.appendChild(fab);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
