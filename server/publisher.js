import {
  addPublicationAttempt,
  claimDuePublicationJobs,
  createPublicationJob,
  listPublicationAttemptsByUser,
  listPublicationJobsByUser,
  markPublicationJobRetry,
  markPublicationJobSuccess,
} from "./db.js";

const RETRY_DELAY_MS = 60 * 1000;
let schedulerHandle = null;
let processing = false;

function buildExternalPostId(platform) {
  return `mock_${platform.toLowerCase()}_${Date.now()}`;
}

function simulateMetaPublish(job) {
  const content = (job.contenido || "").toLowerCase();
  const shouldFail =
    content.includes("#failpublish") ||
    content.includes("#errorpublish") ||
    content.includes("error-meta");

  if (shouldFail) {
    throw new Error("La simulacion local de Meta rechazo la publicacion");
  }

  return {
    externalPostId: buildExternalPostId(job.platform),
    message: `Publicado en ${job.account_name}`,
  };
}

async function processJob(job) {
  const nextAttempt = job.attempt_count + 1;

  try {
    const result = simulateMetaPublish(job);
    addPublicationAttempt({
      jobId: job.id,
      status: "success",
      message: result.message,
    });
    markPublicationJobSuccess({
      jobId: job.id,
      attemptCount: nextAttempt,
      externalPostId: result.externalPostId,
    });
  } catch (error) {
    const shouldFail = nextAttempt >= job.max_attempts;
    addPublicationAttempt({
      jobId: job.id,
      status: shouldFail ? "failed" : "retry",
      message: error.message,
    });
    markPublicationJobRetry({
      jobId: job.id,
      attemptCount: nextAttempt,
      lastError: error.message,
      scheduledFor: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
      shouldFail,
    });
  }
}

export async function processDuePublicationJobs() {
  if (processing) return;

  processing = true;
  try {
    const jobs = claimDuePublicationJobs(10);
    for (const job of jobs) {
      await processJob(job);
    }
  } finally {
    processing = false;
  }
}

export function startPublicationScheduler() {
  if (schedulerHandle) return schedulerHandle;

  schedulerHandle = setInterval(() => {
    processDuePublicationJobs().catch((error) => {
      console.error("Error procesando cola de publicaciones:", error.message);
    });
  }, 10 * 1000);

  return schedulerHandle;
}

export async function enqueuePublicationJob(params) {
  const job = createPublicationJob(params);
  processDuePublicationJobs().catch((error) => {
    console.error("Error procesando job inmediato:", error.message);
  });
  return job;
}

export function getPublicationSnapshot(userId) {
  return {
    jobs: listPublicationJobsByUser(userId),
    attempts: listPublicationAttemptsByUser(userId),
  };
}