// The scrolling ribbon is inspired by Saurabh Thapliyal's Reel-Flux:
// https://github.com/Saur0w/Reel-Flux
(() => {
  const reel = document.getElementById('photo-reel');
  const album = reel.querySelector('.reel-album');
  const stage = reel.querySelector('.reel-stage');
  const strip = reel.querySelector('.reel-strip');
  const canvas = stage.querySelector('canvas');
  const context = canvas.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const info = reel.querySelector('.reel-info');
  const status = reel.querySelector('.reel-status');
  const player = document.querySelector('.reel-player');
  const video = player.querySelector('video');
  const fallback = player.querySelector('.reel-player-fallback');
  const photos = Array.from(album.querySelectorAll('figure'), figure => {
    const image = figure.querySelector('img');
    return {
      image, focus: Number(image.dataset.reelFocus ?? 0.5),
      media: figure.querySelector('[data-play]'), caption: figure.querySelector('figcaption')
    };
  });
  if (!photos.length) return;

  const wrap = (n, length) => n - length * Math.floor(n / length);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const prints = [];
  let width, height, printWidth, printHeight, stride, pixelRatio;
  let position = 0;
  let target = 0;
  let bend = 0;
  let selected = -1;
  let frame = 0;
  let previousTime = 0;
  let drag = null;
  let wheelTimer = 0;
  let wheelStart = 0;
  let suppressClick = false;

  function addPrints() {
    for (const photo of photos) {
      const element = photo.media ? photo.media.cloneNode(true) : document.createElement('div');
      const image = photo.media ? element.querySelector('img') : photo.image.cloneNode();
      element.classList.add('reel-print');
      if (!photo.media) element.append(image);
      else { element.tabIndex = -1; element.draggable = false; }
      image.alt = '';
      image.loading = 'eager';
      if (!prints.length) image.fetchPriority = 'high';
      image.draggable = false;
      image.style.objectPosition = '50% ' + photo.focus * 100 + '%';
      image.addEventListener('load', schedule, { once: true });
      strip.append(element);
      prints.push({ photo, element, image, x: 0 });
    }
  }

  function measure() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    const size = prints[0].element.getBoundingClientRect();
    printWidth = size.width;
    printHeight = size.height;
    if (!printWidth || !height) return;
    stride = printWidth + Math.max(4, printWidth * 0.015);
    // Keep both edges covered even on an ultrawide screen or with a short album.
    while (photos.length > 1 && prints.length * stride < width + 2 * stride) addPrints();
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    schedule();
  }

  function updateCaption(index) {
    if (selected === index) return;
    selected = index;
    info.replaceChildren(...Array.from(photos[index].caption.children, node => node.cloneNode(true)));
  }

  // Every photograph samples the same wave in stage coordinates, including at a
  // wrap. Projecting its depth before drawing gives the ribbon its changing width.
  function projectedEdge(x) {
    const phase = x * 2 * Math.PI / (2.05 * stride);
    const wave = Math.sin(phase) * bend;
    const depth = Math.cos(phase) * bend * printHeight * 0.62;
    const camera = Math.max(width * 0.78, printWidth * 1.85);
    // Pull the view back slightly at speed so the crest fits inside the stage.
    const scale = camera / (camera * (1 + 0.14 * Math.abs(bend)) - depth);
    return {
      x: width / 2 + x * scale,
      y: height / 2 + wave * printHeight * 0.36 * scale,
      height: printHeight * scale * (1 + wave * 0.06)
    };
  }

  function drawCurvedPrint({ image, photo, x }) {
    const aspect = printWidth / printHeight;
    const cropWidth = Math.min(image.naturalWidth, image.naturalHeight * aspect);
    const cropHeight = Math.min(image.naturalHeight, image.naturalWidth / aspect);
    const cropX = (image.naturalWidth - cropWidth) / 2;
    const cropY = (image.naturalHeight - cropHeight) * photo.focus;
    const slices = Math.ceil(printWidth / 8);
    const sourceSlice = cropWidth / slices;
    let left = projectedEdge(x - printWidth / 2);

    for (let i = 0; i < slices; i++) {
      const right = projectedEdge(x + ((i + 1) / slices - 0.5) * printWidth);
      const span = right.x - left.x;
      if (span > 0 && right.x > 0 && left.x < width) {
        const h = (left.height + right.height) / 2;
        const slope = (right.y - left.y) / span;
        context.setTransform(pixelRatio, pixelRatio * slope, 0, pixelRatio,
          left.x * pixelRatio, (left.y - h / 2) * pixelRatio);
        // A subpixel overlap closes antialiasing seams between adjacent slices.
        const overlap = i + 1 < slices ? 0.8 / pixelRatio : 0;
        context.drawImage(image, cropX + i * sourceSlice, cropY, sourceSlice, cropHeight,
          0, 0, span + overlap, h);
      }
      left = right;
    }
  }

  function paint() {
    const half = prints.length / 2;
    for (const [i, print] of prints.entries()) {
      print.x = (wrap(i - position + half, prints.length) - half) * stride;
    }
    const visible = prints.filter(print => Math.abs(print.x) < width / 2 + printWidth);
    const curved = context && Math.abs(bend) > 0.012 &&
      visible.every(print => print.image.complete && print.image.naturalWidth > 0);
    canvas.hidden = !curved;
    strip.style.visibility = curved ? 'hidden' : '';
    if (curved) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      visible.forEach(drawCurvedPrint);
    } else {
      for (const { element, photo, x } of prints) {
        element.style.transform = 'translate(-50%, -50%) translateX(' + x + 'px)';
        if (photo.media) element.tabIndex = Math.abs(x) < stride / 2 ? 0 : -1;
      }
    }
    updateCaption(wrap(Math.round(position), photos.length));
  }

  function tick(now) {
    frame = 0;
    const elapsed = previousTime ? clamp(now - previousTime, 1, 40) : 16.7;
    previousTime = now;
    const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-elapsed / (drag?.moving ? 24 : 90));
    const step = (target - position) * ease;
    position += step;
    const speed = clamp(step / elapsed * 155, -1, 1);
    bend = reducedMotion.matches ? 0 : bend + (speed - bend) * (1 - Math.exp(-elapsed / 55));
    const settled = Math.abs(target - position) < 0.0005 && Math.abs(bend) < 0.003;
    if (settled) {
      position = target;
      bend = 0;
      previousTime = 0;
      if (!drag && !wheelTimer) position = target = wrap(target, photos.length);
    }
    paint();
    if (!settled) schedule();
    if (settled && !drag && !wheelTimer) {
      const announcement = (selected + 1) + ' / ' + photos.length + ' · ' + photos[selected].image.alt;
      if (status.textContent !== announcement) status.textContent = announcement;
    }
  }

  function schedule() {
    if (!frame && stride) frame = requestAnimationFrame(tick);
  }

  function stopWheel() {
    clearTimeout(wheelTimer);
    wheelTimer = 0;
  }

  function advance(steps) {
    if (photos.length < 2) return;
    stopWheel();
    target = Math.round(target) + steps;
    schedule();
  }

  stage.addEventListener('wheel', event => {
    if (event.ctrlKey || drag || photos.length < 2) return;
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? width : 1;
    if (!wheelTimer) wheelStart = Math.round(target);
    stopWheel();
    target += clamp(delta * unit * 1.55 / stride, -2.5, 2.5);
    wheelTimer = setTimeout(() => {
      wheelTimer = 0;
      const distance = target - wheelStart;
      target = Math.round(target);
      if (target === wheelStart && Math.abs(distance) > 0.12) target += Math.sign(distance);
      schedule();
    }, 150);
    schedule();
  }, { passive: false });

  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    stopWheel();
    suppressClick = false;
    target = position;
    drag = {
      id: event.pointerId, origin: position, x: event.clientX, y: event.clientY,
      lastX: event.clientX, lastTime: event.timeStamp, speed: 0, moving: false
    };
    // Preserve the native link target on a tap, including in touch browsers.
    (event.target.closest('[data-play]') || stage).setPointerCapture(event.pointerId);
  });

  stage.addEventListener('pointermove', event => {
    if (event.pointerId !== drag?.id) return;
    const distance = drag.x - event.clientX;
    if (Math.hypot(distance, event.clientY - drag.y) > 6) suppressClick = true;
    if (!drag.moving) {
      if (Math.abs(distance) < Math.max(4, Math.abs(event.clientY - drag.y))) return;
      drag.moving = true;
      suppressClick = true;
      stage.classList.add('is-dragging');
    }
    drag.speed = (drag.lastX - event.clientX) / Math.max(8, event.timeStamp - drag.lastTime);
    drag.lastX = event.clientX;
    drag.lastTime = event.timeStamp;
    target = drag.origin + distance / stride;
    schedule();
  });

  function endDrag(event) {
    if (event.pointerId !== drag?.id) return;
    if (event.type !== 'pointerup') {
      suppressClick = true;
      target = Math.round(position);
    } else if (drag.moving) {
      const speed = event.timeStamp - drag.lastTime < 100 && !reducedMotion.matches ? drag.speed : 0;
      target = Math.round(target + clamp(speed * 140 / stride, -1.75, 1.75));
    } else {
      target = Math.round(position);
    }
    drag = null;
    stage.classList.remove('is-dragging');
    schedule();
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stage.addEventListener(event, endDrag);
  }

  stage.addEventListener('dragstart', event => event.preventDefault());
  stage.addEventListener('click', event => {
    const link = event.target.closest('[data-play]');
    if (!link) return;
    if (event.detail && suppressClick) { event.preventDefault(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const print = prints.find(item => item.element === link);
    stopWheel();
    position = target = photos.indexOf(print.photo);
    bend = 0;
    schedule();
    if (link.dataset.play !== 'file' || typeof player.showModal !== 'function') return;
    event.preventDefault();
    player.querySelector('h2').textContent = print.photo.caption.querySelector('h2').textContent;
    fallback.href = video.src = link.href;
    fallback.hidden = true;
    video.poster = print.photo.image.src;
    player.showModal();
    // Start synchronously in the tap gesture so mobile browsers allow playback.
    video.play().catch(() => { if (player.open && video.error) fallback.hidden = false; });
  });
  video.addEventListener('error', () => { if (player.open) fallback.hidden = false; });
  player.querySelector('button').addEventListener('click', () => player.close());
  player.addEventListener('click', event => { if (event.target === player) player.close(); });
  player.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    stage.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', event => {
    if (player.open || drag || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target !== document.body && !stage.contains(event.target)) return;
    if ((event.key === 'Enter' || event.key === ' ') && event.target === stage) {
      const media = strip.querySelector('[data-play][tabindex="0"]');
      if (media) { event.preventDefault(); media.click(); }
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    advance(event.key === 'ArrowLeft' ? -1 : 1);
  });

  addPrints();
  album.hidden = true;
  stage.hidden = info.hidden = false;
  measure();
  window.addEventListener('resize', measure);
  reducedMotion.addEventListener('change', schedule);
})();
