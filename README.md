# 🇪🇨 LocalAI — Marketing con IA para negocios locales

App web que genera posts listos para **Instagram**, **WhatsApp** y **Facebook** usando inteligencia artificial local (LM Studio), pensada para dueños de negocios pequeños en Latinoamérica.

## ¿Cómo funciona?

1. Describe tu negocio en pocas palabras
2. Elige la red social
3. La IA genera 3 variantes de post con emojis y hashtags
4. Copia y pega en tu red social favorita

## Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **IA**: Modelo local en LM Studio (por defecto `deepseek-r1-distill-qwen-7b`)
- **Deploy**: Railway

## Ejecutar localmente

```bash
# Instalar dependencias
npm install
npm install --prefix client

# Configurar variables para LM Studio (Windows PowerShell)
# Asegurate de tener LM Studio levantado con Local Server en el puerto 1234
$env:LMSTUDIO_BASE_URL="http://127.0.0.1:1234/v1"
$env:LMSTUDIO_MODEL="deepseek-r1-distill-qwen-7b"

# Iniciar en desarrollo
npm run dev:server   # Terminal 1
npm run dev:client   # Terminal 2 (desde /client)
```

## Variables de entorno

- `LMSTUDIO_BASE_URL`: URL base del servidor OpenAI-compatible de LM Studio.
- `LMSTUDIO_MODEL`: nombre exacto del modelo cargado en LM Studio.

Valores por defecto usados por el backend:

- `LMSTUDIO_BASE_URL=http://127.0.0.1:1234/v1`
- `LMSTUDIO_MODEL=deepseek-r1-distill-qwen-7b`

## Deploy en Railway

1. Conecta este repo en Railway
2. Si usas un endpoint de inferencia remoto compatible con OpenAI, configura `LMSTUDIO_BASE_URL` y `LMSTUDIO_MODEL` en Settings > Variables
3. Railway ejecuta automáticamente `npm run build && npm start`

## Proyecto presentado en BUILD IA UIO 🇪🇨