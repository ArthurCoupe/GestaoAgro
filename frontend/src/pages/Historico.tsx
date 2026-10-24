import { useEffect, useState, type ReactNode } from 'react';
import { dataBr } from '../api/client';
import { avisoParaTela, getExecutivo, type ExecutivoResposta } from '../api/gerencial';
import { PERGUNTAS } from '../api/perguntasGerenciais';
import { useAuth, viewsDoPerfil, visaoNovaDoPerfil } from '../auth';
import { abrirNaDre, type FiltroDaDre } from '../components/abrirNaDre';
import { AvisoDaFolha, fraseDoQuadroAfetado, seloSemOJaDito } from '../components/AvisoDaFolha';
import { Composicao, blocosDaComposicao, proximoAberto, tituloDoAlvo, type AlvoComposicao } from '../components/Composicao';
import { AcumuladoEmCamadas, colunasDaEscada, rotuloDoPeriodo, type CamadaAberta } from '../components/EscadaDoAno';
import { EscadaPorSegmento } from '../components/EscadaPorSegmento';
import { EvolucaoMensal, type MesAntesDaJanela } from '../components/EvolucaoMensal';
import { EvolucaoPorAtividade } from '../components/EvolucaoPorAtividade';
import { usePeriodoDaTela } from '../components/FiltroDoPeriodo';
import { GraficoComposicaoDaReceita, GraficosDaEmpresa } from '../components/GraficosDaVisaoExecutiva';
import { descartarPeriodoAoAbrir, lerPeriodoAoAbrir } from '../components/periodoAoAbrir';
import { useNav, usePeriodo } from '../components/ui';
import { SecaoAconteceu, SecaoAtividades, semLancamentos, temMovimento } from './Dashboard';
import { periodoAnterior } from './PorQueEstamosAqui';

export function mesCompletoNoHistorico(role: string | null): boolean {
  return !viewsDoPerfil(role).includes('overview');
}

export function FormacaoDoMes({ ex, rotulo, abertoInicial, onAbrir }: {
  ex: ExecutivoResposta; rotulo: string; abertoInicial?: Record<CamadaAberta, boolean>;
  onAbrir?: (alvo: AlvoComposicao) => void;
}) {
  const [aberto, setAberto] = useState<Record<CamadaAberta, boolean>>(abertoInicial ?? { producao: false, cogumelo: false });
  const titulo = `Como o resultado de ${rotulo} foi formado`;
  if (ex.visao === 'revenda') {
    const { colunas, rotuloTotal } = colunasDaEscada(ex);
    return (
      <EscadaPorSegmento escada={ex.escada} colunas={colunas} rotuloTotal={rotuloTotal} regime={ex.regime} etiqueta={ex.etiqueta}
        titulo={titulo} pergunta={PERGUNTAS.historico_como} onAbrir={onAbrir}
        sub={`A DRE linha a linha, só o mês de ${rotulo}. Valores em reais, com o sinal (custos e despesas negativos).`} />
    );
  }
  return (
    <AcumuladoEmCamadas ex={ex} regime={ex.regime} visao={ex.visao} titulo={titulo} pergunta={PERGUNTAS.historico_como}
      recorte={`só o mês de ${rotulo}`} aberto={aberto} onAlternar={(c) => setAberto((a) => ({ ...a, [c]: !a[c] }))} onAbrir={onAbrir} />
  );
}

