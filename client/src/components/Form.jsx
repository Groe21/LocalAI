import { useState } from "react";

const REDES = [
  { id: "Instagram", icon: "📸", label: "Instagram" },
  { id: "WhatsApp", icon: "💬", label: "WhatsApp" },
  { id: "Facebook", icon: "👍", label: "Facebook" },
];

const EJEMPLOS_BASE = [
  "Cafeteria de especialidad en Cuenca con brunch dominical y musica en vivo.",
  "Tienda de ropa deportiva en Quito con envios en 24h y descuentos por combos.",
  "Panaderia artesanal en Guayaquil, masa madre y delivery gratis en zonas cercanas.",
];

function limpiarTexto(texto) {
  return (texto || "").replace(/\s+/g, " ").trim();
}

function construirSugerencias(negocio) {
  const base = limpiarTexto(negocio);
  if (!base) return EJEMPLOS_BASE;

  const raiz = base.replace(/[.!?]+$/g, "");
  return [
    `${raiz}. Publico ideal: familias y jovenes de la zona.`,
    `${raiz}. Promocion actual: 2x1 entre semana y reserva por WhatsApp.`,
    `${raiz}. Diferencial: atencion cercana, calidad constante y entrega rapida.`,
  ];
}

export default function Form({ onGenerar, cargando }) {
  const [negocio, setNegocio] = useState("");
  const [redSocial, setRedSocial] = useState("Instagram");
  const sugerencias = construirSugerencias(negocio);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!negocio.trim()) return;
    onGenerar({ negocio: negocio.trim(), redSocial });
  };

  const longitud = negocio.trim().length;
  const textoValido = longitud >= 24;

  const aplicarSugerencia = (sugerencia) => {
    setNegocio((prev) => {
      const actual = limpiarTexto(prev);
      const propuesta = limpiarTexto(sugerencia);

      if (!actual) return propuesta;
      if (actual.includes(propuesta)) return prev;

      const separador = /[.!?]$/.test(actual) ? " " : ". ";
      const extra = propuesta.startsWith(actual)
        ? propuesta.slice(actual.length).trim()
        : propuesta;

      if (!extra) return prev;
      return `${actual}${separador}${extra}`.trim();
    });
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="negocio">
          Describe tu negocio
          <span className="label-hint">(claro y breve)</span>
        </label>
        <textarea
          id="negocio"
          placeholder='Ej: "Vendo empanadas de verde en Guayaquil, delivery gratis en la ciudad, precios desde $1"'
          value={negocio}
          onChange={(e) => setNegocio(e.target.value)}
          rows={3}
          maxLength={500}
          required
        />
        <div className="field-foot">
          <small>
            Incluye ciudad, propuesta de valor y tipo de cliente para mejores
            resultados.
          </small>
          <strong>{negocio.length}/500</strong>
        </div>
        <div className="example-list" aria-label="Sugerencias inteligentes">
          {sugerencias.map((ejemplo, index) => (
            <button
              key={ejemplo}
              type="button"
              className="example-chip"
              onClick={() => aplicarSugerencia(ejemplo)}
            >
              {negocio.trim() ? `Mejora ${index + 1}` : `Ejemplo ${index + 1}`}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Elige la red social</label>
        <div className="red-social-group" role="group" aria-label="Red social">
          {REDES.map((red) => (
            <button
              type="button"
              key={red.id}
              className={`red-chip ${redSocial === red.id ? "active" : ""}`}
              onClick={() => setRedSocial(red.id)}
              aria-pressed={redSocial === red.id}
            >
              {red.icon} {red.label}
            </button>
          ))}
        </div>
      </div>

      <button
        className="btn-generar"
        type="submit"
        disabled={cargando || !textoValido}
      >
        {cargando ? "Generando..." : "Generar 3 posts"}
      </button>
      {!textoValido && (
        <p className="form-hint">
          Agrega un poco más de contexto (mínimo 24 caracteres).
        </p>
      )}
    </form>
  );
}
