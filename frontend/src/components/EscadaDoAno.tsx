import { useState, type ReactNode } from 'react';
import { pct } from '../api/client';
import type { VisaoNova } from '../api/dreNova';
import { MESES_ANO } from '../api/constantes';
import { CAMPOS_DA_ESCADA, ehVariedade, ORDEM_DA_VARIEDADE, ROTULO_DA_VARIEDADE, type AtividadeChave, type ChaveDaEscadaPorAtividade, type ChaveDaVariedade, type Escada, type EscadaPorAtividade, type ExecutivoResposta, type PeriodoDoDirecionador, type Regime } from '../api/gerencial';
import type { AlvoComposicao } from './Composicao';
import { EscadaMensal, subMensal, type ChaveDaEscada } from './EscadaMensal';
import { EscadaPorSegmento } from './EscadaPorSegmento';
import { periodoDoMes } from './ui';

export type ExecutivoDaEscada = Pick<ExecutivoResposta, 'periodo' | 'visao' | 'etiqueta' | 'escada' | 'serie_mensal' | 'limiares_alerta' | 'atividades' | 'direcionador_especie' | 'folha_pendente'>;

export interface Coluna { chave: ChaveDaEscadaPorAtividade; rotulo: string }

const ORDEM: AtividadeChave[] = ['PRODUCAO_COGUMELO', 'PIMENTAO', 'PRODUCAO_SEM_QUEBRA', 'REVENDA', 'CORPORATIVO', 'NAO_RATEADO'];
const DE_PRODUCAO: AtividadeChave[] = ['PRODUCAO_COGUMELO', 'PIMENTAO'];

const temMovimentoNaEscada = (e: Escada) => CAMPOS_DA_ESCADA.some((c) => c.tipo !== 'pct' && e[c.campo] !== 0);

export function colunasDaEscada(ex: Pick<ExecutivoDaEscada, 'visao' | 'escada' | 'atividades'>): { colunas: Coluna[]; rotuloTotal: string } {
  const rotulo = (chave: AtividadeChave) => ex.atividades.find((a) => a.chave === chave)?.rotulo ?? chave;
  const mov = (chave: ChaveDaEscadaPorAtividade) => temMovimentoNaEscada(ex.escada.por_atividade[chave]);
  const chaves: AtividadeChave[] = ex.visao === 'consolidado' ? ORDEM.filter(mov)
    : ex.visao === 'producao' ? [...DE_PRODUCAO, ...(mov('PRODUCAO_SEM_QUEBRA') ? ['PRODUCAO_SEM_QUEBRA' as const] : [])]
      : ['REVENDA'];
  const rotuloTotal = ex.visao === 'consolidado' ? 'Consolidado' : ex.visao === 'producao' ? 'Produção' : 'Revenda';
  const subtotal: Coluna[] = ex.visao === 'consolidado' && mov('PRODUCAO') ? [{ chave: 'PRODUCAO', rotulo: 'Produção' }] : [];
  return { colunas: [...subtotal, ...chaves.map((chave) => ({ chave, rotulo: rotulo(chave) }))], rotuloTotal };
}

export interface CamadasDoConsolidado { executivo: Coluna[]; producao: Coluna[]; naoAtribuidos: Coluna[] }

export function camadasDoConsolidado(ex: Pick<ExecutivoDaEscada, 'escada' | 'atividades'>): CamadasDoConsolidado {
  const rotulo = (chave: AtividadeChave) => ex.atividades.find((a) => a.chave === chave)?.rotulo ?? chave;
  const mov = (chave: ChaveDaEscadaPorAtividade) => temMovimentoNaEscada(ex.escada.por_atividade[chave]);
  const col = (chave: AtividadeChave): Coluna => ({ chave, rotulo: rotulo(chave) });
  return {
    executivo: [{ chave: 'PRODUCAO', rotulo: 'Produção' }, col('REVENDA')],
    producao: [...DE_PRODUCAO, ...(mov('PRODUCAO_SEM_QUEBRA') ? ['PRODUCAO_SEM_QUEBRA' as const] : [])].map(col),
    naoAtribuidos: (['CORPORATIVO', 'NAO_RATEADO'] as const).filter(mov).map(col),
  };
}

