/* Stallion Developments — scroll film engine (home page only) */

gsap.registerPlugin(ScrollTrigger);

const GROUND = "#161b14";          // matches --cream
const FRAME_RADIUS = 16;           // css px, rounded card edge on the film
const HEADER_H = 84;               // css px, keeps the card clear of the fixed header

/* ——— Film sources + timeline ———
   The film is a list of frame sources (the original deconstruction plus the
   generated cutaways from tools/kie.py) and a timeline of segments that map
   scroll progress onto frames. Segment lengths are relative "units"; they are
   normalised to 0..1 at load, so adding a clip never breaks the others.
   Text sections in index.html reference segments by id: data-seg="clip1:0.15,clip1:0.95". */
const SOURCES = {
  film:     { dir: "frames",          prefix: "frame_", count: 246 }, // 6 clips @12fps
  bedroom:  { dir: "frames/bedroom",  prefix: "br_",    count: 61  }, // cutaway: rise into the upper floor
  backyard: { dir: "frames/backyard", prefix: "by_",    count: 61  }, // cutaway: through the frame to the yard
  glow:     { dir: "frames/glow",     prefix: "gl_",    count: 61  }, // ending: dusk, windows warm up
};
const FILES = [];
const OFFSET = {};
for (const [key, src] of Object.entries(SOURCES)) {
  OFFSET[key] = FILES.length;
  for (let i = 0; i < src.count; i++) FILES.push(`${src.dir}/${src.prefix}${String(i + 1).padStart(4, "0")}.webp`);
}
const F = (src, i) => OFFSET[src] + i;
const FRAME_COUNT = FILES.length;
const framePath = (i) => FILES[i];

/* Original clip frame ranges (0-based): 1:0–36  2:37–73  3:74–110  4:111–147  5:148–184  6:185–245 */
const TIMELINE = [
  { id: "hero",   units: 0.9,  f0: F("film", 0),   f1: F("film", 0)   }, // hero hold — the finished home
  { id: "clip1",  units: 1.0,  f0: F("film", 0),   f1: F("film", 36)  }, // roof lifts
  { id: "hold1",  units: 0.15, f0: F("film", 36),  f1: F("film", 36)  },
  { id: "clip2",  units: 1.0,  f0: F("film", 37),  f1: F("film", 73)  }, // upper floor strips
  { id: "hold2",  units: 0.1,  f0: F("film", 73),  f1: F("film", 73)  },
  { id: "brfwd",  units: 0.9,  f0: F("bedroom", 0),  f1: F("bedroom", 60)  }, // rise into the bedroom
  { id: "brhold", units: 0.5,  f0: F("bedroom", 60), f1: F("bedroom", 60)  },
  { id: "brrev",  units: 0.6,  f0: F("bedroom", 60), f1: F("bedroom", 0)   }, // and back out
  { id: "hold2b", units: 0.1,  f0: F("film", 73),  f1: F("film", 73)  },
  { id: "clip3",  units: 1.0,  f0: F("film", 74),  f1: F("film", 110) }, // ground floor strips
  { id: "hold3",  units: 0.1,  f0: F("film", 110), f1: F("film", 110) },
  { id: "byfwd",  units: 0.9,  f0: F("backyard", 0),  f1: F("backyard", 60) }, // through the frame to the yard
  { id: "byhold", units: 0.5,  f0: F("backyard", 60), f1: F("backyard", 60) },
  { id: "byrev",  units: 0.6,  f0: F("backyard", 60), f1: F("backyard", 0)  }, // and back out
  { id: "hold3b", units: 0.1,  f0: F("film", 110), f1: F("film", 110) },
  { id: "clip4",  units: 1.0,  f0: F("film", 111), f1: F("film", 147) }, // down to the lot
  { id: "hold4",  units: 0.15, f0: F("film", 147), f1: F("film", 147) },
  { id: "clip5",  units: 1.0,  f0: F("film", 148), f1: F("film", 184) }, // it rebuilds
  { id: "hold5",  units: 0.15, f0: F("film", 184), f1: F("film", 184) },
  { id: "clip6",  units: 1.2,  f0: F("film", 185), f1: F("film", 245) }, // rise to aerial
  { id: "glow",   units: 0.9,  f0: F("glow", 0),   f1: F("glow", 60)  }, // dusk, windows warm up
  { id: "end",    units: 0.3,  f0: F("glow", 60),  f1: F("glow", 60)  },
];
{
  const total = TIMELINE.reduce((a, s) => a + s.units, 0);
  let acc = 0;
  for (const s of TIMELINE) { s.p0 = acc / total; acc += s.units; s.p1 = acc / total; }
}
const SEG = Object.fromEntries(TIMELINE.map((s) => [s.id, s]));
/* "clip1:0.15" → progress 15% of the way into segment clip1 */
function at(ref) {
  const [id, frac] = ref.trim().split(":");
  const s = SEG[id];
  if (!s) { console.warn("unknown segment", id); return 0; }
  return s.p0 + (parseFloat(frac ?? "0")) * (s.p1 - s.p0);
}

