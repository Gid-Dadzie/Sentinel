import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { createDefaultRules } from '@sentinel/engine';
import { routerFuture } from '../../routerFuture';
import { RAW_TRANSACTIONS, useFraudStore } from '../../state/useFraudStore';
import { triggerCounts } from '../../utils/rules';
import Rules from '../Rules';

function renderRules() {
  return render(
    <MemoryRouter future={routerFuture}>
      <Rules />
    </MemoryRouter>,
  );
}

const ruleCard = (name: string) => within(screen.getByRole('region', { name: new RegExp(name) }));
const storedRule = (id: string) => useFraudStore.getState().rules.find((r) => r.id === id);
const impactValue = (label: string) =>
  within(screen.getByRole('region', { name: 'Impact of your changes' })).getByText(label)
    .nextElementSibling;
const tx10482 = () => useFraudStore.getState().transactions.find((t) => t.id === 'TX-10482');

describe('Rules page', () => {
  beforeEach(() => {
    localStorage.clear();
    useFraudStore.getState().resetRules();
  });

  it('shows every rule with its condition, points and how often it fires', () => {
    renderRules();
    const counts = triggerCounts(RAW_TRANSACTIONS);
    for (const rule of createDefaultRules()) {
      const card = ruleCard(rule.name);
      expect(card.getByRole('switch')).toBeChecked();
      expect(card.getByRole('spinbutton', { name: 'Points' })).toHaveValue(rule.points);
      expect(
        card.getByText(new RegExp(`Fires on ${counts[rule.id]} transaction`)),
      ).toBeInTheDocument();
    }
    expect(screen.getByText('All rules are at their defaults.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeDisabled();
  });

  it('turning a rule off re-scores and shows the impact against defaults', async () => {
    const user = userEvent.setup();
    renderRules();
    const flaggedBefore = Number(impactValue('Flagged')?.textContent);

    await user.click(ruleCard('Unusual amount').getByRole('switch'));

    expect(storedRule('amount')?.enabled).toBe(false);
    expect(tx10482()?.riskScore).toBe(45);
    expect(ruleCard('Unusual amount').getByText('Off')).toBeInTheDocument();
    expect(ruleCard('Unusual amount').getByText('Changed')).toBeInTheDocument();
    expect(ruleCard('Unusual amount').getByRole('spinbutton')).toBeDisabled();
    expect(screen.getByText(/1 rule changed/)).toBeInTheDocument();
    // TX-10482 drops from 70 to 45: no longer pending, still flagged.
    expect(impactValue('Pending review')?.nextElementSibling).toHaveTextContent('−1');
    expect(Number(impactValue('Flagged')?.textContent)).toBeLessThanOrEqual(flaggedBefore);
  });

  it('typing points re-scores; blanks are ignored and out-of-range values are clamped', async () => {
    const user = userEvent.setup();
    renderRules();
    const box = ruleCard('Unusual time').getByRole('spinbutton', { name: 'Points' });

    await user.clear(box);
    expect(storedRule('time')?.points).toBe(10); // blank is not saved as 0

    await user.type(box, '40');
    expect(storedRule('time')?.points).toBe(40);
    expect(tx10482()?.riskScore).toBe(100);
    expect(ruleCard('Unusual time').getByText(/Default: 10 points, on/)).toBeInTheDocument();

    await user.clear(box);
    await user.type(box, '150');
    await user.tab();
    expect(storedRule('time')?.points).toBe(100);
    expect(box).toHaveValue(100);
  });

  it('reset restores every default', async () => {
    const user = userEvent.setup();
    renderRules();
    await user.click(ruleCard('New device').getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    expect(useFraudStore.getState().rules).toEqual(createDefaultRules());
    expect(ruleCard('New device').getByRole('switch')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeDisabled();
  });

  it('explains how scores map to decisions', () => {
    renderRules();
    const bands = within(screen.getByRole('table', { name: 'How scores become decisions' }));
    expect(bands.getAllByRole('row')).toHaveLength(5);
    expect(bands.getByText('76–100').closest('tr')).toHaveTextContent('Declined');
  });
});
