import { useEffect, useMemo, useState } from "react";
import Form from "./components/Form";
import Results from "./components/Results";
import AuthPanel from "./components/AuthPanel";
import Dashboard from "./components/Dashboard";

const TOKEN_KEY = "localai_token";

function getAuthHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function App() {
  const googleAuthReady = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [posts, setPosts] = useState([]);
  const [historyPosts, setHistoryPosts] = useState([]);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [publicationJobs, setPublicationJobs] = useState([]);
  const [publicationAttempts, setPublicationAttempts] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [connectingAccount, setConnectingAccount] = useState(false);
  const [publishingPostId, setPublishingPostId] = useState(null);
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
    const data = await res.json();
    setHistoryPosts(data.posts || []);
  };

  const cargarAutomatizaciones = async (currentToken) => {
    if (!currentToken) return;

    const [accountsRes, publicationsRes] = await Promise.all([
      fetch("/api/accounts", {
        headers: {
          ...getAuthHeader(currentToken),
        },
      }),
      fetch("/api/publications", {
        headers: {
          ...getAuthHeader(currentToken),
        },
      }),
    ]);

    if (accountsRes.ok) {
      const accountsData = await accountsRes.json();
      setConnectedAccounts(accountsData.accounts || []);
    }

    if (publicationsRes.ok) {
      const publicationsData = await publicationsRes.json();
      setPublicationJobs(publicationsData.jobs || []);
      setPublicationAttempts(publicationsData.attempts || []);
    }
  };

  const cargarDashboard = async (currentToken) => {
    await Promise.all([
      cargarHistorial(currentToken),
      cargarAutomatizaciones(currentToken),
    ]);
  };

  useEffect(() => {
    const checkSession = async () => {
      if (!token) {
        setConnectedAccounts([]);
        setPublicationJobs([]);
        setPublicationAttempts([]);
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
          setConnectedAccounts([]);
          setPublicationJobs([]);
          setPublicationAttempts([]);
          return;
        }

        const data = await res.json();
        setUser(data.user);
        await cargarDashboard(token);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
        setHistoryPosts([]);
        setConnectedAccounts([]);
        setPublicationJobs([]);
        setPublicationAttempts([]);
      } finally {
        setAuthLoading(false);
      }
    };

    checkSession();
  }, [token]);

  useEffect(() => {
    if (!token || !user) return undefined;

    const intervalId = window.setInterval(() => {
      cargarAutomatizaciones(token).catch(() => {});
      cargarHistorial(token).catch(() => {});
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [token, user]);

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

      const data = await res.json();
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
    setConnectedAccounts([]);
    setPublicationJobs([]);
    setPublicationAttempts([]);
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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error del servidor");
      }

      const nuevosPosts = data.posts || [];
      setPosts(nuevosPosts);

      if (user && token && nuevosPosts.length > 0) {
        setSaving(true);
        const saveRes = await fetch("/api/posts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(token),
          },
          body: JSON.stringify({
            posts: nuevosPosts,
            redSocial,
            origen: data.origen || "gemini",
          }),
        });

        if (saveRes.ok) {
          await cargarDashboard(token);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setCargando(false);
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
        const data = await res.json();
        throw new Error(data.error || "No se pudo actualizar el estado");
      }

      const data = await res.json();
      setHistoryPosts((prev) =>
        prev.map((post) => (post.id === data.post.id ? data.post : post))
      );
      await cargarAutomatizaciones(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConnectAccount = async ({ platform, accountName, accountIdentifier }) => {
    if (!token) return;
    setConnectingAccount(true);
    setError("");

    try {
      const normalizedIdentifier = (accountIdentifier || "").trim().toLowerCase();
      const isDuplicated = connectedAccounts.some(
        (account) =>
          account.platform === platform &&
          String(account.account_identifier || "").trim().toLowerCase() === normalizedIdentifier
      );

      if (normalizedIdentifier && isDuplicated) {
        throw new Error("Esa cuenta ya esta conectada");
      }

      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(token),
        },
        body: JSON.stringify({
          platform,
          accountName: (accountName || "").trim(),
          accountIdentifier: normalizedIdentifier || (accountName || "").trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo conectar la cuenta");
      }

      setConnectedAccounts((prev) => [data.account, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setConnectingAccount(false);
    }
  };

  const handleDisconnectAccount = async (accountId) => {
    if (!token) return;
    setError("");

    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeader(token),
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo desconectar la cuenta");
      }

      setConnectedAccounts((prev) => prev.filter((account) => account.id !== accountId));
      await cargarAutomatizaciones(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePublishPost = async ({ postId, connectedAccountId, scheduledFor }) => {
    if (!token) return;
    setPublishingPostId(postId);
    setError("");

    try {
      if (!connectedAccountId) {
        throw new Error("Selecciona una cuenta conectada");
      }

      if (scheduledFor) {
        const parsedDate = new Date(scheduledFor);
        if (Number.isNaN(parsedDate.getTime())) {
          throw new Error("Fecha de programacion invalida");
        }

        if (parsedDate.getTime() < Date.now()) {
          throw new Error("La fecha de programacion debe ser futura");
        }
      }

      const res = await fetch(`/api/posts/${postId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(token),
        },
        body: JSON.stringify({
          connectedAccountId,
          scheduledFor: scheduledFor || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo crear la publicacion");
      }

      await cargarDashboard(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishingPostId(null);
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

        <Results posts={posts} />

        {user && (
          <Dashboard
            posts={historyPosts}
            accounts={connectedAccounts}
            publicationJobs={publicationJobs}
            publicationAttempts={publicationAttempts}
            updatingId={updatingId}
            connectingAccount={connectingAccount}
            publishingPostId={publishingPostId}
            onChangeStatus={handleChangeStatus}
            onConnectAccount={handleConnectAccount}
            onDisconnectAccount={handleDisconnectAccount}
            onPublishPost={handlePublishPost}
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
