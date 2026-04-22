import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "localai.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_sub TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    picture TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    red_social TEXT NOT NULL,
    contenido TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'borrador',
    origen TEXT NOT NULL DEFAULT 'gemini',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS connected_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    platform TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_identifier TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS publication_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    post_id INTEGER NOT NULL,
    connected_account_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    publish_mode TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    external_post_id TEXT,
    published_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (post_id) REFERENCES posts (id),
    FOREIGN KEY (connected_account_id) REFERENCES connected_accounts (id)
  );

  CREATE TABLE IF NOT EXISTS publication_attempts (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (job_id) REFERENCES publication_jobs (id)
  );
`);

ensureColumn("posts", "updated_at", "TEXT");

db.exec(`
  UPDATE posts
  SET updated_at = COALESCE(updated_at, created_at)
  WHERE updated_at IS NULL
`);

const insertUserStmt = db.prepare(`
  INSERT INTO users (id, google_sub, email, name, picture, created_at)
  VALUES (@id, @google_sub, @email, @name, @picture, @created_at)
`);

const findUserByGoogleSubStmt = db.prepare(
  "SELECT * FROM users WHERE google_sub = ?"
);

const findUserByIdStmt = db.prepare("SELECT * FROM users WHERE id = ?");

const updateUserStmt = db.prepare(`
  UPDATE users
  SET email = @email,
      name = @name,
      picture = @picture
  WHERE id = @id
`);

const insertPostStmt = db.prepare(`
  INSERT INTO posts (user_id, red_social, contenido, estado, origen, created_at, updated_at)
  VALUES (@user_id, @red_social, @contenido, @estado, @origen, @created_at, @updated_at)
`);

const listPostsByUserStmt = db.prepare(`
  SELECT id, red_social, contenido, estado, origen, created_at, updated_at
  FROM posts
  WHERE user_id = ?
  ORDER BY datetime(created_at) DESC, id DESC
`);

const updatePostStatusStmt = db.prepare(`
  UPDATE posts
  SET estado = @estado,
      updated_at = @updated_at
  WHERE id = @id AND user_id = @user_id
`);

const findPostByIdStmt = db.prepare(
  "SELECT id, user_id, red_social, contenido, estado, origen, created_at, updated_at FROM posts WHERE id = ?"
);

const findPostByIdAndUserStmt = db.prepare(
  "SELECT id, user_id, red_social, contenido, estado, origen, created_at, updated_at FROM posts WHERE id = ? AND user_id = ?"
);

const insertConnectedAccountStmt = db.prepare(`
  INSERT INTO connected_accounts (
    id,
    user_id,
    provider,
    platform,
    account_name,
    account_identifier,
    status,
    created_at
  )
  VALUES (
    @id,
    @user_id,
    @provider,
    @platform,
    @account_name,
    @account_identifier,
    @status,
    @created_at
  )
`);

const listConnectedAccountsByUserStmt = db.prepare(`
  SELECT id, provider, platform, account_name, account_identifier, status, created_at
  FROM connected_accounts
  WHERE user_id = ? AND status = 'active'
  ORDER BY datetime(created_at) DESC, id DESC
`);

const findConnectedAccountByIdStmt = db.prepare(`
  SELECT id, user_id, provider, platform, account_name, account_identifier, status, created_at
  FROM connected_accounts
  WHERE id = ?
`);

const deactivateConnectedAccountStmt = db.prepare(`
  UPDATE connected_accounts
  SET status = 'inactive'
  WHERE id = @id AND user_id = @user_id
`);

const insertPublicationJobStmt = db.prepare(`
  INSERT INTO publication_jobs (
    id,
    user_id,
    post_id,
    connected_account_id,
    platform,
    publish_mode,
    scheduled_for,
    status,
    attempt_count,
    max_attempts,
    last_error,
    external_post_id,
    published_at,
    created_at,
    updated_at
  )
  VALUES (
    @id,
    @user_id,
    @post_id,
    @connected_account_id,
    @platform,
    @publish_mode,
    @scheduled_for,
    @status,
    @attempt_count,
    @max_attempts,
    @last_error,
    @external_post_id,
    @published_at,
    @created_at,
    @updated_at
  )
