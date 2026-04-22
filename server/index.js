import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import express from "express";
import cors from "cors";

import { generarPosts, generarPostsFallback } from "./gemini.js";
import { authRequired, loginWithGoogle } from "./auth.js";
import {
  createConnectedAccount,
  disconnectConnectedAccount,
  findConnectedAccountById,
  findPostByIdForUser,
  listConnectedAccountsByUser,
  listPostsByUser,
  saveGeneratedPosts,
  updatePostStatus,
} from "./db.js";
import {
  enqueuePublicationJob,
  getPublicationSnapshot,
  startPublicationScheduler,
} from "./publisher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3001;
const META_PLATFORMS = ["Instagram", "Facebook"];

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

      if (!esSaturacion) {
        throw errorPosts;
      }

      console.warn("Gemini saturado, usando fallback local de posts.");
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
    const { posts, redSocial, origen } = req.body || {};

    if (!Array.isArray(posts) || posts.length === 0 || !redSocial) {
      return res.status(400).json({ error: "Datos invalidos para guardar posts" });
    }

    saveGeneratedPosts({
      userId: req.user.id,
      redSocial,
      posts,
      origen: origen || "gemini",
    });

    return res.status(201).json({ ok: true });
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

app.get("/api/accounts", authRequired, (req, res) => {
  try {
    const accounts = listConnectedAccountsByUser(req.user.id);
    return res.json({ accounts });
  } catch (error) {
    console.error("Error listando cuentas conectadas:", error.message);
    return res.status(500).json({ error: "No se pudieron obtener las cuentas" });
  }
});

app.post("/api/accounts", authRequired, (req, res) => {
  try {
    const { platform, accountName, accountIdentifier } = req.body || {};

    if (!META_PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: "Solo se permite conectar Instagram o Facebook" });
    }

    if (!accountName) {
      return res.status(400).json({ error: "Falta el nombre de la cuenta" });
    }

    const account = createConnectedAccount({
      userId: req.user.id,
      platform,
      accountName,
      accountIdentifier: accountIdentifier || accountName,
    });

    return res.status(201).json({ account });
  } catch (error) {
    console.error("Error conectando cuenta:", error.message);
    return res.status(500).json({ error: "No se pudo conectar la cuenta" });
  }
});

app.delete("/api/accounts/:id", authRequired, (req, res) => {
  try {
    const account = disconnectConnectedAccount({
      userId: req.user.id,
      accountId: req.params.id,
    });

    if (!account) {
      return res.status(404).json({ error: "Cuenta no encontrada" });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("Error desconectando cuenta:", error.message);
    return res.status(500).json({ error: "No se pudo desconectar la cuenta" });
  }
});

app.get("/api/publications", authRequired, (req, res) => {
  try {
    const snapshot = getPublicationSnapshot(req.user.id);
    return res.json(snapshot);
  } catch (error) {
    console.error("Error listando publicaciones:", error.message);
    return res.status(500).json({ error: "No se pudo obtener la cola de publicaciones" });
  }
});

app.post("/api/posts/:id/publish", authRequired, async (req, res) => {
  try {
    const { connectedAccountId, scheduledFor } = req.body || {};

    if (!connectedAccountId) {
      return res.status(400).json({ error: "Falta la cuenta conectada" });
    }

    const post = findPostByIdForUser(req.user.id, req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post no encontrado" });
    }

    if (!META_PLATFORMS.includes(post.red_social)) {
      return res.status(400).json({
        error: "La automatizacion local de Fase 2 solo soporta Instagram y Facebook",
      });
    }

    const account = findConnectedAccountById(connectedAccountId);
    if (!account || account.user_id !== req.user.id || account.status !== "active") {
      return res.status(404).json({ error: "Cuenta conectada no valida" });
    }

    if (account.platform !== post.red_social) {
      return res.status(400).json({
        error: "La cuenta conectada no coincide con la red social del post",
      });
    }

    const scheduleDate = scheduledFor ? new Date(scheduledFor) : new Date();
    if (Number.isNaN(scheduleDate.getTime())) {
      return res.status(400).json({ error: "Fecha de programacion invalida" });
    }

    const job = await enqueuePublicationJob({
      userId: req.user.id,
      postId: req.params.id,
      connectedAccountId,
      platform: post.red_social,
      publishMode: scheduledFor ? "scheduled" : "manual",
      scheduledFor: scheduleDate.toISOString(),
    });

    return res.status(201).json({ job });
  } catch (error) {
    console.error("Error creando publicacion:", error.message);
    return res.status(500).json({ error: "No se pudo crear la publicacion" });
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

startPublicationScheduler();
