import { useState } from "react";

const REDES = [
  { id: "Instagram", icon: "📸", label: "Instagram" },
  { id: "WhatsApp", icon: "💬", label: "WhatsApp" },
  { id: "Facebook", icon: "👍", label: "Facebook" },
];

export default function Form({ onGenerar, cargando }) {
  const [negocio, setNegocio] = useState("");
  const [redSocial, setRedSocial] = useState("Instagram");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!negocio.trim()) return;
    onGenerar({ negocio: negocio.trim(), redSocial });
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="negocio">
          Describe tu negocio
          <span className="label-hint">(sé específico)</span>
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
      </div>

      <div className="form-group">
        <label>Elige la red social</label>
        <div className="red-social-group">
          {REDES.map((red) => (
            <button
              type="button"
              key={red.id}
              className={`red-chip ${redSocial === red.id ? "active" : ""}`}
              onClick={() => setRedSocial(red.id)}
            >
              {red.icon} {red.label}
            </button>
          ))}
        </div>
      </div>

      <button className="btn-generar" type="submit" disabled={cargando}>
        {cargando ? "Generando..." : "⚡ Generar posts"}
      </button>
    </form>
  );
}
