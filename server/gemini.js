const LMSTUDIO_BASE_URL =
  process.env.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234/v1";
const LMSTUDIO_MODEL =
  process.env.LMSTUDIO_MODEL || "deepseek-r1-distill-qwen-7b";

async function generarConLMStudio(prompt) {
  const response = await fetch(`${LMSTUDIO_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LMSTUDIO_MODEL,
      temperature: 0.8,
      top_p: 0.9,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content:
            "Eres un experto en marketing digital para negocios locales de Latinoamerica.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detalle = await response.text();
    throw new Error(
      `LM Studio respondio ${response.status}: ${detalle || "sin detalle"}`
    );
  }

  const data = await response.json();
  const texto = data?.choices?.[0]?.message?.content;

  if (!texto || typeof texto !== "string") {
    throw new Error("Respuesta invalida de LM Studio");
  }

  return texto;
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

  const texto = await generarConLMStudio(prompt);

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

  // Fallback por si el modelo no respeta el delimitador exacto.
  if (posts.length === 1) {
    posts = texto
      .split(/\n\s*\n+/)
      .map((p) => limpiarPost(p))
      .filter((p) => p.length > 0)
      .slice(0, 3);
  }

  return posts.slice(0, 3);
}
