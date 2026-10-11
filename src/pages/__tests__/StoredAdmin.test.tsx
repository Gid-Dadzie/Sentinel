import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { createDefaultRules, RULE_IDS } from '@sentinel/engine';
import { AuthContext, type AuthState } from '../../api/auth';
import type { AuditPage, RescoreSummary, Role } from '../../api/types';
import { routerFuture } from '../../routerFuture';
import { fakeApi } from '../../test/fakeApi';
import AuditLog from '../AuditLog';
import StoredRules from '../stored/StoredRules';

function renderAs(role: Role, element: ReactNode, path = '/') {
  const auth: AuthState = {
    status: 'signed-in',
    user: { id: 'u-1', name: 'Kofi Admin', email: 'kofi@example.com', role },
    notice: null,
    login: vi.fn(),
    logout: vi.fn(),
    expire: vi.fn(),
  };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]} future={routerFuture}>
        {element}
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const FEEDBACK = RULE_IDS.map((ruleId) =>
  ruleId === 'amount'
    ? { ruleId, fired: 12, confirmedFraud: 3, falsePositive: 5 }
    : { ruleId, fired: 0, confirmedFraud: 0, falsePositive: 0 },
);

const SUMMARY: RescoreSummary = {
  total: 388,
  changed: 4,
  flaggedBefore: 5,
  flaggedAfter: 2,
  newlyFlagged: 0,
  noLongerFlagged: 3,
  levels: [],
  moves: [{ from: 'medium', to: 'low', count: 3 }],
};

/** Answers like the API, keeping rule changes so later reads see them. */
function fakeRulesApi() {
  let rules = createDefaultRules();
  return fakeApi((url, init) => {
    if (url.pathname === '/api/rules/feedback')
      return { status: 200, body: { feedback: FEEDBACK } };
    if (url.pathname === '/api/rules') return { status: 200, body: { rules } };
    if (url.pathname.startsWith('/api/rules/') && init?.method === 'PATCH') {
      const id = url.pathname.split('/').pop();
      const patch = JSON.parse(String(init.body)) as { points: number; enabled: boolean };
      rules = rules.map((r) => (r.id === id ? { ...r, ...patch } : r));
      return { status: 200, body: { rule: rules.find((r) => r.id === id) } };
    }
    if (url.pathname === '/api/rescore') {
      return {
        status: 200,
        body: { summary: SUMMARY },
      };
    }
    return { status: 200, body: { items: [], total: 0, page: 1, pageCount: 1 } };
  });
}

const card = (name: string) => within(screen.getByRole('region', { name: new RegExp(name) }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Rules on stored data', () => {
  it('shows how each rule fared against analyst verdicts', async () => {
    fakeRulesApi();
    renderAs('analyst', <StoredRules />);
    expect(
      await screen.findByText(
        'Fired on 12 stored transactions · 3 confirmed fraud · 5 false positives',
      ),
    ).toBeInTheDocument();
  });

  it('is read-only for analysts', async () => {
    fakeRulesApi();
    renderAs('analyst', <StoredRules />);
    await screen.findByText(/Only admins can change them/);
    const amount = card('Unusual amount');
    expect(amount.getByRole('switch')).toBeDisabled();
    expect(amount.getByRole('spinbutton')).toBeDisabled();
    expect(screen.queryByRole('region', { name: 'Re-score stored transactions' })).toBeNull();
  });

  it('lets an admin change rules, save them, and then re-score', async () => {
    const calls = fakeRulesApi();
    const user = userEvent.setup();
    renderAs('admin', <StoredRules />);

    const amount = await screen.findByRole('region', { name: /Unusual amount/ });
    await user.click(within(amount).getByRole('switch'));
    const time = card('Unusual time');
    await user.clear(time.getByRole('spinbutton'));
    await user.type(time.getByRole('spinbutton'), '15');

    const bar = within(screen.getByRole('region', { name: 'Unsaved rule changes' }));
    expect(bar.getByText('2 rules changed, not saved yet.')).toBeInTheDocument();
    // Re-scoring waits until the changes are saved.
    expect(screen.getByRole('button', { name: 'Preview re-score' })).toBeDisabled();

    await user.click(bar.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/Saved 2 rule changes/)).toBeInTheDocument();
    const patches = calls.filter((c) => c.init?.method === 'PATCH');
    expect(patches.map((c) => [c.url.pathname, JSON.parse(String(c.init?.body))])).toEqual([
      ['/api/rules/amount', { points: 25, enabled: false }],
      ['/api/rules/time', { points: 15, enabled: true }],
    ]);
    expect(screen.queryByRole('region', { name: 'Unsaved rule changes' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Preview re-score' }));
    const panel = card('Re-score stored transactions');
    expect(await panel.findByText('Would change 4 of 388 transactions.')).toBeInTheDocument();
    expect(panel.getByText(/Flagged 5 → 2/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname === '/api/rescore' && c.init?.method === 'POST')).toBe(
      false,
    );

    await user.click(panel.getByRole('button', { name: 'Re-score 4 transactions' }));
    expect(await panel.findByText('Re-scored 4 of 388 transactions.')).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname === '/api/rescore' && c.init?.method === 'POST')).toBe(
      true,
    );
  });

  it('can discard unsaved changes', async () => {
    const calls = fakeRulesApi();
    const user = userEvent.setup();
    renderAs('admin', <StoredRules />);
    await user.click(
      within(await screen.findByRole('region', { name: /Unusual amount/ })).getByRole('switch'),
    );
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(card('Unusual amount').getByRole('switch')).toBeChecked();
    expect(calls.some((c) => c.init?.method === 'PATCH')).toBe(false);
  });
});

