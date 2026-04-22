import { GoogleGenerativeAI } from "@google/generative-ai";

const MODELOS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
const MAX_REINTENTOS = 2;
const modelCache = new Map();

function getModel(modelName) {
  if (!modelCache.has(modelName)) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    modelCache.set(modelName, genAI.getGenerativeModel({ model: modelName }));
  }
  return modelCache.get(modelName);
}

function esErrorTransitorio(error) {
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("high demand") ||
    msg.includes("unavailable")
  );
}

async function esperar(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generarTextoConFallback(prompt) {
  let ultimoError;

  for (const modelName of MODELOS) {
    for (let intento = 0; intento <= MAX_REINTENTOS; intento += 1) {
      try {
        const result = await getModel(modelName).generateContent(prompt);
        return result.response.text().trim();
      } catch (error) {
        ultimoError = error;
        const ultimoIntento = intento === MAX_REINTENTOS;
        if (!esErrorTransitorio(error) || ultimoIntento) {
          break;
        }
        await esperar(500 * (intento + 1));
      }
    }
  }

  throw ultimoError;
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

  const texto = await generarTextoConFallback(prompt);

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

export function generarPostsFallback(negocio, redSocial) {
  const hashtagsBase = "#NegocioLocal #MarketingDigital #Emprendedores";
  return [
    `Tu negocio merece destacar en ${redSocial}. En ${negocio}, trabajamos cada dia para ofrecer calidad y cercania. Si quieres una opcion confiable y con atencion personalizada, este es el momento de conocernos. Escrbenos hoy y descubre todo lo que tenemos para ti. ${hashtagsBase}`,
    `Si estas buscando una experiencia diferente en ${redSocial}, ${negocio} es para ti. Combinamos buen servicio, propuesta clara y resultados que se sienten desde la primera visita. Te invitamos a probar y compartir tu experiencia con nosotros. #ComercioLocal #HechoEnEcuador #ClientesFelices`,
    `Hoy puede ser el mejor dia para probar algo nuevo. En ${negocio} queremos ayudarte con una propuesta pensada para ti y tu comunidad. Visitanos, pide informacion y llevate una experiencia autentica para compartir en ${redSocial}. #ApoyaLocal #Emprendimiento #CompraLocal`,
  ];
}
