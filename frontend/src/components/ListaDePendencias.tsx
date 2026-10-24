import { useEffect, useState, type ReactNode } from 'react';
import type { Pendencia } from '../api/client';
import { copiarTexto } from '../pages/Sementes';
import { Panel } from './ui';

export const ROTULO_DO_TIPO: Record<string, string> = {
  AUTOCLAVE_SEM_DADOS: 'Autoclave', CAPELA_NAO_INFORMADA: 'Capela', SEM_RESPONSAVEL: 'Quem semeou',
  GUARDA_INCOMPLETA: 'Guarda incompleta', ABERTURA_SEM_SALA: 'Abertura sem sala', DIVERGENCIA: 'Contagem divergente',
  EMBALAGEM_NAO_LANCADA: 'Embalagem não lançada', CONTAMINADO_SEM_ESTANTE: 'Contaminado sem estante da retirada',
  RETIRADA_ACIMA_DO_LIMITE: 'Retirada acima do limite',
};

export const ASSUNTOS: Array<{ titulo: string; tipos: string[] }> = [
  { titulo: 'ABERTURAS', tipos: ['ABERTURA_SEM_SALA'] },
  { titulo: 'CONTAGEM / ESTOQUES', tipos: ['DIVERGENCIA'] },
  { titulo: 'CONTAMINADOS', tipos: ['CONTAMINADO_SEM_ESTANTE', 'RETIRADA_ACIMA_DO_LIMITE'] },
  { titulo: 'SEMEAÇÃO', tipos: ['AUTOCLAVE_SEM_DADOS', 'CAPELA_NAO_INFORMADA', 'SEM_RESPONSAVEL', 'GUARDA_INCOMPLETA'] },
  { titulo: 'COLHEITA / EMBALAGEM', tipos: ['EMBALAGEM_NAO_LANCADA'] },
];
const ORDEM_DOS_TIPOS = ASSUNTOS.flatMap((a) => a.tipos);
const rotulo = (tipo: string) => ROTULO_DO_TIPO[tipo] ?? tipo;
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function loteDaPendencia(item: Pendencia): string {
  const dia = `${item.data_lote.slice(8, 10)}/${item.data_lote.slice(5, 7)}`;
  if (item.lote_id == null) return `Dia ${dia}`;
  return `Lote de ${dia}${item.especie ? ` (${item.especie})` : ''}`;
}

const pendenciaDoItem = (item: Pendencia) => maiuscula(item.detalhe ?? item.frase);

export function contagemPorTipo(itens: Pendencia[]): Array<{ tipo: string; n: number }> {
  const n = new Map<string, number>();
  for (const i of itens) n.set(i.tipo, (n.get(i.tipo) ?? 0) + 1);
  const posicao = (t: string) => (ORDEM_DOS_TIPOS.includes(t) ? ORDEM_DOS_TIPOS.indexOf(t) : ORDEM_DOS_TIPOS.length);
  return [...n].sort(([a], [b]) => posicao(a) - posicao(b)).map(([tipo, q]) => ({ tipo, n: q }));
}

export function textoDasPendencias(itens: Pendencia[], hoje: Date): string {
  const dia = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const linha = (i: Pendencia) => {
    if (i.detalhe == null) return `- ${i.frase}`;
    const qtd = i.quantidade && !i.detalhe.includes(i.quantidade) ? ` Quantidade: ${i.quantidade}.` : '';
    return `- ${loteDaPendencia(i)}${i.local ? ` (${i.local})` : ''}: ${i.detalhe}${qtd}`;
  };
  const conhecidos = new Set(ORDEM_DOS_TIPOS);
  const blocos = [...ASSUNTOS, { titulo: 'OUTRAS', tipos: [] as string[] }].map(({ titulo, tipos }) => {
    const doAssunto = itens.filter((i) => (titulo === 'OUTRAS' ? !conhecidos.has(i.tipo) : tipos.includes(i.tipo)));
    return doAssunto.length ? `${titulo} (${doAssunto.length})\n${doAssunto.map(linha).join('\n')}` : null;
  }).filter(Boolean);
  return [`PENDÊNCIAS DA PRODUÇÃO: ${dia}`, ...blocos].join('\n\n');
}

export interface EstadoDaLista { aberta: boolean; filtro: string }

