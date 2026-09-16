(() => {
  const FRAME_COUNT = 240;
  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const navbar = document.querySelector('.navbar');

  const getFrameUrl = (index) => {
    const padded = String(index + 1).padStart(3, '0');
    return `ezgif-frame-${padded}.jpg`;
  };

  const images = new Array(FRAME_COUNT);
  let loadedCount = 0;
  let targetProgress = 0;
  let currentProgress = 0;
  let lastRenderedIndex = -1;
  let needsRepaint = true;

  // High-DPI canvas dimensions fitting the full viewport
  function updateCanvasSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    needsRepaint = true;
  }

  // Draw frame with aspect-ratio cover mode centered in viewport
  function renderFrame(img) {
    if (!img || !img.complete || img.naturalWidth === 0) return false;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const scale = Math.max(cw / iw, ch / ih);
    const sw = iw * scale;
    const sh = ih * scale;
    const sx = (cw - sw) / 2;
    const sy = (ch - sh) / 2;

    ctx.drawImage(img, sx, sy, sw, sh);
    return true;
  }

  // Get nearest loaded neighbor to prevent any flash or flicker
  function getClosestAvailableFrame(index) {
    if (images[index] && images[index].complete && images[index].naturalWidth > 0) {
      return images[index];
    }
    for (let offset = 1; offset < FRAME_COUNT; offset++) {
      const prev = index - offset;
      if (prev >= 0 && images[prev] && images[prev].complete && images[prev].naturalWidth > 0) {
        return images[prev];
      }
      const next = index + offset;
      if (next < FRAME_COUNT && images[next] && images[next].complete && images[next].naturalWidth > 0) {
        return images[next];
      }
    }
    return null;
  }

  // Calculate scroll progress across the entire page scroll
  function onScroll() {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    targetProgress = Math.max(0, Math.min(1, scrollY / maxScroll));

    // Navbar state (if present)
    if (navbar) {
      if (scrollY > 40) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }
  }

  // Continuous animation loop with inertia/lerp
  function loop() {
    // Dampened interpolation for silky-smooth scrubbing
    const delta = targetProgress - currentProgress;
    if (Math.abs(delta) > 0.0001) {
      currentProgress += delta * 0.12;
    } else {
      currentProgress = targetProgress;
    }

    const frameFloat = currentProgress * (FRAME_COUNT - 1);
    const frameIndex = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(frameFloat)));

    if (frameIndex !== lastRenderedIndex || needsRepaint) {
      const frameToDraw = getClosestAvailableFrame(frameIndex);
      if (frameToDraw && renderFrame(frameToDraw)) {
        lastRenderedIndex = frameIndex;
        needsRepaint = false;
      }
    }

    requestAnimationFrame(loop);
  }

  // Load a single frame image
  function loadSingleImage(index) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = getFrameUrl(index);
      img.onload = () => {
        images[index] = img;
        loadedCount++;
        if (index === 0 && lastRenderedIndex === -1) {
          needsRepaint = true;
        }
        resolve(img);
      };
      img.onerror = () => {
        resolve(null);
      };
    });
  }

  // Preload frames with concurrency pool
  async function preloadAll() {
    // Frame 0 loaded first for zero delay
    await loadSingleImage(0);
    renderFrame(images[0]);
    lastRenderedIndex = 0;

    // Concurrently preload all remaining 239 frames
    const concurrency = 12;
    let nextIndex = 1;

    async function worker() {
      while (nextIndex < FRAME_COUNT) {
        const idx = nextIndex++;
        await loadSingleImage(idx);
      }
    }

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
  }

  // Listeners
  window.addEventListener('resize', updateCanvasSize, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });

  // Init
  updateCanvasSize();
  onScroll();
  preloadAll();
  requestAnimationFrame(loop);
})();
