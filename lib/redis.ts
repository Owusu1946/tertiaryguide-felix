import { Redis } from "@upstash/redis";
import {
  deleteMemoryOtp,
  getMemoryOtp,
  setMemoryOtp,
} from "./otp-memory";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.warn(
    "[redis] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set; cache will be skipped.",
  );
}

export const redis =
  url && token
    ? new Redis({
        url,
        token,
      })
    : null;

let redisCacheEnabled =
  process.env.REDIS_CACHE_ENABLED !== "false" && redis !== null;

let redisUnreachable = false;

function isRedisAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("wrongpass") ||
    msg.includes("invalid or missing auth token") ||
    msg.includes("unauthorized") ||
    msg.includes("http_unauthorized")
  );
}

function isRedisNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = error.cause as { code?: string } | undefined;
  return (
    error.message.includes("fetch failed") ||
    cause?.code === "ENOTFOUND" ||
    cause?.code === "ECONNREFUSED"
  );
}

function markRedisUnreachable(error: unknown) {
  if (redisUnreachable) return;
  if (isRedisAuthError(error)) {
    redisUnreachable = true;
    redisCacheEnabled = false;
    console.warn(
      "[redis] Upstash auth failed (check UPSTASH_REDIS_REST_TOKEN); cache disabled until the server restarts.",
    );
    return;
  }
  if (isRedisNetworkError(error)) {
    redisUnreachable = true;
    redisCacheEnabled = false;
    console.warn(
      "[redis] Upstash is unreachable; cache disabled and OTP will use in-memory storage until the server restarts.",
    );
  }
}

async function withRedisRead<T>(
  label: string,
  operation: () => Promise<T | null>,
): Promise<T | null> {
  if (!redisCacheEnabled || !redis) return null;
  try {
    return await operation();
  } catch (error) {
    markRedisUnreachable(error);
    if (!redisUnreachable) {
      console.warn(`[redis] ${label} failed; continuing without cache`, error);
    }
    return null;
  }
}

async function withRedisWrite(
  label: string,
  operation: () => Promise<unknown>,
): Promise<boolean> {
  if (!redisCacheEnabled || !redis) return false;
  try {
    await operation();
    return true;
  } catch (error) {
    markRedisUnreachable(error);
    if (!redisUnreachable) {
      console.warn(`[redis] ${label} failed; continuing without cache`, error);
    }
    return false;
  }
}

export type CachedUser = {
  id: string;
  username: string;
  email: string;
  phone?: string;
  profilePicture?: string | null;
  avatarSeed?: string | null;
};

const USER_TTL_SECONDS = 15 * 60; // 15 minutes
const CHECKERS_TTL_SECONDS = 5 * 60; // 5 minutes for admin checkers list
const ASSISTANCE_TTL_SECONDS = 5 * 60; // 5 minutes for admin assistance requests
const SCHOOLS_TTL_SECONDS = 5 * 60; // 5 minutes for schools list

export type CachedChecker = {
  id: string;
  serial: string;
  pin: string;
  status: "Issued" | "Unissued";
  issuedTo: string;
  issuedAt: string;
};

export type CachedSchool = {
  id: string;
  name: string;
  alias: string | null;
  slug?: string | null;
  logoSrc: string | null;
  logoAlt: string | null;
  priceGhs: number | null;
  deadline: string | null;
  about?: string | null;
  preRequisite?: string | null;
  durationYears?: number | null;
  isVerified?: boolean;
  isPartner?: boolean;
  /** All categories (filters, display). */
  categories: string[];
  /** @deprecated first category; prefer categories */
  category?: string;
};

export type CachedAssistanceRequest = {
  id: string;
  medium: "call" | "sms" | "whatsapp" | "email";
  contact: string;
  createdAt: string;
  requesterEmail?: string | null;
  requesterUsername?: string | null;
};

export async function cacheUser(user: CachedUser): Promise<void> {
  await withRedisWrite("cacheUser", async () => {
    await redis!.set(`user:id:${user.id}`, user, { ex: USER_TTL_SECONDS });
    await redis!.set(`user:email:${user.email.toLowerCase()}`, user, {
      ex: USER_TTL_SECONDS,
    });
    await redis!.set(`user:username:${user.username.toLowerCase()}`, user, {
      ex: USER_TTL_SECONDS,
    });
  });
}

