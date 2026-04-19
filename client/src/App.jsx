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
      <div className="tricolor-bar" />
      <header className="header">
        <h1>
          <span className="logo-icon">⚡</span> LocalAI
        </h1>
        <div className="header-badge">🇪🇨 Hecho en Ecuador</div>
        <p>Marketing con IA para negocios locales</p>
      </header>

      <main className="main">
        <Form onGenerar={handleGenerar} cargando={cargando} />

        {cargando && (
          <div className="loader">
            <div className="spinner" />
            <p>Generando tus posts con IA...</p>
          </div>
        )}

        {error && <p className="error-msg">⚠️ {error}</p>}

        <Results posts={posts} />
      </main>

      <footer className="footer">
        <p>
          Hecho con 💛 en <span className="ec-flag">🇪🇨</span> Ecuador — Democratizando el marketing digital en LATAM
        </p>
      </footer>
    </div>
  );
}