export function colunasDaVariedade(e: EscadaPorAtividade): Array<{ chave: ChaveDaVariedade; rotulo: string }> {
  const pv = e.por_variedade;
  if (!pv) return [];
  return ORDEM_DA_VARIEDADE.filter((v) => pv[v] != null && temMovimentoNaEscada(pv[v])).map((chave) => ({ chave, rotulo: ROTULO_DA_VARIEDADE[chave] }));
}

export function receitaDivididaPorEspecie(e: EscadaPorAtividade): boolean {
  if (e.por_atividade.PRODUCAO_COGUMELO.receita_liquida === 0) return true;
  const pv = e.por_variedade;
  if (!pv) return true;
  return (['SH', 'SP', 'SB', 'SS'] as const).some((v) => (pv[v]?.receita_liquida ?? 0) !== 0);
}

const VERBO = (v: number) => (v < 0 ? 'consome resultado' : v > 0 ? 'gera resultado' : 'fica no zero');
export function leituraExecutiva(e: EscadaPorAtividade): string {
  const t = e.total.resultado_operacional;
  const cons = t < 0 ? 'fica negativo' : t > 0 ? 'permanece positivo' : 'fica no zero';
  return `A Produção ${VERBO(e.por_atividade.PRODUCAO.resultado_operacional)}; a Revenda ${VERBO(e.por_atividade.REVENDA.resultado_operacional)}; o Consolidado ${cons}.`;
}

const subCamada1 = (recorte: string, temNaoAtribuido: boolean) => `A DRE linha a linha, ${recorte}, na primeira leitura: Produção, Revenda`
  + (temNaoAtribuido ? ', o que ainda não é de nenhum negócio' : '') + ' e o Consolidado, que em cada linha de valor é a soma das colunas.'
  + (temNaoAtribuido ? ' A Estrutura não rateada é o corporativo que nenhum rateio distribuiu; "ainda sem divisão por negócio" é o que a planilha de rateios não alcançou.' : '') + ' Clique em Produção para abrir Cogumelo e Pimentão. Valores em reais, com o sinal (custos e despesas negativos).';
const SUB_CLIQUE = ' Clique num negócio, em Receita bruta, Custos ou Despesas para abrir a composição; totais e margens não abrem.';

export const FRASE_RECEITA_NAO_DIVIDIDA = 'Enquanto a receita não estiver dividida por espécie, resultado e margem aparecem só no total do Cogumelo.';

export const SUB_POR_ESPECIE = 'Só o custo é dividido por espécie, pelo direcionador de cada linha (kg produzido, bandeja embalada ou venda da espécie). A receita e as linhas que a planilha de rateios ainda não divide por espécie ficam em "sem espécie", assim como o mês sem colheita ou bandeja lançada ou sem o relatório de vendas. A soma das espécies é sempre o total do Cogumelo. ' + FRASE_RECEITA_NAO_DIVIDIDA;

export function divisaoDaReceitaPorEspecie(e: EscadaPorAtividade): 'NADA' | 'INTEIRA' | 'PARCIAL' {
  const cogumelo = e.por_atividade.PRODUCAO_COGUMELO?.receita_bruta ?? 0;
  const sem = e.por_variedade?.SEM_ESPECIE.receita_bruta ?? cogumelo;
  if (cogumelo <= 0 || sem >= cogumelo * 0.99) return 'NADA';
  return sem <= cogumelo * 0.01 ? 'INTEIRA' : 'PARCIAL';
}

export function resultadoPorEspecieConfiavel(e: EscadaPorAtividade): boolean {
  return receitaDivididaPorEspecie(e) && (e.por_atividade.PRODUCAO_COGUMELO.receita_liquida === 0 || divisaoDaReceitaPorEspecie(e) === 'INTEIRA');
}

