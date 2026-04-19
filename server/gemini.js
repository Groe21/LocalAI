import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

  const result = await model.generateContent(prompt);
  const texto = result.response.text();

  // Separar los 3 posts usando el delimitador ---POST---
  const posts = texto
    .split("---POST---")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return posts;
}
