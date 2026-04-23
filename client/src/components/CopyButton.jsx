import { useState } from "react";

export default function CopyButton({ texto, onCopied }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      if (onCopied) {
        await onCopied();
      }
    } catch {
      // Fallback para navegadores sin clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = texto;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      if (onCopied) {
        await onCopied();
      }
    }
  };

  return (
    <button className="copy-btn" type="button" onClick={copiar}>
      {copiado ? "✅ Copiado" : "📋 Copiar"}
    </button>
  );
}
