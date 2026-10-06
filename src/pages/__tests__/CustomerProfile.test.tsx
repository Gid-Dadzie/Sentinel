import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { routerFuture } from '../../routerFuture';
import { useFraudStore } from '../../state/useFraudStore';
import { formatDate } from '../../utils/format';
import CustomerProfile from '../CustomerProfile';

function renderAt(accountId: string) {
  return render(
    <MemoryRouter initialEntries={[`/customer/${accountId}`]} future={routerFuture}>
      <Routes>
        <Route path="/customer/:accountId" element={<CustomerProfile />} />
      </Routes>
    </MemoryRouter>,
  );
}

const section = (name: string) => within(screen.getByRole('region', { name }));
const accountTxs = (accountId: string) =>
  useFraudStore.getState().transactions.filter((t) => t.accountId === accountId);

describe('Customer profile page', () => {
  beforeEach(() => {
    localStorage.clear();
    useFraudStore.getState().resetRules();
    useFraudStore.setState({ reviews: {} });
  });

  it('shows the customer header and headline numbers', () => {
    renderAt('ACC-2001');
    expect(screen.getByRole('heading', { level: 1, name: 'John Mensah' })).toBeInTheDocument();
    const txs = accountTxs('ACC-2001');
    expect(screen.getByRole('heading', { level: 1 }).nextElementSibling).toHaveTextContent(
      `ACC-2001 · active ${formatDate(txs[0]?.timestamp ?? '')} – ${formatDate(txs[txs.length - 1]?.timestamp ?? '')}`,
    );

    const tiles = section('Summary');
    const count = accountTxs('ACC-2001').length;
    expect(tiles.getByText('Transactions').nextElementSibling).toHaveTextContent(String(count));
    expect(tiles.getByText('Flagged').nextElementSibling).toHaveTextContent('1');
    expect(tiles.getByText('Highest score 70')).toBeInTheDocument();
  });

  it('lists flagged transactions with the rules that fired', () => {
    renderAt('ACC-2001');
    const flagged = section('Flagged transactions');
    const items = flagged.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(flagged.getByRole('link', { name: 'TX-10482' })).toHaveAttribute('href', '/tx/TX-10482');
    expect(items[0]).toHaveTextContent(
      'Unusual amount +25 · Unusual time +10 · New country +20 · New device +15',
    );
  });

  it('shows analyst verdicts and counts confirmed fraud', () => {
    useFraudStore.getState().saveReview('TX-10482', 'fraud', '');
    renderAt('ACC-2001');
    expect(section('Flagged transactions').getByText('Reviewed: fraud')).toBeInTheDocument();
    expect(section('Summary').getByText('Confirmed fraud').nextElementSibling).toHaveTextContent(
      '1',
    );
  });

  it('updates the flagged list live when rules change', () => {
    renderAt('ACC-2001');
    act(() => {
      for (const id of ['amount', 'country', 'device'] as const) {
        useFraudStore.getState().updateRule(id, { enabled: false });
      }
    });
    expect(
      section('Flagged transactions').getByText('Nothing flagged for this customer.'),
    ).toBeInTheDocument();
  });

  it('summarises usual countries and devices', () => {
    renderAt('ACC-2001');
    const behaviour = section('Usual behaviour');
    const countries = within(behaviour.getByRole('list', { name: 'Countries' }));
    const items = countries.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Ghana');
    expect(items[1]).toHaveTextContent(/Nigeria\s*1/);
    expect(behaviour.getByText('DEVICE-921')).toBeInTheDocument();
  });

  it('shows only this customer in the history table, without a customer column', async () => {
    const user = userEvent.setup();
    renderAt('ACC-2001');
    const table = screen.getByRole('table', { name: 'Transaction history' });
    expect(within(table).queryByRole('columnheader', { name: 'Customer' })).toBeNull();
    expect(screen.getByText(`${accountTxs('ACC-2001').length} transactions`)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Flagged only' }));
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('TX-10482');
  });

  it('shows a not-found message for an unknown account', () => {
    renderAt('ACC-9999');
    expect(screen.getByRole('heading', { name: 'Customer not found' })).toBeInTheDocument();
  });
});
