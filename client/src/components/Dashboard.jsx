import { useMemo, useState } from "react";

const ESTADOS = ["todos", "borrador", "aprobado", "publicado"];
const REDES = ["todas", "Instagram", "WhatsApp", "Facebook"];
const META_REDES = ["Instagram", "Facebook"];

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

function PublicationBadge({ status }) {
  return <span className={`badge badge-job badge-job-${status}`}>{status}</span>;
}

export default function Dashboard({
  posts,
  accounts,
  publicationJobs,
  publicationAttempts,
  updatingId,
  connectingAccount,
  publishingPostId,
  onChangeStatus,
  onConnectAccount,
  onDisconnectAccount,
  onPublishPost,
}) {
  const [mostrarAvanzado, setMostrarAvanzado] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroRed, setFiltroRed] = useState("todas");
  const [platform, setPlatform] = useState("Instagram");
  const [accountName, setAccountName] = useState("");
  const [accountIdentifier, setAccountIdentifier] = useState("");
  const [programaciones, setProgramaciones] = useState({});
  const [cuentasSeleccionadas, setCuentasSeleccionadas] = useState({});

  const metricas = useMemo(() => {
    if (!posts?.length) return null;
    const total = posts.length;
    const publicados = posts.filter((p) => p.estado === "publicado").length;
    const aprobados = posts.filter((p) => p.estado === "aprobado").length;
    const porRed = REDES.slice(1).map((red) => ({
      red,
      count: posts.filter((p) => p.red_social === red).length,
    }));
    return { total, publicados, aprobados, porRed };
  }, [posts]);

  const postsFiltrados = useMemo(() => {
    if (!posts?.length) return [];
    return posts.filter((p) => {
      const matchEstado = filtroEstado === "todos" || p.estado === filtroEstado;
      const matchRed = filtroRed === "todas" || p.red_social === filtroRed;
      return matchEstado && matchRed;
    });
  }, [posts, filtroEstado, filtroRed]);

  const jobsPorPost = useMemo(() => {
    return (publicationJobs || []).reduce((acc, job) => {
      if (!acc[job.post_id]) {
        acc[job.post_id] = job;
      }
      return acc;
    }, {});
  }, [publicationJobs]);

  const cuentasPorRed = useMemo(() => {
    return (accounts || []).reduce((acc, account) => {
      acc[account.platform] = acc[account.platform] || [];
      acc[account.platform].push(account);
      return acc;
    }, {});
  }, [accounts]);

  const resumenPublicacion = useMemo(() => {
    const total = publicationJobs?.length || 0;
    const published = publicationJobs?.filter((job) => job.status === "published").length || 0;
    const queued =
      publicationJobs?.filter((job) => ["queued", "scheduled", "retrying", "processing"].includes(job.status))
        .length || 0;
    const failed = publicationJobs?.filter((job) => job.status === "failed").length || 0;

    return { total, published, queued, failed };
  }, [publicationJobs]);

  const fechaMinProgramacion = useMemo(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  }, []);

  const handleSubmitAccount = async (event) => {
    event.preventDefault();
    const trimmedName = accountName.trim();
    const trimmedIdentifier = accountIdentifier.trim();

    if (!trimmedName) return;

    await onConnectAccount({
      platform,
      accountName: trimmedName,
      accountIdentifier: trimmedIdentifier || trimmedName,
    });

    setAccountName("");
    setAccountIdentifier("");
  };

  const handleProgramacionChange = (postId, value) => {
    setProgramaciones((prev) => ({
      ...prev,
      [postId]: value,
    }));
  };

  const handleCuentaChange = (postId, accountId) => {
    setCuentasSeleccionadas((prev) => ({
      ...prev,
      [postId]: accountId,
    }));
  };

  const publicar = async (postId, connectedAccountId) => {
    await onPublishPost({ postId, connectedAccountId });
  };

  const programar = async (postId, connectedAccountId) => {
    await onPublishPost({
      postId,
      connectedAccountId,
      scheduledFor: programaciones[postId],
    });
  };

  if (!posts?.length) {
    return (
      <section className="dashboard">
        <div className="dashboard-head">
          <h2>Dashboard de resultados</h2>
          <span>0 posts guardados</span>
        </div>
        <section className="automation-shell">
          <div className="automation-head">
            <h3>Publicacion en redes</h3>
            <p>Conecta tus cuentas para habilitar publicaciones manuales y programadas.</p>
          </div>
          <form className="account-form" onSubmit={handleSubmitAccount}>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {META_REDES.map((red) => (
                <option key={red} value={red}>
                  {red}
                </option>
              ))}
            </select>
            <input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Mi marca UIO"
              maxLength={80}
            />
            <input
              value={accountIdentifier}
              onChange={(e) => setAccountIdentifier(e.target.value)}
              placeholder="@mimarca"
              maxLength={80}
            />
            <button type="submit" className="btn-primary" disabled={connectingAccount || !accountName.trim()}>
              {connectingAccount ? "Conectando..." : "Conectar cuenta"}
            </button>
          </form>
        </section>
        <p className="dashboard-empty">
          Inicia sesion, genera posts y se guardaran aqui automaticamente.
        </p>
      </section>
    );
  }

  return (
    <section className="dashboard">
      <div className="dashboard-head">
        <h2>Dashboard de resultados</h2>
        <span>{posts.length} posts guardados</span>
      </div>

      <div className="dashboard-toolbar">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setMostrarAvanzado((prev) => !prev)}
        >
          {mostrarAvanzado ? "Ocultar herramientas avanzadas" : "Mostrar herramientas avanzadas"}
        </button>
        {!mostrarAvanzado && (
          <small>
            Cuentas: {accounts?.length || 0} · En cola: {resumenPublicacion.queued} · Fallidos: {resumenPublicacion.failed}
          </small>
        )}
      </div>

      {mostrarAvanzado && <section className="automation-shell">
        <div className="automation-head">
          <h3>Centro de publicaciones</h3>
          <p>Conecta tus cuentas, publica al instante o programa tus posts con reintentos.</p>
        </div>

        <div className="automation-grid">
          <div className="automation-card">
            <div className="section-head">
              <h4>Cuentas conectadas</h4>
              <span>{accounts?.length || 0} activas</span>
            </div>
            <form className="account-form" onSubmit={handleSubmitAccount}>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                {META_REDES.map((red) => (
                  <option key={red} value={red}>
                    {red}
                  </option>
                ))}
              </select>
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Mi marca UIO"
                maxLength={80}
              />
              <input
                value={accountIdentifier}
                onChange={(e) => setAccountIdentifier(e.target.value)}
                placeholder="@mimarca"
                maxLength={80}
              />
              <button type="submit" className="btn-primary" disabled={connectingAccount || !accountName.trim()}>
                {connectingAccount ? "Conectando..." : "Conectar cuenta"}
              </button>
            </form>

            {!accounts?.length ? (
              <p className="dashboard-empty">Aun no conectas cuentas de Instagram o Facebook.</p>
            ) : (
              <div className="account-list">
                {accounts.map((account) => (
                  <article className="account-card" key={account.id}>
                    <div>
                      <strong>
                        {RED_ICON[account.platform]} {account.account_name}
                      </strong>
                      <small>
                        {account.platform} · {account.account_identifier}
                      </small>
                    </div>
                    <button type="button" className="btn-ghost" onClick={() => onDisconnectAccount(account.id)}>
                      Desconectar
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="automation-card">
            <div className="section-head">
              <h4>Cola de publicacion</h4>
              <span>{resumenPublicacion.total} jobs</span>
            </div>
            <div className="job-summary-grid">
              <MetricaCard label="Publicados" value={resumenPublicacion.published} accent="accent-publicado" />
              <MetricaCard label="En cola" value={resumenPublicacion.queued} />
              <MetricaCard label="Fallidos" value={resumenPublicacion.failed} accent="accent-fallido" />
            </div>

            {!publicationJobs?.length ? (
              <p className="dashboard-empty">Todavia no has creado publicaciones manuales o programadas.</p>
            ) : (
              <div className="job-list">
                {publicationJobs.slice(0, 6).map((job) => (
                  <article className="job-card" key={job.id}>
                    <div className="job-card-top">
                      <strong>
                        {RED_ICON[job.platform]} {job.account_name}
                      </strong>
                      <PublicationBadge status={job.status} />
                    </div>
                    <p>{job.post_contenido}</p>
                    <small>
                      {job.publish_mode === "scheduled" ? "Programado" : "Manual"} · {formatFecha(job.scheduled_for)}
                    </small>
                    {job.last_error && <small className="job-error">{job.last_error}</small>}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="automation-card activity-card">
          <div className="section-head">
            <h4>Actividad y reintentos</h4>
            <span>{publicationAttempts?.length || 0} eventos</span>
          </div>
          {!publicationAttempts?.length ? (
            <p className="dashboard-empty">Los intentos de publicacion apareceran aqui.</p>
          ) : (
            <div className="attempt-list">
              {publicationAttempts.slice(0, 8).map((attempt) => (
                <div className="attempt-row" key={attempt.id}>
                  <PublicationBadge status={attempt.status} />
                  <span>{RED_ICON[attempt.platform]} Post #{attempt.post_id}</span>
                  <small>{attempt.message || "Sin detalle"}</small>
                  <time>{formatFecha(attempt.created_at)}</time>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>}

      {metricas && (
        <div className="metricas-grid">
          <MetricaCard label="Total" value={metricas.total} />
          <MetricaCard label="Publicados" value={metricas.publicados} accent="accent-publicado" />
          <MetricaCard label="Aprobados" value={metricas.aprobados} accent="accent-aprobado" />
          {metricas.porRed.map(({ red, count }) => (
            <MetricaCard key={red} label={red} value={count} />
          ))}
        </div>
      )}

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
              <div className="publish-box">
                {!mostrarAvanzado ? (
                  <p className="publish-hint">
                    Usa "Mostrar herramientas avanzadas" para publicar o programar este post.
                  </p>
                ) : META_REDES.includes(post.red_social) ? (
                  (() => {
                    const cuentas = cuentasPorRed[post.red_social] || [];
                    const cuentaDefault = cuentas[0]?.id;
                    const ultimoJob = jobsPorPost[post.id];

                    if (!cuentas.length) {
                      return (
                        <p className="publish-hint">
                          Conecta una cuenta de {post.red_social} para habilitar publicacion manual o programada.
                        </p>
                      );
                    }

                    return (
                      <>
                        <div className="publish-row">
                          <select
                            value={cuentasSeleccionadas[post.id] || cuentaDefault || ""}
                            onChange={(e) => handleCuentaChange(post.id, e.target.value)}
                            aria-label="Cuenta conectada"
                          >
                            {cuentas.map((account) => (
                              <option value={account.id} key={account.id}>
                                {account.account_name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={publishingPostId === post.id || post.estado === "publicado"}
                            onClick={() => publicar(post.id, cuentasSeleccionadas[post.id] || cuentaDefault)}
                          >
                            {publishingPostId === post.id ? "Procesando..." : "Publicar ahora"}
                          </button>
                        </div>
                        <div className="publish-row">
                          <input
                            type="datetime-local"
                            value={programaciones[post.id] || ""}
                            onChange={(e) => handleProgramacionChange(post.id, e.target.value)}
                            min={fechaMinProgramacion}
                            aria-label="Programar fecha"
                          />
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={publishingPostId === post.id || !programaciones[post.id]}
                            onClick={() => programar(post.id, cuentasSeleccionadas[post.id] || cuentaDefault)}
                          >
                            Programar
                          </button>
                        </div>
                        {ultimoJob && (
                          <div className="publish-status-line">
                            <PublicationBadge status={ultimoJob.status} />
                            <small>
                              {ultimoJob.publish_mode === "scheduled" ? "Programado para" : "Ultimo intento"} {formatFecha(ultimoJob.scheduled_for)}
                            </small>
                          </div>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <p className="publish-hint">WhatsApp no admite publicacion automatica en este modulo.</p>
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

