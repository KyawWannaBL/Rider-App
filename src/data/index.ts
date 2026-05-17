// Minimal data stubs — no mock data, real data comes from Supabase
export interface Stop {
  id: string;
  address: string;
  status: 'pending' | 'completed' | 'failed';
}
// Empty — driver proof page computes completion from this array
export const mockStops: Stop[] = [];
