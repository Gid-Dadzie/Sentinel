import type { Transaction } from '../types';
import { CITIES, parseLocalTimestamp, type CityName } from '@sentinel/engine';
import { createRandom, type Random } from './random';

export const DATA_SEED = 20261005;
const CURRENCY = 'GHS';
const START = { year: 2026, monthIndex: 8, day: 1 }; // 1 Sep 2026
const DAYS = 35; // 1 Sep to 5 Oct inclusive
const NORMAL_PER_CUSTOMER = { min: 36, max: 39 };
const ANOMALY_BUFFER_MS = 12 * 60 * 60 * 1000;

export interface Customer {
  accountId: string;
  name: string;
  homeCity: CityName;
  averageAmount: number;
  devices: readonly string[];
}

export const CUSTOMERS: readonly Customer[] = [
  {
    accountId: 'ACC-2001',
    name: 'John Mensah',
    homeCity: 'Accra',
    averageAmount: 850,
    devices: ['DEVICE-114'],
  },
  {
    accountId: 'ACC-2002',
    name: 'Ama Owusu',
    homeCity: 'Kumasi',
    averageAmount: 420,
    devices: ['DEVICE-208', 'DEVICE-209'],
  },
  {
    accountId: 'ACC-2003',
    name: 'Kwame Asante',
    homeCity: 'Accra',
    averageAmount: 1200,
    devices: ['DEVICE-305'],
  },
  {
    accountId: 'ACC-2004',
    name: 'Efua Boateng',
    homeCity: 'Accra',
    averageAmount: 2300,
    devices: ['DEVICE-412'],
  },
  {
    accountId: 'ACC-2005',
    name: 'Yaw Darko',
    homeCity: 'Kumasi',
    averageAmount: 650,
    devices: ['DEVICE-517'],
  },
  {
    accountId: 'ACC-2006',
    name: 'Akosua Frimpong',
    homeCity: 'Accra',
    averageAmount: 300,
    devices: ['DEVICE-620', 'DEVICE-621'],
  },
  {
    accountId: 'ACC-2007',
    name: 'Kofi Annor',
    homeCity: 'Accra',
    averageAmount: 5000,
    devices: ['DEVICE-733'],
  },
  {
    accountId: 'ACC-2008',
    name: 'Abena Ofori',
    homeCity: 'Kumasi',
    averageAmount: 180,
    devices: ['DEVICE-845'],
  },
  {
    accountId: 'ACC-2009',
    name: 'Chidi Okafor',
    homeCity: 'Lagos',
    averageAmount: 900,
    devices: ['DEVICE-951'],
  },
  {
    accountId: 'ACC-2010',
    name: 'Wanjiru Kamau',
    homeCity: 'Nairobi',
    averageAmount: 1500,
    devices: ['DEVICE-064'],
  },
];

const MERCHANTS: readonly { category: string; names: readonly string[] }[] = [
  { category: 'groceries', names: ['City Supermarket', 'Fresh Market', 'Corner Shop'] },
  { category: 'fuel', names: ['Fuel Station', 'Highway Fuel'] },
  { category: 'dining', names: ['Jollof Kitchen', 'Waakye Spot', 'Pizza Place'] },
  { category: 'utilities', names: ['Electricity Prepaid', 'Water Company'] },
  { category: 'telecom', names: ['Airtime Top-up', 'Data Bundle'] },
  { category: 'transport', names: ['Ride Share', 'Bus Terminal'] },
  { category: 'shopping', names: ['Clothing Store', 'Pharmacy', 'Home Goods'] },
];

interface Injected {
  accountId: string;
  timestamp: string;
  city: CityName;
  amount: number;
  merchant: string;
  category: string;
  deviceId: string;
  id?: string;
}

/**
 * Hand-placed anomalies. Expected default scores are noted for reference;
 * the real scores always come from the engine.
 */
