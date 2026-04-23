import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_SITE_ACCESS_CREDENTIAL,
  TEMPORARY_ACCESS_WINDOW_MS,
  TEMPORARY_SITE_ACCESS_CREDENTIALS,
  authenticateSiteAccess,
  isSiteAccessSessionValid,
} from "./siteAccess";

test("admin access stays valid without expiration", () => {
  const result = authenticateSiteAccess({
    username: ADMIN_SITE_ACCESS_CREDENTIAL.username,
    password: ADMIN_SITE_ACCESS_CREDENTIAL.password,
    activations: {},
    now: "2026-04-24T08:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.session?.mode, "admin");
  assert.equal(
    isSiteAccessSessionValid({
      session: result.session,
      activations: result.activations,
      now: "2026-05-30T08:00:00.000Z",
    }),
    true,
  );
});

test("temporary access activates on first use and expires after 24 hours", () => {
  const credential = TEMPORARY_SITE_ACCESS_CREDENTIALS[0];
  const firstLoginAt = "2026-04-24T08:00:00.000Z";

  const firstResult = authenticateSiteAccess({
    username: credential.username,
    password: credential.password,
    activations: {},
    now: firstLoginAt,
  });

  assert.equal(firstResult.ok, true);
  assert.equal(firstResult.session?.mode, "temporary");
  assert.equal(firstResult.activations[credential.username].activatedAt, firstLoginAt);

  const stillValidResult = authenticateSiteAccess({
    username: credential.username,
    password: credential.password,
    activations: firstResult.activations,
    now: new Date(Date.parse(firstLoginAt) + TEMPORARY_ACCESS_WINDOW_MS - 60_000).toISOString(),
  });

  assert.equal(stillValidResult.ok, true);
  assert.equal(
    isSiteAccessSessionValid({
      session: stillValidResult.session,
      activations: stillValidResult.activations,
      now: new Date(Date.parse(firstLoginAt) + TEMPORARY_ACCESS_WINDOW_MS - 1).toISOString(),
    }),
    true,
  );

  const expiredResult = authenticateSiteAccess({
    username: credential.username,
    password: credential.password,
    activations: firstResult.activations,
    now: new Date(Date.parse(firstLoginAt) + TEMPORARY_ACCESS_WINDOW_MS + 1_000).toISOString(),
  });

  assert.equal(expiredResult.ok, false);
  assert.match(expiredResult.error ?? "", /הסתיים|לא פעיל/);
  assert.equal(
    isSiteAccessSessionValid({
      session: firstResult.session,
      activations: firstResult.activations,
      now: new Date(Date.parse(firstLoginAt) + TEMPORARY_ACCESS_WINDOW_MS + 1_000).toISOString(),
    }),
    false,
  );
});