export function subPorEspecie(e: EscadaPorAtividade): string {
  const divisao = divisaoDaReceitaPorEspecie(e);
  if (divisao === 'NADA') return SUB_POR_ESPECIE;
  if (divisao === 'INTEIRA') {
    return 'A receita de cada espécie vem da venda dos produtos EX daquela espécie nos relatórios Produtos Vendidos da Aurora e da Exemplo Alimentos; o custo, pelo direcionador de cada linha. O que o mês não permite dividir fica em "sem espécie". A soma das espécies é sempre o total do Cogumelo.';
  }
  const cogumelo = e.por_atividade.PRODUCAO_COGUMELO?.receita_bruta ?? 0;
  const sem = e.por_variedade?.SEM_ESPECIE.receita_bruta ?? cogumelo;
  return `Parte da receita já está dividida por espécie (venda dos produtos EX da Aurora e da Exemplo Alimentos) e ${pct(Math.round((sem / cogumelo) * 100))} dela ainda está em "sem espécie", nos meses sem o relatório de vendas das duas empresas. O custo segue o direcionador de cada linha. A soma das espécies é sempre o total do Cogumelo.`;
}

export const ROTULO_DO_DIRECIONADOR: Record<string, string> = {
  KG_PRODUZIDOS: 'kg colhido da espécie',
  BANDEJAS_VENDIDAS: 'bandejas vendidas de produção própria',
  BANDEJAS_EMBALADAS: 'bandejas embaladas',
  BANDEJAS_PRODUZIDAS: 'bandejas produzidas',
  BLOCOS_PRODUZIDOS: 'blocos produzidos',
  RECEITA_DA_ESPECIE: 'receita da espécie',
  DIRETO: 'direto na espécie',
  INDEFINIDO: 'sem direcionador definido',
};

const rotuloMes = (aaaaMm: string) => `${(MESES_ANO[Number(aaaaMm.slice(5, 7)) - 1] ?? aaaaMm).toLowerCase()}/${aaaaMm.slice(0, 4)}`;

export function frasesDoDirecionador(periodos: PeriodoDoDirecionador[]): string[] {
  return periodos.map((p) => {
    const quando = p.de === p.ate ? rotuloMes(p.de) : `${rotuloMes(p.de)} a ${rotuloMes(p.ate)}`;
    const partes = p.grupos.map((g) => `${ROTULO_DO_DIRECIONADOR[g.driver] ?? g.driver} em ${g.contas.length} ${g.contas.length === 1 ? 'conta' : 'contas'}`);
    return `${quando}: ${partes.join(', ')}.`;
  });
}

export function DirecionadorDaEspecie({ periodos }: { periodos?: PeriodoDoDirecionador[] | null }) {
  if (!periodos || periodos.length === 0) return null;
  const frases = frasesDoDirecionador(periodos);
  return (
    <div className="obs-tela">
      <div>Direcionador da divisão por espécie em cada período:</div>
      <ul>{frases.map((f) => <li key={f}>{f}</li>)}</ul>
      <details>
        <summary>ver as contas</summary>
        {periodos.map((p, i) => (
          <div key={`${p.de}-${p.ate}`}>
            <strong>{frases[i].split(':')[0]}</strong>
            <ul>{p.grupos.map((g) => (
              <li key={g.driver}>{ROTULO_DO_DIRECIONADOR[g.driver] ?? g.driver}: {g.contas.map((c) => `${c.codigo} ${c.rotulo}`.trim()).join('; ')}</li>
            ))}</ul>
          </div>
        ))}
      </details>
    </div>
  );
}

export type CamadaAberta = 'producao' | 'cogumelo';