export async function getCachedUserById(
  id: string,
): Promise<CachedUser | null> {
  return withRedisRead("getCachedUserById", async () => {
    const user = await redis!.get<CachedUser>(`user:id:${id}`);
    return user ?? null;
  });
}

export async function getCachedUserByEmail(
  email: string,
): Promise<CachedUser | null> {
  return withRedisRead("getCachedUserByEmail", async () => {
    const user = await redis!.get<CachedUser>(
      `user:email:${email.toLowerCase()}`,
    );
    return user ?? null;
  });
}

export async function getCachedUserByUsername(
  username: string,
): Promise<CachedUser | null> {
  return withRedisRead("getCachedUserByUsername", async () => {
    const user = await redis!.get<CachedUser>(
      `user:username:${username.toLowerCase()}`,
    );
    return user ?? null;
  });
}

export async function invalidateUserCache(
  user: CachedUser,
): Promise<void> {
  await withRedisWrite("invalidateUserCache", async () => {
    await redis!.del(`user:id:${user.id}`);
    await redis!.del(`user:email:${user.email.toLowerCase()}`);
    await redis!.del(`user:username:${user.username.toLowerCase()}`);
  });
}

export async function setOtpForEmail(
  email: string,
  otpHash: string,
  ttlSeconds: number,
): Promise<boolean> {
  const key = `otp:email:${email.toLowerCase()}`;
  const storedInRedis = await withRedisWrite("setOtpForEmail", async () => {
    await redis!.set(key, otpHash, { ex: ttlSeconds });
  });
  setMemoryOtp(key, otpHash, ttlSeconds);
  return storedInRedis || true;
}

export async function getOtpForEmail(email: string): Promise<string | null> {
  const key = `otp:email:${email.toLowerCase()}`;
  const fromRedis = await withRedisRead("getOtpForEmail", async () => {
    const value = await redis!.get<string>(key);
    return value ?? null;
  });
  if (fromRedis) return fromRedis;
  return getMemoryOtp(key);
}

export async function deleteOtpForEmail(email: string): Promise<void> {
  const key = `otp:email:${email.toLowerCase()}`;
  await withRedisWrite("deleteOtpForEmail", async () => {
    await redis!.del(key);
  });
  deleteMemoryOtp(key);
}

/** Separate from signup OTP to avoid clobbering or cross-using codes. */
const PASSWORD_RESET_OTP_PREFIX = "otp:password-reset:";

export async function setPasswordResetOtpForEmail(
  email: string,
  otpHash: string,
  ttlSeconds: number,
): Promise<boolean> {
  const key = `${PASSWORD_RESET_OTP_PREFIX}${email.toLowerCase()}`;
  const storedInRedis = await withRedisWrite(
    "setPasswordResetOtpForEmail",
    async () => {
      await redis!.set(key, otpHash, { ex: ttlSeconds });
    },
  );
  setMemoryOtp(key, otpHash, ttlSeconds);
  return storedInRedis || true;
}

export async function getPasswordResetOtpForEmail(
  email: string,
): Promise<string | null> {
  const key = `${PASSWORD_RESET_OTP_PREFIX}${email.toLowerCase()}`;
  const fromRedis = await withRedisRead("getPasswordResetOtpForEmail", async () => {
    const value = await redis!.get<string>(key);
    return value ?? null;
  });
  if (fromRedis) return fromRedis;
  return getMemoryOtp(key);
}

export async function deletePasswordResetOtpForEmail(
  email: string,
): Promise<void> {
  const key = `${PASSWORD_RESET_OTP_PREFIX}${email.toLowerCase()}`;
  await withRedisWrite("deletePasswordResetOtpForEmail", async () => {
    await redis!.del(key);
  });
  deleteMemoryOtp(key);
}

const ADMIN_PASSWORD_RESET_OTP_PREFIX = "otp:admin-password-reset:";
const ADMIN_EMAIL_RECOVERY_OTP_PREFIX = "otp:admin-email-recovery:";
const ADMIN_USERNAME_RECOVERY_OTP_PREFIX = "otp:admin-username-recovery:";

