export type AppView = 'home' | 'shop' | 'assistant' | 'orders';

export function pathForView(view: AppView): string {
  switch (view) {
    case 'home':
      return '/';
    case 'assistant':
      return '/assistant';
    case 'orders':
      return '/orders';
    default:
      return '/shop';
  }
}

export function viewFromPath(pathname: string): AppView {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/home') return 'home';
  if (path === '/shop') return 'shop';
  if (path === '/assistant') return 'assistant';
  if (path === '/orders') return 'orders';
  return 'home';
}

export function navigateToView(view: AppView): void {
  const path = pathForView(view);
  if (window.location.pathname !== path) {
    window.history.pushState({ view }, '', path);
  }
}
