import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { schemaDriftCode } from "../schema-drift";
import { DatabaseUpdateRequired, withSchemaGuard } from "@/components/system/schema-guard";

const wrapped = (code: string) => new Error("SQL with private parameters", {
  cause: new Error("query failed", { cause: { code } }),
});

afterEach(() => vi.restoreAllMocks());

describe("schema drift classification", () => {
  it.each(["42P01", "42703"])("recognizes direct and Drizzle-wrapped %s", (code) => {
    expect(schemaDriftCode({ code })).toBe(code);
    expect(schemaDriftCode(wrapped(code))).toBe(code);
  });
  it.each(["42501", "23505", "08006", "53300", "ECONNRESET", "42883"])("does not hide %s", (code) => {
    expect(schemaDriftCode(wrapped(code))).toBeNull();
  });
  it.each([null, undefined, "42703", new Error('column "secret" does not exist'), {}])("rejects untyped errors: %s", (error) => {
    expect(schemaDriftCode(error)).toBeNull();
  });
  it("terminates on cyclic or excessively deep cause chains", () => {
    const cycle: { cause?: unknown } = {};
    cycle.cause = cycle;
    expect(schemaDriftCode(cycle)).toBeNull();
    let deep: unknown = { code: "42703" };
    for (let i = 0; i < 100; i++) deep = { cause: deep };
    expect(schemaDriftCode(deep)).toBeNull();
  });
});

describe("server render schema guard", () => {
  it("preserves props and successful render results without logging", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const element = createElement("p", null, "actual data");
    const render = vi.fn(async (props: { id: string }) => { expect(props.id).toBe("tenant"); return element; });
    expect(await withSchemaGuard("test", render)({ id: "tenant" })).toBe(element);
    expect(render).toHaveBeenCalledWith({ id: "tenant" });
    expect(log).not.toHaveBeenCalled();
  });
  it.each(["42P01", "42703"])("renders an honest, sanitized state for %s", async (code) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await withSchemaGuard("test", async () => { throw wrapped(code); })({});
    expect(renderToStaticMarkup(result)).toContain("Database update required");
    expect(renderToStaticMarkup(result)).not.toContain("private parameters");
    expect(log).toHaveBeenCalledExactlyOnceWith("[qurtiz schema drift]", { scope: "test", code });
  });
  it.each([
    new Error("NEXT_REDIRECT"), new Error("NEXT_HTTP_ERROR_FALLBACK;404"),
    wrapped("42501"), wrapped("08006"), new Error("bug"),
  ])("rethrows unrelated errors and Next control flow unchanged", async (error) => {
    await expect(withSchemaGuard("test", async () => { throw error; })({})).rejects.toBe(error);
  });
  it("does not cache failure after migrations are applied", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const render = vi.fn().mockRejectedValueOnce(wrapped("42703")).mockResolvedValueOnce("restored");
    const guarded = withSchemaGuard("test", render);
    await guarded({});
    expect(await guarded({})).toBe("restored");
  });
  it("renders accessible guidance without mutable forms or invented empty data", () => {
    const html = renderToStaticMarkup(createElement(DatabaseUpdateRequired));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Do not recreate your workspace");
    expect(html).not.toContain("<form");
  });
});
