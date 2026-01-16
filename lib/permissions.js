
export async function ensurePermissions(request = {}) {
  const permissions = Array.isArray(request.permissions) ? request.permissions.filter(Boolean) : [];
  const origins = Array.isArray(request.origins) ? request.origins.filter(Boolean) : [];
  if (permissions.length === 0 && origins.length === 0) return true;
  const descriptor = {};
  if (permissions.length > 0) descriptor.permissions = permissions;
  if (origins.length > 0) descriptor.origins = origins;
  try {
    const alreadyGranted = await chrome.permissions.contains(descriptor);
    if (alreadyGranted) return true;
    return await chrome.permissions.request(descriptor);
  } catch (error) {
    console.error('❌ ensurePermissions failed:', error);
    return false;
  }
}

export async function ensureOriginPermission(url) {
  if (!url || !url.startsWith('http')) return false;
  try {
    const parsed = new URL(url);
    const originPattern = `${parsed.origin}/*`;
    return ensurePermissions({ origins: [originPattern] });
  } catch (e) { return false; }
}
