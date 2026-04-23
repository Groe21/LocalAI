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

  CREATE TABLE IF NOT EXISTS post_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    post_id INTEGER NOT NULL,
    date_key TEXT NOT NULL,
    impressions INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    ctr REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(post_id, date_key),
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (post_id) REFERENCES posts (id)
  );

  CREATE TABLE IF NOT EXISTS post_utm (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    post_id INTEGER NOT NULL UNIQUE,
    source TEXT NOT NULL,
    medium TEXT NOT NULL,
    campaign TEXT NOT NULL,
    term TEXT,
    content TEXT,
    url_base TEXT NOT NULL,
    url_final TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (post_id) REFERENCES posts (id)
  );
`);

ensureColumn("posts", "updated_at", "TEXT");
ensureColumn("posts", "is_selected", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("posts", "selected_at", "TEXT");
ensureColumn("posts", "copied_count", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("posts", "last_copied_at", "TEXT");
ensureColumn("posts", "result_status", "TEXT NOT NULL DEFAULT 'sin_dato'");
ensureColumn("posts", "result_notes", "TEXT");
ensureColumn("posts", "result_updated_at", "TEXT");

db.exec(`
  UPDATE posts
  SET updated_at = COALESCE(updated_at, created_at)
  WHERE updated_at IS NULL
`);

db.exec(`
  UPDATE posts
  SET is_selected = COALESCE(is_selected, 0),
  copied_count = COALESCE(copied_count, 0),
  result_status = COALESCE(result_status, 'sin_dato')
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
  INSERT INTO posts (
    user_id,
    red_social,
    contenido,
    estado,
    origen,
    created_at,
    updated_at,
    is_selected,
    selected_at,
    copied_count,
    last_copied_at,
    result_status,
    result_notes,
    result_updated_at
  )
  VALUES (
    @user_id,
    @red_social,
    @contenido,
    @estado,
    @origen,
    @created_at,
    @updated_at,
    @is_selected,
    @selected_at,
    @copied_count,
    @last_copied_at,
    @result_status,
    @result_notes,
    @result_updated_at
  )
`);

const listPostsByUserStmt = db.prepare(`
  SELECT
    id,
    red_social,
    contenido,
    estado,
    origen,
    created_at,
    updated_at,
    COALESCE(is_selected, 0) AS is_selected,
    selected_at,
    COALESCE(copied_count, 0) AS copied_count,
      last_copied_at,
      COALESCE(result_status, 'sin_dato') AS result_status,
      result_notes,
      result_updated_at
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
  "SELECT id, user_id, red_social, contenido, estado, origen, created_at, updated_at, COALESCE(is_selected, 0) AS is_selected, selected_at, COALESCE(copied_count, 0) AS copied_count, last_copied_at, COALESCE(result_status, 'sin_dato') AS result_status, result_notes, result_updated_at FROM posts WHERE id = ?"
);

const findPostByIdAndUserStmt = db.prepare(
  "SELECT id, user_id, red_social, contenido, estado, origen, created_at, updated_at, COALESCE(is_selected, 0) AS is_selected, selected_at, COALESCE(copied_count, 0) AS copied_count, last_copied_at, COALESCE(result_status, 'sin_dato') AS result_status, result_notes, result_updated_at FROM posts WHERE id = ? AND user_id = ?"
);

const markPostSelectedStmt = db.prepare(`
  UPDATE posts
  SET is_selected = 1,
      selected_at = @selected_at,
      updated_at = @updated_at
  WHERE id = @id AND user_id = @user_id
`);

const markPostCopiedStmt = db.prepare(`
  UPDATE posts
  SET copied_count = COALESCE(copied_count, 0) + 1,
      last_copied_at = @last_copied_at,
      updated_at = @updated_at
  WHERE id = @id AND user_id = @user_id
`);

const updatePostResultStmt = db.prepare(`
  UPDATE posts
  SET result_status = @result_status,
      result_notes = @result_notes,
      result_updated_at = @result_updated_at,
      updated_at = @updated_at
  WHERE id = @id AND user_id = @user_id
`);

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

const upsertPostMetricStmt = db.prepare(`
  INSERT INTO post_metrics (
    user_id,
    post_id,
    date_key,
    impressions,
    clicks,
    ctr,
    created_at,
    updated_at
  )
  VALUES (
    @user_id,
    @post_id,
    @date_key,
    @impressions,
    @clicks,
    @ctr,
    @created_at,
    @updated_at
  )
  ON CONFLICT(post_id, date_key) DO UPDATE SET
    impressions = excluded.impressions,
    clicks = excluded.clicks,
    ctr = excluded.ctr,
    updated_at = excluded.updated_at
`);

