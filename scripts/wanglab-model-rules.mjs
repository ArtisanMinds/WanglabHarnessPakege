export function isWanglabEndpoint(baseURL) {
  try {
    const url = new URL(baseURL);
    return url.protocol === 'https:' && url.hostname === '10.201.2.89'
      && ['31415', '31416', '31417', '31418'].includes(url.port);
  } catch {
    return false;
  }
}

// Only metadata is matched. Model IDs always come from the connected endpoint.
export function modelDefaults(catalog, provider, id) {
  const exact = catalog.get(id);
  if (exact) return exact;
  let pattern;
  if (provider === 'openai' && /^gpt-[5-9](?:[.-]|$)/.test(id)) {
    const variant = id.match(/-(mini|nano|pro|chat-latest)(?:-|$)/)?.[1];
    pattern = variant ? new RegExp(`^gpt-\\d+(?:\\.\\d+)?-${variant}$`) : /^gpt-\d+(?:\.\d+)?$/;
  } else if (provider === 'anthropic') {
    const family = id.match(/^claude-(opus|sonnet|haiku|fable)-/)?.[1];
    if (family) pattern = new RegExp(`^claude-${family}-\\d+(?:-\\d+)?$`);
  }
  if (!pattern) return undefined;
  return [...catalog.values()].filter(model => pattern.test(model.id))
    .sort((a, b) => b.id.localeCompare(a.id, 'en', { numeric: true }))[0];
}
