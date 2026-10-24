import { useCallback, useEffect, useState } from 'react';
import { num } from '../api/client';
import { dataBr } from '../api/constantes';
import {
  criarVersaoDoCadastro, ENTRADA_DA_CARGA, getCadastroMestre, registrarMudancaDaSala, type AtividadeDoCadastro, type CadastroMestre as Cadastro,
  type ClassificacaoDaAtividade, type EtapaDaAtividade, type MudancaDaSala, type NovaVersao, type SalaDeFrutificacao, type StatusDaVersao,
  type TipoDaFrequencia, type VigenciaDaSala,
} from '../api/cadastroMestre';
import { CampoData } from '../components/CampoData';
import { Panel, useConfirmar, useToast } from '../components/ui';

export const ROTULO_DA_ETAPA: Record<EtapaDaAtividade, string> = {
  BLOCO: 'Bloco', BANDEJA: 'Bandeja', CONTAMINACAO: 'Contaminação', ENTREGA: 'Entrega', GERAL: 'Geral', COMPARTILHADO: 'Compartilhado',
};
export const ROTULO_DA_CLASSIFICACAO: Record<ClassificacaoDaAtividade, string> = {
  CUSTO_DO_BLOCO: 'Custo do bloco', CUSTO_DA_BANDEJA: 'Custo da bandeja', PREJUIZO_POR_CONTAMINACAO: 'Prejuízo por contaminação',
  CUSTO_DA_BANDEJA_ENTREGUE: 'Custo da bandeja entregue', DESPESA_GERAL: 'Despesa geral', DESPESA_COMPARTILHADA: 'Despesa compartilhada',
  CUSTO_INDIRETO_DE_PRODUCAO: 'Custo indireto de produção',
};
const ROTULO_DO_STATUS: Record<StatusDaVersao, string> = { CONFIRMADO: 'Confirmado', REFERENCIA: 'Referência' };
const ROTULO_DA_FREQUENCIA: Record<TipoDaFrequencia, string> = { POR_SEMANA: 'Vezes por semana', POR_MES: 'Vezes por mês', A_CADA_DIAS: 'A cada N dias' };
const TETO_DA_FREQUENCIA: Record<TipoDaFrequencia, number> = { POR_SEMANA: 7, POR_MES: 31, A_CADA_DIAS: 366 };

export const AVISO_DO_CADASTRO = 'Cada atividade tem os tempos por versão. Para mudar um tempo, cadastre uma versão nova a partir '
  + 'da data em que ela passa a valer: as versões anteriores não mudam, e os meses de antes continuam com a versão deles. '
  + 'A primeira versão vale também para os meses anteriores a ela. As horas-homem são a equipe vezes os minutos de cada pessoa, '
  + 'multiplicadas pelas execuções no período; na atividade por sala, também pelas salas de frutificação em uso em cada dia. '
  + 'As horas de cada colaborador não são guardadas.';

export const AVISO_DAS_SALAS = 'Cada sala vale da data de entrada até a véspera da data de saída: a atividade por sala de um dia conta as salas '
  + 'em uso naquele dia, e o mês em que uma sala entra ou sai fica proporcional aos dias dela. Entrada e saída valem de uma data deste mês '
  + 'até hoje e não se alteram nem se apagam: os meses anteriores não mudam.';

const umaCasa = (x: number) => Math.round(x * 10) / 10;

export function totaisDasHoras(atividades: AtividadeDoCadastro[]) {
  const naConta = atividades.filter((a) => a.vigente?.status === 'CONFIRMADO');
  return {
    atividades: naConta.length,
    por_semana: umaCasa(naConta.reduce((t, a) => t + umaCasa(a.vigente!.horas_homem.por_semana), 0)),
    por_30_dias: umaCasa(naConta.reduce((t, a) => t + umaCasa(a.vigente!.horas_homem.por_30_dias), 0)),
  };
}

export type FormVersao = {
  desde: string; equipe: string; minutos: string; frequencia_tipo: TipoDaFrequencia; frequencia_n: string;
  por_sala: boolean; status: StatusDaVersao; motivo: string;
};

