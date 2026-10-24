import { useState } from 'react';
import { DIAS_DE_COLHEITA_DA_ESTANTE } from '../../../src/services/etapaDoLote.js';
import { brl, num, pct } from '../api/client';
import { rotuloDoMes } from '../api/alertas';
import { dataBr } from '../api/constantes';
import {
  ROTULO_DA_VARIEDADE, type AbertoSemColheita, type AreaDaFolha, type AtividadeNaMaoDeObra, type ComponenteDoCusto, type CustosDaProducaoResposta, type CustosDoMes, type EtapaDoCusto, type FichaDoLote,
  type LoteAbertoComCusto, type LoteFabricadoComCusto, type MesDeFabricacao, type MotivoSemCusto, type MotivoSemMaoDeObra, type Variedade,
} from '../api/gerencial';
import type { FrenteDaGestao } from '../pages/GestaoDoResultado';
import { Notas, ROTULO_DA_SITUACAO, TabelaDeIndicadores, type QuadroDoIndicador } from './IndicadoresDaProducao';
import { Atualizacao, mesAnterior, mesmosMeses, textoDaAtualizacao } from './ResultadoSemFolha';

type Lido<T> = T | { erro: string; periodo?: { inicio: string; fim: string } } | null;

export const TITULO_DO_CARD_DOS_CUSTOS = '5. Custos e Produtividade';
export const LEGENDA_DO_CARD_DOS_CUSTOS = '* Parcial: na bandeja, há lote aberto no mês ainda colhendo, ou o custo do mês em que ele foi fabricado ainda muda; na contaminação, há lote inoculado no mês ainda na maturação ou colhendo; ou o mês não terminou. A variação com um mês parcial sai sem cor.';
export const LEGENDA_DA_FABRICACAO = '* Parcial: há lote inoculado no mês ainda na maturação ou colhendo, ou o mês não terminou; a contaminação e o aproveitamento dele ainda mudam. A variação com um mês parcial sai sem cor.';
export const LEGENDA_DA_BANDEJA = '* Parcial: há lote aberto no mês ainda colhendo, ou o custo do mês em que ele foi fabricado ainda muda, ou o mês não terminou. A variação com um mês parcial sai sem cor.';
export const LEGENDA_DA_MAO_DE_OBRA = '* Parcial: no bloco, há lote inoculado no mês ainda na maturação ou colhendo; na bandeja, há lote aberto no mês ainda colhendo; ou o mês não terminou. A variação com um mês parcial sai sem cor.';
export const NOTA_DO_CUSTO_PARCIAL = 'Custo parcial: a bandeja ainda não tem os cinco componentes. Entram hoje a matéria-prima e insumos dos blocos e os custos indiretos de manutenção e reformas, pelo custo do lote de origem, e as embalagens, só o material; na bandeja entregue, também a expedição e logística. Faltam a mão de obra, que no card ainda não entra (em Investigar custos ela já entra), e a energia, até o percentual entre a fabricação dos blocos e a bandeja.';
export const REGRA_DA_PRODUCAO_VENDIDA = 'Custo estimado: as bandejas vendidas no mês vezes o custo parcial por bandeja produzida do mês, inclusive as que saíram do estoque de outro mês, até existir o custo médio ponderado sobre o saldo de bandejas contado.';
const notaDaMaoDeObra = (contas: string, quais: string) => `Mão de obra: a folha do mês nas contas de pessoal do Cogumelo na DRE (salários, férias, 13º, rescisão, ASO, serviços prestados, reconhecimento e uniforme, sem a logística, que tem conta própria), mais a parte da produção ${contas}, dividida pelas horas-homem do Cadastro Mestre no mês dá o custo-hora; cada atividade leva as horas dela vezes esse custo, e as atividades somam a folha. A parte da produção ${quais} é a proporção dos salários da produção sobre os salários de todas as áreas do Cogumelo no mês, recalculada todo mês. Toda a folha da equipe do Cogumelo é da produção. São horas de referência: as horas realizadas por atividade ainda não são registradas.`;
export const NOTA_DA_MAO_DE_OBRA = notaDaMaoDeObra('no FGTS, no INSS, no plano odontológico e na cesta básica', 'nessas quatro contas');
export const NOTA_DA_MAO_DE_OBRA_SEM_BENEFICIOS = notaDaMaoDeObra('no FGTS e no INSS', 'nessas duas contas');
const comBeneficios = (mo: CustosDoMes['mao_de_obra']) => mo?.motivo === null && mo.beneficios != null;
const MOTIVO_SEM_MAO_DE_OBRA: Record<MotivoSemMaoDeObra, string> = {
  SEM_APURACAO: 'sem a apuração da DRE no mês',
  SEM_CADASTRO: 'o Cadastro Mestre de Atividades ainda não tem os tempos neste banco',
  FOLHA_PENDENTE: 'a folha da produção do mês ainda não chegou',
  SEM_FOLHA: 'sem a folha da produção na DRE do mês',
  SALDO_NEGATIVO: 'o FGTS, o INSS, um benefício ou o salário de uma área tem saldo negativo na DRE do mês, como um estorno ou um lançamento de outro mês, e a parte da produção sairia errada',
  SEM_ENCARGOS: 'falta o FGTS ou o INSS na DRE do mês, e a folha não entra só com os salários',
  ENCARGOS_PENDENTES: 'a folha de outra área do Cogumelo no mês ainda não chegou, e sem ela a parte da produção no FGTS, no INSS e nos benefícios sairia maior que a real',
  SEM_SALAS: 'nenhuma sala de frutificação ativa no cadastro de salas',
};
const NOME_DA_AREA: Record<AreaDaFolha, string> = { PRODUCAO: 'produção', PIMENTAO: 'Pimentão', ADMINISTRATIVO: 'administrativo', VENDAS: 'vendas' };
const emLista = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}` : xs[0] ?? '');
const ETAPAS_DA_SIMULACAO: [EtapaDoCusto | 'FORA', string][] = [
  ['BLOCO', 'Custo do bloco'], ['BANDEJA', 'Custo da bandeja'], ['ENTREGA', 'Bandeja entregue'], ['CONTAMINACAO', 'Retirada e descarte'],
  ['FORA', 'Fora do custo industrial (gerais e compartilhadas)'],
];
const ONDE_ENTRA: Record<AtividadeNaMaoDeObra['etapa'], string> = {
  BLOCO: 'custo do bloco', BANDEJA: 'custo da bandeja', ENTREGA: 'bandeja entregue', CONTAMINACAO: 'retirada e descarte',
  GERAL: 'fora do custo industrial', COMPARTILHADO: 'fora do custo industrial',
};
export const NOTA_DA_BANDEJA = 'A bandeja paga o bloco do mês em que ele foi fabricado, pelo custo por bloco aproveitado do próprio lote (com as perdas dele), e não a matéria-prima lançada no mês da abertura.';
export const NOTA_DA_CONTAMINACAO = 'A contaminação não é despesa a mais: o custo dos blocos perdidos já está na matéria-prima e nos custos indiretos do mês da fabricação, na DRE. Aqui ele só aparece separado.';
const deFabricacao = (f: CustosDoMes['fabricacao']) => (f.custos_indiretos
  ? `${brl(f.materia_prima)} de matéria-prima e insumos ${f.custos_indiretos < 0 ? `menos ${brl(-f.custos_indiretos)} de estorno de custos indiretos` : `mais ${brl(f.custos_indiretos)} de custos indiretos (manutenção e reformas)`} do mês, ${brl(f.custo_de_fabricacao)},`
  : `${brl(f.custo_de_fabricacao)} de matéria-prima e insumos do mês`);
const motivoSemFabricacao = (f: CustosDoMes['fabricacao']) => ((f.materia_prima ?? 0) > 0
  ? 'a matéria-prima e os custos indiretos do mês somam zero ou menos (estorno maior que o lançado)'
  : 'o mês não tem a matéria-prima na DRE');
export function fraseDoMesSemCusto(f: CustosDoMes['fabricacao']) {
  const motivo = `${motivoSemFabricacao(f)}, e os blocos ficam sem custo.`;
  if (!f.custos_indiretos) return motivo;
  return f.custos_indiretos < 0
    ? `${motivo} O estorno de custos indiretos do mês, ${brl(-f.custos_indiretos)}, fica fora do custo do bloco.`
    : `${motivo} Os custos indiretos do mês, ${brl(f.custos_indiretos)}, ficam fora do custo do bloco.`;
}
const DO_BLOCO: ComponenteDoCusto[] = ['MATERIA_PRIMA', 'INDIRETOS'];
const SEM_DADO_DO_CARD = [['produtividade_da_equipe', 'Produtividade da equipe'], ['estoque_de_bandejas_prontas', 'Estoque de bandejas prontas']] as const;
const TITULO_DA_FABRICACAO = 'Pelo mês da fabricação dos blocos (inoculação)';
const TITULO_DA_ABERTURA = 'Pelo mês da abertura';
const ROTULO_DO_COMPONENTE: Record<ComponenteDoCusto, string> = {
  MATERIA_PRIMA: 'Matéria-prima e insumos', MAO_DE_OBRA: 'Mão de obra', INDIRETOS: 'Custos indiretos', ENERGIA: 'Energia',
  EMBALAGENS: 'Embalagens', LOGISTICA: 'Expedição e logística', FORA: 'Fora do custo industrial',
};

export function semDadoDosCustos(c: CustosDaProducaoResposta, meses: string[]): string[] {
  return SEM_DADO_DO_CARD.flatMap(([k, rotulo]) => {
    const sem = meses.map((mes) => c.meses.find((x) => x.mes === mes)).filter((x): x is CustosDoMes => x != null && x.indicadores[k] == null);
    return sem.length ? [`${rotulo}: ${sem[sem.length - 1].sem_dado[k]}`] : [];
  });
}

export function quadrosDosCustos(c: CustosDaProducaoResposta, meses: string[]): { card: QuadroDoIndicador; fabricacao: QuadroDoIndicador; abertura: QuadroDoIndicador; maoDeObra: QuadroDoIndicador } {
  const doMes = (mes: string) => c.meses.find((x) => x.mes === mes);
  const col = (fn: (x: CustosDoMes) => number | null) => meses.map((mes) => { const x = doMes(mes); return x ? fn(x) : null; });
  const parciais = (k: 'fabricacao' | 'bandeja') => meses.map((mes) => doMes(mes)?.parcial[k] ?? false);
  const daFabricacao = parciais('fabricacao');
  const daBandeja = parciais('bandeja');
  return {
    card: {
      meses, notas: semDadoDosCustos(c, meses),
      linhas: [
        { rotulo: 'Custo parcial por bandeja produzida (R$), lotes abertos no mês', formato: 'unitario', sobeEMelhor: false, parciais: daBandeja, valores: col((x) => x.indicadores.custo_por_bandeja_produzida) },
        { rotulo: 'Contaminação em reais, lotes inoculados no mês', formato: 'unitario', sobeEMelhor: false, parciais: daFabricacao, valores: col((x) => x.indicadores.contaminacao_em_reais) },
        { rotulo: 'Produtividade da equipe', formato: 'num', sobeEMelhor: null, valores: col((x) => x.indicadores.produtividade_da_equipe) },
        { rotulo: 'Estoque de bandejas prontas', formato: 'num', sobeEMelhor: null, valores: col((x) => x.indicadores.estoque_de_bandejas_prontas) },
      ],
    },
    fabricacao: {
      meses, notas: [],
      linhas: [
        { rotulo: 'Custo por bloco produzido (R$)', formato: 'unitario', sobeEMelhor: false, parciais: daFabricacao, valores: col((x) => x.indicadores.custo_por_bloco_produzido) },
        { rotulo: 'Custo por bloco aproveitado (R$)', formato: 'unitario', sobeEMelhor: false, parciais: daFabricacao, valores: col((x) => x.indicadores.custo_por_bloco_aproveitado) },
        { rotulo: 'Contaminação em reais', formato: 'unitario', sobeEMelhor: false, parciais: daFabricacao, valores: col((x) => x.indicadores.contaminacao_em_reais) },
        { rotulo: 'Custo por bloco produzido com mão de obra (R$)', formato: 'unitario', sobeEMelhor: false, parciais: daFabricacao, valores: col((x) => x.indicadores.custo_por_bloco_produzido_com_mao_de_obra ?? null) },
        { rotulo: 'Custo por bloco aproveitado com mão de obra (R$)', formato: 'unitario', sobeEMelhor: false, parciais: daFabricacao, valores: col((x) => x.indicadores.custo_por_bloco_aproveitado_com_mao_de_obra ?? null) },
        { rotulo: 'Contaminação em reais com mão de obra', formato: 'unitario', sobeEMelhor: false, parciais: daFabricacao, valores: col((x) => x.indicadores.contaminacao_em_reais_com_mao_de_obra ?? null) },
      ],
    },
    abertura: {
      meses, notas: [],
      linhas: [
        { rotulo: 'Custo parcial por bandeja produzida (R$)', formato: 'unitario', sobeEMelhor: false, parciais: daBandeja, valores: col((x) => x.indicadores.custo_por_bandeja_produzida) },
        { rotulo: 'Custo parcial por bandeja entregue (R$)', formato: 'unitario', sobeEMelhor: false, parciais: daBandeja, valores: col((x) => x.indicadores.custo_por_bandeja_entregue) },
        { rotulo: 'Custo parcial por bandeja produzida com mão de obra (R$)', formato: 'unitario', sobeEMelhor: false, parciais: daBandeja, valores: col((x) => x.indicadores.custo_por_bandeja_produzida_com_mao_de_obra ?? null) },
        { rotulo: 'Custo parcial por bandeja entregue com mão de obra (R$)', formato: 'unitario', sobeEMelhor: false, parciais: daBandeja, valores: col((x) => x.indicadores.custo_por_bandeja_entregue_com_mao_de_obra ?? null) },
      ],
    },
    maoDeObra: {
      meses, notas: [],
      linhas: [
        { rotulo: 'Mão de obra por bloco produzido (R$)', formato: 'unitario', sobeEMelhor: false, parciais: daFabricacao, valores: col((x) => x.indicadores.mao_de_obra_por_bloco_produzido ?? null) },
        { rotulo: 'Horas-homem por 1.000 blocos produzidos', formato: 'num', sobeEMelhor: false, parciais: daFabricacao, valores: col((x) => x.indicadores.horas_homem_por_mil_blocos ?? null) },
        { rotulo: 'Mão de obra por bandeja produzida (R$)', formato: 'unitario', sobeEMelhor: false, parciais: daBandeja, valores: col((x) => x.indicadores.mao_de_obra_por_bandeja_produzida ?? null) },
        { rotulo: 'Horas-homem por 1.000 bandejas produzidas', formato: 'num', sobeEMelhor: false, parciais: daBandeja, valores: col((x) => x.indicadores.horas_homem_por_mil_bandejas ?? null) },
        { rotulo: 'Mão de obra da retirada e do descarte dos contaminados (R$)', formato: 'unitario', sobeEMelhor: false, parciais: meses.map((mes) => doMes(mes)?.parcial.mes_em_andamento ?? false), valores: col((x) => x.indicadores.mao_de_obra_da_contaminacao ?? null) },
      ],
    },
  };
}

const atualizacaoDosCustos = (c: CustosDaProducaoResposta) => textoDaAtualizacao({
  producao: c.atualizacao?.producao ?? null, embalagem: c.atualizacao?.embalagem ?? null, vendas: c.atualizacao?.vendas ?? null, erp: c.ultimo_lancamento ?? null,
});

export function CardDosCustos({ custos, mes, onInvestigar }: { custos: Lido<CustosDaProducaoResposta>; mes: string; onInvestigar?: (frente: FrenteDaGestao) => void }) {
  const meses = [mesAnterior(mes), mes];
  const q = custos && !('erro' in custos) ? quadrosDosCustos(custos, meses) : null;
  return (
    <div className="sintese-card card-indicadores card-grupo-custos">
      <h4>{TITULO_DO_CARD_DOS_CUSTOS}</h4>
      {custos && 'erro' in custos ? <div className="empty">{`Custos indisponíveis (${custos.erro}).`}</div>
        : !q ? <div className="loading">{`Apurando ${rotuloDoMes(meses[1])} e ${rotuloDoMes(meses[0])}…`}</div>
          : (
            <>
              <TabelaDeIndicadores quadro={q.card} legenda={LEGENDA_DO_CARD_DOS_CUSTOS} />
              <Notas notas={[NOTA_DO_CUSTO_PARCIAL, ...q.card.notas]} />
              <details className="notas-do-card"><summary>Como ler estes números</summary><Notas notas={[NOTA_DA_BANDEJA, NOTA_DA_CONTAMINACAO]} /></details>
            </>
          )}
      {custos && !('erro' in custos) && <Atualizacao texto={atualizacaoDosCustos(custos)} />}
      {onInvestigar && <button type="button" className="gr-toggle" onClick={() => onInvestigar('cogumelo')}>Investigar custos</button>}
    </div>
  );
}

const nomeDoLote = (l: { data_lote: string | null; tipo: Variedade }) => `${l.data_lote ? dataBr(l.data_lote) : 'sem data'} ${ROTULO_DA_VARIEDADE[l.tipo] ?? ''}`.trim();
const somaEmReais = <T,>(linhas: T[], fn: (l: T) => number | null | undefined) => linhas.reduce((t, l) => t + Math.round((fn(l) ?? 0) * 100), 0) / 100;
const soma = <T,>(linhas: T[], fn: (l: T) => number) => linhas.reduce((t, l) => t + fn(l), 0);
const lotes = (n: number) => (n === 1 ? '1 lote' : `${num(n)} lotes`);

export function totaisDoDetalhe(m: CustosDoMes, entra: (c: ComponenteDoCusto) => boolean = () => false) {
  const f = m.fabricacao.lotes;
  const comCusto = m.bandeja.lotes.filter((l) => l.custo_dos_blocos != null);
  return {
    composicao: m.composicao ? somaEmReais(m.composicao, (c) => c.valor) : null,
    composicao_que_entra: m.composicao ? somaEmReais(m.composicao.filter((c) => entra(c.componente)), (c) => c.valor) : null,
    produzidos: soma(f, (l) => l.blocos_produzidos),
    contaminados: soma(f, (l) => l.blocos_contaminados),
    perdidos: soma(f, (l) => l.blocos_perdidos),
    aproveitados: soma(f, (l) => l.blocos_aproveitados),
    custo_dos_contaminados: somaEmReais(f, (l) => l.custo_dos_contaminados),
    custo_das_outras_perdas: somaEmReais(f, (l) => l.custo_das_outras_perdas),
    blocos_abertos: soma(comCusto, (l) => l.blocos_abertos),
    bandejas: soma(comCusto, (l) => l.bandejas),
    custo_dos_blocos: somaEmReais(comCusto, (l) => l.custo_dos_blocos),
    custo_dos_blocos_com_mao_de_obra: comCusto.length > 0 && comCusto.every((l) => l.custo_dos_blocos_com_mao_de_obra != null)
      ? somaEmReais(comCusto, (l) => l.custo_dos_blocos_com_mao_de_obra) : null,
    contaminados_com_mao_de_obra: somaEmReais(f, (l) => l.custo_dos_contaminados_com_mao_de_obra),
    outras_perdas_com_mao_de_obra: somaEmReais(f, (l) => l.custo_das_outras_perdas_com_mao_de_obra),
    retirada: somaEmReais(f, (l) => l.custo_da_retirada_e_descarte),
    perdas_com_mao_de_obra: somaEmReais(f, (l) => l.custo_total_das_perdas_com_mao_de_obra),
  };
}

const umaCasa = (x: number | null) => Math.round((x ?? 0) * 10) / 10;
export function totaisDaMaoDeObra(atividades: AtividadeNaMaoDeObra[]) {
  return {
    horas: umaCasa(atividades.reduce((t, a) => t + umaCasa(a.horas), 0)),
    horas_na_conta: umaCasa(atividades.reduce((t, a) => t + umaCasa(a.horas_na_conta), 0)),
    custo: somaEmReais(atividades, (a) => a.custo),
  };
}

function MaoDeObraDoMes({ m }: { m: CustosDoMes }) {
  const mo = m.mao_de_obra;
  if (!mo) return <p className="obs-tela">{`${rotuloDoMes(m.mes)}: mão de obra sem número, o Cadastro Mestre de Atividades ainda não chegou a este servidor.`}</p>;
  if (mo.motivo !== null) return <p className="obs-tela">{`${rotuloDoMes(m.mes)}: mão de obra sem número, ${MOTIVO_SEM_MAO_DE_OBRA[mo.motivo]}. Os números com mão de obra ficam sem valor, nunca zero.`}</p>;
  const t = totaisDaMaoDeObra(mo.atividades);
  const fecha = Math.round(t.custo * 100) === Math.round(mo.folha * 100);
  const pe = mo.por_etapa;
  const c = mo.contaminacao;
  const e = mo.encargos;
  const b = mo.beneficios;
  const part = mo.participacao_por_etapa_pct;
  const areas = (Object.entries(e.salarios_por_area) as [AreaDaFolha, number][]).filter(([, v]) => v !== 0);
  return (
    <>
      {mo.folha_por_conta && (
        <div className="tbl-scroll">
          <table className="tbl tabela-indicadores">
            <thead><tr><th>Folha do mês: conta</th><th className="num">Valor</th><th className="num">Parte da folha</th></tr></thead>
            <tbody>
              {mo.folha_por_conta.map((c) => (
                <tr key={`${c.codigo_oficial}|${c.rotulo}`}>
                  <td>{c.evento_extraordinario ? `${c.rotulo} (evento extraordinário, em linha própria)` : c.rotulo}</td>
                  <td className="num">{brl(c.valor)}</td><td className="num">{pct(Math.round((c.valor * 10000) / mo.folha) / 100)}</td>
                </tr>
              ))}
              <tr className="ln-total"><td>TOTAL (a folha da produção)</td><td className="num">{brl(somaEmReais(mo.folha_por_conta, (c) => c.valor))}</td><td /></tr>
            </tbody>
          </table>
        </div>
      )}
      {part && (
        <div className="tbl-scroll">
          <table className="tbl tabela-indicadores">
            <thead><tr><th>Etapa</th><th className="num">Parte das horas na conta</th><th className="num">Parte da folha</th></tr></thead>
            <tbody>
              {ETAPAS_DA_SIMULACAO.map(([k, rotulo]) => (
                <tr key={k}><td>{rotulo}</td><td className="num">{`${num(part[k], 2)}%`}</td><td className="num">{brl(k === 'FORA' ? mo.fora_do_custo_industrial : mo.por_etapa[k])}</td></tr>
              ))}
              <tr className="ln-total"><td>TOTAL</td><td className="num">{`${num(Math.round(ETAPAS_DA_SIMULACAO.reduce((t, [k]) => t + part[k] * 100, 0)) / 100, 2)}%`}</td><td className="num">{brl(mo.total)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="tbl-scroll">
        <table className="tbl tabela-indicadores">
          <thead><tr><th>Atividade</th><th>Onde entra</th><th>Versão no mês</th><th className="num">Horas-homem no mês</th><th className="num">Horas na conta</th><th className="num">Custo</th></tr></thead>
          <tbody>
            {mo.atividades.map((a) => (
              <tr key={a.codigo}>
                <td>{`${a.nome} (${a.codigo})`}</td><td>{ONDE_ENTRA[a.etapa]}</td><td>{a.versoes.length ? a.versoes.join(' e ') : '—'}</td>
                <td className="num">{a.horas == null ? '—' : num(umaCasa(a.horas), 1)}</td>
                <td className="num">{a.horas_na_conta == null ? '—' : num(umaCasa(a.horas_na_conta), 1)}</td>
                <td className="num">{a.custo == null ? '—' : brl(a.custo)}</td>
              </tr>
            ))}
            <tr className="ln-total"><td>TOTAL</td><td /><td /><td className="num">{num(t.horas, 1)}</td><td className="num">{num(t.horas_na_conta, 1)}</td><td className="num">{brl(t.custo)}</td></tr>
          </tbody>
        </table>
      </div>
      <ul className="notas-indicadores">
        <li>{`Folha do mês: ${brl(mo.salarios)} nas contas de pessoal do Cogumelo mais ${brl(e.da_producao)} de FGTS e INSS${b ? ` e ${brl(b.da_producao)} de plano odontológico e cesta básica` : ''}, a parte da produção, ${brl(mo.folha)}. Custo-hora: ${brl(mo.folha)} sobre ${num(t.horas_na_conta, 1)} horas-homem na conta, ${brl(mo.custo_hora)}. ${fecha ? 'O TOTAL das atividades fecha com essa folha.' : `Atenção: o TOTAL das atividades dá ${brl(t.custo)} e a folha, ${brl(mo.folha)}.`}`}</li>
        <li>{`FGTS e INSS: ${brl(e.no_cogumelo)} no Cogumelo na DRE, repartidos pelos salários do mês de cada área: ${emLista(areas.map(([a, v]) => `${NOME_DA_AREA[a]} ${brl(v)}`))}, ${brl(areas.reduce((s, [, v]) => s + v, 0))} ao todo. A produção é ${pct(e.proporcao_pct)} e leva ${brl(e.da_producao)}; o resto fica fora do custo industrial.`}</li>
        {b && <li>{b.no_cogumelo !== 0
          ? `Plano odontológico e cesta básica: ${brl(b.no_cogumelo)} no Cogumelo na DRE, pela mesma proporção dos salários: a produção leva ${brl(b.da_producao)}.`
          : 'Plano odontológico e cesta básica: nenhum valor no Cogumelo na DRE do mês.'}</li>}
        {mo.rescisao != null && <li>{mo.custo_hora_sem_rescisao != null
          ? `Rescisão: ${brl(mo.rescisao)} no mês, em linha própria na folha. Ela entra no custo como o resto da folha; sem ela, o custo-hora seria ${brl(mo.custo_hora_sem_rescisao)}, e não ${brl(mo.custo_hora)}.`
          : 'Rescisão: nenhuma no mês.'}</li>}
        <li>{`Por onde entra: custo do bloco ${brl(pe.BLOCO)}, custo da bandeja ${brl(pe.BANDEJA)}, bandeja entregue ${brl(pe.ENTREGA)}, retirada e descarte ${brl(pe.CONTAMINACAO)} e fora do custo industrial ${brl(mo.fora_do_custo_industrial)}. Somam o TOTAL.`}</li>
        <li>{c.por_bloco != null
          ? `Retirada e descarte: ${brl(c.custo)} sobre ${num(c.blocos_retirados_no_mes)} blocos contaminados retirados no mês, ${brl(c.por_bloco)} por bloco na média. Cada lote de origem leva a parte dos blocos dele retirados no mês, no centavo.`
          : `Retirada e descarte: ${brl(c.custo)}, sem bloco contaminado retirado no mês: fica sem o valor por bloco.`}</li>
        <li>{`A atividade por sala conta, dia a dia, as salas de frutificação em uso em cada dia (${num(mo.salas_de_frutificacao)} hoje). A atividade em Referência fica com zero hora na conta, para não somar duas vezes.`}</li>
        <li>{b ? NOTA_DA_MAO_DE_OBRA : NOTA_DA_MAO_DE_OBRA_SEM_BENEFICIOS}</li>
      </ul>
    </>
  );
}

function ContaminacaoComMaoDeObra({ m }: { m: CustosDoMes }) {
  const f = m.fabricacao;
  if (!f.lotes.length) return null;
  if (f.custo_dos_contaminados_com_mao_de_obra == null) {
    return <p className="obs-tela">{`Contaminação com mão de obra sem número: ${f.custo_de_fabricacao == null ? motivoSemFabricacao(f) : 'falta a mão de obra do mês da fabricação'}.`}</p>;
  }
  const t = totaisDoDetalhe(m);
  const marca = (l: LoteFabricadoComCusto) => (l.situacao === 'EM_MATURACAO' || l.colhendo ? '*' : '');
  const algumParcial = f.lotes.some((l) => marca(l));
  const p = algumParcial ? '*' : '';
  const semRetirada = f.lotes_sem_custo_da_retirada ?? 0;
  const ind = m.indicadores;
  const impacto = ind.custo_por_bloco_aproveitado_com_mao_de_obra != null && ind.custo_por_bloco_produzido_com_mao_de_obra != null
    ? (Math.round(ind.custo_por_bloco_aproveitado_com_mao_de_obra * 100) - Math.round(ind.custo_por_bloco_produzido_com_mao_de_obra * 100)) / 100 : null;
  return (
    <>
      <div className="tbl-scroll">
        <table className="tbl tabela-indicadores">
          <thead><tr><th>Lote (inoculação)</th><th className="num">Contaminados</th><th className="num">Custo dos contaminados com mão de obra</th><th className="num">Outras perdas</th><th className="num">Custo das outras perdas com mão de obra</th><th className="num">Retirada e descarte</th><th className="num">Custo total das perdas com mão de obra</th></tr></thead>
          <tbody>
            {f.lotes.map((l) => (
              <tr key={l.chave}>
                <td>{nomeDoLote(l)}</td>
                <td className="num">{`${num(l.blocos_contaminados)}${marca(l)}`}</td>
                <td className="num">{`${brl(l.custo_dos_contaminados_com_mao_de_obra)}${marca(l)}`}</td>
                <td className="num">{`${num(l.blocos_perdidos)}${marca(l)}`}</td>
                <td className="num">{`${brl(l.custo_das_outras_perdas_com_mao_de_obra)}${marca(l)}`}</td>
                <td className="num">{l.custo_da_retirada_e_descarte == null ? '—' : `${brl(l.custo_da_retirada_e_descarte)}${marca(l)}`}</td>
                <td className="num">{l.custo_total_das_perdas_com_mao_de_obra == null ? '—' : `${brl(l.custo_total_das_perdas_com_mao_de_obra)}${marca(l)}`}</td>
              </tr>
            ))}
            <tr className="ln-total">
              <td>{semRetirada > 0 ? 'TOTAL (sem as linhas com traço)' : 'TOTAL'}</td>
              <td className="num">{`${num(t.contaminados)}${p}`}</td>
              <td className="num">{`${brl(t.contaminados_com_mao_de_obra)}${p}`}</td>
              <td className="num">{`${num(t.perdidos)}${p}`}</td>
              <td className="num">{`${brl(t.outras_perdas_com_mao_de_obra)}${p}`}</td>
              <td className="num">{`${brl(t.retirada)}${p}`}</td>
              <td className="num">{`${brl(t.perdas_com_mao_de_obra)}${p}`}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul className="notas-indicadores">
        <li>{`Cada bloco perdido leva ${f.custos_indiretos ? 'a matéria-prima, os custos indiretos' : 'a matéria-prima'} e a mão de obra do bloco do mês da fabricação (${brl(f.mao_de_obra_do_bloco)} de mão de obra no mês, pelos mesmos blocos produzidos). A retirada e o descarte vêm da mão de obra dessas atividades no mês em que os contaminados saíram.`}</li>
        {ind.contaminacao_em_reais_com_mao_de_obra != null && <li>{`Contaminação em reais com mão de obra: ${brl(f.custo_dos_contaminados_com_mao_de_obra)} dos contaminados mais ${brl(f.custo_da_retirada_e_descarte)} da retirada e do descarte, ${brl(ind.contaminacao_em_reais_com_mao_de_obra)}.`}</li>}
        {f.custo_total_das_perdas_com_mao_de_obra != null && <li>{`Custo total das perdas com mão de obra: ${brl(f.custo_total_das_perdas_com_mao_de_obra)}.`}</li>}
        {impacto != null && <li>{`Com a mão de obra, o custo por bloco produzido é ${brl(ind.custo_por_bloco_produzido_com_mao_de_obra)} e o por bloco aproveitado, ${brl(ind.custo_por_bloco_aproveitado_com_mao_de_obra)}: ${impacto < 0 ? `${brl(-impacto)} abaixo, pelos lotes que abriram mais blocos do que produziram.` : `as perdas sobem o custo de cada bloco aproveitado em ${brl(impacto)}.`}`}</li>}
        {semRetirada > 0 && <li>{`${lotes(semRetirada)} sem o custo da retirada: algum contaminado saiu antes dos meses lidos ou num mês sem a mão de obra. Fica${semRetirada === 1 ? '' : 'm'} fora do TOTAL da retirada e do custo total das perdas, sem entrar como zero.`}</li>}
      </ul>
      {algumParcial && <p className="obs-tela legenda-parcial">* Parcial: o lote ainda está na maturação ou colhendo, e a contaminação dele ainda muda.</p>}
    </>
  );
}

export function conferenciaComADre(m: CustosDoMes, totalDasContas: number | null): string | null {
  if (m.total_na_dre == null || totalDasContas == null) return null;
  const diferenca = Math.round(m.total_na_dre * 100) - Math.round(totalDasContas * 100);
  return diferenca === 0
    ? `Confere com a DRE do mês: ${brl(m.total_na_dre)} de custos e despesas do Cogumelo.`
    : `Atenção: a DRE do mês mostra ${brl(m.total_na_dre)} de custos e despesas do Cogumelo, e a soma das contas acima dá ${brl(totalDasContas)}. Diferença: ${brl(diferenca / 100)}.`;
}

function ComposicaoDoMes({ m, entra, componentes }: { m: CustosDoMes; entra: (c: ComponenteDoCusto) => boolean; componentes: CustosDaProducaoResposta['componentes'] }) {
  if (!m.composicao) return <p className="obs-tela">{`${rotuloDoMes(m.mes)}: sem apuração da DRE no mês.`}</p>;
  const semBloco = m.indicadores.custo_por_bloco_produzido == null;
  const entraNoMes = (c: ComponenteDoCusto) => entra(c) && !(semBloco && DO_BLOCO.includes(c));
  const foraNoMes = m.composicao.some((c) => entra(c.componente) && !entraNoMes(c.componente));
  const moNoTotal = m.composicao.some((c) => c.componente === 'MAO_DE_OBRA' && entraNoMes(c.componente));
  const t = totaisDoDetalhe(m, entraNoMes);
  const conferencia = conferenciaComADre(m, t.composicao);
  const divididos = m.composicao.some((c) => (c.codigo_oficial === 'L063' || c.codigo_oficial === 'L065') && c.componente === 'MAO_DE_OBRA');
  return (
    <>
      <div className="tbl-scroll">
        <table className="tbl tabela-indicadores">
          <thead><tr><th>Conta da DRE</th><th>Componente</th><th className="num">Valor</th><th className="num">Participação</th><th>Entra no custo</th></tr></thead>
          <tbody>
            {m.composicao.map((c) => (
              <tr key={`${c.codigo_oficial}|${c.rotulo}`}>
                <td>{c.codigo_oficial ? `${c.rotulo} (${c.codigo_oficial})` : c.rotulo}</td>
                <td>{ROTULO_DO_COMPONENTE[c.componente]}</td>
                <td className="num">{brl(c.valor)}</td>
                <td className="num">{pct(c.participacao_pct)}</td>
                <td>{entraNoMes(c.componente) ? 'sim' : entra(c.componente) ? 'não, sem custo por bloco no mês' : 'não'}</td>
              </tr>
            ))}
            <tr className="ln-total"><td>TOTAL dos custos e despesas do Cogumelo na DRE</td><td /><td className="num">{brl(t.composicao)}</td><td /><td /></tr>
            <tr className="ln-total"><td>TOTAL que entra no custo (linhas com sim)</td><td /><td className="num">{brl(t.composicao_que_entra)}</td><td /><td /></tr>
          </tbody>
        </table>
      </div>
      {conferencia && <p className="obs-tela">{conferencia}</p>}
      {foraNoMes && <p className="obs-tela">{`${rotuloDoMes(m.mes)} sem custo por bloco (sem a matéria-prima na DRE, com ela e os custos indiretos somando zero ou menos, ou sem bloco produzido contado): nenhum bloco leva a matéria-prima nem os custos indiretos do mês, e eles ficam fora do TOTAL que entra no custo.${moNoTotal ? ' A mão de obra das atividades do bloco também não vai para nenhum bloco, mas fica no TOTAL, porque a linha da mão de obra junta a do bloco com a da bandeja, da entrega e do descarte: o TOTAL que entra fica acima do que os blocos e as bandejas levam no mês.' : ''}`}</p>}
      <p className="obs-tela">Cada conta é a da DRE do Cogumelo no mês, por competência.{divididos ? ' FGTS e INSS aparecem em duas linhas cada: a parte da produção, que entra na mão de obra, e a parte das outras áreas, que fica fora do custo industrial. As duas somam a conta da DRE.' : ''} A que não está em nenhum componente fica fora do custo industrial, como as gerais e administrativas.</p>
      <p className="obs-tela">Critério de cada componente:</p>
      <Notas notas={componentes.map((c) => `${ROTULO_DO_COMPONENTE[c.id]}${entra(c.id) ? '' : ' (ainda não entra no custo)'}: ${c.criterio}`)} />
    </>
  );
}

function ContaminacaoPorLote({ m }: { m: CustosDoMes }) {
  const f = m.fabricacao;
  const semContagem = f.lotes_sem_contagem > 0
    ? `${lotes(f.lotes_sem_contagem)} inoculado${f.lotes_sem_contagem === 1 ? '' : 's'} no mês sem a contagem dos blocos produzidos: fora do custo e da contaminação em reais.`
    : null;
  if (!f.lotes.length) return <p className="obs-tela">{semContagem ?? `Nenhum lote inoculado em ${rotuloDoMes(m.mes)}.`}</p>;
  const t = totaisDoDetalhe(m);
  const marca = (l: LoteFabricadoComCusto) => (l.situacao === 'EM_MATURACAO' || l.colhendo ? '*' : '');
  const algumParcial = f.lotes.some((l) => marca(l));
  const comCusto = f.custo_dos_contaminados != null;
  const acima = f.lotes.filter((l) => l.acima_dos_produzidos).length;
  const impacto = f.impacto_por_bloco_aproveitado;
  return (
    <>
      <div className="tbl-scroll">
        <table className="tbl tabela-indicadores">
          <thead><tr><th>Lote (inoculação)</th><th>Situação</th><th className="num">Produzidos</th><th className="num">Contaminados</th><th className="num">Custo dos contaminados</th><th className="num">Outras perdas</th><th className="num">Custo das outras perdas</th><th className="num">Aproveitados</th><th className="num">Custo por bloco aproveitado</th></tr></thead>
          <tbody>
            {f.lotes.map((l) => (
              <tr key={l.chave}>
                <td>{nomeDoLote(l)}</td><td>{ROTULO_DA_SITUACAO[l.situacao]}</td>
                <td className="num">{num(l.blocos_produzidos)}</td>
                <td className="num">{`${num(l.blocos_contaminados)}${marca(l)}`}</td>
                <td className="num">{comCusto ? `${brl(l.custo_dos_contaminados)}${marca(l)}` : '—'}</td>
                <td className="num">{`${num(l.blocos_perdidos)}${marca(l)}`}</td>
                <td className="num">{comCusto ? `${brl(l.custo_das_outras_perdas)}${marca(l)}` : '—'}</td>
                <td className="num">{`${num(l.blocos_aproveitados)}${marca(l)}`}</td>
                <td className="num">{comCusto ? `${brl(l.custo_por_bloco_aproveitado)}${marca(l)}` : '—'}</td>
              </tr>
            ))}
            <tr className="ln-total">
              <td>TOTAL</td><td />
              <td className="num">{num(t.produzidos)}</td>
              <td className="num">{`${num(t.contaminados)}${algumParcial ? '*' : ''}`}</td>
              <td className="num">{comCusto ? `${brl(t.custo_dos_contaminados)}${algumParcial ? '*' : ''}` : '—'}</td>
              <td className="num">{`${num(t.perdidos)}${algumParcial ? '*' : ''}`}</td>
              <td className="num">{comCusto ? `${brl(t.custo_das_outras_perdas)}${algumParcial ? '*' : ''}` : '—'}</td>
              <td className="num">{`${num(t.aproveitados)}${algumParcial ? '*' : ''}`}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      {comCusto ? (
        <ul className="notas-indicadores">
          <li>{`Custo por bloco produzido: ${deFabricacao(f)} sobre ${num(f.blocos_produzidos)} blocos produzidos, ${brl(m.indicadores.custo_por_bloco_produzido)}. Cada lote leva os blocos dele por esse custo.`}</li>
          <li>{`Custo total das perdas: ${brl(f.custo_total_das_perdas)}, de ${num(f.blocos_contaminados + f.blocos_perdidos)} blocos contaminados ou perdidos, só com ${f.custos_indiretos ? 'a matéria-prima e os custos indiretos' : 'a matéria-prima'}. Com a mão de obra e o custo operacional da retirada e do descarte, na tabela de contaminação com mão de obra logo abaixo.`}</li>
          <li>{`Custo por bloco aproveitado: ${deFabricacao(f)} sobre ${num(f.blocos_aproveitados)} blocos aproveitados (os que chegaram à frutificação: abertos ou ainda na maturação), ${brl(m.indicadores.custo_por_bloco_aproveitado)}. Cada lote absorve as perdas dele: o custo por bloco aproveitado de cada lote, que a bandeja paga, está na tabela. ${impacto != null && impacto < 0
            ? `Com os lotes que abriram mais blocos do que produziram, o custo por bloco aproveitado fica ${brl(-impacto)} abaixo do custo por bloco produzido.`
            : `As perdas sobem o custo de cada bloco aproveitado em ${brl(impacto)}.`}`}</li>
          {acima > 0 && <li>{`${lotes(acima)} com mais blocos abertos do que produzidos (a conta de blocos não fecha: confira em Divergências de Contagem, no Painel Operacional). Os aproveitados dele${acima === 1 ? '' : 's'} passam dos produzidos, e o custo do lote se reparte pelos blocos que abriram: a bandeja paga o lote uma vez só.`}</li>}
          {f.perdas_depois_da_abertura > 0 && <li>{`${num(f.perdas_depois_da_abertura)} ${f.perdas_depois_da_abertura === 1 ? 'bloco contaminado ou perdido' : 'blocos contaminados ou perdidos'} depois da abertura: chegaram à frutificação, contam como aproveitados e o custo deles fica na bandeja, uma vez só. Na contaminação em reais e nas outras perdas eles aparecem também, porque se perderam.`}</li>}
          <li>{`Custo estimado sem perdas: ${brl(f.custo_sem_perdas)} por bloco, com a premissa de todos os blocos produzidos aproveitados e ${f.custos_indiretos ? 'o mesmo custo de fabricação' : 'a mesma matéria-prima'}.`}</li>
          <li>{NOTA_DA_CONTAMINACAO}</li>
          {semContagem && <li>{semContagem}</li>}
        </ul>
      ) : <p className="obs-tela">{`${rotuloDoMes(m.mes)}: ${fraseDoMesSemCusto(f)}${semContagem ? ` ${semContagem}` : ''}`}</p>}
      {algumParcial && <p className="obs-tela legenda-parcial">* Parcial: o lote ainda está na maturação ou colhendo, e a contaminação dele ainda muda.</p>}
    </>
  );
}

export function totaisDaFicha(fichas: FichaDoLote[]) {
  const entram = fichas.filter((l) => l.custo_total != null);
  return {
    lotes: entram.length,
    produzidos: soma(entram, (l) => l.blocos_produzidos),
    perdas: soma(entram, (l) => l.blocos_contaminados + l.blocos_perdidos),
    abertos: soma(entram, (l) => l.blocos_abertos),
    kg: soma(entram, (l) => Math.round(l.kg_colhidos * 1000)) / 1000,
    bandejas: soma(entram, (l) => l.bandejas),
    fabricacao: somaEmReais(entram, (l) => l.custo_de_fabricacao),
    custo_das_perdas: somaEmReais(entram, (l) => l.custo_das_perdas),
    embalagens: somaEmReais(entram, (l) => l.embalagens),
    total: somaEmReais(entram, (l) => l.custo_total),
  };
}

export function totaisDaFichaComMaoDeObra(fichas: FichaDoLote[]) {
  const entram = fichas.filter((l) => l.custo_total_com_mao_de_obra != null);
  return {
    lotes: entram.length,
    bandejas: soma(entram, (l) => l.bandejas),
    fabricacao: somaEmReais(entram, (l) => l.custo_de_fabricacao_com_mao_de_obra),
    embalagens: somaEmReais(entram, (l) => l.embalagens),
    mao_de_obra_da_bandeja: somaEmReais(entram, (l) => l.mao_de_obra_da_bandeja),
    retirada: somaEmReais(entram, (l) => l.custo_da_retirada_e_descarte),
    total: somaEmReais(entram, (l) => l.custo_total_com_mao_de_obra),
  };
}

export function fraseDaFabricacaoContraOMes(fichas: FichaDoLote[], doMesReais: number, comIndiretos = false) {
  const fabricacao = somaEmReais(fichas, (l) => l.custo_de_fabricacao);
  const diferenca = Math.abs(Math.round(doMesReais * 100) - Math.round(fabricacao * 100));
  const inicio = fichas.length === 1 ? 'A fabricação do lote' : `A fabricação dos ${lotes(fichas.length)}`;
  const doMes = comIndiretos ? 'a matéria-prima, os insumos e os custos indiretos do mês' : 'a matéria-prima e os insumos do mês';
  if (diferenca === 0) return `${inicio} soma ${doMes}, ${brl(doMesReais)}.`;
  const comAs = `${inicio} soma ${brl(fabricacao)}, e ${doMes}, ${brl(doMesReais)}: a diferença de ${brl(diferenca / 100)}`;
  return diferenca <= soma(fichas, (l) => l.blocos_produzidos) / 2
    ? `${comAs} vem do custo por bloco arredondado ao centavo.`
    : `${comAs} é maior que o arredondamento do custo por bloco.`;
}

const NOTA_DA_FICHA = 'Custo de fabricação: os blocos produzidos do lote vezes o custo por bloco produzido do mês da inoculação, com os blocos que se perderam e os que ainda estão na maturação. Perdas: a parte da fabricação dos blocos contaminados e perdidos, que já está dentro do custo de fabricação e não soma de novo. Embalagens: as bandejas do lote em cada mês da abertura vezes as embalagens por bandeja daquele mês, as mesmas do card. Custo total: a fabricação mais as embalagens. Custo por bandeja: o custo total sobre as bandejas do lote. As bandejas são o kg colhido sobre o peso da bandeja, como no rendimento pela abertura.';
const NOTA_DA_FICHA_COM_MAO_DE_OBRA = 'Com mão de obra: a fabricação com a mão de obra do bloco no mês da inoculação, mais as embalagens, a mão de obra da bandeja em cada mês da abertura e a retirada e o descarte dos contaminados do lote. Sem a mão de obra de algum desses meses, a linha fica sem o número, nunca com zero.';

function FichaDosLotes({ m }: { m: CustosDoMes }) {
  const fichas = m.ficha_dos_lotes ?? [];
  if (!fichas.length) return <p className="obs-tela">{`Nenhum lote inoculado em ${rotuloDoMes(m.mes)} com a contagem dos blocos produzidos.`}</p>;
  const t = totaisDaFicha(fichas);
  const tm = totaisDaFichaComMaoDeObra(fichas);
  const marca = (l: FichaDoLote) => (l.parcial ? '*' : '');
  const cruz = (l: FichaDoLote) => (l.conta_de_blocos_incompleta ? '†' : '');
  const p = fichas.some((l) => l.custo_total != null && l.parcial) ? '*' : '';
  const pm = fichas.some((l) => l.custo_total_com_mao_de_obra != null && l.parcial) ? '*' : '';
  const algumaCruz = fichas.some((l) => l.conta_de_blocos_incompleta);
  const cruzNoTotal = (entra: (l: FichaDoLote) => boolean) => (fichas.some((l) => entra(l) && l.conta_de_blocos_incompleta) ? '†' : '');
  const ct = cruzNoTotal((l) => l.custo_total != null);
  const ctm = cruzNoTotal((l) => l.custo_total_com_mao_de_obra != null);
  const comFabricacao = fichas.filter((l) => l.custo_de_fabricacao != null);
  const fabricacaoDoMes = m.fabricacao.custo_de_fabricacao;
  const semFabricacao = fichas.length - comFabricacao.length;
  const semEmbalagens = fichas.filter((l) => l.custo_de_fabricacao != null && l.embalagens == null);
  const mesesSemEmbalagens = [...new Set(semEmbalagens.flatMap((l) => l.meses_sem_embalagens))].sort();
  const foraDaConta = fichas.filter((l) => l.blocos_abertos_fora_da_conta > 0);
  const semDestino = fichas.filter((l) => l.conta_fora_da_tolerancia && l.blocos_sem_destino > 0);
  const acima = fichas.filter((l) => l.conta_fora_da_tolerancia && l.blocos_sem_destino < 0);
  const comBlocos = (xs: FichaDoLote[], n: (l: FichaDoLote) => number) => emLista(xs.map((l) => `${nomeDoLote(l)} (${num(n(l))})`));
  const parcelas = new Map(fichas.flatMap((l) => l.parcelas_por_mes).map((x) => [x.mes, x]));
  const mesesDasParcelas = [...parcelas.keys()].sort();
  const parcelaEm = (k: 'embalagens_por_bandeja' | 'mao_de_obra_por_bandeja') => emLista(mesesDasParcelas.map((mes) => `${rotuloDoMes(mes)} ${parcelas.get(mes)![k] == null ? 'sem o valor' : brl(parcelas.get(mes)![k]!)}`));
  const emDoisMeses = fichas.filter((l) => l.parcelas_por_mes.length > 1);
  const comMo = fichas.some((l) => l.custo_de_fabricacao_com_mao_de_obra != null);
  const porBlocoComMo = fichas.find((l) => l.custo_por_bloco_produzido_com_mao_de_obra != null)?.custo_por_bloco_produzido_com_mao_de_obra ?? null;
  return (
    <>
      <div className="tbl-scroll">
        <table className="tbl tabela-indicadores">
          <thead><tr>
            <th>Lote (inoculação)</th><th>Situação</th><th className="num">Blocos produzidos</th><th className="num">Contaminados e outras perdas</th><th className="num">Blocos abertos</th>
            <th className="num">Kg colhidos</th><th className="num">Bandejas</th><th className="num">Custo de fabricação</th><th className="num">Perdas (dentro da fabricação)</th><th className="num">Embalagens</th>
            <th className="num">Custo total</th><th className="num">Custo por bandeja</th><th className="num">Perdas por bandeja</th><th>Entra no total</th>
          </tr></thead>
          <tbody>
            {fichas.map((l) => (
              <tr key={l.chave}>
                <td>{nomeDoLote(l)}</td><td>{ROTULO_DA_SITUACAO[l.situacao]}</td>
                <td className="num">{num(l.blocos_produzidos)}</td>
                <td className="num">{`${num(l.blocos_contaminados + l.blocos_perdidos)}${marca(l)}`}</td>
                <td className="num">{`${num(l.blocos_abertos)}${marca(l)}`}</td>
                <td className="num">{`${num(l.kg_colhidos, 3)}${marca(l)}`}</td>
                <td className="num">{`${num(l.bandejas)}${marca(l)}${cruz(l)}`}</td>
                <td className="num">{l.custo_de_fabricacao == null ? '—' : `${brl(l.custo_de_fabricacao)}${marca(l)}`}</td>
                <td className="num">{l.custo_das_perdas == null ? '—' : `${brl(l.custo_das_perdas)}${marca(l)}`}</td>
                <td className="num">{l.embalagens == null ? '—' : `${brl(l.embalagens)}${marca(l)}${cruz(l)}`}</td>
                <td className="num">{l.custo_total == null ? '—' : `${brl(l.custo_total)}${marca(l)}${cruz(l)}`}</td>
                <td className="num">{l.custo_por_bandeja == null ? '—' : `${brl(l.custo_por_bandeja)}${marca(l)}${cruz(l)}`}</td>
                <td className="num">{l.perdas_por_bandeja == null ? '—' : `${brl(l.perdas_por_bandeja)}${marca(l)}${cruz(l)}`}</td>
                <td>{l.custo_total != null ? 'sim' : 'não'}</td>
              </tr>
            ))}
            {t.lotes > 0 && (
              <tr className="ln-total">
                <td>TOTAL (linhas com sim)</td><td />
                <td className="num">{num(t.produzidos)}</td>
                <td className="num">{`${num(t.perdas)}${p}`}</td>
                <td className="num">{`${num(t.abertos)}${p}`}</td>
                <td className="num">{`${num(t.kg, 3)}${p}`}</td>
                <td className="num">{`${num(t.bandejas)}${p}${ct}`}</td>
                <td className="num">{`${brl(t.fabricacao)}${p}`}</td>
                <td className="num">{`${brl(t.custo_das_perdas)}${p}`}</td>
                <td className="num">{`${brl(t.embalagens)}${p}${ct}`}</td>
                <td className="num">{`${brl(t.total)}${p}${ct}`}</td>
                <td /><td /><td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {comMo ? (
        <div className="tbl-scroll">
          <table className="tbl tabela-indicadores">
            <thead><tr>
              <th>Lote (inoculação), com mão de obra</th><th className="num">Fabricação com mão de obra</th><th className="num">Embalagens</th><th className="num">Mão de obra da bandeja</th>
              <th className="num">Retirada e descarte dos contaminados</th><th className="num">Custo total com mão de obra</th><th className="num">Custo por bandeja com mão de obra</th><th>Entra no total</th>
            </tr></thead>
            <tbody>
              {fichas.map((l) => (
                <tr key={l.chave}>
                  <td>{nomeDoLote(l)}</td>
                  <td className="num">{l.custo_de_fabricacao_com_mao_de_obra == null ? '—' : `${brl(l.custo_de_fabricacao_com_mao_de_obra)}${marca(l)}`}</td>
                  <td className="num">{l.embalagens == null ? '—' : `${brl(l.embalagens)}${marca(l)}${cruz(l)}`}</td>
                  <td className="num">{l.mao_de_obra_da_bandeja == null ? '—' : `${brl(l.mao_de_obra_da_bandeja)}${marca(l)}${cruz(l)}`}</td>
                  <td className="num">{l.custo_da_retirada_e_descarte == null ? '—' : `${brl(l.custo_da_retirada_e_descarte)}${marca(l)}`}</td>
                  <td className="num">{l.custo_total_com_mao_de_obra == null ? '—' : `${brl(l.custo_total_com_mao_de_obra)}${marca(l)}${cruz(l)}`}</td>
                  <td className="num">{l.custo_por_bandeja_com_mao_de_obra == null ? '—' : `${brl(l.custo_por_bandeja_com_mao_de_obra)}${marca(l)}${cruz(l)}`}</td>
                  <td>{l.custo_total_com_mao_de_obra != null ? 'sim' : 'não'}</td>
                </tr>
              ))}
              {tm.lotes > 0 && (
                <tr className="ln-total">
                  <td>TOTAL (linhas com sim)</td>
                  <td className="num">{`${brl(tm.fabricacao)}${pm}`}</td>
                  <td className="num">{`${brl(tm.embalagens)}${pm}${ctm}`}</td>
                  <td className="num">{`${brl(tm.mao_de_obra_da_bandeja)}${pm}${ctm}`}</td>
                  <td className="num">{`${brl(tm.retirada)}${pm}`}</td>
                  <td className="num">{`${brl(tm.total)}${pm}${ctm}`}</td>
                  <td /><td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : <p className="obs-tela">{`Custo com mão de obra: ${rotuloDoMes(m.mes)} ainda sem a mão de obra do bloco apurada, e nenhum lote tem o custo com mão de obra.`}</p>}
      <ul className="notas-indicadores">
        {m.indicadores.custo_por_bloco_produzido != null && <li>{`Custo por bloco produzido em ${rotuloDoMes(m.mes)}: ${brl(m.indicadores.custo_por_bloco_produzido)}, igual para todos os lotes do mês${porBlocoComMo == null ? '' : `; com a mão de obra do bloco, ${brl(porBlocoComMo)}`}.`}</li>}
        {fabricacaoDoMes != null && semFabricacao === 0 && <li>{fraseDaFabricacaoContraOMes(comFabricacao, fabricacaoDoMes, !!m.fabricacao.custos_indiretos)}</li>}
        {mesesDasParcelas.length > 0 && <li>{`Embalagens por bandeja de cada mês da abertura: ${parcelaEm('embalagens_por_bandeja')}.${comMo ? ` Mão de obra por bandeja: ${parcelaEm('mao_de_obra_por_bandeja')}.` : ''}`}</li>}
        {emDoisMeses.length > 0 && <li>{`Abertos em mais de um mês, com as bandejas de cada mês pela parcela daquele mês: ${emLista(emDoisMeses.map((l) => `${nomeDoLote(l)} (${emLista(l.parcelas_por_mes.map((x) => `${num(x.bandejas)} em ${rotuloDoMes(x.mes)}`))})`))}.`}</li>}
        <li>{NOTA_DA_FICHA}</li>
        <li>{NOTA_DA_FICHA_COM_MAO_DE_OBRA}</li>
        {t.lotes === 0 && <li>Nenhum lote com o custo total neste mês: sem a linha TOTAL.</li>}
        {comMo && tm.lotes === 0 && <li>Nenhum lote com o custo total com mão de obra neste mês: sem a linha TOTAL da tabela com mão de obra.</li>}
        {semFabricacao > 0 && <li>{`${lotes(semFabricacao)} sem o custo de fabricação: ${motivoSemFabricacao(m.fabricacao)}. Fica${semFabricacao === 1 ? '' : 'm'} fora do TOTAL.`}</li>}
        {semEmbalagens.length > 0 && <li>{`${lotes(semEmbalagens.length)} com bandejas em ${emLista(mesesSemEmbalagens.map(rotuloDoMes))}, mês sem as embalagens na DRE ou sem as bandejas produzidas na tela Embalagem: sem as embalagens e sem o custo total, fora do TOTAL.`}</li>}
        {foraDaConta.length > 0 && <li>{`${lotes(foraDaConta.length)} com blocos abertos sem bandejas na conta: ${comBlocos(foraDaConta, (l) => l.blocos_abertos_fora_da_conta)}. São aberturas depois do período da tela, sem a quantidade de blocos lançada ou sem colheita registrada: as bandejas delas não entram. O custo total fica sem as embalagens e a mão de obra dessas bandejas, abaixo do real, e o custo por bandeja sai acima do real, ou sem número quando nenhuma bandeja entrou.`}</li>}
        {semDestino.length > 0 && <li>{`${lotes(semDestino.length)} com blocos produzidos sem destino lançado, além da tolerância de 10 blocos por lote: ${comBlocos(semDestino, (l) => l.blocos_sem_destino)}. Se forem blocos abertos sem lançamento, faltam as bandejas deles, e o custo por bandeja pode estar acima do real até a contagem fechar (Divergências de Contagem, no Painel Operacional).`}</li>}
        {acima.length > 0 && <li>{`${lotes(acima.length)} com mais blocos abertos e perdidos do que produzidos, além da tolerância de 10 blocos por lote: ${comBlocos(acima, (l) => -l.blocos_sem_destino)} a mais. A fabricação conta só os produzidos lançados: se faltou lançar produzido, o custo por bandeja pode estar abaixo do real até a contagem fechar (Divergências de Contagem, no Painel Operacional).`}</li>}
        {m.fabricacao.lotes_sem_contagem > 0 && <li>{`${lotes(m.fabricacao.lotes_sem_contagem)} inoculado${m.fabricacao.lotes_sem_contagem === 1 ? '' : 's'} no mês sem a contagem dos blocos produzidos: fora da ficha.`}</li>}
        <li>{!comMo ? 'Custo parcial: sem a energia e sem a mão de obra.'
          : comBeneficios(m.mao_de_obra) ? 'Custo parcial: sem a energia. A primeira tabela não tem mão de obra; a tabela com mão de obra já leva os benefícios (plano odontológico e cesta básica).'
            : 'Custo parcial: sem a energia. A primeira tabela não tem mão de obra.'}</li>
      </ul>
      {fichas.some((l) => l.parcial) && <p className="obs-tela legenda-parcial">* Parcial: o lote ainda está na maturação ou colhendo, ou o mês da inoculação não terminou. Enquanto houver bloco na maturação, o custo dele está na fabricação e as bandejas dele ainda não vieram, e o custo por bandeja ainda cai.</p>}
      {algumaCruz && <p className="obs-tela legenda-parcial">† A conta de blocos do lote não fecha dentro da tolerância de 10 blocos, ou há bloco aberto sem bandeja na conta: as bandejas, as embalagens, a mão de obra da bandeja, os custos totais e os custos por bandeja não são os do lote inteiro. O motivo de cada lote está nas notas acima.</p>}
    </>
  );
}

const MOTIVO_SEM_CUSTO: Record<MotivoSemCusto, [string, string]> = {
  sem_data: ['sem a data de produção', 'sem a data de produção'],
  fora_da_janela: ['fabricado mais de seis meses antes', 'fabricados mais de seis meses antes'],
  sem_materia_prima: ['com o mês de fabricação sem a matéria-prima na DRE', 'com o mês de fabricação sem a matéria-prima na DRE'],
  sem_custo_de_fabricacao: ['com a matéria-prima e os custos indiretos do mês de fabricação somando zero ou menos', 'com a matéria-prima e os custos indiretos do mês de fabricação somando zero ou menos'],
  sem_contagem: ['sem a contagem de blocos produzidos', 'sem a contagem de blocos produzidos'],
};
export function fraseDosLotesSemCusto(b: Pick<CustosDoMes['bandeja'], 'lotes_sem_custo' | 'blocos_abertos_sem_custo' | 'sem_custo_por'>): string {
  const motivos = (Object.keys(MOTIVO_SEM_CUSTO) as MotivoSemCusto[]).map((k) => [k, b.sem_custo_por?.[k] ?? 0] as const).filter(([, n]) => n > 0)
    .map(([k, n]) => `${num(n)} ${MOTIVO_SEM_CUSTO[k][n === 1 ? 0 : 1]}`);
  return `${lotes(b.lotes_sem_custo)} com ${num(b.blocos_abertos_sem_custo)} blocos abertos sem o custo do lote${motivos.length ? ` (${motivos.join('; ')})` : ''}: ficam fora do TOTAL e do custo da bandeja.`;
}

function AbertosSemColheita({ lista }: { lista: AbertoSemColheita[] }) {
  const comCusto = lista.filter((l) => l.custo_dos_blocos != null);
  const semCusto = lista.filter((l) => l.custo_dos_blocos == null);
  const baixados = lista.filter((l) => (l.blocos_baixados_depois_da_abertura ?? 0) > 0);
  return (
    <>
      <h4>{`Abertos no mês sem colheita: fora do rendimento e do custo da bandeja`}</h4>
      <div className="tbl-scroll">
        <table className="tbl tabela-indicadores">
          <thead><tr><th>Lote (inoculação)</th><th>Fabricado em</th><th>Última abertura</th><th className="num">Blocos abertos</th><th className="num">Custo por bloco aproveitado</th><th className="num">Custo dos blocos</th><th className="num">Baixados depois da abertura</th></tr></thead>
          <tbody>
            {lista.map((l) => (
              <tr key={l.chave}>
                <td>{nomeDoLote(l)}</td>
                <td>{l.mes_da_fabricacao ? rotuloDoMes(l.mes_da_fabricacao) : 'sem data'}</td>
                <td>{l.ultima_abertura ? dataBr(l.ultima_abertura) : 'sem data'}</td>
                <td className="num">{num(l.blocos_abertos)}</td>
                <td className="num">{brl(l.custo_por_bloco_aproveitado)}</td>
                <td className="num">{brl(l.custo_dos_blocos)}</td>
                <td className="num">{num(l.blocos_baixados_depois_da_abertura)}</td>
              </tr>
            ))}
            <tr className="ln-total">
              <td>TOTAL (com custo)</td><td /><td />
              <td className="num">{comCusto.length ? num(soma(comCusto, (l) => l.blocos_abertos)) : '—'}</td><td />
              <td className="num">{comCusto.length ? brl(somaEmReais(comCusto, (l) => l.custo_dos_blocos)) : '—'}</td><td />
            </tr>
          </tbody>
        </table>
      </div>
      <ul className="notas-indicadores">
        <li>{`Sem colheita registrada até ${DIAS_DE_COLHEITA_DA_ESTANTE} dias depois da última abertura: estes blocos não entram no rendimento nem no custo por bandeja dos outros lotes. O custo deles é o dos blocos abertos vezes o custo por bloco aproveitado do lote, e continua no resultado da produção, como matéria-prima do mês de fabricação.`}</li>
        {semCusto.length > 0 && <li>{`${lotes(semCusto.length)} com ${num(soma(semCusto, (l) => l.blocos_abertos))} blocos abertos sem o custo do mês de fabricação: ficam fora do TOTAL.`}</li>}
        {baixados.length > 0 && <li>{`${lotes(baixados.length)} com blocos baixados como contaminação ou perda nas estantes abertas, na data da abertura ou depois: esses blocos também aparecem nas perdas do mês de fabricação, contados pelo custo por bloco produzido. O custo por bloco aproveitado desta tabela já absorve as perdas do lote, por isso os dois valores diferem; não é custo somado de novo.`}</li>}
      </ul>
    </>
  );
}

function MesesDeFabricacao({ meses }: { meses: MesDeFabricacao[] }) {
  return (
    <>
      <h4>De onde vem o custo dos blocos: o mês de fabricação de cada lote</h4>
      <div className="tbl-scroll">
        <table className="tbl tabela-indicadores">
          <thead><tr><th>Mês de fabricação</th><th className="num">Matéria-prima e insumos</th><th className="num">Dos quais, frete de insumos</th><th className="num">Custos indiretos</th><th className="num">Custo de fabricação</th><th className="num">Blocos produzidos</th><th className="num">Custo por bloco produzido</th></tr></thead>
          <tbody>
            {meses.map((x) => (
              <tr key={x.mes}>
                <td>{`${rotuloDoMes(x.mes)}${x.parcial ? '*' : ''}`}</td>
                <td className="num">{brl(x.materia_prima)}</td>
                <td className="num">{brl(x.frete_de_insumos)}</td>
                <td className="num">{brl(x.custos_indiretos)}</td>
                <td className="num">{brl(x.custo_de_fabricacao)}</td>
                <td className="num">{num(x.blocos_produzidos)}</td>
                <td className="num">{brl(x.custo_por_bloco_produzido)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="notas-indicadores">
        <li>O frete de insumos (conta de fretes de aquisição) já está dentro da matéria-prima do mês: não entra de novo.</li>
        <li>Cada lote leva o custo por bloco produzido do mês em que foi fabricado vezes os blocos produzidos dele, dividido pelos aproveitados dele: o lote absorve as próprias perdas, e a bandeja paga os blocos abertos vezes esse custo por bloco aproveitado.</li>
      </ul>
    </>
  );
}

function CustoDosBlocosAbertos({ m }: { m: CustosDoMes }) {
  const b = m.bandeja;
  const listaSemColheita = b.abertos_sem_colheita ?? [];
  const semColheita = b.lotes_abertos_sem_colheita > 0 && !listaSemColheita.length
    ? `${lotes(b.lotes_abertos_sem_colheita)} aberto${b.lotes_abertos_sem_colheita === 1 ? '' : 's'} no mês sem colheita registrada até ${DIAS_DE_COLHEITA_DA_ESTANTE} dias depois da abertura: fora do rendimento e do custo da bandeja.`
    : null;
  const nSemQuantidade = b.lotes_abertos_sem_quantidade ?? 0;
  const semQuantidade = nSemQuantidade > 0
    ? `${lotes(nSemQuantidade)} aberto${nSemQuantidade === 1 ? '' : 's'} no mês sem a quantidade de blocos abertos lançada, ou com zero: fora do rendimento e do custo da bandeja.`
    : null;
  if (!b.lotes.length) {
    return (
      <>
        <p className="obs-tela">{[`Nenhum lote aberto em ${rotuloDoMes(m.mes)} entra no rendimento.`, semQuantidade, semColheita].filter(Boolean).join(' ')}</p>
        {listaSemColheita.length > 0 && <AbertosSemColheita lista={listaSemColheita} />}
        {listaSemColheita.length > 0 && (b.meses_de_fabricacao?.length ?? 0) > 0 && <MesesDeFabricacao meses={b.meses_de_fabricacao!} />}
      </>
    );
  }
  const t = totaisDoDetalhe(m);
  const marca = (l: LoteAbertoComCusto) => (l.custo_dos_blocos != null && (l.colhendo || l.fabricacao_parcial) ? '*' : '');
  const algumParcial = b.lotes.some((l) => marca(l));
  const algumComCusto = b.lotes.some((l) => l.custo_dos_blocos != null);
  const p = m.indicadores;
  const partes = ([['Encerrados', false, b.encerrados], ['Em colheita', true, b.em_colheita]] as const)
    .map(([rotulo, colhendo, parte]) => ({ rotulo, parte, linhas: b.lotes.filter((l) => l.colhendo === colhendo) }))
    .filter((x) => x.linhas.length > 0);
  return (
    <>
      <div className="tbl-scroll">
        <table className="tbl tabela-indicadores">
          <thead><tr><th>Lote (inoculação)</th><th>Fabricado em</th><th>Situação</th><th className="num">Blocos produzidos</th><th className="num">Perdidos no lote</th><th className="num">Aproveitados</th><th className="num">Blocos abertos</th><th className="num">Bandejas</th><th className="num">Bandejas por bloco aberto</th><th className="num">Custo por bloco produzido na fabricação</th><th className="num">Custo por bloco aproveitado</th><th className="num">Custo dos blocos</th><th className="num">Custo dos blocos por bandeja</th><th className="num">Custo dos blocos com mão de obra</th><th>Entra no custo</th></tr></thead>
          <tbody>
            {partes.map((x) => [
              ...x.linhas.map((l) => (
                <tr key={l.chave}>
                  <td>{nomeDoLote(l)}</td>
                  <td>{l.mes_da_fabricacao ? rotuloDoMes(l.mes_da_fabricacao) : 'sem data'}</td>
                  <td>{l.colhendo ? 'em colheita' : 'encerrado'}</td>
                  <td className="num">{num(l.blocos_produzidos)}</td>
                  <td className="num">{`${num(l.blocos_perdidos_no_lote)}${l.blocos_perdidos_depois_da_abertura ? ` (${num(l.blocos_perdidos_depois_da_abertura)} depois da abertura)` : ''}`}</td>
                  <td className="num">{num(l.blocos_aproveitados)}</td>
                  <td className="num">{num(l.blocos_abertos)}</td>
                  <td className="num">{`${num(l.bandejas)}${marca(l)}`}</td>
                  <td className="num">{num(l.bandejas_por_bloco_aberto, 3)}</td>
                  <td className="num">{brl(l.custo_por_bloco_produzido_na_origem)}</td>
                  <td className="num">{`${brl(l.custo_por_bloco_aproveitado)}${marca(l)}`}</td>
                  <td className="num">{`${brl(l.custo_dos_blocos)}${marca(l)}`}</td>
                  <td className="num">{l.custo_dos_blocos_por_bandeja == null ? '—' : `${brl(l.custo_dos_blocos_por_bandeja)}${marca(l)}`}</td>
                  <td className="num">{l.custo_dos_blocos_com_mao_de_obra == null ? '—' : `${brl(l.custo_dos_blocos_com_mao_de_obra)}${marca(l)}`}</td>
                  <td>{l.custo_dos_blocos != null ? 'sim' : 'não'}</td>
                </tr>
              )),
              x.parte && (
                <tr key={`sub-${x.rotulo}`} className="ln-grupo">
                  <td>{`${x.rotulo} (linhas com sim)`}</td><td /><td /><td /><td /><td />
                  <td className="num">{num(x.parte.blocos_abertos)}</td>
                  <td className="num">{num(x.parte.bandejas)}</td>
                  <td /><td /><td />
                  <td className="num">{brl(x.parte.custo_dos_blocos)}</td>
                  <td className="num">{brl(x.parte.custo_dos_blocos_por_bandeja)}</td>
                  <td /><td />
                </tr>
              ),
            ])}
            <tr className="ln-total">
              <td>TOTAL (linhas com sim)</td><td /><td /><td /><td /><td />
              <td className="num">{num(t.blocos_abertos)}</td>
              <td className="num">{`${num(t.bandejas)}${algumParcial ? '*' : ''}`}</td>
              <td /><td /><td />
              <td className="num">{algumComCusto ? `${brl(t.custo_dos_blocos)}${algumParcial ? '*' : ''}` : '—'}</td>
              <td className="num">{`${brl(b.custo_dos_blocos_por_bandeja)}${algumParcial && b.custo_dos_blocos_por_bandeja != null ? '*' : ''}`}</td>
              <td className="num">{t.custo_dos_blocos_com_mao_de_obra == null ? '—' : `${brl(t.custo_dos_blocos_com_mao_de_obra)}${algumParcial ? '*' : ''}`}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      {(b.meses_de_fabricacao?.length ?? 0) > 0 && <MesesDeFabricacao meses={b.meses_de_fabricacao!} />}
      {listaSemColheita.length > 0 && <AbertosSemColheita lista={listaSemColheita} />}
      <ul className="notas-indicadores">
        {b.lotes.some((l) => l.blocos_perdidos_depois_da_abertura) && <li>Perdidos depois da abertura: chegaram à frutificação, então estão nos perdidos do lote e também nos aproveitados. Os aproveitados são os produzidos menos os perdidos antes da abertura.</li>}
        {b.lotes_sem_custo > 0 && <li>{fraseDosLotesSemCusto(b)}</li>}
        {semQuantidade && <li>{semQuantidade}</li>}
        {semColheita && <li>{semColheita}</li>}
        {p.custo_por_bandeja_produzida != null
          ? <li>{`Custo parcial por bandeja produzida: ${brl(b.custo_dos_blocos_por_bandeja)} dos blocos (${brl(t.custo_dos_blocos)} sobre ${num(t.bandejas)} bandejas desses lotes) mais ${brl(b.embalagens_por_bandeja)} de embalagens (${brl(b.embalagens)} sobre ${num(b.bandejas_produzidas)} bandejas produzidas no mês), ${brl(p.custo_por_bandeja_produzida)}.`}</li>
          : <li>Custo parcial por bandeja produzida sem número: falta o custo dos blocos abertos, as embalagens do mês na DRE ou as bandejas produzidas na tela Embalagem.</li>}
        {p.custo_por_bandeja_entregue != null
          ? <li>{`Custo parcial por bandeja entregue: ${brl(p.custo_por_bandeja_produzida)} mais ${brl(b.logistica_por_bandeja)} de expedição e logística (${brl(b.logistica)} sobre ${num(b.bandejas_vendidas, 3)} bandejas vendidas da produção), ${brl(p.custo_por_bandeja_entregue)}.`}</li>
          : <li>Custo parcial por bandeja entregue sem número: falta o custo por bandeja produzida, a logística do mês na DRE ou as bandejas vendidas da produção.</li>}
        {p.custo_por_bandeja_produzida_com_mao_de_obra != null
          ? <li>{`Custo parcial por bandeja produzida com mão de obra: ${brl(b.custo_dos_blocos_por_bandeja_com_mao_de_obra)} dos blocos com a mão de obra do bloco (${brl(t.custo_dos_blocos_com_mao_de_obra)} sobre ${num(t.bandejas)} bandejas desses lotes), mais ${brl(b.embalagens_por_bandeja)} de embalagens e ${brl(b.mao_de_obra_por_bandeja_produzida)} de mão de obra da bandeja (${brl(b.mao_de_obra_da_bandeja)} sobre ${num(b.bandejas_produzidas)} bandejas produzidas no mês), ${brl(p.custo_por_bandeja_produzida_com_mao_de_obra)}.`}</li>
          : <li>{`Custo parcial por bandeja produzida com mão de obra sem número: ${(b.lotes_sem_mao_de_obra ?? 0) > 0 ? `${lotes(b.lotes_sem_mao_de_obra!)} sem a mão de obra do mês em que ${b.lotes_sem_mao_de_obra === 1 ? 'foi fabricado' : 'foram fabricados'}` : 'falta a mão de obra do mês ou o custo por bandeja produzida'}.`}</li>}
        {p.custo_por_bandeja_entregue_com_mao_de_obra != null
          && <li>{`Custo parcial por bandeja entregue com mão de obra: ${brl(p.custo_por_bandeja_produzida_com_mao_de_obra)} mais ${brl(b.logistica_por_bandeja)} de expedição e logística e ${brl(b.mao_de_obra_por_bandeja_entregue)} de mão de obra da entrega (${brl(b.mao_de_obra_da_entrega)} sobre ${num(b.bandejas_vendidas, 3)} bandejas vendidas da produção), ${brl(p.custo_por_bandeja_entregue_com_mao_de_obra)}.`}</li>}
        <li>{NOTA_DA_BANDEJA}</li>
      </ul>
      {algumParcial && <p className="obs-tela legenda-parcial">* Parcial: o lote ainda colhe, ou o custo do mês em que ele foi fabricado ainda muda.</p>}
    </>
  );
}

export function fraseDoLancado(m: CustosDoMes) {
  const partes = ([[m.fabricacao.materia_prima, 'de matéria-prima e insumos'], [m.fabricacao.custos_indiretos, 'de custos indiretos'], [m.bandeja.embalagens, 'de embalagens']] as const)
    .filter(([v]) => v != null).map(([v, r]) => (v! < 0 ? `menos ${brl(-v!)} ${r}` : `${brl(v)} ${r}`));
  return `Lançado no mês na DRE: ${emLista(partes)}, ${brl(m.producao_vendida.lancado_no_mes)}. Diferença: ${brl(m.producao_vendida.diferenca)}.`;
}

function ProducaoVendida({ m }: { m: CustosDoMes }) {
  const v = m.producao_vendida;
  if (v.custo_da_producao_vendida == null) return <p className="obs-tela">Custo estimado da produção vendida sem número: falta o custo por bandeja produzida ou as bandejas vendidas da produção.</p>;
  return (
    <ul className="notas-indicadores">
      <li>{`Custo estimado da produção vendida: ${num(v.bandejas_vendidas, 3)} bandejas vendidas vezes ${brl(m.indicadores.custo_por_bandeja_produzida)}, ${brl(v.custo_da_producao_vendida)}.`}</li>
      <li>{REGRA_DA_PRODUCAO_VENDIDA}</li>
      {v.lancado_no_mes != null && <li>{fraseDoLancado(m)}</li>}
      <li>{`A diferença inclui: a matéria-prima${m.fabricacao.custos_indiretos ? ' e os custos indiretos' : ''} dos blocos que ainda vão colher, ou que já se perderam, contra ${m.fabricacao.custos_indiretos ? 'os' : 'a'} dos blocos que colheram no mês; as bandejas vendidas de estoque de outro mês; e o centavo de cada unitário. A DRE realizada não muda; o número mostra o custo das bandejas vendidas com as perdas delas.`}</li>
    </ul>
  );
}

export const temCustosNaGestao = (frente: FrenteDaGestao) => frente === 'consolidado' || frente === 'producao' || frente === 'cogumelo';

export function CustosNaGestao({ custos, periodo }: { custos: Lido<CustosDaProducaoResposta>; periodo: { inicio: string; fim: string } }) {
  const [escolhido, setEscolhido] = useState('');
  if (!custos || (custos.periodo && !mesmosMeses(custos.periodo, periodo))) return <div className="loading">Apurando os custos da produção…</div>;
  if ('erro' in custos) return <div className="empty">{`Custos da produção indisponíveis (${custos.erro}).`}</div>;
  const meses = custos.meses.map((x) => x.mes);
  const q = quadrosDosCustos(custos, meses);
  const mes = meses.includes(escolhido) ? escolhido : meses[meses.length - 1];
  const m = custos.meses.find((x) => x.mes === mes);
  const entra = (c: ComponenteDoCusto) => custos.componentes.find((x) => x.id === c)?.entra ?? false;
  return (
    <section id="custos-da-producao" className="grupo-da-investigacao card-grupo-custos">
      <h4>Custos da produção e contaminação em reais</h4>
      <Atualizacao texto={atualizacaoDosCustos(custos)} />
      <h5>{TITULO_DA_FABRICACAO}</h5>
      <TabelaDeIndicadores quadro={q.fabricacao} legenda={LEGENDA_DA_FABRICACAO} />
      <h5>{TITULO_DA_ABERTURA}</h5>
      <TabelaDeIndicadores quadro={q.abertura} legenda={LEGENDA_DA_BANDEJA} />
      <h5>Mão de obra pelas horas do Cadastro Mestre</h5>
      <TabelaDeIndicadores quadro={q.maoDeObra} legenda={LEGENDA_DA_MAO_DE_OBRA} />
      <Notas notas={[NOTA_DO_CUSTO_PARCIAL, NOTA_DA_BANDEJA, custos.meses.some((x) => comBeneficios(x.mao_de_obra)) ? NOTA_DA_MAO_DE_OBRA : NOTA_DA_MAO_DE_OBRA_SEM_BENEFICIOS]} />
      <label className="seletor-especie">
        {'Detalhar o mês: '}
        <select value={mes} onChange={(e) => setEscolhido(e.target.value)}>
          {meses.map((x) => <option key={x} value={x}>{rotuloDoMes(x)}</option>)}
        </select>
      </label>
      {m && (
        <>
          <h5>{`Composição dos custos do Cogumelo: ${rotuloDoMes(m.mes)}`}</h5>
          <ComposicaoDoMes m={m} entra={entra} componentes={custos.componentes} />
          <h5>{`Mão de obra por atividade: ${rotuloDoMes(m.mes)}`}</h5>
          <MaoDeObraDoMes m={m} />
          <h5>{`Contaminação em reais: lotes inoculados em ${rotuloDoMes(m.mes)}`}</h5>
          <ContaminacaoPorLote m={m} />
          <h5>{`Contaminação com mão de obra: lotes inoculados em ${rotuloDoMes(m.mes)}`}</h5>
          <ContaminacaoComMaoDeObra m={m} />
          {m.ficha_dos_lotes && <h5>{`Ficha de custo dos lotes inoculados em ${rotuloDoMes(m.mes)}`}</h5>}
          {m.ficha_dos_lotes && <FichaDosLotes m={m} />}
          <h5>{`Custo da bandeja: lotes abertos em ${rotuloDoMes(m.mes)}`}</h5>
          <CustoDosBlocosAbertos m={m} />
          <h5>{`Custo estimado da produção vendida em ${rotuloDoMes(m.mes)}`}</h5>
          <ProducaoVendida m={m} />
        </>
      )}
      <h5>O que ainda falta para o custo completo</h5>
      <Notas notas={[...custos.falta, ...semDadoDosCustos(custos, meses)]} />
    </section>
  );
}
