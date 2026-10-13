/** Storage keys are opaque, unencoded paths; reject URL-normalization ambiguity. */
export function isWorkspaceStorageKey(path: unknown, workspaceId: string): path is string {
  if (typeof path !== "string" || path.length > 1024 || /[\\%?#\u0000-\u001f\u007f]/.test(path)) return false;
  const segments = path.split("/");
  return segments[0] === workspaceId && segments.length > 1 &&
    segments.every(segment => segment.length > 0 && segment !== "." && segment !== "..");
}
