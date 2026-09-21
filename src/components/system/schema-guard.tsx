import "server-only";
import React, { createElement, type ReactNode } from "react";
import { schemaDriftCode } from "@/db/schema-drift";

export function DatabaseUpdateRequired() {
  return (
    <section role="alert" className="mx-auto my-12 max-w-xl space-y-4 rounded-xl border bg-card p-6 text-card-foreground">
      <h1 className="text-xl font-semibold">Database update required</h1>
      <p className="text-sm text-muted-foreground">
        This part of QURTIZ AI is temporarily unavailable because the application
        and database schema are out of sync. Your workspace data could not be loaded.
      </p>
      <p className="text-sm text-muted-foreground">
        Please contact your deployment administrator to apply the pending database
        migrations, then reload this page. Do not recreate your workspace.
      </p>
    </section>
  );
}

/**
 * Guard the awaited body of a Server Component, before Next redacts DB errors.
 * This is NOT a descendant error boundary: each async page/layout needs its own
 * guard. Never use for actions/writes or return fabricated records on failure.
 */
export function withSchemaGuard<Props>(
  scope: string,
  render: (props: Props) => Promise<ReactNode>,
): (props: Props) => Promise<ReactNode> {
  return async (props) => {
    try {
      return await render(props);
    } catch (error) {
      const code = schemaDriftCode(error);
      if (!code) throw error; // Includes redirects, notFound, permission and connection errors.
      // SQL, parameters, credentials and tenant data must not enter these logs/UI.
      console.error("[qurtiz schema drift]", { scope, code });
      return createElement(DatabaseUpdateRequired);
    }
  };
}
