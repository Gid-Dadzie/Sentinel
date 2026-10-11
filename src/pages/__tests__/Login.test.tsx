import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AuthProvider from '../../api/AuthProvider';
import AuthGate from '../../components/AuthGate';
import RequireRole from '../../components/RequireRole';
import { routerFuture } from '../../routerFuture';
import { fakeApi } from '../../test/fakeApi';

const ADMIN = { id: 'u1', name: 'Ama Admin', email: 'ama@example.com', role: 'admin' };
const ANALYST = { ...ADMIN, name: 'Kofi Analyst', role: 'analyst' };

function renderGate(child = <p>Inside the app</p>) {
  return render(
    <MemoryRouter future={routerFuture}>
      <AuthProvider>
        <AuthGate>{child}</AuthGate>
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sign-in (API mode)', () => {
  it('asks for credentials when there is no session, then lets the user in', async () => {
    const calls = fakeApi((url, init) => {
      if (url.pathname === '/api/auth/me') return { status: 401, body: { error: 'Sign in' } };
      const body = JSON.parse(String(init?.body)) as { password: string };
      return body.password === 'right password'
        ? { status: 200, body: { user: ADMIN } }
        : { status: 401, body: { error: 'Email or password is incorrect' } };
    });
    const user = userEvent.setup();
    renderGate();

    await user.type(await screen.findByLabelText('Email'), 'ama@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
    expect(screen.queryByText('Inside the app')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'right password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Inside the app')).toBeInTheDocument();
    expect(calls.at(-1)?.init?.method).toBe('POST');
  });

  it('goes straight in when the session cookie is still valid', async () => {
    fakeApi(() => ({ status: 200, body: { user: ANALYST } }));
    renderGate();
    expect(await screen.findByText('Inside the app')).toBeInTheDocument();
  });

  it('keeps admin pages from analysts', async () => {
    fakeApi(() => ({ status: 200, body: { user: ANALYST } }));
    renderGate(
      <RequireRole role="admin">
        <p>Admin only</p>
      </RequireRole>,
    );
    expect(
      await screen.findByText('This page is for admins. Ask an admin if you need access.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Admin only')).not.toBeInTheDocument();
  });

  it('says how to start the API when it is not running, instead of "Request failed (500)"', async () => {
    // What Vite's dev proxy answers when nothing listens on the API port: a bare 500.
    fakeApi(() => ({ status: 500 }));
    renderGate();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot reach the Sentinel API. Start it with "npm run dev -w @sentinel/server", then try again.',
    );
  });

  it('can show the password, and explains how to get a forgotten one reset', async () => {
    fakeApi(() => ({ status: 401, body: { error: 'Sign in' } }));
    const user = userEvent.setup();
    renderGate();

    const password = await screen.findByLabelText('Password');
    await user.type(password, 'secret');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const forgot = screen.getByRole('button', { name: 'Forgot password?' });
    expect(screen.queryByText(/Ask your Sentinel administrator/)).not.toBeVisible();
    await user.click(forgot);
    expect(forgot).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Ask your Sentinel administrator/)).toBeVisible();
  });

  it('marks both fields invalid after wrong credentials', async () => {
    fakeApi((url) =>
      url.pathname === '/api/auth/me'
        ? { status: 401, body: { error: 'Sign in' } }
        : { status: 401, body: { error: 'Email or password is incorrect' } },
    );
    const user = userEvent.setup();
    renderGate();
    await user.type(await screen.findByLabelText('Email'), 'ama@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });
});
