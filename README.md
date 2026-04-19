# 🇪🇨 LocalAI — Marketing con IA para negocios locales

App web que genera posts listos para **Instagram**, **WhatsApp** y **Facebook** usando inteligencia artificial (Gemini de Google), pensada para dueños de negocios pequeños en Latinoamérica.

## ¿Cómo funciona?

1. Describe tu negocio en pocas palabras
2. Elige la red social
3. La IA genera 3 variantes de post con emojis y hashtags
4. Copia y pega en tu red social favorita

## Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **IA**: Gemini 1.5 Flash (Google AI Studio)
- **Deploy**: Railway

## Ejecutar localmente

```bash
# Instalar dependencias
npm install
npm install --prefix client

# Configurar API key
cp server/.env.example server/.env
# Editar server/.env con tu GEMINI_API_KEY

# Iniciar en desarrollo
npm run dev:server   # Terminal 1
npm run dev:client   # Terminal 2 (desde /client)
```

## Deploy en Railway

1. Conecta este repo en Railway
2. Agrega la variable `GEMINI_API_KEY` en Settings > Variables
3. Railway ejecuta automáticamente `npm run build && npm start`

## Proyecto presentado en BUILD IA UIO 🇪🇨