const INJECTED: readonly Injected[] = [
  // Fixed example: amount + time + country + device = 70 (high).
  {
    id: 'TX-10482',
    accountId: 'ACC-2001',
    timestamp: '2026-10-05T02:34:00',
    city: 'Lagos',
    amount: 15_400,
    merchant: 'Electronics Store',
    category: 'electronics',
    deviceId: 'DEVICE-921',
  },
  // Large foreign night transaction on a known device: amount + time + country = 55 (high).
  {
    accountId: 'ACC-2002',
    timestamp: '2026-09-22T03:12:00',
    city: 'Dubai',
    amount: 5_600,
    merchant: 'Luxury Boutique',
    category: 'shopping',
    deviceId: 'DEVICE-208',
  },
  // 4 transactions in 4 minutes at night on a new device: the 4th scores time + rapid = 30 (medium).
  {
    accountId: 'ACC-2003',
    timestamp: '2026-09-27T01:10:00',
    city: 'Accra',
    amount: 1_050,
    merchant: 'Online Gift Cards',
    category: 'digital',
    deviceId: 'DEVICE-399',
  },
  {
    accountId: 'ACC-2003',
    timestamp: '2026-09-27T01:11:00',
    city: 'Accra',
    amount: 980,
    merchant: 'Online Gift Cards',
    category: 'digital',
    deviceId: 'DEVICE-399',
  },
  {
    accountId: 'ACC-2003',
    timestamp: '2026-09-27T01:12:00',
    city: 'Accra',
    amount: 1_100,
    merchant: 'Online Gift Cards',
    category: 'digital',
    deviceId: 'DEVICE-399',
  },
  {
    accountId: 'ACC-2003',
    timestamp: '2026-09-27T01:14:00',
    city: 'Accra',
    amount: 1_020,
    merchant: 'Online Gift Cards',
    category: 'digital',
    deviceId: 'DEVICE-399',
  },
  // Accra, then London one hour later on a new device with a large amount: 100 (critical).
  {
    accountId: 'ACC-2004',
    timestamp: '2026-09-14T00:40:00',
    city: 'Accra',
    amount: 1_900,
    merchant: 'Fuel Station',
    category: 'fuel',
    deviceId: 'DEVICE-412',
  },
  {
    accountId: 'ACC-2004',
    timestamp: '2026-09-14T01:40:00',
    city: 'London',
    amount: 18_500,
    merchant: 'Jewellery Store',
    category: 'shopping',
    deviceId: 'DEVICE-499',
  },
  // New-device purchase at home, daytime, 6.5x average: amount + device = 40 (medium).
  {
    accountId: 'ACC-2005',
    timestamp: '2026-10-02T15:20:00',
    city: 'Kumasi',
    amount: 4_200,
    merchant: 'Phone Shop',
    category: 'electronics',
    deviceId: 'DEVICE-588',
  },
];

function toLocalIso(dayOffset: number, hour: number, minute: number): string {
  const ms = Date.UTC(START.year, START.monthIndex, START.day + dayOffset, hour, minute);
  return new Date(ms).toISOString().slice(0, 19);
}

/** Cities in the customer's home country; the home city is most common. */
function pickCity(rng: Random, home: CityName): CityName {
  const country = CITIES[home].country;
  const nearby = (Object.keys(CITIES) as CityName[]).filter(
    (city) => city !== home && CITIES[city].country === country,
  );
  return nearby.length > 0 && rng.chance(0.15) ? rng.pick(nearby) : home;
}

function normalTransactions(rng: Random, customer: Customer, blocked: readonly number[]) {
  const count = rng.int(NORMAL_PER_CUSTOMER.min, NORMAL_PER_CUSTOMER.max);
  const used = new Set<string>();
  const result: Omit<Transaction, 'id'>[] = [];

  while (result.length < count) {
    const timestamp = toLocalIso(rng.int(0, DAYS - 1), rng.int(6, 21), rng.int(0, 59));
    const ms = parseLocalTimestamp(timestamp).ms;
    if (used.has(timestamp) || blocked.some((b) => Math.abs(b - ms) < ANOMALY_BUFFER_MS)) continue;
    used.add(timestamp);

    const { category, names } = rng.pick(MERCHANTS);
    const city = pickCity(rng, customer.homeCity);
    result.push({
      accountId: customer.accountId,
      customerName: customer.name,
      amount: Math.max(1, Math.round(customer.averageAmount * (0.4 + rng.next() * 1.2))),
      currency: CURRENCY,
      merchant: rng.pick(names),
      category,
      location: { city, country: CITIES[city].country },
      timestamp,
      deviceId: rng.pick(customer.devices),
      status: 'approved',
    });
  }
  return result;
}

function injectedTransaction(spec: Injected): Omit<Transaction, 'id'> & { id?: string } {
  const customer = CUSTOMERS.find((c) => c.accountId === spec.accountId);
  if (!customer) throw new Error(`Unknown account ${spec.accountId}`);
  return {
    id: spec.id,
    accountId: spec.accountId,
    customerName: customer.name,
    amount: spec.amount,
    currency: CURRENCY,
    merchant: spec.merchant,
    category: spec.category,
    location: { city: spec.city, country: CITIES[spec.city].country },
    timestamp: spec.timestamp,
    deviceId: spec.deviceId,
    status: 'approved',
  };
}

/**
 * Deterministic simulated transactions in chronological order, unscored.
 * IDs run from TX-10001 in time order; fixed IDs (TX-10482) are kept as given.
 */
export function generateTransactions(seed = DATA_SEED): Transaction[] {
  const rng = createRandom(seed);

  const drafts = CUSTOMERS.flatMap((customer) => {
    const blocked = INJECTED.filter((a) => a.accountId === customer.accountId).map(
      (a) => parseLocalTimestamp(a.timestamp).ms,
    );
    return normalTransactions(rng, customer, blocked);
  });
  const all: (Omit<Transaction, 'id'> & { id?: string })[] = [
    ...drafts,
    ...INJECTED.map(injectedTransaction),
  ];

  all.sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp) || a.accountId.localeCompare(b.accountId),
  );

  const fixedIds = new Set(INJECTED.flatMap((a) => (a.id ? [a.id] : [])));
  let next = 10001;
  const nextId = () => {
    while (fixedIds.has(`TX-${next}`)) next += 1;
    return `TX-${next++}`;
  };

  return all.map((tx) => ({ ...tx, id: tx.id ?? nextId() }));
}
