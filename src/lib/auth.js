import { fail, randomHex, sha256, hashPassword, verifyPassword } from "./util.js";

export const COOKIE = "__Host-td";
const AGE = { client: 60 * 60 * 24 * 14, partner: 60 * 60 * 24 * 7, admin: 60 * 60 * 8 };

export const q = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
export const uid = () => randomHex(10);

export async function ipHash(request, env) {
  return (await sha256((request.headers.get("CF-Connecting-IP") || "local") + ":" + (env.SALT || "teranga"))).slice(0, 24);
}

// Limitation de débit par IP et par action, fenêtre de 15 minutes.
export async function throttle(request, env, action, max) {
  const win = Math.floor(Date.now() / 900000);
  const bucket = action + ":" + await ipHash(request, env);
  const row = await q(env, `INSERT INTO rate_limits(bucket,window,hits) VALUES (?,?,1)
    ON CONFLICT(bucket) DO UPDATE SET hits = CASE WHEN rate_limits.window = excluded.window THEN rate_limits.hits + 1 ELSE 1 END,
    window = excluded.window RETURNING hits`, bucket, win).first();
  if (row.hits > max) fail("rate_limited", 429);
}

export async function audit(env, actor, action, target = "", detail = "", request = null) {
  await q(env, "INSERT INTO audit_log(actor,action,target,detail,ip_hash) VALUES (?,?,?,?,?)",
    actor || null, action, target, typeof detail === "string" ? detail : JSON.stringify(detail), request ? await ipHash(request, env) : null).run();
}

export async function currentUser(request, env) {
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)__Host-td=([0-9a-f]{64})/);
  if (!m) return null;
  const row = await q(env, `SELECT u.id,u.email,u.name,u.phone,u.country,u.role,u.lang,u.totp_enabled,u.status,s.mfa,s.token_hash
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires > ?`,
    await sha256(m[1]), Math.floor(Date.now() / 1000)).first();
  if (!row || row.status !== "active") return null;
  return row;
}

export async function startSession(env, user, mfa = 0) {
  const token = randomHex(32);
  const now = Math.floor(Date.now() / 1000);
  const age = AGE[user.role] || AGE.client;
  await env.DB.batch([
    q(env, "DELETE FROM sessions WHERE expires <= ?", now),
    q(env, "INSERT INTO sessions(token_hash,user_id,expires,mfa) VALUES (?,?,?,?)", await sha256(token), user.id, now + age, mfa),
  ]);
  return `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
}
export const clearCookie = `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;

export async function register(env, { email, name, phone, country, password, lang, role = "client" }) {
  if (typeof password !== "string" || password.length < 10 || password.length > 200) fail("weak_password");
  const exists = await q(env, "SELECT 1 FROM users WHERE email = ?", email).first();
  if (exists) fail("email_taken", 409);
  const user = { id: uid(), email, name, phone, country, role, lang };
  await q(env, "INSERT INTO users(id,email,name,phone,country,password_hash,role,lang) VALUES (?,?,?,?,?,?,?,?)",
    user.id, email, name, phone || null, country || null, await hashPassword(password), role, lang).run();
  return user;
}

export async function login(env, email, password) {
  const u = await q(env, "SELECT * FROM users WHERE email = ?", email).first();
  // Calcul factice si l'utilisateur n'existe pas, pour ne pas révéler son existence par le temps de réponse.
  const ok = u ? await verifyPassword(password, u.password_hash) : (await hashPassword(password), false);
  if (!ok || u.status !== "active") fail("bad_credentials", 401);
  return u;
}

// Un administrateur n'a accès à l'administration qu'après validation du second facteur (TOTP).
export function requireRole(user, role) {
  if (!user) fail("login_required", 401);
  if (role === "admin") {
    if (user.role !== "admin") fail("forbidden", 403);
    if (!user.totp_enabled || !user.mfa) fail("mfa_required", 401);
  } else if (role === "partner" && user.role !== "partner" && user.role !== "admin") fail("forbidden", 403);
  return user;
}

export async function notify(env, userId, ref, fr, en) {
  if (!userId) return;
  await q(env, "INSERT INTO notifications(id,user_id,ref,text_fr,text_en) VALUES (?,?,?,?,?)", uid(), userId, ref, fr, en).run();
}
