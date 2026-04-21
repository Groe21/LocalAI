import { useState } from "react";
import Form from "./components/Form";
import Results from "./components/Results";

export default function App() {
  const [posts, setPosts] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const handleGenerar = async ({ negocio, redSocial }) => {
    setCargando(true);
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

      setPosts(data.posts);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
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
        </div>
      </header>

      <main className="main">
        <Form onGenerar={handleGenerar} cargando={cargando} />

        {cargando && (
          <div className="loader" role="status" aria-live="polite">
            <div className="spinner" />
            <p>Generando tus posts con IA...</p>
          </div>
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
              Describe tu negocio con ubicación, producto estrella, promociones
              y estilo de comunicación para obtener mejores resultados.
            </p>
          </section>
        )}

        <Results posts={posts} />
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
