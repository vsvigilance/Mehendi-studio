/* =========================================================
   Jiyana's Mehendi Studio — decoration test
   Purpose: prove out the new "decorate" step (tray of stickers,
   tap-to-select then tap-to-place on the hand) on its own, the
   same way dry-scrape-test.js proved out dry+scrape against a
   hardcoded test line instead of a real traced design.

   This test skips straight to "already fully scraped and
   revealed" — a flat henna-brown recolor of the approved flower
   stencil, drawn once at boot with the exact same source-in +
   destination-in technique buildRevealLayers() uses in
   full-flow-test.js — so the tray/placement interaction can be
   judged without re-running the whole trace/dry/scrape pipeline.

   Nothing here touches full-flow-test.*, index.html, or main.js.
   ========================================================= */

(() => {
  const stage = document.getElementById('stage');
  const artboard = document.getElementById('artboard');
  const palm = document.getElementById('palm');
  const finishedCanvas = document.getElementById('finishedCanvas');
  const finishedCtx = finishedCanvas.getContext('2d');
  const decorLayer = document.getElementById('decorLayer');
  const hint = document.getElementById('hint');
  const decorTray = document.getElementById('decorTray');
  const decorBtns = Array.from(document.querySelectorAll('.decorBtn'));
  const doneBtn = document.getElementById('doneBtn');
  const resetBtn = document.getElementById('resetBtn');
  const srcFlower = document.getElementById('src-flower');

  const maskCanvas = document.createElement('canvas'); // hand silhouette
  const maskCtx = maskCanvas.getContext('2d');

  const PALM_ASPECT = 956 / 1489;

  // Same flower placement + henna color used for the real flower design
  // in full-flow-test.js (DESIGNS[0] and STAIN_DARK_RGB) — reused here
  // purely as a stand-in "already finished" shape, not a live trace.
  const FLOWER_CENTER = { x: 0.5, y: 0.58 };
  const FLOWER_WIDTH_RATIO = 0.46;
  const HENNA_STAIN_RGB = '133, 66, 28';

  // data-item -> actual asset filename. Kept explicit rather than
  // derived from the id because a couple of ids don't match their
  // filenames one-to-one (e.g. gem_green -> decor_gem_teardrop_green.png).
  const DECOR_ITEMS = {
    gem_heart: 'assets/decor_gem_heart.png',
    gem_blue: 'assets/decor_gem_blue.png',
    gem_green: 'assets/decor_gem_teardrop_green.png',
    bindi_gold: 'assets/decor_bindi_gold.png',
    bindi_red: 'assets/decor_bindi_drop_red.png',
    flower_pink: 'assets/decor_flower_pink.png',
    flower_purple: 'assets/decor_flower_purple.png',
  };

  let dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  let cssW = 0;
  let cssH = 0;
  let selectedItem = null;
  let locked = false;

  // ---------------- Manipulating placed decorations ----------------
  // Every placed sticker supports three basic things a player will expect
  // to be able to do to "a thing they put down": move it, resize/rotate it,
  // and remove it if they change their mind. Move is a plain one-finger
  // drag on the sticker itself. Resize+rotate is a small handle just
  // outside its edge — dragging it further out/closer in sets size, and
  // swinging it around sets rotation, both from one motion (chosen over
  // two-finger pinch because a placed sticker starts out quite small,
  // 52px, and two real fingers pinching something that size would mostly
  // just cover it up). Remove is a small ✕ button on the opposite side of
  // the handle, only shown while that sticker is selected.
  const DECOR_BASE_WIDTH = 52; // px at scale 1, matches the original fixed size
  const DECOR_MIN_SCALE = 0.5;
  const DECOR_MAX_SCALE = 2.2;
  const DECOR_HANDLE_SIZE = 30; // visual size of the resize/rotate handle, px
  const DECOR_HANDLE_GAP = 14; // gap between the sticker's current edge and the handle/delete button

  // scale = (drag distance from center) / DECOR_REF_DIST — calibrated so a
  // drag that lands exactly where the handle rests at scale 1 reproduces
  // scale 1 exactly. Recomputed fresh from raw distance every move, so it
  // doesn't matter that the handle's resting distance itself grows/shrinks
  // with the sticker's current scale.
  const DECOR_REF_DIST = DECOR_BASE_WIDTH / 2 + DECOR_HANDLE_GAP + DECOR_HANDLE_SIZE / 2;

  let placedDecorations = []; // { id, itemId, wrap, img, handle, deleteBtn, nx, ny, scale, angle }
  let nextPlacedId = 1;
  let selectedPlacedId = null;

  function layoutArtboard() {
    const stageRect = stage.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height) return;
    const stageAspect = stageRect.width / stageRect.height;
    let w, h;
    if (stageAspect > PALM_ASPECT) {
      h = stageRect.height;
      w = h * PALM_ASPECT;
    } else {
      w = stageRect.width;
      h = w / PALM_ASPECT;
    }
    artboard.style.width = w + 'px';
    artboard.style.height = h + 'px';
  }

  function setupCanvases() {
    layoutArtboard();
    const rect = artboard.getBoundingClientRect();
    cssW = rect.width;
    cssH = rect.height;
    if (cssW === 0 || cssH === 0) return;

    [maskCanvas, finishedCanvas].forEach((c) => {
      c.width = Math.round(cssW * dpr);
      c.height = Math.round(cssH * dpr);
    });
    finishedCanvas.style.width = cssW + 'px';
    finishedCanvas.style.height = cssH + 'px';

    [maskCtx, finishedCtx].forEach((c) => c.setTransform(dpr, 0, 0, dpr, 0, 0));

    maskCtx.clearRect(0, 0, cssW, cssH);
    maskCtx.drawImage(palm, 0, 0, cssW, cssH);

    drawFinishedDesign();
    repositionAllDecor();
  }

  // One-time (well, redrawn on resize) stand-in "finished henna" — flat
  // brown recolor of the flower stencil's own alpha shape, then clipped
  // to the hand. Mirrors buildRevealLayers()'s source-in + destination-in
  // pattern in full-flow-test.js exactly, just with a static source image
  // instead of the player's own traced ink.
  function drawFinishedDesign() {
    finishedCtx.clearRect(0, 0, cssW, cssH);
    if (!srcFlower.naturalWidth) return;

    const w = cssW * FLOWER_WIDTH_RATIO;
    const h = w * (srcFlower.naturalHeight / srcFlower.naturalWidth);
    const x = FLOWER_CENTER.x * cssW - w / 2;
    const y = FLOWER_CENTER.y * cssH - h / 2;

    finishedCtx.drawImage(srcFlower, x, y, w, h);
    finishedCtx.globalCompositeOperation = 'source-in';
    finishedCtx.fillStyle = `rgba(${HENNA_STAIN_RGB}, 1)`;
    finishedCtx.fillRect(0, 0, cssW, cssH);
    finishedCtx.globalCompositeOperation = 'destination-in';
    finishedCtx.drawImage(maskCanvas, 0, 0, cssW, cssH);
    finishedCtx.globalCompositeOperation = 'source-over';
  }

  function toNormalized(clientX, clientY) {
    const rect = artboard.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }

  /* ---------------- Tray selection ---------------- */

  function selectItem(id) {
    // Picking a tray item means "place something new next" — whatever was
    // being adjusted before is done being adjusted, so lock it in first.
    deselectPlaced();
    if (selectedItem === id) {
      // Tapping the already-selected item again deselects it.
      selectedItem = null;
    } else {
      selectedItem = id;
    }
    decorBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.item === selectedItem);
    });
    updateHint();
  }

  function updateHint() {
    if (locked) {
      hint.textContent = 'All done! Beautiful work.';
    } else if (selectedPlacedId != null) {
      hint.textContent = 'Drag it to move. Use the gold circle to resize/turn, or ✕ to remove it.';
    } else if (selectedItem) {
      hint.textContent = 'Tap the hand to place it.';
    } else if (placedDecorations.length > 0) {
      hint.textContent = 'Tap a sticker to adjust it, add more, or tap Done.';
    } else {
      hint.textContent = 'Tap a sparkle below, then tap the hand to add it — or just tap Done.';
    }
  }

  /* ---------------- Placement ---------------- */

  // Recomputes a placed sticker's on-screen position/size/rotation from its
  // stored normalized data — called after every drag update, and again on
  // resize/orientation-change so stickers stay put relative to the hand
  // instead of drifting when the artboard's pixel size changes.
  function positionPlaced(deco) {
    const cx = deco.nx * cssW;
    const cy = deco.ny * cssH;
    deco.wrap.style.transform = `translate(${cx}px, ${cy}px) rotate(${deco.angle}deg)`;

    const w = DECOR_BASE_WIDTH * deco.scale;
    deco.img.style.width = w + 'px';

    // Resize/rotate handle sits just past the sticker's current edge on
    // one side; the delete button mirrors it on the opposite side (180°
    // around), so the two never crowd each other regardless of scale.
    const r = w / 2 + DECOR_HANDLE_GAP + DECOR_HANDLE_SIZE / 2;
    deco.handle.style.transform = `translate(${r}px, 0px) translate(-50%, -50%)`;
    deco.deleteBtn.style.transform = `translate(${-r}px, 0px) translate(-50%, -50%)`;
  }

  function repositionAllDecor() {
    placedDecorations.forEach(positionPlaced);
  }

  function selectPlaced(id) {
    selectedPlacedId = id;
    placedDecorations.forEach((d) => {
      const isSelected = d.id === id;
      d.handle.classList.toggle('visible', isSelected);
      d.deleteBtn.classList.toggle('visible', isSelected);
    });
    // Bring the selected sticker to the front so it's easy to grab even
    // when it's partly under another one.
    const deco = placedDecorations.find((d) => d.id === id);
    if (deco) decorLayer.appendChild(deco.wrap);
    // Selecting an existing sticker to adjust means we're not about to
    // place a new one from the tray.
    if (selectedItem) {
      selectedItem = null;
      decorBtns.forEach((btn) => btn.classList.remove('active'));
    }
    updateHint();
  }

  function deselectPlaced() {
    if (selectedPlacedId == null) return;
    const d = placedDecorations.find((x) => x.id === selectedPlacedId);
    if (d) {
      d.handle.classList.remove('visible');
      d.deleteBtn.classList.remove('visible');
    }
    selectedPlacedId = null;
    updateHint();
  }

  function removeDecoration(id) {
    const idx = placedDecorations.findIndex((d) => d.id === id);
    if (idx === -1) return;
    placedDecorations[idx].wrap.remove();
    placedDecorations.splice(idx, 1);
    if (selectedPlacedId === id) selectedPlacedId = null;
    updateHint();
  }

  function createPlacedDecoration(itemId, nx, ny) {
    const wrap = document.createElement('div');
    wrap.className = 'placedDecorWrap';

    const img = document.createElement('img');
    img.className = 'placedDecor';
    img.src = DECOR_ITEMS[itemId];
    img.alt = '';
    img.draggable = false;

    const handle = document.createElement('div');
    handle.className = 'decorHandle';

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'decorDeleteBtn';

    wrap.appendChild(img);
    wrap.appendChild(handle);
    wrap.appendChild(deleteBtn);
    decorLayer.appendChild(wrap);

    const deco = {
      id: nextPlacedId++,
      itemId,
      wrap,
      img,
      handle,
      deleteBtn,
      nx,
      ny,
      scale: 1,
      angle: 0,
    };
    placedDecorations.push(deco);
    positionPlaced(deco);

    beginBodyDrag(deco);
    beginHandleDrag(deco);

    deleteBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (locked) return;
      removeDecoration(deco.id);
    });

    // Auto-select right after placing so the handle/delete controls are
    // already visible — the player sees immediately what they can do,
    // no explanation needed.
    selectPlaced(deco.id);

    updateHint();
  }

  // Plain one-finger drag on the sticker itself to move it anywhere on the
  // hand. Records the offset between the touch point and the sticker's own
  // center at the moment of touch-down, then holds that same offset
  // through the drag — so the sticker doesn't jump to re-center itself
  // under the finger the instant it's grabbed, it just follows wherever
  // it was actually picked up.
  function beginBodyDrag(deco) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    function onDown(e) {
      e.stopPropagation();
      if (locked) return;
      dragging = true;
      selectPlaced(deco.id);
      const artRect = artboard.getBoundingClientRect();
      const cx = artRect.left + deco.nx * cssW;
      const cy = artRect.top + deco.ny * cssH;
      offsetX = e.clientX - cx;
      offsetY = e.clientY - cy;
      deco.img.setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    function onMove(e) {
      if (!dragging) return;
      const artRect = artboard.getBoundingClientRect();
      const targetCx = e.clientX - offsetX;
      const targetCy = e.clientY - offsetY;
      let nx = (targetCx - artRect.left) / cssW;
      let ny = (targetCy - artRect.top) / cssH;
      nx = Math.min(1, Math.max(0, nx));
      ny = Math.min(1, Math.max(0, ny));
      deco.nx = nx;
      deco.ny = ny;
      positionPlaced(deco);
    }

    function onUp(e) {
      dragging = false;
      if (deco.img.hasPointerCapture && deco.img.hasPointerCapture(e.pointerId)) {
        deco.img.releasePointerCapture(e.pointerId);
      }
    }

    deco.img.addEventListener('pointerdown', onDown);
    deco.img.addEventListener('pointermove', onMove);
    deco.img.addEventListener('pointerup', onUp);
    deco.img.addEventListener('pointercancel', onUp);
  }

  // Wires up the one-finger "grab the handle" gesture for a single placed
  // sticker. Distance from the sticker's own center sets its scale, and the
  // angle back to the sticker's center sets its rotation — both updated
  // together on every pointermove, so it reads as one fluid resize+turn.
  function beginHandleDrag(deco) {
    let dragging = false;

    function onHandlePointerDown(e) {
      e.stopPropagation();
      if (locked) return;
      dragging = true;
      selectPlaced(deco.id);
      deco.handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    function onHandlePointerMove(e) {
      if (!dragging) return;
      const artRect = artboard.getBoundingClientRect();
      const cx = artRect.left + deco.nx * cssW;
      const cy = artRect.top + deco.ny * cssH;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);

      deco.angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const rawScale = dist / DECOR_REF_DIST;
      deco.scale = Math.min(DECOR_MAX_SCALE, Math.max(DECOR_MIN_SCALE, rawScale));
      positionPlaced(deco);
    }

    function onHandlePointerUp(e) {
      dragging = false;
      if (deco.handle.hasPointerCapture && deco.handle.hasPointerCapture(e.pointerId)) {
        deco.handle.releasePointerCapture(e.pointerId);
      }
    }

    deco.handle.addEventListener('pointerdown', onHandlePointerDown);
    deco.handle.addEventListener('pointermove', onHandlePointerMove);
    deco.handle.addEventListener('pointerup', onHandlePointerUp);
    deco.handle.addEventListener('pointercancel', onHandlePointerUp);
  }

  function placeAt(clientX, clientY) {
    if (locked) return;

    if (!selectedItem) {
      // No tray item pending — a tap on blank hand space just finalizes
      // whatever sticker was being adjusted.
      deselectPlaced();
      return;
    }

    const n = toNormalized(clientX, clientY);
    if (n.x < 0 || n.x > 1 || n.y < 0 || n.y > 1) return;

    createPlacedDecoration(selectedItem, n.x, n.y);
  }

  function onArtboardPointerDown(e) {
    placeAt(e.clientX, e.clientY);
  }

  /* ---------------- Done / Reset ---------------- */

  function onDone() {
    if (locked) return;
    locked = true;
    selectedItem = null;
    deselectPlaced();
    decorBtns.forEach((btn) => btn.classList.remove('active'));
    decorTray.classList.add('locked');
    doneBtn.disabled = true;
    updateHint();
  }

  function onReset() {
    locked = false;
    selectedItem = null;
    selectedPlacedId = null;
    placedDecorations = [];
    decorLayer.innerHTML = '';
    decorBtns.forEach((btn) => btn.classList.remove('active'));
    decorTray.classList.remove('locked');
    doneBtn.disabled = false;
    updateHint();
  }

  /* ---------------- Wire up ---------------- */

  decorBtns.forEach((btn) => {
    btn.addEventListener('click', () => selectItem(btn.dataset.item));
  });
  artboard.addEventListener('pointerdown', onArtboardPointerDown);
  doneBtn.addEventListener('click', onDone);
  resetBtn.addEventListener('click', onReset);

  window.addEventListener('resize', setupCanvases);
  window.addEventListener('orientationchange', () => setTimeout(setupCanvases, 60));

  function boot() {
    setupCanvases();
    updateHint();
  }

  if (palm.complete && srcFlower.complete) {
    boot();
  } else {
    let pending = 0;
    const onLoad = () => { if (--pending <= 0) boot(); };
    [palm, srcFlower].forEach((img) => {
      if (!img.complete) {
        pending++;
        img.addEventListener('load', onLoad, { once: true });
      }
    });
    if (pending === 0) boot();
  }
})();
