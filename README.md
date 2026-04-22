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

# Crear variables de backend
cat > server/.env << 'EOF'
GEMINI_API_KEY=tu_clave_gemini
GOOGLE_CLIENT_ID=tu_google_client_id
APP_JWT_SECRET=un_secreto_largo_y_seguro
PORT=3001
EOF

# Crear variables de frontend
cat > client/.env << 'EOF'
VITE_GOOGLE_CLIENT_ID=tu_google_client_id
EOF

# Iniciar en desarrollo (backend + frontend juntos)
npm run dev
```

## Variables de entorno

### Backend (`server/.env`)

| Variable | Descripción |
|---|---|
| `GEMINI_API_KEY` | Clave de API de Google Gemini (obligatoria) |
| `GOOGLE_CLIENT_ID` | Client ID OAuth de Google para validar login |
| `APP_JWT_SECRET` | Secreto para firmar tokens de sesión |
| `PORT` | Puerto local del backend (ej: 3001) |

### Frontend (`client/.env`)

| Variable | Descripción |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Mismo Client ID OAuth de Google usado en backend |

Obtén tu clave de Gemini gratis en: https://aistudio.google.com/apikey

## Deploy en Vercel

1. Sube el repo a GitHub
2. Importa el proyecto en [vercel.com](https://vercel.com)
3. En **Root Directory** selecciona `localai` si tu repo tiene carpeta padre
4. En **Environment Variables** agrega `GEMINI_API_KEY` con tu clave
5. Deploy ✅

## Estado actual de Fase 1 (local)

Implementado en local:

1. Login con Google
2. Persistencia de usuarios y posts en SQLite (`server/data/localai.db`)
3. Guardado automático de posts generados para usuarios autenticados
4. Dashboard con historial por usuario
5. Cambio de estado por post (`borrador`, `aprobado`, `publicado`)

API nueva de Fase 1:

- `POST /api/auth/google`
- `GET /api/me`
- `POST /api/posts`
- `GET /api/posts`
- `PATCH /api/posts/:id/status`

## Roadmap de evolución (trabajo local)

Este es el plan para subir el nivel de LocalAI paso a paso, validando cada fase en local antes de subir cambios a GitHub.

### Objetivo

Pasar de un generador de posts a una plataforma de automatización de marketing con:

- autenticación de usuarios
- dashboard con historial y métricas
- programación de publicaciones
- conexión con APIs reales de redes sociales

### Fase 1: Base de producto (MVP Pro)

Estado: **completa**

Alcance:

1. Login con Google
2. Persistencia de usuarios
3. Guardado de posts generados
4. Estados de contenido: borrador, aprobado, publicado
5. Dashboard inicial por usuario

Entregables:

- autenticación funcional en frontend
- endpoints backend para CRUD de posts
- vista de historial con filtros por red social y estado

### Fase 2: Automatizacion real de publicacion

Estado: **en progreso**

Alcance:

1. Conexión de cuenta Meta (Facebook/Instagram)
2. Publicación manual desde dashboard
3. Programación de publicaciones por fecha/hora
4. Cola de tareas con reintentos

Entregables:

- módulo de cuentas conectadas
- servicio de scheduler para publicaciones
- registro de errores por intento de publicación

Avance actual implementado en local:

1. Cuentas conectadas simuladas para Instagram y Facebook
2. Publicacion manual desde el dashboard
3. Programacion por fecha/hora desde cada post
4. Cola local con reintentos automaticos
5. Bitacora de intentos y errores recientes

Notas de esta iteracion:

- La integracion con Meta Graph API aun no esta conectada; la publicacion es simulada localmente.
- Para forzar un error y probar reintentos, incluye `#failpublish` o `#errorpublish` dentro del contenido del post.
- WhatsApp sigue fuera de la automatizacion en esta fase.

### Fase 3: Métricas y optimización

Estado: **pendiente**

Alcance:

1. Métricas por post (clics, alcance estimado, CTR)
2. UTM builder automático
3. Reporte semanal de rendimiento
4. Recomendaciones por IA para mejorar copy

Entregables:

- panel de analytics básico
- exportación CSV de resultados
- sugerencias automáticas para siguientes posts

### Fase 4: Diferenciales competitivos

Estado: **pendiente**

Alcance:

1. Brand Voice (entrenar tono por negocio)
2. A/B testing de copys
3. Campaña de 7 días automática
4. Recomendador de mejor horario de publicación

Entregables:

- asistente de campaña completa
- comparador de variaciones A/B
- recomendaciones inteligentes por red social

## Backlog técnico priorizado

1. Elegir proveedor de Auth y DB (Supabase o Firebase)
2. Diseñar modelo de datos (usuarios, posts, publicaciones, métricas)
3. Crear endpoints REST para dashboard
4. Agregar tabla de auditoría para publicaciones
5. Integrar Meta Graph API
6. Implementar jobs programados

## Definición de "listo" por fase

Una fase se considera completa cuando cumple:

1. Feature funcional en local
2. Flujo probado de punta a punta
3. Manejo de errores básico
4. README actualizado con decisiones tomadas
5. Lista de pendientes de la siguiente fase

## Regla de trabajo para este proyecto

Por ahora, todo cambio se implementa y valida en local. No se hace push hasta cerrar una fase completa o una entrega acordada.

## Lo que falta para cerrar la app

Checklist de cierre inmediato:

- [ ] Ejecutar prueba manual de punta a punta en local
- [ ] Verificar login con Google
- [ ] Verificar generacion de posts
- [ ] Verificar guardado en historial
- [ ] Verificar cambio de estado de posts
- [ ] Verificar conexion de cuenta
- [ ] Verificar publicacion inmediata
- [ ] Verificar programacion de publicacion
- [ ] Verificar actividad y reintentos
- [ ] Integrar Meta Graph API real (hoy la publicacion es simulada localmente)
- [ ] Rotar `GEMINI_API_KEY`
- [ ] Rotar `GOOGLE_CLIENT_ID` y credenciales asociadas
- [ ] Definir `APP_JWT_SECRET` final seguro
- [ ] Validar CORS con origenes permitidos
- [ ] Validar variables de entorno en Vercel
- [ ] Validar flujo de auth en dominio de produccion
- [ ] QA visual final en desktop y mobile (formulario, resultados, dashboard)

Criterio de "release listo":

1. Build pasa sin errores
2. Flujo funcional completo validado
3. Manejo de errores basicos comprobado
4. Secretos rotados y configuracion de produccion aplicada
5. Checklist anterior completado al 100%

## Proyecto presentado en BUILD IA UIO 🇪🇨