`);

const listPublicationJobsByUserStmt = db.prepare(`
  SELECT
    j.id,
    j.post_id,
    j.connected_account_id,
    j.platform,
    j.publish_mode,
    j.scheduled_for,
    j.status,
    j.attempt_count,
    j.max_attempts,
    j.last_error,
    j.external_post_id,
    j.published_at,
    j.created_at,
    j.updated_at,
    p.contenido AS post_contenido,
    p.red_social AS post_red_social,
    a.account_name,
    a.account_identifier
  FROM publication_jobs j
  INNER JOIN posts p ON p.id = j.post_id
  INNER JOIN connected_accounts a ON a.id = j.connected_account_id
  WHERE j.user_id = ?
  ORDER BY datetime(j.created_at) DESC, j.id DESC
`);

const findPublicationJobByIdStmt = db.prepare(`
  SELECT
    j.id,
    j.post_id,
    j.connected_account_id,
    j.platform,
    j.publish_mode,
    j.scheduled_for,
    j.status,
    j.attempt_count,
    j.max_attempts,
    j.last_error,
    j.external_post_id,
    j.published_at,
    j.created_at,
    j.updated_at,
    p.contenido AS post_contenido,
    p.red_social AS post_red_social,
    a.account_name,
    a.account_identifier
  FROM publication_jobs j
  INNER JOIN posts p ON p.id = j.post_id
  INNER JOIN connected_accounts a ON a.id = j.connected_account_id
  WHERE j.id = ? AND j.user_id = ?
`);

const listDuePublicationJobsStmt = db.prepare(`
  SELECT
    j.id,
    j.user_id,
    j.post_id,
    j.connected_account_id,
    j.platform,
    j.publish_mode,
    j.scheduled_for,
    j.status,
    j.attempt_count,
    j.max_attempts,
    j.last_error,
    p.contenido,
    p.red_social,
    a.account_name,
    a.account_identifier,
    a.status AS account_status
  FROM publication_jobs j
  INNER JOIN posts p ON p.id = j.post_id
  INNER JOIN connected_accounts a ON a.id = j.connected_account_id
  WHERE j.status IN ('queued', 'scheduled', 'retrying')
    AND datetime(j.scheduled_for) <= datetime(?)
    AND a.status = 'active'
  ORDER BY datetime(j.scheduled_for) ASC, j.created_at ASC
  LIMIT ?
`);

const claimPublicationJobStmt = db.prepare(`
  UPDATE publication_jobs
  SET status = 'processing',
      updated_at = @updated_at
  WHERE id = @id
    AND status IN ('queued', 'scheduled', 'retrying')
`);

const markPublicationJobSuccessStmt = db.prepare(`
  UPDATE publication_jobs
  SET status = 'published',
      attempt_count = @attempt_count,
      last_error = NULL,
      external_post_id = @external_post_id,
      published_at = @published_at,
      updated_at = @updated_at
  WHERE id = @id
`);

const markPublicationJobRetryStmt = db.prepare(`
  UPDATE publication_jobs
  SET status = @status,
      attempt_count = @attempt_count,
      last_error = @last_error,
      scheduled_for = @scheduled_for,
      updated_at = @updated_at
  WHERE id = @id
`);

const insertPublicationAttemptStmt = db.prepare(`
  INSERT INTO publication_attempts (id, job_id, status, message, created_at)
  VALUES (@id, @job_id, @status, @message, @created_at)
`);

const listPublicationAttemptsByUserStmt = db.prepare(`
  SELECT
    pa.id,
    pa.job_id,
    pa.status,
    pa.message,
    pa.created_at,
    j.platform,
    j.post_id
  FROM publication_attempts pa
  INNER JOIN publication_jobs j ON j.id = pa.job_id
  WHERE j.user_id = ?
  ORDER BY datetime(pa.created_at) DESC, pa.id DESC
  LIMIT 50
