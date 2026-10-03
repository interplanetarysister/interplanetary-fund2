import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { runtimeContract } from '@/lib/runtimeContract';
import { createTrustedBase44Client } from '@/lib/base44RuntimeClient';

const { token, functionsVersion } = appParams;
// Application identity is part of the build-owned runtime contract. Query
// parameters and localStorage are caller-controlled and may carry only session
// material; they must never select another Base44 application's data plane.
const appId = runtimeContract.appId;
// Network destinations must come only from the build-owned runtime contract.
// Query/localStorage app parameters are caller-controlled and must never choose
// where an access token is sent.
const appBaseUrl = runtimeContract.appBaseUrl;

// Base44's own hosted app should use the SDK's native endpoint selection.
// Alternate hosts (Cloudflare/custom domains) may route to the canonical Base44
// data plane explicitly. Do not force Base44-hosted authentication through an
// environment override: that can break otherwise-valid login sessions.
const isNativeBase44Host =
  typeof window !== 'undefined' &&
  /(?:^|\.)base44\.app$/i.test(window.location.hostname);

const clientConfig = {
  appId,
  token,
  functionsVersion,
  requiresAuth: false,
  ...(appBaseUrl ? { appBaseUrl } : {})
};

if (!isNativeBase44Host && appBaseUrl) {
  clientConfig.serverUrl = appBaseUrl;
}

// A missing build identity is a fatal configuration state. Do not construct an
// SDK client that would emit X-App-Id: "undefined" or address /apps/undefined.
// AuthContext renders the safe application error before any route can use it.
export const base44 = createTrustedBase44Client(clientConfig, createClient);
