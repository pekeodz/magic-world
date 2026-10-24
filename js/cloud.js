// ============================================================
//  MAGIC WORLD — lưu đám mây bằng Firebase (Đăng nhập Google + Firestore)
//  Dữ liệu: collection "players", document = uid người chơi
// ============================================================
'use strict';
const Cloud = {
  enabled: false, user: null, auth: null, db: null, timer: null, busy: false,
  init() {
    const cfg = window.FIREBASE_CONFIG;
    if (!window.firebase || !cfg || !cfg.apiKey) { this.render(); return; }
    try {
      firebase.initializeApp(cfg);
      this.auth = firebase.auth();
      this.db = firebase.firestore();
      this.enabled = true;
      this.auth.getRedirectResult().catch(e => this.err(e));
      this.auth.onAuthStateChanged(u => this.onUser(u));
    } catch (e) { console.warn('Firebase lỗi', e); }
    this.render();
  },
  login() {
    const p = new firebase.auth.GoogleAuthProvider();
    // điện thoại hay chặn popup → dùng redirect
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    (mobile ? this.auth.signInWithRedirect(p) : this.auth.signInWithPopup(p)).catch(e => this.err(e));
  },
  logout() { this.push(true).finally(() => this.auth.signOut()); },
  err(e) {
    console.warn(e);
    const msg = { 'auth/unauthorized-domain': 'Tên miền chưa được thêm vào Firebase (Authorized domains)', 'auth/popup-closed-by-user': 'Đã đóng cửa sổ đăng nhập', 'permission-denied': 'Firestore từ chối — kiểm tra Rules' }[e.code] || ('Lỗi đám mây: ' + (e.code || e.message));
    if (typeof UI !== 'undefined') UI.toast(msg);
  },
  ref() { return this.db.collection('players').doc(this.user.uid); },
  async onUser(u) {
    this.user = u;
    this.render();
    if (!u) return;
    try {
      const snap = await this.ref().get();
      const local = Save.data;
      const d = snap.exists ? snap.data() : { chars: [], unlocks: {} };
      // gộp theo id nhân vật: giữ bản có thời gian chơi lâu hơn
      const map = new Map();
      for (const c of (d.chars || []).concat(local.chars || [])) {
        const o = map.get(c.id);
        if (!o || (c.playTime || 0) > (o.playTime || 0)) map.set(c.id, c);
      }
      const merged = { chars: [...map.values()].sort((a, b) => (a.created || 0) - (b.created || 0)).slice(0, 6), unlocks: Object.assign({}, d.unlocks || {}, local.unlocks || {}), updatedAt: Date.now() };
      const changedLocal = JSON.stringify(merged.chars) !== JSON.stringify(local.chars || []);
      Save.data = merged;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(Save.data)); } catch (e) { }
      if (changedLocal && !G.running) { UI.renderTitle(); UI.toast('Đã tải nhân vật từ đám mây ☁'); }
      await this.push(true);
    } catch (e) { this.err(e); }
  },
  queue() {
    if (!this.user) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push(), 4000);
  },
  async push(now) {
    if (!this.enabled || !this.user) return;
    clearTimeout(this.timer);
    const d = Save.data;
    const payload = JSON.parse(JSON.stringify({ chars: d.chars, unlocks: d.unlocks || {}, updatedAt: d.updatedAt || Date.now() }));
    payload.name = this.user.displayName || '';
    try { await this.ref().set(payload); this.render(true); } catch (e) { this.err(e); }
  },
  render(saved) {
    const box = document.getElementById('cloudbox');
    if (!box) return;
    if (!this.enabled) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    if (this.user) {
      box.innerHTML = `<span>☁ <b>${esc(this.user.displayName || this.user.email || 'Đã đăng nhập')}</b> · ${saved ? 'đã đồng bộ ' + new Date().toLocaleTimeString('vi-VN') : 'lưu đám mây đang bật'}</span><button class="btn small" id="cloud-out">Đăng xuất</button>`;
      document.getElementById('cloud-out').onclick = () => this.logout();
    } else {
      box.innerHTML = `<span>☁ Đăng nhập để lưu nhân vật lên đám mây và chơi trên nhiều máy</span><button class="btn gold small" id="cloud-in">Đăng nhập Google</button>`;
      document.getElementById('cloud-in').onclick = () => this.login();
    }
  },
};
