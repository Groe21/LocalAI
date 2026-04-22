import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

import express from "express";
import cors from "cors";
import { generarPosts, generarPostsFallback } from "./gemini.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// --- API Route ---
app.post("/api/generate", async (req, res) => {
  const { negocio, redSocial } = req.body;

  // Validación de entrada
  if (!negocio || !redSocial) {
    return res.status(400).json({
      error: "Faltan campos requeridos: negocio y redSocial",
    });
  }

  const redesValidas = ["Instagram", "WhatsApp", "Facebook"];
  if (!redesValidas.includes(redSocial)) {
    return res.status(400).json({
      error: "Red social no válida. Usa: Instagram, WhatsApp o Facebook",
    });
  }

  try {
    let posts;
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
    }

    res.json({ posts });
  } catch (error) {
    console.error("Error al generar posts:", error.message);
    const msg = (error?.message || "").toLowerCase();
    const esSaturacion =
      msg.includes("429") ||
      msg.includes("503") ||
      msg.includes("high demand") ||
      msg.includes("unavailable");
    res.status(500).json({
      error: esSaturacion
        ? "Gemini esta con alta demanda. Intenta de nuevo en unos segundos."
        : "Error al generar los posts. Intenta de nuevo.",
    });
  }
});

// --- Servir frontend en producción ---
import fs from "fs";
const clientDist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// --- Iniciar servidor ---
app.listen(PORT, () => {
  console.log(`✅ Servidor LocalAI corriendo en http://localhost:${PORT}`);
});