export function AcumuladoEmCamadas({ ex, regime, visao = 'consolidado', antes, titulo, recorte = 'no acumulado do período', aberto, onAlternar, onAbrir, pergunta }: {
  ex: ExecutivoDaEscada; regime: Regime;
  visao?: 'consolidado' | 'producao';
  antes?: ReactNode;
  titulo?: string;
  recorte?: string;
  aberto: Record<CamadaAberta, boolean>;
  onAlternar?: (camada: CamadaAberta) => void;
  onAbrir?: (alvo: AlvoComposicao) => void;
  pergunta?: string;
}) {
  const camadas = camadasDoConsolidado(ex);
  const periodo = rotuloDoPeriodo(ex.periodo);
  const toggle = (camada: CamadaAberta, texto: string, expandido: boolean) => (
    <button type="button" className="gr-toggle" aria-expanded={expandido} onClick={() => onAlternar?.(camada)}>
      {texto} <span className="gr-caret">{expandido ? '▾' : '▸'}</span>
    </button>
  );
  const comum = { escada: ex.escada, regime, etiqueta: ex.etiqueta, onAbrir };
  const especies = colunasDaVariedade(ex.escada);
  const rotuloCogumelo = camadas.producao.find((c) => c.chave === 'PRODUCAO_COGUMELO')?.rotulo ?? 'Cogumelo';
  const cabecalhoCogumelo = especies.length > 0 ? {
    PRODUCAO_COGUMELO: (
      <>
        {onAbrir ? <button type="button" className="gr-toggle" onClick={() => onAbrir({ tipo: 'atividade', chave: 'PRODUCAO_COGUMELO' })}>{rotuloCogumelo}</button> : rotuloCogumelo}
        {' '}
        <button type="button" className="gr-toggle" aria-expanded={aberto.cogumelo} aria-label="abrir por espécie" onClick={() => onAlternar?.('cogumelo')}>
          <span className="gr-caret">{aberto.cogumelo ? '▾' : '▸'}</span>
        </button>
      </>
    ),
  } : undefined;
  const porEspecie = especies.length > 0 && aberto.cogumelo && (
    <>
      <EscadaPorSegmento {...comum} colunas={especies} rotuloTotal="Total Cogumelo" total={ex.escada.por_atividade.PRODUCAO_COGUMELO}
        titulo="Ao abrir Cogumelo: por espécie" sub={subPorEspecie(ex.escada)} receitaDividida={receitaDivididaPorEspecie(ex.escada)} />
      <DirecionadorDaEspecie periodos={ex.direcionador_especie} />
    </>
  );
  if (visao === 'producao') {
    const { colunas, rotuloTotal } = colunasDaEscada({ ...ex, visao });
    return (
      <>
        <EscadaPorSegmento {...comum} colunas={colunas} rotuloTotal={rotuloTotal} cabecalho={cabecalhoCogumelo}
          titulo={titulo ?? `Acumulado por Segmento: ${periodo}`} antes={antes} pergunta={pergunta}
          sub={`A DRE linha a linha, ${recorte}: uma coluna por negócio e o total.${cabecalhoCogumelo ? ' Clique em Cogumelo para abrir por espécie.' : ''} Valores em reais, com o sinal (custos e despesas negativos).${onAbrir ? SUB_CLIQUE : ''}`} />
        {porEspecie}
      </>
    );
  }
  return (
    <>
      <EscadaPorSegmento {...comum} colunas={[...camadas.executivo, ...camadas.naoAtribuidos]} rotuloTotal="Consolidado"
        titulo={titulo ?? `Acumulado por Segmento: ${periodo}`} antes={antes} sub={`${subCamada1(recorte, camadas.naoAtribuidos.length > 0)}${onAbrir ? SUB_CLIQUE : ''}`}
        cabecalho={{ PRODUCAO: toggle('producao', 'Produção', aberto.producao) }} pergunta={pergunta}
        rodape={leituraExecutiva(ex.escada)} />
      {aberto.producao && (
        <>
          <EscadaPorSegmento {...comum} colunas={camadas.producao} rotuloTotal="Total Produção" total={ex.escada.por_atividade.PRODUCAO} cabecalho={cabecalhoCogumelo}
            titulo="Ao abrir Produção: de onde vem o resultado" sub={`A mesma escada, só da Produção: Cogumelo, Pimentão e o que ainda está sem divisão por produto; o total é a coluna Produção da tabela acima.${cabecalhoCogumelo ? ' Clique em Cogumelo para abrir por espécie.' : ''}`} />
          {porEspecie}
        </>
      )}
    </>
  );
}

