import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { routerFuture } from '../../routerFuture';
import { useFraudStore } from '../../state/useFraudStore';
import { PAGE_SIZE } from '../../utils/dashboard';
import Dashboard from '../Dashboard';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

function renderDashboard(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/${search}`]} future={routerFuture}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Dashboard />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const mainTable = () => screen.getByRole('table', { name: 'All transactions' });
const bodyRows = () => within(mainTable()).getAllByRole('row').slice(1);
/** Narrows away undefined without a non-null assertion. */
function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Expected a value');
  return value;
}

const search = () => screen.getByTestId('location').textContent;

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    useFraudStore.getState().resetRules();
    useFraudStore.setState({ reviews: {} });
  });

  it('shows summary tiles derived from the store', () => {
    renderDashboard();
    const total = useFraudStore.getState().transactions.length;
    const tile = screen.getByText('Transactions', { selector: 'dt' }).parentElement;
    expect(tile).toHaveTextContent(total.toLocaleString('en-US'));
  });

  it('shows one page of rows, newest first, linking to investigation and customer pages', () => {
    renderDashboard();
    const rows = bodyRows();
    expect(rows).toHaveLength(PAGE_SIZE);

    const newest = must(useFraudStore.getState().transactions.slice(-1)[0]);
    const firstRow = within(must(rows[0]));
    expect(firstRow.getByRole('link', { name: newest.id })).toHaveAttribute(
      'href',
      `/tx/${newest.id}`,
    );
    expect(firstRow.getByRole('link', { name: newest.customerName })).toHaveAttribute(
      'href',
      `/customer/${newest.accountId}`,
    );
  });

  it('filters by risk level and keeps the filter in the URL', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.selectOptions(screen.getByLabelText('Risk level'), 'critical');

    expect(search()).toBe('?risk=critical');
    const critical = useFraudStore
      .getState()
      .transactions.filter((t) => t.riskLevel === 'critical');
    expect(screen.getByRole('status')).toHaveTextContent(`${critical.length} of`);
    for (const row of bodyRows()) expect(row).toHaveTextContent('Critical');
  });

  it('restores filters from the URL and searches', async () => {
    const user = userEvent.setup();
    renderDashboard('?q=TX-10482');
    expect(bodyRows()).toHaveLength(1);
    expect(within(mainTable()).getByRole('link', { name: 'TX-10482' })).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz-no-match');
    expect(
      screen.getByText('No transactions match these filters. Clear a filter to see more.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(search()).toBe('');
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(bodyRows()).toHaveLength(12);
  });

  it('filters by country, minimum amount and from date', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.selectOptions(screen.getByLabelText('Country'), 'Nigeria');
    await user.type(screen.getByLabelText('Minimum amount (GHS)'), '10000');
    expect(search()).toBe('?country=Nigeria&min=10000');
    expect(bodyRows()).toHaveLength(1);
    expect(within(mainTable()).getByRole('link', { name: 'TX-10482' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('From date'), '2026-10-06');
    expect(search()).toBe('?country=Nigeria&min=10000&from=2026-10-06');
    expect(bodyRows()).toHaveLength(0);
  });

  it('sorts by risk when the header is clicked, toggling direction', async () => {
    const user = userEvent.setup();
    renderDashboard();
    const header = () => within(mainTable()).getByRole('columnheader', { name: /Risk/ });

    await user.click(screen.getByRole('button', { name: /Risk/ }));
    expect(header()).toHaveAttribute('aria-sort', 'descending');
    const top = Math.max(...useFraudStore.getState().transactions.map((t) => t.riskScore));
    expect(bodyRows()[0]).toHaveTextContent(`· ${top}`);

    await user.click(screen.getByRole('button', { name: /Risk/ }));
    expect(header()).toHaveAttribute('aria-sort', 'ascending');
    expect(search()).toBe('?sort=score&dir=asc');
  });

  it('pages through results', async () => {
    const user = userEvent.setup();
    renderDashboard();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(search()).toBe('?page=2');
    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
  });

  it('re-scores live when a rule is disabled', () => {
    renderDashboard('?q=TX-10482');
    const before = must(useFraudStore.getState().transactions.find((t) => t.id === 'TX-10482'));
    expect(bodyRows()[0]).toHaveTextContent(`· ${before.riskScore}`);

    act(() => useFraudStore.getState().updateRule('time', { enabled: false }));
    expect(bodyRows()[0]).toHaveTextContent(`· ${before.riskScore - 10}`);
  });

  it('marks reviewed transactions in the status column', () => {
    useFraudStore.getState().saveReview('TX-10482', 'legitimate', '');
    renderDashboard('?q=TX-10482');
    expect(bodyRows()[0]).toHaveTextContent('Reviewed: legitimate');
  });

  it('leads with a review queue of unreviewed flagged transactions, riskiest first', () => {
    renderDashboard();
    const queue = within(screen.getByRole('list', { name: 'Transactions to review' }));
    const flagged = useFraudStore
      .getState()
      .transactions.filter((t) => t.riskScore > 25)
      .sort((a, b) => b.riskScore - a.riskScore);
    const items = queue.getAllByRole('link');
    expect(items[0]).toHaveTextContent(flagged[0]?.id ?? '');
    expect(items[0]).toHaveAttribute('href', `/tx/${flagged[0]?.id}`);
    expect(
      screen.getByText('Needs review', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent(String(flagged.length));
  });

  it('drops reviewed transactions from the queue and shows the empty state when done', () => {
    renderDashboard();
    const ids = useFraudStore
      .getState()
      .transactions.filter((t) => t.riskScore > 25)
      .map((t) => t.id);
    act(() => {
      for (const id of ids) useFraudStore.getState().saveReview(id, 'legitimate', '');
    });
    expect(screen.getByText('All caught up')).toBeInTheDocument();
    expect(
      screen.getByText('Needs review', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('0');
  });

  it('shows flagged counts per day in an accessible calendar table', () => {
    renderDashboard();
    const calendar = within(screen.getByRole('table', { name: 'Flagged by day' }));
    expect(calendar.getAllByRole('columnheader')).toHaveLength(7);
    expect(calendar.getByText(/^5 Oct 2026: \d+ flagged of \d+$/)).toBeInTheDocument();
  });
});
