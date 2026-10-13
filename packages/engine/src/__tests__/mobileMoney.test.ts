import { calculateFraudRisk } from '../calculateFraudRisk';
import {
  airtimeBurst,
  manyRecipients,
  newAgentLargeCashOut,
  rapidCashOut,
  structuring,
} from '../mobileMoney';
import type { RuleCheck } from '../ruleContext';
import { createDefaultRules } from '../rules';
import { makeHistory, makeTx, onlyRules, ruleIds } from '../testing';
import { parseLocalTimestamp } from '../time';
import type { Transaction } from '../types';

/** Runs one check the way calculateFraudRisk does: history is earlier, oldest first. */
function check(rule: RuleCheck, transaction: Transaction, history: Transaction[]) {
  const { ms, hour, minute } = parseLocalTimestamp(transaction.timestamp);
  return rule({ transaction, history, nowMs: ms, hour, minute });
}

const at = (time: string, day = '15') => `2026-09-${day}T${time}:00`;

describe('rapid cash-out', () => {
  const cashIn = (amount: number, time: string) =>
    makeTx({ txnType: 'cash_in', amount, timestamp: at(time), agentId: 'AG-1' });
  const cashOut = (amount: number, time: string) =>
    makeTx({ txnType: 'cash_out', amount, timestamp: at(time), agentId: 'AG-1' });

  it('triggers on a cash-out of 80% of a cash-in 30 minutes earlier', () => {
    expect(check(rapidCashOut, cashOut(800, '12:30'), [cashIn(1000, '12:00')])).toBe(
      'Cash-out of GHS 800 is 80% of the GHS 1,000 cashed in 30 min earlier.',
    );
  });

  it('does not trigger just under 80%', () => {
    expect(check(rapidCashOut, cashOut(799, '12:30'), [cashIn(1000, '12:00')])).toBeNull();
  });

  it('does not trigger once the cash-in is more than 30 minutes old', () => {
    expect(check(rapidCashOut, cashOut(1000, '12:31'), [cashIn(1000, '12:00')])).toBeNull();
  });

  it('adds up every cash-in in the window', () => {
    const history = [cashIn(500, '12:00'), cashIn(500, '12:10')];
    expect(check(rapidCashOut, cashOut(900, '12:20'), history)).toMatch(
      /90% of the GHS 1,000 cashed in 20 min earlier/,
    );
  });

  it('ignores anything other than a cash-out, and transfers in the window', () => {
    expect(
      check(rapidCashOut, makeTx({ txnType: 'transfer', amount: 1000, timestamp: at('12:10') }), [
        cashIn(1000, '12:00'),
      ]),
    ).toBeNull();
    const transferOnly = makeTx({ txnType: 'transfer', amount: 1000, timestamp: at('12:00') });
    expect(check(rapidCashOut, cashOut(1000, '12:10'), [transferOnly])).toBeNull();
  });
});

describe('many recipients', () => {
  const send = (recipient: string, time: string) =>
    makeTx({ txnType: 'transfer', recipient, timestamp: at(time) });
  const four = ['024****001', '024****002', '024****003', '024****004'].map((r, i) =>
    send(r, `12:0${i}`),
  );

  it('triggers on the fifth different recipient within 60 minutes', () => {
    expect(check(manyRecipients, send('024****005', '12:59'), four)).toBe(
      'Transfers to 5 different recipients within 60 minutes, including this one.',
    );
  });

  it('does not trigger with four', () => {
    expect(check(manyRecipients, send('024****004', '12:10'), four.slice(0, 3))).toBeNull();
  });

  it('counts each recipient once', () => {
    const repeats = four.map((tx) => ({ ...tx, recipient: '024****001' }));
    expect(check(manyRecipients, send('024****002', '12:10'), repeats)).toBeNull();
  });

  it('only looks back 60 minutes', () => {
    expect(check(manyRecipients, send('024****005', '13:01'), four)).toBeNull();
  });

  it('needs a transfer with a recipient', () => {
    expect(
      check(manyRecipients, makeTx({ txnType: 'transfer', timestamp: at('12:10') }), four),
    ).toBeNull();
    expect(
      check(
        manyRecipients,
        makeTx({ txnType: 'payment', recipient: 'x', timestamp: at('12:10') }),
        four,
      ),
    ).toBeNull();
  });
});

