/* =========================================================
   Jiyana's Mehendi Studio — M2 test: dry + scrape reveal
   Purpose: an ISOLATED proving ground for the dry-then-scratch-
   reveal mechanic, using one hardcoded test stroke instead of
   a real drawing. Does not import or modify main.js — nothing
   here can break the working M1 drawing build. Once this feel
   is approved, the same techniques get wired to the real Done
   button in its own milestone.

   No image assets used anywhere in this file for the mechanic
   itself — dried texture, stain colors, and the scrape cursor
   are all generated in code. (The hairdryer is the one real
   image asset, per Vinit's request.)
   ========================================================= */

(() => {
  const stage = document.getElementById('stage');
  const artboard = document.getElementById('artboard');
  const palm = document.getElementById('palm');
  const stainCanvas = document.getElementById('stainCanvas');
  const driedCanvas = document.getElementById('driedCanvas');
  const wetCanvas = document.getElementById('wetCanvas');
  const scrapeCursor = document.getElementById('scrapeCursor');
  const scraperTool = document.getElementById('scraperTool');
  const dryerRig = document.getElementById('dryerRig');
  const hint = document.getElementById('hint');
  const startDryBtn = document.getElementById('startDryBtn');
  const resetBtn = document.getElementById('resetBtn');

  const stainCtx = stainCanvas.getContext('2d');
  const driedCtx = driedCanvas.getContext('2d');
  const wetCtx = wetCanvas.getContext('2d');

  // hero_palm.png cutout dimensions — same artboard-sizing approach as main.js.
  const PALM_ASPECT = 956 / 1489;

  /* ---------------- Colors & tuning ---------------- */
  const WET_COLOR_RGB = '66, 41, 20';   // matches the approved M1 wet henna color
  const WET_ALPHA = 0.92;
  const DRY_COLOR_RGB = '54, 36, 20';   // darker, less saturated — "matte, drying" look
  const DRY_ALPHA = 0.95;
  const STAIN_LIGHT_RGB = '196, 118, 56';  // lightly-scraped stain
  const STAIN_DARK_RGB = '133, 66, 28';    // richly-scraped stain

  const TEST_LINE_WIDTH_RATIO = 0.0125; // relative to artboard width — a touch bolder than the live game's default so it's easy to scrape in a test
  const SCRAPE_RADIUS_RATIO = 0.042;    // relative to artboard width
  const DOSE_PEAK_ALPHA = 0.05;         // how much richness one stamp adds; repeated/slow passes stack up
  const DRY_TRANSITION_MS = 950;
  const DRYER_TOTAL_MS = 1700;
  const FLAKE_SPAWN_INTERVAL_MS = 90;   // minimum gap between scrape "flake" particles

  /* ---------------- Scraper tool artwork geometry ----------------
     Measured once from scraper_tool.png: the normalized position of the
     blade's working corner within its own image, and the tool's overall
     size relative to the artboard. Same anchor-and-rotate-around-tip
     technique as the cone in main.js. */
  const TOOL_TIP_NORM = { x: 0.0377, y: 0.8337 };
  const TOOL_AUTHORED_ANGLE_DEG = 157.76; // the blade's own angle as drawn (handle -> tip)
  const TOOL_WIDTH_RATIO = 0.34;
  const TOOL_ANGLE_LERP = 0.35;   // per-move smoothing toward the new heading
  const TOOL_MIN_MOVE_PX = 2.5;   // ignore heading changes from sub-pixel jitter

  let dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  let cssW = 0, cssH = 0;
  let toolAngleDeg = -20; // resting angle before any movement has happened
  let prevScrapeX = null, prevScrapeY = null;

  // The single hardcoded test path (normalized 0..1 artboard coordinates) —
  // a simple decorative curve across the palm, standing in for "a real line."
  const TEST_PATH = [
    { x: 0.30, y: 0.72 }, { x: 0.34, y: 0.62 }, { x: 0.33, y: 0.52 },
    { x: 0.40, y: 0.46 }, { x: 0.50, y: 0.47 }, { x: 0.56, y: 0.40 },
    { x: 0.55, y: 0.31 }, { x: 0.47, y: 0.27 }, { x: 0.40, y: 0.31 },
    { x: 0.40, y: 0.39 },
  ];

  // Offscreen working canvases, sized alongside the visible ones.
  const strokeMask = document.createElement('canvas');
  const strokeMaskCtx = strokeMask.getContext('2d');
  const lightStain = document.createElement('canvas');
  const lightStainCtx = lightStain.getContext('2d');
  const darkStain = document.createElement('canvas');
  const darkStainCtx = darkStain.getContext('2d');
  const doseMap = document.createElement('canvas');
  const doseMapCtx = doseMap.getContext('2d');
  const maskCanvas = document.createElement('canvas'); // hand silhouette, same role as in main.js
  const maskCtx = maskCanvas.getContext('2d');

  let state = 'wet'; // 'wet' -> 'drying' -> 'ready' (scrape-enabled)
  let isScraping = false;
  let dryerTimer = null;
  let lastFlakeAt = 0;

  /* ---------------- Sizing (same technique as main.js) ---------------- */
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

  // Sizes/positions the scraper tool image so its blade tip sits at local
  // (0,0) — the point #scrapeCursor's translate() moves to the pointer
  // position — and rotates around that same point (same trick as the
  // cone in main.js).
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

  /* ---------------- Building the test line & its derived layers ---------------- */

  // Draws TEST_PATH as one smooth tapered stroke into the given context,
  // using the same midpoint-quadratic technique as the live drawing code.
  function drawTestStroke(ctx, colorRGB, alpha, lineWidth) {
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.strokeStyle = `rgba(${colorRGB}, ${alpha})`;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const pts = TEST_PATH;
    for (let i = 2; i < pts.length; i++) {
      const p0 = pts[i - 2], p1 = pts[i - 1], p2 = pts[i];
      const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      ctx.beginPath();
      ctx.moveTo(mid1.x * cssW, mid1.y * cssH);
      ctx.quadraticCurveTo(p1.x * cssW, p1.y * cssH, mid2.x * cssW, mid2.y * cssH);
      ctx.stroke();
    }
  }

  // Scatters faint dark/light speckles within the stroke's own shape —
  // reads as a matte, slightly textured "dried paste crust" instead of a
  // flat fill. Pure procedural noise, no image involved.
  function addDrySpeckle(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop'; // stay within what's already drawn
    const bounds = { w: cssW, h: cssH };
    const speckleCount = Math.round((bounds.w * bounds.h) / 900);
    for (let i = 0; i < speckleCount; i++) {
      const x = Math.random() * bounds.w;
      const y = Math.random() * bounds.h;
      const r = 0.4 + Math.random() * 1.1;
      const light = Math.random() < 0.5;
      ctx.fillStyle = light
        ? 'rgba(255, 235, 210, 0.10)'
        : 'rgba(20, 12, 6, 0.14)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function buildScene() {
    layoutArtboard();
    const rect = artboard.getBoundingClientRect();
    cssW = rect.width;
    cssH = rect.height;
    if (!cssW || !cssH) return;

    [stainCanvas, driedCanvas, wetCanvas, strokeMask, lightStain, darkStain, doseMap, maskCanvas]
      .forEach((c) => { c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr); c.style.width = cssW + 'px'; c.style.height = cssH + 'px'; });
    [stainCtx, driedCtx, wetCtx, strokeMaskCtx, lightStainCtx, darkStainCtx, doseMapCtx, maskCtx]
      .forEach((c) => c.setTransform(dpr, 0, 0, dpr, 0, 0));

    maskCtx.clearRect(0, 0, cssW, cssH);
    maskCtx.drawImage(palm, 0, 0, cssW, cssH);

    layoutScraperTool();

    const lineWidth = cssW * TEST_LINE_WIDTH_RATIO;

    // 1) The wet stroke — this is what's on screen at rest, "just drawn."
    drawTestStroke(wetCtx, WET_COLOR_RGB, WET_ALPHA, lineWidth);

    // 2) A pure alpha mask of the same path, used to shape every recolor below.
    drawTestStroke(strokeMaskCtx, '255,255,255', 1, lineWidth);

    // 3) Dried version: same shape, darker/matte color + speckle texture.
    driedCtx.clearRect(0, 0, cssW, cssH);
    driedCtx.drawImage(strokeMask, 0, 0, cssW, cssH);
    driedCtx.globalCompositeOperation = 'source-in';
    driedCtx.fillStyle = `rgba(${DRY_COLOR_RGB}, ${DRY_ALPHA})`;
    driedCtx.fillRect(0, 0, cssW, cssH);
    driedCtx.globalCompositeOperation = 'source-over';
    addDrySpeckle(driedCtx);

    // 4) Light and dark stain layers (offscreen), same shape again.
    [
      [lightStainCtx, lightStain, STAIN_LIGHT_RGB],
      [darkStainCtx, darkStain, STAIN_DARK_RGB],
    ].forEach(([ctx, canvas, colorRGB]) => {
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.drawImage(strokeMask, 0, 0, cssW, cssH);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = `rgba(${colorRGB}, 1)`;
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.globalCompositeOperation = 'source-over';
    });

    // 5) Dose map starts empty — nothing has been scraped yet.
    doseMapCtx.clearRect(0, 0, cssW, cssH);

    renderStain();

    // Clip everything to the hand silhouette, same rule as the live game.
    [stainCtx, driedCtx, wetCtx].forEach((ctx) => {
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskCanvas, 0, 0, cssW, cssH);
      ctx.globalCompositeOperation = 'source-over';
    });
  }

  // Recomposes the visible stain layer from the light base + however much
  // "dose" has accumulated. This is called after every scrape stamp, so
  // color can keep deepening even in spots already fully scraped open.
  const stainBlend = document.createElement('canvas');
  const stainBlendCtx = stainBlend.getContext('2d');
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

  /* ---------------- Dry transition ---------------- */
  function startDrying() {
    if (state !== 'wet') return;
    state = 'drying';
    startDryBtn.disabled = true;
    setHint('Drying…');
    dryerRig.classList.add('active');
    wetCanvas.classList.add('fade-out');

    clearTimeout(dryerTimer);
    dryerTimer = setTimeout(() => {
      dryerRig.classList.remove('active');
      state = 'ready';
      setHint('Drag the glow over the line to scrape it away.');
      // scrapeCursor is deliberately NOT shown here — it only becomes
      // visible the moment a real pointer position is known (see
      // onPointerMove/onPointerDown below), the same pattern main.js
      // uses for the cone, so it can never appear at an unset default
      // position before the pointer has actually moved.
    }, Math.max(DRY_TRANSITION_MS, DRYER_TOTAL_MS));
  }

  function setHint(text) {
    hint.textContent = text;
    hint.classList.toggle('visible', !!text);
  }

  /* ---------------- Scrape interaction ---------------- */
  function toNormalized(clientX, clientY) {
    const rect = artboard.getBoundingClientRect();
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
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

  // Spawns one small "dried paste flake" particle at the cursor, drifting
  // off in a random direction — this is what makes the scrape tool read
  // as an active, physical effect rather than a static UI marker.
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
    // Shortest-path interpolation so the tool never spins the "long way"
    // around when the heading crosses the ±180° wraparound point.
    const diff = (((b - a + 180) % 360) + 360) % 360 - 180;
    return a + diff * t;
  }

  // Moves BOTH the anchor (translate) and the tool's facing (rotate) in
  // one place, so position and heading are always updated together.
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
  }

  // Positions the cursor AND makes it visible in one place, so it can
  // never show up before we actually know where the pointer is.
  function showScrapeCursorAt(clientX, clientY) {
    const n = toNormalized(clientX, clientY);
    updateToolTransform(n.x * cssW, n.y * cssH);
    if (!scrapeCursor.classList.contains('visible')) {
      scrapeCursor.classList.add('visible');
    }
  }

  function onPointerDown(e) {
    if (state !== 'ready') return;
    isScraping = true;
    scrapeCursor.classList.add('scraping');
    artboard.setPointerCapture(e.pointerId);
    showScrapeCursorAt(e.clientX, e.clientY);
    scrapeAt(e.clientX, e.clientY);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (state !== 'ready') return;
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

  artboard.addEventListener('pointerdown', onPointerDown);
  artboard.addEventListener('pointermove', onPointerMove);
  artboard.addEventListener('pointerup', endScrape);
  artboard.addEventListener('pointercancel', endScrape);

  /* ---------------- Controls ---------------- */
  startDryBtn.addEventListener('click', startDrying);
  resetBtn.addEventListener('click', resetTest);

  function resetTest() {
    clearTimeout(dryerTimer);
    state = 'wet';
    isScraping = false;
    startDryBtn.disabled = false;
    dryerRig.classList.remove('active');
    wetCanvas.classList.remove('fade-out');
    scrapeCursor.classList.remove('visible', 'scraping');
    prevScrapeX = null;
    prevScrapeY = null;
    setHint('Draw is done — tap "Start Drying."');
    buildScene();
  }

  /* ---------------- Boot ---------------- */
  window.addEventListener('resize', buildScene);
  window.addEventListener('orientationchange', () => setTimeout(buildScene, 60));

  if (scraperTool.complete) {
    layoutScraperTool();
  } else {
    scraperTool.addEventListener('load', layoutScraperTool);
  }

  function boot() {
    buildScene();
    setHint('Draw is done — tap "Start Drying."');
  }

  if (palm.complete) {
    boot();
  } else {
    palm.addEventListener('load', boot);
  }
})();
