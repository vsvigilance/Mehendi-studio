/* =========================================================
   Jiyana's Mehendi Studio — the real game
   Purpose: this is the actual consolidated build, replacing the old
   M1 vertical slice. It brings together every previously-isolated,
   individually-approved system into one real sequence:

     pick design -> trace guide (any tool) -> Done -> dry -> scrape
     -> optional decorate (gems/bindis/flowers) -> finished piece

   Everything here — the cone/ink engine, the guide layer, the full
   toolbar (including place -> adjust -> bake for Dot/Circle/Paisley),
   the dry+scrape mechanic, and the decoration tray/placement — is the
   exact same code already proven out in full-flow-test.js and
   decoration-test.js. This file's own job is the final consolidation:
   one new phase ('decorating') that connects scraping to decorating.

   The reward moment (stars, coin count-up, confetti, persistent coin
   total — see "REWARD MOMENT" further down) was intentionally left out
   of the original consolidation and built later as its own follow-up
   milestone, once the base flow was approved.
   ========================================================= */

(() => {
  const stage = document.getElementById('stage');
  const artboard = document.getElementById('artboard');
  const palm = document.getElementById('palm');

  const stencilCanvas = document.getElementById('stencilCanvas');
  const stencilAdjustStage = document.getElementById('stencilAdjustStage');
  const stainCanvas = document.getElementById('stainCanvas');
  const driedCanvas = document.getElementById('driedCanvas');
  const wetCanvas = document.getElementById('wetCanvas');
  const stampStage = document.getElementById('stampStage');
  const decorLayer = document.getElementById('decorLayer');

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

  // One-shot celebration burst fired the instant scraping finishes —
  // see spawnConfettiBurst()/completeDesign().
  const confettiLayer = document.getElementById('confettiLayer');

  const picker = document.getElementById('picker');
  const pickerCards = document.getElementById('pickerCards');
  const freehandBtn = document.getElementById('freehandBtn');
  const hint = document.getElementById('hint');
  const changeBtn = document.getElementById('changeBtn');
  const controls = document.getElementById('controls');
  const dryerControls = document.getElementById('dryerControls');
  const dryerDoneBtn = document.getElementById('dryerDoneBtn');

  // Split into two groups (frequent tools vs. specialty tools) so the
  // toolbar never needs horizontal scrolling — see the "More tools"
  // section near setTool() below for how #toolbarSecondary behaves
  // differently on phone (a collapsible drawer) vs. tablet (always
  // visible beside the hand), all driven from CSS, not this JS.
  const toolbarPrimary = document.getElementById('toolbarPrimary');
  const toolbarSecondary = document.getElementById('toolbarSecondary');
  const moreToolsBtn = document.getElementById('moreToolsBtn');
  const toolSelectBtns = Array.from(document.querySelectorAll('.toolBtn.tool-select'));
  const undoBtn = document.getElementById('undoBtn');
  const iconClearBtn = document.getElementById('iconClearBtn');
  const iconDoneBtn = document.getElementById('iconDoneBtn');

  // Decoration step (tray + placed stickers) — shown only during the
  // 'decorating' phase, right after scraping finishes.
  const decorTray = document.getElementById('decorTray');
  const decorBtns = Array.from(document.querySelectorAll('.decorBtn'));
  const decorControls = document.getElementById('decorControls');
  const decorDoneBtn = document.getElementById('decorDoneBtn');

  // Shape Pencil's own sub-picker (which shape + hollow/filled) — shown
  // only while that tool is active during tracing, see
  // updateShapeTrayVisibility().
  const shapeTray = document.getElementById('shapeTray');
  const shapeBtns = Array.from(document.querySelectorAll('.shapeBtn'));
  const shapeFilledBtn = document.getElementById('shapeFilledBtn');
  const shapeHollowBtn = document.getElementById('shapeHollowBtn');

  // Final screen — the true end of the flow, once decorating is done
  // (or skipped). No stars/coins here yet; see file header.
  const finishedPanel = document.getElementById('finishedPanel');
  const newDesignBtn = document.getElementById('newDesignBtn');
  const completionBurst = document.getElementById('completionBurst');
  const muteBtn = document.getElementById('muteBtn');
  const zoomControls = document.getElementById('zoomControls');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');

  // Trace Assist ("Segment Auto-Complete") — see the dedicated section
  // near the M1 draw engine below for the actual segment-matching logic.
  const traceAssistRow = document.getElementById('traceAssistRow');
  const traceAssistToggle = document.getElementById('traceAssistToggle');

  // Reward moment — stars + coin count-up, shown only for stencil-based
  // completions (see playRewardSequence()/onDone()).
  const coinBadge = document.getElementById('coinBadge');
  const coinBadgeTotal = document.getElementById('coinBadgeTotal');
  const rewardRow = document.getElementById('rewardRow');
  const starIcons = Array.from(document.querySelectorAll('.starIcon'));
  const coinReward = document.getElementById('coinReward');
  const coinRewardIcon = document.getElementById('coinRewardIcon');
  const coinRewardAmount = document.getElementById('coinRewardAmount');

  // Story intro — see the STORY section below (near the sound section)
  // for state/logic.
  const storyIntro = document.getElementById('storyIntro');
  const storySlides = Array.from(document.querySelectorAll('.storySlide'));
  const storyDots = Array.from(document.querySelectorAll('.storyDot'));
  const storySkipBtn = document.getElementById('storySkipBtn');
  const storyNextBtn = document.getElementById('storyNextBtn');
  const storyReplayBtn = document.getElementById('storyReplayBtn');
  const bubbleJiyana = document.getElementById('bubbleJiyana');
  const bubbleShopkeeper = document.getElementById('bubbleShopkeeper');

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

  /* =====================================================================
     SOUND — a handful of soft, synthesized feedback sounds. No audio
     files: everything here is generated on the fly with the Web Audio
     API, so there's nothing to source or license, and the whole thing
     stays tiny. Deliberately minimal and gentle, matching the game's
     calm/premium tone — not arcade-style beeps and buzzes.

     Kept to the moments that actually matter right now: a soft click on
     any button, a little "pop" when placing a dot/circle/stamp/sticker,
     and a warm chime on the finished-design reveal. Continuous sound
     while actively drawing a stroke was considered and deliberately left
     out of this pass — looping audio cleanly is a fair bit more
     complexity for a "nice to have," worth its own pass later if wanted.
     ===================================================================== */
  const SOUND_MUTE_KEY = 'jiyanaMehendiSoundMuted';
  let audioCtx = null;
  let soundMuted = localStorage.getItem(SOUND_MUTE_KEY) === '1';

  // The audio context can only be created/resumed inside a real user
  // gesture (browser rule) — every sound call here only ever happens
  // from a click/tap handler, so this is always safe to call lazily.
  function getAudioCtx() {
    if (!audioCtx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null; // very old browser with no Web Audio — fail silent, not broken
      audioCtx = new AudioCtor();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // One soft tone: quick fade in, gentle exponential fade out — reads as
  // a plush "tock"/chime rather than a harsh beep. type/duration/gain
  // are tuned per call site below.
  function playTone(freq, opts) {
    if (soundMuted) return;
    const { duration = 0.14, gain = 0.14, type = 'sine', delay = 0 } = opts || {};
    const ctx = getAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function playClickSound() {
    playTone(720, { duration: 0.08, gain: 0.09, type: 'triangle' });
  }

  // Quick pitch-rise "pop" — used for placing a dot/circle/paisley stamp
  // or a decoration sticker, a satisfying little confirmation that
  // something landed.
  function playStampSound() {
    if (soundMuted) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t0);
    osc.frequency.exponentialRampToValueAtTime(560, t0 + 0.09);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.13, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.15);
  }

  // Gentle rising 3-note chime (C5 -> E5 -> G5) — timed alongside the
  // completion burst/message reveal in finishDecorating().
  function playCompletionChime() {
    playTone(523.25, { duration: 0.5, gain: 0.12, delay: 0 });
    playTone(659.25, { duration: 0.5, gain: 0.12, delay: 0.11 });
    playTone(784.0, { duration: 0.75, gain: 0.13, delay: 0.22 });
  }

  function setMuted(muted) {
    soundMuted = muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
    localStorage.setItem(SOUND_MUTE_KEY, muted ? '1' : '0');
  }
  setMuted(soundMuted); // apply whatever was remembered from last time

  muteBtn.addEventListener('click', () => setMuted(!soundMuted));

  /* =====================================================================
     STORY INTRO — 3-slide first-run story, auto-shown once (see
     STORY_SEEN_KEY) then replayable any time via #storyReplayBtn on the
     picker. Slides are crossfaded via a plain 'active' class toggle
     (simpler than setPanelVisible()'s display:none choreography — all 3
     slides are the same fixed full-bleed size, nothing to reflow
     around). Same localStorage-preference pattern as SOUND_MUTE_KEY/
     COIN_TOTAL_KEY above.
     ===================================================================== */
  const STORY_SEEN_KEY = 'jiyanaMehendiStorySeen';
  const STORY_SLIDE_COUNT = storySlides.length;
  const BUBBLE_REPLY_DELAY_MS = 750; // shopkeeper's reply appears this long after Jiyana's line, so it reads as a back-and-forth

  let currentStorySlide = 0;
  let bubbleTimer = null;

  function clearBubbleTimer() {
    if (bubbleTimer) {
      clearTimeout(bubbleTimer);
      bubbleTimer = null;
    }
  }

  function goToSlide(index) {
    clearBubbleTimer();
    bubbleJiyana.classList.remove('show');
    bubbleShopkeeper.classList.remove('show');
    currentStorySlide = index;
    storySlides.forEach((slide, i) => slide.classList.toggle('active', i === index));
    storyDots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    storyNextBtn.textContent = index === STORY_SLIDE_COUNT - 1 ? "Let's Begin!" : 'Next';
    // Slide 2 (index 1) is the conversation — Jiyana's line pops in the
    // instant the slide becomes active, the shopkeeper's reply follows
    // after a beat rather than both appearing together.
    if (index === 1) {
      bubbleJiyana.classList.add('show');
      bubbleTimer = setTimeout(() => {
        bubbleShopkeeper.classList.add('show');
        bubbleTimer = null;
      }, BUBBLE_REPLY_DELAY_MS);
    }
  }

  function openStory() {
    storyIntro.classList.remove('hidden');
    goToSlide(0);
  }

  function closeStory() {
    clearBubbleTimer();
    storyIntro.classList.add('hidden');
    localStorage.setItem(STORY_SEEN_KEY, '1');
  }

  storySkipBtn.addEventListener('click', closeStory);
  storyNextBtn.addEventListener('click', () => {
    if (currentStorySlide === STORY_SLIDE_COUNT - 1) {
      closeStory();
    } else {
      goToSlide(currentStorySlide + 1);
    }
  });
  storyReplayBtn.addEventListener('click', openStory);

  // Auto-show only the very first time. Safe to fire from here (near the
  // top of the script, right after DOM refs are grabbed) rather than
  // waiting for setupCanvases()/buildPickerCards() further down — the
  // story overlay is a fixed inset:0 layer with no dependency on the
  // artboard's own measured pixel size, so it doesn't matter whether the
  // picker underneath has finished building its cards yet by the time
  // this shows on top of it.
  if (!localStorage.getItem(STORY_SEEN_KEY)) {
    openStory();
  }

  /* =====================================================================
     REWARD MOMENT — persistent coin total. Star computation and the
     per-design coin amounts live near computeGuideCoverageRatio()/the
     DESIGNS array; this part is just the running total that survives
     between sessions and the small corner badge showing it on the
     picker. Same localStorage-preference pattern as SOUND_MUTE_KEY
     above — legitimate here since this is a real game file her own
     browser runs, not a Claude.ai chat artifact.
     ===================================================================== */
  const COIN_TOTAL_KEY = 'jiyanaMehendiCoins';
  let coinTotal = parseInt(localStorage.getItem(COIN_TOTAL_KEY), 10) || 0;

  function renderCoinBadge() {
    coinBadgeTotal.textContent = String(coinTotal);
  }
  renderCoinBadge(); // reflect whatever was remembered from last time, immediately

  // Adds to the running total, persists it, and gives the corner badge a
  // quick "bump" pulse so a returning glance at the picker reads as "this
  // just grew" rather than a silent number change. Bump plays fresh each
  // time (remove+reflow+add, same trick used everywhere else in this
  // project for replayable one-shot animations) so awarding coins twice
  // in a row still bumps both times.
  function addCoins(amount) {
    coinTotal += amount;
    localStorage.setItem(COIN_TOTAL_KEY, String(coinTotal));
    renderCoinBadge();
    coinBadge.classList.remove('bump');
    void coinBadge.offsetWidth;
    coinBadge.classList.add('bump');
  }

  // One delegated listener covers every button in the game (including
  // ones added later) rather than wiring a click sound into each button
  // individually. Runs after muteBtn's own listener (bubble order), so
  // muting never plays a sound and unmuting plays a confirming click.
  document.addEventListener('click', (e) => {
    if (e.target.closest('button, .pickerCard')) playClickSound();
  });

  /* =====================================================================
     TRACE ASSIST ("Segment Auto-Complete") — an optional "wobbly scribble
     becomes a clean line" feel for the Cone/Toothpick freehand tools only
     (stamps place a fixed shape with nothing to complete; Ruler/Curve
     already have their own precise press-drag-release model; Eraser
     removes ink rather than tracing it). When she roughly gestures across
     one logical piece of the design (a petal, a feather, a letter) and
     releases, that whole piece's rough ink is replaced by its exact
     guide line. Off by default, remembered per browser once she changes
     it — same localStorage-preference pattern as SOUND_MUTE_KEY/
     COIN_TOTAL_KEY/STORY_SEEN_KEY above. Star/coin scoring is completely
     unaffected either way (explicit product decision — see GAME_SPEC.md)
     since it's still coverage-based, not accuracy-based, and this game's
     scoring has always been generous rather than punishing.

     An earlier version of this feature ("Magic Trace Assist") did a
     gentle per-frame pull toward the nearest guide point instead — kept
     too subtle a feel in practice, replaced with this stronger whole-
     piece swap. The actual segment-matching logic (buildTraceAssist-
     Segments/tryAutoCompleteSegment) lives further down, right after the
     stencil-guide section, since it needs bakeStencilGuide()'s output
     (stencilCanvas) to scan — this block is just the on/off state + UI,
     kept near the other simple preference toggles for consistency.
     ===================================================================== */
  const TRACE_ASSIST_KEY = 'jiyanaMehendiTraceAssist';
  let traceAssistOn = localStorage.getItem(TRACE_ASSIST_KEY) === '1';

  function setTraceAssist(on) {
    traceAssistOn = on;
    traceAssistToggle.classList.toggle('on', on);
    traceAssistToggle.setAttribute('aria-checked', on ? 'true' : 'false');
    localStorage.setItem(TRACE_ASSIST_KEY, on ? '1' : '0');
  }
  setTraceAssist(traceAssistOn); // reflect whatever was remembered from last time

  traceAssistToggle.addEventListener('click', () => setTraceAssist(!traceAssistOn));

  // Shown only while actually tracing a real stencil design — hidden for
  // Draw Now (activeDesign null, nothing to snap toward) and every other
  // phase. Called from updateControlsForPhase() below, which already
  // runs after every real phase transition including selectDesign()/
  // startFreehand() (both call it at the end), so no separate call site
  // is needed the way updateShapeTrayVisibility() needs one from setTool()
  // too — activeDesign only ever changes alongside a phase change here.
  function updateTraceAssistVisibility() {
    setPanelVisible(traceAssistRow, phase === 'tracing' && !!activeDesign);
  }

  const PALM_ASPECT = 956 / 1489;

  /* ---------------- Design picker + guide ---------------- */
  const STENCIL_OPACITY = 0.34;

  // Fixed coins-per-design, a first-pass judgment call proportional to
  // each design's own density/total-trace-length (not just widthRatio —
  // Peacock Advanced and Vine Bloom are both physically large AND dense/
  // long to trace, so they sit at the top; Flower/Dark Vibes/Jash are
  // small single-motif traces, so they sit at the bottom). Reused/kept
  // from the original reward-loop milestone's numbers where a design
  // carries over unchanged (flower/jiyana/peacock_*), extended for the
  // 3 designs added since (dark_vibes/jash matched to flower's tier,
  // vine_bloom placed above peacock_advanced as the most spatially
  // demanding trace in the game — 5 fingers + flower + border vs.
  // peacock's single dense area). Trivially adjustable later.
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
      coins: 10,
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
    {
      // Full-hand design (vines up each finger + central flower + wrist
      // border) — spans much more of the hand than the others, so its
      // center sits higher up and its widthRatio is noticeably larger.
      // Center/widthRatio were fit by matching this design's own vine
      // fingertip positions against hero_palm.png's actual fingertip
      // positions (a small least-squares scale+translate fit), then
      // mapping the design's content bounding-box center through that
      // same fit — not eyeballed. See project memory for the method.
      // Highest coin value in the game — see comment above DESIGNS.
      id: 'vine_bloom',
      label: 'Vine Bloom',
      img: document.getElementById('src-vine_bloom'),
      center: { x: 0.60, y: 0.27 },
      widthRatio: 0.63,
      coins: 40,
    },
  ];

  let activeDesign = null;

  // Reward-moment results, computed once at Done (see onDone()) while the
  // guide/ink are still on-screen to compare, then consumed later when
  // the finished panel actually animates in (finishDecorating()/
  // playRewardSequence()). Stay null for freehand (activeDesign was
  // already null at Done-time) so the reward UI knows to skip itself
  // entirely — freehand/Draw Now earns no stars or coins, per spec.
  let pendingStars = null;
  let pendingCoins = null;

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

  /* =====================================================================
     ADJUSTABLE STENCIL GUIDE — right after picking a design, she can
     freely move/resize/rotate the guide to fit her own hand before
     committing to tracing (same one-finger handle language already
     proven for decorations/staged stamps), then it locks the moment she
     starts a real stroke so nothing drawn afterward can go out of sync
     with a guide that moved mid-trace.

     Two states, never both at once:
       - ADJUSTING: a live DOM overlay (#stencilAdjustStage) shows the
         guide image directly, unclipped, driven by CSS transforms —
         cheap, and lets her drag it freely even slightly past the
         hand's edge while positioning it. stencilCanvas stays empty.
       - LOCKED: the overlay is gone; the guide is baked into
         stencilCanvas via the canvas API (translate/rotate/scale,
         same composition the overlay used) and clipped to the hand's
         silhouette, exactly like the old fixed-guide code always did.

     bakeStencilGuide() with no adjustment ever made (lockedGuideTransform
     still at the design's own defaults) reproduces the exact pixels the
     original fixed-position drawStencilGuide() used to — this is a
     strict generalization, not a behavior change, for anyone who never
     touches the handles. */
  const GUIDE_MIN_SCALE = 0.6;
  const GUIDE_MAX_SCALE = 1.8;
  const GUIDE_HANDLE_SIZE = 30;
  const GUIDE_HANDLE_GAP = 14;

  let stencilAdjust = null; // { wrap, img, moveHandle, resizeHandle, nx, ny, scale, angle }
  // True whenever there's nothing left to adjust — starts true (no
  // design picked yet), flips false the moment createStencilAdjust()
  // shows the overlay, flips back true the moment lockStencilGuide()
  // bakes it. Freehand mode (no guide at all) simply never leaves true.
  let stencilGuideLocked = true;
  // The final move/resize/rotate values at the moment of locking —
  // kept around (separately from stencilAdjust, which gets destroyed on
  // lock) purely so a later window resize/orientation-change can
  // re-bake the guide at the SAME adjusted transform instead of
  // reverting to the design's original default placement.
  let lockedGuideTransform = null;

  function destroyStencilAdjust() {
    if (!stencilAdjust) return;
    stencilAdjust.wrap.remove();
    stencilAdjust = null;
  }

  function positionStencilAdjust() {
    const s = stencilAdjust;
    if (!s || !activeDesign || !cssW || !cssH) return;
    const cx = s.nx * cssW;
    const cy = s.ny * cssH;
    s.wrap.style.transform = `translate(${cx}px, ${cy}px) rotate(${s.angle}deg)`;

    const img = activeDesign.img;
    const w = cssW * activeDesign.widthRatio * s.scale;
    const h = w * ((img.naturalHeight || 1) / (img.naturalWidth || 1));
    s.img.style.width = w + 'px';
    s.img.style.height = h + 'px';

    const r = w / 2 + GUIDE_HANDLE_GAP + GUIDE_HANDLE_SIZE / 2;
    s.resizeHandle.style.transform = `translate(${r}px, 0px) translate(-50%, -50%)`;
  }

  // Shown the instant a design is picked (see selectDesign()) — starts
  // at exactly the design's own tuned default center/width/angle-0, so
  // nothing looks different from before unless she actually touches a
  // handle.
  function createStencilAdjust() {
    destroyStencilAdjust();
    if (!activeDesign) return;
    stencilGuideLocked = false;
    lockedGuideTransform = null;

    const wrap = document.createElement('div');
    wrap.className = 'stencilAdjustWrap';

    const img = document.createElement('img');
    img.className = 'stencilAdjustImg';
    img.src = activeDesign.img.src;
    img.alt = '';
    img.draggable = false;
    img.style.opacity = STENCIL_OPACITY;

    // Move handle: reuses .stampFlipBtn's always-visible colored-circle
    // look (see full-flow.css) rather than new styling — a small
    // dedicated dot rather than making the whole (often large) guide
    // image draggable, deliberately, so the guide's own footprint can
    // never intercept the tap that's meant to start her first stroke.
    const moveHandle = document.createElement('div');
    moveHandle.className = 'stampFlipBtn stencilMoveHandle';
    moveHandle.textContent = '✛';

    // Resize/rotate handle: reuses .decorHandle's gold-circle look
    // verbatim (always shown here, so .visible is applied directly
    // rather than toggled).
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'decorHandle visible';

    wrap.appendChild(img);
    wrap.appendChild(moveHandle);
    wrap.appendChild(resizeHandle);
    stencilAdjustStage.appendChild(wrap);

    stencilAdjust = {
      wrap,
      img,
      moveHandle,
      resizeHandle,
      nx: activeDesign.center.x,
      ny: activeDesign.center.y,
      scale: 1,
      angle: 0,
    };

    positionStencilAdjust();
    beginStencilMoveDrag();
    beginStencilResizeDrag();
    setHint('Move or resize the design to fit, then start drawing to lock it in.');
  }

  // Plain one-finger drag on the small move handle — offset-from-center
  // technique, same as beginDecorBodyDrag, so the guide doesn't jump to
  // re-center itself under the finger the instant it's grabbed.
  function beginStencilMoveDrag() {
    const s = stencilAdjust;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    function onDown(e) {
      e.stopPropagation();
      dragging = true;
      s.moveHandle.setPointerCapture(e.pointerId);
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
      positionStencilAdjust();
    }

    function onUp(e) {
      dragging = false;
      if (s.moveHandle.hasPointerCapture && s.moveHandle.hasPointerCapture(e.pointerId)) {
        s.moveHandle.releasePointerCapture(e.pointerId);
      }
    }

    s.moveHandle.addEventListener('pointerdown', onDown);
    s.moveHandle.addEventListener('pointermove', onMove);
    s.moveHandle.addEventListener('pointerup', onUp);
    s.moveHandle.addEventListener('pointercancel', onUp);
  }

  // Combined resize+rotate handle — distance from the guide's own
  // center sets scale, angle back to center sets rotation, same gesture
  // as beginStagedHandleDrag/beginDecorHandleDrag.
  function beginStencilResizeDrag() {
    const s = stencilAdjust;
    let dragging = false;

    function onDown(e) {
      e.stopPropagation();
      dragging = true;
      s.resizeHandle.setPointerCapture(e.pointerId);
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
      const baseW = cssW * activeDesign.widthRatio;
      const refDist = baseW / 2 + GUIDE_HANDLE_GAP + GUIDE_HANDLE_SIZE / 2;
      const rawScale = dist / refDist;
      s.scale = Math.min(GUIDE_MAX_SCALE, Math.max(GUIDE_MIN_SCALE, rawScale));
      positionStencilAdjust();
    }

    function onUp(e) {
      dragging = false;
      if (s.resizeHandle.hasPointerCapture && s.resizeHandle.hasPointerCapture(e.pointerId)) {
        s.resizeHandle.releasePointerCapture(e.pointerId);
      }
    }

    s.resizeHandle.addEventListener('pointerdown', onDown);
    s.resizeHandle.addEventListener('pointermove', onMove);
    s.resizeHandle.addEventListener('pointerup', onUp);
    s.resizeHandle.addEventListener('pointercancel', onUp);
  }

  // Renders the guide onto the real stencilCanvas at whatever transform
  // is in lockedGuideTransform, clipped to the hand's silhouette — used
  // both at the moment of locking and again on every resize/orientation
  // change afterward (see setupCanvases), so a rotated phone doesn't
  // revert the guide to its un-adjusted default.
  function bakeStencilGuide() {
    stencilCtx.clearRect(0, 0, cssW, cssH);
    const t = lockedGuideTransform;
    if (!activeDesign || !t || !cssW || !cssH || !activeDesign.img.naturalWidth) return;

    const img = activeDesign.img;
    const w = cssW * activeDesign.widthRatio * t.scale;
    const h = w * (img.naturalHeight / img.naturalWidth);
    const cx = t.nx * cssW;
    const cy = t.ny * cssH;

    stencilCtx.save();
    stencilCtx.globalAlpha = STENCIL_OPACITY;
    stencilCtx.translate(cx, cy);
    stencilCtx.rotate((t.angle * Math.PI) / 180);
    stencilCtx.drawImage(img, -w / 2, -h / 2, w, h);
    stencilCtx.restore();

    stencilCtx.globalCompositeOperation = 'destination-in';
    stencilCtx.drawImage(maskCanvas, 0, 0, cssW, cssH);
    stencilCtx.globalCompositeOperation = 'source-over';
  }

  // Called from the unified pointer dispatcher the instant any real
  // tracing action begins (freehand stroke, stamp placement, ruler/
  // curve drag) — see onPointerDown(). No-ops instantly if already
  // locked (every tool's first pointerdown calls this unconditionally),
  // or if there was never anything to lock (Draw Now / freehand mode).
  function lockStencilGuide() {
    if (stencilGuideLocked) return;
    stencilGuideLocked = true;
    if (stencilAdjust) {
      lockedGuideTransform = { nx: stencilAdjust.nx, ny: stencilAdjust.ny, scale: stencilAdjust.scale, angle: stencilAdjust.angle };
    }
    destroyStencilAdjust();
    bakeStencilGuide();
    buildTraceAssistSegments();
    setHint(defaultTracingHint());
  }

  /* =====================================================================
     SEGMENT AUTO-COMPLETE — the actual "wobbly scribble becomes a clean
     line" mechanic. stencilCanvas holds only pixels, not separate named
     shapes, so "which logical piece (petal/feather/letter) does this bit
     of guide belong to" isn't something we can just look up — it has to
     be computed once, right when the guide locks (and again on resize/
     orientation-change, same trigger as bakeStencilGuide() itself).

     Two techniques, combined:

     1) AUTOMATIC — an 8-connectivity flood fill over the locked guide's
        own pixels. Any guide pixels that are only reachable from each
        other (a connected blob) become one segment. This works great
        for real-world designs whose pieces are already drawn as
        separate shapes with a visible gap between them (every letter in
        the text designs, most of vine_bloom's separate vine/dot/border
        pieces) — verified against the real game assets before trusting
        this, see the Segment Auto-Complete build notes in GAME_SPEC.md.

     2) HAND-AUTHORED OVERRIDE (SEGMENT_ANCHORS below) — some designs'
        artwork draws touching pieces (a flower whose 5 petals all meet
        at the center, a peacock whose fanned feathers all share one
        outline) as ONE connected blob, which the automatic technique
        can't split on its own — verified this is real, not theoretical,
        by running the flood fill on the actual flower_stencil.png and
        finding exactly this (5 petals + stem all counted as one single
        194,626-pixel blob). For the handful of designs where this
        matters, a short hand-placed list of rough center points (one
        per petal/feather/piece, in the SOURCE IMAGE's own normalized
        coordinates — same convention as each design's own center/
        widthRatio) tells the game where each real piece actually is;
        any automatic blob bigger than SEGMENT_OVERRIDE_MIN_FRACTION of
        the whole guide gets re-split by "which authored point is each
        of its pixels closest to" instead of staying one giant piece.
        Small, already-separate automatic segments (a design's own tiny
        decorative dots/swirls) are left alone either way.

     Every actual design in the game was checked this way before writing
     any of this — peacock_advanced's fan turned out to have ~17 tightly
     packed feathers where a first-pass set of anchors didn't cleanly
     land on the real boundaries, so it deliberately has no override
     entry yet and just auto-completes as one whole piece for now (see
     the comment on SEGMENT_ANCHORS below) — a real, deliberately scoped
     gap, not an oversight.
     ===================================================================== */
  const SEGMENT_GRID_W = 140; // classification grid only — decides which piece each region belongs to, not what the ink looks like (see inkSourceFull below, which is full resolution)
  const SEGMENT_OVERRIDE_MIN_FRACTION = 0.10; // an automatic blob bigger than this fraction of all guide pixels is almost certainly several touching pieces fused together, not one real piece
  const SEGMENT_MATCH_RADIUS_NORM = 0.06; // how far (fraction of artboard width) a gesture point can be from a piece and still count as "aiming at it"
  const SEGMENT_MIN_OVERLAP_RATIO = 0.35; // fraction of her WHOLE stroke's sampled points that must land near the winning piece for it to qualify
  const SEGMENT_MIN_DRAG_DISTANCE = 0.02; // total path length her gesture must cover — a real attempted drag, not a bare tap (a bit more than MIN_DRAG_DISTANCE, since aiming at a whole piece should cover more ground than one precise ruler line)

  // Hand-placed rough centers for designs whose real pieces touch each
  // other in the artwork (see the block comment above). Coordinates are
  // fractions of the SOURCE IMAGE's own width/height — identical
  // convention to each DESIGNS entry's own center/widthRatio — not the
  // artboard; buildTraceAssistSegments() maps these through the SAME
  // locked scale/rotate/position transform bakeStencilGuide() already
  // uses, so they track the design correctly wherever she moved/resized/
  // rotated it before locking. Multiple anchors sharing one name (e.g.
  // "stem") all just contribute to that one segment — useful for a long
  // thin piece a single center point wouldn't cover well.
  const SEGMENT_ANCHORS = {
    flower: [
      { name: 'petal_top', u: 0.50, v: 0.11 },
      { name: 'petal_upper_right', u: 0.78, v: 0.27 },
      { name: 'petal_lower_right', u: 0.68, v: 0.51 },
      { name: 'petal_lower_left', u: 0.28, v: 0.51 },
      { name: 'petal_upper_left', u: 0.18, v: 0.27 },
      { name: 'center', u: 0.50, v: 0.32 },
      { name: 'stem', u: 0.50, v: 0.50 },
      { name: 'stem', u: 0.50, v: 0.65 },
      { name: 'stem', u: 0.50, v: 0.80 },
      { name: 'stem', u: 0.50, v: 0.92 },
      { name: 'leaf', u: 0.60, v: 0.68 },
      { name: 'leaf', u: 0.85, v: 0.75 },
    ],
    peacock_easy: [
      { name: 'body', u: 0.47, v: 0.85 },
      { name: 'feather1', u: 0.04, v: 0.97 },
      { name: 'feather2', u: 0.04, v: 0.78 },
      { name: 'feather3', u: 0.08, v: 0.58 },
      { name: 'feather4', u: 0.16, v: 0.40 },
      { name: 'feather5', u: 0.26, v: 0.24 },
      { name: 'feather6', u: 0.38, v: 0.11 },
      { name: 'feather7', u: 0.50, v: 0.04 },
      { name: 'feather8', u: 0.62, v: 0.11 },
      { name: 'feather9', u: 0.74, v: 0.24 },
      { name: 'feather10', u: 0.84, v: 0.40 },
      { name: 'feather11', u: 0.92, v: 0.58 },
      { name: 'feather12', u: 0.96, v: 0.78 },
      { name: 'feather13', u: 0.96, v: 0.97 },
    ],
    vine_bloom: [
      // Only vine_bloom's own central flower motif needs this — its 5
      // finger-vines, border, and small accent dots are already cleanly
      // separate in the artwork and get a real automatic segment each.
      { name: 'petal_top', u: 0.45, v: 0.48 },
      { name: 'petal_upper_right', u: 0.58, v: 0.51 },
      { name: 'petal_right', u: 0.63, v: 0.60 },
      { name: 'petal_lower_right', u: 0.58, v: 0.70 },
      { name: 'petal_bottom', u: 0.45, v: 0.74 },
      { name: 'petal_lower_left', u: 0.31, v: 0.70 },
      { name: 'petal_left', u: 0.26, v: 0.60 },
      { name: 'petal_upper_left', u: 0.31, v: 0.51 },
      { name: 'center', u: 0.45, v: 0.60 },
    ],
    // peacock_advanced: no entry on purpose — see the block comment
    // above. Its own small decorative swirls/paisleys/dots still each
    // complete individually (those are already separate automatically);
    // only its main fanned-feather outline auto-completes as one single
    // whole-peacock piece for now.
  };

  let traceAssistSegments = null; // { w, h, segId: Int32Array, segCount, bboxes: [{minX,maxX,minY,maxY} in FULL inkBuffer-pixel units], inkSourceFull: <canvas> }

  function buildTraceAssistSegments() {
    traceAssistSegments = null;
    if (!activeDesign || !cssW || !cssH) return;

    // ---- Classification grid: decides which piece each region belongs
    // to. Doesn't need to be full resolution — only inkSourceFull below
    // (what actually gets copied into her drawing) needs to be crisp.
    const w = SEGMENT_GRID_W;
    const h = Math.max(1, Math.round(w * (cssH / cssW)));
    const small = document.createElement('canvas');
    small.width = w;
    small.height = h;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    sctx.clearRect(0, 0, w, h);
    sctx.drawImage(stencilCanvas, 0, 0, w, h);

    let data;
    try {
      data = sctx.getImageData(0, 0, w, h).data;
    } catch (err) {
      return; // file:// SecurityError — same fail-safe as countCoverage()/computeGuideCoverageRatio(); Assist just won't engage
    }

    const cellCount = w * h;
    const isGuide = new Uint8Array(cellCount);
    let totalGuideCells = 0;
    for (let i = 0; i < cellCount; i++) {
      if (data[i * 4 + 3] > GUIDE_ALPHA_THRESHOLD) {
        isGuide[i] = 1;
        totalGuideCells++;
      }
    }
    if (totalGuideCells === 0) return; // shouldn't happen for a real design, but fail safe

    // ---- Pass 1: automatic 8-connectivity flood fill. A plain array-
    // backed queue (not real recursion) so a big densely-connected
    // design can't blow the call stack.
    const autoId = new Int32Array(cellCount).fill(-1);
    const queueX = new Int32Array(cellCount);
    const queueY = new Int32Array(cellCount);
    let autoCount = 0;
    const autoSizes = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i0 = y * w + x;
        if (!isGuide[i0] || autoId[i0] !== -1) continue;
        const thisId = autoCount++;
        let qHead = 0, qTail = 0;
        queueX[qTail] = x; queueY[qTail] = y; qTail++;
        autoId[i0] = thisId;
        let size = 0;
        while (qHead < qTail) {
          const cx = queueX[qHead], cy = queueY[qHead]; qHead++;
          size++;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx, ny = cy + dy;
              if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
              const ni = ny * w + nx;
              if (!isGuide[ni] || autoId[ni] !== -1) continue;
              autoId[ni] = thisId;
              queueX[qTail] = nx; queueY[qTail] = ny; qTail++;
            }
          }
        }
        autoSizes.push(size);
      }
    }

    // ---- Pass 2: any oversized automatic blob gets re-split by nearest
    // hand-authored anchor instead, if this design has any (see
    // SEGMENT_ANCHORS above). Anchors are transformed through the exact
    // same locked scale/rotate/position math bakeStencilGuide() uses,
    // once, up front — far cheaper than inverse-transforming every grid
    // cell, since there are only a handful of anchors.
    const anchorList = SEGMENT_ANCHORS[activeDesign.id] || null;
    let transformedAnchors = null;
    if (anchorList && lockedGuideTransform && activeDesign.img.naturalWidth) {
      const t = lockedGuideTransform;
      const designW = cssW * activeDesign.widthRatio * t.scale;
      const designH = designW * (activeDesign.img.naturalHeight / activeDesign.img.naturalWidth);
      const cx = t.nx * cssW;
      const cy = t.ny * cssH;
      const rad = (t.angle * Math.PI) / 180;
      const cosA = Math.cos(rad), sinA = Math.sin(rad);
      transformedAnchors = anchorList.map((a) => {
        const localX = (a.u - 0.5) * designW;
        const localY = (a.v - 0.5) * designH;
        const worldX = cx + localX * cosA - localY * sinA;
        const worldY = cy + localX * sinA + localY * cosA;
        return { name: a.name, x: worldX, y: worldY }; // CSS-pixel space
      });
    }

    const overrideThreshold = totalGuideCells * SEGMENT_OVERRIDE_MIN_FRACTION;
    const segId = new Int32Array(cellCount).fill(-1);
    const nameToId = new Map();
    let nextId = 0;
    function idForName(name) {
      let id = nameToId.get(name);
      if (id === undefined) { id = nextId++; nameToId.set(name, id); }
      return id;
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i0 = y * w + x;
        if (!isGuide[i0]) continue;
        const aId = autoId[i0];
        if (transformedAnchors && autoSizes[aId] >= overrideThreshold) {
          const px = (x / w) * cssW;
          const py = (y / h) * cssH;
          let bestName = transformedAnchors[0].name;
          let bestD = Infinity;
          for (let k = 0; k < transformedAnchors.length; k++) {
            const an = transformedAnchors[k];
            const dx = px - an.x;
            const dy = py - an.y;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; bestName = an.name; }
          }
          segId[i0] = idForName(bestName);
        } else {
          segId[i0] = idForName(`__auto_${aId}`);
        }
      }
    }

    // ---- Per-segment bounding boxes, converted to FULL inkBuffer-pixel
    // units (grid cells -> real device pixels) since that's the space
    // the actual ink-swap composites in — see tryAutoCompleteSegment().
    const fw = inkBuffer.width;
    const fh = inkBuffer.height;
    const bboxes = new Array(nextId).fill(null);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const id = segId[y * w + x];
        if (id === -1) continue;
        const fx0 = Math.floor((x / w) * fw);
        const fx1 = Math.min(fw - 1, Math.ceil(((x + 1) / w) * fw) - 1);
        const fy0 = Math.floor((y / h) * fh);
        const fy1 = Math.min(fh - 1, Math.ceil(((y + 1) / h) * fh) - 1);
        let b = bboxes[id];
        if (!b) {
          bboxes[id] = { minX: fx0, maxX: fx1, minY: fy0, maxY: fy1 };
        } else {
          if (fx0 < b.minX) b.minX = fx0;
          if (fx1 > b.maxX) b.maxX = fx1;
          if (fy0 < b.minY) b.minY = fy0;
          if (fy1 > b.maxY) b.maxY = fy1;
        }
      }
    }

    // ---- The "perfect line" source: the real locked guide, recolored
    // to actual ink color/alpha, at its true full device-pixel
    // resolution — so a swapped-in piece looks exactly as crisp as
    // everything she's drawn by hand, never blurry from the coarser
    // classification grid above (that grid only decides WHICH pixels
    // belong to which piece, not what those pixels look like).
    const inkSourceFull = document.createElement('canvas');
    inkSourceFull.width = fw;
    inkSourceFull.height = fh;
    const inkCtx = inkSourceFull.getContext('2d');
    inkCtx.setTransform(1, 0, 0, 1, 0, 0);
    inkCtx.drawImage(stencilCanvas, 0, 0);
    inkCtx.globalCompositeOperation = 'source-in';
    inkCtx.fillStyle = `rgba(${STROKE_COLOR_RGB}, ${STROKE_ALPHA})`;
    inkCtx.fillRect(0, 0, fw, fh);
    inkCtx.globalCompositeOperation = 'source-over';

    traceAssistSegments = { w, h, segId, segCount: nextId, bboxes, inkSourceFull };
  }

  // Expanding-ring nearest-segment search on the (small) classification
  // grid — checks every cell in the CURRENT ring before returning (not
  // just the first one found) so it agrees with true nearest-neighbor
  // distance, verified with a standalone brute-force comparison script
  // before trusting it (an earlier "first found" version disagreed with
  // ground truth in ~0.3% of cases — cheap to get exactly right since
  // this only ever runs a per-stroke handful of times, not per frame).
  function findNearestSegmentInGrid(gx, gy, seg, maxRadiusPx) {
    const { w, h, segId } = seg;
    if (gx >= 0 && gx < w && gy >= 0 && gy < h) {
      const i0 = gy * w + gx;
      if (segId[i0] !== -1) return segId[i0];
    }
    for (let r = 1; r <= maxRadiusPx; r++) {
      let bestId = -1, bestD = Infinity;
      const x0 = gx - r, x1 = gx + r, y0 = gy - r, y1 = gy + r;
      const consider = (x, y) => {
        if (x < 0 || x >= w || y < 0 || y >= h) return;
        const id = segId[y * w + x];
        if (id === -1) return;
        const d = (x - gx) * (x - gx) + (y - gy) * (y - gy);
        if (d < bestD) { bestD = d; bestId = id; }
      };
      for (let x = x0; x <= x1; x++) { consider(x, y0); consider(x, y1); }
      for (let y = y0 + 1; y <= y1 - 1; y++) { consider(x0, y); consider(x1, y); }
      if (bestId !== -1) return bestId;
    }
    return -1;
  }

  // Called once at the end of a real gesture (see endStroke()), never
  // per frame. Tallies which segment each of her sampled stroke points
  // landed nearest to (within SEGMENT_MATCH_RADIUS_NORM), and returns
  // whichever segment won — but only if it clears
  // SEGMENT_MIN_OVERLAP_RATIO of her WHOLE stroke (not just the portion
  // that happened to land near any guide at all), so a gesture that
  // mostly wandered off the design doesn't still "win" on a technicality.
  function findWinningSegmentForStroke(points, seg) {
    if (!seg || !points.length) return -1;
    const maxRadiusPx = Math.round(SEGMENT_MATCH_RADIUS_NORM * seg.w);
    const tally = new Map();
    points.forEach((p) => {
      const gx = Math.round(p.x * seg.w);
      const gy = Math.round(p.y * seg.h);
      const id = findNearestSegmentInGrid(gx, gy, seg, maxRadiusPx);
      if (id === -1) return;
      tally.set(id, (tally.get(id) || 0) + 1);
    });
    let winner = -1, winnerCount = 0;
    tally.forEach((count, id) => {
      if (count > winnerCount) { winnerCount = count; winner = id; }
    });
    if (winner === -1) return -1;
    return winnerCount / points.length >= SEGMENT_MIN_OVERLAP_RATIO ? winner : -1;
  }

  // The actual "wobble becomes perfect" swap. Called from endStroke()
  // right before it clears strokePoints. Returns true if it fired (so
  // the caller knows a crossfade is already underway).
  function tryAutoCompleteSegment() {
    if (!traceAssistOn) return false;
    if (currentTool !== 'cone' && currentTool !== 'toothpick') return false;
    if (!traceAssistSegments || strokePoints.length < 2) return false;

    let pathLen = 0;
    for (let i = 1; i < strokePoints.length; i++) {
      pathLen += Math.hypot(
        strokePoints[i].x - strokePoints[i - 1].x,
        strokePoints[i].y - strokePoints[i - 1].y
      );
    }
    if (pathLen < SEGMENT_MIN_DRAG_DISTANCE) return false; // a bare tap, not a real attempted drag

    const winner = findWinningSegmentForStroke(strokePoints, traceAssistSegments);
    if (winner === -1) return false;

    // undoStack's top entry is the snapshot pushed at THIS stroke's
    // pointerdown (see handleDrawPointerDown) — restoring it wipes just
    // this one rough gesture, exactly like Undo would, but WITHOUT
    // popping the stack, so Undo can still reverse this whole action
    // (rough-then-perfected) as one single step afterward.
    const preStroke = undoStack[undoStack.length - 1];
    if (!preStroke) return false;

    // Snapshot exactly what wetCanvas shows right now (her rough ink, as
    // already drawn live) — becomes the "before" layer the crossfade
    // fades away, see startSegmentCrossfade().
    const beforeSnapshot = document.createElement('canvas');
    beforeSnapshot.width = wetCanvas.width;
    beforeSnapshot.height = wetCanvas.height;
    beforeSnapshot.getContext('2d').drawImage(wetCanvas, 0, 0);

    inkBufferCtx.save();
    inkBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
    inkBufferCtx.clearRect(0, 0, inkBuffer.width, inkBuffer.height);
    inkBufferCtx.drawImage(preStroke, 0, 0);

    const { w, h, segId, bboxes, inkSourceFull } = traceAssistSegments;
    const fw = inkBuffer.width || 1;
    const fh = inkBuffer.height || 1;
    const box = bboxes[winner];
    if (box) {
      const bw = box.maxX - box.minX + 1;
      const bh = box.maxY - box.minY + 1;

      // Mask built at FULL resolution over just this piece's bbox
      // (not the whole canvas) — bounded, cheap, and only run once per
      // qualifying gesture, never per frame.
      const maskCanvasLocal = document.createElement('canvas');
      maskCanvasLocal.width = bw;
      maskCanvasLocal.height = bh;
      const maskCtxLocal = maskCanvasLocal.getContext('2d');
      const maskImage = maskCtxLocal.createImageData(bw, bh);
      for (let y = 0; y < bh; y++) {
        // Full-res pixel -> its classification-grid cell (nearest
        // neighbor) — the mask boundary is only as fine as that coarser
        // grid, but that boundary only ever falls in the (already
        // blank, or already-this-color) gap between two pieces, so the
        // coarseness is invisible in the finished henna.
        const gy = Math.min(h - 1, Math.floor(((box.minY + y) / fh) * h));
        for (let x = 0; x < bw; x++) {
          const gx = Math.min(w - 1, Math.floor(((box.minX + x) / fw) * w));
          if (segId[gy * w + gx] === winner) {
            const di = (y * bw + x) * 4;
            maskImage.data[di] = 255;
            maskImage.data[di + 1] = 255;
            maskImage.data[di + 2] = 255;
            maskImage.data[di + 3] = 255;
          }
        }
      }
      maskCtxLocal.putImageData(maskImage, 0, 0);

      const segmentCanvas = document.createElement('canvas');
      segmentCanvas.width = bw;
      segmentCanvas.height = bh;
      const segCtx = segmentCanvas.getContext('2d');
      segCtx.drawImage(inkSourceFull, box.minX, box.minY, bw, bh, 0, 0, bw, bh);
      segCtx.globalCompositeOperation = 'destination-in';
      segCtx.drawImage(maskCanvasLocal, 0, 0);
      segCtx.globalCompositeOperation = 'source-over';

      inkBufferCtx.drawImage(segmentCanvas, box.minX, box.minY);
    }
    inkBufferCtx.restore();

    compositeInk();
    startSegmentCrossfade(beforeSnapshot);
    return true;
  }

  // The visual "wobble melts into a clean line" reveal: places a frozen
  // snapshot of her rough ink on top of the (already-updated, already-
  // perfect) real canvas, then fades that snapshot out — same "prepare
  // the final state instantly, then animate a layer to reveal it" idea
  // as setPanelVisible()'s panel fades, just a one-shot overlay instead
  // of a persistent UI element. Removes itself when the fade finishes,
  // same "clean itself up" pattern as spawnConfettiBurst()'s pieces.
  function startSegmentCrossfade(beforeSnapshotCanvas) {
    const overlay = beforeSnapshotCanvas;
    overlay.className = 'segmentCrossfadeOverlay';
    artboard.appendChild(overlay);
    void overlay.offsetWidth; // force reflow so the fade-out actually animates
    overlay.classList.add('fading');
    overlay.addEventListener('transitionend', () => overlay.remove());
  }

  /* ---------------- Phase state machine ----------------
     picking -> tracing -> drying -> scraping -> decorating -> done */
  let phase = 'picking';

  function setHint(text) {
    hint.textContent = text || '';
    hint.classList.toggle('visible', !!text);
  }

  /* =====================================================================
     CANVAS ZOOM & PAN — +/- buttons zoom the artboard in/out around its
     own center, for detail work on a small screen; a two-finger drag
     pans around while zoomed. Deliberately NOT pinch-to-zoom — detecting
     a second finger and cleanly canceling whatever the first finger was
     doing (drawing/scraping/etc.) is already the real complexity here;
     continuous pinch-distance tracking on top of that was judged not
     worth the added risk for this pass, per the earlier discussion.

     #artboard itself gets the transform (translate then scale — in that
     order, panX/panY are interpreted as real screen pixels regardless of
     zoom level, matching how translate()-before-scale() already works
     everywhere else in this file). #stage clips the overflow, and
     everything downstream (toNormalized(), which reads
     artboard.getBoundingClientRect()) keeps working completely
     unchanged, since the browser reports that rect post-transform —
     zoom/pan needed zero changes to any drawing/hit-testing code. */
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 2.5;
  const ZOOM_STEP = 0.35;
  let zoomLevel = ZOOM_MIN;
  let panX = 0;
  let panY = 0;

  // Only populated while a two-finger pan could be happening — pointerId
  // -> last known {x, y}. Separate from every other tool's own
  // single-pointer state (isDrawing/isDragging/isScraping etc.).
  const activePointers = new Map();
  let isPanning = false;
  let panMidpoint = null;

  function clampPan() {
    const overflowX = Math.max(0, (artboard.offsetWidth * zoomLevel - stage.offsetWidth) / 2);
    const overflowY = Math.max(0, (artboard.offsetHeight * zoomLevel - stage.offsetHeight) / 2);
    panX = Math.max(-overflowX, Math.min(overflowX, panX));
    panY = Math.max(-overflowY, Math.min(overflowY, panY));
  }

  function applyZoomTransform() {
    clampPan();
    artboard.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
  }

  function updateZoomButtonState() {
    zoomOutBtn.disabled = zoomLevel <= ZOOM_MIN + 0.001;
    zoomInBtn.disabled = zoomLevel >= ZOOM_MAX - 0.001;
  }

  function zoomBy(delta) {
    zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel + delta));
    if (zoomLevel <= ZOOM_MIN) { panX = 0; panY = 0; }
    applyZoomTransform();
    updateZoomButtonState();
  }

  // Called on every real phase change (see updateControlsForPhase) so
  // each new phase always starts from a predictable, fully-visible
  // view — she never lands on the drying/scraping/decorating screen
  // still zoomed in from whatever she was doing while tracing.
  function resetZoom() {
    zoomLevel = ZOOM_MIN;
    panX = 0;
    panY = 0;
    artboard.style.transform = '';
    updateZoomButtonState();
    activePointers.clear();
    isPanning = false;
    panMidpoint = null;
  }

  zoomInBtn.addEventListener('click', () => zoomBy(ZOOM_STEP));
  zoomOutBtn.addEventListener('click', () => zoomBy(-ZOOM_STEP));

  function panMidpointOf(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  // Called on EVERY pointerdown on the artboard, before the normal
  // single-pointer dispatcher — tracks how many fingers are down and
  // decides whether this is (the start of) a two-finger pan.
  function handleZoomPointerDown(e) {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size === 2 && zoomLevel > ZOOM_MIN) {
      // A second finger just landed while zoomed in — cancel whatever
      // the first finger might have started (drawing/scraping/a staged
      // shape drag/etc.) and switch to panning instead. Reusing the same
      // end-handlers the normal pointerup path already calls keeps this
      // safe even if nothing was actually in progress.
      endStroke();
      endDrag();
      endScrape();
      isPanning = true;
      const pts = Array.from(activePointers.values());
      panMidpoint = panMidpointOf(pts[0], pts[1]);
    }
  }

  function handleZoomPointerMove(e) {
    if (!activePointers.has(e.pointerId)) return false;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!isPanning || activePointers.size !== 2) return isPanning;
    const pts = Array.from(activePointers.values());
    const mid = panMidpointOf(pts[0], pts[1]);
    panX += mid.x - panMidpoint.x;
    panY += mid.y - panMidpoint.y;
    panMidpoint = mid;
    applyZoomTransform();
    return true;
  }

  function handleZoomPointerUp(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {
      isPanning = false;
      panMidpoint = null;
    }
  }

  // Cross-phase panel transitions: every bottom control bar (toolbar,
  // shape tray, change-design controls, dryer controls, decor tray +
  // controls, finished panel) plus the floating zoom controls used to
  // snap in/out via an instant classList.toggle('hidden', ...) — a plain
  // display:none swap, no way to animate that. setPanelVisible() gives
  // each one a quick fade + slight slide instead, so switching phases
  // reads as one continuous flow rather than screens popping in and out.
  //
  // Mechanism: showing removes 'hidden' immediately then, one frame
  // later (after a forced reflow so the browser actually registers the
  // starting position), removes 'panelHidden' too so the opacity/
  // transform transition (defined in full-flow.css) animates from
  // "faded/offset" to "in place". Hiding does the reverse in spirit but
  // must wait for the fade to finish before adding 'hidden' back (display
  // :none can't be transitioned — cutting straight to it would undo the
  // whole point). A pending timer is tracked per element so rapidly
  // toggling the same panel twice (e.g. quick undo/redo of a phase)
  // can't leave two competing timeouts stepping on each other.
  const PANEL_FADE_MS = 200;
  const panelHideTimers = new WeakMap();

  function setPanelVisible(el, visible) {
    const pending = panelHideTimers.get(el);
    if (pending) {
      clearTimeout(pending);
      panelHideTimers.delete(el);
    }
    if (visible) {
      el.classList.remove('hidden');
      el.classList.add('panelHidden');
      void el.offsetWidth; // force reflow so the fade-in actually animates
      el.classList.remove('panelHidden');
    } else {
      el.classList.add('panelHidden');
      const t = setTimeout(() => {
        el.classList.add('hidden');
        panelHideTimers.delete(el);
      }, PANEL_FADE_MS);
      panelHideTimers.set(el, t);
    }
  }

  function updateControlsForPhase() {
    changeBtn.classList.toggle('hidden', phase !== 'tracing');
    setPanelVisible(controls, phase === 'tracing');
    setPanelVisible(toolbarPrimary, phase === 'tracing');
    setPanelVisible(toolbarSecondary, phase === 'tracing');
    if (phase !== 'tracing') closeMoreTools(); // leaving tracing always resets the phone drawer closed, so it never reopens stale on the next design
    setPanelVisible(decorTray, phase === 'decorating');
    setPanelVisible(decorControls, phase === 'decorating');
    setPanelVisible(dryerControls, phase === 'drying');
    setPanelVisible(finishedPanel, phase === 'done');
    const zoomable = phase === 'tracing' || phase === 'scraping' || phase === 'decorating';
    setPanelVisible(zoomControls, zoomable);
    resetZoom();
    updateTraceAssistVisibility();
    // Also gated here (not just from setTool()) because leaving the
    // 'tracing' phase (e.g. pressing Done) doesn't reset currentTool —
    // without this, the tray could stay visible into drying/scraping if
    // Shape Pencil was the last tool selected before Done was pressed.
    updateShapeTrayVisibility();
  }

  // Visible only while Shape Pencil is genuinely usable: the tool is
  // selected AND tracing is the active phase.
  function updateShapeTrayVisibility() {
    setPanelVisible(shapeTray, phase === 'tracing' && currentTool === 'shapePencil');
  }

  // Shared so the hint never talks about "the design" when there isn't
  // one (Draw Now / freehand mode leaves activeDesign null).
  function defaultTracingHint() {
    return activeDesign ? 'Trace the design with the cone' : 'Draw anything you like with the cone';
  }

  function selectDesign(design) {
    activeDesign = design;
    picker.classList.add('hidden');
    phase = 'tracing';
    clearWetInk();
    // Guide starts adjustable, not baked — createStencilAdjust() shows
    // the live drag/resize/rotate overlay and sets its own hint;
    // stencilCanvas stays empty until lockStencilGuide() bakes it (see
    // that section, further up this file).
    stencilCtx.clearRect(0, 0, cssW, cssH);
    traceAssistSegments = null; // stale segments from whatever was previously active — rebuilt fresh once THIS guide locks
    createStencilAdjust();
    setTool('cone');
    updateControlsForPhase();
  }

  // Draw Now: identical tracing/dry/scrape/decorate flow as a stencil
  // design, just with no guide loaded — activeDesign stays null, so
  // bakeStencilGuide() (which already no-ops when activeDesign is
  // falsy) never puts anything on stencilCanvas. Every other system
  // (toolbar, staged-shape resize/rotate/move, dry+scrape reveal,
  // decoration step) reads only from the ink she's actually drawn, so
  // nothing else needs to change.
  function startFreehand() {
    activeDesign = null;
    picker.classList.add('hidden');
    phase = 'tracing';
    clearWetInk();
    // No guide at all in this mode, so nothing to adjust or lock —
    // defensively clear any leftover adjust state anyway (harmless
    // no-ops in the normal case, cheap insurance against edge cases).
    destroyStencilAdjust();
    lockedGuideTransform = null;
    stencilGuideLocked = true;
    stencilCtx.clearRect(0, 0, cssW, cssH);
    traceAssistSegments = null; // no guide in Draw Now mode — nothing to auto-complete toward
    setTool('cone');
    setHint(defaultTracingHint());
    updateControlsForPhase();
  }

  function resetToPicker() {
    discardStagedShape();
    clearAllDecorations();
    destroyStencilAdjust();
    lockedGuideTransform = null;
    stencilGuideLocked = true;
    traceAssistSegments = null;
    phase = 'picking';
    activeDesign = null;
    picker.classList.remove('hidden');
    dryerRig.classList.remove('active');
    completionBurst.classList.remove('visible');
    finishedPanel.classList.remove('reveal');
    wetCanvas.classList.remove('fade-out');
    confettiLayer.replaceChildren(); // safety net if she restarts mid-burst
    // Cancel any still-running reward sequence (star pops / coin
    // count-up rAF loop) so a fast "New Design" tap mid-celebration
    // can't have a stale timer/frame touch coinTotal or the picker's
    // badge after we've already moved on.
    clearRewardTimers();
    rewardSequenceToken++;
    pendingStars = null;
    pendingCoins = null;
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
  newDesignBtn.addEventListener('click', resetToPicker);
  iconClearBtn.addEventListener('click', clearWetInk);
  iconDoneBtn.addEventListener('click', onDone);
  decorDoneBtn.addEventListener('click', finishDecorating);
  dryerDoneBtn.addEventListener('click', finishDrying);
  freehandBtn.addEventListener('click', startFreehand);

  buildPickerCards();

  /* ---------------- Tool switching (Cone / Toothpick / Dotting tool /
     Ruler / Curve guide / Circle stamp / Paisley stamp) ----------------
     TOOL_KIND drives pointer routing so each new tool reuses whichever
     existing mechanism fits it instead of a bespoke handler:
       freehand      -> cone/toothpick's drag-a-smoothed-line engine
       stamp         -> place -> adjust -> bake staged-shape engine
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
    // Shape Pencil: same place->adjust->bake staged-shape mechanic as
    // Circle/Paisley, just with a choice of 5 shapes + hollow/filled
    // instead of one fixed form — see the "Shape Pencil" section below.
    shapePencil: 'stamp',
    // The eraser drags exactly like the cone/toothpick (press, drag,
    // release) — it just removes ink instead of adding it — so it
    // reuses the freehand engine verbatim rather than a new mechanic.
    eraser: 'freehand',
  };

  // Switching tools is a "next action" — whatever staged Dot/Circle/
  // Paisley/Shape-Pencil shape was being adjusted (see the staged-shape
  // system further down) gets baked into the henna first, exactly like
  // tapping elsewhere on the hand would.
  function setTool(toolId) {
    bakeStagedShape();
    currentTool = toolId;
    toolSelectBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === toolId);
    });
    Object.entries(TOOL_IMAGES).forEach(([id, img]) => {
      img.style.display = id === toolId ? 'block' : 'none';
    });
    updateShapeTrayVisibility();
    // Picking any tool (from either group) means she's about to draw —
    // if the phone-only specialty drawer happened to be open (she just
    // picked a Ruler/Curve/etc. from it), tuck it away automatically so
    // it doesn't sit over the hand while she works. Harmless no-op on
    // tablet (the drawer mechanism doesn't apply there) or when it was
    // already closed.
    closeMoreTools();
  }

  toolSelectBtns.forEach((btn) => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  // "More tools" — phone-portrait only (see css/full-flow.css; hidden
  // outright on tablet, where #toolbarSecondary is already visible
  // beside the hand and this toggle has nothing to do). Reuses the same
  // .open class the rest of this file already understands via CSS
  // transitions, kept separate from setPanelVisible()'s .hidden/
  // .panelHidden mechanism since the two are independent concerns here:
  // .hidden is "not tracing right now" (whole toolbar gone), .open is
  // "tracing, and she's asked to see the specialty tools drawer."
  function setMoreToolsOpen(open) {
    toolbarSecondary.classList.toggle('open', open);
    moreToolsBtn.classList.toggle('active', open);
    moreToolsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeMoreTools() {
    setMoreToolsOpen(false);
  }

  moreToolsBtn.addEventListener('click', () => {
    setMoreToolsOpen(!toolbarSecondary.classList.contains('open'));
  });

  /* =====================================================================
     M1 DRAW ENGINE — cone-follow + smooth-ink code, targeting wetCanvas,
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
  // How far above her actual finger the cone's ink is drawn, on touch
  // devices only (0 for mouse — see currentPointerType check below), so a
  // real fingertip doesn't sit directly on top of and hide the line.
  // Was 0.085 (8.5% of the artboard's height) — confirmed too large on a
  // real phone ("touch point A, drawing starts at point B"), never caught
  // on laptop/mouse testing since this constant only applies to touch.
  const TOUCH_OFFSET_NORM = 0.035;
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
    // Eraser: deliberately wide — a hairline eraser would be useless for
    // correcting a mistake without pixel-precise aim. Roughly 4x the
    // cone's width.
    eraser: 0.04,
  };

  // Dotting tool: base radius at scale 1 (see the staged-shape system).
  const DOT_RADIUS_RATIO = 0.009;

  // Circle stamp: same idea as the dot, but hollow — a stroked ring
  // instead of a filled disc.
  const CIRCLE_STAMP_RADIUS_RATIO = 0.014;
  const CIRCLE_STAMP_LINE_WIDTH_RATIO = 0.004;

  // Paisley/teardrop stamp: procedural shape (see drawPaisleyShapeLocal
  // below), scaled by this radius.
  const PAISLEY_RADIUS_RATIO = 0.026;

  // ---------------- Staged shape (Dot / Circle stamp / Paisley stamp) ----
  // Tapping one of these 3 tools places a temporary shape that isn't
  // painted into the henna yet — it can be dragged to move, and has a
  // one-finger resize+rotate handle (see beginStagedHandleDrag). It only
  // becomes permanent ink the moment the player does their next action:
  // taps elsewhere, switches tools, or hits Done (see bakeStagedShape and
  // its call sites).
  const STAMP_MIN_SCALE = 0.5;
  const STAMP_MAX_SCALE = 2.2;
  const STAMP_HANDLE_SIZE = 30;
  const STAMP_HANDLE_GAP = 14;
  // Headroom around the shape's own reference radius inside the small
  // preview canvas, so scaling up toward STAMP_MAX_SCALE via CSS width
  // doesn't clip the shape against its own bitmap edge.
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
    if (phase === 'drying' || phase === 'scraping' || phase === 'decorating' || phase === 'done') {
      renderStain(); // rebuild stainCanvas from the restored stain layers + dose map
    }

    layoutAllToolImages();
    layoutScraperTool();
    if (phase === 'tracing') {
      // While she's still adjusting the guide, just reposition the live
      // overlay at the new artboard size; once locked, re-bake it onto
      // stencilCanvas at the SAME adjusted transform (bakeStencilGuide
      // reads lockedGuideTransform, not the design's raw defaults) so a
      // resize/orientation-change never reverts her adjustment.
      if (stencilGuideLocked) {
        bakeStencilGuide();
        buildTraceAssistSegments(); // guide's pixel positions just changed with the resize — the segments must match
      } else {
        positionStencilAdjust();
      }
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

    // Placed decorations are stored as normalized (0-1) positions too,
    // for the same reason — reposition them so they stay put relative
    // to the hand across a resize/orientation-change.
    repositionAllDecor();
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
  // 4 bezier curves. Local coordinates only — mirroring (the flip
  // control) and rotation are both handled by the caller's context
  // transform, not by this function.
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

  /* ---------------- Shape Pencil: 5 code-generated shapes ----------------
     Each shape below is a plain path builder in LOCAL coordinates (same
     convention as drawDotShapeLocal/drawPaisleyShapeLocal above) —
     no image assets, so every shape stays perfectly crisp at any scale
     the resize handle produces, instead of pixelating like a bitmap
     icon would. A path builder only defines the outline; whether it
     ends up solid or hollow is decided by drawShapePencilLocal, based
     on whichever fill mode she picked in #shapeTray at placement time. */
  function buildPolygonPath(ctx, points) {
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
  }

  function buildCirclePath(ctx, r) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.closePath();
  }

  // Equilateral triangle, point up — 3 vertices spaced 120° apart on a
  // circle of radius r, starting straight up (-90°).
  function buildTrianglePath(ctx, r) {
    const pts = [-90, 30, 150].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      return { x: r * Math.cos(rad), y: r * Math.sin(rad) };
    });
    buildPolygonPath(ctx, pts);
  }

  // Rhombus: a square rotated 45° — points at top/right/bottom/left.
  function buildRhombusPath(ctx, r) {
    buildPolygonPath(ctx, [
      { x: 0, y: -r },
      { x: r, y: 0 },
      { x: 0, y: r },
      { x: -r, y: 0 },
    ]);
  }

  // Kite: left-right symmetric like the rhombus, but the top point sits
  // noticeably closer to center than the bottom point — the classic
  // "flying kite" silhouette rather than a plain diamond.
  function buildKitePath(ctx, r) {
    buildPolygonPath(ctx, [
      { x: 0, y: -0.85 * r },
      { x: 0.62 * r, y: -0.05 * r },
      { x: 0, y: 1.25 * r },
      { x: -0.62 * r, y: -0.05 * r },
    ]);
  }

  // 5-pointed star: alternating outer/inner radius every 36°, point up.
  function buildStarPath(ctx, r) {
    const innerR = r * 0.46;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const deg = -90 + i * 36;
      const rad = (deg * Math.PI) / 180;
      const rr = i % 2 === 0 ? r : innerR;
      pts.push({ x: rr * Math.cos(rad), y: rr * Math.sin(rad) });
    }
    buildPolygonPath(ctx, pts);
  }

  const SHAPE_PENCIL_PATHS = {
    circle: buildCirclePath,
    triangle: buildTrianglePath,
    rhombus: buildRhombusPath,
    kite: buildKitePath,
    star: buildStarPath,
  };

  const SHAPE_PENCIL_RADIUS_RATIO = 0.02;
  const SHAPE_PENCIL_LINE_WIDTH_RATIO = 0.005;

  // Shape Pencil is the one staged-shape tool that isn't a single fixed
  // form — it needs to know which of the 5 shapes, and hollow vs.
  // filled, to draw. Every other STAMP_SHAPE_DRAWERS entry only takes
  // (ctx, r); this one also reads a 3rd "extra" argument (the staged
  // shape object itself — see createStagedShape/renderStagedPreviewBitmap
  // /bakeStagedShape) that the other drawers simply ignore.
  function drawShapePencilLocal(ctx, r, extra) {
    const kind = (extra && extra.shapeKind) || 'circle';
    const filled = !extra || extra.filled !== false;
    const build = SHAPE_PENCIL_PATHS[kind] || SHAPE_PENCIL_PATHS.circle;
    build(ctx, r);
    if (filled) {
      ctx.fillStyle = `rgba(${STROKE_COLOR_RGB}, ${STROKE_ALPHA})`;
      ctx.fill();
    } else {
      ctx.strokeStyle = `rgba(${STROKE_COLOR_RGB}, ${STROKE_ALPHA})`;
      ctx.lineWidth = r * (SHAPE_PENCIL_LINE_WIDTH_RATIO / SHAPE_PENCIL_RADIUS_RATIO);
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }

  const STAMP_SHAPE_DRAWERS = {
    dot: drawDotShapeLocal,
    circle: drawCircleStampShapeLocal,
    paisley: drawPaisleyShapeLocal,
    shapePencil: drawShapePencilLocal,
  };
  const STAMP_RADIUS_RATIO = {
    dot: DOT_RADIUS_RATIO,
    circle: CIRCLE_STAMP_RADIUS_RATIO,
    paisley: PAISLEY_RADIUS_RATIO,
    shapePencil: SHAPE_PENCIL_RADIUS_RATIO,
  };
  // Flip mechanism is fully wired up (see bakeStagedShape/
  // positionStagedShape) — but the paisley shape's own control points
  // are exactly left-right mirror-symmetric, so flipping it currently
  // produces a pixel-identical result. Disabled (empty set) rather than
  // shipping a button that visibly does nothing; flagged to Vinit.
  // Re-enable by adding 'paisley' back once the shape has some real
  // asymmetry (e.g. a curled tip like a real paisley/mango motif).
  const STAMP_CAN_FLIP = new Set([]);

  let stagedShape = null; // { tool, wrap, previewCanvas, handle, flipBtn, nx, ny, scale, angle, flip, baseCssSize }

  // Shape Pencil's pending selection — which of the 5 shapes, and
  // hollow vs. filled, the NEXT placed shape will use. Persists across
  // placements (she can drop several stars in a row without reselecting
  // each time) until she picks something different in #shapeTray.
  let selectedShapeKind = 'circle';
  let shapeFilled = true;

  shapeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedShapeKind = btn.dataset.shape;
      shapeBtns.forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  function setShapeFilled(filled) {
    shapeFilled = filled;
    shapeFilledBtn.classList.toggle('active', filled);
    shapeHollowBtn.classList.toggle('active', !filled);
  }
  shapeFilledBtn.addEventListener('click', () => setShapeFilled(true));
  shapeHollowBtn.addEventListener('click', () => setShapeFilled(false));

  function handleStampPointerDown(e) {
    currentPointerType = e.pointerType || 'mouse';
    rawPoint = toNormalized(e.clientX, e.clientY);
    hasPointer = true;
    showTool();
    // Tapping blank hand space is itself a "next action" for whatever
    // was previously staged — bake it, then place the new shape.
    bakeStagedShape();
    createStagedShape(currentTool, rawPoint.x, rawPoint.y);
    playStampSound();
    artboard.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  // Draws a staged shape's small live-preview bitmap once, at a
  // reference size derived from the current artboard width — called at
  // creation, and again on resize/orientation-change (see setupCanvases)
  // so a mid-adjustment device rotation doesn't leave a stale-sized
  // preview. Scale afterward is purely a CSS width change (see
  // positionStagedShape), not a redraw.
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
    STAMP_SHAPE_DRAWERS[s.tool](ctx, r0, s);
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
      setHint(defaultTracingHint());
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
      // Only meaningful for Shape Pencil — captured from whatever was
      // selected in #shapeTray at the moment of placement, so changing
      // the picker afterward never retroactively changes an already-
      // placed (but not yet baked) shape.
      shapeKind: tool === 'shapePencil' ? selectedShapeKind : undefined,
      filled: tool === 'shapePencil' ? shapeFilled : undefined,
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
  // it anywhere on the hand — offset-from-center technique so the shape
  // doesn't jump to re-center under the finger the instant it's touched.
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

  // Combined resize+rotate handle gesture: distance from the shape's
  // center sets scale, angle back to center sets rotation, both updated
  // together every move.
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
    STAMP_SHAPE_DRAWERS[s.tool](inkBufferCtx, r, s);
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
  // player actually dragged.
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
    // Segment Auto-Complete gets first look at the just-finished gesture,
    // while strokePoints/isDrawing still reflect it — see
    // tryAutoCompleteSegment() near the stencil-guide section. Safe to
    // call unconditionally: it no-ops instantly whenever Assist
    // shouldn't apply (off, wrong tool, no segments, too-short a drag,
    // no clear winning piece).
    if (isDrawing) tryAutoCompleteSegment();
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
     cone/toothpick stroke or a single stamped shape. */
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
      // Segment Auto-Complete only ever acts AFTER a whole gesture ends
      // (see tryAutoCompleteSegment(), called from endStroke()) — the
      // live per-frame drawing here is always pure, unmodified freehand,
      // exactly as it was before Assist existed, whether Assist is on or
      // off. This keeps the "wobbly scribble" fully visible while she's
      // still drawing it, so the swap reads as a clear transformation
      // the instant she releases, not a moment-to-moment nudge.
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
     M2 DRY + SCRAPE ENGINE — traced shape comes from wetCanvas (whatever
     the player actually drew), with completion detection to end scraping
     and move on to the optional decoration step.
     ===================================================================== */

  const DRY_COLOR_RGB = '54, 36, 20';
  const DRY_ALPHA = 0.95;
  const STAIN_LIGHT_RGB = '196, 118, 56';
  const STAIN_DARK_RGB = '133, 66, 28';

  const SCRAPE_RADIUS_RATIO = 0.042;
  const DOSE_PEAK_ALPHA = 0.05;
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

  // Second small offscreen buffer, paired with the one above, so the
  // star-rating check (see computeGuideCoverageRatio() near onDone())
  // can hold both the guide's downscaled alpha and the ink's downscaled
  // alpha at once — neither canvas's own pixel count alone answers "how
  // much of the guide did she actually trace over," only comparing them
  // does.
  const coverageCanvas2 = document.createElement('canvas');
  coverageCanvas2.width = COVERAGE_W;
  coverageCanvas2.height = COVERAGE_H;
  const coverageCtx2 = coverageCanvas2.getContext('2d', { willReadFrequently: true });

  let toolAngleDeg = -20;
  let prevScrapeX = null, prevScrapeY = null;
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
    let data;
    try {
      data = coverageCtx.getImageData(0, 0, COVERAGE_W, COVERAGE_H).data;
    } catch (err) {
      // Reading pixel data back out of a canvas is blocked by the browser
      // whenever the page (and the local image assets it draws onto that
      // canvas) is opened directly as a file:// path — Chrome treats every
      // file:// page as its own untrusted origin, so this throws a
      // SecurityError there even though everything is on the same
      // computer. It works fine once the game is served over a real
      // http(s) URL (a local dev server, or hosting it for real). Failing
      // safe here means auto-detecting "fully scraped" just won't kick in
      // under file://, instead of crashing.
      return null;
    }
    let count = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 25) count++;
    }
    return count;
  }

  // Star rating is based on how much of the stencil guide got traced
  // over, not stroke accuracy — generous by design (the goal is "did she
  // cover the design," not pixel-perfect line-following). Reuses the same
  // cheap downscaled-getImageData technique as countCoverage() above,
  // just comparing two layers (the guide's own shape vs. her actual ink)
  // instead of counting one layer against its own starting size.
  // stencilCanvas already IS the exact baked guide shape (drawn at
  // STENCIL_OPACITY, hand-clipped) — no need to re-render placement math
  // separately, we can just read its current pixels directly. Returns
  // null (same fail-safe as countCoverage()) under file://, or if there's
  // somehow no guide content to measure against.
  const GUIDE_ALPHA_THRESHOLD = 10; // guide is baked faint (STENCIL_OPACITY≈0.34), needs a lower bar than ink's 25
  const INK_ALPHA_THRESHOLD = 25;

  function computeGuideCoverageRatio(guideCanvas, inkCanvas) {
    coverageCtx.clearRect(0, 0, COVERAGE_W, COVERAGE_H);
    coverageCtx.drawImage(guideCanvas, 0, 0, COVERAGE_W, COVERAGE_H);
    coverageCtx2.clearRect(0, 0, COVERAGE_W, COVERAGE_H);
    coverageCtx2.drawImage(inkCanvas, 0, 0, COVERAGE_W, COVERAGE_H);
    let guideData, inkData;
    try {
      guideData = coverageCtx.getImageData(0, 0, COVERAGE_W, COVERAGE_H).data;
      inkData = coverageCtx2.getImageData(0, 0, COVERAGE_W, COVERAGE_H).data;
    } catch (err) {
      return null; // file:// SecurityError — same fallback as countCoverage()
    }
    let guideCount = 0;
    let overlapCount = 0;
    for (let i = 3; i < guideData.length; i += 4) {
      if (guideData[i] > GUIDE_ALPHA_THRESHOLD) {
        guideCount++;
        if (inkData[i] > INK_ALPHA_THRESHOLD) overlapCount++;
      }
    }
    if (guideCount === 0) return null;
    return overlapCount / guideCount;
  }

  // Deliberately generous, no 0-star tier — reaching Done already means a
  // full trace was completed, so the worst outcome is still "1 star,"
  // never "you failed."
  function starsForCoverage(ratio) {
    if (ratio >= 0.8) return 3;
    if (ratio >= 0.5) return 2;
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
    // (unbaked) needs to become real ink now so it actually appears in
    // the finished design.
    bakeStagedShape();

    phase = 'drying';
    updateControlsForPhase();

    // Lock the artwork: stop drawing, hide the active tool cursor, and
    // remove the guide so nothing can show through the finished piece
    // later. destroyStencilAdjust() covers the (unusual but possible)
    // case where Done is pressed before she ever drew a single stroke —
    // lockStencilGuide() would never have fired, so the live adjust
    // overlay could otherwise still be sitting there.
    hideAllToolCursors();
    destroyStencilAdjust();

    // Star/coin scoring: must happen HERE, before the guide gets cleared
    // two lines down — stencilCanvas's current pixels ARE the guide
    // shape we need to compare her ink against. Skipped entirely for
    // freehand/Draw Now (activeDesign null), per spec: no stencil guide
    // means nothing to score coverage against, and this game mode simply
    // doesn't earn stars/coins yet.
    if (activeDesign) {
      const ratio = computeGuideCoverageRatio(stencilCanvas, wetCanvas);
      // null only happens under file:// (see computeGuideCoverageRatio's
      // own comment) — fail safe to the generous default rather than
      // crashing or awarding nothing.
      pendingStars = ratio === null ? 2 : starsForCoverage(ratio);
      pendingCoins = activeDesign.coins;
    } else {
      pendingStars = null;
      pendingCoins = null;
    }

    stencilGuideLocked = true;
    lockedGuideTransform = null;
    stencilCtx.clearRect(0, 0, cssW, cssH);
    traceAssistSegments = null; // guide is gone for the rest of this design — nothing left to auto-complete toward

    buildRevealLayers();

    setHint('Wave the dryer over your design, then tap Done Drying');
    dryerRig.classList.add('active');
    wetCanvas.classList.add('fade-out');
    // Sensible starting spot before she's touched anything — roughly
    // centered over the design, same area the old fixed position used.
    positionDryer(cssW / 2, cssH * 0.4);
  }

  // Places the dryer icon at an ARTBOARD-LOCAL pixel position (not raw
  // screen coordinates) — same anchor + translate(-50%,-50%) convention
  // used for the scraper cursor one phase later, so it reads as the
  // same kind of "held tool."
  function positionDryer(px, py) {
    dryerRig.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
  }

  // Moves the dryer to wherever her finger/mouse actually is, converting
  // from real screen coordinates the same way every other tool does.
  function showDryerAt(clientX, clientY) {
    const n = toNormalized(clientX, clientY);
    positionDryer(n.x * cssW, n.y * cssH);
  }

  // Player decides when drying is "done" — pressing the "Done Drying"
  // button moves on to scraping. She can wave the dryer around for as
  // long as she likes first; there's no way to trigger this by accident
  // since it's a deliberate button press, not a tap on the hand.
  function finishDrying() {
    if (phase !== 'drying') return;
    dryerRig.classList.remove('active');
    phase = 'scraping';
    setHint('Drag the tool over the design to reveal it');
    updateControlsForPhase();
    // scrapeCursor stays hidden until a real pointer position is known
    // (see handleScrapePointerMove/Down), same rule as the cone.
  }

  // Scraping is complete — move on to the optional decoration step
  // rather than straight to a final "done" screen, so the player can add
  // gems/bindis/flowers before the piece is truly finished.
  function completeDesign() {
    phase = 'decorating';
    driedCtx.clearRect(0, 0, cssW, cssH);
    // "Full dose" everywhere the design exists — darkStain's own alpha
    // shape already matches the traced design exactly, so copying it
    // straight into doseMap makes the whole piece read as fully, richly
    // scraped, not just "mostly done."
    doseMapCtx.clearRect(0, 0, cssW, cssH);
    doseMapCtx.drawImage(darkStain, 0, 0, cssW, cssH);
    renderStain();
    scrapeCursor.classList.remove('visible', 'scraping');
    updateDecorHint();
    updateControlsForPhase();
    spawnConfettiBurst();
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

  // One-shot celebration burst — fired once from completeDesign(), the
  // exact instant scraping finishes and the design is revealed. Same
  // "spawn a small DOM span with randomized CSS-custom-property motion,
  // clean itself up on animationend" pattern as spawnFlake() above, just
  // a bigger one-time burst instead of a continuous drip while scraping.
  // Colors echo the decoration tray's own gem/bindi palette so the
  // celebration feels like it belongs to this game rather than a generic
  // stock effect.
  const CONFETTI_COLORS = ['#e3b23c', '#e2695a', '#4a9bb0', '#7fb069', '#e58fb0', '#a67fc9'];
  const CONFETTI_PIECE_COUNT = 26;

  function spawnConfettiBurst() {
    // Bursts from roughly the center of the visible design/hand rather
    // than following a cursor — there's no "current position" for this
    // moment the way there is while scraping.
    const originX = cssW / 2;
    const originY = cssH * 0.42;
    for (let i = 0; i < CONFETTI_PIECE_COUNT; i++) {
      const piece = document.createElement('span');
      piece.className = 'confettiPiece';
      if (Math.random() < 0.4) piece.classList.add('confettiPiece--dot');
      const angle = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 130;
      // Slight upward bias (-40) so the burst reads as "up and outward"
      // like a firework, not just sideways drift.
      const fx = Math.cos(angle) * dist;
      const fy = Math.sin(angle) * dist - 40;
      piece.style.setProperty('--cx', `${originX}px`);
      piece.style.setProperty('--cy', `${originY}px`);
      piece.style.setProperty('--fx', `${fx}px`);
      piece.style.setProperty('--fy', `${fy}px`);
      piece.style.setProperty('--rot', `${(Math.random() * 720 - 360).toFixed(0)}deg`);
      piece.style.setProperty('--delay', `${(Math.random() * 120).toFixed(0)}ms`);
      piece.style.setProperty('--dur', `${(650 + Math.random() * 350).toFixed(0)}ms`);
      piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      confettiLayer.appendChild(piece);
      piece.addEventListener('animationend', () => piece.remove());
    }
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
    // null means pixel-reading was blocked (see countCoverage) — skip the
    // auto-complete check rather than let it misread null as "0 left."
    if (remaining !== null && remaining / initialCoverageCount <= COMPLETE_REMAINING_RATIO) {
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

  /* =====================================================================
     DECORATION STEP — optional gems/bindis/flower stickers, added once
     scraping finishes. Ported from decoration-test.js: same tray-select
     -> tap-to-place -> drag/resize-rotate/delete mechanics, wired here
     into the real phase machine (phase === 'decorating') instead of
     that isolated test's own dedicated pointerdown listener. Reuses this
     file's own artboard/cssW/cssH/toNormalized rather than a second
     copy — decorations don't need their own mask or canvas, since
     they're plain positioned <img> elements sitting on top of the real
     finished henna (not a fake stand-in backdrop like the test used).
     ===================================================================== */

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
    moon_silver: 'assets/decor_moon_silver.png',
    pearls_white: 'assets/decor_pearls_white.png',
    butterfly_blue: 'assets/decor_butterfly_blue.png',
    leaf_gold: 'assets/decor_leaf_gold.png',
  };

  // Every placed sticker supports three basic things a player expects to
  // be able to do to "a thing they put down": move it, resize/rotate it,
  // remove it if they change their mind. Move is a plain one-finger drag
  // on the sticker itself. Resize+rotate is the same one-finger handle
  // gesture as the staged stamp shapes above. Remove is a small ✕ button
  // mirrored on the opposite side of the handle, shown only while that
  // sticker is selected.
  const DECOR_BASE_WIDTH = 52; // px at scale 1
  const DECOR_MIN_SCALE = 0.5;
  const DECOR_MAX_SCALE = 2.2;
  const DECOR_HANDLE_SIZE = 30;
  const DECOR_HANDLE_GAP = 14;
  const DECOR_REF_DIST = DECOR_BASE_WIDTH / 2 + DECOR_HANDLE_GAP + DECOR_HANDLE_SIZE / 2;

  let selectedDecorItem = null; // which tray sticker is pending placement
  let placedDecorations = []; // { id, itemId, wrap, img, handle, deleteBtn, nx, ny, scale, angle }
  let nextPlacedDecorId = 1;
  let selectedPlacedDecorId = null;

  function selectDecorItem(id) {
    // Picking a tray item means "place something new next" — whatever
    // was being adjusted before is done being adjusted, so lock it in
    // first.
    deselectPlacedDecor();
    if (selectedDecorItem === id) {
      // Tapping the already-selected item again deselects it.
      selectedDecorItem = null;
    } else {
      selectedDecorItem = id;
    }
    decorBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.item === selectedDecorItem);
    });
    updateDecorHint();
  }

  function updateDecorHint() {
    if (phase !== 'decorating') return;
    if (selectedPlacedDecorId != null) {
      setHint('Drag it to move. Use the gold circle to resize/turn, or ✕ to remove it.');
    } else if (selectedDecorItem) {
      setHint('Tap the hand to place it.');
    } else if (placedDecorations.length > 0) {
      setHint('Tap a sticker to adjust it, add more, or tap Done when you’re happy.');
    } else {
      setHint('Add stickers if you like — tap a sparkle below, then tap the hand. Or just tap Done.');
    }
  }

  // Recomputes a placed sticker's on-screen position/size/rotation from
  // its stored normalized data — called after every drag update, and
  // again on resize/orientation-change (see setupCanvases) so stickers
  // stay put relative to the hand instead of drifting.
  function positionPlacedDecor(deco) {
    const cx = deco.nx * cssW;
    const cy = deco.ny * cssH;
    deco.wrap.style.transform = `translate(${cx}px, ${cy}px) rotate(${deco.angle}deg)`;

    const w = DECOR_BASE_WIDTH * deco.scale;
    deco.img.style.width = w + 'px';

    // Resize/rotate handle sits just past the sticker's current edge on
    // one side; the delete button mirrors it on the opposite side.
    const r = w / 2 + DECOR_HANDLE_GAP + DECOR_HANDLE_SIZE / 2;
    deco.handle.style.transform = `translate(${r}px, 0px) translate(-50%, -50%)`;
    deco.deleteBtn.style.transform = `translate(${-r}px, 0px) translate(-50%, -50%)`;
  }

  function repositionAllDecor() {
    placedDecorations.forEach(positionPlacedDecor);
  }

  function selectPlacedDecor(id) {
    selectedPlacedDecorId = id;
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
    if (selectedDecorItem) {
      selectedDecorItem = null;
      decorBtns.forEach((btn) => btn.classList.remove('active'));
    }
    updateDecorHint();
  }

  function deselectPlacedDecor() {
    if (selectedPlacedDecorId == null) return;
    const d = placedDecorations.find((x) => x.id === selectedPlacedDecorId);
    if (d) {
      d.handle.classList.remove('visible');
      d.deleteBtn.classList.remove('visible');
    }
    selectedPlacedDecorId = null;
    updateDecorHint();
  }

  function removePlacedDecor(id) {
    const idx = placedDecorations.findIndex((d) => d.id === id);
    if (idx === -1) return;
    placedDecorations[idx].wrap.remove();
    placedDecorations.splice(idx, 1);
    if (selectedPlacedDecorId === id) selectedPlacedDecorId = null;
    updateDecorHint();
  }

  // Wipes every placed sticker with no trace left behind — used when
  // starting a new design (resetToPicker), so old stickers never carry
  // over onto the next piece.
  function clearAllDecorations() {
    selectedDecorItem = null;
    selectedPlacedDecorId = null;
    placedDecorations = [];
    decorLayer.innerHTML = '';
    decorBtns.forEach((btn) => btn.classList.remove('active'));
  }

  function createPlacedDecor(itemId, nx, ny) {
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
      id: nextPlacedDecorId++,
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
    positionPlacedDecor(deco);

    beginDecorBodyDrag(deco);
    beginDecorHandleDrag(deco);

    deleteBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (phase !== 'decorating') return;
      removePlacedDecor(deco.id);
    });

    // Auto-select right after placing so the handle/delete controls are
    // already visible — the player sees immediately what they can do,
    // no explanation needed.
    selectPlacedDecor(deco.id);

    updateDecorHint();
  }

  // Plain one-finger drag on the sticker itself to move it anywhere on
  // the hand. Records the offset between the touch point and the
  // sticker's own center at the moment of touch-down, then holds that
  // same offset through the drag — so the sticker doesn't jump to
  // re-center itself under the finger the instant it's grabbed.
  function beginDecorBodyDrag(deco) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    function onDown(e) {
      e.stopPropagation();
      if (phase !== 'decorating') return;
      dragging = true;
      selectPlacedDecor(deco.id);
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
      positionPlacedDecor(deco);
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

  // Wires up the one-finger "grab the handle" gesture for a single
  // placed sticker. Distance from the sticker's own center sets its
  // scale, and the angle back to the sticker's center sets its rotation
  // — both updated together on every pointermove.
  function beginDecorHandleDrag(deco) {
    let dragging = false;

    function onHandlePointerDown(e) {
      e.stopPropagation();
      if (phase !== 'decorating') return;
      dragging = true;
      selectPlacedDecor(deco.id);
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
      positionPlacedDecor(deco);
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

  // Entry point for the unified pointer dispatcher below when
  // phase === 'decorating'.
  function placeDecorAt(clientX, clientY) {
    if (phase !== 'decorating') return;

    if (!selectedDecorItem) {
      // No tray item pending — a tap on blank hand space just finalizes
      // whatever sticker was being adjusted.
      deselectPlacedDecor();
      return;
    }

    const n = toNormalized(clientX, clientY);
    if (n.x < 0 || n.x > 1 || n.y < 0 || n.y > 1) return;

    createPlacedDecor(selectedDecorItem, n.x, n.y);
    playStampSound();
  }

  decorBtns.forEach((btn) => {
    btn.addEventListener('click', () => selectDecorItem(btn.dataset.item));
  });

  // Finishes the optional decoration step — the true end of the whole
  // flow. Works with zero stickers placed (decorating is entirely
  // optional, per the brief).
  function finishDecorating() {
    if (phase !== 'decorating') return;
    deselectPlacedDecor();
    phase = 'done';
    setHint('Your henna design is complete!');
    updateControlsForPhase();
    playCompletionReveal();
    playRewardSequence();
    playCompletionChime();
  }

  // Restarts the burst-glow + message animations from scratch every time
  // (removing the classes and forcing a reflow before re-adding them) so
  // finishing a SECOND design still gets the full reveal, not just the
  // first one — CSS animations don't replay on their own if the class
  // triggering them was already present.
  function playCompletionReveal() {
    completionBurst.classList.remove('visible');
    finishedPanel.classList.remove('reveal');
    void completionBurst.offsetWidth; // force reflow
    completionBurst.classList.add('visible');
    finishedPanel.classList.add('reveal');
  }

  /* ---------------- Reward-moment orchestration ----------------
     Stars pop in one at a time -> confetti fires the instant the last
     one lands -> coins tick up right after — one tight combined
     celebration (~2s total) rather than several disconnected effects,
     per Vinit's explicit spec. Skipped entirely for freehand/Draw Now
     (pendingStars stays null — see onDone()). Timing is deliberately a
     little front-loaded: the first star starts popping (220ms) before
     the "Well done!" text even finishes its own bounce-in (which starts
     260ms), so by the time she's read the text, the rating is already
     mid-reveal — the two entrances overlap rather than queuing one
     after the other. */
  const STAR_STAGGER_MS = 220; // gap between each star's pop-in
  const STAR_POP_DURATION_MS = 420; // must match .starIcon.pop/.popDim's CSS animation-duration
  const COIN_START_GAP_MS = 150; // brief pause after the last star lands, before coins start ticking
  const COIN_COUNT_DURATION_MS = 800;

  // A monotonically-increasing token, plus every pending timer tracked
  // so it can be cancelled — guards against a stale callback from a
  // PREVIOUS reward sequence (e.g. she backs out to the picker, or
  // somehow finishes a second design, before the first sequence's timers
  // would have fired) touching shared state like coinTotal or spawning a
  // second confetti burst on top of a fresh one.
  let rewardSequenceToken = 0;
  const rewardTimers = [];

  function clearRewardTimers() {
    rewardTimers.forEach((id) => clearTimeout(id));
    rewardTimers.length = 0;
  }

  function scheduleReward(fn, delay) {
    rewardTimers.push(setTimeout(fn, delay));
  }

  function resetRewardVisuals() {
    starIcons.forEach((el) => el.classList.remove('pop', 'popDim'));
    coinReward.classList.remove('visible');
    coinRewardIcon.classList.remove('coinSpin');
    coinRewardAmount.textContent = '+0';
  }

  function playRewardSequence() {
    clearRewardTimers();
    const myToken = ++rewardSequenceToken;
    resetRewardVisuals();

    if (pendingStars === null) {
      // Freehand/Draw Now — no guide was traced, so there's no coverage
      // to score. Nothing to fade from (this row has no reason to have
      // been visible already), so a plain instant hide is correct here,
      // not the fade helper.
      rewardRow.classList.add('hidden');
      rewardRow.classList.remove('panelHidden');
      return;
    }

    setPanelVisible(rewardRow, true);

    const earnedCount = pendingStars;
    const lastStarIndex = starIcons.length - 1;
    const lastStarLandsAt = STAR_STAGGER_MS * (lastStarIndex + 1) + STAR_POP_DURATION_MS;

    starIcons.forEach((el, i) => {
      scheduleReward(() => {
        if (myToken !== rewardSequenceToken) return; // superseded — bail
        el.classList.add(i < earnedCount ? 'pop' : 'popDim');
      }, STAR_STAGGER_MS * (i + 1));
    });

    scheduleReward(() => {
      if (myToken !== rewardSequenceToken) return;
      spawnConfettiBurst();
    }, lastStarLandsAt);

    scheduleReward(() => {
      if (myToken !== rewardSequenceToken) return;
      startCoinCountUp(myToken);
    }, lastStarLandsAt + COIN_START_GAP_MS);
  }

  // Ticks the displayed number from 0 up to pendingCoins over
  // COIN_COUNT_DURATION_MS with an ease-out curve (fast start, gentle
  // settle) rather than a linear crawl — reads as more satisfying for a
  // small number of coins. Persists the new total immediately (not at
  // the end of the tick) so the picker's badge is already correct the
  // instant she navigates back, even if she does that unusually fast.
  function startCoinCountUp(myToken) {
    coinReward.classList.add('visible');
    coinRewardIcon.classList.add('coinSpin');
    addCoins(pendingCoins);
    const target = pendingCoins;
    const start = performance.now();
    function tick(now) {
      if (myToken !== rewardSequenceToken) return; // a newer sequence has taken over — stop driving this one
      const t = Math.min(1, (now - start) / COIN_COUNT_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      coinRewardAmount.textContent = `+${Math.round(target * eased)}`;
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        coinRewardIcon.classList.remove('coinSpin');
      }
    }
    requestAnimationFrame(tick);
  }

  /* ---------------- Unified pointer routing ---------------- */
  function onPointerDown(e) {
    handleZoomPointerDown(e);
    if (isPanning) return; // second finger just took over — no tool should also react
    if (phase === 'tracing') {
      // Any real tracing action reaching this far (i.e. not intercepted
      // by the stencil guide's own move/resize handles, which
      // stopPropagation() before it ever gets here) counts as "starting
      // to draw" — locks the guide in place if it wasn't already.
      lockStencilGuide();
      const kind = TOOL_KIND[currentTool];
      if (kind === 'stamp') handleStampPointerDown(e);
      else if (kind === 'drag-straight' || kind === 'drag-arc') handleDragPointerDown(e);
      else handleDrawPointerDown(e);
    } else if (phase === 'drying') {
      showDryerAt(e.clientX, e.clientY);
    } else if (phase === 'scraping') {
      handleScrapePointerDown(e);
    } else if (phase === 'decorating') {
      placeDecorAt(e.clientX, e.clientY);
    }
  }
  function onPointerMove(e) {
    if (handleZoomPointerMove(e)) return; // mid-pan — don't also feed the active tool
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
    } else if (phase === 'drying') {
      showDryerAt(e.clientX, e.clientY);
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
    handleZoomPointerUp(e);
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

  requestAnimationFrame((t) => {
    lastFrameTime = t;
    requestAnimationFrame(frame);
  });
})();