export function SecoesDoMes({ ex, rotulo, completo = true, abertoInicial = null }: {
  ex: ExecutivoResposta; rotulo: string; completo?: boolean;
  abertoInicial?: AlvoComposicao | null;
}) {
  const [aberto, setAberto] = useState<AlvoComposicao | null>(abertoInicial);
  const abrir = (alvo: AlvoComposicao) => setAberto((a) => proximoAberto(a, alvo));
  if (semLancamentos(ex)) {
    return <div className="empty">Sem apuração em {rotulo}: o mês não tem fato gravado. Último movimento carregado: {ex.ultimo_lancamento ? dataBr(ex.ultimo_lancamento) : '—'}</div>;
  }
  const composicao = aberto && (
    <Composicao titulo={tituloDoAlvo(ex, aberto)} rotuloPeriodo={rotulo} etiqueta={ex.etiqueta} regime={ex.regime}
      blocos={blocosDaComposicao(ex, aberto)} periodo={{ inicio: ex.periodo.inicio, fim: ex.periodo.fim }} visao={ex.visao}
      atividade={aberto.tipo === 'atividade' ? aberto.chave : null} onFechar={() => setAberto(null)} />
  );
  return (
    <>
      {ex.avisos.map((a, i) => <p key={i} className="obs-tela">⚠ {avisoParaTela(a)}</p>)}
      <AvisoDaFolha pendentes={ex.folha_pendente} provisorios={ex.meses_provisorios} />
      {completo && (
        <>
          <SecaoAconteceu ex={ex} titulo={`O que aconteceu em ${rotulo}`} pergunta={PERGUNTAS.historico_mes} onAbrir={abrir} />
          {aberto?.tipo === 'bloco' && composicao}
          <SecaoAtividades ex={ex} titulo={`Quem formou o resultado de ${rotulo}`} pergunta={PERGUNTAS.historico_quem} onAbrir={abrir}
            sub="Só o mês escolhido: quanto veio de Cogumelo, Pimentão e Revenda. O que não é negócio (estrutura, sem rateio) fica no rodapé." />
          {aberto?.tipo === 'atividade' && composicao}
        </>
      )}
      <details className="detalhamento-da-gestao">
        <summary>Ver detalhamento</summary>
        <FormacaoDoMes ex={ex} rotulo={rotulo} onAbrir={completo ? undefined : abrir} />
      </details>
      {!completo && composicao}
    </>
  );
}

export function SecoesDoHistorico({ ex, rotulo, jaAvisado = null, antes = null, antesFalhou = false }: {
  ex: ExecutivoResposta; rotulo: string; jaAvisado?: Pick<ExecutivoResposta, 'avisos' | 'folha_pendente' | 'meses_provisorios'> | null;
  antes?: MesAntesDaJanela | null; antesFalhou?: boolean;
}) {
  const navegar = useNav();
  const avisos = ex.avisos.filter((a) => !jaAvisado?.avisos.includes(a));
  const pendentes = ex.folha_pendente?.filter((p) => !jaAvisado?.folha_pendente?.some((q) => q.mes === p.mes && q.empresa === p.empresa));
  const provisorios = seloSemOJaDito(ex.meses_provisorios, jaAvisado?.meses_provisorios);
  const consolidado = ex.visao === 'consolidado';
  const graficos = {
    serie: ex.serie_mensal, mesesSemFato: ex.meses_sem_fato, etiqueta: ex.etiqueta, periodo: rotulo, aconteceu: ex.aconteceu,
    onAbrirDre: (filtro: FiltroDaDre) => abrirNaDre(navegar, filtro),
  };
  return (
    <>
      {avisos.map((a, i) => <p key={i} className="obs-tela">⚠ {avisoParaTela(a)}</p>)}
      <AvisoDaFolha pendentes={pendentes} provisorios={provisorios} />
      {consolidado && (
        <>
          <GraficosDaEmpresa {...graficos} />
          <GraficoComposicaoDaReceita {...graficos} />
          <EvolucaoPorAtividade id="consolidado-por-negocio" etiqueta={ex.etiqueta} mesesSemFato={ex.meses_sem_fato}
            atividades={ex.atividades.filter((a) => a.serie_mensal != null && temMovimento(a))}
            titulo={`Consolidado por Negócio: resultado mês a mês, ${rotulo}`} pergunta={PERGUNTAS.abertura}
            sub="Resultado operacional de Cogumelo, Pimentão e Revenda em cada mês: onde cada negócio deu bom ou ruim. A última coluna soma os negócios mostrados." />
        </>
      )}
      <EvolucaoMensal id="historico-evolucao" serie={ex.serie_mensal} mesesSemFato={ex.meses_sem_fato} folhaPendente={ex.folha_pendente}
        etiqueta={ex.etiqueta} soTabela={consolidado} antes={antes} antesFalhou={antesFalhou}
        titulo={`Evolução mensal e ponto de equilíbrio: ${rotulo}`} pergunta={PERGUNTAS.evolucao_mensal}
        sub="Receita, custos, despesas e resultado operacional de cada mês, com o ponto de equilíbrio do mês e a variação contra o mês anterior. Fonte: base nova do ERP, por competência." />
      {(ex.folha_pendente?.length ?? 0) > 0 && <p className="obs-tela">{`⚠ ${fraseDoQuadroAfetado(consolidado
        ? 'Os resultados mês a mês dos gráficos, do Consolidado por Negócio e da Evolução mensal acima'
        : 'Os resultados mês a mês da Evolução mensal acima')}`}</p>}
    </>
  );
}

