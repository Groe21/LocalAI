import { useEffect, useMemo, useState } from "react";
import Form from "./components/Form";
import Results from "./components/Results";
import AuthPanel from "./components/AuthPanel";
import Dashboard from "./components/Dashboard";

const TOKEN_KEY = "localai_token";

function getAuthHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseApiResponse(res) {
  const rawText = await res.text();

  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return {
      error: "Respuesta invalida del servidor. Verifica backend y variables de entorno.",
    };
  }
}

export default function App() {
  const googleAuthReady = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [posts, setPosts] = useState([]);
  const [historyPosts, setHistoryPosts] = useState([]);
  const [metricsSummary, setMetricsSummary] = useState({
    range: "7d",
    summary: {
      impressions: 0,
      clicks: 0,
      ctr: 0,
      posts_with_metrics: 0,
    },
    trend: [],
  });
  const [postInsights, setPostInsights] = useState({});
  const [coachMessages, setCoachMessages] = useState([
    {
      role: "assistant",
      content:
        "Hola, soy tu coach IA. Te ayudo a mejorar posts, recrear versiones por red social o crear uno nuevo segun resultados.",
    },
  ]);
  const [coachLoading, setCoachLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastGenerationMeta, setLastGenerationMeta] = useState({
    redSocial: "Instagram",
    origen: "gemini",
  });
  const [updatingId, setUpdatingId] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(null);

  const totalPublicados = useMemo(
    () => historyPosts.filter((p) => p.estado === "publicado").length,
    [historyPosts]
  );

  const cargarHistorial = async (currentToken) => {
    if (!currentToken) return;
    const res = await fetch("/api/posts", {
      headers: {
        ...getAuthHeader(currentToken),
      },
    });

    if (!res.ok) return;
    const data = await parseApiResponse(res);
    setHistoryPosts(data.posts || []);
  };

  const cargarMetricasResumen = async (currentToken, range = "7d") => {
    if (!currentToken) return;
    setMetricsLoading(true);
    try {
      const res = await fetch(`/api/metrics/summary?range=${encodeURIComponent(range)}`, {
        headers: {
          ...getAuthHeader(currentToken),
        },
      });

      if (!res.ok) return;
      const data = await parseApiResponse(res);
      setMetricsSummary({
        range: data.range || range,
        summary: data.summary || {
          impressions: 0,
          clicks: 0,
          ctr: 0,
          posts_with_metrics: 0,
        },
        trend: data.trend || [],
      });
    } finally {
      setMetricsLoading(false);
    }
  };

  const cargarDashboard = async (currentToken) => {
    await Promise.all([
      cargarHistorial(currentToken),
      cargarMetricasResumen(currentToken, metricsSummary.range || "7d"),
    ]);
  };

  useEffect(() => {
    const checkSession = async () => {
      if (!token) {
        setMetricsSummary({
          range: "7d",
          summary: {
            impressions: 0,
            clicks: 0,
            ctr: 0,
            posts_with_metrics: 0,
          },
          trend: [],
        });
        setPostInsights({});
        setCoachMessages((prev) =>
          prev.length
            ? prev
            : [
                {
                  role: "assistant",
                  content:
                    "Hola, soy tu coach IA. Te ayudo a mejorar posts, recrear versiones por red social o crear uno nuevo segun resultados.",
                },
              ]
        );
        setAuthLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/me", {
          headers: {
            ...getAuthHeader(token),
          },
        });

        if (!res.ok) {
          localStorage.removeItem(TOKEN_KEY);
          setToken("");
          setUser(null);
          setHistoryPosts([]);
          setPostInsights({});
          return;
        }

        const data = await parseApiResponse(res);
        setUser(data.user);
        await cargarDashboard(token);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
        setHistoryPosts([]);
        setPostInsights({});
      } finally {
        setAuthLoading(false);
      }
    };

    checkSession();
  }, [token]);

  useEffect(() => {
    if (!token || !user) return undefined;

    const intervalId = window.setInterval(() => {
      cargarHistorial(token).catch(() => {});
      cargarMetricasResumen(token, metricsSummary.range || "7d").catch(() => {});
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [token, user, metricsSummary.range]);

  const handleGoogleSuccess = async (credentialResponse) => {
    setError("");
    try {
      const idToken = credentialResponse?.credential;
      if (!idToken) {
        throw new Error("Google no devolvio credencial valida");
      }

      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const data = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "No se pudo iniciar sesion");
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      await cargarDashboard(data.token);
    } catch (err) {
      setError(err.message || "Error autenticando con Google");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setHistoryPosts([]);
    setPostInsights({});
    setMetricsSummary({
      range: "7d",
      summary: {
        impressions: 0,
        clicks: 0,
        ctr: 0,
        posts_with_metrics: 0,
      },
      trend: [],
    });
    setCoachMessages([
      {
        role: "assistant",
        content:
          "Sesion cerrada. Cuando vuelvas a iniciar, seguimos optimizando tus publicaciones.",
      },
    ]);
  };

  const patchInsight = (postId, patch) => {
    setPostInsights((prev) => ({
      ...prev,
      [postId]: {
        ...(prev[postId] || {}),
        ...patch,
      },
    }));
  };

  const handleSimulateMetrics = async (postId, days = 7) => {
    if (!token) return;
    patchInsight(postId, { loadingMetrics: true });
    setError("");

    try {
      const res = await fetch(`/api/posts/${postId}/metrics/simulate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(token),
        },
        body: JSON.stringify({ days }),
      });

      const data = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "No se pudieron simular metricas");
      }

      patchInsight(postId, {
        metrics: data.metrics || [],
        metricsAggregate: data.aggregate || null,
      });
      await cargarMetricasResumen(token, metricsSummary.range || "7d");
    } catch (err) {
      setError(err.message || "Error simulando metricas");
    } finally {
      patchInsight(postId, { loadingMetrics: false });
    }
  };

  const handleGenerateUtm = async (postId) => {
    if (!token) return;
    patchInsight(postId, { loadingUtm: true });
    setError("");

    try {
      const res = await fetch(`/api/posts/${postId}/utm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(token),
        },
      });

      const data = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "No se pudo generar UTM");
      }

      patchInsight(postId, { utm: data.utm || null });
    } catch (err) {
      setError(err.message || "Error generando UTM");
    } finally {
      patchInsight(postId, { loadingUtm: false });
    }
  };

  const handleLoadUtm = async (postId) => {
    if (!token) return;
    patchInsight(postId, { loadingUtm: true });
    setError("");

    try {
      const res = await fetch(`/api/posts/${postId}/utm`, {
        headers: {
          ...getAuthHeader(token),
        },
      });

      const data = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "No se pudo leer UTM");
      }

      patchInsight(postId, { utm: data.utm || null });
    } catch (err) {
      setError(err.message || "Error leyendo UTM");
    } finally {
      patchInsight(postId, { loadingUtm: false });
    }
  };

  const handleChangeMetricsRange = async (range) => {
    if (!token) return;
    await cargarMetricasResumen(token, range);
  };

  const handleRecommendation = async (postId) => {
    if (!token) return;
    patchInsight(postId, { loadingRecommendation: true });
    setError("");

    try {
      const res = await fetch(`/api/posts/${postId}/recommendation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(token),
        },
      });

      const data = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "No se pudo generar recomendacion");
      }

      patchInsight(postId, {
        recommendation: data.recommendation || "",
        metricsAggregate: data.metrics || (postInsights[postId] || {}).metricsAggregate || null,
      });
    } catch (err) {
      setError(err.message || "Error generando recomendacion");
    } finally {
      patchInsight(postId, { loadingRecommendation: false });
    }
  };

  const handlePostInteraction = async (postId, action) => {
    if (!token) return;

    try {
      const res = await fetch(`/api/posts/${postId}/interaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(token),
        },
        body: JSON.stringify({ action }),
      });

      const data = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "No se pudo registrar la accion");
      }

      setHistoryPosts((prev) =>
        prev.map((post) => (post.id === data.post.id ? data.post : post))
      );
    } catch (err) {
      setError(err.message || "No se pudo registrar la accion");
    }
  };

  const handleSendCoachMessage = async ({ message, negocio, redSocial, ultimoPost }) => {
    if (!token) return;

    const msg = String(message || "").trim();
    if (!msg) return;

    setCoachMessages((prev) => [...prev, { role: "user", content: msg }]);
    setCoachLoading(true);

    try {
      const res = await fetch("/api/chat/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(token),
        },
        body: JSON.stringify({ message: msg, negocio, redSocial, ultimoPost }),
      });

      const data = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "No se pudo responder en el coach IA");
      }

      setCoachMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data.answer ||
            "Perfecto. Si quieres, tomamos tu ultimo post y te propongo una version mejorada.",
        },
      ]);
    } catch (err) {
      setError(err.message || "Error en coach IA");
      setCoachMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "No pude responder ahora mismo. Intenta de nuevo y te ayudo con una recomendacion concreta.",
        },
      ]);
    } finally {
      setCoachLoading(false);
    }
  };

  const handleGenerar = async ({ negocio, redSocial }) => {
    setCargando(true);
    setSaving(false);
    setError("");
    setPosts([]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocio, redSocial }),
      });

      const data = await parseApiResponse(res);

      if (!res.ok) {
        throw new Error(data.error || "Error del servidor");
      }

      const nuevosPosts = data.posts || [];
      setPosts(nuevosPosts);
      setLastGenerationMeta({
        redSocial,
        origen: data.origen || "gemini",
      });

      // En el nuevo flujo solo se guarda en historial cuando el usuario copia un post.
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setCargando(false);
    }
  };

  const handleCopyGeneratedPost = async (postText) => {
    if (!user || !token) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(token),
        },
        body: JSON.stringify({
          posts: [postText],
          redSocial: lastGenerationMeta.redSocial,
          origen: lastGenerationMeta.origen,
          selectedOnSave: true,
          copiedOnSave: true,
        }),
      });

      const data = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "No se pudo guardar el post copiado");
      }

      if (data.posts?.length) {
        const saved = data.posts[0];
        setHistoryPosts((prev) => [saved, ...prev.filter((p) => p.id !== saved.id)]);
      } else {
        await cargarHistorial(token);
      }
    } catch (err) {
      setError(err.message || "Error guardando post copiado");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePostResult = async ({ postId, resultStatus, resultNotes }) => {
    if (!token) return;

    try {
      const res = await fetch(`/api/posts/${postId}/result`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(token),
        },
        body: JSON.stringify({ resultStatus, resultNotes }),
      });

      const data = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el resultado");
      }

      setHistoryPosts((prev) =>
        prev.map((post) => (post.id === data.post.id ? data.post : post))
      );
    } catch (err) {
      setError(err.message || "Error actualizando resultado del post");
    }
  };

  const handleChangeStatus = async (postId, estado) => {
    if (!token) return;
    setUpdatingId(postId);

    try {
      const res = await fetch(`/api/posts/${postId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(token),
        },
        body: JSON.stringify({ estado }),
      });

      if (!res.ok) {
        const data = await parseApiResponse(res);
        throw new Error(data.error || "No se pudo actualizar el estado");
      }

      const data = await parseApiResponse(res);
      setHistoryPosts((prev) =>
        prev.map((post) => (post.id === data.post.id ? data.post : post))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="app">
      <div className="ambient-glow ambient-glow-a" aria-hidden="true" />
      <div className="ambient-glow ambient-glow-b" aria-hidden="true" />
      <div className="tricolor-bar" />
      <header className="header">
        <h1>
          <span className="logo-icon">⚡</span> LocalAI
        </h1>
        <div className="header-badge">🇪🇨 Hecho en Ecuador</div>
        <p>Copys listos para publicar en redes sociales en minutos</p>
        <div className="header-meta" aria-hidden="true">
          <span>3 variantes</span>
          <span>voz local LATAM</span>
          <span>listo para copiar</span>
          <span>{totalPublicados} publicados</span>
        </div>
      </header>

      <main className="main">
        <AuthPanel
          user={user}
          authLoading={authLoading}
          googleAuthReady={googleAuthReady}
          onGoogleSuccess={handleGoogleSuccess}
          onLogout={handleLogout}
        />

        <Form onGenerar={handleGenerar} cargando={cargando} />

        {cargando && (
          <div className="loader" role="status" aria-live="polite">
            <div className="spinner" />
            <p>Generando tus posts con IA...</p>
          </div>
        )}

        {saving && (
          <p className="save-msg" role="status">
            Guardando posts en tu dashboard...
          </p>
        )}

        {error && (
          <p className="error-msg" role="alert">
            ⚠️ {error}
          </p>
        )}

        {!cargando && !error && posts.length === 0 && (
          <section className="empty-state">
            <h2>Listo para crear tu contenido</h2>
            <p>
              Describe tu negocio con ubicacion, producto estrella, promociones
              y estilo de comunicacion para obtener mejores resultados.
            </p>
          </section>
        )}

        <Results posts={posts} onCopyPost={handleCopyGeneratedPost} />

        {user && (
          <Dashboard
            posts={historyPosts}
            metricsSummary={metricsSummary}
            metricsLoading={metricsLoading}
            postInsights={postInsights}
            updatingId={updatingId}
            onChangeStatus={handleChangeStatus}
              onUpdatePostResult={handleUpdatePostResult}
            onPostInteraction={handlePostInteraction}
            onSimulateMetrics={handleSimulateMetrics}
            onGenerateUtm={handleGenerateUtm}
            onRecommendation={handleRecommendation}
            onLoadUtm={handleLoadUtm}
            onChangeMetricsRange={handleChangeMetricsRange}
            coachMessages={coachMessages}
            coachLoading={coachLoading}
            onSendCoachMessage={handleSendCoachMessage}
          />
        )}
      </main>

      <footer className="footer">
        <p>
          Hecho con 💛 en <span className="ec-flag">🇪🇨</span> Ecuador.
          Marketing digital accesible para negocios locales.
        </p>
      </footer>
    </div>
  );
}
