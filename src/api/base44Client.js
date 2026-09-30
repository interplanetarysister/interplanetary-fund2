import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { runtimeContract } from '@/lib/runtimeContract';

const { token, functionsVersion } = appParams;
const appId = runtimeContract.appId || appParams.appId;
const appBaseUrl = runtimeContract.appBaseUrl || appParams.appBaseUrl;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: appBaseUrl,
  requiresAuth: false,
  appBaseUrl
});
