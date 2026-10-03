export function boundedStringList(value, maxItems = 40, maxLength = 128) {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const normalized = item.trim();
    if (!normalized || normalized.length > maxLength) return null;
    if (!result.includes(normalized)) result.push(normalized);
  }
  return result;
}
