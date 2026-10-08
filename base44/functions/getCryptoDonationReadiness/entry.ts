export default async function (_req: Request): Promise<Response> {
  return Response.json({ crypto: { wallet_provider: 'reown_appkit', verified_checkout_live: false, settlement_ready: false, status: 'awaiting_verified_settlement_gateway' } }, { headers: { 'Cache-Control': 'no-store' } });
}
