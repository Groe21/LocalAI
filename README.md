# 🇪🇨 LocalAI — Marketing con IA para negocios locales

App web que genera posts listos para **Instagram**, **WhatsApp** y **Facebook** usando **Gemini AI**, pensada para dueños de negocios pequeños en Latinoamérica.

## ¿Cómo funciona?

1. Describe tu negocio con ciudad, producto y propuesta de valor
2. Elige la red social
3. La IA genera 3 variantes de post con emojis y hashtags
4. Al copiar 1 post, solo ese se guarda en tu historial
5. Luego registras si dio o no resultados, y la IA mejora la siguiente propuesta

## Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express + Vercel Function para generacion
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

Si `GEMINI_API_KEY` es invalida o Gemini no esta disponible, la app usa fallback local de copys para no bloquear el flujo de trabajo.

## Deploy en Vercel

1. Sube el repo a GitHub
2. Importa el proyecto en [vercel.com](https://vercel.com)
3. En **Root Directory** selecciona `localai` si tu repo tiene carpeta padre
4. En **Environment Variables** agrega:
	- `GEMINI_API_KEY`
	- `GOOGLE_CLIENT_ID`
	- `APP_JWT_SECRET`
	- `VITE_GOOGLE_CLIENT_ID`
5. Deploy ✅

> Nota importante: la ruta serverless en Vercel implementada actualmente es `POST /api/generate` (`api/generate.js`).
> Los endpoints avanzados de auth/dashboard (`/api/auth/google`, `/api/posts`, `/api/metrics/summary`) corren en `server/index.js` para pruebas locales.

## Estado del proyecto

- Fase 1: **completa**
- Fase 2: **completa en local (sin conexion a redes externas)**
- Fase 3: **completa en local (pendiente validacion final con credenciales reales)**
- Fase 4: **pendiente**

## API disponible hoy

Autenticacion e historial:

- `POST /api/auth/google`
- `GET /api/me`
- `POST /api/posts`
- `GET /api/posts`
- `PATCH /api/posts/:id/status`

Gestion de historial de publicaciones:

- `POST /api/posts/:id/interaction` (`selected` | `copied`)
- `PATCH /api/posts/:id/result` (`sin_dato` | `dio_resultados` | `no_dio_resultados`)

Metricas, UTM y optimizacion (Fase 3):

- `POST /api/posts/:id/metrics/simulate`
- `GET /api/metrics/summary?range=7d|30d`
- `POST /api/posts/:id/utm`
- `GET /api/posts/:id/utm`
- `POST /api/posts/:id/recommendation`
- `POST /api/chat/coach`

## Fase 3: Metricas y optimizacion

Objetivo: pasar de historial a analitica accionable por usuario y por red social.

### Alcance funcional de Fase 3

1. Metricas por post: impresiones estimadas, clics estimados y CTR estimado
2. UTM builder automatico por publicacion
3. Vista de resumen semanal en dashboard
4. Recomendaciones IA para mejorar el copy del siguiente post

### Avance implementado en Fase 3

1. Base de datos:
	- tabla `post_metrics` creada y operativa
	- tabla `post_utm` creada y operativa
2. Backend (`server/index.js` y `server/db.js`):
	- simulacion de metricas por post y agregados por rango
	- generacion y consulta de UTM por post
	- recomendacion de mejora de copy usando Gemini
3. Frontend (`client/src/components/Dashboard.jsx`):
	- cards KPI de impresiones, clics, CTR, elegidos y copias
	- tendencia reciente por dias + exportacion CSV
	- acciones por post: elegido, copia, resultado (dio/no dio), simular metricas, generar UTM y sugerencia IA
	- mini chat IA para gestionar mejoras y nuevos posts

### Lo pendiente para cerrar Fase 3 al 100%

1. Prueba punta a punta documentada con evidencia de resultados
2. Persistir y rehidratar insights por post al recargar sesion (opcional UX)

### Criterio de cierre de Fase 3

1. KPIs visibles por usuario en dashboard
2. UTM generado y copiable por post
3. Resumen semanal funcionando en local
4. Recomendacion IA visible para al menos un post
5. Prueba de punta a punta documentada en este README

## Fase 4 (siguiente despues de cerrar Fase 3)

1. Brand Voice por negocio
2. A/B testing de copys
3. Campana automatica de 7 dias
4. Recomendador de mejor horario por red

## Lo que falta para cerrar la app

Checklist de cierre inmediato:

- [ ] Ejecutar prueba manual de punta a punta en local
- [ ] Verificar login con Google
- [ ] Verificar generacion de posts
- [ ] Verificar guardado en historial
- [ ] Verificar cambio de estado de posts
- [ ] Verificar marcado de post elegido y registro de copias
- [ ] Verificar registro de resultado real por post (dio/no dio + nota)
- [ ] Verificar mini chat IA con sugerencias de mejora
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

## Decision de producto actual

En esta etapa **no** conectamos APIs reales de redes sociales.

El producto se enfoca en:

1. Generar posts con IA
2. Guardar historial por usuario logueado
3. Gestionar posts elegidos y copiados
4. Medir rendimiento estimado (metricas simuladas + UTM)
5. Acompanamiento con mini chat IA para mejorar estrategia

## Proyecto presentado en BUILD IA UIO 🇪🇨