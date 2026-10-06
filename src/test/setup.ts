import '@testing-library/jest-dom/vitest';

// jsdom has no layout engine; Recharts' ResponsiveContainer only needs the constructor to exist.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;
