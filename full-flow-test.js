/* =========================================================
   Jiyana's Mehendi Studio — full flow test
   Purpose: connect the three previously-isolated, individually
   approved systems into one real sequence:

     pick design -> trace guide -> Done -> dry -> scrape -> done

   Nothing about the cone/ink drawing feel, the guide-layer
   technique, or the dry+scrape mechanic changes here — this file
   is the sequencing between them. The one genuinely new piece is
   completion detection for scraping: the old isolated dry-scrape
   test let you scrape forever with no end state, but "once fully
   scraped, show the finished result" needs a real trigger, so
   this adds a cheap coverage check (a small downscaled copy of
   the dried layer) that auto-finishes once residue drops below
   5% — otherwise a kid could be stuck picking at stray pixels
   forever, which isn't "feels great."
   ========================================================= */

(() => {
  const stage = document.getElementById('stage');
  const artboard = document.getElementById('artboard');
  const palm = document.getElementById('palm');

  const stencilCanvas = document.getElementById('stencilCanvas');
  const stainCanvas = document.getElementById('stainCanvas');
  const driedCanvas = document.getElementById('driedCanvas');
  const wetCanvas = document.getElementById('wetCanvas');
  const stampStage = document.getElementById('stampStage');

  const toolAnchor = document.getElementById('toolAnchor');
  const cone = document.getElementById('cone');
  const toothpick = document.getElementById('toothpick');
  const dotTool = document.getElementById('dotTool');

  // Small unobtrusive marker used by every tool that doesn't get the
  // full-icon treatment above (ruler, curve, circle stamp, paisley
  // stamp, eraser) — see setTool()/showTool() for why.
  const actionCursor = document.getElementById('actionCursor');

  const scrapeCursor = document.getElementById('scrapeCursor');
  const scraperTool = document.getElementById('scraperTool');
  const dryerRig = document.getElementById('dryerRig');

  const picker = document.getElementById('picker');
  const pickerCards = document.getElementById('pickerCards');
  const hint = document.getElementById('hint');
  const changeBtn = document.getElementById('changeBtn');
  const controls = document.getElementById('controls');

  const toolbar = document.getElementById('toolbar');
  const toolSelectBtns = Array.from(document.querySelectorAll('.toolBtn.tool-select'));
  const undoBtn = document.getElementById('undoBtn');
  const iconClearBtn = document.getElementById('iconClearBtn');
  const iconDoneBtn = document.getElementById('iconDoneBtn');

  // Reward loop — coin counter on the picker screen, and the result
  // panel (stars + coins + Next Design) shown once a design is done.
  const coinCounterAmount = document.getElementById('coinCounterAmount');
  const resultPanel = document.getElementById('resultPanel');
  const resultStarEls = Array.from(document.querySelectorAll('.resultStar'));
  const resultCoinAmount = document.getElementById('resultCoinAmount');
  const nextDesignBtn = document.getElementById('nextDesignBtn');

  const stencilCtx = stencilCanvas.getContext('2d');
  const stainCtx = stainCanvas.getContext('2d');
  const driedCtx = driedCanvas.getContext('2d');
  const wetCtx = wetCanvas.getContext('2d');

  const inkBuffer = document.createElement('canvas');
  const inkBufferCtx = inkBuffer.getContext('2d');
  const maskCanvas = document.createElement('canvas'); // hand silhouette
  const maskCtx = maskCanvas.getContext('2d');
  const lightStain = document.createElement('canvas');
  const lightStainCtx = lightStain.getContext('2d');
  const darkStain = document.createElement('canvas');
  const darkStainCtx = darkStain.getContext('2d');
  const doseMap = document.createElement('canvas');
  const doseMapCtx = doseMap.getContext('2d');
  const stainBlend = document.createElement('canvas');
  const stainBlendCtx = stainBlend.getContext('2d');

  const PALM_ASPECT = 956 / 1489;

  /* ---------------- Design picker + guide (from the stencil tests) ---------------- */
  const STENCIL_OPACITY = 0.34;

  // Coins awarded on completion — harder/denser designs pay more, per
  // Vinit's brief. Flower and the shorter text designs are the simplest
  // (fewest/least-detailed strokes), the peacocks are visibly denser
  // (sized up to 0.62 width vs. the flower's 0.46 specifically because
  // of that density), and Peacock Advanced is the hardest of all, so it
  // pays the most. These are a first-pass judgment call, not a tuned
  // economy — trivial to adjust, just numbers on each design entry.
  const DESIGNS = [
    {
      id: 'flower',
      label: 'Flower',
      img: document.getElementById('src-flower'),
      center: { x: 0.5, y: 0.58 },
      widthRatio: 0.46,
      coins: 10,
    },
    {
      id: 'peacock_easy',
      label: 'Peacock (Easy)',
      img: document.getElementById('src-peacock_easy'),
      center: { x: 0.5, y: 0.52 },
      widthRatio: 0.62,
      coins: 20,
    },
    {
      id: 'peacock_advanced',
      label: 'Peacock (Advanced)',
      img: document.getElementById('src-peacock_advanced'),
      center: { x: 0.5, y: 0.52 },
      widthRatio: 0.62,
      coins: 35,
    },
    {
      id: 'dark_vibes',
      label: 'Dark Vibes',
      img: document.getElementById('src-dark_vibes'),
      center: { x: 0.5, y: 0.50 },
      widthRatio: 0.40,
      coins: 12,
    },
    {
      id: 'jiyana',
      label: 'Jiyana',
      img: document.getElementById('src-jiyana'),
      center: { x: 0.5, y: 0.52 },
      widthRatio: 0.54,
      coins: 15,
    },
    {
      id: 'jash',
      label: 'Jash',
      img: document.getElementById('src-jash'),
      center: { x: 0.52, y: 0.56 },
      widthRatio: 0.40,
      coins: 10,
    },
  ];

  let activeDesign = null;

  /* ---------------- Reward loop: coins + stars ----------------
     No shop/spending yet, per the brief — this is just the earn side:
     a persisted running coin total (localStorage, since this is a real
     game file, not a chat artifact) shown on the picker screen, and a
     per-design result (stars + coins) computed once when a design is
     finished. */
  const COIN_STORAGE_KEY = 'jiyanaMehendiCoins';

  function loadCoinTotal() {
    const raw = localStorage.getItem(COIN_STORAGE_KEY);
    const n = raw !== null ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function saveCoinTotal() {
    localStorage.setItem(COIN_STORAGE_KEY, String(totalCoins));
  }

  function updateCoinCounter() {
    coinCounterAmount.textContent = String(totalCoins);
  }

  let totalCoins = loadCoinTotal();

  // Set once per design in onDone() (while activeDesign/the guide/the
  // ink are all still available to measure), then displayed by
  // showResult() once scraping actually finishes.
  let earnedStars = 0;
  let earnedCoins = 0;

  function buildPickerCards() {
    DESIGNS.forEach((design) => {
      const card = document.createElement('div');
      card.className = 'pickerCard';
      const thumb = document.createElement('img');
      thumb.src = design.img.src;
      thumb.alt = design.label;
      const label = document.createElement('div');
      label.className = 'pickerLabel';
      label.textContent = design.label;
      card.appendChild(thumb);
      card.appendChild(label);
      card.addEventListener('click', () => selectDesign(design));
      pickerCards.appendChild(card);
    });
  }

  function drawStencilGuide() {
    stencilCtx.clearRect(0, 0, cssW, cssH);
    if (!activeDesign || !cssW || !cssH || !activeDesign.img.naturalWidth) return;

    const img = activeDesign.img;
    const w = cssW * activeDesign.widthRatio;
    const h = w * (img.naturalHeight / img.naturalWidth);
    const x = activeDesign.center.x * cssW - w / 2;
    const y = activeDesign.center.y * cssH - h / 2;

    stencilCtx.globalAlpha = STENCIL_OPACITY;
    stencilCtx.drawImage(img, x, y, w, h);
    stencilCtx.globalAlpha = 1;

    stencilCtx.globalCompositeOperation = 'destination-in';
    stencilCtx.drawImage(maskCanvas, 0, 0, cssW, cssH);
    stencilCtx.globalCompositeOperation = 'source-over';
  }

  /* ---------------- Phase state machine ---------------- */
  // picking -> tracing -> drying -> scraping -> done
  let phase = 'picking';

  function setHint(text) {
    hint.textContent = text || '';
    hint.classList.toggle('visible', !!text);
  }

  function updateControlsForPhase() {
    changeBtn.classList.toggle('hidden', phase !== 'tracing');
    controls.style.display = (phase === 'tracing' || phase === 'done') ? 'flex' : 'none';
    toolbar.classList.toggle('hidden', phase !== 'tracing');
    resultPanel.classList.toggle('hidden', phase !== 'done');
  }

  function selectDesign(design) {
    activeDesign = design;
    picker.classList.add('hidden');
    phase = 'tracing';
    clearWetInk();
    drawStencilGuide();
    setTool('cone');
    setHint('Trace the design with the cone');
    updateControlsForPhase();
  }

  function resetToPicker() {
    discardStagedShape();
    phase = 'picking';
    activeDesign = null;
    picker.classList.remove('hidden');
    clearTimeout(dryerTimer);
    dryerRig.classList.remove('active');
    wetCanvas.classList.remove('fade-out');
    hideAllToolCursors();
    scrapeCursor.classList.remove('visible', 'scraping');
    prevScrapeX = null;
    prevScrapeY = null;
    stencilCtx.clearRect(0, 0, cssW, cssH);
    clearWetInk();
    driedCtx.clearRect(0, 0, cssW, cssH);
    stainCtx.clearRect(0, 0, cssW, cssH);
    doseMapCtx.clearRect(0, 0, cssW, cssH);
    setHint('');
    updateControlsForPhase();
  }

  changeBtn.addEventListener('click', resetToPicker);
  nextDesignBtn.addEventListener('click', resetToPicker);
  iconClearBtn.addEventListener('click', clearWetInk);
  iconDoneBtn.addEventListener('click', onDone);

  buildPickerCards();

  /* ---------------- Tool switching (Cone / Toothpick / Dotting tool /
     Ruler / Curve guide / Circle stamp / Paisley stamp) ----------------
     TOOL_KIND drives pointer routing so each new tool reuses whichever
     existing mechanism fits it instead of a bespoke handler:
       freehand      -> cone/toothpick's drag-a-smoothed-line engine
       stamp         -> dot's tap-and-mark-immediately engine
       drag-straight -> ruler: press start point, release end point
       drag-arc      -> curve: same drag, auto-smoothed into a bezier */
  let currentTool = 'cone';
  // Only the 3 tools that get shown at full size on the hand (see
  // ICON_FOLLOW_TOOLS below) need an actual <img> in #toolAnchor.
  const TOOL_IMAGES = { cone, toothpick, dot: dotTool };

  // Cone/toothpick/dotting-tool are shown full-size resting at the
  // fingertip because their tip/ball IS the tool's real reference point
  // and the rest of the icon trails away from it, so it never covers
  // the spot being worked on. Every other tool's toolbar icon is sized
  // to read clearly as a button, not to sit on the hand — showing it
  // full-size there blocked the player's view of exactly what they were
  // doing, so those tools use the small #actionCursor marker instead
  // (see showTool()).
  const ICON_FOLLOW_TOOLS = new Set(['cone', 'toothpick', 'dot']);

  const TOOL_KIND = {
    cone: 'freehand',
    toothpick: 'freehand',
    dot: 'stamp',
    ruler: 'drag-straight',
    curve: 'drag-arc',
    circle: 'stamp',
    paisley: 'stamp',
    // The eraser drags exactly like the cone/toothpick (press, drag,
    // release) — it just removes ink instead of adding it — so it
    // reuses the freehand engine verbatim rather than a new mechanic.
    eraser: 'freehand',
  };

  // Switching tools is a "next action" — whatever staged Dot/Circle/
  // Paisley shape was being adjusted (see the staged-shape system further
  // down) gets baked into the henna first, exactly like tapping elsewhere
  // on the hand would.
  function setTool(toolId) {
    bakeStagedShape();
    currentTool = toolId;
    toolSelectBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === toolId);
    });
    Object.entries(TOOL_IMAGES).forEach(([id, img]) => {
      img.style.display = id === toolId ? 'block' : 'none';
    });
  }

  toolSelectBtns.forEach((btn) => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  /* =====================================================================
     M1 DRAW ENGINE — same cone-follow + smooth-ink code as main.js /
     the stencil tests, targeting wetCanvas instead of inkCanvas, and
     only active during the 'tracing' phase.
     ===================================================================== */

  const CONE_TIP_NORM = { x: 0.971, y: 0.973 };
  const CONE_WIDTH_RATIO = 0.42;

  // Toothpick: measured the same way as the cone (bbox-extremal-point on
  // its own cropped art) — its sharper bottom-left point is the drawing
  // tip. Shown a bit smaller/daintier than the cone, matching a thinner
  // real-world tool.
  const TOOTHPICK_TIP_NORM = { x: 0.0314, y: 0.9650 };
  const TOOTHPICK_WIDTH_RATIO = 0.30;

  // Dotting tool: the ball end (its actual stamping surface) is the
  // reference point instead of a sharp tip. It never rotates — a round
  // ball has no meaningful heading — so no tilt math applies to it.
  const DOT_TIP_NORM = { x: 0.878, y: 0.113 };
  const DOT_WIDTH_RATIO = 0.22;

  const POINT_SMOOTHING_TAU = 0.045;
  const ANGLE_SMOOTHING_TAU = 0.09;
  const BASE_TILT_DEG = 0;
  const TILT_GAIN = 6;
  const MAX_TILT_DEG = 16;
  const TOUCH_OFFSET_NORM = 0.085;
  const STROKE_TAPER_POINTS = 10;
  const STROKE_MIN_WIDTH_FACTOR = 0.32;
  const STROKE_COLOR_RGB = '66, 41, 20';
  const STROKE_ALPHA = 0.92;
  const MIN_POINT_DISTANCE = 0.0015;

  // Per-tool line width — the toothpick is explicitly "noticeably
  // thinner" than the cone, for fine detail work.
  const STROKE_WIDTH_RATIO_BY_TOOL = {
    cone: 0.00956,
    toothpick: 0.0045,
    // Ruler/curve draw one precise, deliberate mark rather than an
    // organic stroke, so a fixed mid-weight line (no taper) reads best.
    ruler: 0.0075,
    curve: 0.0075,
    // Eraser: deliberately wide — "reasonably sized... not too thin" per
    // the brief, since a hairline eraser would be useless for correcting
    // a mistake without pixel-precise aim. Roughly 4x the cone's width.
    eraser: 0.04,
  };

  // Dotting tool: a single tap-placed dot, not a dragged line. Fixed
  // size so every dot reads as clean and consistent, per the brief.
  const DOT_RADIUS_RATIO = 0.009;

  // Circle stamp: same tap-to-place idea as the dot, but hollow —
  // a stroked ring instead of a filled disc.
  const CIRCLE_STAMP_RADIUS_RATIO = 0.014;
  const CIRCLE_STAMP_LINE_WIDTH_RATIO = 0.004;

  // Paisley/teardrop stamp: fixed-size procedural shape (see
  // stampPaisley below), scaled by this radius.
  const PAISLEY_RADIUS_RATIO = 0.026;

  // ---------------- Staged shape (Dot / Circle stamp / Paisley stamp) ----
  // Replaces the old small/medium/large size buttons. Tapping one of these
  // 3 tools places a temporary shape that isn't painted into the henna
  // yet — it can be dragged to move, and has the same one-finger resize+
  // rotate handle already proven out on decoration-test.js's stickers
  // (see beginStagedHandleDrag). It only becomes permanent ink the moment
  // the player does their next action: taps elsewhere, switches tools, or
  // hits Done (see bakeStagedShape and its call sites).
  const STAMP_MIN_SCALE = 0.5;
  const STAMP_MAX_SCALE = 2.2;
  const STAMP_HANDLE_SIZE = 30;
  const STAMP_HANDLE_GAP = 14;
  // Headroom around the shape's own reference radius inside the small
  // preview canvas, so scaling up toward STAMP_MAX_SCALE via CSS width
  // doesn't clip the shape against the canvas's own edge.
  const STAMP_PREVIEW_PADDING = 1.7;

  // Ruler/curve drag: below this normalized drag distance, treat it as
  // an accidental tap rather than a real placed line — commits nothing.
  const MIN_DRAG_DISTANCE = 0.01;

  let dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  let cssW = 0, cssH = 0;

  let rawPoint = { x: 0.5, y: 0.55 };
  let smoothedPoint = { x: 0.5, y: 0.55 };
  let prevSmoothed = { x: 0.5, y: 0.55 };
  let currentAngle = BASE_TILT_DEG;
  let currentPointerType = 'mouse';
  let hasPointer = false;

  let isDrawing = false;
  let strokePoints = [];
  let lastCommitted = null;

  // Ruler/curve drag state — press sets dragStart, every move updates
  // dragCurrent (+ dragRawPoints, used by the curve tool's auto-smoothing
  // to find how far the user's drag bulged away from a straight line).
  let isDragging = false;
  let dragStart = null;
  let dragCurrent = null;
  let dragRawPoints = [];

  let lastFrameTime = performance.now();

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

  // Canvases that hold real player-generated work needing to survive a
  // resize/orientation-change, mapped to their context — everything else
  // (maskCanvas, stencilCanvas, stainCanvas) is fully regenerated fresh
  // each time from a source that isn't itself a canvas (the palm image,
  // activeDesign, or these five), so there's nothing to preserve there.
  const PRESERVE_ON_RESIZE = {
    inkBuffer: () => ({ canvas: inkBuffer, ctx: inkBufferCtx }),
    driedCanvas: () => ({ canvas: driedCanvas, ctx: driedCtx }),
    lightStain: () => ({ canvas: lightStain, ctx: lightStainCtx }),
    darkStain: () => ({ canvas: darkStain, ctx: darkStainCtx }),
    doseMap: () => ({ canvas: doseMap, ctx: doseMapCtx }),
  };

  function setupCanvases() {
    const hadSize = cssW > 0 && cssH > 0;

    // Resizing a canvas's width/height always wipes its pixels — that's
    // just how canvases work, there's no browser option to resize
    // without clearing. So preserving anything means grabbing a copy of
    // each of these first and painting it back afterward, stretched to
    // the new size. layoutArtboard() always keeps the same PALM_ASPECT
    // regardless of window size, so this stretch never distorts
    // anything — it's a uniform scale, not a reshape.
    const preserved = {};
    if (hadSize) {
      Object.entries(PRESERVE_ON_RESIZE).forEach(([key, get]) => {
        const { canvas } = get();
        if (canvas.width > 0 && canvas.height > 0) {
          const snap = document.createElement('canvas');
          snap.width = canvas.width;
          snap.height = canvas.height;
          snap.getContext('2d').drawImage(canvas, 0, 0);
          preserved[key] = snap;
        }
      });
    }

    layoutArtboard();
    const rect = artboard.getBoundingClientRect();
    cssW = rect.width;
    cssH = rect.height;
    if (cssW === 0 || cssH === 0) return;

    [wetCanvas, inkBuffer, maskCanvas, stencilCanvas, stainCanvas, driedCanvas, lightStain, darkStain, doseMap]
      .forEach((c) => {
        c.width = Math.round(cssW * dpr);
        c.height = Math.round(cssH * dpr);
      });
    [wetCanvas, stencilCanvas, stainCanvas, driedCanvas].forEach((c) => {
      c.style.width = cssW + 'px';
      c.style.height = cssH + 'px';
    });

    [wetCtx, inkBufferCtx, maskCtx, stencilCtx, stainCtx, driedCtx, lightStainCtx, darkStainCtx, doseMapCtx]
      .forEach((c) => c.setTransform(dpr, 0, 0, dpr, 0, 0));

    maskCtx.clearRect(0, 0, cssW, cssH);
    maskCtx.drawImage(palm, 0, 0, cssW, cssH);

    inkBufferCtx.clearRect(0, 0, cssW, cssH);
    wetCtx.clearRect(0, 0, cssW, cssH);

    // Paint every preserved snapshot back, stretched from its old CSS
    // size to the current one.
    Object.entries(preserved).forEach(([key, snap]) => {
      const { ctx } = PRESERVE_ON_RESIZE[key]();
      ctx.drawImage(snap, 0, 0, snap.width, snap.height, 0, 0, cssW, cssH);
    });

    // Rebuild whichever derived layers depend on what was just restored
    // — only for the phase(s) where that layer actually matters, so a
    // resize can't resurrect something the game had deliberately cleared
    // (e.g. the stencil guide right after Done, or driedCanvas once a
    // design is fully complete).
    if (phase === 'tracing') {
      compositeInk(); // rebuild wetCanvas from the restored inkBuffer
    }
    if (phase === 'drying' || phase === 'scraping' || phase === 'done') {
      renderStain(); // rebuild stainCanvas from the restored stain layers + dose map
    }

    layoutAllToolImages();
    layoutScraperTool();
    if (phase === 'tracing') {
      drawStencilGuide();
    }

    // A staged (not-yet-baked) Dot/Circle/Paisley shape is sized/
    // positioned proportionally to the artboard, same as everything
    // else — redraw its small preview bitmap and reposition it so a
    // mid-adjustment orientation change (a real scenario on a tablet)
    // doesn't leave it the wrong size or in the wrong spot.
    if (stagedShape) {
      renderStagedPreviewBitmap();
      positionStagedShape();
    }
  }

  // Same anchor-and-rotate-around-tip technique for all 3 tools: the
  // image is offset so its own tip sits at local (0,0) — the point
  // toolAnchor's translate() moves to the drawing position — with
  // transform-origin set to that same point so rotation pivots there.
  function layoutToolImage(img, tipNorm, widthRatio) {
    if (!img.naturalWidth || !cssW) return;
    const ratio = img.naturalHeight / img.naturalWidth;
    const w = cssW * widthRatio;
    const h = w * ratio;
    img.style.width = w + 'px';
    img.style.height = h + 'px';
    const tipX = w * tipNorm.x;
    const tipY = h * tipNorm.y;
    img.style.left = -tipX + 'px';
    img.style.top = -tipY + 'px';
    img.style.transformOrigin = `${tipX}px ${tipY}px`;
  }

  function layoutAllToolImages() {
    layoutToolImage(cone, CONE_TIP_NORM, CONE_WIDTH_RATIO);
    layoutToolImage(toothpick, TOOTHPICK_TIP_NORM, TOOTHPICK_WIDTH_RATIO);
    layoutToolImage(dotTool, DOT_TIP_NORM, DOT_WIDTH_RATIO);
  }

  function toNormalized(clientX, clientY) {
    const rect = artboard.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }

  // Reveals whichever on-canvas indicator fits the current tool: the
  // real icon for cone/toothpick/dot, or the small actionCursor marker
  // for everything else — and makes sure only one of the two is ever
  // showing at a time.
  function showTool() {
    if (ICON_FOLLOW_TOOLS.has(currentTool)) {
      toolAnchor.classList.add('visible');
      actionCursor.classList.remove('visible');
    } else {
      actionCursor.classList.add('visible');
      toolAnchor.classList.remove('visible');
    }
  }

  function hideAllToolCursors() {
    toolAnchor.classList.remove('visible');
    actionCursor.classList.remove('visible');
  }

  function handleDrawPointerMove(e) {
    currentPointerType = e.pointerType || 'mouse';
    rawPoint = toNormalized(e.clientX, e.clientY);
    hasPointer = true;
    showTool();
  }

  function handleDrawPointerDown(e) {
    currentPointerType = e.pointerType || 'mouse';
    rawPoint = toNormalized(e.clientX, e.clientY);
    smoothedPoint = { x: rawPoint.x, y: rawPoint.y };
    hasPointer = true;
    showTool();
    pushUndoSnapshot();
    isDrawing = true;
    strokePoints = [];
    lastCommitted = null;
    artboard.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  // Stamp tools (dot / circle / paisley): tap-to-place a temporary,
  // adjustable shape (see the staged-shape system below) rather than
  // painting immediately — movement while held still isn't tracked for
  // ink purposes (a stamp shouldn't smear into a line), but the shape it
  // places can now be moved/resized/rotated afterward before it bakes.
  //
  // Each shape's drawer function below draws it in LOCAL coordinates
  // (centered on the canvas context's current origin, radius R) rather
  // than at an absolute point — the caller is responsible for
  // translate/rotate/scale-ing the context first. This lets the exact
  // same drawing code serve both the small live-preview canvas (drawn
  // once, unrotated, then resized/rotated/mirrored cheaply via CSS) and
  // the final full-size bake into inkBuffer (translated/rotated/mirrored
  // via the canvas API to the shape's real final position/angle/flip).
  function drawDotShapeLocal(ctx, r) {
    ctx.fillStyle = `rgba(${STROKE_COLOR_RGB}, ${STROKE_ALPHA})`;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Circle stamp: the dot's hollow sibling — a stroked ring instead of a
  // filled disc. Line weight is kept proportional to the radius (same
  // ratio as the original fixed-size version) so a bigger circle doesn't
  // end up with a comparatively hairline edge.
  function drawCircleStampShapeLocal(ctx, r) {
    ctx.strokeStyle = `rgba(${STROKE_COLOR_RGB}, ${STROKE_ALPHA})`;
    ctx.lineWidth = r * (CIRCLE_STAMP_LINE_WIDTH_RATIO / CIRCLE_STAMP_RADIUS_RATIO);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Paisley/teardrop stamp: point at top, rounded body below, built from
  // 4 bezier curves (the exact curve was proven out in a Python bezier
  // preview before being ported here). Local coordinates only — mirroring
  // (the new flip control) and rotation are both handled by the caller's
  // context transform, not by this function.
  function drawPaisleyShapeLocal(ctx, R) {
    const P = (x, y) => ({ x: x * R, y: y * R });
    const top = P(0, -1.35);
    const right = P(0.95, -0.05);
    const bottom = P(0, 1.15);
    const left = P(-0.95, -0.05);
    const c1 = P(0.22, -1.28), c2 = P(0.95, -0.65);
    const c3 = P(1.05, 0.45), c4 = P(0.55, 1.1);
    const c5 = P(-0.55, 1.1), c6 = P(-1.05, 0.45);
    const c7 = P(-0.95, -0.65), c8 = P(-0.22, -1.28);

    ctx.fillStyle = `rgba(${STROKE_COLOR_RGB}, ${STROKE_ALPHA})`;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, right.x, right.y);
    ctx.bezierCurveTo(c3.x, c3.y, c4.x, c4.y, bottom.x, bottom.y);
    ctx.bezierCurveTo(c5.x, c5.y, c6.x, c6.y, left.x, left.y);
    ctx.bezierCurveTo(c7.x, c7.y, c8.x, c8.y, top.x, top.y);
    ctx.closePath();
    ctx.fill();
  }

  const STAMP_SHAPE_DRAWERS = {
    dot: drawDotShapeLocal,
    circle: drawCircleStampShapeLocal,
    paisley: drawPaisleyShapeLocal,
  };
  const STAMP_RADIUS_RATIO = {
    dot: DOT_RADIUS_RATIO,
    circle: CIRCLE_STAMP_RADIUS_RATIO,
    paisley: PAISLEY_RADIUS_RATIO,
  };
  // Flip mechanism is fully wired up (see bakeStagedShape/
  // positionStagedShape) and verified to mirror correctly — but checked
  // the actual paisley shape's own control points and they're exactly
  // left-right mirror-symmetric (right/left, c1/c8, c2/c7, c3/c6, c4/c5
  // are all mirror pairs), so flipping it produces a pixel-identical
  // result. Shipping a flip button that visibly does nothing would look
  // broken, so it's disabled (empty set) until the paisley shape itself
  // is redrawn with some asymmetry (e.g. a curled tip like a real
  // paisley/mango motif) — flagged to Vinit rather than shipped silently.
  // Re-enable by adding 'paisley' back to this set once that's done.
  const STAMP_CAN_FLIP = new Set([]);

  let stagedShape = null; // { tool, wrap, previewCanvas, handle, flipBtn, nx, ny, scale, angle, flip, baseCssSize }

  function handleStampPointerDown(e) {
    currentPointerType = e.pointerType || 'mouse';
    rawPoint = toNormalized(e.clientX, e.clientY);
    hasPointer = true;
    showTool();
    // Tapping blank hand space is itself a "next action" for whatever
    // was previously staged — bake it, then place the new shape.
    bakeStagedShape();
    createStagedShape(currentTool, rawPoint.x, rawPoint.y);
    artboard.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  // Draws a staged shape's small live-preview bitmap once, at a
  // reference size derived from the current artboard width — called at
  // creation, and again on resize/orientation-change (see setupCanvases)
  // so a mid-adjustment device rotation doesn't leave a stale-sized
  // preview. Scale afterward is purely a CSS width change (see
  // positionStagedShape), not a redraw, exactly like decoration-test.js's
  // stickers.
  function renderStagedPreviewBitmap() {
    const s = stagedShape;
    if (!s || !cssW) return;
    const r0 = cssW * STAMP_RADIUS_RATIO[s.tool];
    const size = Math.max(20, Math.round(r0 * STAMP_PREVIEW_PADDING * 2));
    s.previewCanvas.width = size;
    s.previewCanvas.height = size;
    s.baseCssSize = size;
    const ctx = s.previewCanvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    STAMP_SHAPE_DRAWERS[s.tool](ctx, r0);
    ctx.restore();
  }

  // Repositions/rescales/rotates a staged shape from its stored
  // normalized data. transform order (translate -> rotate -> flip) is
  // deliberately the same composition bakeStagedShape() applies via the
  // canvas API, so the live preview always matches exactly what will be
  // painted into the henna once it bakes.
  function positionStagedShape() {
    const s = stagedShape;
    if (!s) return;
    const cx = s.nx * cssW;
    const cy = s.ny * cssH;
    const flipPart = s.flip ? ' scaleX(-1)' : '';
    s.wrap.style.transform = `translate(${cx}px, ${cy}px) rotate(${s.angle}deg)${flipPart}`;

    const w = s.baseCssSize * s.scale;
    s.previewCanvas.style.width = w + 'px';
    s.previewCanvas.style.height = w + 'px';

    const r = w / 2 + STAMP_HANDLE_GAP + STAMP_HANDLE_SIZE / 2;
    s.handle.style.transform = `translate(${r}px, 0px) translate(-50%, -50%)`;
    if (s.flipBtn) {
      s.flipBtn.style.transform = `translate(${-r}px, 0px) translate(-50%, -50%)`;
    }
  }

  function updateStampHint() {
    if (phase !== 'tracing') return;
    if (stagedShape) {
      setHint('Drag the shape to move it, the gold circle to resize/turn it.');
    } else {
      setHint('Trace the design with the cone');
    }
  }

  function createStagedShape(tool, nx, ny) {
    const wrap = document.createElement('div');
    wrap.className = 'stampWrap';

    const previewCanvas = document.createElement('canvas');
    previewCanvas.className = 'stampPreviewCanvas';

    const handle = document.createElement('div');
    handle.className = 'stampHandle';

    wrap.appendChild(previewCanvas);
    wrap.appendChild(handle);

    let flipBtn = null;
    if (STAMP_CAN_FLIP.has(tool)) {
      flipBtn = document.createElement('div');
      flipBtn.className = 'stampFlipBtn';
      flipBtn.textContent = '⇋';
      wrap.appendChild(flipBtn);
    }

    stampStage.appendChild(wrap);

    stagedShape = {
      tool,
      wrap,
      previewCanvas,
      handle,
      flipBtn,
      nx,
      ny,
      scale: 1,
      angle: 0,
      flip: false,
      baseCssSize: 0,
    };

    renderStagedPreviewBitmap();
    positionStagedShape();

    beginStagedBodyDrag();
    beginStagedHandleDrag();
    if (flipBtn) {
      flipBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        stagedShape.flip = !stagedShape.flip;
        positionStagedShape();
      });
    }

    updateStampHint();
  }

  // One-finger drag directly on the staged shape's own preview to move
  // it anywhere on the hand — same offset-from-center technique as
  // decoration-test.js's beginBodyDrag, so the shape doesn't jump to
  // re-center under the finger the instant it's touched.
  function beginStagedBodyDrag() {
    const s = stagedShape;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    function onDown(e) {
      e.stopPropagation();
      dragging = true;
      s.previewCanvas.setPointerCapture(e.pointerId);
      const artRect = artboard.getBoundingClientRect();
      const cx = artRect.left + s.nx * cssW;
      const cy = artRect.top + s.ny * cssH;
      offsetX = e.clientX - cx;
      offsetY = e.clientY - cy;
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
      s.nx = nx;
      s.ny = ny;
      positionStagedShape();
    }

    function onUp(e) {
      dragging = false;
      if (s.previewCanvas.hasPointerCapture && s.previewCanvas.hasPointerCapture(e.pointerId)) {
        s.previewCanvas.releasePointerCapture(e.pointerId);
      }
    }

    s.previewCanvas.addEventListener('pointerdown', onDown);
    s.previewCanvas.addEventListener('pointermove', onMove);
    s.previewCanvas.addEventListener('pointerup', onUp);
    s.previewCanvas.addEventListener('pointercancel', onUp);
  }

  // Same combined resize+rotate handle gesture as decoration-test.js's
  // beginHandleDrag: distance from the shape's center sets scale, angle
  // back to center sets rotation, both updated together every move.
  function beginStagedHandleDrag() {
    const s = stagedShape;
    let dragging = false;

    function onDown(e) {
      e.stopPropagation();
      dragging = true;
      s.handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    function onMove(e) {
      if (!dragging) return;
      const artRect = artboard.getBoundingClientRect();
      const cx = artRect.left + s.nx * cssW;
      const cy = artRect.top + s.ny * cssH;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);

      s.angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const refDist = s.baseCssSize / 2 + STAMP_HANDLE_GAP + STAMP_HANDLE_SIZE / 2;
      const rawScale = dist / refDist;
      s.scale = Math.min(STAMP_MAX_SCALE, Math.max(STAMP_MIN_SCALE, rawScale));
      positionStagedShape();
    }

    function onUp(e) {
      dragging = false;
      if (s.handle.hasPointerCapture && s.handle.hasPointerCapture(e.pointerId)) {
        s.handle.releasePointerCapture(e.pointerId);
      }
    }

    s.handle.addEventListener('pointerdown', onDown);
    s.handle.addEventListener('pointermove', onMove);
    s.handle.addEventListener('pointerup', onUp);
    s.handle.addEventListener('pointercancel', onUp);
  }

  // Paints the staged shape into the real henna canvas at its final
  // position/scale/angle/flip, exactly reproducing the same
  // translate->rotate->flip composition used for the live CSS preview
  // (see positionStagedShape) so there's never a mismatch between what
  // was being adjusted and what actually gets baked.
  function bakeStagedShape() {
    if (!stagedShape) return;
    const s = stagedShape;
    pushUndoSnapshot();
    const cx = s.nx * cssW;
    const cy = s.ny * cssH;
    const r = cssW * STAMP_RADIUS_RATIO[s.tool] * s.scale;
    inkBufferCtx.save();
    inkBufferCtx.translate(cx, cy);
    inkBufferCtx.rotate((s.angle * Math.PI) / 180);
    if (s.flip) inkBufferCtx.scale(-1, 1);
    STAMP_SHAPE_DRAWERS[s.tool](inkBufferCtx, r);
    inkBufferCtx.restore();
    compositeInk();
    destroyStagedShape();
  }

  // Removes the staged shape without painting anything — used when the
  // player is clearly abandoning it (Undo, Clear, changing designs)
  // rather than moving on to something else.
  function discardStagedShape() {
    destroyStagedShape();
  }

  function destroyStagedShape() {
    if (!stagedShape) return;
    stagedShape.wrap.remove();
    stagedShape = null;
    updateStampHint();
  }

  /* ---------------- Ruler (straight) / Curve guide (arc) ----------------
     Both are a press-drag-release gesture: press sets the start point,
     dragging previews the final shape live, release commits it. The
     live preview is drawn straight onto wetCanvas on top of whatever's
     already committed (compositeInk() output) rather than into
     inkBuffer, so nothing is permanent until release — lets the player
     freely adjust before committing, and a released-too-short drag can
     just be discarded instead of leaving a stray mark. */
  function handleDragPointerDown(e) {
    currentPointerType = e.pointerType || 'mouse';
    rawPoint = toNormalized(e.clientX, e.clientY);
    hasPointer = true;
    showTool();
    isDragging = true;
    dragStart = { x: rawPoint.x, y: rawPoint.y };
    dragCurrent = { x: rawPoint.x, y: rawPoint.y };
    dragRawPoints = [dragStart];
    // The live preview line/curve itself is the feedback while
    // dragging — showing the actionCursor marker on top of it would
    // just be clutter, so hide it until the drag ends.
    actionCursor.classList.remove('visible');
    artboard.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function handleDragPointerMove(e) {
    if (!isDragging) return;
    rawPoint = toNormalized(e.clientX, e.clientY);
    dragCurrent = { x: rawPoint.x, y: rawPoint.y };
    dragRawPoints.push(dragCurrent);
    drawDragPreview();
  }

  function drawDragPreview() {
    // compositeInk() resets wetCanvas to exactly the committed ink, wiping
    // any previous preview frame; the preview shape is then drawn on top
    // of that in the same wet-ink look, and finally re-clipped to the
    // hand silhouette. That re-clip is necessary — compositeInk()'s own
    // destination-in mask only covers what was on wetCanvas at the
    // moment it ran, not the preview drawn afterward, so without this
    // second clip the live preview would ignore the hand's edge.
    compositeInk();
    const widthRatio = STROKE_WIDTH_RATIO_BY_TOOL[currentTool] || STROKE_WIDTH_RATIO_BY_TOOL.cone;
    wetCtx.strokeStyle = `rgba(${STROKE_COLOR_RGB}, ${STROKE_ALPHA})`;
    wetCtx.lineWidth = cssW * widthRatio;
    wetCtx.lineCap = 'round';
    wetCtx.lineJoin = 'round';
    wetCtx.beginPath();
    wetCtx.moveTo(dragStart.x * cssW, dragStart.y * cssH);
    if (currentTool === 'curve') {
      const cp = computeArcControlPoint(dragStart, dragCurrent, dragRawPoints);
      wetCtx.quadraticCurveTo(cp.x * cssW, cp.y * cssH, dragCurrent.x * cssW, dragCurrent.y * cssH);
    } else {
      wetCtx.lineTo(dragCurrent.x * cssW, dragCurrent.y * cssH);
    }
    wetCtx.stroke();
    wetCtx.globalCompositeOperation = 'destination-in';
    wetCtx.drawImage(maskCanvas, 0, 0, cssW, cssH);
    wetCtx.globalCompositeOperation = 'source-over';
  }

  // Curve guide's auto-smoothing: find how far the user's raw drag
  // bulged away from the straight start->current chord (the point with
  // the largest signed perpendicular deviation), then place the
  // quadratic control point twice that far past the chord's midpoint —
  // this makes the curve naturally bow out in whichever direction the
  // player actually dragged, instead of a straight line or a fixed arc.
  function computeArcControlPoint(start, current, rawPts) {
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const len = Math.hypot(dx, dy);
    const mid = { x: (start.x + current.x) / 2, y: (start.y + current.y) / 2 };
    if (len < 1e-4) return mid;
    const nx = -dy / len;
    const ny = dx / len;
    let maxDev = 0;
    rawPts.forEach((p) => {
      const vx = p.x - start.x;
      const vy = p.y - start.y;
      const dev = vx * nx + vy * ny;
      if (Math.abs(dev) > Math.abs(maxDev)) maxDev = dev;
    });
    return { x: mid.x + nx * 2 * maxDev, y: mid.y + ny * 2 * maxDev };
  }

  // Commits the final straight line or curve into inkBuffer permanently.
  // The undo snapshot is pushed here (not at press time) and only when
  // a real shape is committed — a drag too short to be intentional
  // (MIN_DRAG_DISTANCE) is discarded with no mark and nothing pushed to
  // the undo stack, so Undo never has to "undo nothing."
  function commitDragShape() {
    if (!isDragging) return;
    const dx = dragCurrent.x - dragStart.x;
    const dy = dragCurrent.y - dragStart.y;
    if (Math.hypot(dx, dy) >= MIN_DRAG_DISTANCE) {
      pushUndoSnapshot();
      const widthRatio = STROKE_WIDTH_RATIO_BY_TOOL[currentTool] || STROKE_WIDTH_RATIO_BY_TOOL.cone;
      inkBufferCtx.strokeStyle = `rgba(${STROKE_COLOR_RGB}, ${STROKE_ALPHA})`;
      inkBufferCtx.lineWidth = cssW * widthRatio;
      inkBufferCtx.lineCap = 'round';
      inkBufferCtx.lineJoin = 'round';
      inkBufferCtx.beginPath();
      inkBufferCtx.moveTo(dragStart.x * cssW, dragStart.y * cssH);
      if (currentTool === 'curve') {
        const cp = computeArcControlPoint(dragStart, dragCurrent, dragRawPoints);
        inkBufferCtx.quadraticCurveTo(cp.x * cssW, cp.y * cssH, dragCurrent.x * cssW, dragCurrent.y * cssH);
      } else {
        inkBufferCtx.lineTo(dragCurrent.x * cssW, dragCurrent.y * cssH);
      }
      inkBufferCtx.stroke();
    }
    compositeInk();
    isDragging = false;
    dragStart = null;
    dragCurrent = null;
    dragRawPoints = [];
    if (phase === 'tracing') showTool(); // bring the actionCursor marker back now dragging has ended
  }

  function endDrag(e) {
    commitDragShape();
    if (e && artboard.hasPointerCapture && artboard.hasPointerCapture(e.pointerId)) {
      artboard.releasePointerCapture(e.pointerId);
    }
  }

  function endStroke(e) {
    isDrawing = false;
    strokePoints = [];
    lastCommitted = null;
    if (e && artboard.hasPointerCapture && artboard.hasPointerCapture(e.pointerId)) {
      artboard.releasePointerCapture(e.pointerId);
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothingFactor(tau, dt) {
    return 1 - Math.exp(-dt / tau);
  }

  function commitPoint(pt) {
    if (lastCommitted) {
      const dx = pt.x - lastCommitted.x;
      const dy = pt.y - lastCommitted.y;
      if (Math.hypot(dx, dy) < MIN_POINT_DISTANCE) return;
    }
    strokePoints.push(pt);
    lastCommitted = pt;

    if (strokePoints.length < 3) return;

    const p0 = strokePoints[strokePoints.length - 3];
    const p1 = strokePoints[strokePoints.length - 2];
    const p2 = strokePoints[strokePoints.length - 1];

    const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

    const taper =
      STROKE_MIN_WIDTH_FACTOR +
      (1 - STROKE_MIN_WIDTH_FACTOR) * Math.min(1, strokePoints.length / STROKE_TAPER_POINTS);
    const widthRatio = STROKE_WIDTH_RATIO_BY_TOOL[currentTool] || STROKE_WIDTH_RATIO_BY_TOOL.cone;
    const lineWidth = cssW * widthRatio * taper;

    // Eraser: same smoothed-quadratic path as every other freehand tool,
    // just composited as destination-out instead of source-over — it
    // removes whatever ink is already there (regardless of which tool
    // put it there) instead of adding new ink. Always reset back to
    // source-over right after stroking so no other tool accidentally
    // inherits erase mode.
    if (currentTool === 'eraser') {
      inkBufferCtx.globalCompositeOperation = 'destination-out';
      inkBufferCtx.strokeStyle = 'rgba(0, 0, 0, 1)';
    } else {
      inkBufferCtx.globalCompositeOperation = 'source-over';
      inkBufferCtx.strokeStyle = `rgba(${STROKE_COLOR_RGB}, ${STROKE_ALPHA})`;
    }
    inkBufferCtx.lineWidth = lineWidth;
    inkBufferCtx.lineCap = 'round';
    inkBufferCtx.lineJoin = 'round';
    inkBufferCtx.beginPath();
    inkBufferCtx.moveTo(mid1.x * cssW, mid1.y * cssH);
    inkBufferCtx.quadraticCurveTo(p1.x * cssW, p1.y * cssH, mid2.x * cssW, mid2.y * cssH);
    inkBufferCtx.stroke();
    inkBufferCtx.globalCompositeOperation = 'source-over';

    compositeInk();
  }

  function compositeInk() {
    wetCtx.clearRect(0, 0, cssW, cssH);
    wetCtx.drawImage(inkBuffer, 0, 0, cssW, cssH);
    wetCtx.globalCompositeOperation = 'destination-in';
    wetCtx.drawImage(maskCanvas, 0, 0, cssW, cssH);
    wetCtx.globalCompositeOperation = 'source-over';
  }

  function clearWetInk() {
    // Clear means "wipe everything" — including whatever was still
    // staged and not yet baked, not just what's already committed ink.
    discardStagedShape();
    inkBufferCtx.clearRect(0, 0, cssW, cssH);
    wetCtx.clearRect(0, 0, cssW, cssH);
    undoStack.length = 0;
    updateUndoButtonState();
  }

  /* ---------------- Undo ----------------
     Snapshots inkBuffer's raw pixels (not the CSS-pixel-space drawing
     API) before each new stroke or dot, so Undo can restore exactly
     what was there before that one action — whether it was a dragged
     cone/toothpick stroke or a single tapped dot. */
  const undoStack = [];

  function pushUndoSnapshot() {
    const snap = document.createElement('canvas');
    snap.width = inkBuffer.width;
    snap.height = inkBuffer.height;
    snap.getContext('2d').drawImage(inkBuffer, 0, 0);
    undoStack.push(snap);
    updateUndoButtonState();
  }

  function undo() {
    // If something is still staged (not yet baked), Undo cancels that —
    // it's the most recent thing the player did, so that's what "undo"
    // means here, rather than reaching further back into already-
    // committed ink history.
    if (stagedShape) {
      discardStagedShape();
      return;
    }
    if (!undoStack.length) return;
    const snap = undoStack.pop();
    inkBufferCtx.save();
    inkBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
    inkBufferCtx.clearRect(0, 0, inkBuffer.width, inkBuffer.height);
    inkBufferCtx.drawImage(snap, 0, 0);
    inkBufferCtx.restore();
    compositeInk();
    updateUndoButtonState();
  }

  function updateUndoButtonState() {
    undoBtn.disabled = undoStack.length === 0;
  }

  undoBtn.addEventListener('click', undo);

  function frame(now) {
    const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    if (hasPointer && phase === 'tracing') {
      const posT = smoothingFactor(POINT_SMOOTHING_TAU, dt);
      prevSmoothed = smoothedPoint;
      smoothedPoint = {
        x: lerp(smoothedPoint.x, rawPoint.x, posT),
        y: lerp(smoothedPoint.y, rawPoint.y, posT),
      };

      const touchLift = currentPointerType === 'touch' ? TOUCH_OFFSET_NORM : 0;
      const inkPoint = { x: smoothedPoint.x, y: smoothedPoint.y - touchLift };

      const velX = (smoothedPoint.x - prevSmoothed.x) / Math.max(dt, 0.001);
      const targetAngle =
        BASE_TILT_DEG + Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, velX * TILT_GAIN));
      const angleT = smoothingFactor(ANGLE_SMOOTHING_TAU, dt);
      currentAngle = lerp(currentAngle, targetAngle, angleT);

      const px = inkPoint.x * cssW;
      const py = inkPoint.y * cssH;
      // Both cursors are kept positioned every frame regardless of which
      // one is actually visible — cheap, and means showTool() never has
      // to worry about syncing position when it swaps which one shows.
      toolAnchor.style.transform = `translate(${px}px, ${py}px)`;
      actionCursor.style.transform = `translate(${px}px, ${py}px)`;

      // Small steering tilt applies to the cone and toothpick (both are
      // dragged line tools); the dotting tool is a stamp with no
      // heading, so it never rotates. The actionCursor marker (ruler,
      // curve, circle stamp, paisley stamp, eraser) is a small symmetric
      // glow with no heading either, so none of those rotate it.
      if (currentTool === 'cone') {
        cone.style.transform = `rotate(${currentAngle}deg)`;
      } else if (currentTool === 'toothpick') {
        toothpick.style.transform = `rotate(${currentAngle}deg)`;
      }

      if (isDrawing) {
        commitPoint(inkPoint);
      }
    }

    requestAnimationFrame(frame);
  }

  /* =====================================================================
     M2 DRY + SCRAPE ENGINE — same code as dry-scrape-test.js, except the
     traced shape now comes from wetCanvas (whatever the player actually
     drew) instead of a hardcoded TEST_PATH, and completion detection is
     new (see file header).
     ===================================================================== */

  const WET_COLOR_RGB = STROKE_COLOR_RGB; // unused directly (wetCanvas already holds real ink), kept for reference
  const DRY_COLOR_RGB = '54, 36, 20';
  const DRY_ALPHA = 0.95;
  const STAIN_LIGHT_RGB = '196, 118, 56';
  const STAIN_DARK_RGB = '133, 66, 28';

  const SCRAPE_RADIUS_RATIO = 0.042;
  const DOSE_PEAK_ALPHA = 0.05;
  const DRY_TRANSITION_MS = 950;
  const DRYER_TOTAL_MS = 1700;
  const FLAKE_SPAWN_INTERVAL_MS = 90;

  const TOOL_TIP_NORM = { x: 0.0377, y: 0.8337 };
  const TOOL_AUTHORED_ANGLE_DEG = 157.76;
  const TOOL_WIDTH_RATIO = 0.34;
  const TOOL_ANGLE_LERP = 0.35;
  const TOOL_MIN_MOVE_PX = 2.5;

  const COVERAGE_W = 96; // downscaled width used for cheap "how much is left" checks
  const COVERAGE_H = Math.round(COVERAGE_W / PALM_ASPECT);
  const COMPLETE_REMAINING_RATIO = 0.05; // auto-finish once <=5% of the original dried paste remains
  const COVERAGE_CHECK_INTERVAL_MS = 80;

  const coverageCanvas = document.createElement('canvas');
  coverageCanvas.width = COVERAGE_W;
  coverageCanvas.height = COVERAGE_H;
  const coverageCtx = coverageCanvas.getContext('2d', { willReadFrequently: true });

  // Second small offscreen buffer, same size as coverageCanvas above —
  // used only by computeGuideCoverageRatio() below, which needs to
  // compare two layers (the guide's shape vs. the player's actual ink)
  // at once rather than counting a single layer.
  const inkCovCanvas = document.createElement('canvas');
  inkCovCanvas.width = COVERAGE_W;
  inkCovCanvas.height = COVERAGE_H;
  const inkCovCtx = inkCovCanvas.getContext('2d', { willReadFrequently: true });

  let toolAngleDeg = -20;
  let prevScrapeX = null, prevScrapeY = null;
  let dryerTimer = null;
  let isScraping = false;
  let lastFlakeAt = 0;
  let initialCoverageCount = 1;
  let lastCoverageCheckAt = 0;

  function layoutScraperTool() {
    if (!scraperTool.naturalWidth || !cssW) return;
    const ratio = scraperTool.naturalHeight / scraperTool.naturalWidth;
    const w = cssW * TOOL_WIDTH_RATIO;
    const h = w * ratio;
    scraperTool.style.width = w + 'px';
    scraperTool.style.height = h + 'px';
    const tipX = w * TOOL_TIP_NORM.x;
    const tipY = h * TOOL_TIP_NORM.y;
    scraperTool.style.left = -tipX + 'px';
    scraperTool.style.top = -tipY + 'px';
    scraperTool.style.transformOrigin = `${tipX}px ${tipY}px`;
  }

  // Scatters faint dark/light speckles within the stroke's own shape —
  // reads as a matte, slightly textured "dried paste crust."
  function addDrySpeckle(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const speckleCount = Math.round((cssW * cssH) / 900);
    for (let i = 0; i < speckleCount; i++) {
      const x = Math.random() * cssW;
      const y = Math.random() * cssH;
      const r = 0.4 + Math.random() * 1.1;
      const light = Math.random() < 0.5;
      ctx.fillStyle = light ? 'rgba(255, 235, 210, 0.10)' : 'rgba(20, 12, 6, 0.14)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function countCoverage(sourceCanvas) {
    coverageCtx.clearRect(0, 0, COVERAGE_W, COVERAGE_H);
    coverageCtx.drawImage(sourceCanvas, 0, 0, COVERAGE_W, COVERAGE_H);
    const data = coverageCtx.getImageData(0, 0, COVERAGE_W, COVERAGE_H).data;
    let count = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 25) count++;
    }
    return count;
  }

  // Star rating is based on how much of the stencil guide's own outline
  // actually got covered by the player's ink — not stroke accuracy, just
  // "did the ink land where the guide was." Reuses the same cheap
  // downscaled-pixel-count approach as the scrape-completion check
  // above, just comparing two layers (guide vs. ink) instead of one.
  // Called once, right when Done is pressed, while activeDesign and
  // wetCanvas both still hold everything needed.
  function computeGuideCoverageRatio() {
    if (!activeDesign || !cssW) return 0;

    // The guide's own shape at full opacity (not the faded
    // STENCIL_OPACITY used for display) and hand-clipped — same
    // placement math as drawStencilGuide(), just rendered small.
    coverageCtx.clearRect(0, 0, COVERAGE_W, COVERAGE_H);
    const img = activeDesign.img;
    const w = COVERAGE_W * activeDesign.widthRatio;
    const h = w * (img.naturalHeight / img.naturalWidth);
    const x = activeDesign.center.x * COVERAGE_W - w / 2;
    const y = activeDesign.center.y * COVERAGE_H - h / 2;
    coverageCtx.drawImage(img, x, y, w, h);
    coverageCtx.globalCompositeOperation = 'destination-in';
    coverageCtx.drawImage(maskCanvas, 0, 0, COVERAGE_W, COVERAGE_H);
    coverageCtx.globalCompositeOperation = 'source-over';
    const guideData = coverageCtx.getImageData(0, 0, COVERAGE_W, COVERAGE_H).data;

    // The player's actual traced ink.
    inkCovCtx.clearRect(0, 0, COVERAGE_W, COVERAGE_H);
    inkCovCtx.drawImage(wetCanvas, 0, 0, COVERAGE_W, COVERAGE_H);
    const inkData = inkCovCtx.getImageData(0, 0, COVERAGE_W, COVERAGE_H).data;

    let guideCount = 0;
    let coveredCount = 0;
    for (let i = 3; i < guideData.length; i += 4) {
      if (guideData[i] > 40) {
        guideCount++;
        if (inkData[i] > 25) coveredCount++;
      }
    }
    return guideCount > 0 ? coveredCount / guideCount : 0;
  }

  // Generous by design, per the brief — this rewards effort, not
  // precision, and there's deliberately no 0-star outcome: reaching
  // this point already means the player traced, dried, and scraped a
  // whole design, so even a light attempt earns something.
  const STAR_THRESHOLD_3 = 0.8;
  const STAR_THRESHOLD_2 = 0.5;

  function starsForCoverage(ratio) {
    if (ratio >= STAR_THRESHOLD_3) return 3;
    if (ratio >= STAR_THRESHOLD_2) return 2;
    return 1;
  }

  // Builds the dried/stain layers from whatever the player actually
  // traced (wetCanvas's own rendered pixels) instead of a hardcoded path.
  // Only the alpha shape matters for the source-in fills below, so
  // wetCanvas's real ink color is irrelevant here — its shape is correct
  // by construction (it's already clipped to the hand, same as the ink
  // layer always has been).
  function buildRevealLayers() {
    driedCtx.clearRect(0, 0, cssW, cssH);
    driedCtx.drawImage(wetCanvas, 0, 0, cssW, cssH);
    driedCtx.globalCompositeOperation = 'source-in';
    driedCtx.fillStyle = `rgba(${DRY_COLOR_RGB}, ${DRY_ALPHA})`;
    driedCtx.fillRect(0, 0, cssW, cssH);
    driedCtx.globalCompositeOperation = 'source-over';
    addDrySpeckle(driedCtx);

    [
      [lightStainCtx, STAIN_LIGHT_RGB],
      [darkStainCtx, STAIN_DARK_RGB],
    ].forEach(([ctx, colorRGB]) => {
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.drawImage(wetCanvas, 0, 0, cssW, cssH);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = `rgba(${colorRGB}, 1)`;
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.globalCompositeOperation = 'source-over';
    });

    doseMapCtx.clearRect(0, 0, cssW, cssH);
    renderStain();

    initialCoverageCount = countCoverage(driedCanvas) || 1;
  }

  function renderStain() {
    if (stainBlend.width !== stainCanvas.width || stainBlend.height !== stainCanvas.height) {
      stainBlend.width = stainCanvas.width;
      stainBlend.height = stainCanvas.height;
      stainBlendCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    stainBlendCtx.clearRect(0, 0, cssW, cssH);
    stainBlendCtx.drawImage(darkStain, 0, 0, cssW, cssH);
    stainBlendCtx.globalCompositeOperation = 'destination-in';
    stainBlendCtx.drawImage(doseMap, 0, 0, cssW, cssH);
    stainBlendCtx.globalCompositeOperation = 'source-over';

    stainCtx.clearRect(0, 0, cssW, cssH);
    stainCtx.drawImage(lightStain, 0, 0, cssW, cssH);
    stainCtx.drawImage(stainBlend, 0, 0, cssW, cssH);
  }

  function onDone() {
    if (phase !== 'tracing') return;

    // Finishing is itself a "next action" — anything still staged
    // (unbaked) needs to become real ink now so it counts toward
    // coverage/stars and actually appears in the finished design.
    bakeStagedShape();

    phase = 'drying';
    updateControlsForPhase();

    // Snapshot this design's reward now, while activeDesign and the
    // guide/ink are all still exactly as the player left them — before
    // anything below clears or changes them.
    earnedStars = starsForCoverage(computeGuideCoverageRatio());
    earnedCoins = activeDesign.coins;

    // Lock the artwork: stop drawing, hide the active tool cursor, and
    // remove the guide so nothing can show through the finished piece
    // later.
    hideAllToolCursors();
    stencilCtx.clearRect(0, 0, cssW, cssH);

    buildRevealLayers();

    setHint('Drying…');
    dryerRig.classList.add('active');
    wetCanvas.classList.add('fade-out');

    clearTimeout(dryerTimer);
    dryerTimer = setTimeout(() => {
      dryerRig.classList.remove('active');
      phase = 'scraping';
      setHint('Drag the tool over the design to reveal it');
      updateControlsForPhase();
      // scrapeCursor stays hidden until a real pointer position is known
      // (see handleScrapePointerMove/Down), same rule as the cone.
    }, Math.max(DRY_TRANSITION_MS, DRYER_TOTAL_MS));
  }

  function completeDesign() {
    phase = 'done';
    driedCtx.clearRect(0, 0, cssW, cssH);
    // "Full dose" everywhere the design exists — darkStain's own alpha
    // shape already matches the traced design exactly, so copying it
    // straight into doseMap makes the whole piece read as fully, richly
    // scraped, not just "mostly done."
    doseMapCtx.clearRect(0, 0, cssW, cssH);
    doseMapCtx.drawImage(darkStain, 0, 0, cssW, cssH);
    renderStain();
    scrapeCursor.classList.remove('visible', 'scraping');
    setHint('Your henna design is complete!');
    showResult(earnedStars, earnedCoins);
    updateControlsForPhase();
  }

  // Populates the result panel and banks the coins — visibility itself
  // is handled by updateControlsForPhase() (called right after this),
  // same separation every other phase-driven element in this file uses.
  function showResult(stars, coins) {
    resultStarEls.forEach((el, i) => {
      el.classList.toggle('earned', i < stars);
    });
    resultCoinAmount.textContent = `+${coins}`;
    totalCoins += coins;
    saveCoinTotal();
    updateCoinCounter();
  }

  function stampErase(x, y, r) {
    const g = driedCtx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.9)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    driedCtx.globalCompositeOperation = 'destination-out';
    driedCtx.fillStyle = g;
    driedCtx.beginPath();
    driedCtx.arc(x, y, r, 0, Math.PI * 2);
    driedCtx.fill();
    driedCtx.globalCompositeOperation = 'source-over';
  }

  function stampDose(x, y, r) {
    const g = doseMapCtx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${DOSE_PEAK_ALPHA})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    doseMapCtx.fillStyle = g;
    doseMapCtx.beginPath();
    doseMapCtx.arc(x, y, r, 0, Math.PI * 2);
    doseMapCtx.fill();
  }

  function spawnFlake() {
    const flake = document.createElement('span');
    flake.className = 'flake';
    const angle = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 10;
    flake.style.setProperty('--fx', `${Math.cos(angle) * dist}px`);
    flake.style.setProperty('--fy', `${Math.sin(angle) * dist}px`);
    flake.style.setProperty('--fr', `${(Math.random() * 60 - 30).toFixed(0)}deg`);
    scrapeCursor.appendChild(flake);
    flake.addEventListener('animationend', () => flake.remove());
  }

  function angleLerp(a, b, t) {
    const diff = (((b - a + 180) % 360) + 360) % 360 - 180;
    return a + diff * t;
  }

  function updateToolTransform(x, y) {
    scrapeCursor.style.transform = `translate(${x}px, ${y}px)`;
    if (prevScrapeX !== null) {
      const dx = x - prevScrapeX, dy = y - prevScrapeY;
      if (Math.hypot(dx, dy) > TOOL_MIN_MOVE_PX) {
        const headingDeg = Math.atan2(dy, dx) * (180 / Math.PI);
        const targetAngle = headingDeg - TOOL_AUTHORED_ANGLE_DEG;
        toolAngleDeg = angleLerp(toolAngleDeg, targetAngle, TOOL_ANGLE_LERP);
      }
    }
    prevScrapeX = x;
    prevScrapeY = y;
    scraperTool.style.transform = `rotate(${toolAngleDeg}deg)`;
  }

  function maybeCheckCompletion() {
    const now = performance.now();
    if (now - lastCoverageCheckAt < COVERAGE_CHECK_INTERVAL_MS) return;
    lastCoverageCheckAt = now;
    const remaining = countCoverage(driedCanvas);
    if (remaining / initialCoverageCount <= COMPLETE_REMAINING_RATIO) {
      completeDesign();
    }
  }

  function scrapeAt(clientX, clientY) {
    const n = toNormalized(clientX, clientY);
    const x = n.x * cssW;
    const y = n.y * cssH;
    const r = cssW * SCRAPE_RADIUS_RATIO;

    stampErase(x, y, r);
    stampDose(x, y, r);
    renderStain();
    updateToolTransform(x, y);

    const now = performance.now();
    if (now - lastFlakeAt > FLAKE_SPAWN_INTERVAL_MS) {
      lastFlakeAt = now;
      spawnFlake();
    }

    maybeCheckCompletion();
  }

  function showScrapeCursorAt(clientX, clientY) {
    const n = toNormalized(clientX, clientY);
    updateToolTransform(n.x * cssW, n.y * cssH);
    if (!scrapeCursor.classList.contains('visible')) {
      scrapeCursor.classList.add('visible');
    }
  }

  function handleScrapePointerDown(e) {
    isScraping = true;
    scrapeCursor.classList.add('scraping');
    artboard.setPointerCapture(e.pointerId);
    showScrapeCursorAt(e.clientX, e.clientY);
    scrapeAt(e.clientX, e.clientY);
    e.preventDefault();
  }

  function handleScrapePointerMove(e) {
    showScrapeCursorAt(e.clientX, e.clientY);
    if (isScraping) scrapeAt(e.clientX, e.clientY);
  }

  function endScrape(e) {
    isScraping = false;
    scrapeCursor.classList.remove('scraping');
    if (e && artboard.hasPointerCapture && artboard.hasPointerCapture(e.pointerId)) {
      artboard.releasePointerCapture(e.pointerId);
    }
  }

  /* ---------------- Unified pointer routing ---------------- */
  function onPointerDown(e) {
    if (phase === 'tracing') {
      const kind = TOOL_KIND[currentTool];
      if (kind === 'stamp') handleStampPointerDown(e);
      else if (kind === 'drag-straight' || kind === 'drag-arc') handleDragPointerDown(e);
      else handleDrawPointerDown(e);
    } else if (phase === 'scraping') {
      handleScrapePointerDown(e);
    }
  }
  function onPointerMove(e) {
    if (phase === 'tracing') {
      const kind = TOOL_KIND[currentTool];
      if (kind === 'drag-straight' || kind === 'drag-arc') {
        // Before the drag starts, still follow the pointer for hover
        // feedback (same as every other tool); once actually dragging,
        // stop — handleDrawPointerMove would re-show the tool icon that
        // handleDragPointerDown deliberately hid.
        if (isDragging) handleDragPointerMove(e);
        else handleDrawPointerMove(e);
      } else {
        handleDrawPointerMove(e);
      }
    } else if (phase === 'scraping') {
      handleScrapePointerMove(e);
    }
  }
  // Always end every kind of interaction on up/cancel, regardless of the
  // current phase — if phase flips (e.g. Done fires) mid-drag, a check
  // gated strictly on phase would skip cleanup and leave pointer capture
  // stuck. endStroke()/endDrag()/endScrape() are all cheap and safe to
  // call even when their interaction never started.
  function onPointerUp(e) {
    endStroke(e);
    endDrag(e);
    endScrape(e);
  }
  function onPointerLeave(e) {
    if (phase !== 'tracing' || currentPointerType !== 'touch') return;
    if (isDrawing) endStroke(e);
    if (isDragging) endDrag(e);
  }

  artboard.addEventListener('pointerdown', onPointerDown);
  artboard.addEventListener('pointermove', onPointerMove);
  artboard.addEventListener('pointerup', onPointerUp);
  artboard.addEventListener('pointercancel', onPointerUp);
  artboard.addEventListener('pointerleave', onPointerLeave);

  /* ---------------- Boot ---------------- */
  window.addEventListener('resize', setupCanvases);
  window.addEventListener('orientationchange', () => setTimeout(setupCanvases, 60));

  if (palm.complete) {
    setupCanvases();
  } else {
    palm.addEventListener('load', setupCanvases);
  }
  [cone, toothpick, dotTool].forEach((img) => {
    if (img.complete) {
      layoutAllToolImages();
    } else {
      img.addEventListener('load', layoutAllToolImages);
    }
  });
  if (scraperTool.complete) {
    layoutScraperTool();
  } else {
    scraperTool.addEventListener('load', layoutScraperTool);
  }

  setTool('cone');
  updateControlsForPhase();
  updateUndoButtonState();
  updateCoinCounter();

  requestAnimationFrame((t) => {
    lastFrameTime = t;
    requestAnimationFrame(frame);
  });
})();
