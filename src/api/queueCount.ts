import { create } from 'zustand';
import { apiFetch } from './client';
import type { TransactionPage } from './types';

interface QueueCount {
  /** Flagged transactions still waiting for a verdict; null until first loaded. */
  count: number | null;
  refresh: () => void;
}

/** The review queue's size for the sidebar badge, refreshed on navigation and after decisions. */
export const useQueueCount = create<QueueCount>((set) => ({
  count: null,
  refresh: () => {
    apiFetch<TransactionPage>('/api/transactions?needsReview=1&pageSize=1').then(
      (page) => set({ count: page.total }),
      () => undefined, // The badge is a nicety; pages report their own errors.
    );
  },
}));
