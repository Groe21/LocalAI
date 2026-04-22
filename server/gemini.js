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

const FORMATOS = {
  Instagram: `Formato Instagram:
- Gancho visual en la primera línea (máx 10 palabras para que no se corte)
- Cuerpo de 80-150 palabras con storytelling y emojis
- Llamada a la acción clara (ej: "Link en bio", "Escríbenos", "Visítanos")
- 5 a 8 hashtags al final mezclando populares y de nicho`,

  WhatsApp: `Formato WhatsApp (mensaje directo al cliente):
- Tono conversacional, como si lo enviara un amigo
- Máximo 80 palabras, corto y directo
- Sin hashtags (no funcionan en WhatsApp)
- 1 o 2 emojis máximo, nada exagerado
- Terminar con CTA de acción inmediata: número, link o "Responde este mensaje"`,

  Facebook: `Formato Facebook:
- Introducción con pregunta o dato curioso para generar interacción
- Cuerpo de 100-200 palabras contando una historia o beneficio concreto
- Invitar a comentar, etiquetar o compartir
- 1 a 3 hashtags al final (Facebook penaliza el exceso)
- Emojis moderados para dar dinamismo`,
};

export async function generarPosts(negocio, redSocial) {
  const formatoEspecifico = FORMATOS[redSocial] || "";

  const prompt = `Eres un experto en marketing digital para Latinoamérica.
Genera exactamente 3 variantes de post para ${redSocial} para este negocio:
"${negocio}"

${formatoEspecifico}

Reglas generales:
- En español neutro latinoamericano
- Tono cercano y auténtico, no corporativo
- Cada variante debe sonar diferente (no repetir la misma estructura)
- Separar cada post con la línea: ---POST---

Responde SOLO con los 3 posts, sin títulos ni explicaciones adicionales.`;

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
  if (redSocial === "WhatsApp") {
    return [
      `Hola! 👋 En ${negocio} tenemos justo lo que necesitas. Escríbenos y te contamos todo. ¡Responde este mensaje!`,
      `¿Buscas calidad y buen precio? 💪 ${negocio} es tu mejor opción. Contáctanos hoy mismo.`,
      `Atención especial para ti 🎯 ${negocio} está listo para ayudarte. ¡Escríbenos ahora!`,
    ];
  }

  if (redSocial === "Facebook") {
    return [
      `¿Sabías que encontrar calidad y precio justo en un solo lugar es posible? 🙌 En ${negocio} lo hacemos realidad cada día. Cuéntanos en los comentarios: ¿qué es lo más importante para ti al elegir un negocio local? #ComercioLocal #Emprendimiento`,
      `Hoy queremos contarte por qué ${negocio} se ha convertido en la opción favorita de nuestra comunidad. Servicio cercano, propuesta clara y resultados que se notan desde el primer día. ¿Ya nos conoces? Etiqueta a alguien que debería saber de nosotros 👇 #NegocioLocal #HechoEnLatam`,
      `Cada cliente que confía en ${negocio} nos impulsa a mejorar. 💚 Si todavía no nos has visitado, este es el momento. Comparte esta publicación y ayúdanos a llegar a más personas de tu comunidad. #ApoyaLocal #CompraLocal`,
    ];
  }

  // Instagram por defecto
  return [
    `✨ ${negocio} llegó para quedarse.\nCalidad, atención y propuesta real para ti.\n→ Escríbenos o visita el link en bio.\n#NegocioLocal #MarketingDigital #Emprendedores #HechoEnLatam #ComercioLocal`,
    `💥 ¿Listo para una experiencia diferente?\n${negocio} combina buen servicio con precios justos. Porque mereces lo mejor sin complicaciones.\n→ Contáctanos hoy.\n#Emprendimiento #ApoyaLocal #ClientesPrimero #NegociosLatam #CompraLocal`,
    `🙌 Cada día trabajamos para que ${negocio} sea tu primera opción.\nPropuesta clara. Atención real. Resultados que se sienten.\n→ Escríbenos y descubre todo lo que tenemos para ti.\n#MarcaLocal #ComunidadLatam #EmprendedoresEcuador #NegocioDigital #MarketingLatam`,
  ];
}