function chavesDasLinhas(itens: Pendencia[]): Map<Pendencia, string> {
  const vistas = new Map<string, number>();
  return new Map(itens.map((i) => {
    const base = `${i.tipo}|${i.lote_id}|${i.transferencia_id ?? ''}|${i.data_retirada ?? ''}|${i.frase}`;
    const n = vistas.get(base) ?? 0;
    vistas.set(base, n + 1);
    return [i, n ? `${base}#${n}` : base];
  }));
}

export function ListaDePendencias({ itens, acoes, estado, hoje = new Date(), onAviso, copiar: comCopiar = true }: {
  itens: Pendencia[];
  acoes: (item: Pendencia) => ReactNode;
  estado?: [EstadoDaLista, (e: EstadoDaLista) => void];
  hoje?: Date;
  onAviso?: (texto: string, erro?: boolean) => void;
  copiar?: boolean;
}) {
  const interno = useState<EstadoDaLista>({ aberta: false, filtro: '' });
  const [{ aberta, filtro: filtroEscolhido }, setEstado] = estado ?? interno;
  const [textoManual, setTextoManual] = useState<string | null>(null);

  const contagem = contagemPorTipo(itens);
  const filtro = contagem.some((c) => c.tipo === filtroEscolhido) ? filtroEscolhido : '';
  useEffect(() => {
    if (filtro !== filtroEscolhido) setEstado({ aberta, filtro });
  }, [filtro, filtroEscolhido, aberta, setEstado]);
  if (!itens.length) return null;

  const visiveis = filtro ? itens.filter((i) => i.tipo === filtro) : itens;
  const texto = textoDasPendencias(visiveis, hoje);
  const chaves = chavesDasLinhas(itens);
  const abrir = (tipo: string) => setEstado({ aberta: true, filtro: tipo });

  const copiarLista = () => {
    const falhou = () => { setTextoManual(texto); onAviso?.('Não deu para copiar; selecione o texto abaixo da tabela.', true); };
    try {
      copiarTexto(texto, navigator.clipboard).then((ok) => {
        if (!ok) return falhou();
        setTextoManual(null);
        onAviso?.(`Lista copiada: ${visiveis.length} pendência${visiveis.length === 1 ? '' : 's'}.`);
      });
    } catch { falhou(); }
  };

  return (
    <Panel title={`Pendências de lançamento (${itens.length})`}
      sub="Obrigatório não trava o lançamento: fica pendente até alguém completar">
      <div className="form-acao pendencias-resumo">
        {contagem.map(({ tipo, n }) => (
          <button key={tipo} type="button" className={aberta && filtro === tipo ? 'btn' : 'btn ghost'}
            aria-pressed={aberta && filtro === tipo} onClick={() => abrir(tipo)}>{rotulo(tipo)} ({n})</button>
        ))}
        <button type="button" className="btn ghost" aria-expanded={aberta}
          onClick={() => setEstado({ aberta: !aberta, filtro: '' })}>{aberta ? 'Fechar lista' : `Ver lista (${itens.length})`}</button>
      </div>
      {aberta && (
        <>
          <div className="form-acao">
            <label>
              Tipo{' '}
              <select value={filtro} onChange={(e) => setEstado({ aberta: true, filtro: e.target.value })}>
                <option value="">Todos os tipos ({itens.length})</option>
                {contagem.map(({ tipo, n }) => <option key={tipo} value={tipo}>{rotulo(tipo)} ({n})</option>)}
              </select>
            </label>
            {comCopiar && <button type="button" className="btn ghost" onClick={copiarLista}>Copiar pendências para o grupo</button>}
          </div>
          <div className="plan-wrap">
            <table className="plan pendencias">
              <thead>
                <tr><th>Tipo</th><th>Data/Lote</th><th>Local/Estante</th><th>Pendência</th><th>Quantidade</th><th>Ação</th></tr>
              </thead>
              <tbody>
                {visiveis.map((item) => (
                  <tr key={chaves.get(item)}>
                    <td>{rotulo(item.tipo)}</td>
                    <td>{loteDaPendencia(item)}</td>
                    <td>{item.local ?? '—'}</td>
                    <td className="pendencia-texto">{pendenciaDoItem(item)}</td>
                    <td>{item.quantidade ?? '—'}</td>
                    <td className="pendencia-acao"><span className="pendencia-acoes">{acoes(item)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {textoManual != null && textoManual === texto && <pre className="obs-tela" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{textoManual}</pre>}
        </>
      )}
    </Panel>
  );
}
