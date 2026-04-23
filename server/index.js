import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import express from "express";
import cors from "cors";

import {
  generarPosts,
  generarPostsFallback,
  generarRecomendacionCopy,
  generarRespuestaCoach,
} from "./gemini.js";
import { authRequired, loginWithGoogle } from "./auth.js";
import {
  findPostByIdForUser,
  getMetricsSummaryByRange,
  getPostMetricsByPost,
  getPostUtmByPost,
  listPostsByUser,
  registerPostInteraction,
  saveGeneratedPosts,
  simulatePostMetrics,
  upsertPostUtm,
  updatePostResult,
  updatePostStatus,
} from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.post("/api/auth/google", async (req, res) => {
  try {
    const { idToken } = req.body || {};

    if (!idToken) {
      return res.status(400).json({ error: "Falta idToken de Google" });
    }

    const session = await loginWithGoogle(idToken);
    return res.json(session);
  } catch (error) {
    console.error("Error login Google:", error.message);
    return res.status(401).json({ error: "No se pudo iniciar sesion" });
  }
});

app.get("/api/me", authRequired, (req, res) => {
  return res.json({ user: req.user });
});

app.post("/api/generate", async (req, res) => {
  const { negocio, redSocial } = req.body || {};

  if (!negocio || !redSocial) {
    return res.status(400).json({
      error: "Faltan campos requeridos: negocio y redSocial",
    });
  }

  const redesValidas = ["Instagram", "WhatsApp", "Facebook"];
  if (!redesValidas.includes(redSocial)) {
    return res.status(400).json({
      error: "Red social no valida. Usa: Instagram, WhatsApp o Facebook",
    });
  }

  try {
    let posts;
    let origen = "gemini";

    try {
      posts = await generarPosts(negocio, redSocial);
    } catch (errorPosts) {
      const msg = (errorPosts?.message || "").toLowerCase();
      const esSaturacion =
        msg.includes("429") ||
        msg.includes("503") ||
        msg.includes("high demand") ||
        msg.includes("unavailable");
      const apiKeyInvalida =
        msg.includes("api key not valid") ||
        msg.includes("api_key_invalid");

      if (!esSaturacion && !apiKeyInvalida) {
        throw errorPosts;
      }

      console.warn(
        apiKeyInvalida
          ? "GEMINI_API_KEY invalida, usando fallback local de posts."
          : "Gemini saturado, usando fallback local de posts."
      );
      posts = generarPostsFallback(negocio, redSocial);
      origen = "fallback";
    }

    return res.json({ posts, origen });
  } catch (error) {
    console.error("Error al generar posts:", error.message);
    const msg = (error?.message || "").toLowerCase();
    const esSaturacion =
      msg.includes("429") ||
      msg.includes("503") ||
      msg.includes("high demand") ||
      msg.includes("unavailable");

    return res.status(500).json({
      error: esSaturacion
        ? "Gemini esta con alta demanda. Intenta de nuevo en unos segundos."
        : "Error al generar los posts. Intenta de nuevo.",
    });
  }
});

app.post("/api/posts", authRequired, (req, res) => {
  try {
    const { posts, redSocial, origen, selectedOnSave, copiedOnSave } = req.body || {};

    if (!Array.isArray(posts) || posts.length === 0 || !redSocial) {
      return res.status(400).json({ error: "Datos invalidos para guardar posts" });
    }

    const saved = saveGeneratedPosts({
      userId: req.user.id,
      redSocial,
      posts,
      origen: origen || "gemini",
      selectedOnSave: Boolean(selectedOnSave),
      copiedOnSave: Boolean(copiedOnSave),
    });

    return res.status(201).json({ ok: true, posts: saved });
  } catch (error) {
    console.error("Error guardando posts:", error.message);
    return res.status(500).json({ error: "No se pudieron guardar los posts" });
  }
});

app.get("/api/posts", authRequired, (req, res) => {
  try {
    const items = listPostsByUser(req.user.id);
    return res.json({ posts: items });
  } catch (error) {
    console.error("Error listando posts:", error.message);
    return res.status(500).json({ error: "No se pudo obtener el historial" });
  }
});

app.patch("/api/posts/:id/status", authRequired, (req, res) => {
  const { estado } = req.body || {};
  const estadosValidos = ["borrador", "aprobado", "publicado"];

  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({
      error: "Estado invalido. Usa: borrador, aprobado o publicado",
    });
  }

  const post = updatePostStatus({
    userId: req.user.id,
    postId: req.params.id,
    estado,
  });

  if (!post) {
    return res.status(404).json({ error: "Post no encontrado" });
  }

  return res.json({ post });
});

