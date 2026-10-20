// Shared in-memory synchronization store for Vercel Serverless Functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SharedSyncState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canonicalServerState: any;
  serverEventSequence: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recentMutations: any[];
}

export const syncStore: SharedSyncState = {
  canonicalServerState: null,
  serverEventSequence: 1000,
  recentMutations: [],
};