export async function setAdminPasswordResetOtpForEmail(
  email: string,
  otpHash: string,
  ttlSeconds: number,
): Promise<boolean> {
  const key = `${ADMIN_PASSWORD_RESET_OTP_PREFIX}${email.toLowerCase()}`;
  const storedInRedis = await withRedisWrite(
    "setAdminPasswordResetOtpForEmail",
    async () => {
      await redis!.set(key, otpHash, { ex: ttlSeconds });
    },
  );
  setMemoryOtp(key, otpHash, ttlSeconds);
  return storedInRedis || true;
}

export async function getAdminPasswordResetOtpForEmail(
  email: string,
): Promise<string | null> {
  const key = `${ADMIN_PASSWORD_RESET_OTP_PREFIX}${email.toLowerCase()}`;
  const fromRedis = await withRedisRead(
    "getAdminPasswordResetOtpForEmail",
    async () => {
      const value = await redis!.get<string>(key);
      return value ?? null;
    },
  );
  if (fromRedis) return fromRedis;
  return getMemoryOtp(key);
}

export async function deleteAdminPasswordResetOtpForEmail(
  email: string,
): Promise<void> {
  const key = `${ADMIN_PASSWORD_RESET_OTP_PREFIX}${email.toLowerCase()}`;
  await withRedisWrite("deleteAdminPasswordResetOtpForEmail", async () => {
    await redis!.del(key);
  });
  deleteMemoryOtp(key);
}

export async function setAdminEmailRecoveryOtpForUsername(
  username: string,
  otpHash: string,
  ttlSeconds: number,
): Promise<boolean> {
  const key = `${ADMIN_EMAIL_RECOVERY_OTP_PREFIX}${username.toLowerCase()}`;
  const storedInRedis = await withRedisWrite(
    "setAdminEmailRecoveryOtpForUsername",
    async () => {
      await redis!.set(key, otpHash, { ex: ttlSeconds });
    },
  );
  setMemoryOtp(key, otpHash, ttlSeconds);
  return storedInRedis || true;
}

export async function getAdminEmailRecoveryOtpForUsername(
  username: string,
): Promise<string | null> {
  const key = `${ADMIN_EMAIL_RECOVERY_OTP_PREFIX}${username.toLowerCase()}`;
  const fromRedis = await withRedisRead(
    "getAdminEmailRecoveryOtpForUsername",
    async () => {
      const value = await redis!.get<string>(key);
      return value ?? null;
    },
  );
  if (fromRedis) return fromRedis;
  return getMemoryOtp(key);
}

export async function deleteAdminEmailRecoveryOtpForUsername(
  username: string,
): Promise<void> {
  const key = `${ADMIN_EMAIL_RECOVERY_OTP_PREFIX}${username.toLowerCase()}`;
  await withRedisWrite("deleteAdminEmailRecoveryOtpForUsername", async () => {
    await redis!.del(key);
  });
  deleteMemoryOtp(key);
}

export async function setAdminUsernameRecoveryOtpForEmail(
  email: string,
  otpHash: string,
  ttlSeconds: number,
): Promise<boolean> {
  const key = `${ADMIN_USERNAME_RECOVERY_OTP_PREFIX}${email.toLowerCase()}`;
  const storedInRedis = await withRedisWrite(
    "setAdminUsernameRecoveryOtpForEmail",
    async () => {
      await redis!.set(key, otpHash, { ex: ttlSeconds });
    },
  );
  setMemoryOtp(key, otpHash, ttlSeconds);
  return storedInRedis || true;
}

export async function getAdminUsernameRecoveryOtpForEmail(
  email: string,
): Promise<string | null> {
  const key = `${ADMIN_USERNAME_RECOVERY_OTP_PREFIX}${email.toLowerCase()}`;
  const fromRedis = await withRedisRead(
    "getAdminUsernameRecoveryOtpForEmail",
    async () => {
      const value = await redis!.get<string>(key);
      return value ?? null;
    },
  );
  if (fromRedis) return fromRedis;
  return getMemoryOtp(key);
}

export async function deleteAdminUsernameRecoveryOtpForEmail(
  email: string,
): Promise<void> {
  const key = `${ADMIN_USERNAME_RECOVERY_OTP_PREFIX}${email.toLowerCase()}`;
  await withRedisWrite("deleteAdminUsernameRecoveryOtpForEmail", async () => {
    await redis!.del(key);
  });
  deleteMemoryOtp(key);
}

