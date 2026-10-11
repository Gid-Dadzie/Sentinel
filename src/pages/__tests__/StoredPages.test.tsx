import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { createDefaultRules } from '@sentinel/engine';
import { AuthContext, type AuthState } from '../../api/auth';
import type {
  ApiTransaction,
  DashboardData,
  DecisionEntry,
  TransactionDetail,
  User,
} from '../../api/types';
import { routerFuture } from '../../routerFuture';
import { fakeApi } from '../../test/fakeApi';
import StoredCustomerProfile from '../stored/StoredCustomerProfile';
import StoredDashboard from '../stored/StoredDashboard';
import StoredInvestigation from '../stored/StoredInvestigation';

const ANALYST: User = {
  id: 'u-1',
  name: 'Efua Analyst',
  email: 'efua@example.com',
  role: 'analyst',
};

function tx(overrides: Partial<ApiTransaction> & { id: string }): ApiTransaction {
  return {
    accountId: 'ACC-1',
    customerName: 'John Mensah',
    amount: 850,
    currency: 'GHS',
    merchant: 'Melcom',
    category: 'retail',
    location: { city: 'Accra', country: 'Ghana' },
    timestamp: '2026-09-01T12:00:00',
    deviceId: 'D-1',
    status: 'approved',
    riskScore: 0,
    riskLevel: 'low',
    fraudReasons: [],
    txnType: 'payment',
    senderMsisdn: '024****601',
    recipientMsisdn: null,
    agentId: null,
    reviewStatus: 'new',
    latestDecision: null,
    ...overrides,
  };
}

const NORMAL = tx({ id: 'TX-1' });
const ANOMALY = tx({
  id: 'TX-10482',
  amount: 15400,
  timestamp: '2026-10-05T02:34:00',
  location: { city: 'Lagos', country: 'Nigeria' },
  deviceId: 'D-921',
  status: 'pending',
  riskScore: 70,
  riskLevel: 'high',
  senderMsisdn: '024****777',
  fraudReasons: [
    { ruleId: 'amount', points: 25, text: 'Amount is 18x the average' },
    { ruleId: 'country', points: 20, text: 'First transaction in Nigeria' },
    { ruleId: 'device', points: 15, text: 'New device D-921' },
    { ruleId: 'time', points: 10, text: 'Made at 02:34' },
  ],
});
const UNDER_REVIEW = tx({
  id: 'TX-2',
  accountId: 'ACC-2',
  customerName: 'Ama Owusu',
  riskScore: 30,
  riskLevel: 'medium',
  reviewStatus: 'under_review',
  latestDecision: { decision: 'needs_info', decidedAt: '2026-10-06T09:00:00.000Z' },
});

const DASHBOARD: DashboardData = {
  summary: {
    total: 3,
    flagged: 2,
    declined: 0,
    pending: 1,
    totalAmount: 17100,
    flaggedAmount: 16250,
  },
  byLevel: [
    { level: 'low', count: 1 },
    { level: 'medium', count: 1 },
    { level: 'high', count: 1 },
    { level: 'critical', count: 0 },
  ],
  daily: [
    { date: '2026-09-01', total: 2, flagged: 1 },
    { date: '2026-10-05', total: 1, flagged: 1 },
  ],
  needsReview: 2,
  queue: [ANOMALY, UNDER_REVIEW],
  countries: ['Ghana', 'Nigeria'],
};

