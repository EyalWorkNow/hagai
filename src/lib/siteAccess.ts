import { SiteAccessSession } from "../types";

export type SiteAccessActivationMap = Record<string, { activatedAt: string }>;

export interface SiteAccessCredential {
  username: string;
  password: string;
  label: string;
}

export const TEMPORARY_ACCESS_WINDOW_MS = 24 * 60 * 60 * 1000;

export const ADMIN_SITE_ACCESS_CREDENTIAL: SiteAccessCredential = {
  username: "admin",
  password: "123123",
  label: "Admin unlimited access",
};

export const TEMPORARY_SITE_ACCESS_CREDENTIALS: SiteAccessCredential[] = [
  { username: "metering01", password: "Mtr-4821", label: "Metering access 01" },
  { username: "metering02", password: "Mtr-5934", label: "Metering access 02" },
  { username: "metering03", password: "Mtr-6187", label: "Metering access 03" },
  { username: "metering04", password: "Mtr-7246", label: "Metering access 04" },
  { username: "metering05", password: "Mtr-8352", label: "Metering access 05" },
  { username: "metering06", password: "Mtr-9468", label: "Metering access 06" },
  { username: "metering07", password: "Mtr-1573", label: "Metering access 07" },
  { username: "metering08", password: "Mtr-2684", label: "Metering access 08" },
  { username: "metering09", password: "Mtr-3795", label: "Metering access 09" },
  { username: "metering10", password: "Mtr-4806", label: "Metering access 10" },
  { username: "metering11", password: "Mtr-5917", label: "Metering access 11" },
  { username: "metering12", password: "Mtr-6028", label: "Metering access 12" },
  { username: "metering13", password: "Mtr-7139", label: "Metering access 13" },
  { username: "metering14", password: "Mtr-8250", label: "Metering access 14" },
  { username: "metering15", password: "Mtr-9361", label: "Metering access 15" },
  { username: "metering16", password: "Mtr-1472", label: "Metering access 16" },
  { username: "metering17", password: "Mtr-2583", label: "Metering access 17" },
  { username: "metering18", password: "Mtr-3694", label: "Metering access 18" },
  { username: "metering19", password: "Mtr-4705", label: "Metering access 19" },
  { username: "metering20", password: "Mtr-5816", label: "Metering access 20" },
];

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function toIso(input: Date | string) {
  return typeof input === "string" ? input : input.toISOString();
}

function getTemporaryCredential(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username);
  return TEMPORARY_SITE_ACCESS_CREDENTIALS.find(
    (credential) =>
      normalizeUsername(credential.username) === normalizedUsername &&
      credential.password === password,
  );
}

export function authenticateSiteAccess({
  username,
  password,
  activations,
  now = new Date(),
}: {
  username: string;
  password: string;
  activations: SiteAccessActivationMap;
  now?: Date | string;
}): {
  ok: boolean;
  session: SiteAccessSession | null;
  activations: SiteAccessActivationMap;
  error?: string;
} {
  const nowDate = typeof now === "string" ? new Date(now) : now;
  const nowIso = toIso(nowDate);
  const normalizedUsername = normalizeUsername(username);

  if (
    normalizedUsername === ADMIN_SITE_ACCESS_CREDENTIAL.username &&
    password === ADMIN_SITE_ACCESS_CREDENTIAL.password
  ) {
    return {
      ok: true,
      session: {
        username: ADMIN_SITE_ACCESS_CREDENTIAL.username,
        grantedAt: nowIso,
        expiresAt: null,
        mode: "admin",
      },
      activations,
    };
  }

  const credential = getTemporaryCredential(username, password);
  if (!credential) {
    return {
      ok: false,
      session: null,
      activations,
      error: "שם המשתמש או הסיסמה אינם תקינים",
    };
  }

  const existingActivation = activations[normalizedUsername];
  const activatedAt = existingActivation?.activatedAt ?? nowIso;
  const expiresAt = new Date(new Date(activatedAt).getTime() + TEMPORARY_ACCESS_WINDOW_MS).toISOString();

  if (nowDate.getTime() > new Date(expiresAt).getTime()) {
    return {
      ok: false,
      session: null,
      activations,
      error: "חלון הגישה של המשתמש הזה הסתיים והוא כבר לא פעיל",
    };
  }

  return {
    ok: true,
    session: {
      username: credential.username,
      grantedAt: nowIso,
      expiresAt,
      mode: "temporary",
    },
    activations: existingActivation
      ? activations
      : {
          ...activations,
          [normalizedUsername]: { activatedAt },
        },
  };
}

export function isSiteAccessSessionValid({
  session,
  activations,
  now = new Date(),
}: {
  session: SiteAccessSession | null;
  activations: SiteAccessActivationMap;
  now?: Date | string;
}) {
  if (!session) return false;
  if (session.mode === "admin") {
    return session.username === ADMIN_SITE_ACCESS_CREDENTIAL.username;
  }

  const activation = activations[normalizeUsername(session.username)];
  if (!activation) return false;

  const nowDate = typeof now === "string" ? new Date(now) : now;
  const expiresAt = new Date(
    new Date(activation.activatedAt).getTime() + TEMPORARY_ACCESS_WINDOW_MS,
  );

  return nowDate.getTime() <= expiresAt.getTime();
}