const listPostMetricsByPostStmt = db.prepare(`
  SELECT date_key, impressions, clicks, ctr
  FROM post_metrics
  WHERE user_id = ? AND post_id = ?
  ORDER BY date_key ASC
`);

const getPostMetricsAggregateStmt = db.prepare(`
  SELECT
    COALESCE(SUM(impressions), 0) AS impressions,
    COALESCE(SUM(clicks), 0) AS clicks,
    CASE
      WHEN COALESCE(SUM(impressions), 0) > 0
      THEN ROUND((SUM(clicks) * 100.0) / SUM(impressions), 2)
      ELSE 0
    END AS ctr
  FROM post_metrics
  WHERE user_id = ? AND post_id = ?
`);

const getMetricsSummaryStmt = db.prepare(`
  SELECT
    COALESCE(SUM(impressions), 0) AS impressions,
    COALESCE(SUM(clicks), 0) AS clicks,
    CASE
      WHEN COALESCE(SUM(impressions), 0) > 0
      THEN ROUND((SUM(clicks) * 100.0) / SUM(impressions), 2)
      ELSE 0
    END AS ctr,
    COUNT(DISTINCT post_id) AS posts_with_metrics
  FROM post_metrics
  WHERE user_id = ? AND date_key >= ?
`);

const getMetricsTrendStmt = db.prepare(`
  SELECT
    date_key,
    COALESCE(SUM(impressions), 0) AS impressions,
    COALESCE(SUM(clicks), 0) AS clicks,
    CASE
      WHEN COALESCE(SUM(impressions), 0) > 0
      THEN ROUND((SUM(clicks) * 100.0) / SUM(impressions), 2)
      ELSE 0
    END AS ctr
  FROM post_metrics
  WHERE user_id = ? AND date_key >= ?
  GROUP BY date_key
  ORDER BY date_key ASC
`);

const findPostUtmByUserPostStmt = db.prepare(`
  SELECT id, post_id, source, medium, campaign, term, content, url_base, url_final, created_at, updated_at
  FROM post_utm
  WHERE user_id = ? AND post_id = ?
`);

