export interface ProductMeta {
  name: string;
  eyebrow: string;
  storageKey: string;
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
let themeSystemBound = false;

export function escapeHTML(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export function readSession<T>(key: string, fallback: T): T {
  try {
    const saved = sessionStorage.getItem(key);
    return saved ? { ...fallback, ...JSON.parse(saved) as object } : fallback;
  } catch {
    return fallback;
  }
}

export function writeSession(key: string, value: unknown): void {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}

export function clearSession(key: string): void {
  try { sessionStorage.removeItem(key); } catch { /* Storage is optional. */ }
}

export function announce(message: string): void {
  const region = document.querySelector<HTMLElement>("#live");
  if (!region) return;
  region.textContent = "";
  requestAnimationFrame(() => { region.textContent = message; });
}

export function downloadText(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function header(meta: ProductMeta, trail?: string): string {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  return `<header class="site-header">
    <a class="brand" href="/" aria-label="${escapeHTML(meta.name)} — home">
      <img src="/assets/pitchdog-logomark.svg" alt="" width="31" height="31">
      <span><strong>${escapeHTML(meta.name)}</strong><small>${escapeHTML(trail ?? meta.eyebrow)}</small></span>
    </a>
    <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Switch to ${next} theme" title="Switch to ${next} theme"><span aria-hidden="true"></span></button>
  </header>`;
}

export function footer(productName: string): string {
  return `<footer class="site-footer">
    <p>Made with unreasonable care by <strong>pitch.dog</strong>.</p>
    <p>${escapeHTML(productName)} works locally. No account, upload, analytics, or runtime AI.</p>
  </footer>`;
}

export function bindTheme(storageKey: string): void {
  const system = matchMedia("(prefers-color-scheme: dark)");
  const paint = (theme: "light" | "dark", source: "system" | "manual") => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themeSource = source;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0d0e0c" : "#f3f2ed");
  };
  if (!themeSystemBound) {
    system.addEventListener("change", (event) => {
      if (document.documentElement.dataset.themeSource !== "manual") paint(event.matches ? "dark" : "light", "system");
    });
    themeSystemBound = true;
  }
  document.querySelector("#theme-toggle")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    paint(next, "manual");
    try { localStorage.setItem(storageKey, next); } catch { /* Preference is optional. */ }
    announce(`${next === "dark" ? "Dark" : "Light"} theme.`);
  });
}

let landingEpoch = 0;

function forceTop(): void {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

export function landAtTop(focusSelector = "[data-page-heading]"): void {
  const epoch = ++landingEpoch;
  forceTop();
  queueMicrotask(() => { if (epoch === landingEpoch) forceTop(); });
  requestAnimationFrame(() => {
    if (epoch !== landingEpoch) return;
    forceTop();
    requestAnimationFrame(() => {
      if (epoch !== landingEpoch) return;
      forceTop();
      document.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
    });
  });
}

export function keepPosition(focusSelector?: string): void {
  requestAnimationFrame(() => {
    if (focusSelector) document.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
  });
}

export function revealOnSmallScreens(selector: string): void {
  if (!matchMedia("(max-width: 820px)").matches) return;
  requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.scrollIntoView({
    block: "start",
    behavior: reducedMotion.matches ? "auto" : "smooth",
  }));
}

export function progress(name: string, step: number, total: number): string {
  const current = Math.max(1, Math.min(total, step + 1));
  return `<div class="flow-progress" aria-label="${escapeHTML(name)}: step ${current} of ${total}">
    <span>${escapeHTML(name)}</span><strong>${current} / ${total}</strong>
    <div class="progress-track"><i style="--progress:${(current / total) * 100}%"></i></div>
  </div>`;
}

export interface Choice {
  value: string;
  label: string;
  detail: string;
}

export function choiceGrid(choices: readonly Choice[], attribute: string, selected?: string, multiSelected: readonly string[] = []): string {
  return `<div class="answer-grid">${choices.map((choice, index) => {
    const pressed = selected === choice.value || multiSelected.includes(choice.value);
    return `<button class="answer-card" type="button" data-${attribute}="${escapeHTML(choice.value)}" aria-pressed="${pressed}">
      <span class="answer-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="answer-copy"><strong>${escapeHTML(choice.label)}</strong><small>${escapeHTML(choice.detail)}</small></span>
      <span class="answer-arrow" aria-hidden="true">${multiSelected.length ? "✓" : "↗"}</span>
    </button>`;
  }).join("")}</div>`;
}

