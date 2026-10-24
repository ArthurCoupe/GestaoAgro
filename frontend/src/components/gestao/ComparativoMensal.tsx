import { useState } from 'react';
import { mesDosAlertas } from '../../api/alertas';
import { hojeISO } from '../../api/constantes';
import type { ExecutivoResposta } from '../../api/gerencial';
import { PERGUNTAS } from '../../api/perguntasGerenciais';
import { AlertasContraOBudget, AlertasDoMes, type DreDoMesAlertado } from '../../pages/Dashboard';
import type { FrenteDaGestao } from '../../pages/GestaoDoResultado';
import { serieSemMesesPendentes } from '../AvisoDaFolha';
import { colunasDaVariedade, receitaDivididaPorEspecie, rotuloDoPeriodo, ytdDaChave } from '../EscadaDoAno';
import { EscadaMensal, subMensal, type ChaveDaEscada } from '../EscadaMensal';

const NOME_DA_FRENTE: Record<FrenteDaGestao, string> = {
  consolidado: 'Consolidado', producao: 'Produção', cogumelo: 'Cogumelo', pimentao: 'Pimentão', revenda: 'Revenda',
};

export const mesDoComparativo = (ex: ExecutivoResposta, hoje = hojeISO()) =>
  mesDosAlertas(serieSemMesesPendentes(ex.serie_mensal, ex.folha_pendente), hoje.slice(0, 7));

export function ComparativoMensal({ ex, frente, budget, dreDoMes = null, hoje = hojeISO() }: {
  ex: ExecutivoResposta; frente: FrenteDaGestao;
  budget?: ExecutivoResposta['budget']; dreDoMes?: DreDoMesAlertado | null;
  hoje?: string;
}) {
  const [chave, setChave] = useState<ChaveDaEscada>('PRODUCAO_COGUMELO');
  const especies = frente === 'cogumelo' ? colunasDaVariedade(ex.escada).map((v) => ({ chave: v.chave, rotulo: `Cogumelo · ${v.rotulo}` })) : [];
  const seletor = especies.length > 0
    ? { colunas: [{ chave: 'PRODUCAO_COGUMELO' as const, rotulo: 'Cogumelo · todas as espécies' }, ...especies], chave, onChange: setChave }
    : undefined;
  const fixa: ChaveDaEscada | undefined = frente === 'pimentao' ? 'PIMENTAO' : frente === 'cogumelo' && !seletor ? 'PRODUCAO_COGUMELO' : undefined;
  const daChave = seletor ? chave : fixa;
  return (
    <>
      <AlertasDoMes ex={ex} mesAberto={hoje.slice(0, 7)} />
      {frente === 'consolidado' && <AlertasContraOBudget mes={mesDoComparativo(ex, hoje)} budgetDoAno={budget} lido={dreDoMes} />}
      <EscadaMensal serie={ex.serie_mensal} ytd={daChave ? ytdDaChave(ex.escada, daChave) : ex.escada.total} limiares={ex.limiares_alerta}
        regime={ex.regime} etiqueta={ex.etiqueta} id="gestao-comparativo-mensal" pergunta={PERGUNTAS.evolucao_mensal}
        titulo={`Comparativo mensal das contas: ${NOME_DA_FRENTE[frente]}, ${rotuloDoPeriodo(ex.periodo)}`} sub={subMensal(ex.regime)}
        seletor={seletor} chave={fixa} receitaDividida={seletor ? receitaDivididaPorEspecie(ex.escada) : undefined}
        lancamentos={{ visao: ex.visao, periodo: ex.periodo }} folhaPendente={ex.folha_pendente} />
    </>
  );
}