const upsertPostUtmStmt = db.prepare(`
  INSERT INTO post_utm (
    id,
    user_id,
    post_id,
    source,
    medium,
    campaign,
    term,
    content,
    url_base,
    url_final,
    created_at,
    updated_at
  )
  VALUES (
    @id,
    @user_id,
    @post_id,
    @source,
    @medium,
    @campaign,
    @term,
    @content,
    @url_base,
    @url_final,
    @created_at,
    @updated_at
  )
  ON CONFLICT(post_id) DO UPDATE SET
    source = excluded.source,
    medium = excluded.medium,
    campaign = excluded.campaign,
    term = excluded.term,
    content = excluded.content,
    url_base = excluded.url_base,
    url_final = excluded.url_final,
    updated_at = excluded.updated_at
`);

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function seededRatio(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildUtmUrl(urlBase, utmData) {
  let normalized = String(urlBase || "").trim();
  if (!normalized) {
    normalized = "https://localai.ec";
  }
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  const url = new URL(normalized);
  url.searchParams.set("utm_source", utmData.source);
  url.searchParams.set("utm_medium", utmData.medium);
  url.searchParams.set("utm_campaign", utmData.campaign);
  if (utmData.term) url.searchParams.set("utm_term", utmData.term);
  if (utmData.content) url.searchParams.set("utm_content", utmData.content);
  return url.toString();
}

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

export function saveGeneratedPosts({
  userId,
  redSocial,
  posts,
  origen = "gemini",
  selectedOnSave = false,
  copiedOnSave = false,
}) {
  const now = new Date().toISOString();
  const saved = [];
  const tx = db.transaction((items) => {
    for (const contenido of items) {
      const inserted = insertPostStmt.run({
        user_id: userId,
        red_social: redSocial,
        contenido,
        estado: "borrador",
        origen,
        created_at: now,
        updated_at: now,
        is_selected: selectedOnSave ? 1 : 0,
        selected_at: selectedOnSave ? now : null,
        copied_count: copiedOnSave ? 1 : 0,
        last_copied_at: copiedOnSave ? now : null,
        result_status: "sin_dato",
        result_notes: null,
        result_updated_at: null,
      });

      const row = findPostByIdStmt.get(Number(inserted.lastInsertRowid));
      if (row) saved.push(row);
    }
  });

  tx(posts);
  return saved;
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

export function simulatePostMetrics({ userId, postId, days = 7 }) {
  const post = findPostByIdAndUserStmt.get(Number(postId), userId);
  if (!post) return null;

  const safeDays = Math.min(Math.max(Number(days) || 7, 1), 30);
  const now = new Date();
  const tx = db.transaction(() => {
    for (let i = safeDays - 1; i >= 0; i -= 1) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      const dateKey = toDateKey(day);
      const seed = Number(postId) * 997 + i * 37;
      const impressions = Math.max(50, Math.floor(200 + seededRatio(seed) * 2200));
      const clickRatio = 0.01 + seededRatio(seed + 13) * 0.08;
      const clicks = Math.max(1, Math.round(impressions * clickRatio));
      const ctr = Number(((clicks * 100) / impressions).toFixed(2));
      const iso = new Date().toISOString();

      upsertPostMetricStmt.run({
        user_id: userId,
        post_id: Number(postId),
        date_key: dateKey,
        impressions,
        clicks,
        ctr,
        created_at: iso,
        updated_at: iso,
      });
    }
  });

  tx();

  return {
    metrics: listPostMetricsByPostStmt.all(userId, Number(postId)),
    aggregate: getPostMetricsAggregateStmt.get(userId, Number(postId)),
  };
}

export function getMetricsSummaryByRange({ userId, range = "7d" }) {
  const allowedRanges = {
    "7d": 7,
    "30d": 30,
  };
  const days = allowedRanges[range] || 7;
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceDateKey = toDateKey(since);

  return {
    range: `${days}d`,
    summary: getMetricsSummaryStmt.get(userId, sinceDateKey),
    trend: getMetricsTrendStmt.all(userId, sinceDateKey),
  };
}

export function getPostMetricsByPost({ userId, postId }) {
  return {
    metrics: listPostMetricsByPostStmt.all(userId, Number(postId)),
    aggregate: getPostMetricsAggregateStmt.get(userId, Number(postId)),
  };
}

export function upsertPostUtm({
  userId,
  postId,
  source,
  medium,
  campaign,
  term,
  content,
  urlBase,
}) {
  const post = findPostByIdAndUserStmt.get(Number(postId), userId);
  if (!post) return null;

  const base = (urlBase || "https://localai.ec").trim();
  const utm = {
    source: (source || post.red_social || "instagram").trim().toLowerCase(),
    medium: (medium || "social").trim().toLowerCase(),
    campaign: (campaign || `post-${post.id}`).trim().toLowerCase().replace(/\s+/g, "-"),
    term: (term || "").trim().toLowerCase().replace(/\s+/g, "-"),
    content: (content || `estado-${post.estado}`).trim().toLowerCase().replace(/\s+/g, "-"),
  };

  const row = {
    id: randomUUID(),
    user_id: userId,
    post_id: Number(postId),
    source: utm.source,
    medium: utm.medium,
    campaign: utm.campaign,
    term: utm.term,
    content: utm.content,
    url_base: base,
    url_final: buildUtmUrl(base, utm),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  upsertPostUtmStmt.run(row);
  return findPostUtmByUserPostStmt.get(userId, Number(postId));
}

export function getPostUtmByPost({ userId, postId }) {
  return findPostUtmByUserPostStmt.get(userId, Number(postId)) || null;
}

export function registerPostInteraction({ userId, postId, action }) {
  const now = new Date().toISOString();
  const id = Number(postId);

  let result = null;
  if (action === "selected") {
    result = markPostSelectedStmt.run({
      id,
      user_id: userId,
      selected_at: now,
      updated_at: now,
    });
  } else if (action === "copied") {
    result = markPostCopiedStmt.run({
      id,
      user_id: userId,
      last_copied_at: now,
      updated_at: now,
    });
  } else {
    return null;
  }

  if (!result || result.changes === 0) return null;
  return findPostByIdStmt.get(id);
}

export function updatePostResult({ userId, postId, resultStatus, resultNotes }) {
  const allowed = ["sin_dato", "dio_resultados", "no_dio_resultados"];
  const status = allowed.includes(resultStatus) ? resultStatus : "sin_dato";
  const notes = String(resultNotes || "").trim();
  const now = new Date().toISOString();

  const result = updatePostResultStmt.run({
    id: Number(postId),
    user_id: userId,
    result_status: status,
    result_notes: notes || null,
    result_updated_at: now,
    updated_at: now,
  });

  if (!result || result.changes === 0) return null;
  return findPostByIdStmt.get(Number(postId));
}
