(() => {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Header: solid background after scrolling */
  const header = $('[data-header]');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Mobile menu */
  const menuBtn = $('[data-menu-btn]');
  const nav = $('#site-nav');
  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    $('.sr-only', menuBtn).textContent = open ? 'Close menu' : 'Open menu';
    nav.classList.toggle('is-open', open);
    root.classList.toggle('menu-open', open);
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
  });
  matchMedia('(min-width: 861px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* Hero slideshow: crossfades to the next photo every few seconds */
  const slidesWrap = $('[data-hero-slides]');
  const moreSlides = $('[data-hero-more]');
  const heroControls = $('[data-hero-controls]');

  const startSlideshow = () => {
    slidesWrap.append(moreSlides.content.cloneNode(true)); // extra photos load only after the page is ready
    const slides = $$('.hero__slide', slidesWrap);
    const heroWords = $$('.hero__word');
    const dotsWrap = $('.hero__dots', heroControls);
    const pauseBtn = $('[data-hero-pause]', heroControls);
    const DELAY = 6000;
    let current = 0;
    let timer = null;
    let playing = !reduceMotion; // people who turn off animations can still switch photos by hand

    const go = (i) => {
      if (i === current) return;
      const img = $('img', slides[i]);
      if (!img.complete) { img.addEventListener('load', () => go(i), { once: true }); return; }
      const prev = slides[current];
      const next = slides[i];
      prev.classList.add('is-leaving');
      prev.classList.remove('is-active');
      prev.setAttribute('aria-hidden', 'true');
      next.classList.remove('is-leaving');
      next.classList.add('is-active');
      next.removeAttribute('aria-hidden');
      setTimeout(() => prev.classList.remove('is-leaving'), 1700);
      dots[current].setAttribute('aria-pressed', 'false');
      dots[i].setAttribute('aria-pressed', 'true');
      heroWords.forEach((w) => w.classList.toggle('is-lit', w.dataset.word === next.dataset.word));
      current = i;
    };

    const restart = () => {
      clearInterval(timer);
      timer = playing && !document.hidden ? setInterval(() => go((current + 1) % slides.length), DELAY) : null;
    };

    const dots = slides.map((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'hero__dot';
      dot.setAttribute('aria-label', `Show photo ${i + 1} of ${slides.length}`);
      dot.setAttribute('aria-pressed', String(i === 0));
      dot.addEventListener('click', () => { go(i); restart(); });
      dotsWrap.append(dot);
      return dot;
    });

    const setPlaying = (on) => {
      playing = on;
      pauseBtn.setAttribute('aria-label', on ? 'Pause slideshow' : 'Play slideshow');
      $('use', pauseBtn).setAttribute('href', on ? '#i-pause' : '#i-play');
      restart();
    };
    pauseBtn.addEventListener('click', () => setPlaying(!playing));
    document.addEventListener('visibilitychange', restart); // stop while the tab is in the background

    heroControls.hidden = false;
    setPlaying(playing);
  };

  if (slidesWrap && moreSlides && heroControls) {
    if (document.readyState === 'complete') startSlideshow();
    else addEventListener('load', startSlideshow, { once: true });
  }

  /* Gallery: filters + "show more" */
  const gallery = $('[data-gallery]');
  const shots = $$('.shot', gallery);
  const filterBtns = $$('[data-filter]');
  const moreBtn = $('[data-more]');
  const STEP = 50; // photos shown at first, and added per "Show more" click
  let filter = 'all';
  let limit = STEP;

  const matching = () => shots.filter((s) => filter === 'all' || s.dataset.cat === filter);

  const render = () => {
    const list = matching();
    shots.forEach((s) => { s.hidden = true; });
    list.forEach((s, i) => { s.hidden = i >= limit; });
    moreBtn.hidden = list.length <= limit;
  };

  filterBtns.forEach((btn) => btn.addEventListener('click', () => {
    filter = btn.dataset.filter;
    limit = STEP;
    filterBtns.forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    render();
  }));

  moreBtn.addEventListener('click', () => {
    const firstNew = limit;
    limit += STEP;
    render();
    const next = matching()[firstNew];
    if (next) $('a', next).focus({ preventScroll: true });
  });

  render();

  /* Lightbox */
  const lb = $('[data-lightbox]');
  const lbImg = $('.lb-img', lb);
  const lbCount = $('.lb-count', lb);
  const lbCaption = $('.lb-caption', lb);
  let viewList = [];
  let index = 0;

  const fullSrc = (shot) => $('a', shot).getAttribute('href');

  const show = (i) => {
    index = (i + viewList.length) % viewList.length;
    const shot = viewList[index];
    const alt = $('img', shot).alt;
    lbImg.classList.add('is-loading');
    lbImg.onload = () => lbImg.classList.remove('is-loading');
    lbImg.src = fullSrc(shot);
    lbImg.alt = alt;
    lbCaption.textContent = alt;
    lbCount.textContent = `${index + 1} / ${viewList.length}`;
    // Preload neighbours so next/previous feel instant
    [index + 1, index - 1].forEach((j) => {
      const n = viewList[(j + viewList.length) % viewList.length];
      if (n) new Image().src = fullSrc(n);
    });
  };

  gallery.addEventListener('click', (e) => {
    const link = e.target.closest('.shot a');
    if (!link || typeof lb.showModal !== 'function') return; // no <dialog> support: open the image itself
    e.preventDefault();
    viewList = matching();
    show(viewList.indexOf(link.closest('.shot')));
    lb.showModal();
    root.classList.add('lb-open');
  });

  lb.addEventListener('close', () => {
    root.classList.remove('lb-open');
    const shot = viewList[index];
    if (!shot) return;
    // If the viewer went past the photos shown in the grid, reveal up to that photo
    const pos = matching().indexOf(shot);
    if (pos >= limit) { limit = Math.ceil((pos + 1) / STEP) * STEP; render(); }
    $('a', shot).focus({ preventScroll: true });
    shot.scrollIntoView({ block: 'nearest' });
  });

  $('.lb-prev', lb).addEventListener('click', () => show(index - 1));
  $('.lb-next', lb).addEventListener('click', () => show(index + 1));
  $('.lb-close', lb).addEventListener('click', () => lb.close());

  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
  });

  // Swipe left/right on phones; tap outside the photo to close
  let startX = null;
  let swiped = false;
  lb.addEventListener('pointerdown', (e) => { startX = e.clientX; swiped = false; });
  lb.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) { swiped = true; show(index + (dx < 0 ? 1 : -1)); }
  });
  lb.addEventListener('click', (e) => {
    if (swiped) { swiped = false; return; }
    if (e.target === lb || e.target.classList.contains('lb-figure')) lb.close();
  });

  /* Floating call button: show on phones once the hero is out of view, hide near Contact */
  const fab = $('[data-fab]');
  if (fab && 'IntersectionObserver' in window) {
    let heroVisible = true;
    let contactVisible = false;
    const update = () => fab.classList.toggle('is-visible', !heroVisible && !contactVisible);
    new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; update(); }).observe($('.hero'));
    new IntersectionObserver(([e]) => { contactVisible = e.isIntersecting; update(); }, { threshold: 0.2 }).observe($('#contact'));
  }

  /* Footer year */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
