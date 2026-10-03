export function createTrustedBase44Client(config, createClientImpl) {
  const appId = String(config?.appId || '').trim();
  if (!appId) return null;
  return createClientImpl({ ...config, appId });
}
