export interface CityInfo {
  country: string;
  lat: number;
  lon: number;
}

/** Fixed city table used for impossible-travel checks and data generation. */
export const CITIES = {
  Accra: { country: 'Ghana', lat: 5.6037, lon: -0.187 },
  Kumasi: { country: 'Ghana', lat: 6.6885, lon: -1.6244 },
  Lagos: { country: 'Nigeria', lat: 6.5244, lon: 3.3792 },
  London: { country: 'United Kingdom', lat: 51.5074, lon: -0.1278 },
  Nairobi: { country: 'Kenya', lat: -1.2921, lon: 36.8219 },
  Dubai: { country: 'United Arab Emirates', lat: 25.2048, lon: 55.2708 },
} as const satisfies Record<string, CityInfo>;

export type CityName = keyof typeof CITIES;

export function getCity(name: string): CityInfo | undefined {
  return Object.prototype.hasOwnProperty.call(CITIES, name) ? CITIES[name as CityName] : undefined;
}
