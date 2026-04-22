import { generarPosts, generarPostsFallback } from "../server/gemini.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo no permitido" });
  }

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

      posts = generarPostsFallback(negocio, redSocial);
    }

    return res.status(200).json({ posts });
  } catch (error) {
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
}
