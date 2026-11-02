const COOKIE = "nicko_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 100000;

function json(data, status = 200, extra = {}) {
  const headers = new Headers(extra);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return new Response(JSON.stringify(data), { status, headers });
}
function fail(message, status = 400) { return json({ error: message }, status); }
function cookieOptions(request, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return "Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge + secure;
}
function getCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const item = raw.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return item ? item.slice(name.length + 1) : null;
}
function hex(bytes) { return Array.from(new Uint8Array(bytes)).map(v => v.toString(16).padStart(2, "0")).join(""); }
function randomHex(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return hex(bytes);
}
async function sha256(value) {
  const data = new TextEncoder().encode(value);
  return hex(await crypto.subtle.digest("SHA-256", data));
}
async function makePassword(password, saltHex) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: Uint8Array.from(saltHex.match(/.{2}/g).map(x => parseInt(x, 16))), iterations: PASSWORD_ITERATIONS, hash: "SHA-256" }, key, 256);
  return hex(bits);
}
function cleanUser(row) {
  if (!row) return null;
  return {
    id: row.id, username: row.username, display_name: row.display_name,
    bio: row.bio || "", avatar_url: row.avatar_url || "",
    followers: Number(row.followers || 0), following: Number(row.following || 0)
  };
}
async function readBody(request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 12000) throw new Error("A solicitação é muito grande.");
  try { return await request.json(); } catch { throw new Error("Envie dados válidos."); }
}
function validImage(value) {
  if (value == null || value === "") return true;
  if (typeof value !== "string" || value.length > 2000) return false;
  try { const u = new URL(value); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
}
function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
async function currentUser(request, env) {
  const token = getCookie(request, COOKIE);
  if (!token) return null;
  const hash = await sha256(token);
  const row = await env.DB.prepare(
    "SELECT u.id,u.username,u.display_name,u.bio,u.avatar_url," +
    "(SELECT COUNT(*) FROM follows f WHERE f.following_id=u.id) AS followers," +
    "(SELECT COUNT(*) FROM follows f WHERE f.follower_id=u.id) AS following " +
    "FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?"
  ).bind(hash, new Date().toISOString()).first();
  return cleanUser(row);
}
async function requireUser(request, env) {
  const user = await currentUser(request, env);
  return user;
}
async function createSession(userId, env, request) {
  const token = randomHex(32);
  const hash = await sha256(token);
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)")
    .bind(hash, userId, expires, new Date().toISOString()).run();
  return cookieOptions(request, SESSION_SECONDS) + "; " + COOKIE + "=" + token;
}
function requireOrigin(request) {
  return isSameOrigin(request) ? null : fail("Origem não autorizada.", 403);
}
async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "health" && method === "GET") {
    return json({ ok: true, database: !!env.DB });
  }
  if (!env.DB) return fail("Banco de dados ainda não conectado. Configure a ligação D1 chamada DB no Cloudflare Pages.", 503);
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    const originError = requireOrigin(request);
    if (originError) return originError;
  }
  try {
    if (parts[0] === "register" && method === "POST") {
      const body = await readBody(request);
      const username = String(body.username || "").trim().toLowerCase();
      const email = String(body.email || "").trim().toLowerCase();
      const display = String(body.display_name || username).trim().slice(0, 50);
      const password = String(body.password || "");
      if (!/^[a-z0-9_.]{3,24}$/.test(username)) return fail("Use um usuário de 3 a 24 caracteres: letras, números, ponto ou _.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return fail("Informe um e-mail válido.");
      if (password.length < 8 || password.length > 128) return fail("A senha deve ter entre 8 e 128 caracteres.");
      if (!display) return fail("Informe um nome de exibição.");
      const exists = await env.DB.prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE OR email=? COLLATE NOCASE").bind(username, email).first();
      if (exists) return fail("Este nome de usuário ou e-mail já está cadastrado.", 409);
      const id = crypto.randomUUID(), salt = randomHex(16), hash = await makePassword(password, salt), now = new Date().toISOString();
      await env.DB.prepare("INSERT INTO users (id,username,email,display_name,bio,avatar_url,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id, username, email, display, "", "", hash, salt, now).run();
      const setCookie = await createSession(id, env, request);
      const user = await currentUser(new Request(request.url, { headers: { Cookie: COOKIE + "=" + setCookie.split(COOKIE + "=")[1] } }), env);
      return json({ user }, 201, { "Set-Cookie": setCookie });
    }
    if (parts[0] === "login" && method === "POST") {
      const body = await readBody(request);
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const row = await env.DB.prepare("SELECT id,username,password_hash,password_salt FROM users WHERE username=? COLLATE NOCASE").bind(username).first();
      if (!row || (await makePassword(password, row.password_salt)) !== row.password_hash) {
        return fail("Usuário ou senha incorretos.", 401);
      }
      const setCookie = await createSession(row.id, env, request);
      const user = await currentUser(new Request(request.url, { headers: { Cookie: COOKIE + "=" + setCookie.split(COOKIE + "=")[1] } }), env);
      return json({ user }, 200, { "Set-Cookie": setCookie });
    }
    if (parts[0] === "logout" && method === "POST") {
      const token = getCookie(request, COOKIE);
      if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(token)).run();
      return json({ ok: true }, 200, { "Set-Cookie": COOKIE + "=; " + cookieOptions(request, 0) });
    }
    if (parts[0] === "me" && method === "GET") {
      return json({ user: await currentUser(request, env) });
    }
    if (parts[0] === "me" && method === "PATCH") {
      const user = await requireUser(request, env);
      if (!user) return fail("Entre na sua conta para editar o perfil.", 401);
      const body = await readBody(request);
      const display = String(body.display_name ?? user.display_name).trim().slice(0, 50);
      const bio = String(body.bio ?? user.bio).trim().slice(0, 180);
      const avatar = body.avatar_url ?? user.avatar_url;
      if (!display) return fail("O nome de exibição não pode ficar vazio.");
      if (!validImage(avatar)) return fail("O link da foto precisa ser http ou https.");
      await env.DB.prepare("UPDATE users SET display_name=?,bio=?,avatar_url=? WHERE id=?")
        .bind(display, bio, avatar || "", user.id).run();
      return json({ user: await currentUser(request, env) });
    }
    if (parts[0] === "feed" && method === "GET") {
      const user = await currentUser(request, env);
      const result = await env.DB.prepare(
        "SELECT p.id,p.user_id,p.content,p.image_url,p.created_at,u.username,u.display_name,u.avatar_url," +
        "(SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) AS likes_count," +
        "(SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comments_count," +
        "CASE WHEN ? IS NOT NULL AND EXISTS(SELECT 1 FROM likes l2 WHERE l2.post_id=p.id AND l2.user_id=?) THEN 1 ELSE 0 END AS liked_by_me " +
        "FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 50"
      ).bind(user ? user.id : null, user ? user.id : null).all();
      return json({ posts: result.results || [] });
    }
    if (parts[0] === "posts" && parts.length === 1 && method === "POST") {
      const user = await requireUser(request, env);
      if (!user) return fail("Entre na sua conta para publicar.", 401);
      const body = await readBody(request), content = String(body.content || "").trim(), image = body.image_url || "";
      if (!content || content.length > 1000) return fail("A publicação precisa ter de 1 a 1000 caracteres.");
      if (!validImage(image)) return fail("O link da imagem precisa ser http ou https.");
      const id = crypto.randomUUID(), now = new Date().toISOString();
      await env.DB.prepare("INSERT INTO posts (id,user_id,content,image_url,created_at) VALUES (?,?,?,?,?)")
        .bind(id, user.id, content, image || null, now).run();
      return json({ ok: true, id }, 201);
    }
    if (parts[0] === "posts" && parts.length === 3 && parts[2] === "like" && method === "POST") {
      const user = await requireUser(request, env);
      if (!user) return fail("Entre na sua conta para curtir.", 401);
      const postId = parts[1];
      const post = await env.DB.prepare("SELECT id FROM posts WHERE id=?").bind(postId).first();
      if (!post) return fail("Publicação não encontrada.", 404);
      const existing = await env.DB.prepare("SELECT user_id FROM likes WHERE post_id=? AND user_id=?").bind(postId, user.id).first();
      if (existing) await env.DB.prepare("DELETE FROM likes WHERE post_id=? AND user_id=?").bind(postId, user.id).run();
      else await env.DB.prepare("INSERT INTO likes (post_id,user_id,created_at) VALUES (?,?,?)").bind(postId, user.id, new Date().toISOString()).run();
      return json({ liked: !existing });
    }
    if (parts[0] === "posts" && parts.length === 3 && parts[2] === "comments" && method === "GET") {
      const result = await env.DB.prepare(
        "SELECT c.id,c.content,c.created_at,u.username,u.display_name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.created_at ASC LIMIT 100"
      ).bind(parts[1]).all();
      return json({ comments: result.results || [] });
    }
    if (parts[0] === "posts" && parts.length === 3 && parts[2] === "comments" && method === "POST") {
      const user = await requireUser(request, env);
      if (!user) return fail("Entre na sua conta para comentar.", 401);
      const post = await env.DB.prepare("SELECT id FROM posts WHERE id=?").bind(parts[1]).first();
      if (!post) return fail("Publicação não encontrada.", 404);
      const body = await readBody(request), content = String(body.content || "").trim();
      if (!content || content.length > 500) return fail("O comentário precisa ter de 1 a 500 caracteres.");
      await env.DB.prepare("INSERT INTO comments (id,post_id,user_id,content,created_at) VALUES (?,?,?,?,?)")
        .bind(crypto.randomUUID(), parts[1], user.id, content, new Date().toISOString()).run();
      return json({ ok: true }, 201);
    }
    if (parts[0] === "users" && parts.length === 1 && method === "GET") {
      const user = await currentUser(request, env), q = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 40);
      const result = await env.DB.prepare(
        "SELECT u.id,u.username,u.display_name,u.bio,u.avatar_url," +
        "(SELECT COUNT(*) FROM follows f WHERE f.following_id=u.id) AS followers," +
        "(SELECT COUNT(*) FROM follows f WHERE f.follower_id=u.id) AS following," +
        "CASE WHEN ? IS NOT NULL AND EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id=? AND f2.following_id=u.id) THEN 1 ELSE 0 END AS is_following " +
        "FROM users u WHERE (?='' OR lower(u.username) LIKE '%'||?||'%' OR lower(u.display_name) LIKE '%'||?||'%') " +
        "AND (? IS NULL OR u.id<>?) ORDER BY u.created_at DESC LIMIT 30"
      ).bind(user ? user.id : null, user ? user.id : null, q, q, q, user ? user.id : null, user ? user.id : null).all();
      return json({ users: (result.results || []).map(row => ({ ...cleanUser(row), following: !!row.is_following })) });
    }
    if (parts[0] === "users" && parts.length === 2 && method === "GET") {
      const viewer = await currentUser(request, env), name = parts[1];
      const row = await env.DB.prepare(
        "SELECT u.id,u.username,u.display_name,u.bio,u.avatar_url," +
        "(SELECT COUNT(*) FROM follows f WHERE f.following_id=u.id) AS followers," +
        "(SELECT COUNT(*) FROM follows f WHERE f.follower_id=u.id) AS following," +
        "(SELECT COUNT(*) FROM posts p WHERE p.user_id=u.id) AS post_count," +
        "CASE WHEN ? IS NOT NULL AND EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id=? AND f2.following_id=u.id) THEN 1 ELSE 0 END AS is_following " +
        "FROM users u WHERE u.username=? COLLATE NOCASE"
      ).bind(viewer ? viewer.id : null, viewer ? viewer.id : null, name).first();
      if (!row) return fail("Perfil não encontrado.", 404);
      return json({ user: { ...cleanUser(row), following: !!row.is_following, post_count: Number(row.post_count || 0) } });
    }
    if (parts[0] === "users" && parts.length === 3 && parts[2] === "follow" && method === "POST") {
      const user = await requireUser(request, env);
      if (!user) return fail("Entre na sua conta para seguir pessoas.", 401);
      const target = await env.DB.prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE").bind(parts[1]).first();
      if (!target) return fail("Pessoa não encontrada.", 404);
      if (target.id === user.id) return fail("Você não pode seguir seu próprio perfil.");
      const existing = await env.DB.prepare("SELECT follower_id FROM follows WHERE follower_id=? AND following_id=?").bind(user.id, target.id).first();
      if (existing) await env.DB.prepare("DELETE FROM follows WHERE follower_id=? AND following_id=?").bind(user.id, target.id).run();
      else await env.DB.prepare("INSERT INTO follows (follower_id,following_id,created_at) VALUES (?,?,?)").bind(user.id, target.id, new Date().toISOString()).run();
      return json({ following: !existing });
    }
    return fail("Rota não encontrada.", 404);
  } catch (error) {
    const message = error && error.message ? error.message : "Erro interno.";
    return fail(message.includes("UNIQUE") ? "Esse dado já está cadastrado." : message, message.includes("UNIQUE") ? 409 : 500);
  }
}
export { onRequest };