export function attachReveal(): void {
  const nodes = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (!nodes.length) return;
  if (reducedMotion.matches) {
    nodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: "0px 0px -4%" });
  nodes.forEach((node) => observer.observe(node));
  window.setTimeout(() => {
    nodes.forEach((node) => {
      node.classList.add("is-visible");
      observer.unobserve(node);
    });
  }, 900);
}

export function attachTilt(): void {
  if (!finePointer.matches || reducedMotion.matches) return;
  document.querySelectorAll<HTMLElement>("[data-tilt]").forEach((element) => {
    const strength = Number(element.dataset.tilt ?? 2);
    let frame = 0;
    element.addEventListener("pointermove", (event) => {
      const bounds = element.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element.style.setProperty("--tilt-x", `${(-y * strength).toFixed(2)}deg`);
        element.style.setProperty("--tilt-y", `${(x * strength).toFixed(2)}deg`);
        element.style.setProperty("--light-x", `${((x + 0.5) * 100).toFixed(1)}%`);
        element.style.setProperty("--light-y", `${((y + 0.5) * 100).toFixed(1)}%`);
      });
    }, { passive: true });
    element.addEventListener("pointerleave", () => {
      cancelAnimationFrame(frame);
      element.style.setProperty("--tilt-x", "0deg");
      element.style.setProperty("--tilt-y", "0deg");
      element.style.setProperty("--light-x", "50%");
      element.style.setProperty("--light-y", "50%");
    });
  });
}

export function initialiseThreadCursor(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#thread-canvas");
  if (!canvas || !finePointer.matches || reducedMotion.matches) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const points = Array.from({ length: 26 }, () => ({ x: 0, y: 0 }));
  const target = { x: 0, y: 0 };
  let ready = false;
  let frame = 0;
  let quiet = 0;

  const size = () => {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * ratio);
    canvas.height = Math.round(innerHeight * ratio);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const draw = () => {
    frame = 0;
    if (!ready || document.hidden) return;
    let movement = 0;
    points[0]!.x += (target.x - points[0]!.x) * 0.4;
    points[0]!.y += (target.y - points[0]!.y) * 0.4;
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index]!;
      const leader = points[index - 1]!;
      const oldX = point.x;
      const oldY = point.y;
      const pull = Math.max(0.17, 0.31 - index * 0.0045);
      point.x += (leader.x - point.x) * pull;
      point.y += (leader.y - point.y) * pull;
      movement += Math.abs(point.x - oldX) + Math.abs(point.y - oldY);
    }
    context.clearRect(0, 0, innerWidth, innerHeight);
    const tail = points.at(-1)!;
    context.beginPath();
    context.moveTo(tail.x, tail.y);
    for (let index = points.length - 2; index > 0; index -= 1) {
      const point = points[index]!;
      const leader = points[index - 1]!;
      context.quadraticCurveTo(point.x, point.y, (point.x + leader.x) / 2, (point.y + leader.y) / 2);
    }
    context.lineTo(points[0]!.x, points[0]!.y);
    const line = context.createLinearGradient(tail.x, tail.y, points[0]!.x, points[0]!.y);
    line.addColorStop(0, "rgba(255,79,135,0)");
    line.addColorStop(0.5, "rgba(255,79,135,.46)");
    line.addColorStop(1, "rgba(255,79,135,.98)");
    context.strokeStyle = line;
    context.lineWidth = 1.9;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
    context.beginPath();
    context.arc(points[0]!.x, points[0]!.y, 3.3, 0, Math.PI * 2);
    context.fillStyle = "#ff4f87";
    context.fill();
    quiet = movement < 0.08 ? quiet + 1 : 0;
    if (quiet < 18) frame = requestAnimationFrame(draw);
  };

  window.addEventListener("pointermove", (event) => {
    target.x = event.clientX;
    target.y = event.clientY;
    if (!ready) {
      points.forEach((point) => { point.x = target.x; point.y = target.y; });
      ready = true;
    }
    quiet = 0;
    if (!frame) frame = requestAnimationFrame(draw);
  }, { passive: true });
  window.addEventListener("resize", size, { passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && ready && !frame) frame = requestAnimationFrame(draw); });
  size();
}

history.scrollRestoration = "manual";