export function rotuloDoPeriodo(periodo: { inicio: string; fim: string }): string {
  const mes = (d: string) => periodoDoMes(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1).rotulo.slice(0, 3).toLowerCase();
  const [ai, af] = [periodo.inicio.slice(0, 4), periodo.fim.slice(0, 4)];
  if (periodo.inicio.slice(0, 7) === periodo.fim.slice(0, 7)) return `${mes(periodo.fim)}/${af}`;
  return ai === af ? `${mes(periodo.inicio)} a ${mes(periodo.fim)}/${af}` : `${mes(periodo.inicio)}/${ai} a ${mes(periodo.fim)}/${af}`;
}

export function escadaDoPeriodo(ex: Pick<ExecutivoDaEscada, 'escada' | 'serie_mensal'>, escolha: string): EscadaPorAtividade | null {
  if (escolha === 'ACUMULADO') return ex.escada;
  return ex.serie_mensal.find((m) => m.mes === escolha)?.escada ?? null;
}

const rotuloDoMes = (mes: string) => rotuloDoPeriodo({ inicio: `${mes}-01`, fim: `${mes}-01` });

export function opcoesDoAcumulado(ex: Pick<ExecutivoDaEscada, 'periodo' | 'serie_mensal'>): Array<{ valor: string; rotulo: string; ok: boolean }> {
  return [
    { valor: 'ACUMULADO', rotulo: `Acumulado do ano (${rotuloDoPeriodo(ex.periodo)})`, ok: true },
    ...ex.serie_mensal.map((s) => ({ valor: s.mes, rotulo: `${rotuloDoMes(s.mes)}${s.escada ? '' : ' (sem apuração)'}`, ok: s.escada != null })),
  ];
}

export function tituloDoAcumulado(periodo: { inicio: string; fim: string }, escolha: string): string {
  return escolha === 'ACUMULADO' ? `Acumulado por Segmento: ${rotuloDoPeriodo(periodo)}` : `Por Segmento: só ${rotuloDoMes(escolha)}`;
}

const DA_VISAO: Record<VisaoNova, string> = { consolidado: 'do consolidado', producao: 'da produção', revenda: 'da revenda' };

export function ytdDaChave(e: EscadaPorAtividade, chave: ChaveDaEscada): Escada {
  if (chave === 'TOTAL') return e.total;
  return ehVariedade(chave) ? e.por_variedade?.[chave] ?? e.total : e.por_atividade[chave];
}

