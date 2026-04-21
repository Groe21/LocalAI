import CopyButton from "./CopyButton";
import { useState } from "react";

export default function Results({ posts }) {
  const [copiadoTodo, setCopiadoTodo] = useState(false);

  if (!posts || posts.length === 0) return null;

  const copiarTodo = async () => {
    const textoCompleto = posts
      .map((post, index) => `POST ${index + 1}\n${post}`)
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(textoCompleto);
      setCopiadoTodo(true);
      setTimeout(() => setCopiadoTodo(false), 2000);
    } catch {
      setCopiadoTodo(false);
    }
  };

  return (
    <section className="results">
      <div className="results-head">
        <h2>Tus posts generados 🎉</h2>
        <button className="copy-all-btn" type="button" onClick={copiarTodo}>
          {copiadoTodo ? "✅ Copiado todo" : "📋 Copiar los 3"}
        </button>
      </div>
      <div className="cards">
        {posts.map((post, i) => (
          <article className="card" key={i}>
            <div className="card-header">
              <span className="card-number">Post {i + 1}</span>
              <CopyButton texto={post} />
            </div>
            <p className="card-body">{post}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