export function formularioDa(a: AtividadeDoCadastro): FormVersao {
  const v = a.vigente ?? a.versoes[a.versoes.length - 1] ?? null;
  return {
    desde: '', equipe: v ? String(v.equipe) : '', minutos: v ? String(v.minutos_por_pessoa) : '',
    frequencia_tipo: v?.frequencia_tipo ?? 'POR_SEMANA', frequencia_n: v ? String(v.frequencia_n) : '',
    por_sala: v?.por_sala ?? false, status: v?.status ?? 'CONFIRMADO', motivo: '',
  };
}

const inteiro = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);

export function corpoDaVersao(codigo: string, v: FormVersao): { corpo: NovaVersao } | { falta: string } {
  const equipe = inteiro(v.equipe);
  const minutos = inteiro(v.minutos);
  const n = inteiro(v.frequencia_n);
  if (!v.desde) return { falta: 'Escolha a data em que a versão passa a valer.' };
  if (equipe == null || equipe < 1 || equipe > 100) return { falta: 'A equipe é um número inteiro de pessoas, de 1 a 100.' };
  if (minutos == null || minutos < 1 || minutos > 1440) return { falta: 'Os minutos por pessoa são um número inteiro, de 1 a 1.440.' };
  const teto = TETO_DA_FREQUENCIA[v.frequencia_tipo];
  if (n == null || n < 1 || n > teto) return { falta: `A frequência é um número inteiro, de 1 a ${num(teto)}.` };
  if (v.motivo.trim().length < 3) return { falta: 'Escreva o motivo da mudança.' };
  return {
    corpo: {
      codigo, desde: v.desde, equipe, minutos_por_pessoa: minutos, frequencia_tipo: v.frequencia_tipo, frequencia_n: n,
      por_sala: v.por_sala, status: v.status, motivo: v.motivo.trim(),
    },
  };
}

function FormularioDaVersao({ a, v, salvando, onMudar, onGravar, onCancelar }: {
  a: AtividadeDoCadastro; v: FormVersao; salvando: boolean;
  onMudar: (v: FormVersao) => void; onGravar: () => void | Promise<void>; onCancelar: () => void;
}) {
  const r = corpoDaVersao(a.codigo, v);
  const ultima = a.versoes[a.versoes.length - 1];
  return (
    <Panel title={`Nova versão: ${a.nome} (${a.codigo})`} sub={`${ultima ? `A última é a versão ${ultima.versao}, desde ${dataBr(ultima.desde)}: a nova vale depois dela, ` : 'A versão vale '}a partir de uma data deste mês ou do próximo.`}>
      <div className="form-grid c4">
        <div className="fg"><label>Vale desde <span className="req">*</span></label>
          <CampoData value={v.desde} disabled={salvando} onChange={(iso) => onMudar({ ...v, desde: iso })} /></div>
        <div className="fg"><label>Equipe (pessoas) <span className="req">*</span></label>
          <input type="number" min={1} max={100} step={1} value={v.equipe} disabled={salvando} onChange={(e) => onMudar({ ...v, equipe: e.target.value })} /></div>
        <div className="fg"><label>Minutos por pessoa <span className="req">*</span></label>
          <input type="number" min={1} max={1440} step={1} value={v.minutos} disabled={salvando} onChange={(e) => onMudar({ ...v, minutos: e.target.value })} /></div>
        <div className="fg"><label>Frequência <span className="req">*</span></label>
          <select value={v.frequencia_tipo} disabled={salvando} onChange={(e) => onMudar({ ...v, frequencia_tipo: e.target.value as TipoDaFrequencia })}>
            {(Object.keys(ROTULO_DA_FREQUENCIA) as TipoDaFrequencia[]).map((t) => <option key={t} value={t}>{ROTULO_DA_FREQUENCIA[t]}</option>)}
          </select></div>
        <div className="fg"><label>{v.frequencia_tipo === 'A_CADA_DIAS' ? 'A cada quantos dias' : 'Quantas vezes'} <span className="req">*</span></label>
          <input type="number" min={1} max={TETO_DA_FREQUENCIA[v.frequencia_tipo]} step={1} value={v.frequencia_n} disabled={salvando} onChange={(e) => onMudar({ ...v, frequencia_n: e.target.value })} /></div>
        <div className="fg"><label>Por sala</label>
          <label><input type="checkbox" checked={v.por_sala} disabled={salvando} onChange={(e) => onMudar({ ...v, por_sala: e.target.checked })} /> uma vez em cada sala de frutificação em uso</label></div>
        <div className="fg"><label>Status <span className="req">*</span></label>
          <select value={v.status} disabled={salvando} onChange={(e) => onMudar({ ...v, status: e.target.value as StatusDaVersao })}>
            <option value="CONFIRMADO">Confirmado: entra no custo</option>
            <option value="REFERENCIA">Referência: fica fora do custo</option>
          </select></div>
        <div className="fg"><label>Motivo da mudança <span className="req">*</span></label>
          <input value={v.motivo} maxLength={500} disabled={salvando} onChange={(e) => onMudar({ ...v, motivo: e.target.value })} /></div>
        <div className="fg"><label>&nbsp;</label>
          <button className="btn" disabled={'falta' in r || salvando} onClick={onGravar}>{salvando ? 'Salvando…' : 'Cadastrar versão'}</button></div>
        <div className="fg"><label>&nbsp;</label>
          <button className="btn ghost" disabled={salvando} onClick={onCancelar}>Cancelar</button></div>
      </div>
      {'falta' in r && <div className="obs-tela">{r.falta}</div>}
    </Panel>
  );
}