describe('Audit log', () => {
  const PAGE: AuditPage = {
    entries: [
      {
        id: '4',
        at: '2026-10-07T10:00:00.000Z',
        action: 'rule.update',
        entity: 'rule',
        entityId: 'amount',
        detail: { before: { points: 25, enabled: true }, after: { points: 40, enabled: true } },
        actor: { id: 'u-1', name: 'Kofi Admin', email: 'kofi@example.com' },
      },
      {
        id: '3',
        at: '2026-10-07T09:00:00.000Z',
        action: 'decision',
        entity: 'transaction',
        entityId: 'TX-10482',
        detail: { decision: 'confirmed_fraud', from: 'new', to: 'resolved' },
        actor: { id: 'u-2', name: 'Efua Analyst', email: 'efua@example.com' },
      },
      {
        id: '2',
        at: '2026-10-07T08:00:00.000Z',
        action: 'import',
        entity: 'import',
        entityId: null,
        detail: { fileName: 'october.csv', imported: 388, flagged: 5, rejected: 1, duplicates: 0 },
        actor: { id: 'u-1', name: 'Kofi Admin', email: 'kofi@example.com' },
      },
    ],
    total: 3,
    page: 1,
    pageCount: 1,
    filters: {
      actions: ['decision', 'import', 'rule.update'],
      actors: [
        { id: 'u-2', name: 'Efua Analyst' },
        { id: 'u-1', name: 'Kofi Admin' },
      ],
    },
  };

  it('describes each entry in plain language and filters through the API', async () => {
    const calls = fakeApi(() => ({ status: 200, body: PAGE }));
    const user = userEvent.setup();
    renderAs('admin', <AuditLog />, '/audit');

    const table = within(await screen.findByRole('table', { name: 'Entries' }));
    const rows = table.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Changed rule');
    expect(rows[0]).toHaveTextContent('Unusual amount');
    expect(rows[0]).toHaveTextContent('points 25 → 40');
    expect(rows[1]).toHaveTextContent('Confirmed fraud (New → Resolved)');
    expect(within(rows[1] as HTMLElement).getByRole('link', { name: 'TX-10482' })).toHaveAttribute(
      'href',
      '/tx/TX-10482',
    );
    expect(rows[2]).toHaveTextContent(
      'october.csv: 388 imported, 5 flagged, 1 rejected, 0 duplicates',
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Person' }), 'Efua Analyst');
    await waitFor(() => expect(calls.at(-1)?.url.searchParams.get('actor')).toBe('u-2'));
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });
});
