import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

export function dataDigitadaParaIso(texto: string): string | null {
  const t = (texto ?? '').trim();
  if (t === '') return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return validar(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const br = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/);
  if (br) {
    const dia = Number(br[1]);
    const mes = Number(br[2]);
    const ano = br[3] == null
      ? new Date().getFullYear()
      : br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]);
    return validar(ano, mes, dia);
  }
  const dig8 = t.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (dig8) return validar(Number(dig8[3]), Number(dig8[2]), Number(dig8[1]));
  const dig6 = t.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (dig6) return validar(2000 + Number(dig6[3]), Number(dig6[2]), Number(dig6[1]));
  const dig4 = t.match(/^(\d{2})(\d{2})$/);
  if (dig4) return validar(new Date().getFullYear(), Number(dig4[2]), Number(dig4[1]));
  return null;
}

function validar(ano: number, mes: number, dia: number): string | null {
  if (!(ano >= 1900 && ano <= 2999)) return null;
  if (!(mes >= 1 && mes <= 12)) return null;
  if (!(dia >= 1 && dia <= 31)) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${ano}-${p2(mes)}-${p2(dia)}`;
}

export function isoParaDigitada(iso: string): string {
  const m = (iso ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function entradaEhAmbigua(texto: string): boolean {
  const t = (texto ?? '').trim();
  if (/^\d{6}$/.test(t)) return true;
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2}$/.test(t)) return true;
  return false;
}

const TEM_SHOW_PICKER =
  typeof HTMLInputElement !== 'undefined' && 'showPicker' in HTMLInputElement.prototype;

export function manipularBlur(texto: string, onBlurIso?: (iso: string) => void): void {
  onBlurIso?.(dataDigitadaParaIso(texto) ?? '');
}

export function criarAgendadorDeAplicacao(aplicar: (iso: string) => void, atrasoMs = 400) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  function cancelar() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
  }
  function digitou(texto: string) {
    cancelar();
    if (texto.trim() === '') { aplicar(''); return; }
    const iso = dataDigitadaParaIso(texto);
    if (!iso) return;
    if (entradaEhAmbigua(texto)) {
      timer = setTimeout(() => { timer = null; aplicar(iso); }, atrasoMs);
      return;
    }
    aplicar(iso);
  }
  function saiuDoCampo(texto: string) {
    cancelar();
    const iso = dataDigitadaParaIso(texto);
    if (iso) aplicar(iso);
  }
  return { digitou, cancelar, saiuDoCampo };
}

export function CampoData({ value, onChange, onBlurIso, id, className, style, disabled }: {
  value: string;
  onChange: (iso: string) => void;
  onBlurIso?: (iso: string) => void;
  id?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const [texto, setTexto] = useState(() => isoParaDigitada(value));
  const refData = useRef<HTMLInputElement>(null);
  const refOnChange = useRef(onChange);
  refOnChange.current = onChange;
  const refAgendador = useRef<ReturnType<typeof criarAgendadorDeAplicacao> | null>(null);
  if (refAgendador.current === null) {
    refAgendador.current = criarAgendadorDeAplicacao((iso) => refOnChange.current(iso));
  }
  useEffect(() => () => refAgendador.current?.cancelar(), []);
  useEffect(() => {
    setTexto((atual) => (dataDigitadaParaIso(atual) === (value || null) ? atual : isoParaDigitada(value)));
  }, [value]);

  const mostrarBotao = TEM_SHOW_PICKER && !disabled;

  return (
    <span className="campo-data-wrap">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        className={className}
        style={style}
        disabled={disabled}
        value={texto}
        onChange={(e) => {
          const novo = e.target.value;
          setTexto(novo);
          refAgendador.current!.digitou(novo);
        }}
        onBlur={() => {
          refAgendador.current!.saiuDoCampo(texto);
          manipularBlur(texto, onBlurIso);
        }}
      />
      {mostrarBotao && (
        <button
          type="button"
          className="campo-data-btn"
          aria-label="Abrir calendário"
          onClick={() => refData.current?.showPicker()}
        >
          📅
        </button>
      )}
      <input
        ref={refData}
        type="date"
        className="campo-data-oculto"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        value={value || ''}
        onChange={(e) => {
          const novo = e.target.value;
          setTexto(isoParaDigitada(novo));
          onChange(novo);
        }}
      />
    </span>
  );
}
