const SAFE_DIAGNOSTIC = 'operation_failed';

export function safeErrorDiagnostic(error) {
  if (error == null) return SAFE_DIAGNOSTIC;
  if (typeof error === 'object') return SAFE_DIAGNOSTIC;
  return SAFE_DIAGNOSTIC;
}

export { SAFE_DIAGNOSTIC };
