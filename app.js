/* ===== Konfigurasi ===== */
const ADMIN_PASSWORD = 'bukitlayang2026';
let isAdmin = false;
const adminListeners = [];

function onAdminChange(cb){ adminListeners.push(cb); }
function setAdmin(on){
  isAdmin = on;
  document.body.classList.toggle('admin-mode', on);
  const btn = document.getElementById('adminToggleBtn');
  if(btn){ btn.textContent = on ? 'mode admin' : 'masuk admin'; btn.classList.toggle('on', on); }
  adminListeners.forEach(cb=>cb(on));
}

/* ===== Penyimpanan (shared, terlihat semua pengunjung) ===== */
async function loadData(key, defaults){
  try{
    const res = await window.storage.get(key, true);
    if(res && res.value) return JSON.parse(res.value);
  }catch(e){ /* belum ada data, pakai default */ }
  const d = JSON.parse(JSON.stringify(defaults));
  try{ await window.storage.set(key, JSON.stringify(d), true); }catch(e){}
  return d;
}
async function saveData(key, data){
  try{
    const r = await window.storage.set(key, JSON.stringify(data), true);
    if(!r) throw new Error('empty result');
    toast('Perubahan tersimpan');
  }catch(e){
    toast('Gagal menyimpan, coba lagi');
  }
}

/* ===== Utilitas ===== */
function toast(msg){
  let t = document.getElementById('__toast');
  if(!t){
    t = document.createElement('div');
    t.id = '__toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._tm);
  toast._tm = setTimeout(()=>t.classList.remove('show'), 2200);
}
function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s == null ? '' : s;
  return d.innerHTML;
}
function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(r.result);
    r.onerror = ()=>reject(new Error('read failed'));
    r.readAsDataURL(file);
  });
}
function youtubeEmbed(url){
  const m = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

/* ===== Modal login admin ===== */
function injectLoginModal(){
  if(document.getElementById('loginModal')) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'loginModal';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Masuk sebagai admin</h3>
      <p class="hint">Masukkan kata sandi admin untuk mengedit menu, teks, gambar, video, dan peta.</p>
      <div class="field">
        <label>Kata sandi</label>
        <input type="password" id="pwInput" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;">
        <div class="err" id="pwErr">Kata sandi salah, coba lagi.</div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" style="color:var(--ink-soft);border-color:var(--line);" id="loginCancel">batal</button>
        <button class="btn btn-primary" id="loginSubmit">masuk</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) overlay.classList.remove('show'); });
  document.getElementById('loginCancel').addEventListener('click', ()=>overlay.classList.remove('show'));
  document.getElementById('loginSubmit').addEventListener('click', ()=>{
    const val = document.getElementById('pwInput').value;
    if(val === ADMIN_PASSWORD){
      document.getElementById('pwErr').style.display = 'none';
      document.getElementById('pwInput').value = '';
      overlay.classList.remove('show');
      setAdmin(true);
    }else{
      document.getElementById('pwErr').style.display = 'block';
    }
  });
  document.getElementById('pwInput').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') document.getElementById('loginSubmit').click();
  });
}
function openLoginModal(){
  injectLoginModal();
  document.getElementById('loginModal').classList.add('show');
}

/* ===== Modal form generik (dipakai untuk edit teks, gambar, aktivitas, foto, video, peta) =====
   cfg = { title, hint, fields:[{key,label,type:'text'|'textarea'|'image',placeholder,required}], initial:{} }
   return Promise<Object|null> */
