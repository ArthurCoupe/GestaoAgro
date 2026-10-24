import { useEffect, useRef, useState } from 'react';
import { getExecutivo, getVendasPorProduto, type ExecutivoResposta, type VendasPorProdutoResposta } from '../api/gerencial';
import { PERGUNTAS } from '../api/perguntasGerenciais';
import { abrirNaDre } from '../components/abrirNaDre';
import { AvisoDaFolha } from '../components/AvisoDaFolha';
import { rotuloDoPeriodo } from '../components/EscadaDoAno';
import { EscadaMensal, subMensal } from '../components/EscadaMensal';
import { usePeriodoDaTela } from '../components/FiltroDoPeriodo';
import { GraficoRevendaMesAMes, semGraficoDaRevenda } from '../components/GraficoRevendaMesAMes';
import {
  GraficoCompraEVendaDaRevenda, GraficoMixDaRevenda, GraficoPrecoMedioDaRevenda, GraficoQuantidadeDaRevenda,
} from '../components/GraficosDaRevendaPorProduto';
import { GraficosCarregando, GraficosDaEmpresa } from '../components/GraficosDaVisaoExecutiva';
import { descartarPeriodoAoAbrir, lerPeriodoAoAbrir } from '../components/periodoAoAbrir';
import { ProdutosQueFormamARevenda } from '../components/ProdutosQueFormamARevenda';
import { NOME_DA_EMPRESA, RevendaPorProduto, rotuloDoMes } from '../components/RevendaPorProduto';
import { useNav } from '../components/ui';
import { CardsDoAno, CardsDoAnoCarregando } from './Dashboard';

export function ehGestor(role: string | null): boolean {
  return role === 'GESTAO_GERAL';
}

export function FinanceiroDaRevenda({ ex }: { ex: ExecutivoResposta }) {
  const navegar = useNav();
  return (
    <>
      <AvisoDaFolha pendentes={ex.folha_pendente} provisorios={ex.meses_provisorios} />
      <CardsDoAno ex={ex} chave="REVENDA" rotulo="Revenda" pergunta={PERGUNTAS.acumulado_revenda} />
      <GraficosDaEmpresa serie={ex.serie_mensal} mesesSemFato={ex.meses_sem_fato} etiqueta={ex.etiqueta} periodo={rotuloDoPeriodo(ex.periodo)} aconteceu={ex.aconteceu}
        visao={ex.visao} onAbrirDre={(filtro) => abrirNaDre(navegar, filtro)} />
    </>
  );
}

export function semVendasDaRevenda(v: VendasPorProdutoResposta): string {
  const faltas = v.meses_sem_relatorio.map((m) => `${NOME_DA_EMPRESA[m.empresa]} ${rotuloDoMes(m.mes)}`);
  return `Nenhuma venda de revenda carregada no período.${faltas.length > 0 ? ` Sem relatório de vendas carregado: ${faltas.join(', ')}.` : ''}`;
}

export function EvolucaoDaRevenda({ ex }: { ex: ExecutivoResposta }) {
  return (
    <EscadaMensal id="evolucao-revenda" serie={ex.serie_mensal} ytd={ex.escada.total} limiares={ex.limiares_alerta} regime={ex.regime}
      etiqueta={ex.etiqueta} titulo={`Evolução mensal da revenda: ${rotuloDoPeriodo(ex.periodo)}`} pergunta={PERGUNTAS.evolucao_revenda} sub={subMensal(ex.regime)}
      lancamentos={{ visao: ex.visao, periodo: ex.periodo }} folhaPendente={ex.folha_pendente} />
  );
}

export function PainelRevenda() {
  const [recado] = useState(() => lerPeriodoAoAbrir());
  const { recusa, intervalo, filtro } = usePeriodoDaTela(recado);
  useEffect(() => { descartarPeriodoAoAbrir(); }, []);
  const [exEscada, setExEscada] = useState<ExecutivoResposta | null>(null);
  const [erroEscada, setErroEscada] = useState('');
  useEffect(() => {
    let vivo = true;
    setErroEscada(''); setExEscada(null);
    if (recusa) return undefined;
    getExecutivo(intervalo.inicio, intervalo.fim, 'revenda', 'COMPETENCIA')
      .then((r) => { if (vivo) setExEscada(r); })
      .catch((e) => { if (vivo) setErroEscada(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [intervalo.inicio, intervalo.fim, recusa]);

  const [vendas, setVendas] = useState<VendasPorProdutoResposta | null>(null);
  const [erroVendas, setErroVendas] = useState('');
  useEffect(() => {
    let vivo = true;
    setErroVendas(''); setVendas(null);
    if (recusa) return undefined;
    getVendasPorProduto(intervalo.inicio, intervalo.fim)
      .then((r) => { if (vivo) setVendas(r); })
      .catch((e) => { if (vivo) setErroVendas(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [intervalo.inicio, intervalo.fim, recusa]);

  const detalhes = useRef<HTMLDetailsElement>(null);
  const [destaque, setDestaque] = useState<{ chaves: string[] } | null>(null);
  useEffect(() => { setDestaque(null); }, [intervalo.inicio, intervalo.fim]);
  useEffect(() => {
    if (destaque) document.querySelector('#revenda-por-produto tr.ln-destaque')?.scrollIntoView({ block: 'center' });
  }, [destaque]);
  const abrirProduto = (chaves: string[]) => {
    if (detalhes.current) detalhes.current.open = true;
    setDestaque({ chaves });
  };

  if (recusa) return <>{filtro}<div className="empty">{recusa}</div></>;
  return (
    <>
      {filtro}
      {erroEscada ? <div className="empty">Financeiro da revenda indisponível ({erroEscada})</div>
        : !exEscada ? <><CardsDoAnoCarregando rotulo="Revenda" /><GraficosCarregando comComposicao={false} /></>
          : <FinanceiroDaRevenda ex={exEscada} />}
      <h2 className="nivel-da-visao">Quem formou o resultado da Revenda?</h2>
      {erroVendas ? <div className="empty">Revenda por produto indisponível ({erroVendas})</div>
        : !vendas ? <div className="loading">Lendo as vendas por produto…</div>
          : semGraficoDaRevenda(vendas) ? <div className="empty">{semVendasDaRevenda(vendas)}</div>
            : (
              <>
                <GraficoQuantidadeDaRevenda v={vendas} onAbrirProduto={abrirProduto} />
                <GraficoRevendaMesAMes v={vendas} onAbrirProduto={abrirProduto} />
                <GraficoPrecoMedioDaRevenda v={vendas} onAbrirProduto={abrirProduto} />
                <GraficoMixDaRevenda v={vendas} onAbrirProduto={abrirProduto} />
                <ProdutosQueFormamARevenda v={vendas} />
                <GraficoCompraEVendaDaRevenda v={vendas} onAbrirProduto={abrirProduto} />
              </>
            )}
      <details className="detalhamento-da-gestao" ref={detalhes}>
        <summary>Ver detalhamento</summary>
        {exEscada && <EvolucaoDaRevenda ex={exEscada} />}
        {vendas && <RevendaPorProduto v={vendas} destaque={destaque?.chaves} />}
      </details>
    </>
  );
}
