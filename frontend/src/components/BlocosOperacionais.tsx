import {
  useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode,
} from 'react';
import {
  dataBr, getPainelOperacional, num,
  type PainelOperacionalAberturaLinha, type PainelOperacionalAlerta,
  type PainelOperacionalMateriaPrimaMotivo, type PainelOperacionalResposta,
} from '../api/client';
import { Panel, Pill } from './ui';

export const formatarNumero = (v: number | null | undefined) => num(v, 1);

export const ROTULO_TIPO: Record<string, string> = {
  SH: 'Shiitake', SB: 'Shimeji Branco', SP: 'Shimeji Preto', SS: 'Shimeji Salmão',
};
export const ORDEM_TIPO = ['SH', 'SB', 'SP', 'SS'];
export const TONE_SEMAFORO: Record<string, 'ok' | 'warn' | 'bad' | 'neutral'> = {
  VERDE: 'ok', AMARELO: 'warn', VERMELHO: 'bad', SEM_DADO: 'neutral',
};

const ROTULO_ALERTA: Record<string, string> = {
  ABERTURA_VENCIDA: 'Abertura vencida',
  ABERTURA_PROXIMA: 'Abertura próxima do prazo',
  SEMENTE_VENCIDA: 'Semente vencida',
  SEMENTE_PROXIMA: 'Semente próxima da validade',
  CONTAMINACAO_CRITICA: 'Contaminação crítica',
  DIVERGENCIA_CONTAGEM: 'Divergência de contagem',
  MATERIA_PRIMA_BAIXA: 'Matéria-prima em falta',
  INSUMO_BAIXO: 'Insumo em falta',
  INSUMO_ATENCAO: 'Insumo: programar compra',
};
export const rotuloAlerta = (tipo: string) => ROTULO_ALERTA[tipo] ?? tipo;

export const chaveDoAlerta = (a: { tipo: string }, i: number) => `${a.tipo}:${i}`;

const SUB_ALERTAS_DO_DIA = 'Vermelho primeiro: abertura vencida, semente vencida, contaminação crítica, divergência de contagem, matéria-prima em falta e insumo em falta';