app.post("/api/posts/:id/interaction", authRequired, (req, res) => {
  try {
    const { action } = req.body || {};
    const post = registerPostInteraction({
      userId: req.user.id,
      postId: req.params.id,
      action,
    });

    if (!post) {
      return res.status(404).json({ error: "Post no encontrado o accion invalida" });
    }

    return res.json({ post });
  } catch (error) {
    console.error("Error registrando interaccion:", error.message);
    return res.status(500).json({ error: "No se pudo registrar la interaccion" });
  }
});

app.patch("/api/posts/:id/result", authRequired, (req, res) => {
  try {
    const { resultStatus, resultNotes } = req.body || {};
    const post = updatePostResult({
      userId: req.user.id,
      postId: req.params.id,
      resultStatus,
      resultNotes,
    });

    if (!post) {
      return res.status(404).json({ error: "Post no encontrado" });
    }

    return res.json({ post });
  } catch (error) {
    console.error("Error actualizando resultado del post:", error.message);
    return res.status(500).json({ error: "No se pudo actualizar el resultado" });
  }
});

app.post("/api/posts/:id/metrics/simulate", authRequired, (req, res) => {
  try {
    const { days } = req.body || {};
    const result = simulatePostMetrics({
      userId: req.user.id,
      postId: req.params.id,
      days,
    });

    if (!result) {
      return res.status(404).json({ error: "Post no encontrado" });
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error("Error simulando metricas:", error.message);
    return res.status(500).json({ error: "No se pudieron simular metricas" });
  }
});

app.get("/api/metrics/summary", authRequired, (req, res) => {
  try {
    const range = String(req.query?.range || "7d");
    const summary = getMetricsSummaryByRange({
      userId: req.user.id,
      range,
    });
    return res.json(summary);
  } catch (error) {
    console.error("Error obteniendo resumen de metricas:", error.message);
    return res.status(500).json({ error: "No se pudo obtener el resumen de metricas" });
  }
});

app.post("/api/posts/:id/utm", authRequired, (req, res) => {
  try {
    const utm = upsertPostUtm({
      userId: req.user.id,
      postId: req.params.id,
      ...(req.body || {}),
    });

    if (!utm) {
      return res.status(404).json({ error: "Post no encontrado" });
    }

    return res.status(201).json({ utm });
  } catch (error) {
    console.error("Error generando UTM:", error.message);
    return res.status(500).json({ error: "No se pudo generar UTM" });
  }
});

app.get("/api/posts/:id/utm", authRequired, (req, res) => {
  try {
    const utm = getPostUtmByPost({
      userId: req.user.id,
      postId: req.params.id,
    });

    if (!utm) {
      return res.status(404).json({ error: "UTM no encontrado para este post" });
    }

    return res.json({ utm });
  } catch (error) {
    console.error("Error leyendo UTM:", error.message);
    return res.status(500).json({ error: "No se pudo leer UTM" });
  }
});

app.post("/api/posts/:id/recommendation", authRequired, async (req, res) => {
  try {
    const post = findPostByIdForUser(req.user.id, req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post no encontrado" });
    }

    const metricsInfo = getPostMetricsByPost({
      userId: req.user.id,
      postId: req.params.id,
    });

    const recommendation = await generarRecomendacionCopy({
      contenido: post.contenido,
      redSocial: post.red_social,
      metricas: metricsInfo?.aggregate,
      resultado: {
        status: post.result_status,
        notes: post.result_notes,
      },
    });

    return res.json({ recommendation, metrics: metricsInfo?.aggregate || null });
  } catch (error) {
    console.error("Error generando recomendacion:", error.message);
    return res.status(500).json({ error: "No se pudo generar la recomendacion" });
  }
});

app.post("/api/chat/coach", authRequired, async (req, res) => {
  try {
    const { message, negocio, redSocial, ultimoPost } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Falta el mensaje para el coach" });
    }

    const answer = await generarRespuestaCoach({
      message: String(message).trim(),
      negocio: String(negocio || "").trim(),
      redSocial: String(redSocial || "").trim(),
      ultimoPost: String(ultimoPost || "").trim(),
      userName: req.user?.name || "",
    });

    return res.json({ answer });
  } catch (error) {
    console.error("Error en coach IA:", error.message);
    return res.status(500).json({ error: "No se pudo obtener respuesta del coach" });
  }
});

const clientDist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Servidor LocalAI corriendo en http://localhost:${PORT}`);
});