const OVERLAY = { enter: at("clip6:0.12"), leave: at("glow:0.97"), max: 0.9, fade: 0.03 };
const MARQUEE = { enter: at("hold4:0.4"), leave: at("hold5:0.9") };

/* ——— Lenis smooth scroll ——— */

const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
});
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ——— Canvas ——— */

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const frames = new Array(FRAME_COUNT).fill(null);
let currentFrame = 0;
let dpr = 1;

function sizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
}

/* Frame placement. The film is square; the page is not. On landscape
   screens the frame is anchored to the right and the text lives on the
   solid ground to its left. On portrait screens it sits in the lower part
   of the viewport under the text. No blur, no feathering: a clean card. */
function frameRect() {
  const cw = canvas.width, ch = canvas.height;
  const landscape = cw > ch * 1.05;
  if (landscape) {
    // sits below the fixed header, with a slimmer margin at the bottom
    const top = HEADER_H * dpr, bottom = Math.max(24 * dpr, ch * 0.04);
    const size = Math.min(ch - top - bottom, cw * 0.56);
    const margin = cw * 0.03;
    return { dx: cw - size - margin, dy: top, dw: size, dh: size };
  }
  const size = Math.min(cw * 0.94, ch * 0.38);
  return { dx: (cw - size) / 2, dy: ch - size - ch * 0.03, dw: size, dh: size };
}

function roundedPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFrame(index) {
  const img = frames[index];
  if (!img) return;
  const cw = canvas.width, ch = canvas.height;
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, cw, ch);
  const { dx, dy, dw, dh } = frameRect();
  ctx.save();
  roundedPath(dx, dy, dw, dh, FRAME_RADIUS * dpr);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function progressToFrame(p) {
  for (const s of TIMELINE) {
    if (p >= s.p0 && p <= s.p1) {
      const t = s.p1 === s.p0 ? 0 : (p - s.p0) / (s.p1 - s.p0);
      return Math.round(s.f0 + t * (s.f1 - s.f0));
    }
  }
  return p < 0 ? 0 : FRAME_COUNT - 1;
}

/* ——— Preloader ——— */

const loaderEl = document.getElementById("loader");
const loaderBar = document.getElementById("loader-bar");
const loaderPct = document.getElementById("loader-percent");
let loaded = 0;

function loadImage(i) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { frames[i] = img; done(); };
    img.onerror = () => { frames[i] = null; done(); };
    function done() {
      loaded++;
      const pct = Math.round((loaded / FRAME_COUNT) * 100);
      loaderBar.style.width = pct + "%";
      loaderPct.textContent = pct;
      resolve();
    }
    img.src = framePath(i);
  });
}

async function preload() {
  await Promise.all([...Array(10).keys()].map(loadImage));
  sizeCanvas();
  drawFrame(0);
  const rest = [];
  for (let i = 10; i < FRAME_COUNT; i++) rest.push(loadImage(i));
  await Promise.all(rest);
  loaderEl.classList.add("done");
  playHeroIntro();
}

