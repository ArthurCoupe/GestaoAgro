import { rotuloDoMes } from '../api/alertas';
import { dataBr } from '../api/client';
import type { ExecutivoSerieMensal, FolhaPendente, MesProvisorio } from '../api/gerencial';
import { NOME_DA_EMPRESA } from './RevendaPorProduto';

const mesSeguinte = (mes: string) => (mes.slice(5, 7) === '12' ? `${Number(mes.slice(0, 4)) + 1}-01`
  : `${mes.slice(0, 4)}-${String(Number(mes.slice(5, 7)) + 1).padStart(2, '0')}`);

export function faixaDeMeses(meses: string[]): string {
  const corridas: string[][] = [];
  for (const m of [...new Set(meses)].sort()) {
    const ultima = corridas[corridas.length - 1];
    if (ultima && mesSeguinte(ultima[ultima.length - 1]) === m) ultima.push(m); else corridas.push([m]);
  }
  const partes = corridas.map((c) => {
    if (c.length === 1) return rotuloDoMes(c[0]);
    const [ini, fim] = [c[0], c[c.length - 1]];
    return `${ini.slice(0, 4) === fim.slice(0, 4) ? rotuloDoMes(ini).split(' ')[0] : rotuloDoMes(ini)} a ${rotuloDoMes(fim)}`;
  });
  return partes.length <= 1 ? (partes[0] ?? '') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

export function textoDoSelo(provisorios: MesProvisorio[] = []): string | null {
  const meses = [...new Set(provisorios.map((p) => p.mes))];
  if (meses.length === 0) return null;
  const porMotivo = new Map<string, Set<string>>();
  for (const p of provisorios) for (const m of p.motivos ?? []) porMotivo.set(m, (porMotivo.get(m) ?? new Set()).add(p.mes));
  const partes = [...porMotivo].map(([motivo, ms]) => (ms.size === meses.length ? motivo
    : `${faixaDeMeses([...ms])}: ${motivo.charAt(0).toLowerCase()}${motivo.slice(1)}`));
  return [`Provisório: ${faixaDeMeses(meses)}.`, ...partes].join(' ');
}

export function seloSemOJaDito(provisorios: MesProvisorio[] = [], jaDito: MesProvisorio[] = []): MesProvisorio[] {
  const meses = new Set(jaDito.map((p) => p.mes));
  const motivos = new Set(jaDito.flatMap((p) => p.motivos ?? []));
  return provisorios.filter((p) => !meses.has(p.mes)).map((p) => ({ ...p, motivos: (p.motivos ?? []).filter((m) => !motivos.has(m)) }));
}

export function textoDaFolhaPendente(pendentes: FolhaPendente[] = [], provisorios: MesProvisorio[] = []): string | null {
  const selo = textoDoSelo(provisorios);
  const frases = selo ? [selo] : [];
  if (pendentes.length > 0) {
    const itens = pendentes.map((p) => `${rotuloDoMes(p.mes)}, ${NOME_DA_EMPRESA[p.empresa]} (${p.linhas.map((l) => l.rotulo).join(', ')}; `
      + `${p.ultimo_recorte ? `último movimento carregado em ${dataBr(p.ultimo_recorte)}` : 'nenhum movimento carregado'})`);
    frases.push(`Folha ainda não apropriada: ${itens.join('; ')}. Nesses meses as linhas da folha não estão zeradas por economia: `
      + 'a folha ainda não chegou. Resultado, margem, ponto de equilíbrio e cenários desses meses, e os totais do período que '
      + 'os incluem, estão afetados; os alertas pulam esses meses.');
  }
  return frases.length > 0 ? frases.join(' ') : null;
}

export function AvisoDaFolha({ pendentes, provisorios }: { pendentes?: FolhaPendente[]; provisorios?: MesProvisorio[] }) {
  const texto = textoDaFolhaPendente(pendentes, provisorios);
  return texto ? <p className="obs-tela" role="note">⚠ {texto}</p> : null;
}

export const fraseDoQuadroAfetado = (oque: string) => `${oque} incluem mês com folha ainda não apropriada (aviso no topo da tela): leia como parcial.`;

export function linhasPendentesPorMes(pendentes: FolhaPendente[] = []): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const p of pendentes) {
    const s = m.get(p.mes) ?? new Set<string>();
    for (const l of p.linhas) s.add(String(l.linha_id));
    m.set(p.mes, s);
  }
  return m;
}

export const idsPendentes = (pendentes: FolhaPendente[] = []) => new Set(pendentes.flatMap((p) => p.linhas.map((l) => String(l.linha_id))));

export function serieSemMesesPendentes(serie: ExecutivoSerieMensal[], pendentes: FolhaPendente[] = []): ExecutivoSerieMensal[] {
  const meses = new Set(pendentes.map((p) => p.mes));
  if (meses.size === 0) return serie;
  return serie.map((s) => (meses.has(s.mes.slice(0, 7)) ? { ...s, escada: null, linhas: [], linhas_por_chave: {} } : s));
}
