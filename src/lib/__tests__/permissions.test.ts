import { describe, expect, it } from "vitest";
import { can, roleAtLeast } from "@/lib/permissions";

describe("roleAtLeast", () => {
  it("orders owner > admin > editor > viewer", () => {
    expect(roleAtLeast("owner", "admin")).toBe(true);
    expect(roleAtLeast("admin", "admin")).toBe(true);
    expect(roleAtLeast("editor", "admin")).toBe(false);
    expect(roleAtLeast("viewer", "editor")).toBe(false);
  });
});

describe("can", () => {
  it("lets viewers read the brand brain", () => {
    expect(can("viewer", "brand:read")).toBe(true);
  });

  it("blocks viewers from writing", () => {
    expect(can("viewer", "brand:write")).toBe(false);
    expect(can("viewer", "chat:use")).toBe(false);
  });

  it("lets editors write brand content and chat", () => {
    expect(can("editor", "brand:write")).toBe(true);
    expect(can("editor", "chat:use")).toBe(true);
  });

  it("reserves workspace management for admins and owners", () => {
    expect(can("editor", "workspace:manage")).toBe(false);
    expect(can("admin", "workspace:manage")).toBe(true);
    expect(can("owner", "workspace:manage")).toBe(true);
  });

  it("lets editors and above manage publishing connections", () => {
    expect(can("viewer", "publish:manage")).toBe(false);
    expect(can("editor", "publish:manage")).toBe(true);
    expect(can("admin", "publish:manage")).toBe(true);
    expect(can("owner", "publish:manage")).toBe(true);
  });
});