export function CorpoDoHistorico({ rotulo, ex, erro, completo, filtro = null, recusa = '', rotuloDaEvolucao, exAno, erroAno, antes = null, antesFalhou = false }: {
  rotulo: string;
  ex: ExecutivoResposta | null; erro: string;
  completo: boolean;
  filtro?: ReactNode;
  recusa?: string;
  rotuloDaEvolucao: string;
  exAno: ExecutivoResposta | null; erroAno: string;
  antes?: MesAntesDaJanela | null; antesFalhou?: boolean;
}) {
  const mesAvisou = !erro && ex && !semLancamentos(ex) ? ex : null;
  return (
    <>
      {erro ? <div className="empty">O mês de {rotulo} está indisponível ({erro}).</div>
        : !ex ? <div className="loading">Apurando {rotulo}…</div>
          : <SecoesDoMes ex={ex} rotulo={rotulo} completo={completo} />}
      {filtro}
      {recusa ? <div className="empty">{recusa}</div>
        : erroAno ? <div className="empty">{`A evolução de ${rotuloDaEvolucao} está indisponível (${erroAno}).`}</div>
          : !exAno ? <div className="loading">Apurando {rotuloDaEvolucao}…</div>
            : <SecoesDoHistorico ex={exAno} rotulo={rotuloDoPeriodo(exAno.periodo)} jaAvisado={mesAvisou} antes={antes} antesFalhou={antesFalhou} />}
    </>
  );
}

export function Historico() {
  const { periodo } = usePeriodo();
  const { usuario } = useAuth();
  const visao = visaoNovaDoPerfil(usuario?.role ?? null);
  const completo = mesCompletoNoHistorico(usuario?.role ?? null);
  const [recado] = useState(() => lerPeriodoAoAbrir());
  const { recusa, intervalo, rotulo, filtro } = usePeriodoDaTela(recado);
  useEffect(() => { descartarPeriodoAoAbrir(); }, []);
  const [ex, setEx] = useState<ExecutivoResposta | null>(null);
  const [erro, setErro] = useState('');
  const [exAno, setExAno] = useState<ExecutivoResposta | null>(null);
  const [erroAno, setErroAno] = useState('');
  const [exAntes, setExAntes] = useState<ExecutivoResposta | null>(null);
  const [antesFalhou, setAntesFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    setErro(''); setEx(null);
    getExecutivo(periodo.inicio, periodo.fim, visao)
      .then((r) => { if (vivo) setEx(r); })
      .catch((e) => { if (vivo) setErro(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [periodo.inicio, periodo.fim, visao]);

  useEffect(() => {
    let vivo = true;
    setErroAno(''); setExAno(null);
    if (recusa) return undefined;
    getExecutivo(intervalo.inicio, intervalo.fim, visao, 'COMPETENCIA', undefined, visao === 'consolidado')
      .then((r) => { if (vivo) setExAno(r); })
      .catch((e) => { if (vivo) setErroAno(e?.response?.data?.erro ?? e.message); });
    return () => { vivo = false; };
  }, [intervalo.inicio, intervalo.fim, visao, recusa]);

  useEffect(() => {
    let vivo = true;
    setExAntes(null); setAntesFalhou(false);
    if (recusa) return undefined;
    const p = periodoAnterior('MES', { inicio: intervalo.inicio, fim: intervalo.inicio });
    getExecutivo(p.inicio, p.fim, visao, 'COMPETENCIA')
      .then((r) => { if (vivo) setExAntes(r); })
      .catch(() => { if (vivo) setAntesFalhou(true); });
    return () => { vivo = false; };
  }, [intervalo.inicio, visao, recusa]);

  return <CorpoDoHistorico rotulo={periodo.rotulo} ex={ex} erro={erro} completo={completo} filtro={filtro} recusa={recusa} rotuloDaEvolucao={rotulo} exAno={exAno} erroAno={erroAno} antes={exAntes} antesFalhou={antesFalhou} />;
}