function openFormModal(cfg){
  return new Promise((resolve)=>{
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    const fieldsHtml = cfg.fields.map(f=>{
      const val = (cfg.initial && cfg.initial[f.key]) || '';
      if(f.type === 'textarea'){
        return `<div class="field"><label>${f.label}</label><textarea data-key="${f.key}" placeholder="${f.placeholder||''}">${escapeHtml(val)}</textarea></div>`;
      }else if(f.type === 'image'){
        return `<div class="field"><label>${f.label}</label><input type="file" data-key="${f.key}" data-imgfile accept="image/*"></div>
                <div class="field"><label>atau tautan URL gambar</label><input type="url" data-key="${f.key}" data-imgurl placeholder="https://..."></div>`;
      }else{
        return `<div class="field"><label>${f.label}</label><input type="text" data-key="${f.key}" value="${escapeHtml(val)}" placeholder="${f.placeholder||''}"></div>`;
      }
    }).join('');
    overlay.innerHTML = `<div class="modal">
      <h3>${cfg.title}</h3>
      ${cfg.hint ? `<p class="hint">${cfg.hint}</p>` : ''}
      ${fieldsHtml}
      <div class="err __formerr">Mohon lengkapi kolom yang wajib diisi.</div>
      <div class="modal-actions">
        <button class="btn btn-ghost __cancel" style="color:var(--ink-soft);border-color:var(--line);">batal</button>
        <button class="btn btn-primary __save">simpan</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    const close = (val)=>{ overlay.remove(); resolve(val); };
    overlay.querySelector('.__cancel').addEventListener('click', ()=>close(null));
    overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(null); });
    overlay.querySelector('.__save').addEventListener('click', async ()=>{
      const result = {};
      for(const f of cfg.fields){
        if(f.type === 'image'){
          const fileInp = overlay.querySelector(`[data-key="${f.key}"][data-imgfile]`);
          const urlInp = overlay.querySelector(`[data-key="${f.key}"][data-imgurl]`);
          const file = fileInp.files[0];
          if(file){
            if(file.size > 1.6*1024*1024){
              const errEl = overlay.querySelector('.__formerr');
              errEl.textContent = 'Ukuran gambar terlalu besar (maks sekitar 1.6MB), gunakan tautan URL.';
              errEl.style.display = 'block';
              return;
            }
            result[f.key] = await fileToBase64(file);
          }else if(urlInp.value.trim()){
            result[f.key] = urlInp.value.trim();
          }else{
            result[f.key] = (cfg.initial && cfg.initial[f.key]) || '';
          }
        }else if(f.type === 'textarea'){
          result[f.key] = overlay.querySelector(`textarea[data-key="${f.key}"]`).value.trim();
        }else{
          result[f.key] = overlay.querySelector(`input[data-key="${f.key}"]`).value.trim();
        }
        if(f.required && !result[f.key]){
          const errEl = overlay.querySelector('.__formerr');
          errEl.textContent = f.label + ' wajib diisi.';
          errEl.style.display = 'block';
          return;
        }
      }
      close(result);
    });
  });
}

/* ===== Topbar & admin bar bersama ===== */
function buildTopbar({ brandHref, menuItems, backHref, backLabel }){
  const inner = document.querySelector('.topbar-inner');
  if(!inner) return;
  const backHtml = backHref ? `<a class="back-link" href="${backHref}">&larr; ${backLabel || 'Beranda'}</a>` : '';
  const menuHtml = (menuItems || []).map(m=>`<a href="#${m.id}">${escapeHtml(m.label)}</a>`).join('');
  inner.innerHTML = `
    <a class="brand" href="${brandHref}">
      <svg viewBox="0 0 24 24" fill="none"><path d="M3 17 L12 4 L21 17 Z" fill="#2F5233"/><path d="M3 20 L12 10 L21 20 Z" fill="#4F86A6" opacity="0.85"/></svg>
      <span>Wisata Sumsel</span>
    </a>
    ${backHtml}
    <nav class="menu" id="mainMenu">${menuHtml}</nav>
    <div class="topbar-right">
      <button class="admin-toggle" id="adminToggleBtn" type="button">masuk admin</button>
    </div>
  `;
  document.getElementById('adminToggleBtn').addEventListener('click', ()=>{
    if(isAdmin){ setAdmin(false); } else { openLoginModal(); }
  });
}

function buildAdminBar(extraButtons){
  if(document.querySelector('.admin-bar')) return;
  const bar = document.createElement('div');
  bar.className = 'admin-bar';
  bar.innerHTML = `
    <span class="msg">mode admin aktif &mdash; klik ikon &#9998; untuk mengubah konten</span>
    <div class="actions" id="adminBarActions">
      <button class="btn btn-ghost" id="exitAdminBtn" type="button">keluar admin</button>
    </div>
  `;
  document.body.appendChild(bar);
  document.getElementById('exitAdminBtn').addEventListener('click', ()=>setAdmin(false));
  if(extraButtons){
    extraButtons.forEach(b=>{
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost';
      btn.type = 'button';
      btn.textContent = b.label;
      btn.addEventListener('click', b.onClick);
      document.getElementById('adminBarActions').prepend(btn);
    });
  }
}