/* ——— Band sections ——— */

const bandSections = [...document.querySelectorAll(".band-section")];
const sectionState = new Map();

function buildTimeline(section) {
  const type = section.dataset.animation;
  const children = section.querySelectorAll(
    ".beat-index, .beat-heading, .beat-body, .stats-hero, .stat"
  );
  const tl = gsap.timeline({
    paused: true,
    onReverseComplete: () => section.classList.remove("is-active"),
  });
  switch (type) {
    case "slide-left":
      tl.from(children, { x: -80, opacity: 0, stagger: 0.14, duration: 0.9, ease: "power3.out" });
      break;
    case "slide-right":
      tl.from(children, { x: 80, opacity: 0, stagger: 0.14, duration: 0.9, ease: "power3.out" });
      break;
    case "clip-reveal":
      tl.from(children, { clipPath: "inset(0 0 100% 0)", y: 30, opacity: 0, stagger: 0.15, duration: 1.1, ease: "power4.inOut" });
      break;
    case "fade-up":
      tl.from(children, { y: 50, opacity: 0, stagger: 0.12, duration: 0.9, ease: "power3.out" });
      break;
    case "rotate-in":
      tl.from(children, { y: 40, rotation: 2.5, transformOrigin: "left bottom", opacity: 0, stagger: 0.1, duration: 0.9, ease: "power3.out" });
      break;
    case "stagger-up":
      tl.from(children, { y: 60, opacity: 0, stagger: 0.15, duration: 0.8, ease: "power3.out" });
      break;
    case "hero":
      break; // built separately on load; scroll only fades it
  }
  return tl;
}

bandSections.forEach((s) => {
  const [enterRef, leaveRef] = s.dataset.seg.split(",");
  sectionState.set(s, {
    enter: at(enterRef),
    leave: at(leaveRef),
    tl: buildTimeline(s),
    countersFired: false,
  });
});

const heroSection = document.querySelector(".hero-section");

function playHeroIntro() {
  const words = heroSection.querySelectorAll(".hero-heading .word");
  gsap.timeline()
    .from(".hero-section .eyebrow", { y: 14, opacity: 0, duration: 0.6, ease: "power3.out" })
    .from(words, { yPercent: 115, duration: 1.1, stagger: 0.06, ease: "power4.out" }, "-=0.3")
    .from(".hero-tagline", { y: 26, opacity: 0, duration: 0.8, ease: "power3.out" }, "-=0.55")
    .from(".hero-ctas .btn", { y: 20, opacity: 0, stagger: 0.09, duration: 0.7, ease: "power3.out" }, "-=0.5")
    .from(".hero-section .badge-strip", { opacity: 0, duration: 0.7, ease: "power2.out" }, "-=0.3");
}

function fireCounters(scope) {
  scope.querySelectorAll(".stat-number").forEach((el) => {
    const target = parseFloat(el.dataset.value);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    gsap.fromTo(el, { textContent: 0 }, {
      textContent: target,
      duration: 1.8,
      ease: "power1.out",
      snap: { textContent: decimals === 0 ? 1 : 0.1 },
      onUpdate() { el.textContent = parseFloat(el.textContent).toFixed(decimals); },
    });
  });
}

function updateBand(p) {
  bandSections.forEach((s) => {
    const st = sectionState.get(s);
    const inRange = p >= st.enter && p <= st.leave;
    if (s === heroSection) {
      const h = SEG.hero;
      const o = gsap.utils.clamp(0, 1, 1 - (p - (h.p0 + 0.12 * (h.p1 - h.p0))) / (0.65 * (h.p1 - h.p0)));
      s.style.opacity = o;
      s.classList.toggle("is-active", o > 0.01);
      return;
    }
    if (inRange) {
      if (!s.classList.contains("is-active")) {
        s.classList.add("is-active");
        st.tl.timeScale(1).play();
        if (s.classList.contains("stats-section") && !st.countersFired) {
          st.countersFired = true;
          fireCounters(s);
        }
      }
    } else if (s.classList.contains("is-active")) {
      st.tl.timeScale(1.8).reverse();
      if (s.classList.contains("stats-section")) st.countersFired = false;
    }
  });
}