export function TabelaDoCadastro({ atividades, onNovaVersao }: { atividades: AtividadeDoCadastro[]; onNovaVersao?: (a: AtividadeDoCadastro) => void }) {
  const t = totaisDasHoras(atividades);
  return (
    <div className="tbl-scroll">
      <table className="tbl">
        <thead>
          <tr>
            <th>Código</th><th>Etapa</th><th>Atividade</th><th>Classificação</th><th className="num">Equipe</th><th className="num">Minutos por pessoa</th>
            <th>Frequência</th><th className="num">Horas-homem por semana</th><th className="num">Horas-homem em 30 dias</th><th>Status</th><th>Entra no custo</th><th>Versão</th><th />
          </tr>
        </thead>
        <tbody>
          {atividades.map((a) => {
            const v = a.vigente;
            return (
              <tr key={a.codigo}>
                <td>{a.codigo}</td><td>{ROTULO_DA_ETAPA[a.etapa]}</td><td>{a.nome}</td><td>{ROTULO_DA_CLASSIFICACAO[a.classificacao]}</td>
                <td className="num">{v ? num(v.equipe) : '—'}</td>
                <td className="num">{v ? num(v.minutos_por_pessoa) : '—'}</td>
                <td>{v ? v.frequencia : 'sem versão'}</td>
                <td className="num">{v ? num(umaCasa(v.horas_homem.por_semana), 1) : '—'}</td>
                <td className="num">{v ? num(umaCasa(v.horas_homem.por_30_dias), 1) : '—'}</td>
                <td>{v ? ROTULO_DO_STATUS[v.status] : '—'}</td>
                <td>{v?.status === 'CONFIRMADO' ? 'sim' : 'não'}</td>
                <td>{v ? `${v.versao}, desde ${dataBr(v.desde)}` : '—'}</td>
                <td>{onNovaVersao && <button type="button" className="gr-toggle" onClick={() => onNovaVersao(a)}>Nova versão</button>}</td>
              </tr>
            );
          })}
          <tr className="ln-total">
            <td>TOTAL</td><td /><td>{`${num(t.atividades)} atividades que entram no custo (linhas com sim)`}</td><td /><td /><td /><td />
            <td className="num">{num(t.por_semana, 1)}</td><td className="num">{num(t.por_30_dias, 1)}</td><td /><td /><td /><td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function HistoricoDasVersoes({ atividades }: { atividades: AtividadeDoCadastro[] }) {
  const linhas = atividades.flatMap((a) => [...a.versoes].reverse().map((v) => ({ a, v })));
  return (
    <div className="tbl-scroll">
      <table className="tbl">
        <thead>
          <tr><th>Código</th><th>Atividade</th><th>Versão</th><th>Vale desde</th><th className="num">Equipe</th><th className="num">Minutos por pessoa</th><th>Frequência</th><th>Status</th><th>Motivo</th><th>Cadastrada em</th><th>Por</th></tr>
        </thead>
        <tbody>
          {linhas.map(({ a, v }) => (
            <tr key={`${a.codigo}|${v.versao}`}>
              <td>{a.codigo}</td><td>{a.nome}</td><td>{v.versao}</td><td>{dataBr(v.desde)}</td>
              <td className="num">{num(v.equipe)}</td><td className="num">{num(v.minutos_por_pessoa)}</td><td>{v.frequencia}</td>
              <td>{ROTULO_DO_STATUS[v.status]}</td><td>{v.motivo ?? '—'}</td><td>{new Date(v.criado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td><td>{v.criado_por_nome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function textoDaConfirmacao(a: AtividadeDoCadastro, desde: string): string {
  const extenso = new Date(`${desde}T12:00:00Z`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `${a.nome} (${a.codigo}): a versão nova vale a partir de ${extenso}. Depois de cadastrada ela não se altera nem se apaga, e a próxima só pode valer depois dessa data. Cadastrar?`;
}

export function textoDoPeriodo(v: VigenciaDaSala): string {
  const de = v.entrada === ENTRADA_DA_CARGA ? 'Desde antes do gerencial' : `Desde ${dataBr(v.entrada)}`;
  return v.saida ? `${de}, saída em ${dataBr(v.saida)}` : `${de}, em uso`;
}

export type FormSala = { sala: SalaDeFrutificacao; mudanca: MudancaDaSala; data: string; motivo: string };

export function corpoDaMudanca(f: FormSala): { corpo: { data: string; motivo: string } } | { falta: string } {
  if (!f.data) return { falta: `Escolha a data ${f.mudanca === 'entrada' ? 'de entrada' : 'de saída'} da sala.` };
  if (f.motivo.trim().length < 3) return { falta: 'Escreva o motivo.' };
  return { corpo: { data: f.data, motivo: f.motivo.trim() } };
}

export function textoDaConfirmacaoDaSala(f: FormSala): string {
  const extenso = new Date(`${f.data}T12:00:00Z`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return f.mudanca === 'entrada'
    ? `${f.sala.nome}: entra em uso em ${extenso} e conta na atividade por sala desse dia em diante. A entrada não se altera nem se apaga. Registrar?`
    : `${f.sala.nome}: sai de uso em ${extenso} e deixa de contar na atividade por sala desse dia em diante; os dias antes continuam com ela. A saída não se altera nem se apaga. Registrar?`;
}

export function SalasDeFrutificacao({ salas, onMudar }: { salas: SalaDeFrutificacao[]; onMudar?: (s: SalaDeFrutificacao, m: MudancaDaSala) => void }) {
  return (
    <div className="tbl-scroll">
      <table className="tbl">
        <thead><tr><th>Sala</th><th>Hoje</th><th>Períodos em uso</th><th /></tr></thead>
        <tbody>
          {salas.map((s) => (
            <tr key={s.id}>
              <td>{s.nome}</td>
              <td>{s.em_uso_hoje ? 'em uso' : 'fora de uso'}</td>
              <td>{s.vigencias.length ? s.vigencias.map(textoDoPeriodo).join('; ') : 'Nunca entrou em uso'}</td>
              <td>{onMudar && (
                <button type="button" className="gr-toggle" onClick={() => onMudar(s, s.em_uso_hoje ? 'saida' : 'entrada')}>
                  {s.em_uso_hoje ? 'Registrar saída' : 'Registrar entrada'}
                </button>
              )}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormularioDaSala({ f, salvando, onMudar, onGravar, onCancelar }: {
  f: FormSala; salvando: boolean; onMudar: (f: FormSala) => void; onGravar: () => void | Promise<void>; onCancelar: () => void;
}) {
  const r = corpoDaMudanca(f);
  const entrada = f.mudanca === 'entrada';
  return (
    <Panel title={`${entrada ? 'Entrada' : 'Saída'} da sala: ${f.sala.nome}`}
      sub={entrada ? 'A sala conta na atividade por sala a partir da data de entrada, de uma data deste mês até hoje.'
        : 'A sala deixa de contar na atividade por sala a partir da data de saída, de uma data deste mês até hoje. Os períodos anteriores ficam no histórico.'}>
      <div className="form-grid c4">
        <div className="fg"><label>{entrada ? 'Data de entrada' : 'Data de saída'} <span className="req">*</span></label>
          <CampoData value={f.data} disabled={salvando} onChange={(iso) => onMudar({ ...f, data: iso })} /></div>
        <div className="fg"><label>Motivo <span className="req">*</span></label>
          <input value={f.motivo} maxLength={500} disabled={salvando} onChange={(e) => onMudar({ ...f, motivo: e.target.value })} /></div>
        <div className="fg"><label>&nbsp;</label>
          <button className="btn" disabled={'falta' in r || salvando} onClick={onGravar}>{salvando ? 'Salvando…' : entrada ? 'Registrar entrada' : 'Registrar saída'}</button></div>
        <div className="fg"><label>&nbsp;</label>
          <button className="btn ghost" disabled={salvando} onClick={onCancelar}>Cancelar</button></div>
      </div>
      {'falta' in r && <div className="obs-tela">{r.falta}</div>}
    </Panel>
  );
}

export function CadastroMestre() {
  const toast = useToast();
  const confirmar = useConfirmar();
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [erro, setErro] = useState('');
  const [aberta, setAberta] = useState<AtividadeDoCadastro | null>(null);
  const [v, setV] = useState<FormVersao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [fs, setFs] = useState<FormSala | null>(null);

  const recarregar = useCallback(() => {
    setErro('');
    getCadastroMestre().then(setCadastro).catch((e) => setErro(e?.response?.data?.erro ?? e.message));
  }, []);
  useEffect(recarregar, [recarregar]);

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!cadastro) return <div className="loading">Carregando o Cadastro Mestre…</div>;

  const abrir = (a: AtividadeDoCadastro) => { setAberta(a); setV(formularioDa(a)); };
  const fechar = () => { setAberta(null); setV(null); };
  const gravar = async () => {
    if (!aberta || !v) return;
    const r = corpoDaVersao(aberta.codigo, v);
    if ('falta' in r) return;
    if (!(await confirmar(textoDaConfirmacao(aberta, r.corpo.desde)))) return;
    setSalvando(true);
    criarVersaoDoCadastro(r.corpo)
      .then((x) => { toast(`${aberta.nome}: versão ${x.versao} cadastrada, vale desde ${dataBr(x.desde)}.`); fechar(); recarregar(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };
  const gravarSala = async () => {
    if (!fs) return;
    const r = corpoDaMudanca(fs);
    if ('falta' in r) return;
    if (!(await confirmar(textoDaConfirmacaoDaSala(fs)))) return;
    setSalvando(true);
    registrarMudancaDaSala(fs.sala.id, fs.mudanca, r.corpo)
      .then(() => { toast(`${fs.sala.nome}: ${fs.mudanca === 'entrada' ? 'entrada' : 'saída'} registrada em ${dataBr(r.corpo.data)}.`); setFs(null); recarregar(); })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };
  const salas = cadastro.salas_de_frutificacao;
  const textoDasSalas = salas.quantidade > 0
    ? `${num(salas.quantidade)} ${salas.quantidade === 1 ? 'sala de frutificação em uso' : 'salas de frutificação em uso'} hoje (${salas.nomes.join(', ')}).`
    : 'Nenhuma sala de frutificação em uso hoje: a atividade por sala fica com zero hora.';

  return (
    <>
      {aberta && v && <FormularioDaVersao a={aberta} v={v} salvando={salvando} onMudar={setV} onGravar={gravar} onCancelar={fechar} />}
      <Panel title="Atividades e tempos que valem hoje" sub={AVISO_DO_CADASTRO} tag={`${cadastro.atividades.length} atividades`}>
        <TabelaDoCadastro atividades={cadastro.atividades} onNovaVersao={abrir} />
        <div className="obs-tela">{`${textoDasSalas} A versão Referência fica fora do custo, para não somar duas vezes a mesma hora. As horas por semana e em 30 dias usam a versão e as salas de hoje; o custo de cada mês usa, dia a dia, a versão que valia no dia e as salas em uso no dia.`}</div>
      </Panel>
      {fs && <FormularioDaSala f={fs} salvando={salvando} onMudar={setFs} onGravar={gravarSala} onCancelar={() => setFs(null)} />}
      <Panel title="Salas de frutificação" sub={AVISO_DAS_SALAS} tag={`${num(salas.quantidade)} em uso hoje`}>
        <SalasDeFrutificacao salas={salas.salas} onMudar={(sala, mudanca) => setFs({ sala, mudanca, data: '', motivo: '' })} />
      </Panel>
      <Panel title="Histórico das versões" tag={`${cadastro.atividades.reduce((t, a) => t + a.versoes.length, 0)} versões`}>
        <HistoricoDasVersoes atividades={cadastro.atividades} />
      </Panel>
    </>
  );
}
