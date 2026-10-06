import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { routerFuture } from './routerFuture';

/** Lazy pages (the dashboard pulls in Recharts) can take over a second to import under load. */
const LAZY_PAGE = { timeout: 10_000 };

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]} future={routerFuture}>
      <App />
    </MemoryRouter>,
  );
}

describe('App shell', () => {
  it('renders the dashboard route', async () => {
    renderAt('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' }, LAZY_PAGE),
    ).toBeInTheDocument();
  });

  it('renders the not-found page for unknown routes', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('renders the investigation route', async () => {
    renderAt('/tx/TX-10482');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Transaction TX-10482' }, LAZY_PAGE),
    ).toBeInTheDocument();
  });
});
