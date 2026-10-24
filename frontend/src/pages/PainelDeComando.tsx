import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import type { ViewId } from '../auth';
import {
  definirSalaDaAbertura, getSalasProducao,
  num, type PainelDeComandoArea, type PainelDeComandoSeveridade, type PainelOperacionalSemDado, type Pendencia,
  type PendenciasDeLancamento, type SalaComEtapa,
} from '../api/client';
import { AcaoNaoHouveColheita, marcarEAvisar } from '../components/AcaoNaoHouveColheita';
import { AcaoVerificarRetirada, podeVerificarRetirada, verificarEAvisar } from '../components/AcaoVerificarRetirada';
import { AcaoSalaDaAbertura } from '../components/AcaoSalaDaAbertura';
import { usePainelOperacional } from '../components/BlocosOperacionais';
import { ListaDePendencias, type EstadoDaLista } from '../components/ListaDePendencias';
import type { SalaOpcao } from '../components/SelectSala';
import { Kpi, Panel, Pill, useNav, useToast } from '../components/ui';
import { abrirContaminadosEm, ANCORA_ALERTA_DE_RETIRADA, recadoDaPendencia, type RecadoContaminados } from './recadoDeContaminados';
import { abrirJornadaEm } from './JornadaCogumelo';

const TONE_SEVERIDADE: Record<PainelDeComandoSeveridade, 'ok' | 'warn' | 'bad' | 'neutral'> = {
  VERDE: 'ok', AMARELO: 'warn', VERMELHO: 'bad', SEM_DADO: 'neutral',
};
const CLASSE_ACENTO: Record<PainelDeComandoSeveridade, string> = {
  VERMELHO: 'alert', AMARELO: 'warn', VERDE: 'good', SEM_DADO: 'neutral',
};
const FRASE_SEVERIDADE: Record<PainelDeComandoSeveridade, string> = {
  VERMELHO: 'exige ação', AMARELO: 'exige atenção', VERDE: 'dentro do esperado', SEM_DADO: 'sem informação',
};

export function CardAreaComando({ area, onNavegar }: {
  area: PainelDeComandoArea;
  onNavegar: (destino: string, ancora?: string | null) => void;
}) {
  const tom = TONE_SEVERIDADE[area.severidade] ?? 'neutral';
  const acento = CLASSE_ACENTO[area.severidade] ?? 'neutral';
  return (
    <button type="button" className={`kpi card-comando ${acento}`}
      onClick={() => onNavegar(area.destino, area.ancora)}>
      <div className="cc-topo">
        <span className="cc-titulo">{area.titulo}</span>
        <Pill tone={tom}>{FRASE_SEVERIDADE[area.severidade] ?? area.severidade}</Pill>
      </div>
      <div className={`cc-numero ${tom}`}>
        {area.numero != null
          ? <>{num(area.numero)}{area.unidade && <small> {area.unidade}</small>}</>
          : (area.frase ?? '—')}
      </div>
      {area.numero != null && area.frase && <p className="cc-frase">{area.frase}</p>}
      {area.alertas > 0 && <p className="cc-alertas">{num(area.alertas)} alerta(s)</p>}
      <div className={`cc-rodape ${tom}`}>{area.ancora ? 'Ver detalhes →' : 'Abrir tela →'}</div>
    </button>
  );
}

export function destinoDaPendencia(item: Pendencia): {
  view: 'embalagem' | 'jornada' | 'contaminados' | 'painel_contaminados'; rotulo: string; ancora?: string;
} {
  if (item.tipo === 'EMBALAGEM_NAO_LANCADA') return { view: 'embalagem', rotulo: 'Abrir Dados Embalagem' };
  if (item.tipo === 'CONTAMINADO_SEM_ESTANTE') return { view: 'contaminados', rotulo: 'Corrigir em Contaminados' };
  if (item.tipo === 'RETIRADA_ACIMA_DO_LIMITE') {
    return { view: 'painel_contaminados', rotulo: 'Ver no Painel de Contaminados', ancora: ANCORA_ALERTA_DE_RETIRADA };
  }
  return { view: 'jornada', rotulo: 'Abrir na Jornada' };
}

export function abrirPendencia(
  item: Pendencia,
  { abrirJornadaEm: gravarRecado, abrirContaminadosEm: gravarRecadoContaminados, irPara }: {
    abrirJornadaEm: (data: string) => void;
    abrirContaminadosEm: (recado: RecadoContaminados) => void;
    irPara: (view: string, ancora?: string) => void;
  },
): void {
  const { view, ancora } = destinoDaPendencia(item);
  if (view === 'jornada') gravarRecado(item.data_lote);
  if (view === 'contaminados') gravarRecadoContaminados(recadoDaPendencia(item));
  if (ancora) irPara(view, ancora);
  else irPara(view);
}