describe('new agent, large cash-out', () => {
  // Three earlier cash-ins of 100 at the account's usual agent: average 100.
  const usual = makeHistory(3, 100).map((tx) => ({
    ...tx,
    txnType: 'cash_in' as const,
    agentId: 'AG-1',
  }));
  const cashOut = (amount: number, agentId: string) =>
    makeTx({ txnType: 'cash_out', amount, agentId, timestamp: at('12:00', '20') });

  it('triggers above 3× the average at an agent never used', () => {
    expect(check(newAgentLargeCashOut, cashOut(301, 'AG-9'), usual)).toBe(
      'Cash-out of GHS 301 at agent AG-9, never used by this account, is 3.0× its average of GHS 100.',
    );
  });

  it('does not trigger at exactly 3×', () => {
    expect(check(newAgentLargeCashOut, cashOut(300, 'AG-9'), usual)).toBeNull();
  });

  it('does not trigger at an agent used before', () => {
    expect(check(newAgentLargeCashOut, cashOut(5000, 'AG-1'), usual)).toBeNull();
  });

  it('needs at least 3 earlier transactions', () => {
    expect(check(newAgentLargeCashOut, cashOut(5000, 'AG-9'), usual.slice(0, 2))).toBeNull();
  });

  it('needs a cash-out with an agent', () => {
    expect(
      check(
        newAgentLargeCashOut,
        makeTx({ txnType: 'cash_out', amount: 5000, timestamp: at('12:00', '20') }),
        usual,
      ),
    ).toBeNull();
  });
});

describe('airtime burst', () => {
  const airtime = (time: string) => makeTx({ txnType: 'airtime', amount: 20, timestamp: at(time) });
  const four = ['12:00', '12:02', '12:04', '12:06'].map(airtime);

  it('triggers on the fifth airtime purchase within 10 minutes', () => {
    expect(check(airtimeBurst, airtime('12:10'), four)).toBe(
      '5 airtime purchases within 10 minutes, including this one.',
    );
  });

  it('does not trigger on the fourth', () => {
    expect(check(airtimeBurst, airtime('12:08'), four.slice(0, 3))).toBeNull();
  });

  it('only looks back 10 minutes', () => {
    expect(check(airtimeBurst, airtime('12:11'), four)).toBeNull();
  });

  it('counts airtime only', () => {
    const payments = four.map((tx) => ({ ...tx, txnType: 'payment' as const }));
    expect(check(airtimeBurst, airtime('12:10'), payments)).toBeNull();
  });
});

describe('structuring', () => {
  const near = (amount: number, time: string, day = '15') =>
    makeTx({ txnType: 'transfer', amount, timestamp: at(time, day) });
  const two = [near(9500, '09:00'), near(9800, '11:00')];

  it('triggers on the third amount just under the limit within 24 hours', () => {
    expect(check(structuring, near(9000, '15:00'), two)).toBe(
      '3 transactions within 24 hours, each just under the 10,000 reporting limit, including this one.',
    );
  });

  it('does not count amounts under 90% of the limit', () => {
    expect(check(structuring, near(8999, '15:00'), two)).toBeNull();
  });

  it('does not count amounts at or over the limit', () => {
    expect(check(structuring, near(10_000, '15:00'), two)).toBeNull();
    expect(
      check(structuring, near(9500, '15:00'), [near(10_000, '09:00'), near(9800, '11:00')]),
    ).toBeNull();
  });

  it('only looks back 24 hours', () => {
    expect(check(structuring, near(9900, '09:01', '16'), two)).toBeNull();
  });

  it('needs mobile money data', () => {
    const plain = (amount: number, time: string) => makeTx({ amount, timestamp: at(time) });
    expect(
      check(structuring, plain(9900, '15:00'), [plain(9500, '09:00'), plain(9800, '11:00')]),
    ).toBeNull();
  });
});

describe('mobile money rules in the scorer', () => {
  it('add their points and reasons like any other rule, and can be switched off', () => {
    const history = [
      makeTx({ txnType: 'cash_in', amount: 1000, agentId: 'AG-1', timestamp: at('12:00') }),
    ];
    const tx = makeTx({
      txnType: 'cash_out',
      amount: 950,
      agentId: 'AG-1',
      timestamp: at('12:05'),
    });

    const on = calculateFraudRisk(tx, history, onlyRules('cashout'));
    expect(ruleIds(on.reasons)).toEqual(['cashout']);
    expect(on.score).toBe(25);

    const off = calculateFraudRisk(tx, history, onlyRules());
    expect(off.reasons).toEqual([]);
  });

  it('never fire on transactions without mobile money details', () => {
    // A burst of plain transactions near the limit, as the demo data might have.
    const history = ['12:00', '12:02', '12:04', '12:06'].map((time) =>
      makeTx({ amount: 9500, timestamp: at(time) }),
    );
    const result = calculateFraudRisk(makeTx({ amount: 9600, timestamp: at('12:08') }), history, [
      ...onlyRules('cashout', 'recipients', 'agent', 'airtime', 'structuring'),
    ]);
    expect(result.reasons).toEqual([]);
    expect(createDefaultRules()).toHaveLength(11);
  });
});
