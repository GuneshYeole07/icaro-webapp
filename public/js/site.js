(function(){
  /* show hero content no matter what happens below */
  function markReady(){ document.documentElement.classList.add('ready'); }
  requestAnimationFrame(() => requestAnimationFrame(markReady));
  setTimeout(markReady, 800);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* hero video: hold on the poster frame for people who prefer reduced motion */
  const heroVideo = document.getElementById('heroVideo');
  if (heroVideo && reduceMotion) { heroVideo.removeAttribute('autoplay'); heroVideo.pause(); }

  /* ---------- mobile nav ---------- */
  const navToggle = document.getElementById('navToggle');
  const navMobile = document.getElementById('navMobile');
  const navBackdrop = document.getElementById('navBackdrop');
  function setNav(open){
    navMobile.classList.toggle('open', open);
    navToggle.classList.toggle('open', open);
    navBackdrop.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (navToggle && navMobile && navBackdrop) {
    navToggle.addEventListener('click', () => setNav(!navMobile.classList.contains('open')));
    navBackdrop.addEventListener('click', () => setNav(false));
    navMobile.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setNav(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });
  }

  /* ---------- open / closed status, worked out from Pune time ---------- */
  (function initStatus(){
    const el = document.getElementById('navStatus');
    const text = document.getElementById('navStatusText');
    if (!el || !text) return;
    const OPEN_HOUR = 9, CLOSE_HOUR = 20; // open daily 9 AM – 8 PM
    function update(){
      let hour;
      try {
        hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Kolkata', hour:'numeric', hour12:false }).format(new Date()));
      } catch (e) { return; }
      const open = hour >= OPEN_HOUR && hour < CLOSE_HOUR;
      el.classList.toggle('closed', !open);
      text.textContent = open ? 'Open now, closes 8 PM' : 'Closed, opens 9 AM';
    }
    update();
    setInterval(update, 60000);
  })();

  /* ---------- scroll progress bar ---------- */
  const bar = document.getElementById('progressBar');
  if (bar) {
    const updateProgress = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? h.scrollTop / max * 100 : 0) + '%';
    };
    document.addEventListener('scroll', updateProgress, { passive:true });
    updateProgress();
  }

  /* ---------- chef's blackboard (saved on the server, same for every visitor) ---------- */
  const boardNameText = document.getElementById('boardNameText');
  const boardNote = document.getElementById('boardNote');
  const boardCursor = document.getElementById('boardCursor');
  const boardFrame = document.getElementById('boardFrame');
  const boardEditBtn = document.getElementById('boardEditBtn');
  const boardEditor = document.getElementById('boardEditor');
  const boardLock = document.getElementById('boardLock');
  const boardFields = document.getElementById('boardFields');
  const boardPasswordInput = document.getElementById('boardPasswordInput');
  const boardUnlockBtn = document.getElementById('boardUnlockBtn');
  const boardLockCancelBtn = document.getElementById('boardLockCancelBtn');
  const boardLockMsg = document.getElementById('boardLockMsg');
  const boardNameInput = document.getElementById('boardNameInput');
  const boardNoteInput = document.getElementById('boardNoteInput');
  const boardSaveBtn = document.getElementById('boardSaveBtn');
  const boardCancelBtn = document.getElementById('boardCancelBtn');
  const boardToast = document.getElementById('boardToast');

  if (boardNameText && boardNote) {
    let activeName = boardNameText.textContent.trim();
    let activeNote = boardNote.textContent.trim();
    let adminKey = null; // held in memory for this page visit only

    function spawnDust(afterEl, containerEl){
      if (!afterEl || !containerEl) return;
      const rect = afterEl.getBoundingClientRect();
      const parentRect = containerEl.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const dust = document.createElement('span');
      dust.className = 'chalk-dust';
      dust.style.left = (rect.left - parentRect.left + (Math.random()*4-2)) + 'px';
      dust.style.top = (rect.top - parentRect.top + rect.height/2) + 'px';
      containerEl.appendChild(dust);
      setTimeout(() => dust.remove(), 650);
    }

    // writes the text out at an uneven, hand-written pace
    function writeChalk(textEl, text, cursorEl, dustContainer){
      if (reduceMotion) { textEl.textContent = text; if (cursorEl) cursorEl.classList.add('hidden'); return Promise.resolve(); }
      textEl.textContent = '';
      if (cursorEl) cursorEl.classList.remove('hidden');
      let i = 0;
      return new Promise(resolve => {
        (function step(){
          if (i <= text.length) {
            textEl.textContent = text.slice(0, i);
            if (cursorEl && i % 3 === 0 && Math.random() < 0.6) spawnDust(cursorEl, dustContainer);
            i++;
            const ch = text[i-1];
            let delay = 20 + Math.random() * 34;
            if (ch === '\n') delay += 220;
            else if (ch === ' ') delay += 40;
            setTimeout(step, delay);
          } else {
            if (cursorEl) cursorEl.classList.add('hidden');
            resolve();
          }
        })();
      });
    }

    function playBoard(){
      boardNote.textContent = '';
      writeChalk(boardNameText, activeName, boardCursor, boardFrame).then(() => { boardNote.textContent = activeNote; });
    }

    function playWhenVisible(){
      if (!boardFrame || !('IntersectionObserver' in window)) { playBoard(); return; }
      const boardIo = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { playBoard(); boardIo.unobserve(e.target); } });
      }, { threshold:0.4 });
      boardIo.observe(boardFrame);
    }

    fetch('/api/special')
      .then(r => r.json())
      .then(s => {
        activeName = s.name || activeName;
        activeNote = typeof s.note === 'string' ? s.note : activeNote;
        playWhenVisible();
      })
      .catch(playWhenVisible); // server briefly unreachable: still show the built-in default

    function showLockStep(){
      boardFields.style.display = 'none';
      boardLock.style.display = 'block';
      boardPasswordInput.value = '';
      boardLockMsg.textContent = '';
      boardEditor.classList.add('open');
      setTimeout(() => boardPasswordInput.focus(), 50);
    }
    function showFieldsStep(){
      boardLock.style.display = 'none';
      boardFields.style.display = 'block';
      boardNameInput.value = activeName;
      boardNoteInput.value = activeNote;
      setTimeout(() => boardNameInput.focus(), 50);
    }

    boardEditBtn.addEventListener('click', () => {
      if (adminKey) { boardEditor.classList.add('open'); showFieldsStep(); }
      else showLockStep();
    });

    boardUnlockBtn.addEventListener('click', () => {
      const pw = boardPasswordInput.value;
      boardUnlockBtn.disabled = true;
      fetch('/api/admin/check', { headers: { 'x-admin-key': pw } })
        .then(r => {
          if (!r.ok) throw new Error('wrong password');
          adminKey = pw;
          showFieldsStep();
        })
        .catch(() => {
          boardLockMsg.textContent = 'Wrong password. Try again.';
          boardPasswordInput.value = '';
          boardPasswordInput.focus();
        })
        .finally(() => { boardUnlockBtn.disabled = false; });
    });
    boardPasswordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') boardUnlockBtn.click(); });
    boardLockCancelBtn.addEventListener('click', () => boardEditor.classList.remove('open'));
    boardCancelBtn.addEventListener('click', () => boardEditor.classList.remove('open'));

    let toastTimer = null;
    function showToast(text){
      boardToast.textContent = text;
      boardToast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => boardToast.classList.remove('show'), 2600);
    }

    function saveBoard(){
      const lines = boardNameInput.value.split('\n').map(l => l.trim()).filter(Boolean);
      const newName = lines.join('\n') || activeName;
      const newNote = boardNoteInput.value.trim();
      boardSaveBtn.disabled = true;
      fetch('/api/special', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ name: newName, note: newNote })
      })
        .then(r => { if (!r.ok) throw new Error('save failed'); return r.json(); })
        .then(s => {
          activeName = s.name;
          activeNote = s.note;
          boardEditor.classList.remove('open');
          playBoard();
          showToast('Saved. Live for every visitor.');
        })
        .catch(() => showToast('Not saved. Check your connection and try again.'))
        .finally(() => { boardSaveBtn.disabled = false; });
    }
    boardSaveBtn.addEventListener('click', saveBoard);
    // Enter adds a new dish line; Ctrl/Cmd+Enter saves
    boardNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveBoard(); }
    });
    boardNoteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveBoard(); } });
  }

  /* ---------- dish preview modal ---------- */
  (function initDishModal(){
    const modal = document.getElementById('dishModal');
    const media = document.getElementById('dishModalMedia');
    const nameEl = document.getElementById('dishModalName');
    const hintEl = document.getElementById('dishModalHint');
    const iconTemplate = document.getElementById('dishIconSet');
    const menuEl = document.getElementById('menuColumns');
    if (!modal || !media || !nameEl || !iconTemplate || !menuEl) return;
    let lastFocus = null;

    function slugify(str){
      return str.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    function showIcon(iconKey){
      const svg = iconTemplate.content.querySelector(`svg[data-icon="${iconKey || 'plate'}"]`)
                || iconTemplate.content.querySelector('svg[data-icon="plate"]');
      media.innerHTML = '';
      if (svg) media.appendChild(svg.cloneNode(true));
    }
    function openModal(nameText, iconKey){
      lastFocus = document.activeElement;
      nameEl.textContent = nameText;
      hintEl.textContent = '';
      media.innerHTML = '';
      const img = new Image();
      img.alt = nameText;
      img.onload = () => { media.innerHTML = ''; media.appendChild(img); };
      img.onerror = () => { showIcon(iconKey); hintEl.textContent = 'Photo coming soon'; };
      // drop a photo at public/images/dishes/<dish-name>.jpg and it shows up here
      img.src = `images/dishes/${slugify(nameText)}.jpg`;
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      modal.querySelector('.dish-modal-close').focus();
    }
    function closeModal(){
      if (!modal.classList.contains('open')) return;
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    // delegated, because the menu is rendered after this runs
    menuEl.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-dish]');
      if (!trigger) return;
      const block = trigger.closest('.menu-block');
      openModal(trigger.getAttribute('data-dish'), block ? block.getAttribute('data-icon') : 'plate');
    });
    modal.querySelectorAll('[data-dish-close]').forEach(el => el.addEventListener('click', closeModal));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  })();

  /* ---------- live menu, rendered from the server ---------- */
  (function initMenu(){
    const container = document.getElementById('menuColumns');
    const chips = document.getElementById('menuChips');
    if (!container) return;

    const ICONS = {
      'Specials':'plate', 'Risotto':'bowl', 'Quesadilla':'plate', 'Soups':'bowl',
      'Salads':'leaf', 'Beverages':'cup', 'Eggless Cakes':'cake', 'Slices':'cake',
      'Egg Cakes':'cake', 'Fries':'fries', 'Salads & Smoothies':'leaf',
      'Veg Toasties':'sandwich', 'Non-Veg Toasties':'sandwich', 'Iced Coffees':'cup'
    };

    function esc(s){
      return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function priceText(m){
      if (m.available === false) return 'Sold out';
      return m.price != null ? '₹' + esc(m.price) : 'Price on request';
    }

    function applyFilter(cat){
      let shown = 0;
      container.querySelectorAll('.menu-block').forEach(block => {
        const match = cat === 'all' || block.getAttribute('data-cat') === cat;
        block.hidden = !match;
        if (match) shown++;
      });
      container.classList.toggle('single', shown === 1);
      if (chips) chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c.getAttribute('data-cat') === cat ? 'true' : 'false'));
    }

    function renderMenu(items){
      if (!Array.isArray(items) || !items.length) {
        container.innerHTML = '<p class="menu-loading">The menu is being updated. Ask us at the counter in the meantime.</p>';
        if (chips) chips.hidden = true;
        return;
      }
      const order = [];
      items.forEach(m => { if (!order.includes(m.category)) order.push(m.category); });

      if (chips) {
        chips.innerHTML = ['<button type="button" class="chip" data-cat="all" aria-pressed="true">Everything</button>']
          .concat(order.map(cat => `<button type="button" class="chip" data-cat="${esc(cat)}" aria-pressed="false">${esc(cat)}</button>`))
          .join('');
        chips.hidden = false;
      }

      container.innerHTML = order.map(cat => {
        const catItems = items.filter(m => m.category === cat);
        const icon = ICONS[cat] || 'plate';

        if (cat === 'Add-ons') {
          return `<div class="menu-block" data-icon="${icon}" data-cat="${esc(cat)}">
            <h3>${esc(cat)}</h3>
            <div class="menu-addons">
              ${catItems.map(m => `<button type="button" class="addon${m.available === false ? ' sold-out' : ''}" data-dish="${esc(m.name)}"><span class="name">${esc(m.name)}</span><b class="${m.available !== false && m.price == null ? 'tbc' : ''}">${m.available !== false && m.price == null ? 'on request' : priceText(m)}</b></button>`).join('')}
            </div>
          </div>`;
        }

        return `<div class="menu-block" data-icon="${icon}" data-cat="${esc(cat)}">
          <h3>${esc(cat)}</h3>
          ${catItems.map(m => `
            <div class="menu-item${m.available === false ? ' sold-out' : ''}">
              <div><button type="button" class="name" data-dish="${esc(m.name)}">${esc(m.name)}</button>${m.note ? `<span class="note">${esc(m.note)}</span>` : ''}</div>
              <span class="price${m.available !== false && m.price == null ? ' tbc' : ''}">${priceText(m)}</span>
            </div>`).join('')}
        </div>`;
      }).join('');
    }

    if (chips) {
      chips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        applyFilter(chip.getAttribute('data-cat'));
        const top = document.getElementById('menu');
        // keep the reader at the top of the filtered list
        const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'), 10) || 64;
        const y = chips.getBoundingClientRect().top + window.scrollY - headerH;
        if (top && window.scrollY > y) window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    }

    fetch('/api/menu')
      .then(r => { if (!r.ok) throw new Error('menu failed'); return r.json(); })
      .then(renderMenu)
      .catch(() => { container.innerHTML = '<p class="menu-loading">The menu didn\'t load. Refresh the page to try again.</p>'; });
  })();

  /* ---------- table booking form ---------- */
  (function initBooking(){
    const form = document.getElementById('bookingForm');
    if (!form) return;
    const msg = document.getElementById('bookingMsg');
    const submitBtn = document.getElementById('bkSubmit');
    const dateInput = document.getElementById('bkDate');

    function todayInPune(){
      try { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kolkata' }).format(new Date()); }
      catch (e) { return new Date().toISOString().split('T')[0]; }
    }
    if (dateInput) dateInput.min = todayInPune();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      msg.textContent = '';
      msg.className = 'booking-msg';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending request…';

      const payload = {
        name: document.getElementById('bkName').value.trim(),
        phone: document.getElementById('bkPhone').value.trim(),
        date: document.getElementById('bkDate').value,
        time: document.getElementById('bkTime').value,
        guests: document.getElementById('bkGuests').value,
        note: document.getElementById('bkNote').value.trim()
      };

      fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(async r => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error || 'The request was not sent. Try again.');
          return data;
        })
        .then(({ whatsappLink }) => {
          msg.className = 'booking-msg ok';
          msg.textContent = '';
          if (whatsappLink) {
            msg.append('Table requested. ');
            const a = document.createElement('a');
            a.href = whatsappLink; a.target = '_blank'; a.rel = 'noopener';
            a.textContent = 'Send it to us on WhatsApp';
            msg.append(a, ' so we see it right away.');
            window.open(whatsappLink, '_blank', 'noopener');
          } else {
            msg.textContent = 'Table requested. We will call you to confirm.';
          }
          form.reset();
          if (dateInput) dateInput.min = todayInPune();
        })
        .catch(err => {
          msg.className = 'booking-msg err';
          msg.textContent = err.message || 'The request was not sent. Try again.';
        })
        .finally(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Request table';
        });
    });
  })();

  /* ---------- gallery wheel ---------- */
  (function initGalleryWheel(){
    const stage = document.getElementById('galleryStage');
    const wheelEl = document.getElementById('galleryWheel');
    if (!stage || !wheelEl) return;
    const hub = stage.querySelector('.gallery-hub');
    const cards = Array.from(wheelEl.querySelectorAll('.gallery-card'));
    const total = cards.length;
    if (total === 0) return;
    const caption = document.getElementById('galleryCaption');

    const CARD_W = window.innerWidth < 760 ? 128 : 172;
    const CARD_H = Math.round(CARD_W * 1.3);
    const CARD_RADIUS = 6;
    const SCALE_NEAR = 1.15;
    const SCALE_FALLOFF = 0.62;
    const FIT_MARGIN = 0.94;
    const CLICK_SLOP = 6;
    const anglePerCard = 360 / total;

    function scaleAtRatio(ratio){ return SCALE_NEAR - ratio * SCALE_FALLOFF; }

    const radius = (function(){
      if (total <= 1) return CARD_H * 1.2;
      const arcTarget = CARD_W * 0.7;
      const R = arcTarget / (2 * Math.sin(Math.PI / total));
      return Math.max(R, CARD_H * 1.1);
    })();

    cards.forEach((card, i) => {
      const baseAngle = i * anglePerCard;
      card.style.width = CARD_W + 'px';
      card.style.height = CARD_H + 'px';
      card.style.left = (-CARD_W / 2) + 'px';
      card.style.top = (-radius) + 'px';
      card.style.borderRadius = CARD_RADIUS + 'px';
      card.style.transformOrigin = `50% ${radius}px`;
      card.dataset.baseAngle = String(baseAngle);
    });

    let rotation = 0;

    function computeFit(){
      const w = stage.clientWidth, h = stage.clientHeight;
      if (w === 0 || h === 0) return;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let deg = 0; deg < 360; deg += 4) {
        let n = deg; if (n > 180) n -= 360;
        const s = scaleAtRatio(Math.abs(n) / 180);
        const rad = deg * Math.PI / 180;
        const c = Math.cos(rad), sn = Math.sin(rad);
        for (const x of [-CARD_W / 2, CARD_W / 2]) {
          for (const y of [-radius, -radius + CARD_H]) {
            const px = x * s, py = y * s;
            const rx = px * c - py * sn;
            const ry = px * sn + py * c;
            if (rx < minX) minX = rx; if (rx > maxX) maxX = rx;
            if (ry < minY) minY = ry; if (ry > maxY) maxY = ry;
          }
        }
      }
      const boxW = maxX - minX, boxH = maxY - minY;
      const zoom = Math.min(w / boxW, h / boxH) * FIT_MARGIN;
      const dx = -((minX + maxX) / 2) * zoom;
      const dy = -((minY + maxY) / 2) * zoom;
      hub.style.transform = `translate(${dx}px, ${dy}px) scale(${zoom})`;
    }
    computeFit();
    window.addEventListener('resize', computeFit);

    function getFrontIndex(){
      let idx = Math.round(-rotation / anglePerCard) % total;
      if (idx < 0) idx += total;
      return idx;
    }

    function updateCards(){
      cards.forEach(card => {
        const baseAngle = parseFloat(card.dataset.baseAngle);
        const angle = baseAngle + rotation;
        let n = angle % 360; if (n > 180) n -= 360; if (n < -180) n += 360;
        const dist = Math.abs(n);
        const ratio = dist / 180;
        card.style.transform = `rotate(${baseAngle}deg) scale(${scaleAtRatio(ratio)})`;
        card.style.opacity = String(1 - ratio * 0.55);
        card.style.filter = `brightness(${1 - ratio * 0.6})`;
        card.style.zIndex = String(Math.round(1000 - dist));
      });
    }
    function updateCaption(){
      if (!caption) return;
      const img = cards[getFrontIndex()].querySelector('img');
      caption.textContent = img ? (img.alt || '') : '';
    }
    function applyRotation(){
      wheelEl.style.transform = `rotate(${rotation}deg)`;
      updateCards();
    }
    applyRotation();
    updateCaption();

    let animReq = null;
    function animateTo(target, duration){
      if (animReq) cancelAnimationFrame(animReq);
      const start = rotation;
      const delta = target - start;
      const t0 = performance.now();
      const dur = reduceMotion ? 1 : (duration || 700);
      function step(now){
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        rotation = start + delta * eased;
        applyRotation();
        if (p < 1) animReq = requestAnimationFrame(step);
        else updateCaption();
      }
      animReq = requestAnimationFrame(step);
    }
    function snapTarget(value){ return Math.round(value / anglePerCard) * anglePerCard; }
    function goToIndex(index){
      const base = -index * anglePerCard;
      const turns = Math.round((rotation - base) / 360);
      animateTo(base + turns * 360, 650);
    }
    function stepBy(n){ animateTo(snapTarget(rotation) - n * anglePerCard, 500); }

    /* lightbox */
    const lightbox = document.getElementById('galleryLightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');
    let lightboxReturn = null;
    function openLightbox(index){
      const img = cards[index].querySelector('img');
      if (!img || !lightbox) return;
      lightboxReturn = document.activeElement;
      lightboxImg.src = img.getAttribute('data-full') || img.src;
      lightboxImg.alt = img.alt || '';
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      if (lightboxClose) lightboxClose.focus();
    }
    function closeLightbox(){
      if (!lightbox || !lightbox.classList.contains('open')) return;
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      if (lightboxReturn && lightboxReturn.focus) lightboxReturn.focus();
    }
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightbox) lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

    /* drag */
    let dragging = false, startX = 0, lastX = 0, lastTime = 0, velocity = 0, moved = 0, downIndex = -1;
    let userTouchedAt = 0;
    function pointerDown(e){
      dragging = true;
      userTouchedAt = Date.now();
      if (animReq) cancelAnimationFrame(animReq);
      stage.classList.add('grabbing');
      startX = e.clientX; lastX = e.clientX; lastTime = Date.now(); velocity = 0; moved = 0;
      const hit = e.target.closest && e.target.closest('[data-index]');
      downIndex = hit ? Number(hit.dataset.index) : -1;
    }
    function pointerMove(e){
      if (!dragging) return;
      const x = e.clientX;
      const dx = x - lastX;
      const now = Date.now();
      const dt = now - lastTime;
      if (dt > 0) velocity = dx / dt;
      moved = Math.max(moved, Math.abs(x - startX));
      rotation += dx * 0.28;
      applyRotation();
      lastX = x; lastTime = now;
    }
    function pointerUp(){
      if (!dragging) return;
      dragging = false;
      userTouchedAt = Date.now();
      stage.classList.remove('grabbing');
      if (moved < CLICK_SLOP && downIndex >= 0) {
        if (downIndex === getFrontIndex()) openLightbox(downIndex);
        else goToIndex(downIndex);
        return;
      }
      animateTo(snapTarget(rotation + velocity * 130), 550);
    }
    stage.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerUp);

    // sideways trackpad swipes spin the wheel; vertical scrolling still scrolls the page
    stage.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      userTouchedAt = Date.now();
      if (animReq) cancelAnimationFrame(animReq);
      rotation -= e.deltaX * 0.18;
      applyRotation();
      clearTimeout(stage._wheelTimer);
      stage._wheelTimer = setTimeout(() => animateTo(snapTarget(rotation), 400), 150);
    }, { passive:false });

    /* buttons + keyboard */
    const prevBtn = document.getElementById('wheelPrev');
    const nextBtn = document.getElementById('wheelNext');
    if (prevBtn) prevBtn.addEventListener('click', () => { userTouchedAt = Date.now(); stepBy(-1); });
    if (nextBtn) nextBtn.addEventListener('click', () => { userTouchedAt = Date.now(); stepBy(1); });
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); userTouchedAt = Date.now(); stepBy(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); userTouchedAt = Date.now(); stepBy(1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(getFrontIndex()); }
    });

    /* slow auto-advance, only while on screen and left alone */
    if (!reduceMotion && 'IntersectionObserver' in window) {
      let onScreen = false;
      new IntersectionObserver((entries) => { onScreen = entries[0].isIntersecting; }, { threshold:0.3 }).observe(stage);
      setInterval(() => {
        if (!onScreen || dragging || document.hidden) return;
        if (Date.now() - userTouchedAt < 8000) return;
        if (lightbox && lightbox.classList.contains('open')) return;
        animateTo(snapTarget(rotation) - anglePerCard, 900);
      }, 3600);
    }
  })();
})();
