import { brl, num, pct } from '../api/client';
import type { ChaveDaVariedade, EconomiaDoRecorte, ExecutivoResposta } from '../api/gerencial';
import { fraseDoQuadroAfetado } from './AvisoDaFolha';
import { ComoECalculado } from './ComoECalculado';
import { pontoDeEquilibrioDoPeriodo } from './PontoDeEquilibrioDaFrente';
import { colunasDaVariedade, divisaoDaReceitaPorEspecie, FRASE_RECEITA_NAO_DIVIDIDA, resultadoPorEspecieConfiavel, rotuloDoPeriodo, subPorEspecie } from './EscadaDoAno';
import { Panel } from './ui';

export const FRASE_DO_PORTAO_DA_BANDEJA = 'Bandejas por espécie, custo e margem de contribuição por bandeja entram depois da decisão de como o custo de cada espécie se divide entre as bandejas e de como cada produto da embalagem se liga à espécie.';

const FRASE_DO_KG = 'Preço e custo por kg só aparecem com todos os meses do período carregados.';
const periodoCompleto = (ex: ExecutivoResposta) => (ex.meses_sem_fato?.length ?? 0) === 0;

const fraseDaDivisao = (ex: ExecutivoResposta) => {
  if (resultadoPorEspecieConfiavel(ex.escada)) return null;
  return divisaoDaReceitaPorEspecie(ex.escada) === 'PARCIAL' ? subPorEspecie(ex.escada) : FRASE_RECEITA_NAO_DIVIDIDA;
};

const FRASE_DA_FOLHA = `⚠ ${fraseDoQuadroAfetado('O resultado e a economia por espécie')}`;

export function situacaoEmTexto(e: EconomiaDoRecorte): string {
  switch (e.situacao) {
    case 'ECONOMIA_RUIM': return 'Economicamente ruim: cada venda perde dinheiro antes dos fixos (preço ou custo variável)';
    case 'ABAIXO_DA_ESCALA': return `Abaixo da escala: faltam ${brl(e.falta_para_equilibrio)} de receita para o ponto de equilíbrio`;
    case 'ACIMA_DO_EQUILIBRIO': return 'Acima do ponto de equilíbrio';
    case 'SEM_CUSTO_FIXO': return 'Sem custo fixo próprio: não há ponto de equilíbrio a calcular';
    case 'CLASSIFICACAO_INCOMPLETA': return `Não calculada: ${e.linhas_pendentes} conta(s) sem fixo ou variável definido`;
    default: return 'Sem receita própria no período';
  }
}

export interface CicloDaEspecie { tipo: string; kgAno: number | null; contaminacao: number | null; aproveitamento: number | null; kgPorBloco: number | null; eficiencia: number | null }

export interface LinhaDaEspecie {
  chave: ChaveDaVariedade; nome: string;
  resultado: number | null; margem_pct: number | null;
  kg: number | null; preco_por_kg: number | null; custo_por_kg: number | null;
  economia: EconomiaDoRecorte | null; ciclo: CicloDaEspecie | null;
}

export function linhasDaEconomia(ex: ExecutivoResposta, ciclo: CicloDaEspecie[]): LinhaDaEspecie[] {
  if (!ex.economia) return [];
  const dividida = resultadoPorEspecieConfiavel(ex.escada);
  const completo = periodoCompleto(ex);
  const doCiclo = new Map(ciclo.map((c) => [c.tipo, c]));
  const porKg = (reais: number, kg: number | null) => (completo && kg ? (Math.round(Math.round(reais * 100) / kg) / 100) || 0 : null);
  return colunasDaVariedade(ex.escada).map(({ chave, rotulo }) => {
    const e = ex.escada.por_variedade![chave]!;
    const c = doCiclo.get(chave) ?? null;
    const kg = c?.kgAno ?? null;
    const custos = 0 - (e.custos_diretos + e.despesas_diretas + e.despesas_compartilhadas);
    return {
      chave, nome: rotulo,
      resultado: dividida ? e.resultado_operacional : null,
      margem_pct: dividida ? e.margem_operacional_pct : null,
      kg,
      preco_por_kg: dividida && e.receita_liquida > 0 ? porKg(e.receita_liquida, kg) : null,
      custo_por_kg: porKg(custos, kg),
      economia: dividida ? ex.economia!.por_especie[chave] ?? null : null,
      ciclo: c,
    };
  });
}

export function composicaoDaEspecie(ex: ExecutivoResposta, chave: ChaveDaVariedade) {
  const soma = new Map<string, { linha_id: string; codigo_oficial: string | null; rotulo: string; cent: number }>();
  for (const m of ex.serie_mensal) {
    for (const l of m.linhas_por_chave?.[chave] ?? []) {
      if (l.grupo < 3 || l.grupo > 5) continue;
      const a = soma.get(l.linha_id) ?? { linha_id: l.linha_id, codigo_oficial: l.codigo_oficial ?? null, rotulo: l.rotulo, cent: 0 };
      a.cent -= Math.round(l.valor * 100);
      soma.set(l.linha_id, a);
    }
  }
  return [...soma.values()].filter((l) => l.cent !== 0).sort((a, b) => b.cent - a.cent)
    .map(({ cent, ...l }) => ({ ...l, valor: cent / 100 }));
}

