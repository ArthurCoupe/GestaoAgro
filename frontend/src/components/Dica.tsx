import { useId, useState, type ReactNode } from 'react';

export function Dica({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  const idDoTexto = useId();
  return (
    <span className="dica">
      <button
        type="button"
        className="dica-botao"
        aria-label={rotulo}
        aria-expanded={aberta}
        aria-describedby={idDoTexto}
        onClick={() => setAberta((a) => !a)}
        onBlur={() => setAberta(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setAberta(false); }}
      >ⓘ</button>
      <span id={idDoTexto} className="dica-texto" role="note" hidden={!aberta}>{children}</span>
    </span>
  );
}