export function PainelPendencias({ pendencias, onAbrir, salas = [], onGravarSala, onNaoHouveColheita, onVerificar, estado, onAviso }: {
  pendencias: PendenciasDeLancamento | null;
  onAbrir: (item: Pendencia) => void;
  salas?: SalaOpcao[];
  onGravarSala?: (item: Pendencia, sala: string) => Promise<void>;
  onNaoHouveColheita?: (item: Pendencia) => Promise<void>;
  onVerificar?: (item: Pendencia) => Promise<void>;
  estado?: [EstadoDaLista, (e: EstadoDaLista) => void];
  onAviso?: (texto: string, erro?: boolean) => void;
}) {
  if (!pendencias || pendencias.total === 0) return null;
  return (
    <ListaDePendencias itens={pendencias.itens} estado={estado} onAviso={onAviso} acoes={(item) => (
      <>
        <button type="button" className="btn ghost" onClick={() => onAbrir(item)}>{destinoDaPendencia(item).rotulo}</button>
        {onGravarSala && <AcaoSalaDaAbertura item={item} salas={salas} onGravar={onGravarSala} />}
        {onNaoHouveColheita && <AcaoNaoHouveColheita item={item} onMarcar={onNaoHouveColheita} />}
        {onVerificar && <AcaoVerificarRetirada item={item} onVerificar={onVerificar} />}
      </>
    )} />
  );
}

export function PainelSemInformacao({ areas, semDado }: {
  areas: PainelDeComandoArea[];
  semDado: PainelOperacionalSemDado[];
}) {
  const lista = areas.filter((a) => a.severidade === 'SEM_DADO');
  if (lista.length === 0) return null;
  return (
    <Panel title="Sem informação hoje" sub="Áreas sem dado suficiente para avaliar: não é a mesma coisa que zero">
      {lista.map((area) => (
        <div key={area.chave} className="obs-tela">
          <b>{area.titulo}.</b> {semDado.find((s) => s.bloco === area.chave)?.motivo ?? 'Sem dado para avaliar hoje.'}
        </div>
      ))}
    </Panel>
  );
}

export function PainelDeComando() {
  const { usuario } = useAuth();
  const navegar = useNav();
  const { dados, erro, recarregar, atualizar } = usePainelOperacional();
  const toast = useToast();
  const [salas, setSalas] = useState<SalaComEtapa[]>([]);
  const estadoDaLista = useState<EstadoDaLista>({ aberta: false, filtro: '' });
  useEffect(() => {
    getSalasProducao().then((r) => setSalas(r.salas)).catch(() => setSalas([]));
  }, []);
  const gravarSalaDaPendencia = async (item: Pendencia, sala: string) => {
    try {
      await definirSalaDaAbertura(item.transferencia_id!, sala);
      toast('Sala gravada.');
      await atualizar();
    } catch (e) {
      const err = e as { response?: { data?: { erro?: string } }; message: string };
      toast(err.response?.data?.erro ?? err.message, true);
    }
  };

  const marcarSemColheita = (item: Pendencia) => marcarEAvisar(item, toast, atualizar);
  const verificarRetirada = (item: Pendencia) => verificarEAvisar(item, toast, atualizar);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!dados) return <div className="loading">Montando o painel de comando…</div>;
  if (!dados.painel_de_comando) {
    return (
      <div className="empty">
        Este servidor ainda não tem o Painel de Comando (campo <code>painel_de_comando</code> ausente
        na resposta). Atualize o backend para a versão mais recente e recarregue esta página.
      </div>
    );
  }

  const { areas, resumo } = dados.painel_de_comando;
  const irPara = (destino: string, ancora?: string | null) => navegar(destino as ViewId, ancora);
  const irParaPendencia = (item: Pendencia) => abrirPendencia(item, { abrirJornadaEm, abrirContaminadosEm, irPara });

  return (
    <>
      <div className="cabecalho-comando">
        <p className="cc-data">
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })}
        </p>
        <div className="cc-saudacao">
          <span>Olá, {usuario?.nome ?? 'gerente'}</span>
          <button type="button" className="btn ghost" onClick={recarregar}>Atualizar dados</button>
        </div>
      </div>

      <div className="kpi-grid k4">
        <Kpi label="Ações Hoje" value={num(resumo.acoes)} tone="alert" delta="Itens que exigem atenção imediata" />
        <Kpi label="Atenções" value={num(resumo.atencoes)} delta="Acompanhar e agir em breve" />
        <Kpi label="Áreas OK" value={num(resumo.ok)} tone="good" delta="Situação dentro do esperado" />
        <Kpi label="Sem Dado" value={num(resumo.sem_dado)} tone="info" delta="Informações não disponíveis" />
      </div>

      {areas.length === 0 ? (
        <div className="empty">Nenhuma área para exibir.</div>
      ) : (
        <div className="kpi-grid k5">
          {areas.map((a) => <CardAreaComando key={a.chave} area={a} onNavegar={irPara} />)}
        </div>
      )}

      <PainelPendencias pendencias={dados.pendencias} onAbrir={irParaPendencia} salas={salas} onGravarSala={gravarSalaDaPendencia}
        onNaoHouveColheita={marcarSemColheita} onVerificar={podeVerificarRetirada(usuario?.role) ? verificarRetirada : undefined}
        estado={estadoDaLista} onAviso={toast} />

      <PainelSemInformacao areas={areas} semDado={dados.sem_dado} />
    </>
  );
}
