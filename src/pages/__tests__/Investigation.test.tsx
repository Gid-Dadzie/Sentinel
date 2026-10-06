import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { routerFuture } from '../../routerFuture';
import { useFraudStore } from '../../state/useFraudStore';
import Investigation from '../Investigation';

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/tx/${id}`]} future={routerFuture}>
      <Routes>
        <Route path="/tx/:id" element={<Investigation />} />
      </Routes>
    </MemoryRouter>,
  );
}

const ruleResults = () => within(screen.getByRole('list', { name: 'Rule results' }));
const section = (name: string) => within(screen.getByRole('region', { name }));

describe('Investigation page', () => {
  beforeEach(() => {
    localStorage.clear();
    useFraudStore.getState().resetRules();
    useFraudStore.setState({ reviews: {} });
  });

  it('explains the score with every triggered rule and its points', () => {
    renderAt('TX-10482');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Transaction TX-10482' }),
    ).toBeInTheDocument();

    const score = section('Why this score');
    expect(score.getByText('70')).toBeInTheDocument();

    const items = ruleResults().getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent('+25');
    expect(items[0]).toHaveTextContent(/Unusual amount.*× this customer's average/);
    expect(ruleResults().getAllByText(/^\+\d+$/)).toHaveLength(4);
    expect(
      ruleResults()
        .getByText(/Rapid transactions/)
        .closest('li'),
    ).toHaveTextContent('Not triggered');
  });

  it('updates live when a rule is turned off', () => {
    renderAt('TX-10482');
    act(() => useFraudStore.getState().updateRule('time', { enabled: false }));

    expect(section('Why this score').getByText('60')).toBeInTheDocument();
    const timeRow = ruleResults().getByText('Unusual time').closest('li');
    expect(timeRow).toHaveTextContent('Off');
    expect(timeRow).toHaveTextContent('Rule is turned off');
  });

  it('explains when the score is capped at 100', () => {
    act(() => useFraudStore.getState().updateRule('amount', { points: 60 }));
    renderAt('TX-10138');
    expect(section('Why this score').getByText(/add up to 135 points/)).toBeInTheDocument();
  });

  it('shows the customer baseline and marks the new country and device', () => {
    renderAt('TX-10482');
    const baseline = section('Customer baseline');
    expect(baseline.getByText('Known countries').nextElementSibling).toHaveTextContent(
      /this is Nigeria\s*New/,
    );
    expect(baseline.getByText('Known devices').nextElementSibling).toHaveTextContent(
      /this is DEVICE-921\s*New/,
    );
  });

  it('lists recent activity with this transaction first and links to the profile', () => {
    renderAt('TX-10482');
    const activity = section('Recent account activity');
    const rows = activity.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveAttribute('aria-current', 'true');
    expect(rows[0]).toHaveTextContent('TX-10482');
    expect(rows.length).toBeGreaterThan(1);
    expect(activity.getByRole('link', { name: 'View full customer profile' })).toHaveAttribute(
      'href',
      '/customer/ACC-2001',
    );
  });

  it('saves and clears an analyst review', async () => {
    const user = userEvent.setup();
    renderAt('TX-10482');
    const review = section('Analyst review');

    await user.click(review.getByRole('button', { name: 'Save review' }));
    expect(review.getByRole('status')).toHaveTextContent('Choose a verdict before saving.');

    await user.click(review.getByRole('radio', { name: 'Confirmed fraud' }));
    await user.type(review.getByRole('textbox', { name: /Note/ }), 'Customer confirmed card theft');
    await user.click(review.getByRole('button', { name: 'Save review' }));

    expect(review.getByRole('status')).toHaveTextContent('Review saved.');
    expect(useFraudStore.getState().reviews['TX-10482']).toMatchObject({
      verdict: 'fraud',
      note: 'Customer confirmed card theft',
    });
    expect(review.getByText(/Confirmed fraud · saved/)).toBeInTheDocument();

    await user.click(review.getByRole('button', { name: 'Clear review' }));
    expect(useFraudStore.getState().reviews).toEqual({});
    expect(review.getByText('Not reviewed yet.')).toBeInTheDocument();
    expect(review.getByRole('radio', { name: 'Confirmed fraud' })).not.toBeChecked();
  });

  it('pre-fills a saved review', () => {
    useFraudStore.getState().saveReview('TX-10482', 'legitimate', 'Customer was travelling');
    renderAt('TX-10482');
    const review = section('Analyst review');
    expect(review.getByRole('radio', { name: /Legitimate/ })).toBeChecked();
    expect(review.getByRole('textbox', { name: /Note/ })).toHaveValue('Customer was travelling');
  });

  it('shows a not-found message for an unknown ID', () => {
    renderAt('TX-00000');
    expect(screen.getByRole('heading', { name: 'Transaction not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the dashboard' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
