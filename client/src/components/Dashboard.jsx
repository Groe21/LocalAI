import { useMemo, useState } from "react";

const ESTADOS = ["todos", "borrador", "aprobado", "publicado"];
const REDES = ["todas", "Instagram", "WhatsApp", "Facebook"];

const ESTADO_BADGE = {
  borrador: "badge-borrador",
  aprobado: "badge-aprobado",
  publicado: "badge-publicado",
};

const RED_ICON = {
  Instagram: "📸",
  WhatsApp: "💬",
  Facebook: "👍",
};

function formatFecha(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function MetricaCard({ label, value, accent }) {
  return (
    <div className={`metrica-card ${accent || ""}`}>
      <span className="metrica-value">{value}</span>
      <span className="metrica-label">{label}</span>
    </div>
  );
}

export default function Dashboard({
  posts,
  metricsSummary,
  metricsLoading,
  postInsights,
  updatingId,
  onChangeStatus,
  onUpdatePostResult,
  onPostInteraction,
  onSimulateMetrics,
  onGenerateUtm,
  onRecommendation,
  onLoadUtm,
  onChangeMetricsRange,
  coachMessages,
  coachLoading,
  onSendCoachMessage,
}) {
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroRed, setFiltroRed] = useState("todas");
  const [utmCopiadoPostId, setUtmCopiadoPostId] = useState(null);
  const [coachInput, setCoachInput] = useState("");
  const [coachNegocio, setCoachNegocio] = useState("");
  const [coachRed, setCoachRed] = useState("Instagram");
  const [resultDrafts, setResultDrafts] = useState({});

  const resumenMetricas = metricsSummary?.summary || {
    impressions: 0,
    clicks: 0,
    ctr: 0,
    posts_with_metrics: 0,
  };

  const metricas = useMemo(() => {
    if (!posts?.length) return null;
    const total = posts.length;
    const publicados = posts.filter((p) => p.estado === "publicado").length;
    const aprobados = posts.filter((p) => p.estado === "aprobado").length;
    const seleccionados = posts.filter((p) => Number(p.is_selected) === 1).length;
    const copiados = posts.reduce((acc, p) => acc + Number(p.copied_count || 0), 0);
    return { total, publicados, aprobados, seleccionados, copiados };
  }, [posts]);

  const postsFiltrados = useMemo(() => {
    if (!posts?.length) return [];
    return posts.filter((p) => {
      const matchEstado = filtroEstado === "todos" || p.estado === filtroEstado;
      const matchRed = filtroRed === "todas" || p.red_social === filtroRed;
      return matchEstado && matchRed;
    });
  }, [posts, filtroEstado, filtroRed]);

  const exportarMetricasCsv = () => {
    const trend = metricsSummary?.trend || [];
    if (!trend.length) return;

    const header = ["date_key", "impressions", "clicks", "ctr"];
    const rows = trend.map((day) => [
      day.date_key,
      day.impressions ?? 0,
      day.clicks ?? 0,
      day.ctr ?? 0,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `localai-metricas-${metricsSummary?.range || "7d"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copiarUtm = async (postId, url) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setUtmCopiadoPostId(postId);
      window.setTimeout(() => setUtmCopiadoPostId(null), 1800);
      await onPostInteraction(postId, "copied");
    } catch {
      setUtmCopiadoPostId(null);
    }
  };

  const enviarCoach = async () => {
    const text = coachInput.trim();
    if (!text) return;
    const ultimoPost = posts?.[0]?.contenido || "";
    await onSendCoachMessage({
      message: text,
      negocio: coachNegocio,
      redSocial: coachRed,
      ultimoPost,
    });
    setCoachInput("");
  };

  return (
    <section className="dashboard">
      <div className="dashboard-head">
        <h2>Dashboard de gestion</h2>
        <span>{posts?.length || 0} posts guardados</span>
      </div>

      {metricas && (
        <div className="metricas-grid">
          <MetricaCard label="Total" value={metricas.total} />
          <MetricaCard label="Publicados" value={metricas.publicados} accent="accent-publicado" />
          <MetricaCard label="Aprobados" value={metricas.aprobados} accent="accent-aprobado" />
          <MetricaCard label="Elegidos" value={metricas.seleccionados} />
          <MetricaCard label="Copias" value={metricas.copiados} />
        </div>
      )}

      <section className="automation-shell">
        <div className="automation-head">
          <h3>Analitica de rendimiento</h3>
          <p>Simula metricas, genera UTM y recibe recomendaciones para mejorar cada post.</p>
        </div>

        <div className="job-summary-grid">
          <MetricaCard label="Impresiones" value={resumenMetricas.impressions || 0} />
          <MetricaCard label="Clics" value={resumenMetricas.clicks || 0} />
          <MetricaCard label="CTR %" value={resumenMetricas.ctr || 0} accent="accent-aprobado" />
          <MetricaCard label="Posts medidos" value={resumenMetricas.posts_with_metrics || 0} />
        </div>

        <div className="automation-card activity-card">
          <div className="section-head">
            <h4>Tendencia reciente ({metricsSummary?.range || "7d"})</h4>
            <div className="publish-row">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => onChangeMetricsRange("7d")}
                disabled={metricsLoading || (metricsSummary?.range || "7d") === "7d"}
              >
                7d
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => onChangeMetricsRange("30d")}
                disabled={metricsLoading || (metricsSummary?.range || "7d") === "30d"}
              >
                30d
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={exportarMetricasCsv}
                disabled={!metricsSummary?.trend?.length}
              >
                Exportar CSV
              </button>
            </div>
          </div>
          {!metricsSummary?.trend?.length ? (
            <p className="dashboard-empty">Aun no hay datos. Usa "Simular metricas" en un post.</p>
          ) : (
            <div className="attempt-list">
              {metricsSummary.trend.slice(-7).map((day) => (
                <div className="attempt-row" key={day.date_key}>
                  <span>{day.date_key}</span>
                  <small>Imp: {day.impressions}</small>
                  <small>Clicks: {day.clicks}</small>
                  <small>CTR: {day.ctr}%</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="automation-shell">
        <div className="automation-head">
          <h3>Coach IA (mini chat)</h3>
          <p>Conversacion simple para mejorar estrategia, recrear copy o crear un nuevo post.</p>
        </div>
        <div className="automation-card activity-card">
          <div className="publish-row">
            <input
              value={coachNegocio}
              onChange={(e) => setCoachNegocio(e.target.value)}
              placeholder="Tu negocio (opcional)"
              maxLength={80}
            />
            <select value={coachRed} onChange={(e) => setCoachRed(e.target.value)}>
              {REDES.slice(1).map((red) => (
                <option key={red} value={red}>
                  {red}
                </option>
              ))}
            </select>
          </div>
          <div className="attempt-list" style={{ maxHeight: "220px", overflowY: "auto" }}>
            {(coachMessages || []).map((msg, idx) => (
              <div className="attempt-row" key={`${msg.role}-${idx}`}>
                <strong>{msg.role === "assistant" ? "Coach" : "Tu"}</strong>
                <small style={{ whiteSpace: "pre-wrap" }}>{msg.content}</small>
              </div>
            ))}
          </div>
          <div className="publish-row">
            <input
              value={coachInput}
              onChange={(e) => setCoachInput(e.target.value)}
              placeholder="Ej: quiero mejorar el post de ayer"
              maxLength={280}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  enviarCoach();
                }
              }}
            />
            <button type="button" className="btn-primary" onClick={enviarCoach} disabled={coachLoading || !coachInput.trim()}>
              {coachLoading ? "Pensando..." : "Enviar"}
            </button>
          </div>
        </div>
      </section>

      <div className="filtros-row">
        <div className="filtro-group">
          <span>Estado</span>
          {ESTADOS.map((e) => (
            <button
              key={e}
              type="button"
              className={`filtro-chip ${filtroEstado === e ? "active" : ""}`}
              onClick={() => setFiltroEstado(e)}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="filtro-group">
          <span>Red</span>
          {REDES.map((r) => (
            <button
              key={r}
              type="button"
              className={`filtro-chip ${filtroRed === r ? "active" : ""}`}
              onClick={() => setFiltroRed(r)}
            >
              {r === "todas" ? r : `${RED_ICON[r]} ${r}`}
            </button>
          ))}
        </div>
      </div>

      {postsFiltrados.length === 0 ? (
        <p className="dashboard-empty">No hay posts con ese filtro.</p>
      ) : (
        <div className="dashboard-list">
          {postsFiltrados.map((post) => (
            <article className="dashboard-card dashboard-card-post" key={post.id}>
              <header>
                <div className="card-meta">
                  <strong>
                    {RED_ICON[post.red_social]} {post.red_social}
                  </strong>
                  <small>{formatFecha(post.created_at)}</small>
                </div>
                <div className="card-actions">
                  <span className={`badge ${ESTADO_BADGE[post.estado]}`}>
                    {post.estado}
                  </span>
                  <label>
                    <select
                      value={post.estado}
                      onChange={(e) => onChangeStatus(post.id, e.target.value)}
                      disabled={updatingId === post.id}
                      aria-label="Cambiar estado"
                    >
                      {ESTADOS.slice(1).map((estado) => (
                        <option value={estado} key={estado}>
                          {estado}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </header>

              <p>{post.contenido}</p>

              <div className="publish-row">
                <button type="button" className="btn-secondary" onClick={() => onPostInteraction(post.id, "selected")}>
                  {Number(post.is_selected) === 1 ? "Seleccionado" : "Marcar elegido"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => onPostInteraction(post.id, "copied")}>
                  Registrar copia
                </button>
              </div>

              <small>
                Elegido: {Number(post.is_selected) === 1 ? `si (${formatFecha(post.selected_at)})` : "no"} · Copias: {post.copied_count || 0}
              </small>

                <div className="publish-box">
                  <p className="publish-hint">Resultado real del post (para mejorar IA)</p>
                  <div className="publish-row">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        onUpdatePostResult({
                          postId: post.id,
                          resultStatus: "dio_resultados",
                          resultNotes: resultDrafts[post.id] || post.result_notes || "",
                        })
                      }
                    >
                      Dio resultados
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() =>
                        onUpdatePostResult({
                          postId: post.id,
                          resultStatus: "no_dio_resultados",
                          resultNotes: resultDrafts[post.id] || post.result_notes || "",
                        })
                      }
                    >
                      No dio resultados
                    </button>
                  </div>
                  <input
                    value={resultDrafts[post.id] ?? post.result_notes ?? ""}
                    onChange={(e) =>
                      setResultDrafts((prev) => ({
                        ...prev,
                        [post.id]: e.target.value,
                      }))
                    }
                    placeholder="Nota breve del resultado (opcional)"
                    maxLength={180}
                  />
                  <small>
                    Estado resultado: {post.result_status || "sin_dato"}
                    {post.result_updated_at ? ` · actualizado ${formatFecha(post.result_updated_at)}` : ""}
                  </small>
                </div>

              <div className="publish-box">
                <p className="publish-hint">Analitica y optimizacion de este post</p>
                <div className="publish-row">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onSimulateMetrics(post.id, 7)}
                    disabled={Boolean(postInsights?.[post.id]?.loadingMetrics)}
                  >
                    {postInsights?.[post.id]?.loadingMetrics ? "Simulando..." : "Simular 7d"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onSimulateMetrics(post.id, 30)}
                    disabled={Boolean(postInsights?.[post.id]?.loadingMetrics)}
                  >
                    Simular 30d
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onGenerateUtm(post.id)}
                    disabled={Boolean(postInsights?.[post.id]?.loadingUtm)}
                  >
                    {postInsights?.[post.id]?.loadingUtm ? "Generando..." : "Generar UTM"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onLoadUtm(post.id)}
                    disabled={Boolean(postInsights?.[post.id]?.loadingUtm)}
                  >
                    Ver UTM
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onRecommendation(post.id)}
                    disabled={Boolean(postInsights?.[post.id]?.loadingRecommendation)}
                  >
                    {postInsights?.[post.id]?.loadingRecommendation ? "Analizando..." : "Sugerencia IA"}
                  </button>
                </div>

                {postInsights?.[post.id]?.metricsAggregate && (
                  <small>
                    Impresiones: {postInsights[post.id].metricsAggregate.impressions} · Clicks: {postInsights[post.id].metricsAggregate.clicks} · CTR: {postInsights[post.id].metricsAggregate.ctr}%
                  </small>
                )}

                {postInsights?.[post.id]?.utm?.url_final && (
                  <div className="publish-row">
                    <small>
                      UTM: <a href={postInsights[post.id].utm.url_final} target="_blank" rel="noreferrer">{postInsights[post.id].utm.url_final}</a>
                    </small>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => copiarUtm(post.id, postInsights[post.id].utm.url_final)}
                    >
                      {utmCopiadoPostId === post.id ? "Copiado" : "Copiar UTM"}
                    </button>
                  </div>
                )}

                {postInsights?.[post.id]?.recommendation && (
                  <div className="job-error" style={{ whiteSpace: "pre-wrap" }}>
                    {postInsights[post.id].recommendation}
                  </div>
                )}
              </div>

              <footer>
                <small>Origen: {post.origen}</small>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

