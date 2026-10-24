const DIA = 86400000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function emUtc(iso) {
  if (typeof iso !== 'string' || !ISO_RE.test(iso)) return null;
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return d.toISOString().slice(0, 10) === iso ? d : null;
}

function quintaDaSemana(d) {
  const dia = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() + (3 - dia) * DIA);
}

export function chaveDaSemana(iso) {
  const d = emUtc(iso);
  if (!d) return null;
  const q = quintaDaSemana(d);
  const ano = q.getUTCFullYear();
  const primeiraQuinta = quintaDaSemana(new Date(Date.UTC(ano, 0, 4)));
  const n = 1 + Math.round((q - primeiraQuinta) / (7 * DIA));
  return `${ano}-W${String(n).padStart(2, '0')}`;
}

export function intervaloDaSemana(chave) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(chave ?? ''));
  if (!m) return null;
  const ano = Number(m[1]);
  const n = Number(m[2]);
  if (!(n >= 1 && n <= 53)) return null;
  const primeiraQuinta = quintaDaSemana(new Date(Date.UTC(ano, 0, 4)));
  const segunda = new Date(primeiraQuinta.getTime() + ((n - 1) * 7 - 3) * DIA);
  return {
    inicio: segunda.toISOString().slice(0, 10),
    fim: new Date(segunda.getTime() + 6 * DIA).toISOString().slice(0, 10),
  };
}

export function rotuloDaSemana(chave) {
  const i = intervaloDaSemana(chave);
  if (!i) return '';
  const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return `${br(i.inicio)} a ${br(i.fim)}`;
}
