# Node.js release baseline decision history (updated 2026-10-28)

- Current project runtime policy is Node **20 or newer**. The primary GitHub quality lane tests Node 24, and the preserved `Node current compatibility build` check performs a real Node 20 locked install and production build.
- Firebase 13 previously raised the locked dependency floor to Node 24.12. The web dependency is now pinned to the verified Firebase 12.19 line so Node 20/22 remain installable. Re-entering Firebase 13 requires a deliberate runtime-policy decision and compatibility evidence.
- Version files select Node 24 as the current local/primary tested major; they do not raise the declared `>=20` application minimum or prove a hosted provider runtime.
- A Base44 development sandbox was observed at Node 24.22.0. Base44 controls its internal automatic publisher, so repository selectors are a request rather than proof of that publisher's runtime.
- Cloudflare Workers Builds was previously observed using Node 24.18.0 and successfully building IFund. Treat that as historical environment evidence until reconfirmed, not a guaranteed current provider state.
- Verify clean locked dependency installation, both Node lanes, runtime contract and negative tests, production build, release postchecks, and final deployment before claiming production readiness.
- Runtime migration must not modify donations, processor reconciliation, fees, beneficiaries, financial records, or payout algorithms. The withdrawal fee remains 3%.