/* ——— Overlay + marquee ——— */

const overlayEl = document.getElementById("dark-overlay");
const marqueeEl = document.getElementById("marquee");
const marqueeText = marqueeEl.querySelector(".marquee-text");

function updateOverlay(p) {
  const { enter, leave, max, fade } = OVERLAY;
  let o = 0;
  if (p >= enter - fade && p < enter) o = max * ((p - (enter - fade)) / fade);
  else if (p >= enter && p <= leave) o = max;
  else if (p > leave && p <= leave + fade) o = max * (1 - (p - leave) / fade);
  overlayEl.style.opacity = o;
}

function updateMarquee(p) {
  const { enter, leave } = MARQUEE;
  const span = 0.025;
  let o = 0;
  if (p >= enter && p <= leave) o = Math.min(1, (p - enter) / span, (leave - p) / span);
  marqueeEl.style.opacity = o;
  if (o > 0) {
    const t = (p - enter) / (leave - enter);
    gsap.set(marqueeText, { xPercent: -8 - t * 30 });
  }
}

/* ——— Master scroll binding ——— */

const scrollContainer = document.getElementById("scroll-container");

ScrollTrigger.create({
  trigger: scrollContainer,
  start: "top top",
  end: "bottom bottom",
  scrub: true,
  onUpdate(self) {
    const p = self.progress;
    const index = progressToFrame(p);
    if (index !== currentFrame) {
      currentFrame = index;
      requestAnimationFrame(() => drawFrame(currentFrame));
    }
    updateBand(p);
    updateOverlay(p);
    updateMarquee(p);
  },
});

/* Hide the film once the page flow has covered it */
ScrollTrigger.create({
  trigger: ".page-flow",
  start: "top 60%",
  onEnter: () => {
    gsap.to(["#canvas-wrap", "#band", "#dark-overlay", "#marquee"], { autoAlpha: 0, duration: 0.4 });
    document.querySelector(".site-header").classList.add("solid");
  },
  onLeaveBack: () => {
    gsap.to(["#canvas-wrap", "#band"], { autoAlpha: 1, duration: 0.4 });
    gsap.set(["#dark-overlay", "#marquee"], { visibility: "visible" });
    document.querySelector(".site-header").classList.remove("solid");
  },
});

/* ——— Same-page anchors through the runway (Lenis) ——— */

const runwayTargets = {
  "#top": 0,
  "#flow": () => scrollContainer.offsetHeight * SEG.clip1.p0,
};

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const href = a.getAttribute("href");
    if (href === "#") return;
    e.preventDefault();
    if (href in runwayTargets) {
      const t = runwayTargets[href];
      lenis.scrollTo(typeof t === "function" ? t() : t, { duration: 1.6 });
    } else {
      const el = document.querySelector(href);
      if (el) lenis.scrollTo(el, { offset: -80, duration: 1.6 });
    }
  });
});

/* ——— Resize ——— */

window.addEventListener("resize", () => {
  sizeCanvas();
  drawFrame(currentFrame);
});

/* ——— QA hook: /?p=0.42 jumps straight to that film progress after preload ——— */

function jumpToProgress() {
  const q = new URLSearchParams(location.search).get("p");
  if (q === null) return;
  const p = Math.min(1, Math.max(0, parseFloat(q)));
  const y = p * (scrollContainer.offsetHeight - window.innerHeight);
  lenis.scrollTo(y, { immediate: true });
  window.scrollTo(0, y);
  ScrollTrigger.refresh();
}

/* ——— Go ——— */

sizeCanvas();
preload().then(jumpToProgress);
