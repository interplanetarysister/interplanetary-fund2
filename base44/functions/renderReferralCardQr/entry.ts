import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import QRCode from 'npm:qrcode@1.5.4';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Generates a REAL QR with a fixed, first-party destination. It does not
// print an AI-drawn lookalike or depend on a third-party QR tracking service.
export default async function(req: Request) {
  if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const input = await req.json().catch(() => ({}));
    const code = String(input.code || '').trim().toUpperCase();
    if (!/^IF-[A-F0-9]{24}$/.test(code)) return Response.json({ error: 'Invalid card code.' }, { status: 400 });
    const cards = await base44.asServiceRole.entities.ReferralCard.filter({ code });
    if (!(cards || []).some((row: any) => row.code === code && row.status === 'available' && (row.issued_by_user_id === guard.user.id || guard.user.role === 'admin'))) {
      return Response.json({ error: 'Card not found or no longer available.' }, { status: 404 });
    }
    const url = 'https://interplanetaryfund.com/?ref=' + encodeURIComponent(code);
    const qrDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H', width: 360, margin: 3,
      color: { dark: '#07142D', light: '#FFFFFFFF' },
    });
    return Response.json({ ok: true, code, url, qr_data_url: qrDataUrl }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('renderReferralCardQr:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'QR code could not be generated.' }, { status: 503 });
  }
}
