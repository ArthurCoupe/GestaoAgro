import { brlK, num, pct } from '../../api/client';
import { ehVariedade, type AtividadeChave, type ExecutivoContaminacao, type ExecutivoResposta, type LinhaComposicao } from '../../api/gerencial';
import { foraDoRecorte, temMovimento } from '../../pages/Dashboard';
import type { FrenteDaGestao } from '../../pages/GestaoDoResultado';
import { perdasAcimaDaMeta } from '../../pages/PorQueEstamosAqui';
import type { ContaDaDre } from '../abrirNaDre';
import { fraseDoQuadroAfetado, idsPendentes } from '../AvisoDaFolha';
import { ComoECalculado } from '../ComoECalculado';
import { produtosDaProducao } from '../GraficoDeProdutos';
import { Panel } from '../ui';
import { distanciaEmReais } from './ResumoDaMeta';

export type TipoDoItem = 'NEGOCIO' | 'PRODUTO' | 'CUSTO' | 'DESPESA' | 'CONTAMINACAO';
export interface ItemOndeAgir {
  tipo: TipoDoItem;
  chave: string;
  nome: string;
  conta: ContaDaDre | null;
  impacto: number;
  detalhe: string;
  tendencia: 'PIOROU' | 'MELHOROU' | 'IGUAL' | null;
}

export const ID_DO_RESULTADO_POR_NEGOCIO = 'grafico-quem-forma';
export const ID_DO_RESULTADO_POR_PRODUTO = 'grafico-produtos';

const NEGOCIOS: AtividadeChave[] = ['PRODUCAO_COGUMELO', 'PIMENTAO', 'REVENDA'];
const COM_CONTAMINACAO: FrenteDaGestao[] = ['consolidado', 'producao', 'cogumelo'];
const ORDEM_DO_TIPO: TipoDoItem[] = ['NEGOCIO', 'PRODUTO', 'CUSTO', 'DESPESA', 'CONTAMINACAO'];
const cent = (v: number) => Math.round(v * 100);

export const MERCADORIA_PARA_REVENDA = new Set(['L048']);

const tendencia = (atual: number, anterior: number | null): ItemOndeAgir['tendencia'] =>
  (anterior == null ? null : atual > anterior ? 'PIOROU' : atual < anterior ? 'MELHOROU' : 'IGUAL');

const contaminacaoMedida = (c: ExecutivoContaminacao | null | undefined) =>
  c != null && c.taxa_pct != null && c.meta_pct != null && c.custo_medio_bloco != null;

const detalheDaParte = (receita: number, resultado: number, margem: number | null) =>
  (receita > 0
    ? `resultado ${resultadoEmReais(resultado)}, ${margem == null ? 'sem margem' : `margem ${pct(margem)}`}`
    : `sem receita positiva no período: resultado ${resultadoEmReais(resultado)}, sem margem`);
const resultadoEmReais = (v: number) => distanciaEmReais(v).replace(/^-R\$\s/, 'R$ -');

function maiorPrejuizo<T>(partes: T[], resultado: (p: T) => number): { p: T; c: number } | null {
  return partes.map((p) => ({ p, c: -cent(resultado(p)) })).filter((x) => x.c > 0).sort((x, y) => y.c - x.c)[0] ?? null;
}

export const nomeDaLinha = (l: Pick<LinhaComposicao, 'rotulo' | 'codigo_oficial'>) => `${l.rotulo ?? 'Linha sem nome'}${l.codigo_oficial ? ` (${l.codigo_oficial})` : ''}`;

function maiorLinha(linhas: LinhaComposicao[], pendentes: Set<string>, fora: Set<string> = new Set()): LinhaComposicao | null {
  return [...linhas]
    .filter((l) => l.valor < 0 && !pendentes.has(String(l.linha_id)) && !fora.has(l.codigo_oficial ?? ''))
    .sort((a, b) => a.valor - b.valor || (a.codigo_oficial ?? '').localeCompare(b.codigo_oficial ?? ''))[0] ?? null;
}

