import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ImportPreview, ImportReport } from '../../api/types';
import { routerFuture } from '../../routerFuture';
import { fakeApi } from '../../test/fakeApi';
import Import from '../Import';

const PREVIEW: ImportPreview = {
  fileName: 'october.csv',
  format: 'csv',
  headers: ['Txn ID', 'Wallet', 'Value', 'Type', 'Date', 'Town', 'Country', 'IMEI', 'MSISDN'],
  sample: [
    ['TX-1', 'ACC-1', '850', 'payment', '2026-09-01 12:00', 'Accra', 'Ghana', 'D-1', '024****601'],
  ],
  rowCount: 3,
  fields: [
    { key: 'id', label: 'Transaction ID', required: true },
    { key: 'accountId', label: 'Account ID', required: true },
    { key: 'amount', label: 'Amount', required: true },
    { key: 'txnType', label: 'Transaction type', required: true },
    { key: 'timestamp', label: 'Date and time', required: true },
    { key: 'city', label: 'City', required: true },
    { key: 'country', label: 'Country', required: true },
    { key: 'deviceId', label: 'Device ID', required: true },
    { key: 'senderMsisdn', label: 'Sender phone', required: true },
    { key: 'merchant', label: 'Merchant', required: false },
  ],
  // "Value" was not recognised as the amount, so the analyst has to pick it.
  suggestedMapping: {
    id: 'Txn ID',
    accountId: 'Wallet',
    txnType: 'Type',
    timestamp: 'Date',
    city: 'Town',
    country: 'Country',
    deviceId: 'IMEI',
    senderMsisdn: 'MSISDN',
  },
};

const REPORT: ImportReport = {
  fileName: 'october.csv',
  totalRows: 3,
  imported: 1,
  flagged: 1,
  rejected: [{ row: 3, id: 'TX-BAD', problems: ['Amount must be more than zero'] }],
  duplicates: [{ row: 4, id: 'TX-1', problems: ['Same ID as row 2'] }],
};

const file = () => new File(['Txn ID,Wallet\nTX-1,ACC-1'], 'october.csv', { type: 'text/csv' });

function renderImport() {
  return render(
    <MemoryRouter future={routerFuture}>
      <Import />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Import page', () => {
  it('walks from file to mapping to report, sending the chosen mapping', async () => {
    const calls = fakeApi((url) =>
      url.pathname === '/api/imports/preview'
        ? { status: 200, body: PREVIEW }
        : { status: 201, body: REPORT },
    );
    const user = userEvent.setup();
    renderImport();

    await user.upload(screen.getByLabelText('Choose file'), file());

    // Suggested columns are pre-selected; the missing required field blocks the import.
    expect(await screen.findByLabelText('Column for Transaction ID')).toHaveValue('Txn ID');
    expect(screen.getByText('Choose a column for Amount')).toBeInTheDocument();
    const importButton = screen.getByRole('button', { name: 'Import 3 rows' });
    expect(importButton).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Column for Amount'), 'Value');
    expect(screen.queryByText('Choose a column for Amount')).not.toBeInTheDocument();
    const amountRow = screen.getByRole('row', { name: /Amount/ });
    expect(within(amountRow).getByText('850')).toBeInTheDocument(); // example from row 2

    await user.click(importButton);

    const sent = calls.at(-1);
    expect(sent?.url.pathname).toBe('/api/imports');
    expect(JSON.parse(sent?.url.searchParams.get('mapping') ?? '{}')).toEqual({
      ...PREVIEW.suggestedMapping,
      amount: 'Value',
    });
    expect(new Headers(sent?.init?.headers).get('X-File-Name')).toBe('october.csv');

    const result = await screen.findByRole('region', { name: 'Import result' });
    expect(within(result).getByText('Imported').nextElementSibling).toHaveTextContent('1');
    const rejected = screen.getByRole('region', { name: 'Rejected rows' });
    expect(within(rejected).getByText('Amount must be more than zero')).toBeInTheDocument();
    const duplicates = screen.getByRole('region', { name: 'Duplicates skipped' });
    expect(within(duplicates).getByText('Same ID as row 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import another file' }));
    expect(screen.getByLabelText('Choose file')).toBeInTheDocument();
  });

  it('flags a column chosen for two fields', async () => {
    fakeApi(() => ({ status: 200, body: PREVIEW }));
    const user = userEvent.setup();
    renderImport();
    await user.upload(screen.getByLabelText('Choose file'), file());

    await user.selectOptions(await screen.findByLabelText('Column for Merchant'), 'Town');
    expect(screen.getByText('"Town" is used for both City and Merchant')).toBeInTheDocument();
  });

  it("shows the server's message and details when the file is refused", async () => {
    fakeApi(() => ({
      status: 400,
      body: { error: 'Old .xls files are not supported. Save it as .xlsx or CSV.' },
    }));
    const user = userEvent.setup();
    renderImport();
    await user.upload(screen.getByLabelText('Choose file'), file());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Old .xls files are not supported. Save it as .xlsx or CSV.',
    );
    expect(screen.getByLabelText('Choose file')).toBeInTheDocument();
  });

  it('deletes every stored transaction only after confirming', async () => {
    let stored = 457;
    const calls = fakeApi((_url, init) => {
      if (init?.method === 'DELETE') {
        stored = 0;
        return { status: 200, body: { deleted: { transactions: 457, decisions: 2 } } };
      }
      return { status: 200, body: { items: [], total: stored, page: 1, pageCount: 1 } };
    });
    const user = userEvent.setup();
    renderImport();

    const card = within(await screen.findByRole('region', { name: 'Start over' }));
    expect(await card.findByText(/457 transactions stored/)).toBeInTheDocument();
    await user.click(card.getByRole('button', { name: 'Delete all transactions…' }));
    await user.click(card.getByRole('button', { name: 'Cancel' }));
    expect(calls.some((c) => c.init?.method === 'DELETE')).toBe(false);

    await user.click(card.getByRole('button', { name: 'Delete all transactions…' }));
    expect(card.getByRole('alertdialog')).toHaveTextContent('cannot be undone');
    await user.click(card.getByRole('button', { name: 'Yes, delete 457 transactions' }));

    expect(
      await card.findByText(
        'Deleted 457 transactions and 2 decisions. You can import a new file now.',
      ),
    ).toBeInTheDocument();
    const sent = calls.find((c) => c.init?.method === 'DELETE');
    expect(sent?.url.pathname).toBe('/api/transactions');
    expect(JSON.parse(String(sent?.init?.body))).toEqual({ confirm: 'delete all transactions' });
    expect(await card.findByText('No transactions are stored.')).toBeInTheDocument();
  });
});
