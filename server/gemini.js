import { GoogleGenerativeAI } from "@google/generative-ai";

let model;

function getModel() {
  if (!model) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }
  return model;
}

export async function generarPosts(negocio, redSocial) {
  const prompt = `Eres un experto en marketing digital para Latinoamérica.
Genera exactamente 3 variantes de post para ${redSocial} para este negocio:
"${negocio}"

Reglas:
- En español neutro latinoamericano
- Cada post máximo 150 palabras
- Incluir emojis relevantes
- Incluir 3-5 hashtags al final
- Tono cercano y auténtico, no corporativo
- Separar cada post con la línea: ---POST---

Responde SOLO con los 3 posts, sin explicaciones adicionales.`;

  const result = await getModel().generateContent(prompt);
  const texto = result.response.text();

  const limpiarPost = (contenido) =>
    contenido
      .replace(/^["'`*_\s-]*POST\s*\d+\s*[:.)-]?\s*/i, "")
      .replace(/^[-\s]+|[-\s]+$/g, "")
      .trim();

  // Intento principal: delimitador solicitado y separadores comunes.
  let posts = texto
    .split(/---POST---|^---+\s*$/gim)
    .map((p) => limpiarPost(p))
    .filter((p) => p.length > 0);

  // Fallback por si Gemini no respeta el delimitador exacto.
  if (posts.length === 1) {
    posts = texto
      .split(/\n\s*\n+/)
      .map((p) => limpiarPost(p))
      .filter((p) => p.length > 0)
      .slice(0, 3);
  }

  return posts.slice(0, 3);
}