export const comMercadoriaParaRevenda = (ex: ExecutivoResposta) =>
  ex.composicao.custos.some((l) => MERCADORIA_PARA_REVENDA.has(l.codigo_oficial ?? '') && cent(l.valor) < 0);

export function ondeAgirPrimeiro(ex: ExecutivoResposta, frente: FrenteDaGestao, anterior: ExecutivoResposta | null = null): ItemOndeAgir[] {
  const itens: ItemOndeAgir[] = [];
  const pendencia = (ex.folha_pendente?.length ?? 0) + (anterior?.folha_pendente?.length ?? 0) > 0;

  const negocios = ex.atividades.filter((a) => NEGOCIOS.includes(a.chave) && temMovimento(a) && !foraDoRecorte(ex, a));
  const negocio = negocios.length > 1 ? maiorPrejuizo(negocios, (a) => a.resultado) : null;
  if (negocio) {
    const { p: a, c } = negocio;
    const ant = anterior?.atividades.find((x) => x.chave === a.chave);
    itens.push({
      tipo: 'NEGOCIO', chave: a.chave, nome: a.rotulo, conta: null, impacto: c / 100,
      detalhe: detalheDaParte(a.receita, a.resultado, a.margem_pct),
      tendencia: pendencia ? null : tendencia(c, ant && temMovimento(ant) ? -cent(ant.resultado) : null),
    });
  }

  const especies = produtosDaProducao(ex.escada, frente).filter((p) => !p.resto && ehVariedade(p.chave));
  const especie = especies.length > 1 ? maiorPrejuizo(especies, (p) => p.resultado) : null;
  if (especie) {
    const { p, c } = especie;
    const ant = anterior ? produtosDaProducao(anterior.escada, frente).find((x) => x.chave === p.chave) : undefined;
    itens.push({
      tipo: 'PRODUTO', chave: p.chave, nome: p.rotulo, conta: null, impacto: c / 100,
      detalhe: detalheDaParte(p.receita, p.resultado, p.margem),
      tendencia: pendencia ? null : tendencia(c, ant ? -cent(ant.resultado) : null),
    });
  }

  const pendentes = idsPendentes(ex.folha_pendente);
  const pendentesNoAnterior = idsPendentes(anterior?.folha_pendente);
  for (const [tipo, bloco] of [['CUSTO', 'custos'], ['DESPESA', 'despesas']] as const) {
    const l = maiorLinha(ex.composicao[bloco], pendentes, bloco === 'custos' ? MERCADORIA_PARA_REVENDA : undefined);
    if (!l) continue;
    const c = -cent(l.valor);
    const ant = anterior?.composicao[bloco].find((x) => String(x.linha_id) === String(l.linha_id));
    itens.push({
      tipo, chave: String(l.linha_id), nome: nomeDaLinha(l), conta: { linha_id: String(l.linha_id), codigo_oficial: l.codigo_oficial },
      impacto: c / 100, detalhe: `${brlK(c / 100)} no período`,
      tendencia: anterior && !pendentesNoAnterior.has(String(l.linha_id)) ? tendencia(c, ant ? -cent(ant.valor) : 0) : null,
    });
  }

  const perdas = COM_CONTAMINACAO.includes(frente) ? perdasAcimaDaMeta(ex.contaminacao) : null;
  if (perdas) {
    const c = cent(perdas.reais);
    itens.push({
      tipo: 'CONTAMINACAO', chave: 'CONTAMINACAO', nome: 'Contaminação acima da meta', conta: null, impacto: perdas.reais,
      detalhe: `taxa de ${pct(perdas.taxa)} contra a meta de ${pct(perdas.meta)}: ${num(perdas.blocos)} blocos acima da meta, ${brlK(perdas.reais)} em perdas`,
      tendencia: !pendencia && anterior && contaminacaoMedida(anterior.contaminacao)
        ? tendencia(c, cent(perdasAcimaDaMeta(anterior.contaminacao)?.reais ?? 0)) : null,
    });
  }

  return itens
    .filter((i) => cent(i.impacto) > 0)
    .sort((a, b) => cent(b.impacto) - cent(a.impacto) || ORDEM_DO_TIPO.indexOf(a.tipo) - ORDEM_DO_TIPO.indexOf(b.tipo));
}

