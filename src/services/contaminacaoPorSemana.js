import { chaveDaSemana, intervaloDaSemana, rotuloDaSemana } from './semanaDeProducao.js';
import { maturidadeDoLote, MATURIDADE } from './maturidadeDaCoorte.js';
import { PARAMETROS, semaforoDeContaminacao } from './parametrosDoPainel.js';

const razao = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : null);

export function contaminacaoPorSemana(lotes = [], opcoes = {}) {
  const { hoje, parametros = PARAMETROS } = opcoes;
  const porSemana = new Map();

  for (const l of lotes) {
    const semana = chaveDaSemana(l.data_lote);
    if (!semana) continue;
    if (!porSemana.has(semana)) {
      porSemana.set(semana, {
        semana,
        rotulo: rotuloDaSemana(semana),
        ...intervaloDaSemana(semana),
        lotes: 0,
        lotes_com_contaminacao: 0,
        blocos_produzidos: 0,
        blocos_contaminados: 0,
        lote_chaves: [],
      });
    }
    const s = porSemana.get(semana);
    s.lotes += 1;
    s.blocos_produzidos += Number(l.blocos_produzidos ?? 0);
    s.blocos_contaminados += Number(l.blocos_contaminados ?? 0);
    if (Number(l.blocos_contaminados ?? 0) > 0) s.lotes_com_contaminacao += 1;
    s.lote_chaves.push(l.chave);
  }

  return [...porSemana.values()]
    .sort((a, b) => a.semana.localeCompare(b.semana))
    .map((s) => {
      const m = maturidadeDoLote(s.fim, hoje, parametros);
      const taxa = razao(s.blocos_contaminados, s.blocos_produzidos);
      return {
        ...s,
        taxa,
        maturidade: m.estado,
        dias_da_semana: m.dias,
        fracao_esperada: m.fracao_esperada,
        semaforo: m.estado === MATURIDADE.MADURO ? semaforoDeContaminacao(taxa, parametros) : null,
        pct_lotes_afetados: razao(s.lotes_com_contaminacao, s.lotes),
      };
    });
}

export function tendenciaDaContaminacao(semanas = [], opcoes = {}) {
  const { parametros = PARAMETROS } = opcoes;
  if (!semanas.length) {
    return { estado: 'SEM_DADO', desde: null, semanas_comparadas: 0,
      frase: 'Ainda não há dado suficiente para leitura.' };
  }
  const maduras = semanas.filter((s) => s.maturidade === MATURIDADE.MADURO && s.taxa != null);
  if (!maduras.length) {
    return { estado: 'EM_OBSERVACAO', desde: null, semanas_comparadas: 0,
      frase: 'Os lotes das semanas recentes ainda não atingiram idade suficiente para comparação.' };
  }

  const janela = maduras.slice(-parametros.contaminacaoSemanasComparacao - 2);
  const acima = (s) => s.taxa >= parametros.contaminacaoAmarelo;

  let desdeTendencia = null;
  for (let i = janela.length - 1; i >= 1; i -= 1) {
    if (acima(janela[i]) && acima(janela[i - 1])) desdeTendencia = janela[i - 1].semana;
    else if (desdeTendencia) break;
  }
  if (desdeTendencia) {
    const s = janela.find((x) => x.semana === desdeTendencia);
    return {
      estado: 'TENDENCIA_DE_PIORA', desde: desdeTendencia, semanas_comparadas: janela.length,
      frase: `A contaminação ficou acima do padrão em semanas consecutivas. A mudança começa nos lotes produzidos em ${s.rotulo} (${desdeTendencia}).`,
    };
  }

  const pontual = [...janela].reverse().find(acima);
  if (pontual) {
    return {
      estado: 'EVENTO_PONTUAL', desde: pontual.semana, semanas_comparadas: janela.length,
      frase: `A elevação está concentrada na semana de ${pontual.rotulo} e não se repetiu nas demais semanas comparáveis.`,
    };
  }
  return {
    estado: 'NORMAL', desde: null, semanas_comparadas: janela.length,
    frase: 'As últimas semanas comparáveis permanecem dentro do padrão esperado.',
  };
}
