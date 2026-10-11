/** The transaction fields a file's columns can be mapped to. */
export const IMPORT_FIELDS = [
  {
    key: 'id',
    label: 'Transaction ID',
    required: true,
    aliases: ['transaction id', 'txn id', 'reference', 'ref', 'transaction ref', 'trx id'],
  },
  {
    key: 'accountId',
    label: 'Account ID',
    required: true,
    aliases: ['account', 'account id', 'account number', 'customer id', 'wallet id', 'wallet'],
  },
  {
    key: 'customerName',
    label: 'Customer name',
    required: false,
    aliases: ['customer name', 'name', 'customer', 'account name', 'holder name'],
  },
  {
    key: 'amount',
    label: 'Amount',
    required: true,
    aliases: ['amount', 'value', 'amt', 'transaction amount'],
  },
  { key: 'currency', label: 'Currency', required: false, aliases: ['currency', 'ccy', 'cur'] },
  {
    key: 'txnType',
    label: 'Transaction type',
    required: true,
    aliases: ['type', 'txn type', 'transaction type', 'trans type'],
  },
  {
    key: 'timestamp',
    label: 'Date and time',
    required: true,
    aliases: [
      'timestamp',
      'date',
      'datetime',
      'date time',
      'transaction date',
      'created at',
      'time',
    ],
  },
  {
    key: 'merchant',
    label: 'Merchant',
    required: false,
    aliases: ['merchant', 'merchant name', 'payee', 'beneficiary'],
  },
  { key: 'category', label: 'Category', required: false, aliases: ['category', 'mcc'] },
  { key: 'city', label: 'City', required: true, aliases: ['city', 'town', 'location'] },
  { key: 'country', label: 'Country', required: true, aliases: ['country'] },
  {
    key: 'deviceId',
    label: 'Device ID',
    required: true,
    aliases: ['device', 'device id', 'imei', 'handset'],
  },
  {
    key: 'senderMsisdn',
    label: 'Sender phone',
    required: true,
    aliases: ['sender', 'msisdn', 'sender msisdn', 'phone', 'sender phone', 'from', 'mobile'],
  },
  {
    key: 'recipientMsisdn',
    label: 'Recipient phone',
    required: false,
    aliases: ['recipient', 'receiver', 'recipient msisdn', 'recipient phone', 'to'],
  },
  {
    key: 'agentId',
    label: 'Agent ID',
    required: false,
    aliases: ['agent', 'agent id', 'agent code'],
  },
] as const;

export type FieldKey = (typeof IMPORT_FIELDS)[number]['key'];
export const FIELD_KEYS: readonly FieldKey[] = IMPORT_FIELDS.map((f) => f.key);

/** Which file column feeds each field. Unmapped optional fields are left out. */
export type ColumnMapping = Partial<Record<FieldKey, string>>;

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Best guess at a mapping from the file's headers; each header is used at most once. */
export function suggestMapping(headers: readonly string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const field of IMPORT_FIELDS) {
    const candidates = [field.key, field.label, ...field.aliases].map(normalize);
    const header = headers.find((h) => !used.has(h) && candidates.includes(normalize(h)));
    if (header !== undefined) {
      mapping[field.key] = header;
      used.add(header);
    }
  }
  return mapping;
}

/** Problems with a mapping as a whole, before any row is read. */
export function mappingProblems(mapping: ColumnMapping, headers: readonly string[]): string[] {
  const problems: string[] = [];
  for (const field of IMPORT_FIELDS) {
    const header = mapping[field.key];
    if (header === undefined) {
      if (field.required) problems.push(`${field.label} must be mapped to a column`);
    } else if (!headers.includes(header)) {
      problems.push(`${field.label} is mapped to "${header}", which is not in the file`);
    }
  }
  const seen = new Map<string, FieldKey>();
  for (const key of FIELD_KEYS) {
    const header = mapping[key];
    if (header === undefined) continue;
    const earlier = seen.get(header);
    if (earlier) problems.push(`Column "${header}" is mapped to both ${earlier} and ${key}`);
    else seen.set(header, key);
  }
  return problems;
}
