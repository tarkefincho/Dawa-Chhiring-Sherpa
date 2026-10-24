const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.site-header nav');
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  navigation.classList.toggle('is-open', open);
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  navigation.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation');
}));

const heroMontagePlayers = [...document.querySelectorAll('.hero-montage')];
// Project videos are included automatically; these two extra clips are montage-only.
const montageOnlyClips = [
  'media/homepage-montage-video-project-5.mp4',
  'media/homepage-montage-video-project-4.mp4'
];
const montageClips = [...new Set([
  ...[...document.querySelectorAll('.art-video source[src], .project-video-preview video source[src]')]
    .map(source => source.getAttribute('src'))
    .filter(src => src && /^media\//i.test(src) && /\.mp4(?:[?#].*)?$/i.test(src)),
  ...montageOnlyClips
])];
let montageQueue = [];
let lastPlayedMontageClip = '';
let montageCycleFirstClip = '';
let activeMontage = null;
let standbyMontage = null;
let transitionDue = false;
let montageTimer = null;
function nextMontageClip() {
  if (!montageQueue.length) {
    montageQueue = [...montageClips];
    for (let i = montageQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [montageQueue[i], montageQueue[j]] = [montageQueue[j], montageQueue[i]];
    }
    // Keep the cycle boundary distinct: its first clip cannot match the last clip shown.
    if (montageQueue.length > 1 && montageQueue[0] === lastPlayedMontageClip) {
      [montageQueue[0], montageQueue[1]] = [montageQueue[1], montageQueue[0]];
    }
    montageCycleFirstClip = montageQueue[0] || '';
    // The unique source list also keeps the first and last clips within this cycle distinct.
    if (montageQueue.length > 1 && montageQueue[montageQueue.length - 1] === montageCycleFirstClip) {
      [montageQueue[montageQueue.length - 1], montageQueue[montageQueue.length - 2]] = [montageQueue[montageQueue.length - 2], montageQueue[montageQueue.length - 1]];
    }
  }
  const avoidClip = lastPlayedMontageClip || activeMontage?.clip;
  if (montageQueue.length > 1 && montageQueue[0] === avoidClip) {
    const nextDifferent = montageQueue.findIndex(clip => clip !== avoidClip);
    if (nextDifferent > 0) [montageQueue[0], montageQueue[nextDifferent]] = [montageQueue[nextDifferent], montageQueue[0]];
  }
  return montageQueue.shift();
}
function prepareMontageMoment(playerIndex) {
  return new Promise((resolve, reject) => {
    const heroMontage = heroMontagePlayers[playerIndex];
    const clip = nextMontageClip();
    heroMontage.pause();
    heroMontage.classList.remove('is-active');
    heroMontage.loop = true;
    heroMontage.muted = true;
    heroMontage.defaultMuted = true;
    heroMontage.volume = 0;
    heroMontage.addEventListener('error', () => reject(new Error(`Could not load ${clip}`)), { once: true });
    heroMontage.addEventListener('loadedmetadata', () => {
      const duration = Number.isFinite(heroMontage.duration) ? heroMontage.duration : 0;
      // Each montage moment stays visible for at least two seconds.
      const segmentLength = Math.max(2, Math.min(5, duration * .3));
      const latestStart = Math.max(0, duration - segmentLength - .1);
      const startAt = Math.random() * latestStart;
      const ready = () => resolve({ player: heroMontage, playerIndex, segmentLength, clip });
      if (startAt > .15) {
        heroMontage.addEventListener('seeked', ready, { once: true });
        heroMontage.currentTime = startAt;
      } else ready();
    }, { once: true });
    heroMontage.src = clip;
    heroMontage.load();
  });
}
function prepareMontageStandby(playerIndex) {
  prepareMontageMoment(playerIndex)
    .then(prepared => {
      standbyMontage = prepared;
      if (transitionDue) transitionMontage();
    })
    .catch(() => setTimeout(() => prepareMontageStandby(playerIndex), 1000));
}
async function playMontageFrame(player) {
  await player.play();
  if (typeof player.requestVideoFrameCallback === 'function') {
    await new Promise(resolve => player.requestVideoFrameCallback(() => resolve()));
  } else if (player.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await new Promise(resolve => player.addEventListener('playing', resolve, { once: true }));
  }
}
function waitForMontageFade() {
  return new Promise(resolve => setTimeout(resolve, 900));
}
async function startMontageMoment(moment) {
  try {
    await playMontageFrame(moment.player);
    moment.player.classList.add('is-active');
    activeMontage = moment;
    lastPlayedMontageClip = moment.clip;
    standbyMontage = null;
    transitionDue = false;
    clearTimeout(montageTimer);
    montageTimer = setTimeout(transitionMontage, moment.segmentLength * 1000);
    prepareMontageStandby(1 - moment.playerIndex);
  } catch {
    setTimeout(beginMontage, 1000);
  }
}
let transitionRunning = false;
async function transitionMontage() {
  transitionDue = true;
  if (transitionRunning || !standbyMontage || !activeMontage) return;
  transitionRunning = true;
  const previous = activeMontage;
  const next = standbyMontage;
  try {
    // Decode the incoming shot before starting a crossfade, so the hero background never flashes through.
    await playMontageFrame(next.player);
    next.player.pause();
    await next.player.play();
    previous.player.classList.remove('is-active');
    next.player.classList.add('is-active');
    await waitForMontageFade();
    previous.player.pause();
    activeMontage = next;
    lastPlayedMontageClip = next.clip;
    standbyMontage = null;
    transitionDue = false;
    clearTimeout(montageTimer);
    montageTimer = setTimeout(transitionMontage, next.segmentLength * 1000);
    prepareMontageStandby(previous.playerIndex);
  } catch {
    // Restore the current shot and retry after a longer hold if the next clip is not ready.
    previous.player.classList.add('is-active');
    previous.player.play().catch(() => {});
    setTimeout(transitionMontage, 1000);
  }
  transitionRunning = false;
}
async function beginMontage() {
  try {
    const first = await prepareMontageMoment(0);
    await startMontageMoment(first);
  } catch { setTimeout(beginMontage, 1500); }
}
beginMontage();

const dialog = document.querySelector('.project-dialog');
const closeButton = document.querySelector('.dialog-close');
let homeScrollPosition = 0;
let activeProjectOpener = null;
const projectCatalog = {
  arctic: { title: 'Arctic Shelter', kind: 'FEATURED PROJECT · ENVIRONMENT DESIGN' },
  echoes: { title: 'Echoes of Tomorrow', kind: 'FEATURED PROJECT · ENVIRONMENT DESIGN' },
  shrine: { title: 'The Shrine', kind: '3D ENVIRONMENT · AUTODESK MAYA' },
  mountain: { title: 'Under the Mountain', kind: 'ENVIRONMENT DESIGN · UNREAL ENGINE' }
};
function openProjectDialog(projectId, title, kind, opener = null) {
  // Remember the page position for every project, including projects added later.
  homeScrollPosition = window.scrollY;
  activeProjectOpener = opener;
  document.querySelector('#dialog-title').textContent = title;
  document.querySelector('#dialog-kind').textContent = kind;
  document.querySelectorAll('[data-project-detail]').forEach(section => {
    section.hidden = section.dataset.projectDetail !== projectId;
  });
  if (projectId === 'echoes') {
    const fiveSecondPreview = dialog.querySelector('[data-thumbnail-time="5"]');
    if (fiveSecondPreview.readyState >= 1) {
      fiveSecondPreview.pause();
      fiveSecondPreview.currentTime = Math.min(5, Math.max(0, fiveSecondPreview.duration - 0.1));
    }
  }
  dialog.classList.toggle('project-dialog--echoes', projectId === 'echoes');
  dialog.classList.toggle('project-dialog--shrine', projectId === 'shrine');
  dialog.classList.toggle('project-dialog--mountain', projectId === 'mountain');
  opener?.setAttribute('aria-expanded', 'true');
  document.querySelectorAll('.art-video').forEach(video => {
    video.pause();
    setPreviewControl(video.closest('.art').querySelector('.thumb-video-toggle'), false);
  });
  document.body.classList.add('project-dialog-open');
  dialog.showModal();
  // Every project opens at the beginning, even if the dialog was previously scrolled.
  dialog.scrollTop = 0;
  requestAnimationFrame(() => { dialog.scrollTop = 0; });
}
document.querySelectorAll('.project-open[data-project-id], .featured-project-title[data-project-id]').forEach(button => button.addEventListener('click', () => {
  openProjectDialog(button.dataset.projectId, button.dataset.title, button.dataset.kind, button);
}));
const linkedProjectId = location.hash.match(/^#project-(arctic|echoes|shrine|mountain)$/)?.[1];
if (linkedProjectId && projectCatalog[linkedProjectId]) {
  const project = projectCatalog[linkedProjectId];
  openProjectDialog(linkedProjectId, project.title, project.kind);
}
closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => {
  activeProjectOpener?.setAttribute('aria-expanded', 'false');
  dialog.querySelectorAll('.project-video-preview video').forEach(video => {
    video.pause();
    const control = video.nextElementSibling;
    setProjectVideoControl(control, false);
    if (video.dataset.thumbnailTime && video.readyState >= 1) {
      delete video.dataset.playStarted;
      video.currentTime = Math.min(Number(video.dataset.thumbnailTime), Math.max(0, video.duration - 0.1));
    }
  });
  document.body.classList.remove('project-dialog-open');
  let archiveReturn = null;
  try {
    archiveReturn = JSON.parse(sessionStorage.getItem('portfolioProjectReturn') || 'null');
    sessionStorage.removeItem('portfolioProjectReturn');
  } catch { /* Ignore unavailable session storage and restore the current page normally. */ }
  if (archiveReturn?.url) {
    sessionStorage.setItem('portfolioArchiveRestore', JSON.stringify(archiveReturn));
    location.assign(archiveReturn.url);
    return;
  }
  // Native dialogs can otherwise restore focus by scrolling the opener into view.
  // Restore the exact position after that focus restoration has completed.
  requestAnimationFrame(() => window.scrollTo({ top: homeScrollPosition, behavior: 'instant' }));
});

function setPreviewControl(control, playing) {
  const name = control.dataset.projectName || 'project';
  const action = playing ? 'Pause' : 'Play';
  control.innerHTML = `<span class="thumb-video-symbol" aria-hidden="true">${playing ? 'Ⅱ' : '▶'}</span><span class="sr-only">${action} ${name} preview</span>`;
  control.setAttribute('aria-label', `${action} ${name} preview`);
  control.setAttribute('aria-pressed', String(playing));
  control.closest('.art').classList.toggle('is-playing', playing);
}
document.querySelectorAll('.thumb-video-toggle').forEach(control => {
  const thumbnailVideo = control.closest('.art').querySelector('.art-video');
  control.addEventListener('click', async () => {
    if (thumbnailVideo.paused) {
      try { await thumbnailVideo.play(); setPreviewControl(control, true); }
      catch { setPreviewControl(control, false); }
    } else {
      thumbnailVideo.pause();
      setPreviewControl(control, false);
    }
  });
  thumbnailVideo.addEventListener('ended', () => setPreviewControl(control, false));
});

// Use the requested moment from the alleyway clip as its paused in-window preview.
document.querySelectorAll('video[data-thumbnail-time]').forEach(video => {
  const seekToPreview = () => {
    video.pause();
    video.currentTime = Math.min(Number(video.dataset.thumbnailTime), Math.max(0, video.duration - 0.1));
  };
  video.addEventListener('loadedmetadata', seekToPreview, { once: true });
  video.addEventListener('seeked', () => { video.dataset.thumbnailReady = 'true'; });
  video.addEventListener('play', () => {
    if (video.dataset.thumbnailReady === 'true' && video.dataset.playStarted !== 'true') {
      video.dataset.playStarted = 'true';
      video.currentTime = 0;
    }
  });
});

function setProjectVideoControl(control, playing) {
  if (!control) return;
  const action = playing ? 'Pause' : 'Play';
  control.innerHTML = `<span class="thumb-video-symbol" aria-hidden="true">${playing ? 'Ⅱ' : '▶'}</span>`;
  control.setAttribute('aria-label', `${action} video`);
  control.setAttribute('aria-pressed', String(playing));
  control.closest('.project-video-preview').classList.toggle('is-playing', playing);
}
function formatVideoTime(value) {
  if (!Number.isFinite(value)) return '0:00';
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}
document.querySelectorAll('.project-video-preview').forEach(preview => {
  const video = preview.querySelector('video');
  const control = preview.querySelector('.project-video-toggle');
  const seek = preview.querySelector('.video-seek');
  const time = preview.querySelector('.video-time');
  const muteButton = preview.querySelector('.video-mute-toggle');
  const volumeSlider = preview.querySelector('.video-volume');
  const updateNavigation = () => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    seek.max = String(duration);
    seek.value = String(video.currentTime || 0);
    time.textContent = `${formatVideoTime(video.currentTime || 0)} / ${formatVideoTime(duration)}`;
  };
  video.addEventListener('loadedmetadata', updateNavigation);
  video.addEventListener('durationchange', updateNavigation);
  video.addEventListener('timeupdate', updateNavigation);
  seek.addEventListener('input', () => {
    video.currentTime = Number(seek.value);
    time.textContent = `${formatVideoTime(Number(seek.value))} / ${formatVideoTime(video.duration)}`;
  });
  const updateAudioControls = () => {
    const muted = video.muted || video.volume === 0;
    const waves = '<path class="sound-waves" d="M16 9a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12"/>';
    const muteMark = '<path d="m16 9 5 6m0-6-5 6"/>';
    muteButton.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/>${muted ? muteMark : waves}</svg>`;
    muteButton.setAttribute('aria-label', muted ? 'Unmute video' : 'Mute video');
    muteButton.setAttribute('aria-pressed', String(muted));
    volumeSlider.value = muted ? '0' : String(video.volume);
  };
  muteButton.addEventListener('click', event => {
    event.stopPropagation();
    if (video.muted || video.volume === 0) {
      video.muted = false;
      if (video.volume === 0) video.volume = 0.5;
    } else video.muted = true;
    updateAudioControls();
  });
  volumeSlider.addEventListener('input', () => {
    video.volume = Number(volumeSlider.value);
    video.muted = video.volume === 0;
    updateAudioControls();
  });
  video.addEventListener('volumechange', updateAudioControls);
  const togglePlayback = async () => {
    if (video.paused) {
      try { await video.play(); }
      catch { setProjectVideoControl(control, false); }
    } else video.pause();
  };
  let clickDelay = null;
  video.addEventListener('click', () => {
    if (clickDelay) {
      clearTimeout(clickDelay);
      clickDelay = null;
      return;
    }
    clickDelay = setTimeout(() => { clickDelay = null; togglePlayback(); }, 230);
  });
  video.addEventListener('dblclick', event => {
    event.preventDefault();
    if (clickDelay) clearTimeout(clickDelay);
    clickDelay = null;
    toggleFullscreen();
  });
  video.addEventListener('keydown', event => {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      togglePlayback();
    }
  });
  control.addEventListener('click', togglePlayback);
  const fullscreenButton = preview.querySelector('.video-fullscreen-toggle');
  const isFullscreen = () => document.fullscreenElement === preview || document.fullscreenElement === video ||
    document.webkitFullscreenElement === preview || document.webkitFullscreenElement === video ||
    video.webkitDisplayingFullscreen === true;
  const updateFullscreenButton = () => {
    const full = isFullscreen();
    const enterIcon = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>';
    const exitIcon = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4l6 6M6 10h4V6M20 20l-6-6m4 0h-4v4"/></svg>';
    fullscreenButton.innerHTML = full ? exitIcon : enterIcon;
    fullscreenButton.setAttribute('aria-label', full ? 'Exit full screen' : 'View video full screen');
    fullscreenButton.title = full ? 'Exit full screen' : 'View video full screen';
  };
  const toggleFullscreen = async () => {
    try {
      if (isFullscreen()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (video.webkitExitFullscreen) video.webkitExitFullscreen();
      } else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else if (preview.requestFullscreen) await preview.requestFullscreen();
      else if (video.requestFullscreen) await video.requestFullscreen();
    } catch { /* Fullscreen can be unavailable in some embedded browser contexts. */ }
    updateFullscreenButton();
  };
  fullscreenButton.addEventListener('click', event => { event.stopPropagation(); toggleFullscreen(); });
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
  video.addEventListener('webkitbeginfullscreen', updateFullscreenButton);
  video.addEventListener('webkitendfullscreen', updateFullscreenButton);
  let controlsTimer = null;
  const hideNavigation = () => preview.classList.remove('controls-visible');
  const revealNavigation = () => {
    preview.classList.add('controls-visible');
    clearTimeout(controlsTimer);
    if (!video.paused) controlsTimer = setTimeout(hideNavigation, 1400);
  };
  preview.addEventListener('pointermove', revealNavigation);
  preview.addEventListener('pointerdown', revealNavigation);
  preview.addEventListener('pointerleave', hideNavigation);
  video.addEventListener('play', () => {
    clearTimeout(controlsTimer);
    hideNavigation();
    setProjectVideoControl(control, true);
  });
  video.addEventListener('pause', () => {
    setProjectVideoControl(control, false);
    if (preview.matches(':hover')) revealNavigation();
  });
  video.addEventListener('ended', () => setProjectVideoControl(control, false));
  updateFullscreenButton();
  updateAudioControls();
});

const lightbox = document.querySelector('.image-lightbox');
const lightboxImage = document.querySelector('#lightbox-image');
const homePhotoGrid = document.querySelector('.photography-grid');
const homePhotoTiles = homePhotoGrid ? [...homePhotoGrid.querySelectorAll('.photo-tile')] : [];
let lastHomePhotoSet = '';
function homePhotoColumnCount() {
  return window.matchMedia('(max-width: 520px)').matches ? 1
    : window.matchMedia('(max-width: 900px)').matches ? 2 : 3;
}
function alignHomePhotoFinalRow(visibleTiles) {
  if (!homePhotoGrid) return;
  const columns = homePhotoColumnCount();
  const visibleSet = new Set(visibleTiles);
  homePhotoTiles.forEach(tile => tile.classList.toggle('photo-grid-final-row', visibleSet.has(tile) && visibleTiles.indexOf(tile) >= visibleTiles.length - columns));
}
async function getHomePhotoAspect(tile) {
  const image = tile.querySelector('img');
  if (image.naturalWidth && image.naturalHeight) return image.naturalWidth / image.naturalHeight;
  const probe = new Image();
  probe.src = image.currentSrc || image.src;
  try {
    if (probe.decode) await probe.decode();
    else await new Promise((resolve, reject) => { probe.onload = resolve; probe.onerror = reject; });
  } catch {}
  return probe.naturalWidth && probe.naturalHeight ? probe.naturalWidth / probe.naturalHeight : 1;
}
async function shuffleHomePhotos() {
  if (homePhotoTiles.length <= 8) return;
  const columns = homePhotoColumnCount();
  const visiblePhotoCount = Math.min(9, homePhotoTiles.length);
  const aspectEntries = await Promise.all(homePhotoTiles.map(async tile => ({ tile, aspect: await getHomePhotoAspect(tile) })));
  const portraits = aspectEntries.filter(entry => entry.aspect < 1);
  const landscapes = aspectEntries.filter(entry => entry.aspect >= 1);
  const pickRandom = (entries, count) => {
    const pool = [...entries];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  };
  let selected = [...pickRandom(portraits, 3), ...pickRandom(landscapes, 6)];
  if (selected.length < visiblePhotoCount) {
    const selectedTiles = new Set(selected.map(entry => entry.tile));
    selected.push(...pickRandom(aspectEntries.filter(entry => !selectedTiles.has(entry.tile)), visiblePhotoCount - selected.length));
  }
  let setKey = `${visiblePhotoCount}|${selected.map(entry => entry.tile.querySelector('img').src).sort().join('|')}`;
  if (setKey === lastHomePhotoSet) {
    selected = [...pickRandom(portraits, 3), ...pickRandom(landscapes, 6)];
    setKey = `${visiblePhotoCount}|${selected.map(entry => entry.tile.querySelector('img').src).sort().join('|')}`;
  }
  lastHomePhotoSet = setKey;
  const ordered = [];
  for (let index = 0; index < selected.length; index += columns) {
    const row = selected.slice(index, index + columns);
    for (let i = row.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [row[i], row[j]] = [row[j], row[i]];
    }
    ordered.push(...row.map(entry => entry.tile));
  }
  homePhotoTiles.forEach(tile => { tile.hidden = true; });
  ordered.forEach((tile, index) => {
    homePhotoGrid.append(tile);
    tile.hidden = index >= visiblePhotoCount;
  });
  const finalRowSize = visiblePhotoCount % columns || columns;
  alignHomePhotoFinalRow(ordered.slice(visiblePhotoCount - finalRowSize));
}
if (homePhotoGrid) window.addEventListener('resize', () => alignHomePhotoFinalRow([...homePhotoGrid.querySelectorAll('.photo-tile:not([hidden])')]));
function scheduleHomePhotoShuffle() {
  window.setTimeout(async () => {
    if (!lightbox?.open) await shuffleHomePhotos();
    scheduleHomePhotoShuffle();
  }, 12000);
}
shuffleHomePhotos().finally(scheduleHomePhotoShuffle);
let activeGalleryButtons = [];
let activeGalleryIndex = 0;
function showGalleryImage(index) {
  if (!activeGalleryButtons.length) return;
  activeGalleryIndex = (index + activeGalleryButtons.length) % activeGalleryButtons.length;
  const button = activeGalleryButtons[activeGalleryIndex];
  lightboxImage.src = button.dataset.fullImage;
  lightboxImage.alt = button.dataset.imageAlt;
  const showArrows = activeGalleryButtons.length > 1;
  document.querySelector('.lightbox-prev').hidden = !showArrows;
  document.querySelector('.lightbox-next').hidden = !showArrows;
}
document.querySelectorAll('.media-zoom').forEach(button => button.addEventListener('click', () => {
  const group = button.closest('.gallery-grid, .photography-grid, .breakdown-grid, .echoes-image, .shrine-image') || button.parentElement;
  activeGalleryButtons = [...group.querySelectorAll('.media-zoom')];
  showGalleryImage(activeGalleryButtons.indexOf(button));
  lightbox.showModal();
}));
document.querySelector('.lightbox-prev').addEventListener('click', () => showGalleryImage(activeGalleryIndex - 1));
document.querySelector('.lightbox-next').addEventListener('click', () => showGalleryImage(activeGalleryIndex + 1));
lightbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') { event.preventDefault(); showGalleryImage(activeGalleryIndex - 1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); showGalleryImage(activeGalleryIndex + 1); }
});
document.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
