/** Approval authority comes only from the current human request and its explicit resource IDs. */
export function permitsAgentApproval(request: string | undefined, itemId: unknown): boolean {
  if (!request || typeof itemId !== "string" || !/^[0-9a-f-]{36}$/i.test(itemId)) return false;
  if (/\b(do\s+not|don't|never|without|not|avoid)\s+(?:\w+\s+){0,2}approv/i.test(request)) return false;
  return /\bapprove\b|\bmanzoor\b/i.test(request) &&
    (request.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? []).some(id => id.toLowerCase() === itemId.toLowerCase());
}
