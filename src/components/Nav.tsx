import { href, type Route } from '../hooks/useRoute';

const Icon = {
  ride: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 20l6-10 4 6 3-4 5 8z" />
      <circle cx="17" cy="5" r="2" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  ),
  sources: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5h16M4 12h16M4 19h10" />
    </svg>
  ),
};

export function Nav({ route }: { route: Route }) {
  const cur = (n: Route['name']) => (route.name === n || (n === 'home' && route.name === 'area') ? 'page' : undefined);
  return (
    <nav className="nav" aria-label="Main">
      <a href={href.home} aria-current={cur('home')}>
        {Icon.ride}
        Ride
      </a>
      <a href={href.map} aria-current={cur('map')}>
        {Icon.map}
        Map
      </a>
      <a href={href.settings} aria-current={cur('settings')}>
        {Icon.settings}
        Setup
      </a>
      <a href={href.sources} aria-current={cur('sources')}>
        {Icon.sources}
        Sources
      </a>
    </nav>
  );
}