const TITULO: Record<TipoDoItem, string> = {
  NEGOCIO: 'Negócio que mais destruiu resultado',
  PRODUTO: 'Produto ou espécie que mais impactou negativamente',
  CUSTO: 'Custo que mais pressionou',
  DESPESA: 'Despesa que mais pressionou',
  CONTAMINACAO: 'Fator operacional',
};
const FRASE_DA_TENDENCIA = { PIOROU: 'Piorou contra', MELHOROU: 'Melhorou contra', IGUAL: 'Igual a' } as const;

export function OndeAgirPrimeiro({ ex, frente, anterior = null, rotuloAnterior, onAbrirConta, onIr }: {
  ex: ExecutivoResposta; frente: FrenteDaGestao;
  anterior?: ExecutivoResposta | null; rotuloAnterior?: string;
  onAbrirConta?: (conta: ContaDaDre) => void;
  onIr?: (destino: 'producao') => void;
}) {
  const itens = ondeAgirPrimeiro(ex, frente, anterior);
  const rolar = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const botao = (texto: string, onClick: () => void) => <button type="button" className="gr-toggle" onClick={onClick}>{texto}</button>;
  const acao = (i: ItemOndeAgir) => {
    if (i.tipo === 'NEGOCIO') return botao('Ver o resultado por negócio', rolar(ID_DO_RESULTADO_POR_NEGOCIO));
    if (i.tipo === 'PRODUTO') return botao('Ver o resultado por produto', rolar(ID_DO_RESULTADO_POR_PRODUTO));
    if (i.tipo === 'CONTAMINACAO') return onIr ? botao('Ver no Painel da Produção', () => onIr('producao')) : null;
    const conta = i.conta;
    return onAbrirConta && conta ? botao('Abrir a conta na DRE', () => onAbrirConta(conta)) : null;
  };
  const comTendencia = anterior != null && rotuloAnterior != null;
  const algumaTendencia = comTendencia && itens.some((i) => i.tendencia != null);
  const comPendencia = idsPendentes(ex.folha_pendente).size > 0;
  const frase = (d: string) => `${d.charAt(0).toUpperCase()}${d.slice(1)}`;
  return (
    <Panel title="Onde agir primeiro?" tag={ex.etiqueta} id="gestao-onde-agir"
      sub={`O que mais pesa contra o resultado no período, do maior impacto em R$ para o menor${algumaTendencia ? `; piorou ou melhorou contra ${rotuloAnterior}` : ''}.`}>
      {itens.length === 0 ? <p className="obs-tela">Nada pesa contra o resultado no período.</p> : (
        <ol className="onde-agir">
          {itens.map((i) => (
            <li key={i.tipo}>
              <span className="onde-agir-tipo">{TITULO[i.tipo]}</span>: <b>{i.nome}</b>
              {`. ${frase(i.detalhe)}.${comTendencia && i.tendencia ? ` ${FRASE_DA_TENDENCIA[i.tendencia]} ${rotuloAnterior}.` : ''} `}
              {acao(i)}
            </li>
          ))}
        </ol>
      )}
      {comPendencia && itens.some((i) => i.tipo === 'NEGOCIO' || i.tipo === 'PRODUTO')
        && <p className="obs-tela">{`⚠ ${fraseDoQuadroAfetado('Resultado e margem dos itens de negócio e de produto')}`}</p>}
      {comPendencia && <p className="obs-tela">As linhas da folha ainda não apropriada ficam fora dos itens de custo e de despesa.</p>}
      {comMercadoriaParaRevenda(ex) && <p className="obs-tela">A compra de cogumelos para revenda fica fora do custo que mais pressionou: é o custo do que a Revenda vende, e a margem dela está no Painel da Revenda.</p>}
      {rotuloAnterior != null && (anterior?.folha_pendente?.length ?? 0) > 0
        && <p className="obs-tela">{`Sem piorou ou melhorou nos itens afetados: ${rotuloAnterior} tem folha ainda não apropriada.`}</p>}
      <ComoECalculado chave="onde_agir" />
    </Panel>
  );
}
