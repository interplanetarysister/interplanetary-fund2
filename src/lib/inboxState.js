import { base44 } from '@/api/base44Client';

// Shared by the inbox, notifications page, and bell; server derives ownership.
export async function updateInboxState(request) {
  const { data } = await base44.functions.invoke('updateInboxState', request);
  if (data?.success !== true) throw new Error('Unable to update inbox. Please try again.');
  return data;
}
