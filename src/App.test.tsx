import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { routerFuture } from './routerFuture';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]} future={routerFuture}>
      <App />
    </MemoryRouter>,
  );
}

describe('App shell', () => {
  it('renders the dashboard route', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders the not-found page for unknown routes', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