export function EconomiaPorEspecie({ ex, ciclo }: { ex: ExecutivoResposta; ciclo: CicloDaEspecie[] }) {
  const linhas = linhasDaEconomia(ex, ciclo);
  if (linhas.length === 0) return null;
  const divisao = fraseDaDivisao(ex);
  return (
    <Panel title={`Por que cada espécie dá o resultado que dá: ${rotuloDoPeriodo(ex.periodo)}`} id="economia-por-especie"
      sub="Uma linha por espécie: resultado, margem, volume e a situação contra o ponto de equilíbrio. O porquê de cada número está em Ver detalhamento por espécie.">
      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>Espécie</th><th className="num">Resultado operacional</th><th className="num">Margem operacional</th>
              <th className="num">Custo por bandeja</th><th className="num">Margem de contribuição por bandeja</th>
              <th className="num">Volume (kg)</th><th className="num">Bandejas</th><th>Situação contra o ponto de equilíbrio</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.chave}>
                <td><b>{l.nome}</b></td>
                <td className="num">{l.resultado == null ? '—' : brl(l.resultado)}</td>
                <td className="num">{pct(l.margem_pct)}</td>
                <td className="num">—</td><td className="num">—</td>
                <td className="num">{num(l.kg, 1)}</td>
                <td className="num">—</td>
                <td>{l.economia ? situacaoEmTexto(l.economia) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ex.folha_pendente?.length ? <p className="obs-tela">{FRASE_DA_FOLHA}</p> : null}
      <p className="obs-tela">{FRASE_DO_PORTAO_DA_BANDEJA}</p>
      {divisao && <p className="obs-tela">{divisao}</p>}
      {!periodoCompleto(ex) && <p className="obs-tela">{FRASE_DO_KG}</p>}
      <ComoECalculado chave="situacao_equilibrio"
        extra="Os custos fixos de cada espécie são os direcionados ou rateados a ela pela metodologia do fato; a estrutura que não é rateada fica fora. Volume em kg colhidos no mesmo período, por data da colheita. A margem de contribuição e o ponto de equilíbrio contam os impostos operacionais classificados como variáveis ou fixos, quando chegam à espécie; o resultado operacional e a composição do custo não os contam." />
    </Panel>
  );
}

export function DetalheDasEspecies({ ex, ciclo, rotuloCiclo }: { ex: ExecutivoResposta; ciclo: CicloDaEspecie[]; rotuloCiclo: string }) {
  const linhas = linhasDaEconomia(ex, ciclo);
  if (linhas.length === 0) return null;
  const divisao = fraseDaDivisao(ex);
  return (
    <div className="detalhe-das-especies">
      {ex.folha_pendente?.length ? <p className="obs-tela">{FRASE_DA_FOLHA}</p> : null}
      {divisao && <p className="obs-tela">{divisao}</p>}
      {!periodoCompleto(ex) && <p className="obs-tela">{FRASE_DO_KG}</p>}
      {linhas.map((l) => {
        const comp = composicaoDaEspecie(ex, l.chave);
        const total = Math.round(comp.reduce((s, c) => s + Math.round(c.valor * 100), 0)) / 100;
        const e = l.economia;
        return (
          <details key={l.chave} className="detalhe-da-especie">
            <summary>{l.nome}</summary>
            <ul className="obs-tela">
              {l.preco_por_kg != null && <li>{`Preço médio (receita ÷ kg colhidos): ${brl(l.preco_por_kg)} por kg`}</li>}
              {l.custo_por_kg != null && <li>{`Custo (custos e despesas ÷ kg colhidos): ${brl(l.custo_por_kg)} por kg`}</li>}
              {e?.margem_contribuicao != null && <li>{`Margem de contribuição: ${brl(e.margem_contribuicao)} (${pct(e.margem_contribuicao_pct)}), com ${brl(e.variaveis)} de custos variáveis e ${brl(e.fixos)} de custos fixos`}</li>}
              {e?.ponto_equilibrio != null && <li>{`${pontoDeEquilibrioDoPeriodo(ex.periodo).nome}: ${brl(e.ponto_equilibrio)}`}</li>}
              {l.ciclo && <li>{`Kg por bloco aberto: ${num(l.ciclo.kgPorBloco, 2)} · Eficiência (kg por bloco produzido): ${num(l.ciclo.eficiencia, 2)}, nos lotes de ${rotuloCiclo}`}</li>}
              {l.ciclo && <li>{`Contaminação ${pct(l.ciclo.contaminacao == null ? null : l.ciclo.contaminacao * 100)} e aproveitamento ${pct(l.ciclo.aproveitamento == null ? null : l.ciclo.aproveitamento * 100)}, nos lotes de ${rotuloCiclo}`}</li>}
            </ul>
            {comp.length > 0 && (
              <table className="tbl">
                <thead><tr><th>Linha da DRE (custos e despesas)</th><th className="num">No período</th></tr></thead>
                <tbody>
                  {comp.map((c) => <tr key={c.linha_id}><td>{c.codigo_oficial ? `${c.rotulo} (${c.codigo_oficial})` : c.rotulo}</td><td className="num">{brl(c.valor)}</td></tr>)}
                  <tr className="total"><td><b>TOTAL</b></td><td className="num"><b>{brl(total)}</b></td></tr>
                </tbody>
              </table>
            )}
            <ComoECalculado chave="margem_contribuicao" />
            <p className="obs-tela">Origem: DRE gerencial por competência (base do ERP, rateada por negócio e por espécie), kg colhidos da Jornada do Cogumelo por data da colheita, contaminação e aproveitamento dos lotes por data do lote.</p>
          </details>
        );
      })}
    </div>
  );
}
