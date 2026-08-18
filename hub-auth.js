// Wildflower Hub — shared data access + passphrase gate
// Every page that reads/writes personal data (Ledger, To-Dos' linked goal,
// Goals, Journal) goes through this instead of talking to Supabase
// directly. The table itself now has zero anon-accessible RLS policies —
// this is the only door in, and it's locked behind a passphrase that's
// never written into any deployed file (you type it once, the browser
// remembers it in localStorage after that).

(function(){
  const SUPABASE_URL = 'https://trwprtzbcuoqydgjphpr.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_4CT647Bp6_UUUd4ipLOAmA_D5Z8Ml1Z';
  const FN_URL = `${SUPABASE_URL}/functions/v1/hub-data`;
  const STORAGE_KEY = 'hub_passphrase';

  async function callHubData(body){
    const passphrase = localStorage.getItem(STORAGE_KEY) || '';
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ ...body, passphrase })
    });
    const data = await res.json();
    if(res.status === 401){
      localStorage.removeItem(STORAGE_KEY);
      const err = new Error('unauthorized');
      err.code = 401;
      throw err;
    }
    if(!res.ok || data.error){
      throw new Error(data.error || ('HTTP '+res.status));
    }
    return data;
  }

  async function hubGet(key){
    const result = await callHubData({ action: 'get', key });
    return result.value;
  }
  async function hubSet(key, value){
    await callHubData({ action: 'set', key, value });
  }

  function showLockScreen(onUnlocked, errorMsg){
    const overlay = document.createElement('div');
    overlay.id = 'hubLockOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(47,66,50,0.92);padding:20px;';
    overlay.innerHTML = `
      <div style="background:var(--parchment,#F6F0DE);border-radius:0;border:1px solid rgba(70,57,44,0.35);padding:28px 26px;max-width:340px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,0.4);text-align:center;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--rose,#B4767E);margin-bottom:10px;">$ auth --required</div>
        <div style="font-family:'Fraunces',serif;font-style:italic;font-weight:700;font-size:19px;color:var(--forest,#2F4232);margin-bottom:4px;text-transform:lowercase;">this garden is private</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted,#8a7d64);margin-bottom:16px;">enter the passphrase to continue</div>
        ${errorMsg ? `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--clay,#C97B5A);margin-bottom:10px;">${errorMsg}</div>` : ''}
        <input type="password" id="hubPassInput" placeholder="passphrase" style="width:100%;font-family:'JetBrains Mono',monospace;font-size:14px;padding:10px 12px;border:1px solid rgba(70,57,44,0.35);border-radius:0;background:#fff;color:var(--bark,#46392C);box-sizing:border-box;margin-bottom:10px;">
        <button id="hubPassSubmit" style="width:100%;background:var(--moss,#5C7A52);color:#fff;border:none;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:13px;padding:10px;border-radius:0;cursor:pointer;text-transform:lowercase;">unlock</button>
      </div>`;
    document.body.appendChild(overlay);
    const input = document.getElementById('hubPassInput');
    input.focus();
    async function submit(){
      const val = input.value.trim();
      if(!val) return;
      localStorage.setItem(STORAGE_KEY, val);
      try{
        await callHubData({ action: 'get', key: 'settings' }); // validation ping
        overlay.remove();
        onUnlocked();
      } catch(e){
        overlay.remove();
        showLockScreen(onUnlocked, 'that passphrase didn\'t work — try again');
      }
    }
    document.getElementById('hubPassSubmit').addEventListener('click', submit);
    input.addEventListener('keydown', ev=>{ if(ev.key==='Enter') submit(); });
  }

  function hubRequireAuth(onReady){
    const stored = localStorage.getItem(STORAGE_KEY);
    if(!stored){ showLockScreen(onReady); return; }
    // Trust the stored value optimistically; individual hubGet/hubSet calls
    // will catch a 401 (e.g. passphrase rotated) and re-prompt below.
    onReady();
  }

  // ---- lightweight cache (localStorage) for external API data + AI results ----
  // Used with a "show cached instantly, then quietly revalidate" pattern:
  // pages render whatever's cached right away, fetch fresh data in the
  // background, and only re-render if something actually changed.
  function cacheRead(key){
    try{
      const raw = localStorage.getItem('hubcache:'+key);
      return raw ? JSON.parse(raw) : null; // { data, ts }
    } catch(e){ return null; }
  }
  function cacheWrite(key, data){
    try{ localStorage.setItem('hubcache:'+key, JSON.stringify({ data, ts: Date.now() })); }
    catch(e){ /* storage full or unavailable — fine, just skip caching */ }
  }
  function cacheAgeLabel(ts){
    const mins = Math.round((Date.now()-ts)/60000);
    if(mins < 1) return 'just now';
    if(mins === 1) return '1 minute ago';
    if(mins < 60) return mins+' minutes ago';
    const hrs = Math.round(mins/60);
    return hrs===1 ? '1 hour ago' : hrs+' hours ago';
  }

  function cacheClear(key){
    try{ localStorage.removeItem('hubcache:'+key); } catch(e){}
  }

  window.hubCacheRead = cacheRead;
  window.hubCacheWrite = cacheWrite;
  window.hubCacheClear = cacheClear;
  window.hubCacheAgeLabel = cacheAgeLabel;

  window.hubGet = hubGet;
  window.hubSet = hubSet;
  window.hubRequireAuth = hubRequireAuth;
  window.hubReauth = function(onReady){ showLockScreen(onReady); };
})();