export async function getCachedCheckers(): Promise<CachedChecker[] | null> {
  return withRedisRead("getCachedCheckers", async () => {
    const value = await redis!.get<CachedChecker[]>("admin:checkers:list");
    return value ?? null;
  });
}

export async function setCachedCheckers(
  checkers: CachedChecker[],
): Promise<void> {
  await withRedisWrite("setCachedCheckers", async () => {
    await redis!.set("admin:checkers:list", checkers, {
      ex: CHECKERS_TTL_SECONDS,
    });
  });
}

export async function invalidateCheckersCache(): Promise<void> {
  await withRedisWrite("invalidateCheckersCache", async () => {
    await redis!.del("admin:checkers:list");
  });
}

export async function getCachedSchools(): Promise<CachedSchool[] | null> {
  return withRedisRead("getCachedSchools", async () => {
    const value = await redis!.get<CachedSchool[]>("schools:list");
    return value ?? null;
  });
}

export async function setCachedSchools(schools: CachedSchool[]): Promise<void> {
  await withRedisWrite("setCachedSchools", async () => {
    await redis!.set("schools:list", schools, { ex: SCHOOLS_TTL_SECONDS });
  });
}

export async function invalidateSchoolsCache(): Promise<void> {
  await withRedisWrite("invalidateSchoolsCache", async () => {
    await redis!.del("schools:list");
  });
}

export async function getCachedAssistanceRequests(): Promise<
  CachedAssistanceRequest[] | null
> {
  return withRedisRead("getCachedAssistanceRequests", async () => {
    const value = await redis!.get<CachedAssistanceRequest[]>(
      "admin:assistance:list",
    );
    return value ?? null;
  });
}

export async function setCachedAssistanceRequests(
  requests: CachedAssistanceRequest[],
): Promise<void> {
  await withRedisWrite("setCachedAssistanceRequests", async () => {
    await redis!.set("admin:assistance:list", requests, {
      ex: ASSISTANCE_TTL_SECONDS,
    });
  });
}

export async function invalidateAssistanceCache(): Promise<void> {
  await withRedisWrite("invalidateAssistanceCache", async () => {
    await redis!.del("admin:assistance:list");
  });
}

const EXPLORE_POSTS_TTL_SECONDS = 3 * 60; // 3 minutes
const EXPLORE_COMMENTS_TTL_SECONDS = 3 * 60; // 3 minutes

export async function getCachedExplorePosts(
  key: string,
): Promise<{ posts: any[]; nextCursor: string | null } | null> {
  return withRedisRead("getCachedExplorePosts", async () => {
    const value = await redis!.get<{ posts: any[]; nextCursor: string | null }>(
      `explore:posts:${key}`,
    );
    return value ?? null;
  });
}

export async function setCachedExplorePosts(
  key: string,
  data: { posts: any[]; nextCursor: string | null },
): Promise<void> {
  await withRedisWrite("setCachedExplorePosts", async () => {
    await redis!.set(`explore:posts:${key}`, data, {
      ex: EXPLORE_POSTS_TTL_SECONDS,
    });
  });
}

export async function invalidateExplorePostsCache(): Promise<void> {
  await withRedisWrite("invalidateExplorePostsCache", async () => {
    await redis!.del("explore:posts:first:20");
    await redis!.del("explore:posts:first:12");
  });
}

export async function getCachedExploreComments(
  postId: string,
): Promise<any[] | null> {
  return withRedisRead("getCachedExploreComments", async () => {
    const value = await redis!.get<any[]>(`explore:comments:${postId}`);
    return value ?? null;
  });
}

export async function setCachedExploreComments(
  postId: string,
  comments: any[],
): Promise<void> {
  await withRedisWrite("setCachedExploreComments", async () => {
    await redis!.set(`explore:comments:${postId}`, comments, {
      ex: EXPLORE_COMMENTS_TTL_SECONDS,
    });
  });
}

export async function invalidateExploreCommentsCache(
  postId: string,
): Promise<void> {
  await withRedisWrite("invalidateExploreCommentsCache", async () => {
    await redis!.del(`explore:comments:${postId}`);
  });
}