`);

export function upsertUser(profile) {
  const now = new Date().toISOString();
  const existing = findUserByGoogleSubStmt.get(profile.sub);

  if (!existing) {
    const user = {
      id: randomUUID(),
      google_sub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture || "",
      created_at: now,
    };

    insertUserStmt.run(user);
    return { ...user };
  }

  const updated = {
    id: existing.id,
    email: profile.email,
    name: profile.name,
    picture: profile.picture || "",
  };

  updateUserStmt.run(updated);

  return findUserByIdStmt.get(existing.id);
}

export function findUserById(id) {
  return findUserByIdStmt.get(id);
}

export function saveGeneratedPosts({ userId, redSocial, posts, origen = "gemini" }) {
  const now = new Date().toISOString();
  const tx = db.transaction((items) => {
    for (const contenido of items) {
      insertPostStmt.run({
        user_id: userId,
        red_social: redSocial,
        contenido,
        estado: "borrador",
        origen,
        created_at: now,
        updated_at: now,
      });
    }
  });

  tx(posts);
}

export function listPostsByUser(userId) {
  return listPostsByUserStmt.all(userId);
}

export function updatePostStatus({ userId, postId, estado }) {
  const updatedAt = new Date().toISOString();
  const result = updatePostStatusStmt.run({
    id: Number(postId),
    user_id: userId,
    estado,
    updated_at: updatedAt,
  });

  if (result.changes === 0) return null;
  return findPostByIdStmt.get(Number(postId));
}

export function findPostByIdForUser(userId, postId) {
  return findPostByIdAndUserStmt.get(Number(postId), userId);
}

export function createConnectedAccount({
  userId,
  platform,
  accountName,
  accountIdentifier,
  provider = "meta",
}) {
  const now = new Date().toISOString();
  const account = {
    id: randomUUID(),
    user_id: userId,
    provider,
    platform,
    account_name: accountName,
    account_identifier: accountIdentifier,
    status: "active",
    created_at: now,
  };

  insertConnectedAccountStmt.run(account);
  return findConnectedAccountByIdStmt.get(account.id);
}

export function listConnectedAccountsByUser(userId) {
  return listConnectedAccountsByUserStmt.all(userId);
}

export function disconnectConnectedAccount({ userId, accountId }) {
  const result = deactivateConnectedAccountStmt.run({
    id: accountId,
    user_id: userId,
  });

  if (result.changes === 0) return null;
  return findConnectedAccountByIdStmt.get(accountId);
}

export function findConnectedAccountById(accountId) {
  return findConnectedAccountByIdStmt.get(accountId);
}

export function createPublicationJob({
  userId,
  postId,
  connectedAccountId,
  platform,
  publishMode,
  scheduledFor,
  maxAttempts = 3,
}) {
  const now = new Date().toISOString();
  const initialStatus = new Date(scheduledFor).getTime() > Date.now() ? "scheduled" : "queued";
  const job = {
    id: randomUUID(),
    user_id: userId,
    post_id: Number(postId),
    connected_account_id: connectedAccountId,
    platform,
    publish_mode: publishMode,
    scheduled_for: scheduledFor,
    status: initialStatus,
    attempt_count: 0,
    max_attempts: maxAttempts,
    last_error: null,
    external_post_id: null,
    published_at: null,
    created_at: now,
    updated_at: now,
  };

  insertPublicationJobStmt.run(job);
  return findPublicationJobByIdStmt.get(job.id, userId);
}

export function listPublicationJobsByUser(userId) {
  return listPublicationJobsByUserStmt.all(userId);
}

export function findPublicationJobById(userId, jobId) {
  return findPublicationJobByIdStmt.get(jobId, userId);
}

export function listPublicationAttemptsByUser(userId) {
  return listPublicationAttemptsByUserStmt.all(userId);
}

export function claimDuePublicationJobs(limit = 10) {
  const now = new Date().toISOString();
  const jobs = listDuePublicationJobsStmt.all(now, limit);
  const claimed = [];

  for (const job of jobs) {
    const result = claimPublicationJobStmt.run({
      id: job.id,
      updated_at: now,
    });

    if (result.changes > 0) {
      claimed.push({ ...job, status: "processing" });
    }
  }

  return claimed;
}

export function addPublicationAttempt({ jobId, status, message }) {
  insertPublicationAttemptStmt.run({
    id: randomUUID(),
    job_id: jobId,
    status,
    message: message || "",
    created_at: new Date().toISOString(),
  });
}

export function markPublicationJobSuccess({ jobId, attemptCount, externalPostId }) {
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    markPublicationJobSuccessStmt.run({
      id: jobId,
      attempt_count: attemptCount,
      external_post_id: externalPostId,
      published_at: now,
      updated_at: now,
    });

    const job = db.prepare("SELECT post_id, user_id FROM publication_jobs WHERE id = ?").get(jobId);
    if (job) {
      updatePostStatusStmt.run({
        id: job.post_id,
        user_id: job.user_id,
        estado: "publicado",
        updated_at: now,
      });
    }
  });

  tx();
}

export function markPublicationJobRetry({
  jobId,
  attemptCount,
  lastError,
  scheduledFor,
  shouldFail,
}) {
  markPublicationJobRetryStmt.run({
    id: jobId,
    status: shouldFail ? "failed" : "retrying",
    attempt_count: attemptCount,
    last_error: lastError,
    scheduled_for: scheduledFor,
    updated_at: new Date().toISOString(),
  });
}
