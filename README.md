# 🇪🇨 LocalAI — Marketing con IA para negocios locales

App web que genera posts listos para **Instagram**, **WhatsApp** y **Facebook** usando **Gemini AI**, pensada para dueños de negocios pequeños en Latinoamérica.

## ¿Cómo funciona?

1. Describe tu negocio con ciudad, producto y propuesta de valor
2. Elige la red social
3. La IA genera 3 variantes de post con emojis y hashtags
4. Copia y pega en tu red social favorita

## Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express / Vercel Serverless Functions
- **IA**: Google Gemini API (`gemini-2.5-flash`)
- **Deploy**: Vercel

## Ejecutar localmente

```bash
# Instalar dependencias
npm install
npm install --prefix client

# Crear archivo de variables de entorno
echo "GEMINI_API_KEY=tu_clave_aqui" > server/.env

# Iniciar en desarrollo (backend + frontend juntos)
npm run dev
```

## Variables de entorno

| Variable | Descripción |
|---|---|
| `GEMINI_API_KEY` | Clave de API de Google Gemini (obligatoria) |

Obtén tu clave gratis en: https://aistudio.google.com/apikey

## Deploy en Vercel

1. Sube el repo a GitHub
2. Importa el proyecto en [vercel.com](https://vercel.com)
3. En **Root Directory** selecciona `localai` si tu repo tiene carpeta padre
4. En **Environment Variables** agrega `GEMINI_API_KEY` con tu clave
5. Deploy ✅

## Proyecto presentado en BUILD IA UIO 🇪🇨