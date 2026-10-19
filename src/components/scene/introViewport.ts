/** Own the viewport only while the cinematic intro is active. Every mutation is reversible. */
export function lockIntroViewport(root: HTMLElement, skip: () => void) {
  const html = document.documentElement;
  const body = document.body;
  const undoStyles: (() => void)[] = [];
  const set = (element: HTMLElement, property: string, value: string) => {
    const before = element.style.getPropertyValue(property);
    const priority = element.style.getPropertyPriority(property);
    undoStyles.push(() => {
      if (before) element.style.setProperty(property, before, priority);
      else element.style.removeProperty(property);
    });
    element.style.setProperty(property, value);
  };
  const restoration = history.scrollRestoration;
  history.scrollRestoration = 'manual';
  set(html, 'scroll-behavior', 'auto');
  set(html, 'overflow', 'hidden');
  set(html, 'overscroll-behavior', 'none');
  set(body, 'position', 'fixed');
  set(body, 'top', '0px');
  set(body, 'left', '0px');
  set(body, 'width', '100%');
  set(body, 'overflow', 'hidden');
  set(body, 'overscroll-behavior', 'none');
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

  // Keep the rest of the page out of the keyboard and accessibility navigation
  // while the scene covers it, without changing any component's own state.
  const background: { element: HTMLElement; inert: boolean }[] = [];
  let branch: HTMLElement = root;
  while (branch !== body && branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (sibling !== branch && sibling instanceof HTMLElement) {
        background.push({ element: sibling, inert: sibling.inert });
        sibling.inert = true;
      }
    }
    branch = branch.parentElement;
  }

  const wheel = (event: WheelEvent) => { if (!event.ctrlKey) event.preventDefault(); };
  const touch = (event: TouchEvent) => { if (event.touches.length === 1) event.preventDefault(); };
  const scrollKeys = new Set(['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'PageDown', 'PageUp', 'Home', 'End', ' ']);
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); skip(); return; }
    // Space still activates the explicit skip button. It never scrolls the page.
    const activatesButton = event.key === ' ' && event.target instanceof HTMLButtonElement && root.contains(event.target);
    if (scrollKeys.has(event.key) && !activatesButton && !event.ctrlKey && !event.metaKey && !event.altKey) event.preventDefault();
  };
  document.addEventListener('wheel', wheel, { capture: true, passive: false });
  document.addEventListener('touchmove', touch, { capture: true, passive: false });
  document.addEventListener('keydown', key, true);

  return () => {
    document.removeEventListener('wheel', wheel, true);
    document.removeEventListener('touchmove', touch, true);
    document.removeEventListener('keydown', key, true);
    background.forEach(({ element, inert }) => { element.inert = inert; });
    undoStyles.reverse().forEach(undo => undo());
    history.scrollRestoration = restoration;
    // The expanding display becomes the first screen, including after replay.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };
}