function auth(overrides: Partial<AuthState> = {}): AuthState {
  return {
    status: 'signed-in',
    user: ANALYST,
    notice: null,
    login: vi.fn(),
    logout: vi.fn(),
    expire: vi.fn(),
    ...overrides,
  };
}

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderAt(path: string, element: ReactNode, state: AuthState = auth()) {
  return render(
    <AuthContext.Provider value={state}>
      <MemoryRouter initialEntries={[path]} future={routerFuture}>
        <Routes>
          <Route path="*" element={element} />
        </Routes>
        <Search />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const page = (items: ApiTransaction[]) => ({
  status: 200,
  body: { items, total: items.length, page: 1, pageCount: 1 },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Dashboard on stored data', () => {
  it('shows the summary, the queue with progress, and the table from the API', async () => {
    const calls = fakeApi((url) =>
      url.pathname === '/api/dashboard'
        ? { status: 200, body: DASHBOARD }
        : page([ANOMALY, UNDER_REVIEW, NORMAL]),
    );
    renderAt('/', <StoredDashboard />);

    const queue = within(await screen.findByRole('list', { name: 'Transactions to review' }));
    expect(queue.getByRole('link', { name: 'TX-10482' })).toBeInTheDocument();
    expect(queue.getByText('Under review: needs info')).toBeInTheDocument();

    const table = within(await screen.findByRole('table', { name: 'All transactions' }));
    expect(await table.findByRole('link', { name: 'TX-1' })).toBeInTheDocument();
    expect(table.getByText('Under review: needs info')).toBeInTheDocument();
    expect(screen.getByText('3 transactions')).toBeInTheDocument();

    const list = calls.find((c) => c.url.pathname === '/api/transactions');
    expect(Object.fromEntries(list?.url.searchParams ?? [])).toEqual({
      sort: 'time',
      dir: 'desc',
      pageSize: '12',
    });
  });

  it('sends filters to the API, including the review queue switch', async () => {
    const calls = fakeApi((url) =>
      url.pathname === '/api/dashboard'
        ? { status: 200, body: DASHBOARD }
        : page(url.searchParams.has('needsReview') ? [ANOMALY] : [ANOMALY, NORMAL]),
    );
    const user = userEvent.setup();
    renderAt('/', <StoredDashboard />);

    await user.click(await screen.findByRole('checkbox', { name: 'Needs review' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Risk level' }), 'high');

    await waitFor(() => {
      const last = calls.filter((c) => c.url.pathname === '/api/transactions').at(-1);
      expect(last?.url.searchParams.get('needsReview')).toBe('1');
      expect(last?.url.searchParams.get('risk')).toBe('high');
    });
    expect(screen.getByTestId('search')).toHaveTextContent('queue=1');
    expect(await screen.findByText('1 of 3 transactions')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('search')).toBeEmptyDOMElement();
  });

  it('invites an admin to import when nothing is stored', async () => {
    fakeApi(() => ({
      status: 200,
      body: { ...DASHBOARD, summary: { ...DASHBOARD.summary, total: 0 }, queue: [] },
    }));
    renderAt('/', <StoredDashboard />, auth({ user: { ...ANALYST, role: 'admin' } }));
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import transactions' })).toHaveAttribute(
      'href',
      '/import',
    );
  });

  it('reports a failure and tries again on request', async () => {
    let fail = true;
    fakeApi((url) => {
      if (url.pathname !== '/api/dashboard') return page([]);
      return fail
        ? { status: 503, body: { error: 'The database is not answering' } }
        : { status: 200, body: DASHBOARD };
    });
    const user = userEvent.setup();
    renderAt('/', <StoredDashboard />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The database is not answering');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('list', { name: 'Transactions to review' })).toBeInTheDocument();
  });

  it('returns to sign-in when the session has ended', async () => {
    fakeApi(() => ({ status: 401, body: { error: 'Sign in to continue' } }));
    const state = auth();
    renderAt('/', <StoredDashboard />, state);
    await waitFor(() => expect(state.expire).toHaveBeenCalled());
  });
});

describe('Investigation on stored data', () => {
  const EARLIER: DecisionEntry = {
    id: 'd-1',
    decision: 'needs_info',
    notes: 'Calling the customer.',
    decidedAt: '2026-10-06T09:00:00.000Z',
    analyst: { id: 'u-2', name: 'Kofi Admin' },
  };

  function fakeInvestigation(detail: TransactionDetail) {
    return fakeApi((url, init) => {
      if (init?.method === 'POST') {
        const { decision, notes } = JSON.parse(String(init.body)) as {
          decision: DecisionEntry['decision'];
          notes: string;
        };
        return {
          status: 201,
          body: {
            decision: {
              id: 'd-2',
              decision,
              notes,
              decidedAt: '2026-10-07T10:00:00.000Z',
              analyst: { id: ANALYST.id, name: ANALYST.name },
            },
            reviewStatus: 'resolved',
          },
        };
      }
      if (url.pathname === '/api/rules')
        return { status: 200, body: { rules: createDefaultRules() } };
      if (url.pathname.startsWith('/api/customers/')) {
        return { status: 200, body: { accountId: 'ACC-1', transactions: [NORMAL, ANOMALY] } };
      }
      if (url.pathname === '/api/transactions/TX-10482') return { status: 200, body: detail };
      if (url.pathname === '/api/transactions') return page([]);
      return { status: 404, body: { error: 'Transaction not found' } };
    });
  }

  it('explains the score and shows the decision history', async () => {
    fakeInvestigation({
      transaction: { ...ANOMALY, reviewStatus: 'under_review' },
      decisions: [EARLIER],
    });
    renderAt('/tx/TX-10482', <StoredInvestigation id="TX-10482" />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Transaction TX-10482' }),
    ).toBeInTheDocument();
    const rules = within(screen.getByRole('list', { name: 'Rule results' }));
    expect(rules.getAllByText(/^\+\d+$/)).toHaveLength(4);
    expect(screen.getByText('024****777')).toBeInTheDocument();

    const panel = within(screen.getByRole('region', { name: 'Analyst decision' }));
    expect(
      panel.getByText(/Under review · Needs more information by Kofi Admin/),
    ).toBeInTheDocument();
    const history = within(panel.getByRole('list', { name: 'Decision history, newest first' }));
    expect(history.getByText('Calling the customer.')).toBeInTheDocument();
  });

  it('requires a decision and a note, then adds the new decision on top', async () => {
    const calls = fakeInvestigation({ transaction: ANOMALY, decisions: [EARLIER] });
    const user = userEvent.setup();
    renderAt('/tx/TX-10482', <StoredInvestigation id="TX-10482" />);
    const panel = within(await screen.findByRole('region', { name: 'Analyst decision' }));
    const save = panel.getByRole('button', { name: 'Save decision' });

    await user.click(save);
    expect(panel.getByRole('status')).toHaveTextContent('Choose a decision before saving.');
    await user.click(panel.getByRole('radio', { name: 'Confirmed fraud' }));
    await user.click(save);
    expect(panel.getByRole('status')).toHaveTextContent('Add a note explaining the decision.');
    expect(calls.some((c) => c.init?.method === 'POST')).toBe(false);

    await user.type(panel.getByLabelText('Note (required)'), 'Customer confirmed the theft.');
    await user.click(save);

    expect(await panel.findByText('Decision saved.')).toBeInTheDocument();
    const post = calls.find((c) => c.init?.method === 'POST');
    expect(post?.url.pathname).toBe('/api/transactions/TX-10482/decisions');
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      decision: 'confirmed_fraud',
      notes: 'Customer confirmed the theft.',
    });

    const items = within(
      panel.getByRole('list', { name: 'Decision history, newest first' }),
    ).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Confirmed fraud');
    expect(items[0]).toHaveTextContent('Efua Analyst');
    expect(items[1]).toHaveTextContent('Calling the customer.');
    expect(panel.getByText(/Resolved · Confirmed fraud by Efua Analyst/)).toBeInTheDocument();
    expect(panel.getByLabelText('Note (required)')).toHaveValue('');
  });

  it('says so when the transaction does not exist', async () => {
    fakeInvestigation({ transaction: ANOMALY, decisions: [] });
    renderAt('/tx/TX-404', <StoredInvestigation id="TX-404" />);
    expect(
      await screen.findByText('There is no transaction with ID “TX-404”.'),
    ).toBeInTheDocument();
  });
});

describe('Customer profile on stored data', () => {
  it('builds the profile from the API and counts confirmed fraud', async () => {
    fakeApi(() => ({
      status: 200,
      body: {
        accountId: 'ACC-1',
        transactions: [
          NORMAL,
          {
            ...ANOMALY,
            reviewStatus: 'resolved',
            latestDecision: { decision: 'confirmed_fraud', decidedAt: '2026-10-07T10:00:00.000Z' },
          },
        ],
      },
    }));
    renderAt('/customer/ACC-1', <StoredCustomerProfile accountId="ACC-1" />);

    expect(
      await screen.findByRole('heading', { level: 1, name: /John Mensah/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Confirmed fraud').nextElementSibling).toHaveTextContent('1');
    expect(screen.getAllByText('Reviewed: fraud').length).toBeGreaterThan(0);
  });

  it('says so when the account has no transactions', async () => {
    fakeApi(() => ({ status: 404, body: { error: 'Customer not found' } }));
    renderAt('/customer/ACC-9', <StoredCustomerProfile accountId="ACC-9" />);
    expect(
      await screen.findByText('There is no customer with account ID “ACC-9”.'),
    ).toBeInTheDocument();
  });
});