export function PainelAlertasCriticos({
  alertas, title = 'Alertas Críticos do Dia', sub = SUB_ALERTAS_DO_DIA, tag, vazio = 'Nenhum alerta crítico hoje.',
}: {
  alertas: PainelOperacionalAlerta[]; title?: string; sub?: string; tag?: string; vazio?: string;
}) {
  return (
    <Panel title={title}
      tag={tag ?? `${formatarNumero(alertas.length)} ao todo · vermelhos e amarelos`}
      sub={sub}>
      {alertas.length === 0 ? (
        <div className="empty">{vazio}</div>
      ) : (
        <div className="lista-alertas">
          {alertas.map((a, i) => (
            <div key={chaveDoAlerta(a, i)}
              className={`alert-banner ${a.severidade === 'AMARELO' ? 'media' : ''}`}>
              <b>{a.severidade === 'VERMELHO' ? '⚠' : '●'} {rotuloAlerta(a.tipo)}</b> {a.mensagem}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export type DominioOperacional =
  'ABERTURAS' | 'SEMENTES' | 'CONTAMINADOS' | 'MATERIA_PRIMA' | 'OUTROS_INSUMOS' | 'RESIDUAL';

const PREFIXO_DO_DOMINIO: Array<[string, Exclude<DominioOperacional, 'RESIDUAL'>]> = [
  ['ABERTURA_', 'ABERTURAS'],
  ['SEMENTE_', 'SEMENTES'],
  ['CONTAMINACAO_CRITICA', 'CONTAMINADOS'],
  ['MATERIA_PRIMA_BAIXA', 'MATERIA_PRIMA'],
  ['INSUMO_', 'OUTROS_INSUMOS'],
];

export function dominioDoAlerta(tipo: string): DominioOperacional {
  const par = PREFIXO_DO_DOMINIO.find(([prefixo]) => tipo.startsWith(prefixo));
  return par ? par[1] : 'RESIDUAL';
}

export function alertasDoDominio(
  alertas: PainelOperacionalAlerta[], dominio: DominioOperacional,
): PainelOperacionalAlerta[] {
  return alertas.filter((a) => dominioDoAlerta(a.tipo) === dominio);
}

export function criarGuardaDeCorrida(): {
  iniciar(): number; vale(id: number): boolean; invalidar(): void;
} {
  let contador = 0;
  let atual = 0;
  return {
    iniciar() { atual = ++contador; return atual; },
    vale: (id: number) => id === atual,
    invalidar() { atual = 0; },
  };
}

export function useRecarregarAtual(recarregar: () => void): () => void {
  const ref = useRef(recarregar);
  useLayoutEffect(() => { ref.current = recarregar; });
  return useCallback(() => ref.current(), []);
}

export function usePainelOperacional(params: { tipo?: string; periodo?: string; mes?: string; ano?: string; lote?: string } = {}) {
  const [dados, setDados] = useState<PainelOperacionalResposta | null>(null);
  const [erro, setErro] = useState('');
  const { tipo, periodo, mes, ano, lote } = params;
  const guarda = useRef(criarGuardaDeCorrida());
  const temDados = useRef(false);
  const carregar = useCallback((apagar: boolean, mostrarErro = apagar) => {
    const id = guarda.current.iniciar();
    setErro(''); if (apagar) setDados(null);
    return getPainelOperacional({
      tipo: tipo || undefined, periodo: periodo || undefined, mes: mes || undefined, ano: ano || undefined, lote: lote || undefined,
    })
      .then((d) => { if (guarda.current.vale(id)) { temDados.current = true; setDados(d); } })
      .catch((e) => { if (guarda.current.vale(id) && mostrarErro) setErro(e?.response?.data?.erro ?? e.message); });
  }, [tipo, periodo, mes, ano, lote]);
  const recarregar = useCallback(() => { void carregar(true); }, [carregar]);
  const trocar = useCallback(() => { void carregar(!temDados.current, true); }, [carregar]);
  const atualizar = useCallback(() => carregar(false), [carregar]);
  useEffect(() => {
    trocar();
    return () => guarda.current.invalidar();
  }, [trocar]);
  return { dados, erro, recarregar, atualizar };
}

export const VAZIO_DO_DOMINIO: Record<Exclude<DominioOperacional, 'RESIDUAL'>, string> = {
  SEMENTES: 'Nenhuma pendência de sementes hoje.',
  MATERIA_PRIMA: 'Nenhuma pendência de matéria-prima hoje.',
  OUTROS_INSUMOS: 'Nenhuma pendência de outros insumos hoje.',
  ABERTURAS: 'Nenhuma abertura vencida ou próxima do prazo hoje.',
  CONTAMINADOS: 'Nenhum lote em contaminação crítica hoje.',
};

const SUB_ACOES_DO_DIA = 'Vermelho primeiro: os mesmos alertas que o card do Painel de Comando conta';

type TopoProps = {
  dominio: Exclude<DominioOperacional, 'RESIDUAL'>;
  id: string;
  titulo: string;
  children?: (dados: PainelOperacionalResposta) => ReactNode;
};

export function TopoOperacionalVisao({ dominio, id, titulo, dados, erro, children }: TopoProps & {
  dados: PainelOperacionalResposta | null; erro: string;
}) {
  return (
    <div id={id}>
      {erro ? (
        <div className="empty">Ações do dia indisponíveis: {erro}</div>
      ) : !dados ? (
        <p className="nota">Carregando ações do dia…</p>
      ) : (
        <>
          <PainelAlertasCriticos alertas={alertasDoDominio(dados.alertas, dominio)}
            title={titulo} sub={SUB_ACOES_DO_DIA} vazio={VAZIO_DO_DOMINIO[dominio]} />
          {children?.(dados)}
        </>
      )}
    </div>
  );
}

export function TopoOperacional(props: TopoProps) {
  const { dados, erro } = usePainelOperacional();
  return <TopoOperacionalVisao {...props} dados={dados} erro={erro} />;
}

export function classificarAberturas<T extends { semaforo: string }>(linhas: T[]) {
  return {
    urgentes: linhas.filter((l) => l.semaforo === 'VERMELHO' || l.semaforo === 'AMARELO'),
    emPrazo: linhas.filter((l) => l.semaforo === 'VERDE'),
    semPrazo: linhas.filter((l) => l.semaforo === 'SEM_DADO'),
  };
}

export function rotuloDaOrigemDoPrazo(origem: 'ESPECIE' | 'TIPO' | null | undefined): string | null {
  if (origem === 'ESPECIE') return 'prazo da espécie';
  if (origem === 'TIPO') return 'prazo padrão da espécie';
  return null;
}

export function situacaoTexto(l: PainelOperacionalAberturaLinha): string {
  if (l.dias_restantes == null) return '—';
  if (l.dias_restantes < 0) return `${-l.dias_restantes} dia(s) de atraso`;
  if (l.dias_restantes === 0) return 'vence hoje';
  return `em ${l.dias_restantes} dia(s)`;
}

export function agruparPorEspecie(linhas: PainelOperacionalAberturaLinha[]) {
  const grupos = new Map<string, PainelOperacionalAberturaLinha[]>();
  for (const l of linhas) {
    const chave = l.tipo ?? '(sem tipo)';
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(l);
  }
  return [...grupos.entries()].sort(([a], [b]) => {
    const ia = ORDEM_TIPO.indexOf(a);
    const ib = ORDEM_TIPO.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function BlocoProximasAberturas({ proximasAberturas, dentroDaTela = false }: {
  proximasAberturas: PainelOperacionalResposta['proximas_aberturas']; dentroDaTela?: boolean;
}) {
  const { urgentes, emPrazo, semPrazo } = classificarAberturas(proximasAberturas.linhas);
  const porEspecie = agruparPorEspecie(urgentes);
  const lotesNaFila = Object.values(proximasAberturas.resumo.por_situacao)
    .reduce((s, x) => s + x.lotes, 0);
  const ondeEstaAFila = dentroDaTela ? 'está logo abaixo' : 'está em Próximas Aberturas';
  return (
    <Panel title="Próximas Aberturas de Blocos"
      tag={`${formatarNumero(proximasAberturas.resumo.cobertura.enderecos)} endereços na fila · ${formatarNumero(lotesNaFila)} lotes`}
      sub={`Vencidos, a até 7 dias do prazo e de prazo indeterminado, por espécie: cobertura de quantidade em ${formatarNumero(proximasAberturas.resumo.cobertura.com_quantidade)} dos endereços. A fila completa (inclusive em dia) ${ondeEstaAFila}`}>
      {urgentes.length === 0 && emPrazo.length === 0 && semPrazo.length === 0 ? (
        <div className="empty">Nenhuma abertura pendente na fila.</div>
      ) : (
        <>
          {urgentes.length === 0 ? (
            <div className="empty">Nenhuma abertura vencida ou próxima do prazo.</div>
          ) : (
            porEspecie.map(([especie, linhas]) => (
              <div key={especie} className="plan-wrap">
                <h4 className="rotulo">{ROTULO_TIPO[especie] ?? especie} · {linhas.length}</h4>
                <table className="plan">
                  <thead>
                    <tr>
                      <th className="rotulo">Lote</th><th className="rotulo">Galpão</th>
                      <th className="rotulo">Estante</th><th className="rotulo">Situação</th>
                      <th className="num">Disponíveis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => {
                      const origemPrazo = rotuloDaOrigemDoPrazo(l.parametro_origem);
                      return (
                        <tr key={l.estante_id}>
                          <td className="rotulo">{dataBr(l.data_lote)}</td>
                          <td className="rotulo">{l.galpao ?? '—'}</td>
                          <td className="rotulo">{l.estante ?? '—'}</td>
                          <td className="rotulo">
                            {situacaoTexto(l)}
                            {origemPrazo !== null && <> <Pill tone="neutral">{origemPrazo}</Pill></>}
                          </td>
                          <td className="num">
                            {l.blocos_disponiveis == null ? '—' : num(l.blocos_disponiveis)}
                            {l.saldo_negativo && ' ⚠'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))
          )}

          {semPrazo.length > 0 && (
            <div className="plan-wrap">
              <h4 className="rotulo">Prazo indeterminado · {semPrazo.length}</h4>
              <table className="plan">
                <thead>
                  <tr>
                    <th className="rotulo">Lote</th><th className="rotulo">Tipo</th>
                    <th className="rotulo">Galpão</th><th className="rotulo">Estante</th>
                  </tr>
                </thead>
                <tbody>
                  {semPrazo.map((l) => (
                    <tr key={l.estante_id}>
                      <td className="rotulo">{dataBr(l.data_lote)}</td>
                      <td className="rotulo">{ROTULO_TIPO[l.tipo ?? ''] ?? l.tipo ?? '—'}</td>
                      <td className="rotulo">{l.galpao ?? '—'}</td>
                      <td className="rotulo">{l.estante ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="nota">
                Prazo indeterminado, não "em dia": sem parâmetro de maturação para o tipo, ou
                data de lote inconsistente. Confira o endereço no galpão.
              </p>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

export function estadoDaCoberturaMateriaPrima(
  materiaPrima: PainelOperacionalResposta['materia_prima'],
): 'falha_de_carga' | 'nada_cadastrado' | 'com_dado' {
  if (materiaPrima === null) return 'falha_de_carga';
  if (materiaPrima.linhas.length === 0 && materiaPrima.sem_cobertura.length === 0) {
    return 'nada_cadastrado';
  }
  return 'com_dado';
}

const unidadeMateriaPrima = (u: string) => (u === 'apresentacao' ? 'apresentação' : u);

const MOTIVO_SEM_APRESENTACAO: PainelOperacionalMateriaPrimaMotivo = 'sem apresentacao cadastrada';
export const FRASE_MOTIVO: Record<PainelOperacionalMateriaPrimaMotivo, string> = {
  'sem apresentacao cadastrada': 'sem apresentação cadastrada',
  'sem estoque informado': 'sem estoque informado',
  'estoque negativo': 'estoque negativo',
  'nenhuma receita usa': 'nenhuma receita usa esta matéria-prima',
  'previsao incompleta': 'previsão de produção incompleta',
  'sem consumo diario conhecido': 'sem consumo diário conhecido',
  'nao consumida hoje': 'não consumida hoje',
  'cobertura nao calculavel': 'cobertura não calculável',
};
export const motivoMateriaPrima = (m: string) =>
  FRASE_MOTIVO[m as PainelOperacionalMateriaPrimaMotivo] ?? m;

export const unidadeDaLinhaSemCobertura = (motivo: string) =>
  (motivo === MOTIVO_SEM_APRESENTACAO ? '—' : unidadeMateriaPrima('apresentacao'));

export function faltamRitmoDe(s: { receitas_sem_ritmo?: string[] }): string {
  const nomes = s.receitas_sem_ritmo;
  if (nomes == null || nomes.length === 0) return '';
  return `falta a previsão de: ${nomes.join(', ')}`;
}

export function numConsumoDia(v: number | null | undefined): string {
  if (!Number.isFinite(v)) return '—';
  const n = v as number;
  if (n === 0) return '0';
  const casas = Math.min(20, Math.max(2, -Math.floor(Math.log10(Math.abs(n))) + 1));
  const saida = n.toLocaleString('pt-BR', { maximumFractionDigits: casas });
  return saida === '-0' ? '0' : saida;
}

export function BlocoCoberturaMateriaPrima({ materiaPrima }: {
  materiaPrima: PainelOperacionalResposta['materia_prima'];
}) {
  const estado = estadoDaCoberturaMateriaPrima(materiaPrima);
  return (
    <Panel title="Cobertura de Matéria-Prima"
      tag={materiaPrima ? `${formatarNumero(materiaPrima.resumo.calculados)} de ${formatarNumero(materiaPrima.resumo.itens)} com cobertura calculada` : undefined}
      sub="Dias de cobertura = estoque informado (em apresentação, o saco/pacote de compra) ÷ consumo diário projetado pela produção">
      {estado === 'falha_de_carga' && (
        <div className="empty">Não foi possível carregar a cobertura de matéria-prima agora.</div>
      )}
      {estado === 'nada_cadastrado' && (
        <div className="empty">Nenhuma matéria-prima cadastrada.</div>
      )}
      {estado === 'com_dado' && materiaPrima && (
        <>
          {materiaPrima.linhas.length > 0 && (
            <div className="plan-wrap">
              <table className="plan">
                <thead>
                  <tr>
                    <th className="rotulo">Matéria-prima</th>
                    <th className="num">Estoque</th>
                    <th className="rotulo">Unidade</th>
                    <th className="num">Consumo/dia</th>
                    <th className="num">Dias de cobertura</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {materiaPrima.linhas.map((l) => (
                    <tr key={`${l.materia_prima_id}-${l.semente_tipo ?? ''}`}>
                      <td className="rotulo">{l.materia_prima}</td>
                      <td className="num">{formatarNumero(l.estoque_informado)}</td>
                      <td className="rotulo">{unidadeMateriaPrima(l.unidade)}</td>
                      <td className="num">{numConsumoDia(l.consumo_apresentacao_dia)}</td>
                      <td className="num">{formatarNumero(l.dias_de_cobertura)}</td>
                      <td><Pill tone={TONE_SEMAFORO[l.semaforo] ?? 'neutral'}>{l.semaforo.toLowerCase()}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {materiaPrima.sem_cobertura.length > 0 && (
            <div className="plan-wrap">
              <h4 className="rotulo">Fora do cálculo · {materiaPrima.sem_cobertura.length}</h4>
              <table className="plan">
                <thead>
                  <tr>
                    <th className="rotulo">Matéria-prima</th>
                    <th className="num">Estoque informado</th>
                    <th className="rotulo">Unidade</th>
                    <th className="rotulo">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {materiaPrima.sem_cobertura.map((s) => (
                    <tr key={`${s.materia_prima_id}-${s.semente_tipo ?? ''}`}>
                      <td className="rotulo">{s.materia_prima}</td>
                      <td className="num">{formatarNumero(s.estoque_informado)}</td>
                      <td className="rotulo">{unidadeDaLinhaSemCobertura(s.motivo)}</td>
                      <td className="rotulo">
                        {motivoMateriaPrima(s.motivo)}
                        {(s.receitas_sem_ritmo?.length ?? 0) > 0 && (
                          <div>
                            <small style={{ color: 'var(--ink-soft)' }}>{faltamRitmoDe(s)}</small>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

export const COLUNAS_IDENTIDADE_INSUMO = ['Categoria', 'Descrição', 'Especificação', 'Unidade'] as const;

export function identidadeDoInsumo(
  i: { categoria: string | null; descricao: string | null; especificacao: string | null; unidade: string | null },
): string[] {
  return [i.categoria ?? '—', i.descricao ?? '—', i.especificacao ?? '—', i.unidade ?? '—'];
}

export function BlocoOutrosInsumos({ insumos }: { insumos: PainelOperacionalResposta['insumos'] }) {
  return (
    <Panel title="Alertas de Outros Insumos"
      tag={`${formatarNumero(insumos.resumo.calculados)} de ${formatarNumero(insumos.resumo.itens)} com cobertura calculada`}
      sub="EPI, limpeza, higiene, copa e materiais: dias de cobertura = estoque atual ÷ consumo médio diário">
      {insumos.linhas.length === 0 ? (
        <div className="empty">Nenhum insumo com estoque e consumo cadastrados.</div>
      ) : (
        <div className="plan-wrap">
          <table className="plan">
            <thead>
              <tr>
                {COLUNAS_IDENTIDADE_INSUMO.map((c) => <th className="rotulo" key={c}>{c}</th>)}
                <th className="num">Estoque</th><th className="num">Consumo médio/mês</th>
                <th className="num">Dias de cobertura</th><th></th>
              </tr>
            </thead>
            <tbody>
              {insumos.linhas.map((i) => (
                <tr key={i.id}>
                  {identidadeDoInsumo(i).map((c, k) => (
                    <td className="rotulo" key={COLUNAS_IDENTIDADE_INSUMO[k]}>{c}</td>
                  ))}
                  <td className="num">{formatarNumero(i.estoque_atual)}</td>
                  <td className="num">{formatarNumero(i.consumo_medio_mensal)}</td>
                  <td className="num">{formatarNumero(i.dias_de_cobertura)}</td>
                  <td><Pill tone={TONE_SEMAFORO[i.semaforo] ?? 'neutral'}>{i.semaforo.toLowerCase()}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {insumos.sem_consumo.length > 0 && (
        <div className="obs-tela">
          <b>{formatarNumero(insumos.sem_consumo.length)} itens sem estoque ou consumo médio
          cadastrado</b> ficam fora da conta: dividir por zero daria cobertura infinita e o item
          apareceria verde para sempre.
        </div>
      )}
    </Panel>
  );
}
