// static/js/ui/components/drawer/drawerDom.js

export const clamp = (n, min, max) => Math.max(min, Math.min(n, max));

export const toggleClass = (el, className, on) => {
  if (!el) return;
  el.classList.toggle(className, !!on);
};

export const setAriaHidden = (el, hidden) => {
  if (!el) return;
  el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
};

export const setInert = (el, inert) => {
  if (!el) return;
  el.inert = !!inert;
};

export const onceAnimationEnd = (el, handler) => {
  if (!el) return;
  el.addEventListener(
    'animationend',
    (e) => {
      if (e.target !== el) return;
      handler(e);
    },
    { once: true }
  );
};