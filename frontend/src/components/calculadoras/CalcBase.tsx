import { type ReactNode } from 'react';
import { Panel } from '../ui';

export function CampoNum({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="fg">
      <label>{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function Calculadora({ titulo, sub, campos, resultado }: {
  titulo: string; sub: string; campos: ReactNode; resultado: ReactNode;
}) {
  return (
    <Panel title={titulo} sub={sub} tag="calculadora">
      <div className="form-grid c2">{campos}</div>
      <div className="calc-box" style={{ marginTop: 12 }}>{resultado}</div>
    </Panel>
  );
}
