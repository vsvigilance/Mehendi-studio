/* =========================================================
   Jiyana's Mehendi Studio — stencil-guide test
   Purpose: prove out trace-a-guide gameplay — a faint, constant
   (never fading) flower guide sits on the hand, and the player
   traces it using the EXACT SAME cone-follow + smooth-ink engine
   from main.js (the approved M1 feel), completely unchanged.

   Everything above the "M1 ENGINE" divider below is the one new
   thing this milestone adds: a guide layer, drawn once and clipped
   to the hand's own silhouette so it can never float off the skin.
   Everything below that divider is copied from main.js verbatim —
   deliberately not touched, so the drawing feel Vinit already
   approved carries over exactly.

   Scope note: only the flower guide is wired up for now. The same
   drawStencilGuide()/STENCIL_* setup is written so a second guide
   (the traditional design, or text) is just a different image +
   a different placement constant, not a new system.
   ========================================================= */

(() => {
  const stage = document.getElementById('stage');
  const artboard = document.getElementById('artboard');
  const palm = document.getElementById('palm');
  const inkCanvas = document.getElementById('inkCanvas');
  const coneAnchor = document.getElementById('coneAnchor');
  const cone = document.getElementById('cone');

  const inkCtx = inkCanvas.getContext('2d');

  const inkBuffer = document.createElement('canvas');
  const inkBufferCtx = inkBuffer.getContext('2d');
  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d');

  /* ---------------- STENCIL GUIDE (new this milestone) ---------------- */
  const stencilCanvas = document.getElementById('stencilCanvas');
  const stencilCtx = stencilCanvas.getContext('2d');
  const stencilImg = document.getElementById('stencilSource');
  const clearBtn = document.getElementById('clearBtn');

  // Best-guess placement — centered a little below the palm's midpoint,
  // sized to roughly a comfortable tracing area. Tell me how this looks
  // once you open it and we'll nudge these three numbers; nothing else
  // needs to change to move/resize/swap the guide.
  const STENCIL_CENTER_NORM = { x: 0.5, y: 0.58 };
  const STENCIL_WIDTH_RATIO = 0.46; // guide width, relative to artboard width
  const STENCIL_OPACITY = 0.34;     // faint but clearly visible; never fades

  function drawStencilGuide() {
    if (!cssW || !cssH || !stencilImg.naturalWidth) return;
    stencilCtx.clearRect(0, 0, cssW, cssH);

    const w = cssW * STENCIL_WIDTH_RATIO;
    const h = w * (stencilImg.naturalHeight / stencilImg.naturalWidth);
    const x = STENCIL_CENTER_NORM.x * cssW - w / 2;
    const y = STENCIL_CENTER_NORM.y * cssH - h / 2;

    stencilCtx.globalAlpha = STENCIL_OPACITY;
    stencilCtx.drawImage(stencilImg, x, y, w, h);
    stencilCtx.globalAlpha = 1;

    // Clip to the hand's own silhouette — same technique as the ink
    // layer — so the guide can never appear to float past the hand's
    // edge even if the placement above is slightly generous.
    stencilCtx.globalCompositeOperation = 'destination-in';
    stencilCtx.drawImage(maskCanvas, 0, 0, cssW, cssH);
    stencilCtx.globalCompositeOperation = 'source-over';
  }

  function clearInk() {
    inkBufferCtx.clearRect(0, 0, cssW, cssH);
    inkCtx.clearRect(0, 0, cssW, cssH);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearInk);
  }

  /* =====================================================================
     M1 ENGINE — copied from main.js, unchanged.
     ===================================================================== */

  const CONE_TIP_NORM = { x: 0.971, y: 0.973 };
  const CONE_WIDTH_RATIO = 0.42;

  const PALM_ASPECT = 956 / 1489;

  const POINT_SMOOTHING_TAU = 0.045;
  const ANGLE_SMOOTHING_TAU = 0.09;
  const BASE_TILT_DEG = 0;
  const TILT_GAIN = 6;
  const MAX_TILT_DEG = 16;
  const TOUCH_OFFSET_NORM = 0.085;
  const STROKE_TAPER_POINTS = 10;
  const STROKE_MIN_WIDTH_FACTOR = 0.32;
  const STROKE_BASE_WIDTH_RATIO = 0.00956;
  const STROKE_COLOR_RGB = '66, 41, 20';
  const STROKE_ALPHA = 0.92;
  const MIN_POINT_DISTANCE = 0.0015;

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

  function setupCanvases() {
    layoutArtboard();
    const rect = artboard.getBoundingClientRect();
    cssW = rect.width;
    cssH = rect.height;
    if (cssW === 0 || cssH === 0) return;

    [inkCanvas, inkBuffer, maskCanvas, stencilCanvas].forEach((c) => {
      c.width = Math.round(cssW * dpr);
      c.height = Math.round(cssH * dpr);
    });
    inkCanvas.style.width = cssW + 'px';
    inkCanvas.style.height = cssH + 'px';
    stencilCanvas.style.width = cssW + 'px';
    stencilCanvas.style.height = cssH + 'px';

    inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    inkBufferCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stencilCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    maskCtx.clearRect(0, 0, cssW, cssH);
    maskCtx.drawImage(palm, 0, 0, cssW, cssH);

    inkBufferCtx.clearRect(0, 0, cssW, cssH);
    inkCtx.clearRect(0, 0, cssW, cssH);

    layoutCone();
    drawStencilGuide();
  }

  function layoutCone() {
    if (!cone.naturalWidth || !cssW) return;
    const ratio = cone.naturalHeight / cone.naturalWidth;
    const w = cssW * CONE_WIDTH_RATIO;
    const h = w * ratio;
    cone.style.width = w + 'px';
    cone.style.height = h + 'px';

    const tipX = w * CONE_TIP_NORM.x;
    const tipY = h * CONE_TIP_NORM.y;
    cone.style.left = -tipX + 'px';
    cone.style.top = -tipY + 'px';
    cone.style.transformOrigin = `${tipX}px ${tipY}px`;
  }

  function toNormalized(clientX, clientY) {
    const rect = artboard.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }

  function showCone() {
    coneAnchor.classList.add('visible');
  }

  function onPointerMove(e) {
    currentPointerType = e.pointerType || 'mouse';
    rawPoint = toNormalized(e.clientX, e.clientY);
    hasPointer = true;
    showCone();
  }

  function onPointerDown(e) {
    currentPointerType = e.pointerType || 'mouse';
    rawPoint = toNormalized(e.clientX, e.clientY);
    smoothedPoint = { x: rawPoint.x, y: rawPoint.y };
    hasPointer = true;
    showCone();
    isDrawing = true;
    strokePoints = [];
    lastCommitted = null;
    artboard.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function endStroke(e) {
    isDrawing = false;
    strokePoints = [];
    lastCommitted = null;
    if (e && artboard.hasPointerCapture && artboard.hasPointerCapture(e.pointerId)) {
      artboard.releasePointerCapture(e.pointerId);
    }
  }

  artboard.addEventListener('pointermove', onPointerMove);
  artboard.addEventListener('pointerdown', onPointerDown);
  artboard.addEventListener('pointerup', endStroke);
  artboard.addEventListener('pointercancel', endStroke);
  artboard.addEventListener('pointerleave', (e) => {
    if (currentPointerType !== 'touch') return;
    if (isDrawing) endStroke(e);
  });

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
    const lineWidth = cssW * STROKE_BASE_WIDTH_RATIO * taper;

    inkBufferCtx.strokeStyle = `rgba(${STROKE_COLOR_RGB}, ${STROKE_ALPHA})`;
    inkBufferCtx.lineWidth = lineWidth;
    inkBufferCtx.lineCap = 'round';
    inkBufferCtx.lineJoin = 'round';
    inkBufferCtx.beginPath();
    inkBufferCtx.moveTo(mid1.x * cssW, mid1.y * cssH);
    inkBufferCtx.quadraticCurveTo(p1.x * cssW, p1.y * cssH, mid2.x * cssW, mid2.y * cssH);
    inkBufferCtx.stroke();

    compositeInk();
  }

  function compositeInk() {
    inkCtx.clearRect(0, 0, cssW, cssH);
    inkCtx.drawImage(inkBuffer, 0, 0, cssW, cssH);
    inkCtx.globalCompositeOperation = 'destination-in';
    inkCtx.drawImage(maskCanvas, 0, 0, cssW, cssH);
    inkCtx.globalCompositeOperation = 'source-over';
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    if (hasPointer) {
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
      coneAnchor.style.transform = `translate(${px}px, ${py}px)`;
      cone.style.transform = `rotate(${currentAngle}deg)`;

      if (isDrawing) {
        commitPoint(inkPoint);
      }
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', setupCanvases);
  window.addEventListener('orientationchange', () => setTimeout(setupCanvases, 60));

  if (palm.complete) {
    setupCanvases();
  } else {
    palm.addEventListener('load', setupCanvases);
  }
  if (cone.complete) {
    layoutCone();
  } else {
    cone.addEventListener('load', layoutCone);
  }
  if (stencilImg.complete) {
    drawStencilGuide();
  } else {
    stencilImg.addEventListener('load', drawStencilGuide);
  }

  requestAnimationFrame((t) => {
    lastFrameTime = t;
    requestAnimationFrame(frame);
  });
})();
