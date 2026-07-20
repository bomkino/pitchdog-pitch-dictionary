import Matter from "matter-js";
import type { PitchTerm } from "./terms.ts";

const { Engine, Bodies, Body, Composite, Events, Runner } = Matter;

export function initialiseWordDrop(stage: HTMLElement, terms: readonly PitchTerm[]): () => void {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const chosen = ["Logline","Ask","Comps","Traction","Tone","Brief","Insight","Pilot","Information hierarchy","Usage","Proof point","Pitch","World","Consent","Hook","Runway","Storyboard","Access route"]
    .map((label) => terms.find((term) => term.label === label)).filter(Boolean) as PitchTerm[];
  const elements = chosen.map((term) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "falling-word"; button.textContent = term.label; button.dataset.term = term.id; button.setAttribute("aria-label", `Open ${term.label}`); stage.append(button); return { term, button };
  });
  elements.forEach(({ button }, index) => { button.tabIndex = index === 0 ? 0 : -1; });
  elements.forEach(({ term, button }) => button.addEventListener("click", () => stage.dispatchEvent(new CustomEvent("dictionary:open", { bubbles: true, detail: term.id }))));
  const focusWord = (index: number) => {
    const safe = (index + elements.length) % elements.length;
    elements.forEach(({ button }, itemIndex) => { button.tabIndex = itemIndex === safe ? 0 : -1; });
    elements[safe]?.button.focus();
  };
  const onKeydown = (event: KeyboardEvent) => {
    const current = elements.findIndex(({ button }) => button === document.activeElement);
    if (current < 0) return;
    if (["ArrowRight", "ArrowDown"].includes(event.key)) { event.preventDefault(); focusWord(current + 1); }
    if (["ArrowLeft", "ArrowUp"].includes(event.key)) { event.preventDefault(); focusWord(current - 1); }
    if (event.key === "Home") { event.preventDefault(); focusWord(0); }
    if (event.key === "End") { event.preventDefault(); focusWord(elements.length - 1); }
  };
  const onFocusIn = (event: FocusEvent) => {
    const index = elements.findIndex(({ button }) => button === event.target);
    if (index >= 0) elements.forEach(({ button }, itemIndex) => { button.tabIndex = itemIndex === index ? 0 : -1; });
  };
  stage.addEventListener("keydown", onKeydown);
  stage.addEventListener("focusin", onFocusIn);
  if (reduced) {
    stage.classList.add("physics-paused");
    return () => { stage.removeEventListener("keydown", onKeydown); stage.removeEventListener("focusin", onFocusIn); elements.forEach(({ button }) => button.remove()); };
  }

  const engine = Engine.create({ gravity: { x: 0.05, y: 0.72, scale: 0.001 } });
  const runner = Runner.create();
  let bodies: Matter.Body[] = [];
  let walls: Matter.Body[] = [];
  let width = 0; let height = 0;

  const rebuild = () => {
    const rect = stage.getBoundingClientRect(); width = rect.width; height = rect.height;
    if (walls.length) Composite.remove(engine.world, walls);
    if (bodies.length) Composite.remove(engine.world, bodies);
    walls = [
      Bodies.rectangle(width / 2, height + 30, width + 120, 60, { isStatic: true }),
      Bodies.rectangle(-30, height / 2, 60, height * 2, { isStatic: true }),
      Bodies.rectangle(width + 30, height / 2, 60, height * 2, { isStatic: true }),
    ];
    bodies = elements.map(({ button }, index) => {
      const w = Math.max(92, button.offsetWidth); const h = Math.max(43, button.offsetHeight);
      return Bodies.rectangle(65 + ((index * 151) % Math.max(130, width - 130)), -15 - Math.floor(index / 6) * 105 - (index % 3) * 18, w, h, { restitution: 0.72, friction: 0.18, frictionAir: 0.014, chamfer: { radius: h / 2 }, angle: ((index % 5) - 2) * 0.08 });
    });
    Composite.add(engine.world, [...walls, ...bodies]);
  };
  const sync = () => bodies.forEach((body, index) => { const element = elements[index]?.button; if (element) element.style.transform = `translate3d(${body.position.x}px,${body.position.y}px,0) translate(-50%,-50%) rotate(${body.angle}rad)`; });
  const pointer = (event: PointerEvent) => {
    const rect = stage.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top;
    bodies.forEach((body) => { const dx = body.position.x - x; const dy = body.position.y - y; const distance = Math.hypot(dx, dy); if (distance < 125 && distance > 2) Body.applyForce(body, body.position, { x: (dx / distance) * 0.0028, y: (dy / distance) * 0.0028 }); });
  };
  let resizeFrame = 0;
  const resize = () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(rebuild); };
  let running = false;
  const start = () => { if (!running) { Runner.run(runner, engine); running = true; } };
  const pause = () => { if (running) { Runner.stop(runner); running = false; } };
  const onFocusOut = () => queueMicrotask(() => { if (!stage.matches(":focus-within")) start(); });
  rebuild(); Events.on(engine, "afterUpdate", sync); start(); stage.addEventListener("pointermove", pointer, { passive: true }); stage.addEventListener("focusin", pause); stage.addEventListener("focusout", onFocusOut); addEventListener("resize", resize, { passive: true });
  return () => { pause(); Events.off(engine, "afterUpdate", sync); Composite.clear(engine.world, false); Engine.clear(engine); stage.removeEventListener("pointermove", pointer); stage.removeEventListener("keydown", onKeydown); stage.removeEventListener("focusin", onFocusIn); stage.removeEventListener("focusin", pause); stage.removeEventListener("focusout", onFocusOut); removeEventListener("resize", resize); elements.forEach(({ button }) => button.remove()); };
}
