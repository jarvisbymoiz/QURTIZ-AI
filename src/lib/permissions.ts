export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

const ROLE_LEVEL: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

/**
 * Permission catalogue for M1. Each capability declares the minimum role.
 */
export type Capability =
  | "brand:read"        // view Brand Brain / Memory
  | "brand:write"       // edit Brand Brain / Memory content
  | "workspace:manage"  // rename workspace, manage settings, invite (later)
  | "chat:use"          // use the AI chat (writes memory via agent)
  | "publish:manage";   // switch publishing provider, connect/disconnect accounts (editor+)

const CAPABILITY_MIN_LEVEL: Record<Capability, number> = {
  "brand:read": 0,
  "chat:use": 1,
  "brand:write": 1,
  "workspace:manage": 2,
  "publish:manage": 1,
};

export function roleAtLeast(role: WorkspaceRole, min: WorkspaceRole): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[min];
}

export function can(role: WorkspaceRole, capability: Capability): boolean {
  return ROLE_LEVEL[role] >= CAPABILITY_MIN_LEVEL[capability];
}