export function EscadaDoAno({ ex, regime, visao, onAbrir, entreAsDuas, escolhaInicial = 'ACUMULADO', perguntaAcumulado, acumulado, semAcumulado = false, semMensal = false }: {
  ex: ExecutivoDaEscada; regime: Regime; visao: VisaoNova;
  acumulado?: ExecutivoDaEscada | null;
  semAcumulado?: boolean;
  onAbrir?: (alvo: AlvoComposicao) => void;
  entreAsDuas?: ReactNode;
  escolhaInicial?: string;
  perguntaAcumulado?: string;
  semMensal?: boolean;
}) {
  const { colunas, rotuloTotal } = colunasDaEscada({ ...ex, visao });
  const periodo = rotuloDoPeriodo(ex.periodo);
  const [escolha, setEscolha] = useState(escolhaInicial);
  const opcoes = visao === 'consolidado' ? [] : opcoesDoAcumulado(ex);
  const escolhaEfetiva = opcoes.some((o) => o.valor === escolha && o.ok) ? escolha : 'ACUMULADO';
  const escadaDoAcumulado = acumulado ? acumulado.escada : escadaDoPeriodo(ex, escolhaEfetiva) ?? ex.escada;
  const mesDoAcumulado = acumulado ? acumulado.periodo.fim.slice(0, 7) : escolhaEfetiva;
  const tituloAcumulado = tituloDoAcumulado(ex.periodo, mesDoAcumulado);
  const recorteAcumulado = mesDoAcumulado === 'ACUMULADO' ? 'no acumulado do período' : `só o mês de ${rotuloDoMes(mesDoAcumulado)}`;
  const seletorDePeriodo = visao === 'consolidado' ? undefined : (
    <p className="obs-tela">
      <select className="chip" aria-label="Período do acumulado" style={{ maxWidth: 260 }} value={escolhaEfetiva} onChange={(e) => setEscolha(e.target.value)}>
        {opcoes.map((o) => <option key={o.valor} value={o.valor} disabled={!o.ok}>{o.rotulo}</option>)}
      </select>
    </p>
  );
  const [chaveCogumelo, setChaveCogumelo] = useState<ChaveDaEscada>('PRODUCAO_COGUMELO');
  const especies = colunasDaVariedade(ex.escada).map((v) => ({ chave: v.chave, rotulo: `Cogumelo · ${v.rotulo}` }));
  const seletorCogumelo = especies.length > 0
    ? { colunas: [{ chave: 'PRODUCAO_COGUMELO' as const, rotulo: 'Cogumelo · todas as espécies' }, ...especies], chave: chaveCogumelo, onChange: setChaveCogumelo }
    : undefined;
  const [aberto, setAberto] = useState<Record<CamadaAberta, boolean>>({ producao: false, cogumelo: false });
  const alternar = (c: CamadaAberta) => setAberto((a) => ({ ...a, [c]: !a[c] }));
  const abrirLancamentos = regime === 'COMPETENCIA' ? { visao: ex.visao, periodo: ex.periodo } : undefined;
  return (
    <>
      {semAcumulado ? null : visao === 'revenda'
        ? <EscadaPorSegmento escada={escadaDoAcumulado} colunas={colunas} rotuloTotal={rotuloTotal} regime={regime} etiqueta={ex.etiqueta}
            titulo={tituloAcumulado} antes={seletorDePeriodo} pergunta={perguntaAcumulado}
            sub={`A DRE linha a linha, ${recorteAcumulado}: uma coluna por negócio e o total. Valores em reais, com o sinal (custos e despesas negativos).${onAbrir ? ' Clique num negócio, em Receita bruta, Custos ou Despesas para abrir a composição; totais e margens não abrem.' : ''}`}
            onAbrir={onAbrir} />
        : <AcumuladoEmCamadas ex={acumulado ?? { ...ex, escada: escadaDoAcumulado }} regime={regime} visao={visao} titulo={tituloAcumulado} antes={seletorDePeriodo} recorte={recorteAcumulado} aberto={aberto} onAlternar={alternar} onAbrir={onAbrir} pergunta={perguntaAcumulado} />}
      {entreAsDuas}
      {semMensal ? null : visao === 'producao' ? (
        <>
          <EscadaMensal serie={ex.serie_mensal} ytd={ex.escada.total} limiares={ex.limiares_alerta} regime={regime} etiqueta={ex.etiqueta}
            titulo={`Evolução mensal da produção: ${periodo}`} sub={subMensal(regime)} lancamentos={abrirLancamentos} folhaPendente={ex.folha_pendente} />
          <EscadaMensal serie={ex.serie_mensal} ytd={ytdDaChave(ex.escada, chaveCogumelo)} limiares={ex.limiares_alerta} regime={regime} etiqueta={ex.etiqueta}
            titulo={`Evolução mensal · Cogumelo: ${periodo}`} sub={`Só o Cogumelo. ${subMensal(regime)}`}
            seletor={seletorCogumelo} chave="PRODUCAO_COGUMELO" id="evolucao-cogumelo" receitaDividida={receitaDivididaPorEspecie(ex.escada)} lancamentos={abrirLancamentos} folhaPendente={ex.folha_pendente} />
          <EscadaMensal serie={ex.serie_mensal} ytd={ex.escada.por_atividade.PIMENTAO} limiares={ex.limiares_alerta} regime={regime} etiqueta={ex.etiqueta}
            titulo={`Evolução mensal · Pimentão: ${periodo}`} sub={`Só o Pimentão. ${subMensal(regime)}`} chave="PIMENTAO" id="evolucao-pimentao" lancamentos={abrirLancamentos} folhaPendente={ex.folha_pendente} />
        </>
      ) : (
        <EscadaMensal serie={ex.serie_mensal} ytd={ex.escada.total} limiares={ex.limiares_alerta} regime={regime} etiqueta={ex.etiqueta}
          titulo={`Evolução mensal ${DA_VISAO[visao]}: ${periodo}`} sub={subMensal(regime)} lancamentos={abrirLancamentos} folhaPendente={ex.folha_pendente} />
      )}
    </>
  );
}
