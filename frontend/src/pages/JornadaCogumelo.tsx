import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  acrescentarEstantesAoLote,
  atualizarColheitaJornada, atualizarLoteJornada, CORES_CONTAMINACAO, criarLoteJornada, dataBr,
  definirSalaDaAbertura,
  excluirColheitaJornada, excluirLoteJornada, getDetalhesDoLoteJornada, getProducaoJornada, getReceitasSubstrato,
  criarPessoa, getRegrasMaturacao, getSalasProducao, getSementesCepas, hojeISO, listarLiberacoes, listarPessoas,
  listarTransferenciasJornada, listarAberturasJornada, type AberturaGravada, num,
  registrarAberturaJornada, registrarColheitaJornada, registrarContaminado, registrarDivergencia, registrarLiberacao,
  registrarTransferenciasJornada,
  atualizarEventoAtipicoJornada, excluirEventoAtipicoJornada, listarEventosAtipicosDoLote,
  registrarEventoAtipicoJornada, registrarEventoAtipicoNoLoteInteiroJornada,
  galpaoCurto, ordenarGalpoes, rotuloDoGalpao,
  type BatidaDaAutoclave, type CorpoDoEventoAtipico, type DetalhesDoLoteJornada, type EventoAtipico,
  type ExclusaoLoteJornada, type JornadaLinha, type Liberacao, type Pendencia, type Pessoa,
  type ReceitaSubstrato, type RegraMaturacao,
  type SalaComEtapa, type SementeCepa, type TipoContaminado, type TransferenciaSalva,
} from '../api/client';
import {
  horaValida, rotuloDoEventoAtipico, TEXTO_MAX_DO_EVENTO_ATIPICO, TIPO_FALTA_DE_ENERGIA, TIPO_OUTROS,
  TIPOS_DE_EVENTO_ATIPICO,
} from '../../../src/services/eventosAtipicos.js';
import { AcaoNaoHouveColheita, marcarEAvisar } from '../components/AcaoNaoHouveColheita';
import { AcaoSalaDaAbertura } from '../components/AcaoSalaDaAbertura';
import { ListaDePendencias, type EstadoDaLista } from '../components/ListaDePendencias';
import { BotaoExportar } from '../components/BotaoExportar';
import { CampoData } from '../components/CampoData';
import { SelectPessoa, SelectPessoas } from '../components/SelectPessoa';
import { salasDeFrutificacao, SelectSala, type SalaOpcao } from '../components/SelectSala';
import { criarGuardaDeCorrida, usePainelOperacional, useRecarregarAtual } from '../components/BlocosOperacionais';
import { Panel, useConfirmar, useNav, useToast } from '../components/ui';
import { abrirContaminadosEm, recadoDaPendencia } from './recadoDeContaminados';

const CHAVE_FILTRO_PENDENTE = 'exemplo:jornada:abrir-em';
export function abrirJornadaEm(
  dataLote: string,
  armazenamento: Pick<Storage, 'setItem'> | undefined = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined,
): void {
  try { armazenamento?.setItem(CHAVE_FILTRO_PENDENTE, dataLote); } catch { }
}
export function lerFiltroPendente(
  armazenamento: Pick<Storage, 'getItem'> | undefined = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined,
): string | null {
  try { return armazenamento?.getItem(CHAVE_FILTRO_PENDENTE) ?? null; } catch { return null; }
}
export function descartarFiltroPendente(
  armazenamento: Pick<Storage, 'removeItem'> | undefined = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined,
): void {
  try { armazenamento?.removeItem(CHAVE_FILTRO_PENDENTE); } catch { }
}

export function PainelPendenciasJornada({ pendencias, salas = [], onGravarSala, onCorrigirContaminado, onNaoHouveColheita, estado, onAviso }: {
  pendencias: Pendencia[];
  salas?: SalaOpcao[];
  onGravarSala?: (item: Pendencia, sala: string) => Promise<void>;
  onCorrigirContaminado?: (item: Pendencia) => void;
  onNaoHouveColheita?: (item: Pendencia) => Promise<void>;
  estado?: [EstadoDaLista, (e: EstadoDaLista) => void];
  onAviso?: (texto: string, erro?: boolean) => void;
}) {
  const itens = pendencias.filter((i) => i.tipo !== 'RETIRADA_ACIMA_DO_LIMITE');
  return (
    <ListaDePendencias itens={itens} estado={estado} onAviso={onAviso} copiar={false} acoes={(item) => (
      <>
        {onGravarSala && <AcaoSalaDaAbertura item={item} salas={salas} onGravar={onGravarSala} />}
        {onCorrigirContaminado && item.tipo === 'CONTAMINADO_SEM_ESTANTE' && (
          <button type="button" className="btn ghost split-btn" onClick={() => onCorrigirContaminado(item)}>Corrigir em Contaminados</button>
        )}
        {onNaoHouveColheita && <AcaoNaoHouveColheita item={item} onMarcar={onNaoHouveColheita} />}
      </>
    )} />
  );
}

export const COLUNAS = [
  'Tipo (SP/SH/SB/SS)', 'NF - Semente', 'Receita', 'Semeados (lote)', 'Nº de blocos Produzidos',
  'Nº de blocos Guardados', 'Nº de misturas (batidas)',
  'Capela',
  'Galpão de maturação', 'Estante da Maturação', 'Estante hoje no galpão',
  'Nº total de blocos Contaminados',
  'Dias até a abertura', 'Data de abertura', 'Nº de blocos Abertos',
  'Estante da Abertura', 'Abertura concluída', 'Estante da Frutificação',
  'Data da Colheita', 'Estante da Colheita',
  'KG Colhidos tam PP (SH)', 'KG Colhidos tam P (SH)', 'KG Colhidos tam M (SH)',
  'KG Colhidos tam G (SH)', 'KG Colhidos tam GG (SH)', 'Total Kg Colhidos',
];

const TIPOS = ['SH', 'SP', 'SB', 'SS'];
type FormAtivo = 'lote' | 'abertura' | 'colheita' | 'contaminacao' | 'transferencia' | 'liberacao' | 'eventos' | null;

type AlvoEdicao = 'lote' | 'colheita';
interface Edicao { alvo: AlvoEdicao; linha: JornadaLinha }

export type ZerouOpcao = '' | 'SIM' | 'NAO';

interface LoteOpcao {
  lote_id: number; rotulo: string; titulo: string; tipo: string; zerou_estante: boolean | null;
  estante_frutificacao: string | null; abertura_por_estante: boolean;
  blocos_abertos?: number | null;
  status?: JornadaLinha['status'];
  maturacao?: string | null;
  estante_maturacao?: string | null;
  data_lote?: string | null;
}

const LIMITE_ROTULO_LOTE = 60;

export function dicaDeFiltroNoSeletor(qtdLotes: number, temFiltro: boolean): string | null {
  if (!temFiltro) return null;
  if (qtdLotes === 0) {
    return 'Nenhum lote no filtro atual: a lista de lotes abaixo está vazia por causa dos filtros do fim da página, não porque não existam lotes.';
  }
  return `Os filtros do fim da página também limitam esta lista: ${qtdLotes} lote(s) para escolher.`;
}

export function frutificacaoLegivel(valor: string | null | undefined): string | null {
  const limpo = (valor ?? '').trim();
  return limpo === '' || limpo === '0' ? null : limpo;
}

export function rotuloDoLote(
  l: Pick<JornadaLinha,
  'data_lote' | 'tipo' | 'galpao' | 'estante_maturacao' | 'data_abertura' | 'estante_frutificacao'>
  & { status?: JornadaLinha['status'] },
  mostrarAbertura: boolean,
  regras: Parameters<typeof rotuloDoGalpao>[1] = [],
): { rotulo: string; titulo: string } {
  const frut = frutificacaoLegivel(l.estante_frutificacao);
  const base = `${dataBr(l.data_lote)} · ${l.tipo} · ${l.galpao != null ? rotuloDoGalpao(l.galpao, regras) : '—'} / mat. ${l.estante_maturacao ?? '—'}`
    + (frut ? ` · frut. ${frut}` : '');
  const comStatus = l.status === 'ENCERRADO' ? `${base} (encerrado)` : base;
  const titulo = mostrarAbertura && l.data_abertura
    ? `${comStatus}: já aberto em ${dataBr(l.data_abertura)}`
    : comStatus;
  const rotulo = titulo.length > LIMITE_ROTULO_LOTE ? `${titulo.slice(0, LIMITE_ROTULO_LOTE)}…` : titulo;
  return { rotulo, titulo };
}

export function lotesUnicos(linhas: JornadaLinha[], mostrarAbertura: boolean, regras: Parameters<typeof rotuloDoGalpao>[1] = []): LoteOpcao[] {
  const vistos = new Map<number, LoteOpcao>();
  for (const l of linhas) {
    if (!vistos.has(l.lote_id)) {
      const { rotulo, titulo } = rotuloDoLote(l, mostrarAbertura, regras);
      vistos.set(l.lote_id, {
        lote_id: l.lote_id, tipo: l.tipo, rotulo, titulo, zerou_estante: l.zerou_estante,
        estante_frutificacao: l.estante_frutificacao, abertura_por_estante: l.abertura_por_estante,
        blocos_abertos: l.blocos_abertos, status: l.status ?? null,
        maturacao: l.galpao != null && l.galpao.trim() !== '' ? rotuloDoGalpao(l.galpao, regras) : null,
        estante_maturacao: l.estante_maturacao ?? null,
        data_lote: l.data_lote ?? null,
      });
    }
  }
  return [...vistos.values()];
}

export function estantesDoMesmoLote(lotes: LoteOpcao[], loteId: string): LoteOpcao[] {
  const escolhida = lotes.find((l) => String(l.lote_id) === loteId);
  if (!escolhida?.data_lote) return escolhida ? [escolhida] : [];
  return lotes.filter((l) => l.data_lote === escolhida.data_lote && l.tipo === escolhida.tipo);
}

export const avisoDoLoteInteiro = (n: number): string =>
  `Ocorrência registrada em ${n} ${n === 1 ? 'estante' : 'estantes'} do lote.`;

export const loteJaConcluido = (lotes: LoteOpcao[], loteId: string): boolean =>
  lotes.find((l) => String(l.lote_id) === loteId)?.zerou_estante === true;

export const aberturasGravadas = (lotes: LoteOpcao[], loteId: string): string | null => {
  const lote = lotes.find((l) => String(l.lote_id) === loteId);
  if (!lote || !lote.abertura_por_estante) return null;
  const lista = (lote.estante_frutificacao ?? '').trim();
  return lista === '' ? null : lista;
};

export const textoJaAberto = (lotes: LoteOpcao[], loteId: string): string | null => {
  const lista = aberturasGravadas(lotes, loteId);
  const n = Number(lotes.find((l) => String(l.lote_id) === loteId)?.blocos_abertos) || 0;
  if (lista && n > 0) return `Já gravadas neste lote: ${lista}, com ${n} bloco(s) aberto(s).`;
  if (lista) return `Já gravadas neste lote: ${lista}.`;
  if (n > 0) return `Já abertos neste lote: ${n} bloco(s).`;
  return null;
};

const destinoDaAbertura = (sala: string | null | undefined, estante: string | null | undefined) =>
  (sala ? `${sala}/${estante ?? ''}` : (estante ?? ''));

export const horaDoRegistro = (iso: string | null | undefined): string => {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

export function textoAberturaRegistrada(dataAbertura: string, r: unknown): string {
  const resposta = (r ?? {}) as {
    lote?: { blocos_abertos?: number | null };
    destinos?: Array<{ sala_destino?: string | null; estante_destino?: string; sala?: string; estante?: string; quantidade?: number | null }>;
  };
  const partes = (resposta.destinos ?? []).map((d) => {
    const onde = destinoDaAbertura(d.sala_destino ?? d.sala, d.estante_destino ?? d.estante);
    return d.quantidade == null ? `${onde} (sem a quantidade)` : `${num(d.quantidade)} bloco(s) na ${onde}`;
  });
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}` : (partes[0] ?? '');
  const total = resposta.lote?.blocos_abertos;
  return `Abertura de ${dataBr(dataAbertura)} registrada${lista ? `: ${lista}` : ''}.`
    + (total == null ? '' : ` A estante soma agora ${num(total)} bloco(s) abertos.`);
}

export function resumoDasAberturas(linhas: AberturaGravada[], blocosAbertos: number | null): string {
  const comNumero = linhas.filter((l) => l.quantidade != null);
  const soma = comNumero.reduce((s, l) => s + (l.quantidade ?? 0), 0);
  const semNumero = linhas.length - comNumero.length;
  const frases: string[] = [];
  if (linhas.length === 0) frases.push('Nenhuma abertura com data registrada nesta estante.');
  else frases.push(`Soma das aberturas com data: ${num(soma)} bloco(s).`);
  if (semNumero > 0) frases.push(`${num(semNumero)} abertura(s) sem a quantidade de blocos.`);
  if (blocosAbertos != null) {
    frases.push(`Total aberto da estante: ${num(blocosAbertos)}.`);
    const diferenca = blocosAbertos - soma;
    if (diferenca > 0) {
      frases.push(`${num(diferenca)} bloco(s) do total não estão em nenhuma abertura com data e quantidade: `
        + 'já estavam abertos antes (planilha, Editar lote ou registro antigo). Eles já contam no total; não registre de novo.');
    }
    if (diferenca < 0) frases.push(`A soma das aberturas passa do total em ${num(-diferenca)} bloco(s).`);
  }
  return frases.join(' ');
}

export function HistoricoDeAberturas({ linhas, blocosAbertos }: { linhas: AberturaGravada[]; blocosAbertos: number | null }) {
  return (
    <div className="fg" style={{ gridColumn: '1 / -1' }}>
      <div className="fsec">Aberturas já registradas nesta estante</div>
      {linhas.length > 0 && (
        <div className="plan-wrap cp">
          <table className="plan cp">
            <thead>
              <tr>
                <th className="rotulo">Data da abertura</th>
                <th className="rotulo">Estante de frutificação</th>
                <th className="num">Blocos</th>
                <th className="rotulo">Quem abriu</th>
                <th className="rotulo">Registrada em</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td className="rotulo">{dataBr(l.data)}</td>
                  <td className="rotulo">{destinoDaAbertura(l.sala_destino, l.estante_destino)}</td>
                  <td className="num">{l.quantidade == null ? '—' : num(l.quantidade)}</td>
                  <td className="rotulo">{l.registrado_por ?? '—'}</td>
                  <td className="rotulo">{horaDoRegistro(l.created_at) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <span className="fixvar-none" role="status">{resumoDasAberturas(linhas, blocosAbertos)}</span>
    </div>
  );
}

interface NovoLote {
  data_lote: string; tipo: string; nf_semente?: string;
  blocos_produzidos?: number; galpao?: string; estante_maturacao?: string;
  misturas?: number;
  blocos_guardados?: number;
  blocos_semeados?: number;
  responsavel_pesagem?: string; responsavel_semeacao?: string; responsavel_conferencia?: string;
  responsavel_selagem?: string;
  receitaId?: number;
  sementes?: Array<{ cepaId: number; nf: string; loteSemente?: string | null; vencimento?: string | null }>;
  permitir_duplicata?: boolean;
  lote_pesquisa?: boolean;
  capela_ligada?: boolean;
  autoclave?: Array<{
    ordem: number;
    responsavel?: string;
    entrada?: string;
    atingiu_121?: string;
    fim_2h?: string;
    houve_queda_121?: boolean;
    pressao_na_faixa?: boolean;
    ocorrido?: string;
    observacoes?: string;
    conferido_por?: string;
  }>;
}

export const opcNum = (s: string) => {
  const t = s.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

export const opcNumEdicao = (s: string, editando: boolean) => (
  s.trim() === '' && editando ? null : opcNum(s)
);

export function somaDePesagens(texto: string): { total: number | null; parcelas: number[]; erro: string | null } {
  const t = texto.trim();
  if (t === '') return { total: null, parcelas: [], erro: null };
  const partes = t.split('+').map((p) => p.trim());
  if (partes.some((p) => p === '')) return { total: null, parcelas: [], erro: 'Só números e +' };
  const parcelas = partes.map((p) => Number(p.replace(',', '.')));
  if (parcelas.some((n) => !Number.isFinite(n))) return { total: null, parcelas: [], erro: 'Só números e +' };
  const soma = parcelas.reduce((s, n) => s + n, 0);
  return { total: parcelas.length > 1 ? Math.round(soma * 1000) / 1000 : soma, parcelas, erro: null };
}

const somaEdicao = (texto: string, editando: boolean) => (
  texto.trim() === '' && editando ? null : somaDePesagens(texto).total ?? undefined
);

export const abertosInvalidos = (s: string) => s.trim() !== '' && Number(s) === 0;
const AVISO_ABERTOS_ZERO = '0 não é quantidade: deixe o campo vazio para “não informado”.';

const AVISO_ESTANTE_CONCLUIDA = 'Esta estante já está com a abertura concluída (SIM). Registrar de novo altera a abertura gravada, e o sistema vai pedir confirmação.';
const AVISO_SOMAR = 'A abertura que você registrar agora soma a essas: informe só as estantes e os blocos abertos agora.';
const AVISO_REGRAVAR = 'Registrar de novo substitui essa lista com a data e as quantidades digitadas agora: inclua as estantes antigas com a quantidade de cada uma.';

export const PERGUNTA_REABERTURA = 'Este lote já está com a abertura concluída (SIM). Registrar de novo SUBSTITUI a lista de estantes gravada por esta. Gravar assim mesmo?';
export const PERGUNTA_REABERTURA_SOMA = 'Este lote já está com a abertura concluída (SIM). Registrar de novo SOMA esta abertura às gravadas. Gravar assim mesmo?';

export type AberturaExtra = { permitir_reabertura?: true; permitir_encerrado?: true; permitir_duplicata?: true };

export const perguntaAberturaDuplicada = (textoDoBackend: string | undefined) =>
  `${textoDoBackend ?? 'Esta estante já tem uma abertura igual gravada.'}\n\nRegistrar mesmo assim uma SEGUNDA abertura igual?`;
export const ABERTURA_DUPLICADA_NAO_GRAVADA = 'Abertura não registrada: nada deste envio foi gravado, e a que já estava gravada continua valendo.';

export const perguntaAberturaEncerrado = (textoDoBackend: string | undefined) =>
  `${(textoDoBackend ?? 'Este lote está encerrado').split('. ')[0]}. Registrar a abertura mesmo assim?`;

export async function aberturaComConfirmacao<B extends { destinos: unknown; substituir?: boolean }>(
  enviar: (corpo: B & AberturaExtra) => Promise<unknown>,
  b: B,
  confirmar: (texto: string) => Promise<boolean>,
  extra: AberturaExtra = {},
): Promise<unknown> {
  try {
    return await enviar({ ...b, ...extra });
  } catch (e) {
    const err = e as { response?: { status?: number; data?: { erro?: string; codigo?: string } } };
    if (err.response?.status !== 409) throw e;
    const encerrado = err.response.data?.codigo === 'LOTE_ENCERRADO';
    const duplicada = err.response.data?.codigo === 'ABERTURA_DUPLICADA';
    const chave: keyof AberturaExtra = encerrado ? 'permitir_encerrado'
      : duplicada ? 'permitir_duplicata' : 'permitir_reabertura';
    if (extra[chave]) throw e;
    const pergunta = encerrado ? perguntaAberturaEncerrado(err.response.data?.erro)
      : duplicada ? perguntaAberturaDuplicada(err.response.data?.erro)
        : b.substituir ? PERGUNTA_REABERTURA : PERGUNTA_REABERTURA_SOMA;
    if (!(await confirmar(pergunta))) {
      throw new Error(duplicada ? ABERTURA_DUPLICADA_NAO_GRAVADA
        : 'Abertura não registrada: a lista de estantes gravada foi mantida.');
    }
    return aberturaComConfirmacao(enviar, b, confirmar, { ...extra, [chave]: true });
  }
}

const dataInput = (iso: string | null | undefined) => (iso ?? '').slice(0, 10);

export const zerouDoBanco = (v: boolean | null): ZerouOpcao => (v == null ? '' : v ? 'SIM' : 'NAO');

export const zerouParaOBanco = (o: ZerouOpcao): boolean | null => (o === '' ? null : o === 'SIM');

export const NOME_PRODUTO_POR_TIPO: Record<string, string> = {
  SH: 'Shiitake', SP: 'Shimeji Preto', SB: 'Shimeji Branco',
};

export function opcoesDeReceita(
  receitas: ReceitaSubstrato[], tipo: string,
): Array<{ id: number; rotulo: string }> {
  const nomeProduto = NOME_PRODUTO_POR_TIPO[tipo];
  if (!nomeProduto) return [];
  return receitas
    .filter((r) => r.produto_nome === nomeProduto && r.status !== 'INATIVA')
    .sort((a, b) => a.versao - b.versao)
    .map((r) => ({
      id: r.id,
      rotulo: r.status === 'TESTE' ? `${r.nome} (em teste)` : r.nome,
    }));
}

export function cepasParaTipo(cepas: SementeCepa[], tipo: string): SementeCepa[] {
  const ativas = cepas.filter((c) => c.ativo);
  const nomeProduto = NOME_PRODUTO_POR_TIPO[tipo];
  return nomeProduto ? ativas.filter((c) => c.tipo_cogumelo === nomeProduto) : ativas;
}

export interface LinhaSemente { id: number; cepaId: string; nf: string; lote?: string; vencimento?: string }
type ParDeSemente = Omit<LinhaSemente, 'id'>;

const linhaCompleta = (l: ParDeSemente) => l.cepaId !== '' && l.nf.trim() !== '';

export function erroDaSemente(linhas: ParDeSemente[]): string | null {
  const soOLote = linhas.findIndex((l) => l.cepaId === '' && l.nf.trim() === '' && Boolean(l.lote?.trim() || l.vencimento));
  if (soOLote !== -1) return `Semente ${soOLote + 1}: falta a cepa e a NF (o lote da semente ou o vencimento já está preenchido).`;
  const i = linhas.findIndex((l) => (l.cepaId !== '') !== (l.nf.trim() !== ''));
  if (i === -1) return null;
  return linhas[i].cepaId === ''
    ? `Semente ${i + 1}: falta escolher a cepa (a NF já está preenchida).`
    : `Semente ${i + 1}: falta a NF (a cepa já está escolhida).`;
}

export function sementesParaEnvio(
  linhas: ParDeSemente[],
): Array<{ cepaId: number; nf: string; loteSemente: string | null; vencimento: string | null }> | undefined {
  const validas = linhas.filter(linhaCompleta).map((l) => ({
    cepaId: Number(l.cepaId), nf: l.nf.trim(),
    loteSemente: l.lote?.trim() || null,
    vencimento: l.vencimento || null,
  }));
  return validas.length ? validas : undefined;
}

export function textoDaSemente(linhas: ParDeSemente[], cepas: SementeCepa[]): string {
  const porCepa = new Map<string, string[]>();
  for (const l of linhas.filter(linhaCompleta)) {
    const codigo = cepas.find((c) => String(c.id) === l.cepaId)?.codigo;
    if (!codigo) continue;
    const nfs = porCepa.get(codigo) ?? [];
    nfs.push(l.nf.trim());
    porCepa.set(codigo, nfs);
  }
  return [...porCepa.entries()].map(([codigo, nfs]) => `${codigo} - ${nfs.join(', ')}`).join('; ');
}

export const nfSementeEfetivo = (atual: string, derivado: string, tocado: boolean) => (
  tocado ? atual : derivado
);

export const cepaDaProximaLinha = (linhas: ParDeSemente[]): string => (
  linhas.length ? linhas[linhas.length - 1].cepaId : ''
);

export interface LinhaAutoclave {
  id: number;
  responsavel: string;
  entrada: string;
  atingiu121: string;
  fim2h: string;
  houveQueda121: ZerouOpcao;
  pressaoNaFaixa: ZerouOpcao;
  ocorrido: string;
  observacoes: string;
  conferidoPor: string;
}

const linhaAutoclaveVazia = (l: LinhaAutoclave) => (
  l.responsavel.trim() === '' && l.entrada === '' && l.atingiu121 === '' && l.fim2h === ''
  && l.houveQueda121 === '' && l.pressaoNaFaixa === '' && l.ocorrido.trim() === ''
  && l.observacoes.trim() === '' && l.conferidoPor.trim() === ''
);

export function autoclaveParaEnvio(linhas: LinhaAutoclave[] | undefined): NovoLote['autoclave'] {
  const validas = (linhas ?? []).filter((l) => !linhaAutoclaveVazia(l));
  if (!validas.length) return undefined;
  return validas.map((l, i) => ({
    ordem: i + 1,
    ...(l.responsavel.trim() !== '' ? { responsavel: l.responsavel.trim() } : {}),
    ...(l.entrada !== '' ? { entrada: l.entrada } : {}),
    ...(l.atingiu121 !== '' ? { atingiu_121: l.atingiu121 } : {}),
    ...(l.fim2h !== '' ? { fim_2h: l.fim2h } : {}),
    ...(l.houveQueda121 !== '' ? { houve_queda_121: l.houveQueda121 === 'SIM' } : {}),
    ...(l.pressaoNaFaixa !== '' ? { pressao_na_faixa: l.pressaoNaFaixa === 'SIM' } : {}),
    ...(l.ocorrido.trim() !== '' ? { ocorrido: l.ocorrido.trim() } : {}),
    ...(l.observacoes.trim() !== '' ? { observacoes: l.observacoes.trim() } : {}),
    ...(l.conferidoPor.trim() !== '' ? { conferido_por: l.conferidoPor.trim() } : {}),
  }));
}

export interface LinhaEndereco {
  id: number;
  galpao: string;
  estante: string;
  blocos: string;
}

export interface ValoresNovoLote {
  data_lote: string; tipo: string; nf_semente: string;
  responsavel_pesagem: string; responsavel_semeacao: string; responsavel_conferencia: string;
  responsavel_selagem?: string;
  receitaId: string;
  misturas: string;
  blocos_semeados: string;
  lote_pesquisa?: ZerouOpcao;
  capela_ligada?: ZerouOpcao;
  sementes: LinhaSemente[];
  autoclave?: LinhaAutoclave[];
  enderecos: LinhaEndereco[];
}

const FRASE_UMA_ESTANTE = 'Uma estante por linha. Para várias estantes, adicione uma linha para cada.';

const linhaVazia = (l: LinhaEndereco) => (
  l.galpao.trim() === '' && l.estante.trim() === '' && l.blocos.trim() === ''
);

const somaDosBlocos = (linhas: LinhaEndereco[]) => linhas
  .reduce((s, l) => s + (opcNum(l.blocos) ?? 0), 0);

export function enderecosParaEnvio(
  linhas: LinhaEndereco[],
  galpoes: string[] = [],
  { semeados = '' }: { semeados?: string } = {},
): { ok: true; enderecos: LinhaEndereco[] } | { ok: false; erro: string } {
  const preenchidas: LinhaEndereco[] = [];
  const porEstante = new Map<string, LinhaEndereco>();
  for (const [i, l] of linhas.entries()) {
    if (linhaVazia(l)) continue;
    const estante = l.estante.trim();
    const galpao = l.galpao.trim();
    if (estante === '') return { ok: false, erro: `Informe a estante da linha ${i + 1}.` };
    if (estante.includes(',')) return { ok: false, erro: FRASE_UMA_ESTANTE };
    if (galpao !== '' && galpoes.length > 0 && !galpoes.includes(galpao)) {
      return { ok: false, erro: `O galpão "${galpao}" não existe; os galpões com regra são ${galpoes.join(', ')}.` };
    }
    if (l.blocos.trim() === '') return { ok: false, erro: `Informe os blocos da estante da linha ${i + 1}.` };
    const blocos = opcNum(l.blocos);
    if (blocos === undefined || !Number.isInteger(blocos) || blocos < 0) {
      return { ok: false, erro: `Blocos da estante da linha ${i + 1}: informe um número inteiro ≥ 0.` };
    }
    const chave = chaveDaEstante(galpao, estante);
    preenchidas.push(l);
    const primeira = porEstante.get(chave);
    porEstante.set(chave, primeira ? { ...primeira, blocos: String(opcNum(primeira.blocos)! + blocos) } : l);
  }
  const total = opcNum(semeados);
  if (semeados.trim() !== '' && (total === undefined || !Number.isInteger(total) || total < 0)) {
    return { ok: false, erro: 'Blocos semeados: informe um número inteiro ≥ 0, ou deixe vazio.' };
  }
  const soma = somaDosBlocos(preenchidas);
  if (total !== undefined && soma > total) {
    return { ok: false, erro: `As estantes somam ${num(soma)} blocos e o lote tem ${num(total)} semeados: confira.` };
  }
  return { ok: true, enderecos: [...porEstante.values()] };
}

const chaveDaEstante = (galpao: string, estante: string) => JSON.stringify([galpao.trim(), estante.trim()]);

export function avisoDasEstantesSomadas(
  linhas: LinhaEndereco[],
  galpoes: string[] = [],
  regras: Parameters<typeof rotuloDoGalpao>[1] = [],
): string {
  if (!enderecosParaEnvio(linhas, galpoes).ok) return '';
  const porEstante = new Map<string, LinhaEndereco[]>();
  for (const l of linhas) {
    if (linhaVazia(l)) continue;
    const chave = chaveDaEstante(l.galpao, l.estante);
    porEstante.set(chave, [...(porEstante.get(chave) ?? []), l]);
  }
  return [...porEstante.values()].filter((ls) => ls.length > 1).map((ls) => {
    const galpao = ls[0].galpao.trim();
    const nome = galpao !== '' ? `${galpaoCurto(galpao, regras)}/${ls[0].estante.trim()}` : `Estante ${ls[0].estante.trim()}`;
    return `${nome}: ${ls.length} linhas somadas, ${num(somaDosBlocos(ls))} blocos numa estante só.`;
  }).join(' ');
}

export function corposDoLote(v: ValoresNovoLote): NovoLote[] {
  const validacao = enderecosParaEnvio(v.enderecos, [], { semeados: v.blocos_semeados });
  const enderecos = validacao.ok ? validacao.enderecos : [];
  const misturas = opcNum(v.misturas);
  const semeados = opcNum(v.blocos_semeados);
  const sementes = sementesParaEnvio(v.sementes);
  const autoclave = autoclaveParaEnvio(v.autoclave);
  const lotePesquisa = v.lote_pesquisa == null || v.lote_pesquisa === '' ? undefined : v.lote_pesquisa === 'SIM';
  const capelaLigada = v.capela_ligada == null || v.capela_ligada === '' ? undefined : v.capela_ligada === 'SIM';
  const comum: NovoLote = {
    data_lote: v.data_lote, tipo: v.tipo,
    nf_semente: v.nf_semente || undefined,
    responsavel_semeacao: v.responsavel_semeacao || undefined,
    responsavel_conferencia: v.responsavel_conferencia || undefined,
    ...(v.responsavel_pesagem ? { responsavel_pesagem: v.responsavel_pesagem } : {}),
    ...(v.responsavel_selagem ? { responsavel_selagem: v.responsavel_selagem } : {}),
    ...(v.receitaId ? { receitaId: Number(v.receitaId) } : {}),
    ...(lotePesquisa !== undefined ? { lote_pesquisa: lotePesquisa } : {}),
  };
  return enderecos.map((e, i) => {
    const blocos = opcNum(e.blocos);
    return {
      ...comum,
      ...(e.galpao.trim() ? { galpao: e.galpao.trim() } : {}),
      estante_maturacao: e.estante.trim(),
      ...(blocos !== undefined ? { blocos_produzidos: blocos, blocos_guardados: blocos } : {}),
      ...(i === 0 && misturas !== undefined ? { misturas } : {}),
      ...(i === 0 && semeados !== undefined ? { blocos_semeados: semeados } : {}),
      ...(i === 0 && sementes !== undefined ? { sementes } : {}),
      ...(i === 0 && autoclave !== undefined ? { autoclave } : {}),
      ...(i === 0 && capelaLigada !== undefined ? { capela_ligada: capelaLigada } : {}),
    };
  });
}

type Batelada = Pick<NovoLote, 'misturas' | 'blocos_semeados' | 'sementes' | 'autoclave' | 'capela_ligada'>;
export type ResultadoLote = { item: NovoLote; ok: boolean; erro?: string };

export function repartirBatelada(corpos: NovoLote[]): { batelada: Batelada; linhas: NovoLote[] } {
  const batelada: Batelada = {};
  const linhas = corpos.map((c) => {
    const { misturas, blocos_semeados, sementes, autoclave, capela_ligada, ...linha } = c;
    if (misturas !== undefined) batelada.misturas = misturas;
    if (blocos_semeados !== undefined) batelada.blocos_semeados = blocos_semeados;
    if (sementes !== undefined) batelada.sementes = sementes;
    if (autoclave !== undefined) batelada.autoclave = autoclave;
    if (capela_ligada !== undefined) batelada.capela_ligada = capela_ligada;
    return linha;
  });
  return { batelada, linhas };
}

export async function enviarLotesComBatelada(
  corpos: NovoLote[],
  tentar: (corpo: NovoLote) => Promise<{ ok: true } | { ok: false; erro: string }>,
): Promise<ResultadoLote[]> {
  const { batelada, linhas } = repartirBatelada(corpos);
  let bateladaPendente = true;
  const resultados: ResultadoLote[] = [];
  for (const linha of linhas) {
    const corpo = bateladaPendente ? { ...linha, ...batelada } : linha;
    const r = await tentar(corpo);
    if (r.ok) bateladaPendente = false;
    resultados.push(r.ok ? { item: corpo, ok: true } : { item: corpo, ok: false, erro: r.erro });
  }
  return resultados;
}

export function linhasQueFicam(
  linhas: LinhaEndereco[],
  resultados: Array<{ item: { galpao?: string; estante_maturacao?: string }; ok: boolean }>,
): LinhaEndereco[] {
  const gravadas = new Set(resultados.filter((r) => r.ok)
    .map((r) => chaveDaEstante(r.item.galpao ?? '', r.item.estante_maturacao ?? '')));
  return linhas.filter((l) => !gravadas.has(chaveDaEstante(l.galpao, l.estante)));
}

export function valoresAposEnvio(
  v: ValoresNovoLote,
  resultados: Array<{ item: { galpao?: string; estante_maturacao?: string }; ok: boolean; erro?: string }>,
): ValoresNovoLote {
  const algumaGravou = resultados.some((r) => r.ok);
  return {
    ...v,
    enderecos: linhasQueFicam(v.enderecos, resultados),
    ...(algumaGravou ? { misturas: '', blocos_semeados: '', sementes: [], autoclave: [], capela_ligada: '' } : {}),
  };
}

export const contarColheitasPorLote = (linhas: JornadaLinha[]) => {
  const m = new Map<number, number>();
  for (const l of linhas) {
    if (l.colheita_id != null) m.set(l.lote_id, (m.get(l.lote_id) ?? 0) + 1);
  }
  return m;
};

const zerouTexto = (v: boolean | null) => (v == null ? '' : v ? 'SIM' : 'NÃO');

export const divergeGuardado = (
  l: Pick<JornadaLinha, 'blocos_produzidos' | 'blocos_guardados'>,
) => l.blocos_produzidos != null && l.blocos_guardados != null
  && l.blocos_produzidos !== l.blocos_guardados;

export function CelulaGuardado({ l }: {
  l: Pick<JornadaLinha, 'blocos_produzidos' | 'blocos_guardados'>;
}) {
  const diverge = divergeGuardado(l);
  return (
    <td className={`num${diverge ? ' neg' : ''}`}
      title={diverge
        ? `Guardado (${num(l.blocos_guardados)}) diverge do produzido (${num(l.blocos_produzidos)}).`
        : undefined}>
      {l.blocos_guardados != null ? num(l.blocos_guardados) : ''}
    </td>
  );
}

export function linhasMaisRecentePrimeiro(linhas: JornadaLinha[]): JornadaLinha[] {
  const grupos: JornadaLinha[][] = [];
  for (const l of linhas) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo[0].lote_id === l.lote_id) ultimo.push(l);
    else grupos.push([l]);
  }
  return grupos.reverse().flat();
}

export const textoConfirmacaoExclusaoLote = (l: JornadaLinha, colheitas: number, regras: Parameters<typeof rotuloDoGalpao>[1] = []): string => (
  `Excluir o LOTE INTEIRO nº ${l.lote_id}, de ${dataBr(l.data_lote)}: ${l.tipo}, galpão `
  + `${l.galpao != null ? rotuloDoGalpao(l.galpao, regras) : '—'}, estante ${l.estante_maturacao ?? '—'}?\n\n`
  + 'Vai junto tudo o que está pendurado nele:\n'
  + `• ${colheitas} colheita(s) já lançada(s) neste lote;\n`
  + '• os eventos de contaminação do lote (esta tela soma '
  + `${num(l.blocos_contaminados)} bloco(s) contaminado(s));\n`
  + '• a abertura registrada;\n'
  + '• a semente do lote (cepa e notas fiscais), se houver cadastro;\n'
  + '• o endereçamento em estantes do lote, se houver;\n'
  + '• as transferências entre estantes e as batidas de autoclave do lote, se houver;\n'
  + '• os eventos atípicos e as divergências de contagem do lote, se houver.\n\n'
  + 'Não dá para desfazer.'
);

export const textoRelatoExclusaoLote = (d: Partial<ExclusaoLoteJornada> | null): string => {
  const outros = d?.outros_eventos_apagados ?? 0;
  const alocacoes = d?.alocacoes_apagadas ?? 0;
  const sementes = d?.sementes_apagadas ?? 0;
  const estantes = d?.estantes_apagadas ?? 0;
  const transferencias = d?.transferencias_apagadas ?? 0;
  const autoclaves = d?.autoclaves_apagadas ?? 0;
  const atipicas = d?.ocorrencias_atipicas_apagadas ?? 0;
  const divergencias = d?.divergencias_apagadas ?? 0;
  const verificacoes = d?.verificacoes_apagadas ?? 0;
  return `Lote ${d?.codigo ?? ''} excluído: ${d?.colheitas_apagadas ?? 0} colheita(s) e `
    + `${d?.eventos_apagados ?? 0} evento(s) de contaminação apagados junto`
    + (outros || alocacoes || sementes || estantes
      ? `, mais ${outros} outro(s) evento(s) do lote, ${alocacoes} alocação(ões), `
        + `${sementes} semente(s) e ${estantes} estante(s).`
      : '.')
    + (transferencias || autoclaves
      ? ` Também foram apagadas ${transferencias} transferência(s) entre estantes e ${autoclaves} batida(s) de autoclave.`
      : '')
    + (atipicas || divergencias
      ? ` Também foram apagados ${atipicas} evento(s) atípico(s) e ${divergencias} divergência(s) de contagem.`
      : '')
    + (verificacoes ? ` Também foram apagados ${verificacoes} Verificado(s) do Alerta de Retirada Acima do Limite.` : '');
};

export type ConfirmacaoExtra = { permitir_duplicata?: boolean; permitir_encerrado?: boolean; permitir_dia_sem_colheita?: boolean };

export const LANCAMENTO_CANCELADO = 'Lançamento cancelado.';

export async function tentarComConfirmacao<T>(
  acao: (extra: ConfirmacaoExtra) => Promise<T>,
  rotulo: string,
  confirmar: (texto: string, codigo?: string) => Promise<boolean>,
  extra: ConfirmacaoExtra = {},
): Promise<{ ok: true; valor: T } | { ok: false; erro: string }> {
  try {
    const valor = await acao(extra);
    return { ok: true, valor };
  } catch (e) {
    const err = e as { response?: { status?: number; data?: { erro?: string; codigo?: string } }; message: string };
    const texto = err.response?.data?.erro ?? err.message;
    if (err.response?.status !== 409) return { ok: false, erro: texto };
    const codigo = err.response?.data?.codigo;
    if (codigo === 'LOTE_GRAVADO_AO_MESMO_TEMPO') return { ok: false, erro: texto };
    const encerrado = codigo === 'LOTE_ENCERRADO';
    const diaSemColheita = codigo === 'DIA_SEM_COLHEITA';
    const chave: keyof ConfirmacaoExtra = encerrado ? 'permitir_encerrado'
      : diaSemColheita ? 'permitir_dia_sem_colheita' : 'permitir_duplicata';
    if (extra[chave]) return { ok: false, erro: texto };
    const pergunta = diaSemColheita ? texto
      : encerrado ? `${texto}\n\nLançar mesmo assim?`
        : `${texto}\n\nGravar assim mesmo uma SEGUNDA ${rotulo}?`;
    if (!(await confirmar(pergunta, codigo))) return { ok: false, erro: LANCAMENTO_CANCELADO };
    return tentarComConfirmacao(acao, rotulo, confirmar, { ...extra, [chave]: true });
  }
}

export const perguntaLoteEncerrado = (dataEncerramento?: string | null) =>
  `Este lote está encerrado${dataEncerramento ? ` desde ${dataBr(dataEncerramento)}` : ''}. Lançar mesmo assim?`;

export const mensagemDaPerda = (r?: { qtd_blocos?: number | null }) =>
  (r?.qtd_blocos != null ? `Perda registrada: ${r.qtd_blocos} blocos.` : 'Perda registrada.');

export async function lancarNoLote<T, R>(
  lote: { status?: string | null; data_encerramento?: string | null } | undefined,
  confirmar: (texto: string) => Promise<boolean>,
  itens: T[],
  sequencia: (itens: T[], tentar: (item: T) => Promise<{ ok: true } | { ok: false; erro: string }>) => Promise<R[]>,
  tentar: (item: T, extraLote: ConfirmacaoExtra) => Promise<{ ok: true } | { ok: false; erro: string }>,
): Promise<R[] | null> {
  let extraLote: ConfirmacaoExtra = {};
  if (lote?.status === 'ENCERRADO') {
    if (!(await confirmar(perguntaLoteEncerrado(lote.data_encerramento)))) return null;
    extraLote = { permitir_encerrado: true };
  }
  return sequencia(itens, (item) => tentar(item, extraLote));
}

export function memoriaDoLoteEncerrado(confirmar: (texto: string) => Promise<boolean>) {
  return memoriaDaResposta(confirmar, 'LOTE_ENCERRADO');
}

export function memoriaDaResposta(confirmar: (texto: string) => Promise<boolean>, codigoLembrado: string) {
  let resposta: boolean | undefined;
  return {
    recusou: () => resposta === false,
    confirmar: async (texto: string, codigo?: string) => {
      if (codigo !== codigoLembrado) return confirmar(texto);
      if (resposta === undefined) resposta = await confirmar(texto);
      return resposta;
    },
  };
}

export function lancarColheitasDoDia(
  lote: { status?: string | null; data_encerramento?: string | null } | undefined,
  confirmar: (texto: string) => Promise<boolean>,
  corpos: CorpoColheita[],
  registrar: (c: CorpoColheita, extra: ConfirmacaoExtra) => Promise<unknown>,
): Promise<ResultadoColheita[] | null> {
  const memoria = memoriaDaResposta(confirmar, 'DIA_SEM_COLHEITA');
  return lancarNoLote(lote, confirmar, corpos, enviarEmSequencia, (c, extraLote) => (memoria.recusou()
    ? Promise.resolve({ ok: false as const, erro: LANCAMENTO_CANCELADO })
    : tentarComConfirmacao((extra) => registrar(c, extra), `colheita da estante ${c.estante}`, memoria.confirmar, extraLote)));
}

export function JornadaCogumelo() {
  const toast = useToast();
  const confirmar = useConfirmar();
  const navegar = useNav();
  const [linhas, setLinhas] = useState<JornadaLinha[] | null>(null);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState<FormAtivo>(null);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [detalhesEdicao, setDetalhesEdicao] = useState<
    { loteId: number; dados: DetalhesDoLoteJornada | null; erro: boolean } | null
  >(null);
  const loteEmEdicao = edicao?.alvo === 'lote' ? edicao.linha.lote_id : null;
  useEffect(() => {
    if (loteEmEdicao == null) { setDetalhesEdicao(null); return undefined; }
    let vivo = true;
    setDetalhesEdicao({ loteId: loteEmEdicao, dados: null, erro: false });
    getDetalhesDoLoteJornada(loteEmEdicao)
      .then((dados) => { if (vivo) setDetalhesEdicao({ loteId: loteEmEdicao, dados, erro: false }); })
      .catch(() => { if (vivo) setDetalhesEdicao({ loteId: loteEmEdicao, dados: null, erro: true }); });
    return () => { vivo = false; };
  }, [loteEmEdicao]);
  const [erroSaldo, setErroSaldo] = useState<ErroSaldo | null>(null);

  const [filtroPendente] = useState(() => lerFiltroPendente());
  useEffect(() => { descartarFiltroPendente(); }, []);
  const [fTipo, setFTipo] = useState('');
  const [fGalpao, setFGalpao] = useState('');
  const [fInicio, setFInicio] = useState(filtroPendente ?? '');
  const [fFim, setFFim] = useState(filtroPendente ?? '');

  const { dados: dadosPainel, atualizar: atualizarPendencias } = usePainelOperacional();
  const pendencias = dadosPainel?.pendencias?.itens ?? [];
  const estadoDaLista = useState<EstadoDaLista>({ aberta: false, filtro: '' });

  const guarda = useRef(criarGuardaDeCorrida());
  const recarregarDoFiltro = useCallback(() => {
    const id = guarda.current.iniciar();
    setErro('');
    getProducaoJornada({
      tipo: fTipo || undefined, galpao: fGalpao || undefined,
      inicio: fInicio || undefined, fim: fFim || undefined,
    })
      .then((ls) => { if (guarda.current.vale(id)) setLinhas(ls); })
      .catch((e) => { if (guarda.current.vale(id)) setErro(e?.response?.data?.erro ?? e.message); });
    atualizarPendencias();
  }, [fTipo, fGalpao, fInicio, fFim, atualizarPendencias]);
  useEffect(recarregarDoFiltro, [recarregarDoFiltro]);
  const recarregar = useRecarregarAtual(recarregarDoFiltro);

  const corrigirContaminado = (item: Pendencia) => {
    abrirContaminadosEm(recadoDaPendencia(item));
    navegar('contaminados');
  };
  const marcarSemColheita = (item: Pendencia) => marcarEAvisar(item, toast, atualizarPendencias);
  const gravarSalaDaPendencia = async (item: Pendencia, sala: string) => {
    try {
      await definirSalaDaAbertura(item.transferencia_id!, sala);
      toast('Sala gravada.');
      recarregar();
    } catch (e) {
      const err = e as { response?: { data?: { erro?: string } }; message: string };
      toast(err.response?.data?.erro ?? err.message, true);
    }
  };

  const galpoesDoFiltro = useMemo(
    () => [...new Set((linhas ?? []).map((l) => l.galpao).filter((g): g is string => g != null))].sort(),
    [linhas],
  );

  const [galpoes, setGalpoes] = useState<string[]>([]);
  const [regras, setRegras] = useState<RegraMaturacao[]>([]);
  const [salas, setSalas] = useState<SalaComEtapa[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  useEffect(() => {
    getRegrasMaturacao()
      .then((r) => { setGalpoes(galpoesDasRegras(r)); setRegras(r); })
      .catch(() => { setGalpoes([]); setRegras([]); });
    getSalasProducao()
      .then((r) => setSalas(r.salas))
      .catch(() => setSalas([]));
    listarPessoas()
      .then(setPessoas)
      .catch(() => setPessoas([]));
  }, []);
  async function criarPessoaNaTela(nome: string) {
    const p = await criarPessoa(nome);
    setPessoas((prev) => (prev.some((x) => x.nome === p.nome)
      ? prev
      : [...prev, { ...p, ativa: true }].sort((a, b) => a.nome.localeCompare(b.nome))));
  }

  const lotes = useMemo(() => lotesUnicos(linhas ?? [], false, regras), [linhas, regras]);

  const lotesParaAbertura = useMemo(() => lotesUnicos(linhas ?? [], true, regras), [linhas, regras]);

  const temFiltroAtivo = Boolean(fTipo || fGalpao || fInicio || fFim);
  const dicaFiltro = dicaDeFiltroNoSeletor(lotes.length, temFiltroAtivo);

  const colheitasPorLote = useMemo(() => contarColheitasPorLote(linhas ?? []), [linhas]);

  const linhasExibidas = useMemo(() => linhasMaisRecentePrimeiro(linhas ?? []), [linhas]);

  const indicesPrimeiraLinha = useMemo(() => {
    const vistos = new Set<number>();
    const primeiras = new Set<number>();
    linhasExibidas.forEach((l, i) => {
      if (vistos.has(l.lote_id)) return;
      vistos.add(l.lote_id);
      primeiras.add(i);
    });
    return primeiras;
  }, [linhasExibidas]);

  const refEdicao = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!edicao) return;
    const bloco = refEdicao.current;
    if (!bloco) return;
    bloco.scrollIntoView({ behavior: 'smooth', block: 'center' });
    bloco.querySelector<HTMLElement>('input:not([readonly]), select')?.focus();
  }, [edicao]);

  async function enviar(
    acao: () => Promise<unknown>,
    msg: string | ((r: unknown) => string),
    opcoes: { manterForm?: boolean } = {},
  ) {
    setSalvando(true);
    setErroSaldo(null);
    try {
      const r = await acao();
      toast(typeof msg === 'function' ? msg(r) : msg);
      if (!opcoes.manterForm) setForm(null);
      setEdicao(null);
      recarregar();
      return r;
    } catch (e) {
      const err = e as { response?: { data?: { erro?: string; codigo?: string; detalhe?: { sobra: number; informado: number } } }; message: string };
      toast(err.response?.data?.erro ?? err.message, true);
      if (err.response?.data?.codigo === 'SALDO_EXCEDIDO') setErroSaldo(err.response.data.detalhe ?? null);
    } finally {
      setSalvando(false);
    }
  }

  function comEscutaDeSaldo<T>(chamada: Promise<T>, rotulo?: string): Promise<T> {
    return chamada.catch((e: unknown) => {
      const err = e as { response?: { data?: { codigo?: string; detalhe?: { sobra: number; informado: number } } } };
      const detalhe = err.response?.data?.codigo === 'SALDO_EXCEDIDO' ? err.response.data.detalhe : null;
      setErroSaldo(detalhe ? { ...detalhe, ...(rotulo ? { rotulo } : {}) } : null);
      throw e;
    });
  }

  function registrarDivergenciaNaTela(corpo: {
    lote_id: number; tipo: 'ABERTURA' | 'RETIRADA'; data: string;
    esperado: number; informado: number; responsavel: string; observacao?: string;
  }) {
    registrarDivergencia(corpo)
      .then(() => {
        toast(`Divergência registrada; o lote continua com ${corpo.esperado} blocos até a contagem ser corrigida.`);
        setErroSaldo(null);
      })
      .catch((e) => {
        const err = e as { response?: { data?: { erro?: string } }; message: string };
        toast(err.response?.data?.erro ?? err.message, true);
      });
  }

  function enviarAbertura(id: number, b: ReturnType<typeof corpoDaAbertura>) {
    return enviar(
      () => aberturaComConfirmacao((corpo) => registrarAberturaJornada(id, corpo), b, confirmar),
      (r) => textoAberturaRegistrada(b.data_abertura, r),
    );
  }

  async function corrigirProduzidosEAbrir(id: number, novoTotal: number, pergunta: string, b: ReturnType<typeof corpoDaAbertura>) {
    if (!(await confirmar(pergunta))) return;
    await enviar(async () => {
      await atualizarLoteJornada(id, { blocos_produzidos: novoTotal });
      return aberturaComConfirmacao((corpo) => registrarAberturaJornada(id, corpo), b, confirmar);
    }, (r) => `Nº de blocos Produzidos corrigido para ${novoTotal}. ${textoAberturaRegistrada(b.data_abertura, r)}`);
  }

  async function comConfirmacaoDeDuplicata<T>(
    acao: (extra: ConfirmacaoExtra) => Promise<T>,
    msg: string | ((valor: T) => string), rotulo: string,
  ) {
    setSalvando(true);
    setErroSaldo(null);
    const r = await tentarComConfirmacao(acao, rotulo, confirmar);
    setSalvando(false);
    if (r.ok) {
      toast(typeof msg === 'function' ? msg(r.valor) : msg);
      setForm(null);
      setEdicao(null);
      recarregar();
    } else {
      toast(r.erro, true);
    }
  }

  const loteDe = (loteId: number) => lotes.find((l) => l.lote_id === loteId);

  async function enviarContaminacoesPorCor(
    loteId: number,
    itens: Array<{ cor: TipoContaminado; acao: (extra: ConfirmacaoExtra) => Promise<unknown> }>,
  ) {
    setSalvando(true);
    setErroSaldo(null);
    const resultados = await lancarNoLote(loteDe(loteId), confirmar, itens, tentarTodasEmSequencia,
      (item, extraLote) => tentarComConfirmacao(item.acao, `contaminação (${item.cor})`, confirmar, extraLote));
    setSalvando(false);
    if (!resultados) { toast(LANCAMENTO_CANCELADO, true); return; }
    const todasOk = resultados.every((r) => r.ok);
    toast(relatoContaminacaoMultipla(resultados), !todasOk);
    if (todasOk) {
      setForm(null);
      setEdicao(null);
    }
    if (resultados.some((r) => r.ok)) recarregar();
  }

  function abrirEdicao(alvo: AlvoEdicao, linha: JornadaLinha) {
    setForm(null);
    setEdicao({ alvo, linha });
  }

  async function criarColheitas(loteId: number, data: string, corpos: CorpoColheita[]): Promise<ResultadoColheita[]> {
    setSalvando(true);
    const resultados = await lancarColheitasDoDia(loteDe(loteId), confirmar, corpos,
      (c, extra) => registrarColheitaJornada(loteId, { ...c, data, ...extra }));
    setSalvando(false);
    if (!resultados) { toast(LANCAMENTO_CANCELADO, true); return []; }
    const todasOk = resultados.every((r) => r.ok);
    if (todasOk) {
      toast(relatoEnvioMultiplo(resultados, { substantivo: 'colheita', etiqueta: (c) => c.estante }));
      setForm(null); setEdicao(null);
    }
    if (resultados.some((r) => r.ok)) recarregar();
    return resultados;
  }

  async function criarLotes(corpos: NovoLote[]): Promise<ResultadoLote[]> {
    setSalvando(true);
    const resultados = await enviarLotesComBatelada(corpos, (corpo) => tentarComConfirmacao(
      (extra) => criarLoteJornada({ ...corpo, ...extra }),
      `estante ${corpo.galpao ? `${galpaoCurto(corpo.galpao, regras)}/` : ''}${corpo.estante_maturacao ?? '?'} (segundo lote no mesmo endereço)`,
      confirmar,
    ));
    setSalvando(false);
    const todasOk = resultados.every((r) => r.ok);
    if (todasOk) { toast(relatoLotesMultiplos(resultados, regras)); setForm(null); setEdicao(null); }
    if (resultados.some((r) => r.ok)) recarregar();
    return resultados;
  }

  async function pedirExclusaoLote(l: JornadaLinha) {
    const colheitas = colheitasPorLote.get(l.lote_id) ?? 0;
    const confirmado = await confirmar(textoConfirmacaoExclusaoLote(l, colheitas, regras));
    if (!confirmado) return;
    enviar(() => excluirLoteJornada(l.lote_id), (r) => (
      textoRelatoExclusaoLote(r as Partial<ExclusaoLoteJornada> | null)
    ));
  }

  async function pedirReabrirLote(l: JornadaLinha) {
    const confirmado = await confirmar(`Reabrir o lote nº ${l.lote_id}? Ele volta a contar nas estantes e na fila.`);
    if (!confirmado) return;
    enviar(() => atualizarLoteJornada(l.lote_id, { reabrir: true }), 'Lote reaberto.');
  }

  async function pedirExclusaoColheita(l: JornadaLinha) {
    if (l.colheita_id == null) return;
    const colheitaId = l.colheita_id;
    const confirmado = await confirmar(
      `Excluir SÓ a colheita de ${dataBr(l.data_colheita)} `
      + `(${num(l.total_kg, 3)} kg) do lote de ${dataBr(l.data_lote)} (${l.tipo})?\n\n`
      + 'O lote e as outras colheitas dele continuam como estão.',
    );
    if (!confirmado) return;
    enviar(() => excluirColheitaJornada(colheitaId), 'Colheita excluída.');
  }

  if (erro) return <div className="empty">Erro: {erro}</div>;
  if (!linhas) return <div className="loading">Carregando a Jornada do Cogumelo…</div>;

  return (
    <>
      <div className="export-bar">
        <BotaoExportar
          rotulo="Exportar ciclo produtivo (Excel)" />
      </div>

      <PainelPendenciasJornada pendencias={pendencias} salas={salas} onGravarSala={gravarSalaDaPendencia}
        onCorrigirContaminado={corrigirContaminado} onNaoHouveColheita={marcarSemColheita}
        estado={estadoDaLista} onAviso={toast} />

      <Panel title="Lançamentos" sub="Registre os mesmos eventos que a planilha: lote, abertura, colheita e contaminação">
        <div className="form-acao">
          {([
            ['lote', '+ Novo lote'], ['abertura', 'Registrar abertura'],
            ['colheita', 'Registrar colheita'], ['contaminacao', 'Registrar contaminação'],
            ['transferencia', 'Registrar transferência'], ['liberacao', 'Liberar estante'],
            ['eventos', 'Eventos/Condições Atípicas'],
          ] as Array<[FormAtivo, string]>).map(([id, rotulo]) => (
            <button key={id} className={form === id ? 'btn' : 'btn ghost'}
              onClick={() => { setEdicao(null); setErroSaldo(null); setForm(form === id ? null : id); }}>{rotulo}</button>
          ))}
        </div>
        {form != null && form !== 'lote' && dicaFiltro && (
          <div className="obs-tela" role="status">{dicaFiltro}</div>
        )}
        {form === 'lote' && (
          <FormLote salvando={salvando} onSubmit={criarLotes} galpoes={galpoes} regras={regras}
            pessoas={pessoas} onCriarPessoa={criarPessoaNaTela} />
        )}
        {form === 'abertura' && (
          <FormAbertura lotes={lotesParaAbertura} salas={salas} salvando={salvando} onSubmit={enviarAbertura}
            pessoas={pessoas} onCriarPessoa={criarPessoaNaTela}
            erroSaldo={erroSaldo} onRegistrarDivergencia={registrarDivergenciaNaTela}
            onCorrigirProduzidos={corrigirProduzidosEAbrir} />
        )}
        {form === 'colheita' && (
          <FormColheita lotes={lotes} salvando={salvando} onSubmit={criarColheitas} />
        )}
        {form === 'contaminacao' && (
          <FormContaminacao lotes={lotes} salvando={salvando} erroSaldo={erroSaldo}
            pessoas={pessoas} onCriarPessoa={criarPessoaNaTela}
            onRegistrarDivergencia={registrarDivergenciaNaTela}
            onSubmit={(b) => {
              if ('tipo_evento' in b) {
                comConfirmacaoDeDuplicata(
                  (extra) => comEscutaDeSaldo(registrarContaminado({
                    lote_id: b.lote_id, data_retirada: b.data_retirada,
                    quantidade: b.quantidade, saldo_total: b.saldo_total, motivo: b.motivo,
                    tipo_evento: 'PERDA', estante: b.estante, ...extra,
                  })),
                  mensagemDaPerda, 'perda',
                );
                return;
              }
              enviarContaminacoesPorCor(b.lote_id, b.cores.map((c) => ({
                cor: c.tipo_contaminado,
                acao: (extra) => comEscutaDeSaldo(registrarContaminado({
                  lote_id: b.lote_id, data_retirada: b.data_retirada,
                  quantidade: c.quantidade, tipo_contaminado: c.tipo_contaminado,
                  estante: b.estante, ...extra,
                }), c.tipo_contaminado),
              })));
            }} />
        )}
        {form === 'transferencia' && (
          <FormTransferencia lotes={lotes} salvando={salvando}
            onSubmit={(id, linhas) => enviar(
              () => registrarTransferenciasJornada(id, linhas),
              linhas.length > 1
                ? `${linhas.length} transferências registradas.`
                : 'Transferência registrada.',
              { manterForm: true },
            )} />
        )}
        {form === 'liberacao' && (
          <FormLiberacao salas={salas} salvando={salvando}
            onSubmit={(b) => enviar(
              () => registrarLiberacao(b),
              `Estante ${b.sala}/${b.estante} liberada em ${dataBr(b.data)}.`,
              { manterForm: true },
            )} />
        )}
        {form === 'eventos' && (
          <FormEventosAtipicos lotes={lotes} salvando={salvando}
            onSubmit={(id, corpo) => enviar(
              () => registrarEventoAtipicoJornada(id, corpo), 'Ocorrência registrada.', { manterForm: true },
            )}
            onSubmitLoteInteiro={(id, corpo) => enviar(
              () => registrarEventoAtipicoNoLoteInteiroJornada(id, corpo),
              (r) => avisoDoLoteInteiro((r as EventoAtipico[]).length), { manterForm: true },
            )}
            onAtualizar={(id, corpo) => enviar(
              () => atualizarEventoAtipicoJornada(id, corpo), 'Ocorrência corrigida.', { manterForm: true },
            )}
            onApagar={(e) => apagarSeConfirmado(
              () => confirmar(textoConfirmacaoExclusaoEventoAtipico(e, lotes.find((l) => l.lote_id === e.lote_id)?.rotulo)),
              () => enviar(() => excluirEventoAtipicoJornada(e.id), 'Ocorrência apagada.', { manterForm: true }),
            )} />
        )}
      </Panel>

      <Panel id="jornada-tabela" title="Jornada do Cogumelo" tag={`${linhas.length} linhas`}
        sub="Uma linha por colheita do lote: colunas idênticas às da planilha">
        <div className="filtros">
          <div className="fg">
            <label>Tipo</label>
            <select value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
              <option value="">Todos</option>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>Galpão de maturação</label>
            <select value={fGalpao} onChange={(e) => setFGalpao(e.target.value)}>
              <option value="">Todos</option>
              {ordenarGalpoes(galpoesDoFiltro, regras).map((g) => <option key={g} value={g}>{rotuloDoGalpao(g, regras)}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>Lote a partir de</label>
            <CampoData value={fInicio} onChange={setFInicio} />
          </div>
          <div className="fg">
            <label>Lote até</label>
            <CampoData value={fFim} onChange={setFFim} />
          </div>
        </div>

        {edicao && (
          <div ref={refEdicao}>
            <div className="alert-banner media">
              <strong>{edicao.alvo === 'colheita' ? 'Editando uma colheita' : 'Editando o lote'}</strong>
              <span>
                {edicao.alvo === 'colheita'
                  ? `Colheita de ${dataBr(edicao.linha.data_colheita)}, do lote de `
                    + `${dataBr(edicao.linha.data_lote)} · ${edicao.linha.tipo}. `
                    + 'O lote e as demais colheitas dele não são alterados. '
                    + 'Apagar o conteúdo de um campo limpa aquela faixa; apagar TODAS deixa o '
                    + 'total em 0 kg. Para tirar a colheita da Jornada, use “Excluir colheita”. '
                    + 'Para registrar colheita sem rendimento, digite 0.'
                  : `Lote nº ${edicao.linha.lote_id}, de ${dataBr(edicao.linha.data_lote)} · `
                    + `${edicao.linha.tipo}. Todos os campos do lote estão aqui, já preenchidos `
                    + 'com o que está gravado. Apagar o conteúdo de um campo LIMPA aquele valor '
                    + '(volta a “não informado”), e “—” limpa o “Abertura concluída”. '
                    + 'A data do lote e o tipo mudam em todas as estantes do lote, e a autoclave '
                    + 'é do lote inteiro.'}
              </span>
              <button className="btn ghost split-btn" onClick={() => setEdicao(null)}>Cancelar edição</button>
            </div>
            {edicao.alvo === 'lote' && (detalhesEdicao?.loteId !== edicao.linha.lote_id
              || (!detalhesEdicao.dados && !detalhesEdicao.erro)) ? (
              <div className="loading">Carregando o lote…</div>
            ) : edicao.alvo === 'lote' ? (
              <FormEdicaoLote key={`ed-lote-${edicao.linha.lote_id}`} salvando={salvando}
                inicial={{ ...loteDaLinha(edicao.linha), ...(detalhesEdicao?.dados ? filhasDoLote(detalhesEdicao.dados) : {}) }}
                estantesDoLote={detalhesEdicao?.dados?.estantes_do_lote ?? 1}
                avisoDasFilhas={detalhesEdicao?.erro
                  ? 'Não foi possível carregar as sementes e a autoclave deste lote. Os outros campos se corrigem normalmente; para as sementes e a autoclave, recarregue a página.'
                  : null}
                tipo={edicao.linha.tipo}
                galpoes={galpoes} regras={regras} pessoas={pessoas} onCriarPessoa={criarPessoaNaTela}
                onReabrir={() => pedirReabrirLote(edicao.linha)}
                onSubmit={(b) => {
                  const loteId = edicao.linha.lote_id;
                  comConfirmacaoDeDuplicata(
                    (extra) => atualizarLoteJornada(loteId, { ...b, ...extra }),
                    'Lote atualizado.', 'vez no mesmo endereço',
                  );
                }}
                onAcrescentar={(estantes) => {
                  const loteId = edicao.linha.lote_id;
                  const n = estantes.length;
                  comConfirmacaoDeDuplicata(
                    (extra) => acrescentarEstantesAoLote(loteId, { estantes, ...extra }),
                    `${n} estante(s) acrescentada(s) ao lote de ${dataBr(edicao.linha.data_lote)}.`,
                    'vez no mesmo endereço',
                  );
                }} />
            ) : (
              <FormEdicaoColheita key={`ed-colh-${edicao.linha.colheita_id}`} lotes={lotes} salvando={salvando}
                inicial={colheitaDaLinha(edicao.linha)} tipoFixo={edicao.linha.tipo}
                onSubmit={(b) => {
                  const colheitaId = edicao.linha.colheita_id;
                  if (colheitaId == null) return;
                  comConfirmacaoDeDuplicata(
                    (extra) => atualizarColheitaJornada(colheitaId, { ...b, ...extra }),
                    'Colheita atualizada.', 'colheita',
                  );
                }}
                onAcrescentar={(data, corpos) => criarColheitas(Number(edicao.linha.lote_id), data, corpos)} />
            )}
          </div>
        )}

        <div className="plan-wrap">
          <table className="plan">
            <thead>
              <tr>
                <th className="rotulo">DATA DO LOTE</th>
                {COLUNAS.map((c) => <th key={c} className="num">{c}</th>)}
                <th className="num">Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhasExibidas.length === 0 && (
                <tr><td className="rotulo" /><td colSpan={COLUNAS.length + 1}><div className="empty">Nenhuma linha para o filtro.</div></td></tr>
              )}
              {linhasExibidas.map((l, i) => {
                const emEdicao = edicao != null && edicao.linha.lote_id === l.lote_id
                  && edicao.linha.colheita_id === l.colheita_id;
                const temColheita = l.colheita_id != null;
                const ehPrimeira = indicesPrimeiraLinha.has(i);
                return (
                <tr key={`${l.lote_id}-${l.colheita_id ?? `s${i}`}`} className={emEdicao ? 'ln-grupo' : undefined}>
                  <td className="rotulo">{dataBr(l.data_lote)}</td>
                  <td className="num">{l.tipo}</td>
                  <td className="num">{l.nf_semente ?? ''}</td>
                  <td className="num">{l.receita ?? ''}</td>
                  <td className="num">{l.blocos_semeados != null ? num(l.blocos_semeados) : ''}</td>
                  <td className="num">{num(l.blocos_produzidos)}</td>
                  <CelulaGuardado l={l} />
                  <td className="num">{l.misturas != null ? num(l.misturas) : ''}</td>
                  <td className="num">{zerouTexto(l.capela_ligada)}</td>
                  <td className="num">{l.galpao != null ? rotuloDoGalpao(l.galpao, regras) : ''}</td>
                  <td className="num">{l.estante_maturacao ?? ''}</td>
                  <td className="num">{l.estante_fisica ?? ''}</td>
                  <td className="num">{num(l.blocos_contaminados)}</td>
                  <td className="num">{l.dias_ate_abertura != null ? num(l.dias_ate_abertura) : ''}</td>
                  <td className="num">{dataBr(l.data_abertura)}</td>
                  <td className="num">{l.blocos_abertos != null ? num(l.blocos_abertos) : ''}</td>
                  <td className="num">{l.estante_abertura ?? ''}</td>
                  <td className="num">{zerouTexto(l.zerou_estante)}</td>
                  <td className="num">{l.estante_frutificacao ?? ''}</td>
                  <td className="num">{dataBr(l.data_colheita)}</td>
                  <td className="num">{l.estante_colheita ?? ''}</td>
                  <td className="num">{l.kg_pp != null ? num(l.kg_pp, 3) : ''}</td>
                  <td className="num">{l.kg_p != null ? num(l.kg_p, 3) : ''}</td>
                  <td className="num">{l.kg_m != null ? num(l.kg_m, 3) : ''}</td>
                  <td className="num">{l.kg_g != null ? num(l.kg_g, 3) : ''}</td>
                  <td className="num">{l.kg_gg != null ? num(l.kg_gg, 3) : ''}</td>
                  <td className="num total">{l.total_kg != null ? num(l.total_kg, 3) : ''}</td>
                  <td className="num">
                    {temColheita && (
                      <>
                        <button className="btn ghost split-btn" disabled={salvando}
                          title={`Corrigir a colheita de ${dataBr(l.data_colheita)} desta linha. O lote não é alterado.`}
                          onClick={() => abrirEdicao('colheita', l)}>Editar colheita</button>
                        {' '}
                        <button className="btn ghost split-btn" disabled={salvando}
                          title={`Apagar somente a colheita de ${dataBr(l.data_colheita)}. O lote e as outras colheitas ficam.`}
                          onClick={() => pedirExclusaoColheita(l)}>Excluir colheita</button>
                        {' '}
                      </>
                    )}
                    {ehPrimeira && (
                      <>
                        <button className="btn ghost split-btn" disabled={salvando}
                          title={`Corrigir os dados do lote nº ${l.lote_id}: blocos produzidos, galpão, `
                            + 'estantes, NF, receita e abertura. As colheitas não são alteradas.'}
                          onClick={() => abrirEdicao('lote', l)}>Editar lote</button>
                        {' '}
                        <button className="btn ghost split-btn" disabled={salvando}
                          title={`Apagar o LOTE INTEIRO nº ${l.lote_id}, junto com as `
                            + `${colheitasPorLote.get(l.lote_id) ?? 0} colheita(s) e os contaminados presos a ele.`}
                          onClick={() => pedirExclusaoLote(l)}>Excluir lote</button>
                      </>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="obs-tela">
          Observação: o "Nº total de blocos Contaminados" é calculado pelo vínculo correto
          (data do lote + tipo + estante), corrige as fórmulas desalinhadas da planilha.
          Para SB/SP/SS o total colhido é informado direto (coluna P), como no hábito da planilha.
          <br />
          Na coluna <strong>Ações</strong>: <strong>Editar/Excluir colheita</strong> aparece em toda linha
          que tem colheita e age <strong>só naquela colheita</strong>.
          {' '}<strong>Editar/Excluir lote</strong> aparece na <strong>primeira linha de cada lote</strong> (a que mostra os blocos produzidos) e age
          no <strong>lote inteiro</strong>: excluir leva junto todas as colheitas e os contaminados presos
          a ele, e a confirmação diz quantos são antes de apagar. Corrigir é sempre melhor do que
          relançar: lançar o mesmo lote duas vezes duplicaria os blocos nos indicadores, e por isso
          o sistema agora recusa um segundo lote no mesmo endereço.
        </div>
      </Panel>
    </>
  );
}

let proximoIdDeLinha = 1;
export const linhaNova = (): LinhaEndereco => ({ id: proximoIdDeLinha++, galpao: '', estante: '', blocos: '' });

export function totaisDosEnderecos(linhas: LinhaEndereco[], semeadosTexto: string = '') {
  const preenchidas = linhas.filter((l) => !linhaVazia(l));
  const guardados = somaDosBlocos(preenchidas);
  const semeados = opcNum(semeadosTexto) ?? null;
  return {
    estantes: new Set(preenchidas.map((l) => chaveDaEstante(l.galpao, l.estante))).size,
    guardados,
    semeados,
    nao_guardados: semeados == null ? null : semeados - guardados,
  };
}

export function rodapeDosEnderecos(t: ReturnType<typeof totaisDosEnderecos>): string {
  return `Guardados: ${num(t.guardados)} em ${t.estantes} ${t.estantes === 1 ? 'estante' : 'estantes'}`
    + (t.semeados != null ? ` · semeados ${num(t.semeados)}` : '')
    + (t.nao_guardados != null && t.nao_guardados >= 0 ? ` · ${num(t.nao_guardados)} ainda não guardados` : '');
}

export function BlocoSementes({ linhas, cepas, erroCepas, onChange }: {
  linhas: LinhaSemente[]; cepas: SementeCepa[]; erroCepas: boolean;
  onChange: (novas: LinhaSemente[]) => void;
}) {
  const proximoId = useRef(linhas.reduce((m, l) => Math.max(m, l.id), 0));
  const erro = erroDaSemente(linhas);
  return (
    <div className="fg" style={{ gridColumn: '1 / -1' }}>
      <label title="Uma cepa e uma NF por linha, com o lote da semente e o vencimento da etiqueta. O caminho comum é repetir a mesma cepa com NFs diferentes -- por isso 'acrescentar nota' já vem com a cepa da linha anterior.">
        Sementes (cepa, NF, lote da semente e vencimento)
      </label>
      {linhas.map((linha, i) => {
        const mudar = (patch: Partial<LinhaSemente>) => onChange(linhas.map((l) => (l.id === linha.id ? { ...l, ...patch } : l)));
        return (
          <div className="form-acao" key={linha.id}>
            <select value={linha.cepaId} aria-label={`Cepa da semente ${i + 1}`} onChange={(e) => mudar({ cepaId: e.target.value })}>
              <option value="">
                {erroCepas ? '(não foi possível carregar as cepas)' : '(escolha a cepa)'}
              </option>
              {cepas.map((c) => <option key={c.id} value={String(c.id)}>{c.codigo}</option>)}
            </select>
            <input value={linha.nf} placeholder="NF" aria-label={`NF da semente ${i + 1}`} onChange={(e) => mudar({ nf: e.target.value })} />
            <input value={linha.lote ?? ''} placeholder="Lote da semente" maxLength={100} aria-label={`Lote da semente ${i + 1}`} onChange={(e) => mudar({ lote: e.target.value })} />
            <input type="date" value={linha.vencimento ?? ''} title="Vencimento da semente" aria-label={`Vencimento da semente ${i + 1}`}
              onChange={(e) => mudar({ vencimento: e.target.value })} />
            <button type="button" className="btn ghost" aria-label={`Remover semente ${i + 1}`}
              onClick={() => onChange(linhas.filter((l) => l.id !== linha.id))}>×</button>
          </div>
        );
      })}
      <button type="button" className="btn ghost" onClick={() => onChange([
        ...linhas,
        { id: (proximoId.current += 1), cepaId: cepaDaProximaLinha(linhas), nf: '', lote: '', vencimento: '' },
      ])}>+ acrescentar nota</button>
      {erro && <div className="fixvar-none">{erro}</div>}
    </div>
  );
}

export function BlocoAutoclave({ linhas, pessoas, onCriarPessoa, onChange }: {
  linhas: LinhaAutoclave[]; pessoas: Pessoa[]; onCriarPessoa: (nome: string) => Promise<unknown>;
  onChange: (f: (prev: LinhaAutoclave[]) => LinhaAutoclave[]) => void;
}) {
  const proximoId = useRef(linhas.reduce((m, l) => Math.max(m, l.id), 0));
  const mudarBatida = (id: number, patch: Partial<LinhaAutoclave>) =>
    onChange((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  return (
    <div className="fg" style={{ gridColumn: '1 / -1' }}>
      <label title="Uma linha por BATIDA. A ordem dos campos na linha é a ordem da ficha de papel: quem digita está lendo o caderno de cima para baixo.">
        Autoclave (uma linha por batida)
      </label>
      {linhas.map((linha, i) => (
        <div className="form-acao" key={linha.id}>
          <SelectPessoa id={`autoclave-responsavel-${linha.id}`} rotulo="Responsável" pessoas={pessoas}
            onCriar={onCriarPessoa} valor={linha.responsavel}
            onChange={(nome) => mudarBatida(linha.id, { responsavel: nome })} />
          <div className="fg">
            <label htmlFor={`autoclave-entrada-${linha.id}`}>Entrada</label>
            <input id={`autoclave-entrada-${linha.id}`} type="datetime-local" value={linha.entrada}
              aria-label={`Entrada na autoclave, batida ${i + 1}`}
              onChange={(e) => mudarBatida(linha.id, { entrada: e.target.value })} />
          </div>
          <div className="fg">
            <label htmlFor={`autoclave-atingiu121-${linha.id}`}>Atingiu 121°C</label>
            <input id={`autoclave-atingiu121-${linha.id}`} type="datetime-local" value={linha.atingiu121}
              aria-label={`Atingiu 121°C, batida ${i + 1}`}
              onChange={(e) => mudarBatida(linha.id, { atingiu121: e.target.value })} />
          </div>
          <div className="fg">
            <label htmlFor={`autoclave-fim2h-${linha.id}`}>Fim das 2 horas</label>
            <input id={`autoclave-fim2h-${linha.id}`} type="datetime-local" value={linha.fim2h}
              aria-label={`Fim das 2 horas, batida ${i + 1}`}
              onChange={(e) => mudarBatida(linha.id, { fim2h: e.target.value })} />
          </div>
          <select value={linha.houveQueda121} aria-label={`Houve queda abaixo de 121°C, batida ${i + 1}`}
            onChange={(e) => mudarBatida(linha.id, { houveQueda121: e.target.value as ZerouOpcao })}>
            <option value="">Houve queda de 121°C?</option>
            <option value="SIM">SIM</option>
            <option value="NAO">NÃO</option>
          </select>
          <select value={linha.pressaoNaFaixa} aria-label={`Pressão entre 1,1 e 1,3 bar, batida ${i + 1}`}
            onChange={(e) => mudarBatida(linha.id, { pressaoNaFaixa: e.target.value as ZerouOpcao })}>
            <option value="">Pressão na faixa (1,1 a 1,3 bar)?</option>
            <option value="SIM">SIM</option>
            <option value="NAO">NÃO</option>
          </select>
          <input value={linha.ocorrido} placeholder="Ocorrido" aria-label={`Ocorrido na batida ${i + 1}`}
            onChange={(e) => mudarBatida(linha.id, { ocorrido: e.target.value })} />
          <input value={linha.observacoes} placeholder="Observações" aria-label={`Observações da batida ${i + 1}`}
            onChange={(e) => mudarBatida(linha.id, { observacoes: e.target.value })} />
          <SelectPessoa id={`autoclave-conferido-por-${linha.id}`} rotulo="Conferido por" pessoas={pessoas}
            onCriar={onCriarPessoa} valor={linha.conferidoPor}
            onChange={(nome) => mudarBatida(linha.id, { conferidoPor: nome })} />
          <button type="button" className="btn ghost" aria-label={`Remover batida ${i + 1}`}
            onClick={() => onChange((prev) => prev.filter((l) => l.id !== linha.id))}>×</button>
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={() => onChange((prev) => [...prev, {
        id: (proximoId.current += 1), responsavel: '', entrada: '', atingiu121: '', fim2h: '',
        houveQueda121: '', pressaoNaFaixa: '', ocorrido: '', observacoes: '', conferidoPor: '',
      }])}>+ acrescentar batida</button>
    </div>
  );
}

export function FormLote({ salvando, onSubmit, galpoes, regras = [], pessoas = [], onCriarPessoa = async () => {} }: {
  salvando: boolean;
  onSubmit: (corpos: NovoLote[]) => Promise<ResultadoLote[]>;
  galpoes: string[];
  regras?: Array<{ galpao_codigo: string; observacao?: string | null }>;
  pessoas?: Pessoa[];
  onCriarPessoa?: (nome: string) => Promise<unknown>;
}) {
  const [v, setV] = useState<ValoresNovoLote>({
    data_lote: '', tipo: 'SH', nf_semente: '',
    responsavel_pesagem: '', responsavel_selagem: '', responsavel_semeacao: '', responsavel_conferencia: '',
    receitaId: '', misturas: '', blocos_semeados: '', lote_pesquisa: '', capela_ligada: '', sementes: [], autoclave: [],
    enderecos: [linhaNova()],
  });
  const [receitas, setReceitas] = useState<ReceitaSubstrato[] | null>(null);
  const [erroReceitas, setErroReceitas] = useState(false);
  useEffect(() => {
    getReceitasSubstrato()
      .then(setReceitas)
      .catch(() => { setReceitas([]); setErroReceitas(true); });
  }, []);
  const [cepas, setCepas] = useState<SementeCepa[] | null>(null);
  const [erroCepas, setErroCepas] = useState(false);
  useEffect(() => {
    getSementesCepas()
      .then(setCepas)
      .catch(() => { setCepas([]); setErroCepas(true); });
  }, []);
  const [nfSementeTocado, setNfSementeTocado] = useState(false);
  const opcoes = opcoesDeReceita(receitas ?? [], v.tipo);
  const cepasDoTipo = cepasParaTipo(cepas ?? [], v.tipo);
  const erroSemente = erroDaSemente(v.sementes);

  function atualizarSementes(novas: LinhaSemente[]) {
    setV((prev) => ({
      ...prev,
      sementes: novas,
      nf_semente: nfSementeEfetivo(prev.nf_semente, textoDaSemente(novas, cepas ?? []), nfSementeTocado),
    }));
  }

  function mudarTipo(tipo: string) {
    setV((prev) => ({
      ...prev, tipo, receitaId: '', sementes: [],
      nf_semente: nfSementeEfetivo(prev.nf_semente, '', nfSementeTocado),
    }));
  }

  const ok = !!v.data_lote;
  const atualizarLinha = (id: number, mudanca: Partial<LinhaEndereco>) =>
    setV({ ...v, enderecos: v.enderecos.map((l) => (l.id === id ? { ...l, ...mudanca } : l)) });
  const removerLinha = (id: number) => setV({ ...v, enderecos: v.enderecos.filter((l) => l.id !== id) });
  const totais = totaisDosEnderecos(v.enderecos, v.blocos_semeados);
  const validacao = enderecosParaEnvio(v.enderecos, galpoes, { semeados: v.blocos_semeados });
  const erroEnderecos = validacao.ok ? null : validacao.erro;
  const [relato, setRelato] = useState<string | null>(null);
  async function enviar() {
    const resultados = await onSubmit(corposDoLote(v));
    if (resultados.every((r) => r.ok)) return;
    setRelato(relatoLotesMultiplos(resultados, regras));
    setV((prev) => valoresAposEnvio(prev, resultados));
  }
  return (
    <div className="form-grid c4">
      <div className="fg"><label>DATA DO LOTE <span className="req">*</span></label>
        <CampoData value={v.data_lote} onChange={(iso) => setV({ ...v, data_lote: iso })} /></div>
      <div className="fg"><label>Tipo (SP/SH/SB/SS) <span className="req">*</span></label>
        <select value={v.tipo} onChange={(e) => mudarTipo(e.target.value)}>
          {TIPOS.map((t) => <option key={t}>{t}</option>)}
        </select></div>
      <div className="fg"><label>NF - Semente</label>
        <input value={v.nf_semente} placeholder="ex.: 20.140"
          onChange={(e) => { setNfSementeTocado(true); setV({ ...v, nf_semente: e.target.value }); }} />
        <span className="fixvar-none">preenchido a partir das sementes abaixo, a menos que você digite aqui</span>
      </div>
      <BlocoSementes linhas={v.sementes} cepas={cepasDoTipo} erroCepas={erroCepas} onChange={atualizarSementes} />
      <div className="fg">
        <label title="Qual formulação de substrato entrou no bloco. Deixe vazio para o sistema escolher a receita padrão do tipo.">
          Receita cadastrada
        </label>
        <select value={v.receitaId} onChange={(e) => setV({ ...v, receitaId: e.target.value })}>
          <option value="">
            {erroReceitas
              ? '(não foi possível carregar as receitas)'
              : '(deixar o sistema escolher)'}
          </option>
          {opcoes.map((o) => <option key={o.id} value={String(o.id)}>{o.rotulo}</option>)}
        </select></div>
      <CampoMisturas valor={v.misturas} onChange={(misturas) => setV({ ...v, misturas })} />
      <div className="fg">
        <label title="O total do caderno de semeação, do lote inteiro. Informe só na primeira vez que lançar este lote; ao acrescentar estantes depois, deixe vazio.">
          Blocos semeados <span className="fixvar-none">(o total do caderno, do lote inteiro)</span>
        </label>
        <input type="number" min={0} placeholder="vazio = não informado"
          value={v.blocos_semeados} onChange={(e) => setV({ ...v, blocos_semeados: e.target.value })} />
      </div>
      <SelectPessoas id="lote-responsavel-semeacao" rotulo="Responsável pela semeação"
        valor={v.responsavel_semeacao} pessoas={pessoas} onCriar={onCriarPessoa}
        onChange={(nome) => setV({ ...v, responsavel_semeacao: nome })} />
      <div className="fg">
        <label title="Três respostas diferentes: em branco é “não informado”, e não a mesma coisa que NÃO.">
          Capela ligada durante a semeação?
        </label>
        <select value={v.capela_ligada} onChange={(e) => setV({ ...v, capela_ligada: e.target.value as ZerouOpcao })}>
          <option value="">—</option>
          <option value="SIM">SIM</option>
          <option value="NAO">NÃO</option>
        </select>
      </div>
      <SelectPessoa id="lote-responsavel-pesagem" rotulo="Responsável pela pesagem"
        valor={v.responsavel_pesagem} pessoas={pessoas} onCriar={onCriarPessoa}
        onChange={(nome) => setV({ ...v, responsavel_pesagem: nome })} />
      <SelectPessoa id="lote-responsavel-selagem" rotulo="Responsável pela selagem"
        valor={v.responsavel_selagem ?? ''} pessoas={pessoas} onCriar={onCriarPessoa}
        onChange={(nome) => setV({ ...v, responsavel_selagem: nome })} />
      <SelectPessoa id="lote-responsavel-conferencia" rotulo="Responsável pela conferência"
        valor={v.responsavel_conferencia} pessoas={pessoas} onCriar={onCriarPessoa}
        onChange={(nome) => setV({ ...v, responsavel_conferencia: nome })} />
      <div className="fg" style={{ gridColumn: '1 / -1' }}>
        <div className="fsec">Endereços de maturação</div>
        {v.enderecos.map((l, i) => (
          <div className="form-grid c4" key={l.id}>
            <div className="fg"><label>Galpão</label>
              {galpoes.length > 0 ? (
                <select value={l.galpao} onChange={(e) => atualizarLinha(l.id, { galpao: e.target.value })}>
                  <option value="">Selecione…</option>
                  {galpoes.map((g) => <option key={g} value={g}>{rotuloDoGalpao(g, regras)}</option>)}
                </select>
              ) : (
                <div className="fixvar-none">{SEM_LISTA_DE_GALPOES}</div>
              )}</div>
            <div className="fg"><label>Estante</label>
              <input value={l.estante} placeholder="7"
                onChange={(e) => atualizarLinha(l.id, { estante: e.target.value })} /></div>
            <div className="fg"><label>Blocos nesta estante</label>
              <input type="number" min={0} value={l.blocos} placeholder="180"
                title="Quantos blocos foram guardados nesta estante. 0 = essa estante não recebeu bloco (a semeação se perdeu antes da guarda, 0072); vazio = “não informado” é recusado. O total do lote fica no campo “Blocos semeados”, acima."
                onChange={(e) => atualizarLinha(l.id, { blocos: e.target.value })} />
              {v.enderecos.length > 1 && (
                <button type="button" className="btn ghost" onClick={() => removerLinha(l.id)}>Remover linha {i + 1}</button>
              )}</div>
          </div>
        ))}
        <div className="form-acao">
          <button type="button" className="btn ghost" onClick={() => setV({ ...v, enderecos: [...v.enderecos, linhaNova()] })}>
            + Adicionar estante
          </button>
          <span className="fixvar-none">{rodapeDosEnderecos(totais)}</span>
        </div>
        {avisoDasEstantesSomadas(v.enderecos, galpoes, regras) && <div className="alert-banner media" role="status">{avisoDasEstantesSomadas(v.enderecos, galpoes, regras)}</div>}
        {erroEnderecos && <span className="fixvar-none" role="status">{erroEnderecos}</span>}
      </div>
      <BlocoAutoclave linhas={v.autoclave ?? []} pessoas={pessoas} onCriarPessoa={onCriarPessoa}
        onChange={(f) => setV((prev) => ({ ...prev, autoclave: f(prev.autoclave ?? []) }))} />
      <div className="fg">
        <label title="Três respostas diferentes: em branco é “não informado”, e não a mesma coisa que NÃO. Quando SIM, o lote entra na área de Lotes de Pesquisa.">
          Lote de Pesquisa
        </label>
        <select value={v.lote_pesquisa} onChange={(e) => setV({ ...v, lote_pesquisa: e.target.value as ZerouOpcao })}>
          <option value="">—</option>
          <option value="SIM">SIM</option>
          <option value="NAO">NÃO</option>
        </select>
      </div>
      {relato && (
        <div className="fg" style={{ gridColumn: '1 / -1' }}>
          <div className="obs-tela" role="status">{relato}</div>
        </div>
      )}
      <div className="fg"><label>&nbsp;</label>
        <button className="btn" disabled={!ok || salvando || !!erroSemente || !validacao.ok || validacao.enderecos.length === 0}
          onClick={enviar}>{salvando ? 'Salvando…' : 'Criar lote'}</button></div>
    </div>
  );
}

function SelectLote({ lotes, value, onChange }: {
  lotes: LoteOpcao[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecione o lote…</option>
      {lotes.map((l) => <option key={l.lote_id} value={l.lote_id} title={l.titulo}>{l.rotulo}</option>)}
    </select>
  );
}

function CampoLote({ lotes, valor, editando, onChange }: {
  lotes: LoteOpcao[]; valor: string; editando: boolean; onChange: (v: string) => void;
}) {
  if (!editando) {
    return (
      <div className="fg span2"><label>Lote <span className="req">*</span></label>
        <SelectLote lotes={lotes} value={valor} onChange={onChange} /></div>
    );
  }
  return (
    <div className="fg span2"><label>Lote (não muda na edição)</label>
      <input readOnly value={lotes.find((l) => String(l.lote_id) === valor)?.rotulo ?? valor} /></div>
  );
}

function CampoBlocosAbertos({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div className="fg">
      <label title="Pode ficar vazio: a abertura fica registrada sem a quantidade, que é como muitos lotes vieram da planilha. 0 não vale, quantidade zero não é “não informado”.">
        Nº de blocos Abertos <span className="fixvar-none">(pode ficar vazio)</span>
      </label>
      <input type="number" min={1} placeholder="vazio = não informado"
        value={valor} onChange={(e) => onChange(e.target.value)} />
      {abertosInvalidos(valor) && <span className="fixvar-none">{AVISO_ABERTOS_ZERO}</span>}
    </div>
  );
}

export function CampoMisturas({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div className="fg">
      <label title="Quantas batidas (misturas) de substrato foram feitas para dar os blocos deste lote. Não tem a ver com cepa. Com o nº de blocos, mostra o rendimento observado, blocos por batida, ao lado do cadastrado, na tela de Compras de Matéria-Prima.">
        Nº de batidas (vezes que a batedeira encheu) <span className="fixvar-none">(quantas batidas de substrato deram estes blocos)</span>
      </label>
      <input type="number" min={1} placeholder="ex.: 11, vazio = não informado"
        value={valor} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function CampoZerou({ valor, onChange, dica }: {
  valor: ZerouOpcao; onChange: (v: ZerouOpcao) => void; dica: string;
}) {
  return (
    <div className="fg">
      <label title="Três respostas diferentes: em branco é “não informado”, e não a mesma coisa que NÃO.">
        Abertura concluída <span className="fixvar-none">{dica}</span>
      </label>
      <select value={valor} onChange={(e) => onChange(e.target.value as ZerouOpcao)}>
        <option value="">—</option>
        <option value="SIM">SIM</option>
        <option value="NAO">NÃO</option>
      </select>
    </div>
  );
}

export interface LinhaDestino { id: number; sala: string; estante: string; blocos: string }
let proximoIdDeDestino = 1;
export const destinoNovo = (salaPadrao = ''): LinhaDestino => ({ id: proximoIdDeDestino++, sala: salaPadrao, estante: '', blocos: '' });

export { salasDeFrutificacao, SelectSala, type SalaOpcao } from '../components/SelectSala';

const FRASE_ABERTURA_POR_ESTANTE = 'A abertura é registrada por estante de frutificação. '
  + 'Use "Registrar abertura" com uma linha por estante.';

export const SEM_SALA_DE_FRUTIFICACAO = 'Nenhuma sala de frutificação ativa cadastrada; '
  + 'ative uma sala antes de registrar a abertura.';

export function destinosParaEnvio(
  linhas: LinhaDestino[],
): { ok: true; destinos: Array<{ sala: string; estante: string; quantidade?: number }> } | { ok: false; erro: string } {
  const destinos: Array<{ sala: string; estante: string; quantidade?: number }> = [];
  for (const [i, l] of linhas.entries()) {
    const sala = l.sala.trim();
    const estante = l.estante.trim();
    const blocos = l.blocos.trim();
    if (estante === '' && blocos === '') continue;
    if (sala === '') return { ok: false, erro: `Informe a sala de frutificação da linha ${i + 1}.` };
    if (estante === '') return { ok: false, erro: `Informe a estante da linha ${i + 1}.` };
    if (estante.includes(',')) return { ok: false, erro: FRASE_ABERTURA_POR_ESTANTE };
    if (blocos === '') { destinos.push({ sala, estante }); continue; }
    const n = Number(blocos);
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, erro: `Blocos da linha ${i + 1}: informe um número inteiro maior que zero, ou deixe vazio.` };
    }
    destinos.push({ sala, estante, quantidade: n });
  }
  if (destinos.length === 0) return { ok: false, erro: 'Informe ao menos uma estante de frutificação.' };
  return { ok: true, destinos };
}

interface ValoresAbertura {
  lote: string; data_abertura: string; zerou: ZerouOpcao;
  destinos: LinhaDestino[];
  registrado_por?: string;
  substituir?: boolean;
}

export const corpoDaAbertura = (v: ValoresAbertura) => {
  const validacao = destinosParaEnvio(v.destinos);
  return {
    data_abertura: v.data_abertura,
    ...(v.zerou === '' ? {} : { zerou_estante: v.zerou === 'SIM' }),
    destinos: validacao.ok ? validacao.destinos : [],
    ...(v.registrado_por?.trim() ? { registrado_por: v.registrado_por.trim() } : {}),
    ...(v.substituir ? { substituir: true } : {}),
  };
};

export interface ErroSaldo {
  sobra: number; informado: number; rotulo?: string;
  produzidos?: number; retirados?: number; abertos?: number;
}

export function produzidosQueFecham(e: ErroSaldo): number | null {
  if (e.produzidos == null || e.retirados == null || e.abertos == null) return null;
  return e.retirados + e.abertos + e.informado;
}

export const perguntaCorrigirProduzidos = (e: ErroSaldo, novo: number) =>
  `O lote tem ${e.produzidos} blocos produzidos no sistema, e esta abertura precisa de ${novo}: `
  + `${e.retirados} já retirados, ${e.abertos} já abertos e ${e.informado} agora. `
  + `Corrigir o Nº de blocos Produzidos para ${novo} e registrar a abertura?`;

const ORIENTACAO_DIVERGENCIA =
  'O lançamento não foi gravado. Registre quem contou e confirme com a operação: '
  + 'se a estante tinha mais blocos, corrija o Nº de blocos Produzidos em Editar lote e lance de novo; '
  + 'se a contagem estava errada, lance a quantidade certa.';

function BlocoDivergencia({ erroSaldo, pessoas, onCriarPessoa, onRegistrar }: {
  erroSaldo: ErroSaldo;
  pessoas: Pessoa[];
  onCriarPessoa: (nome: string) => Promise<unknown>;
  onRegistrar: (responsavel: string, observacao: string) => void;
}) {
  const [responsavel, setResponsavel] = useState('');
  const [observacao, setObservacao] = useState('');
  return (
    <div className="obs-tela" role="alert">
      <div className="fsec">Registrar a divergência</div>
      <span className="fixvar-none">
        {erroSaldo.rotulo && `${erroSaldo.rotulo}: `}
        Contagem informada: {erroSaldo.informado}. Sobram {erroSaldo.sobra} nesta estante.
      </span>
      <p className="fixvar-none" style={{ margin: '4px 0 8px' }}>{ORIENTACAO_DIVERGENCIA}</p>
      <div className="form-grid c4">
        <SelectPessoas id="divergencia-responsavel" rotulo="Quem contou" valor={responsavel}
          pessoas={pessoas} onCriar={onCriarPessoa} onChange={setResponsavel} />
        <div className="fg"><label htmlFor="divergencia-observacao">Observação</label>
          <input id="divergencia-observacao" value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>
        <div className="fg"><label>&nbsp;</label>
          <button type="button" className="btn ghost" disabled={!responsavel}
            onClick={() => onRegistrar(responsavel, observacao)}>
            Registrar divergência
          </button></div>
      </div>
    </div>
  );
}

export function FormAbertura({
  lotes, salas, salvando, onSubmit, destinosIniciais, pessoas = [], onCriarPessoa = async () => {},
  erroSaldo = null, onRegistrarDivergencia, loteInicial, onCorrigirProduzidos,
}: {
  lotes: LoteOpcao[]; salas: SalaOpcao[]; salvando: boolean;
  onSubmit: (loteId: number, b: ReturnType<typeof corpoDaAbertura>) => void;
  onCorrigirProduzidos?: (loteId: number, novoTotal: number, pergunta: string, b: ReturnType<typeof corpoDaAbertura>) => void;
  destinosIniciais?: LinhaDestino[];
  pessoas?: Pessoa[];
  onCriarPessoa?: (nome: string) => Promise<unknown>;
  erroSaldo?: ErroSaldo | null;
  onRegistrarDivergencia?: (corpo: {
    lote_id: number; tipo: 'ABERTURA'; data: string; esperado: number; informado: number;
    responsavel: string; observacao?: string;
  }) => void;
  loteInicial?: string;
}) {
  const [v, setV] = useState<ValoresAbertura>(() => ({
    lote: loteInicial ?? '', data_abertura: '', zerou: '', destinos: destinosIniciais ?? [destinoNovo()], registrado_por: '',
  }));
  const jaConcluido = loteJaConcluido(lotes, v.lote);
  const jaAberto = textoJaAberto(lotes, v.lote);
  const [aberturas, setAberturas] = useState<{ lote: string; linhas: AberturaGravada[]; blocos_abertos: number | null } | null>(null);
  const [erroAberturas, setErroAberturas] = useState('');
  useEffect(() => {
    if (!v.lote || salvando) return;
    let vivo = true;
    setErroAberturas('');
    listarAberturasJornada(Number(v.lote))
      .then((r) => { if (vivo) setAberturas({ lote: v.lote, ...r }); })
      .catch((e) => {
        if (!vivo) return;
        setAberturas(null);
        setErroAberturas(e?.response?.data?.erro ?? e?.message ?? 'erro desconhecido');
      });
    return () => { vivo = false; };
  }, [v.lote, salvando]);
  const atualizarLinha = (id: number, mudanca: Partial<LinhaDestino>) =>
    setV({ ...v, destinos: v.destinos.map((l) => (l.id === id ? { ...l, ...mudanca } : l)) });
  const removerLinha = (id: number) => setV({ ...v, destinos: v.destinos.filter((l) => l.id !== id) });
  const validacao = destinosParaEnvio(v.destinos);
  const tocado = v.destinos.some((l) => l.estante.trim() !== '' || l.blocos.trim() !== '');
  const semSalas = salasDeFrutificacao(salas).length === 0;
  const erroDestinos = semSalas ? SEM_SALA_DE_FRUTIFICACAO : (validacao.ok || !tocado ? null : validacao.erro);
  const ok = !!(v.lote && v.data_abertura) && validacao.ok && !semSalas;
  return (
    <div className="form-grid c4">
      <CampoLote lotes={lotes} valor={v.lote} editando={false}
        onChange={(lote) => setV({ ...v, lote, substituir: false })} />
      {jaConcluido && (
        <div className="fg span2"><span className="fixvar-none">{AVISO_ESTANTE_CONCLUIDA}</span></div>
      )}
      {jaAberto && (
        <div className="fg span2"><span className="fixvar-none">
          {jaAberto} {v.substituir ? AVISO_REGRAVAR : AVISO_SOMAR}
        </span>
        <label style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
          <input type="checkbox" checked={!!v.substituir}
            onChange={(e) => setV({ ...v, substituir: e.target.checked })} />
          {' '}Substituir as aberturas gravadas (para corrigir)
        </label></div>
      )}
      {v.lote && aberturas?.lote === v.lote && (
        <HistoricoDeAberturas linhas={aberturas.linhas} blocosAbertos={aberturas.blocos_abertos} />
      )}
      {v.lote && erroAberturas && (
        <div className="fg span2"><span className="fixvar-none" role="status">
          Não foi possível ler as aberturas já registradas desta estante: {erroAberturas}
        </span></div>
      )}
      <div className="fg"><label>Data de abertura <span className="req">*</span></label>
        <CampoData value={v.data_abertura} onChange={(iso) => setV({ ...v, data_abertura: iso })} /></div>
      <CampoZerou valor={v.zerou} dica="(— = não informar agora)"
        onChange={(zerou) => setV({ ...v, zerou })} />
      <SelectPessoas id="abertura-registrado-por" rotulo="Quem abriu (contou os blocos)"
        valor={v.registrado_por ?? ''} pessoas={pessoas} onCriar={onCriarPessoa}
        onChange={(nome) => setV({ ...v, registrado_por: nome })} />
      <div className="fg" style={{ gridColumn: '1 / -1' }}>
        <div className="fsec">Estantes de frutificação</div>
        {v.destinos.map((l, i) => (
          <div className="form-grid c4" key={l.id}>
            <div className="fg"><label htmlFor={`abertura-sala-${l.id}`}>Sala de frutificação</label>
              <SelectSala id={`abertura-sala-${l.id}`} ariaLabel={`Sala de frutificação da linha ${i + 1}`}
                salas={salas} valor={l.sala} onChange={(sala) => atualizarLinha(l.id, { sala })} /></div>
            <div className="fg"><label htmlFor={`abertura-estante-${l.id}`}>Estante de frutificação</label>
              <input id={`abertura-estante-${l.id}`} value={l.estante} placeholder="3"
                aria-label={`Estante de frutificação da linha ${i + 1}`}
                onChange={(e) => atualizarLinha(l.id, { estante: e.target.value })} /></div>
            <div className="fg">
              <label htmlFor={`abertura-blocos-${l.id}`}
                title="Pode ficar vazio: a abertura fica registrada sem a quantidade, que é como muitos lotes vieram da planilha. 0 não vale: quantidade zero não é “não informado”.">
                Blocos <span className="fixvar-none">(pode ficar vazio)</span>
              </label>
              <input id={`abertura-blocos-${l.id}`} type="number" min={1} value={l.blocos} placeholder="vazio = não informado"
                aria-label={`Blocos abertos na estante da linha ${i + 1}`}
                onChange={(e) => atualizarLinha(l.id, { blocos: e.target.value })} />
            </div>
            <div className="fg"><label>&nbsp;</label>
              {v.destinos.length > 1 && (
                <button type="button" className="btn ghost" onClick={() => removerLinha(l.id)}>Remover linha {i + 1}</button>
              )}</div>
          </div>
        ))}
        <div className="form-acao">
          <button type="button" className="btn ghost"
            onClick={() => setV({ ...v, destinos: [...v.destinos, destinoNovo(v.destinos[v.destinos.length - 1]?.sala ?? '')] })}>
            + Adicionar estante
          </button>
        </div>
        {erroDestinos && <span className="fixvar-none" role="status">{erroDestinos}</span>}
      </div>
      <div className="fg"><label>&nbsp;</label>
        <button className="btn" disabled={!ok || salvando}
          onClick={() => onSubmit(Number(v.lote), corpoDaAbertura(v))}>
          {salvando ? 'Salvando…' : 'Registrar abertura'}</button></div>
      {erroSaldo && (
        <BlocoDivergencia erroSaldo={erroSaldo} pessoas={pessoas} onCriarPessoa={onCriarPessoa}
          onRegistrar={(responsavel, observacao) => onRegistrarDivergencia?.({
            lote_id: Number(v.lote), tipo: 'ABERTURA', data: v.data_abertura,
            esperado: erroSaldo.sobra, informado: erroSaldo.informado,
            responsavel, ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
          })} />
      )}
      {erroSaldo && onCorrigirProduzidos && produzidosQueFecham(erroSaldo) != null && (
        <div className="fg" style={{ gridColumn: '1 / -1' }}>
          <button type="button" className="btn ghost" disabled={salvando}
            onClick={() => {
              const novo = produzidosQueFecham(erroSaldo) as number;
              onCorrigirProduzidos(Number(v.lote), novo, perguntaCorrigirProduzidos(erroSaldo, novo), corpoDaAbertura(v));
            }}>
            A estante tinha mais blocos: corrigir o Nº de blocos Produzidos para {produzidosQueFecham(erroSaldo)} e registrar
          </button>
        </div>
      )}
    </div>
  );
}

export interface ValoresLiberacao { sala: string; estante: string; data: string; observacao: string }

export const corpoDaLiberacao = (v: ValoresLiberacao) => ({
  sala: v.sala, estante: v.estante.trim(), data: v.data,
  ...(v.observacao.trim() ? { observacao: v.observacao.trim() } : {}),
});

export function FormLiberacao({ salas, salvando, onSubmit }: {
  salas: SalaOpcao[]; salvando: boolean;
  onSubmit: (b: ReturnType<typeof corpoDaLiberacao>) => Promise<unknown>;
}) {
  const [v, setV] = useState<ValoresLiberacao>({ sala: '', estante: '', data: hojeISO(), observacao: '' });
  const [historico, setHistorico] = useState<Liberacao[] | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!v.sala) { setHistorico(null); return; }
    let vivo = true;
    listarLiberacoes(v.sala).then((r) => { if (vivo) setHistorico(r.liberacoes); })
      .catch(() => { if (vivo) setHistorico([]); });
    return () => { vivo = false; };
  }, [v.sala, versao]);

  const semSalas = salasDeFrutificacao(salas).length === 0;
  const ok = !!(v.sala && v.estante.trim() && v.data) && !semSalas;

  async function liberar() {
    const r = await onSubmit(corpoDaLiberacao(v));
    if (r === undefined) return;
    setV((prev) => ({ ...prev, estante: '', observacao: '' }));
    setVersao((n) => n + 1);
  }

  return (
    <div className="form-grid c4">
      <div className="fg"><label htmlFor="liberacao-sala">Sala de frutificação <span className="req">*</span></label>
        <SelectSala id="liberacao-sala" ariaLabel="Sala de frutificação da liberação"
          salas={salas} valor={v.sala} onChange={(sala) => setV({ ...v, sala })} /></div>
      <div className="fg"><label htmlFor="liberacao-estante">Estante liberada <span className="req">*</span></label>
        <input id="liberacao-estante" placeholder="3" value={v.estante}
          onChange={(e) => setV({ ...v, estante: e.target.value })} /></div>
      <div className="fg"><label>Data da liberação <span className="req">*</span></label>
        <CampoData value={v.data} onChange={(iso) => setV({ ...v, data: iso })} /></div>
      <div className="fg"><label htmlFor="liberacao-observacao">Observação</label>
        <input id="liberacao-observacao" value={v.observacao}
          onChange={(e) => setV({ ...v, observacao: e.target.value })} /></div>
      <div className="fg"><label>&nbsp;</label>
        <button className="btn" disabled={!ok || salvando} onClick={liberar}>
          {salvando ? 'Salvando…' : 'Liberar estante'}</button></div>
      <div className="fg span2">
        <span className="fixvar-none">
          A estante volta a contar como livre no quadro de capacidade a partir desta data. Não encerra o lote.
        </span>
        {semSalas && <span className="fixvar-none" role="status">{SEM_SALA_DE_FRUTIFICACAO}</span>}
      </div>
      {historico != null && historico.length > 0 && (
        <div className="obs-tela" role="status">
          <strong>Liberações já registradas na {v.sala}:</strong>
          <ul>
            {historico.map((h) => (
              <li key={h.id}>
                {dataBr(h.data)}: estante {h.estante}{h.observacao ? ` (${h.observacao})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export interface ValoresLote {
  nf_semente: string; blocos_produzidos: string;
  receita_id?: string;
  blocos_guardados: string;
  misturas: string;
  blocos_semeados: string;
  capela_ligada?: ZerouOpcao;
  galpao: string; estante_maturacao: string;
  data_abertura: string; blocos_abertos: string;
  estante_abertura: string; zerou: ZerouOpcao; estante_frutificacao: string;
  abertura_por_estante: boolean;
  status?: JornadaLinha['status'];
  data_encerramento?: JornadaLinha['data_encerramento'];
  responsavel_semeacao?: string;
  responsavel_conferencia?: string;
  responsavel_pesagem?: string;
  responsavel_selagem?: string;
  data_lote?: string;
  tipo?: string;
  lote_pesquisa?: ZerouOpcao;
  sementes?: LinhaSemente[];
  autoclave?: LinhaAutoclave[];
}

export function filhasDoLote(d: DetalhesDoLoteJornada): Pick<ValoresLote, 'sementes' | 'autoclave'> {
  const hora = (t: string | null) => (t ? t.replace(' ', 'T').slice(0, 16) : '');
  const tri = (b: boolean | null): ZerouOpcao => (b === true ? 'SIM' : b === false ? 'NAO' : '');
  return {
    sementes: d.sementes.map((x, i) => ({ id: i + 1, cepaId: String(x.cepa_id), nf: x.nf, lote: x.lote_semente ?? '', vencimento: x.vencimento ?? '' })),
    autoclave: d.autoclave.map((b, i) => ({
      id: i + 1, responsavel: b.responsavel ?? '', entrada: hora(b.entrada), atingiu121: hora(b.atingiu_121),
      fim2h: hora(b.fim_2h), houveQueda121: tri(b.houve_queda_121), pressaoNaFaixa: tri(b.pressao_na_faixa),
      ocorrido: b.ocorrido ?? '', observacoes: b.observacoes ?? '', conferidoPor: b.conferido_por ?? '',
    })),
  };
}

const filhaMudou = <L,>(atual: L[] | undefined, antes: L[] | undefined, envio: (l: L[]) => unknown) => (
  atual !== undefined && antes !== undefined && JSON.stringify(envio(atual) ?? []) !== JSON.stringify(envio(antes) ?? [])
);

export const corpoDaEdicaoDoLote = (v: ValoresLote, inicial?: ValoresLote) => {
  const porEstante = v.abertura_por_estante;
  const dataIntocada = porEstante && inicial != null && v.data_abertura === inicial.data_abertura;
  const semeadosLimpo = v.blocos_semeados.trim() === '' && (inicial?.blocos_semeados.trim() ?? '') !== '';
  const capelaLimpa = (v.capela_ligada ?? '') === '' && (inicial?.capela_ligada ?? '') !== '';
  return {
    nf_semente: v.nf_semente.trim() || null,
    ...(inicial != null && (v.receita_id ?? '') !== (inicial.receita_id ?? '') && (v.receita_id ?? '').trim() !== ''
      ? { receitaId: Number(v.receita_id) }
      : {}),
    blocos_produzidos: opcNumEdicao(v.blocos_produzidos, true),
    blocos_guardados: opcNumEdicao(v.blocos_guardados, true),
    misturas: opcNumEdicao(v.misturas, true),
    ...(v.blocos_semeados.trim() !== '' || semeadosLimpo
      ? { blocos_semeados: opcNumEdicao(v.blocos_semeados, true) }
      : {}),
    ...(((v.capela_ligada ?? '') !== '') || capelaLimpa
      ? { capela_ligada: zerouParaOBanco(v.capela_ligada ?? '') }
      : {}),
    galpao: v.galpao.trim() || null,
    estante_maturacao: v.estante_maturacao.trim() || null,
    ...(dataIntocada ? {} : { data_abertura: v.data_abertura || null }),
    ...(porEstante ? {} : { blocos_abertos: opcNumEdicao(v.blocos_abertos, true) }),
    ...(porEstante && inicial != null && v.estante_abertura === inicial.estante_abertura
      ? {} : { estante_abertura: v.estante_abertura.trim() || null }),
    ...(porEstante && inicial != null && v.zerou === inicial.zerou
      ? {} : { zerou_estante: zerouParaOBanco(v.zerou) }),
    ...(v.abertura_por_estante ? {} : { estante_frutificacao: v.estante_frutificacao.trim() || null }),
    responsavel_semeacao: (v.responsavel_semeacao ?? '').trim() || null,
    responsavel_conferencia: (v.responsavel_conferencia ?? '').trim() || null,
    responsavel_pesagem: (v.responsavel_pesagem ?? '').trim() || null,
    ...(inicial != null && (v.responsavel_selagem ?? '') === (inicial.responsavel_selagem ?? '')
      ? {} : { responsavel_selagem: (v.responsavel_selagem ?? '').trim() || null }),
    ...(inicial != null && (v.data_lote ?? '') !== '' && v.data_lote !== inicial.data_lote ? { data_lote: v.data_lote } : {}),
    ...(inicial != null && (v.tipo ?? '') !== '' && v.tipo !== inicial.tipo ? { tipo: v.tipo } : {}),
    ...(inicial != null && (v.lote_pesquisa ?? '') !== (inicial.lote_pesquisa ?? '')
      ? { lote_pesquisa: zerouParaOBanco(v.lote_pesquisa ?? '') }
      : {}),
    ...(filhaMudou(v.sementes, inicial?.sementes, sementesParaEnvio) ? { sementes: sementesParaEnvio(v.sementes ?? []) ?? [] } : {}),
    ...(filhaMudou(v.autoclave, inicial?.autoclave, autoclaveParaEnvio) ? { autoclave: autoclaveParaEnvio(v.autoclave) ?? [] } : {}),
    permitir_reabertura: true,
  };
};

export function loteDaLinha(l: JornadaLinha): ValoresLote {
  return {
    nf_semente: l.nf_semente ?? '',
    receita_id: l.receita_id != null ? String(l.receita_id) : '',
    blocos_produzidos: l.blocos_produzidos != null ? String(l.blocos_produzidos) : '',
    blocos_guardados: l.blocos_guardados != null ? String(l.blocos_guardados) : '',
    misturas: l.misturas != null ? String(l.misturas) : '',
    blocos_semeados: l.blocos_semeados != null ? String(l.blocos_semeados) : '',
    capela_ligada: zerouDoBanco(l.capela_ligada),
    galpao: l.galpao ?? '',
    estante_maturacao: l.estante_maturacao ?? '',
    data_abertura: dataInput(l.data_abertura),
    blocos_abertos: l.blocos_abertos != null ? String(l.blocos_abertos) : '',
    estante_abertura: l.estante_abertura ?? '',
    zerou: zerouDoBanco(l.zerou_estante),
    estante_frutificacao: l.estante_frutificacao ?? '',
    abertura_por_estante: l.abertura_por_estante,
    status: l.status,
    data_encerramento: l.data_encerramento,
    responsavel_semeacao: l.responsavel_semeacao ?? '',
    responsavel_conferencia: l.responsavel_conferencia ?? '',
    responsavel_pesagem: l.responsavel_pesagem ?? '',
    responsavel_selagem: l.responsavel_selagem ?? '',
    data_lote: l.data_lote ?? '',
    tipo: l.tipo ?? '',
    lote_pesquisa: zerouDoBanco(l.lote_pesquisa),
  };
}

export function FormEdicaoLote({
  salvando, inicial, tipo = '', galpoes = [], regras = [], pessoas = [], onCriarPessoa = async () => {},
  onSubmit, onReabrir, onAcrescentar, estantesDoLote = 1, avisoDasFilhas = null,
}: {
  estantesDoLote?: number;
  avisoDasFilhas?: string | null;
  salvando: boolean; inicial: ValoresLote;
  tipo?: string;
  galpoes?: string[];
  regras?: Array<{ galpao_codigo: string; observacao?: string | null }>;
  pessoas?: Pessoa[];
  onCriarPessoa?: (nome: string) => Promise<unknown>;
  onReabrir?: () => void;
  onAcrescentar?: (estantes: Array<{ galpao?: string; estante: string; blocos: number }>) => void;
  onSubmit: (b: {
    nf_semente?: string | null;
    receitaId?: number | null;
    blocos_produzidos?: number | null; blocos_guardados?: number | null;
    misturas?: number | null;
    blocos_semeados?: number | null;
    capela_ligada?: boolean | null;
    galpao?: string | null;
    estante_maturacao?: string | null; data_abertura?: string | null;
    blocos_abertos?: number | null; estante_abertura?: string | null;
    zerou_estante?: boolean | null; estante_frutificacao?: string | null;
    responsavel_pesagem?: string | null; responsavel_semeacao?: string | null; responsavel_conferencia?: string | null;
    responsavel_selagem?: string | null;
    permitir_reabertura?: boolean;
    data_lote?: string; tipo?: string; lote_pesquisa?: boolean | null;
    sementes?: Array<{ cepaId: number; nf: string; loteSemente?: string | null; vencimento?: string | null }>;
    autoclave?: BatidaDaAutoclave[];
  }) => void;
}) {
  const [v, setV] = useState<ValoresLote>(inicial);
  const tipoAtual = v.tipo || tipo;
  const [cepas, setCepas] = useState<SementeCepa[] | null>(null);
  const [erroCepas, setErroCepas] = useState(false);
  useEffect(() => {
    getSementesCepas()
      .then(setCepas)
      .catch(() => { setCepas([]); setErroCepas(true); });
  }, []);
  const erroSemente = v.sementes ? erroDaSemente(v.sementes) : null;
  const mudarTipo = (t: string) => setV((prev) => ({
    ...prev, tipo: t, receita_id: '', ...(prev.sementes !== undefined ? { sementes: [] } : {}),
  }));
  const mudouIdentidade = (v.data_lote ?? '') !== (inicial.data_lote ?? '') || (v.tipo ?? '') !== (inicial.tipo ?? '');
  const ok = v.abertura_por_estante || !abertosInvalidos(v.blocos_abertos);
  const [receitas, setReceitas] = useState<ReceitaSubstrato[] | null>(null);
  const [erroReceitas, setErroReceitas] = useState(false);
  useEffect(() => {
    getReceitasSubstrato()
      .then(setReceitas)
      .catch(() => { setReceitas([]); setErroReceitas(true); });
  }, []);
  const opcoesReceita = opcoesDeReceita(receitas ?? [], tipoAtual);
  const [linhasAcrescimo, setLinhasAcrescimo] = useState<LinhaEndereco[]>([linhaNova()]);
  const atualizarLinhaAcrescimo = (id: number, mudanca: Partial<LinhaEndereco>) =>
    setLinhasAcrescimo(linhasAcrescimo.map((l) => (l.id === id ? { ...l, ...mudanca } : l)));
  const removerLinhaAcrescimo = (id: number) => setLinhasAcrescimo(linhasAcrescimo.filter((l) => l.id !== id));
  const validacaoAcrescimo = enderecosParaEnvio(linhasAcrescimo, galpoes);
  const tocadoAcrescimo = linhasAcrescimo.some((l) => !linhaVazia(l));
  const erroAcrescimo = validacaoAcrescimo.ok || !tocadoAcrescimo ? null : validacaoAcrescimo.erro;
  const okAcrescimo = validacaoAcrescimo.ok && validacaoAcrescimo.enderecos.length > 0;
  function acrescentar() {
    if (!validacaoAcrescimo.ok) return;
    const estantes = validacaoAcrescimo.enderecos.map((e) => ({
      ...(e.galpao.trim() ? { galpao: e.galpao.trim() } : {}),
      estante: e.estante.trim(),
      blocos: Number(e.blocos),
    }));
    onAcrescentar?.(estantes);
    setLinhasAcrescimo([linhaNova()]);
  }
  return (
    <div className="form-grid c4">
      <div className="fg"><label>Data do lote</label>
        <CampoData value={v.data_lote ?? ''} onChange={(iso) => setV({ ...v, data_lote: iso })} /></div>
      <div className="fg"><label>Tipo (SP/SH/SB/SS)</label>
        <select value={tipoAtual} onChange={(e) => mudarTipo(e.target.value)}>
          {TIPOS.map((t) => <option key={t}>{t}</option>)}
        </select>
        {mudouIdentidade && estantesDoLote > 1 && (
          <span className="fixvar-none">A data e o tipo mudam nas {estantesDoLote} estantes deste lote.</span>
        )}</div>
      <div className="fg"><label>NF - Semente</label>
        <input value={v.nf_semente} onChange={(e) => setV({ ...v, nf_semente: e.target.value })} placeholder="vazio = não informado" /></div>
      <div className="fg">
        <label title="Qual formulação de substrato entrou no bloco.">
          Receita de substrato
        </label>
        <select value={v.receita_id ?? ''} onChange={(e) => setV({ ...v, receita_id: e.target.value })}>
          <option value="">
            {erroReceitas ? '(não foi possível carregar as receitas)' : '(nenhuma)'}
          </option>
          {opcoesReceita.map((o) => <option key={o.id} value={String(o.id)}>{o.rotulo}</option>)}
        </select></div>
      <div className="fg">
        <label title="Os blocos que entraram NESTA estante (o semeado do lote inteiro é o campo “Blocos semeados”). Deixe vazio quando a estante for continuação de um lote já lançado: vazio fica como “não informado”, não como zero.">
          Nº de blocos Produzidos <span className="fixvar-none">(vazio = não informado)</span>
        </label>
        <input type="number" min={0} placeholder="vazio = não informado"
          value={v.blocos_produzidos} onChange={(e) => setV({ ...v, blocos_produzidos: e.target.value })} /></div>
      <div className="fg">
        <label title="Quanto foi efetivamente guardado nesta estante, ao lado do produzido (o que entrou nela). Vazio = não conferido; 0 é um lançamento válido (a semeação inteira se perdeu antes da guarda).">
          Nº de blocos Guardados <span className="fixvar-none">(vazio = não conferido)</span>
        </label>
        <input type="number" min={0} placeholder="vazio = não conferido"
          value={v.blocos_guardados} onChange={(e) => setV({ ...v, blocos_guardados: e.target.value })} /></div>
      <CampoMisturas valor={v.misturas} onChange={(misturas) => setV({ ...v, misturas })} />
      <div className="fg">
        <label title="O total do caderno de semeação, do lote inteiro. Só a primeira estante lançada do lote o tem; nas outras, deixe vazio.">
          Blocos semeados <span className="fixvar-none">(o total do caderno; vazio = não informado)</span>
        </label>
        <input type="number" min={0} placeholder="vazio = não informado"
          value={v.blocos_semeados} onChange={(e) => setV({ ...v, blocos_semeados: e.target.value })} /></div>
      <SelectPessoas id="edicao-responsavel-semeacao" rotulo="Responsável pela semeação"
        valor={v.responsavel_semeacao ?? ''} pessoas={pessoas} onCriar={onCriarPessoa}
        onChange={(nome) => setV({ ...v, responsavel_semeacao: nome })} />
      <div className="fg">
        <label title="Três respostas diferentes: em branco é “não informado”, e não a mesma coisa que NÃO.">
          Capela ligada durante a semeação?
        </label>
        <select value={v.capela_ligada ?? ''} onChange={(e) => setV({ ...v, capela_ligada: e.target.value as ZerouOpcao })}>
          <option value="">—</option>
          <option value="SIM">SIM</option>
          <option value="NAO">NÃO</option>
        </select>
      </div>
      <SelectPessoa id="edicao-responsavel-pesagem" rotulo="Responsável pela pesagem"
        valor={v.responsavel_pesagem ?? ''} pessoas={pessoas} onCriar={onCriarPessoa}
        onChange={(nome) => setV({ ...v, responsavel_pesagem: nome })} />
      <SelectPessoa id="edicao-responsavel-selagem" rotulo="Responsável pela selagem"
        valor={v.responsavel_selagem ?? ''} pessoas={pessoas} onCriar={onCriarPessoa}
        onChange={(nome) => setV({ ...v, responsavel_selagem: nome })} />
      <SelectPessoa id="edicao-responsavel-conferencia" rotulo="Responsável pela conferência"
        valor={v.responsavel_conferencia ?? ''} pessoas={pessoas} onCriar={onCriarPessoa}
        onChange={(nome) => setV({ ...v, responsavel_conferencia: nome })} />
      <div className="fg"><label>Galpão de maturação</label>
        {galpoes.length > 0 ? (
          <select value={v.galpao} onChange={(e) => setV({ ...v, galpao: e.target.value })}>
            <option value="">Selecione…</option>
            {ordenarGalpoes(!v.galpao || galpoes.includes(v.galpao) ? galpoes : [...galpoes, v.galpao], regras)
              .map((g) => <option key={g} value={g}>{rotuloDoGalpao(g, regras)}</option>)}
          </select>
        ) : (
          <div className="fixvar-none">{SEM_LISTA_DE_GALPOES}</div>
        )}</div>
      <div className="fg"><label>Estante da Maturação</label>
        <input value={v.estante_maturacao} onChange={(e) => setV({ ...v, estante_maturacao: e.target.value })} /></div>
      <div className="fg"><label>Data de abertura <span className="fixvar-none">(vazio = ainda não abriu)</span></label>
        <CampoData value={v.data_abertura} onChange={(iso) => setV({ ...v, data_abertura: iso })} /></div>
      {v.abertura_por_estante ? (
        <div className="fg"><label>Nº de blocos Abertos</label>
          <span className="fixvar-none">
            Nº de blocos abertos: {v.blocos_abertos || 'não informado'} (é a soma das aberturas gravadas; corrija pela abertura, com "Substituir as aberturas gravadas")
          </span></div>
      ) : (
        <CampoBlocosAbertos valor={v.blocos_abertos} onChange={(blocos_abertos) => setV({ ...v, blocos_abertos })} />
      )}
      <div className="fg"><label>Estante da Abertura</label>
        <input value={v.estante_abertura} onChange={(e) => setV({ ...v, estante_abertura: e.target.value })} /></div>
      {v.abertura_por_estante ? (
        <div className="fg"><label>Estante de frutificação</label>
          <span className="fixvar-none">
            Estante de frutificação: {v.estante_frutificacao} (corrija pela abertura: use "Registrar abertura" com uma linha por estante)
          </span></div>
      ) : (
        <div className="fg"><label>Estante da Frutificação</label>
          <input value={v.estante_frutificacao} onChange={(e) => setV({ ...v, estante_frutificacao: e.target.value })} /></div>
      )}
      <CampoZerou valor={v.zerou} dica="(— limpa o campo: volta a “não informado”)"
        onChange={(zerou) => setV({ ...v, zerou })} />
      {inicial.status === 'ENCERRADO' && (
        <div className="fg span2">
          <span className="fixvar-none">
            Este lote está encerrado{inicial.data_encerramento ? ` desde ${dataBr(inicial.data_encerramento)}` : ''}.
          </span>{' '}
          <button className="btn ghost" disabled={salvando} onClick={onReabrir}>Reabrir lote</button>
        </div>
      )}
      <div className="fg">
        <label title="Três respostas diferentes: em branco é “não informado”, e não a mesma coisa que NÃO. Quando SIM, o lote entra na área de Lotes de Pesquisa.">
          Lote de Pesquisa
        </label>
        <select value={v.lote_pesquisa ?? ''} onChange={(e) => setV({ ...v, lote_pesquisa: e.target.value as ZerouOpcao })}>
          <option value="">—</option>
          <option value="SIM">SIM</option>
          <option value="NAO">NÃO</option>
        </select>
      </div>
      {v.sementes !== undefined && (
        <BlocoSementes linhas={v.sementes} cepas={cepasParaTipo(cepas ?? [], tipoAtual)} erroCepas={erroCepas}
          onChange={(sementes) => setV((prev) => ({ ...prev, sementes }))} />
      )}
      {v.autoclave !== undefined && (
        <BlocoAutoclave linhas={v.autoclave} pessoas={pessoas} onCriarPessoa={onCriarPessoa}
          onChange={(f) => setV((prev) => ({ ...prev, autoclave: f(prev.autoclave ?? []) }))} />
      )}
      {avisoDasFilhas && (
        <div className="fg" style={{ gridColumn: '1 / -1' }}>
          <div className="fixvar-none" role="status">{avisoDasFilhas}</div>
        </div>
      )}
      <div className="fg span2"><label>&nbsp;</label>
        <button className="btn" disabled={!ok || salvando || !!erroSemente}
          onClick={() => onSubmit(corpoDaEdicaoDoLote(v, inicial))}>
          {salvando ? 'Salvando…' : 'Salvar alterações do lote'}</button></div>
      <div className="fg span2" style={{ gridColumn: '1 / -1' }}>
        <div className="fsec">Acrescentar estante a este lote</div>
        {linhasAcrescimo.map((l, i) => (
          <div className="form-grid c4" key={l.id}>
            <div className="fg"><label>Galpão</label>
              {galpoes.length > 0 ? (
                <select value={l.galpao} onChange={(e) => atualizarLinhaAcrescimo(l.id, { galpao: e.target.value })}>
                  <option value="">Selecione…</option>
                  {galpoes.map((g) => <option key={g} value={g}>{rotuloDoGalpao(g, regras)}</option>)}
                </select>
              ) : (
                <div className="fixvar-none">{SEM_LISTA_DE_GALPOES}</div>
              )}</div>
            <div className="fg"><label>Estante</label>
              <input value={l.estante} placeholder="7"
                onChange={(e) => atualizarLinhaAcrescimo(l.id, { estante: e.target.value })} /></div>
            <div className="fg"><label>Blocos nesta estante</label>
              <input type="number" min={0} value={l.blocos} placeholder="180"
                onChange={(e) => atualizarLinhaAcrescimo(l.id, { blocos: e.target.value })} />
              {linhasAcrescimo.length > 1 && (
                <button type="button" className="btn ghost" onClick={() => removerLinhaAcrescimo(l.id)}>Remover linha {i + 1}</button>
              )}</div>
          </div>
        ))}
        <div className="form-acao">
          <button type="button" className="btn ghost"
            onClick={() => setLinhasAcrescimo([...linhasAcrescimo, linhaNova()])}>
            + Adicionar estante
          </button>
        </div>
        {avisoDasEstantesSomadas(linhasAcrescimo, galpoes, regras) && <div className="alert-banner media" role="status">{avisoDasEstantesSomadas(linhasAcrescimo, galpoes, regras)}</div>}
        {erroAcrescimo && <span className="fixvar-none" role="status">{erroAcrescimo}</span>}
        <div className="fg"><label>&nbsp;</label>
          <button className="btn" disabled={!okAcrescimo || salvando} onClick={acrescentar}>
            {salvando ? 'Salvando…' : 'Acrescentar estantes'}</button></div>
      </div>
    </div>
  );
}

export interface ValoresColheita {
  lote: string; data: string; kg_p: string; kg_m: string; kg_g: string;
  kg_gg: string;
  kg_pp: string;
  total: string;
  estante: string;
}
export const corpoDaColheita = (
  v: ValoresColheita, editando: boolean, mostrarFaixas: boolean, inicial?: ValoresColheita,
): {
  data: string; kg_p?: number | null; kg_m?: number | null; kg_g?: number | null;
  kg_gg?: number | null; kg_pp?: number | null; estante?: string | null;
} => {
  const pesoIntocado = editando && inicial != null && (
    mostrarFaixas
      ? v.kg_p === inicial.kg_p && v.kg_m === inicial.kg_m && v.kg_g === inicial.kg_g
        && v.kg_gg === inicial.kg_gg && v.kg_pp === inicial.kg_pp
      : v.total === inicial.total
  );
  const estanteIntocada = editando && inicial != null && v.estante.trim() === inicial.estante.trim();
  const estante = estanteIntocada ? {} : { estante: v.estante.trim() || (editando ? null : undefined) };
  if (pesoIntocado) return { data: v.data, ...estante };

  return mostrarFaixas
    ? {
      data: v.data,
      kg_p: somaEdicao(v.kg_p, editando),
      kg_m: somaEdicao(v.kg_m, editando),
      kg_g: somaEdicao(v.kg_g, editando),
      kg_gg: somaEdicao(v.kg_gg, editando),
      kg_pp: somaEdicao(v.kg_pp, editando),
      ...estante,
    }
    : {
      data: v.data,
      kg_p: somaEdicao(v.total, editando),
      kg_m: editando ? null : undefined,
      kg_g: editando ? null : undefined,
      kg_gg: editando ? null : undefined,
      kg_pp: editando ? null : undefined,
      ...estante,
    };
};

export const mostrarFaixasDaColheita = (v: ValoresColheita, editando: boolean, ehSH: boolean) => {
  const vazio = (s: string) => s.trim() === '';
  const semNenhumaFaixa = vazio(v.kg_p) && vazio(v.kg_m) && vazio(v.kg_g) && vazio(v.kg_gg) && vazio(v.kg_pp);
  if (editando && semNenhumaFaixa && !vazio(v.total)) return false;
  return ehSH || (editando && (!vazio(v.kg_m) || !vazio(v.kg_g) || !vazio(v.kg_gg) || !vazio(v.kg_pp)));
};

function colheitaDaLinha(l: JornadaLinha): ValoresColheita {
  return {
    lote: String(l.lote_id),
    data: dataInput(l.data_colheita),
    kg_p: l.kg_p != null ? String(l.kg_p) : '',
    kg_m: l.kg_m != null ? String(l.kg_m) : '',
    kg_g: l.kg_g != null ? String(l.kg_g) : '',
    kg_gg: l.kg_gg != null ? String(l.kg_gg) : '',
    kg_pp: l.kg_pp != null ? String(l.kg_pp) : '',
    total: l.total_kg != null ? String(l.total_kg) : '',
    estante: l.estante_colheita ?? '',
  };
}

const FRASE_COLHEITA_POR_ESTANTE = 'A colheita é de UMA estante só. '
  + 'Se colheu de mais de uma, lance uma colheita para cada, com o kg de cada uma.';

export interface LinhaColheita {
  id: number; estante: string; kg_p: string; kg_m: string; kg_g: string;
  kg_gg: string;
  kg_pp: string;
}
let proximoIdDeColheita = 1;
export const linhaColheitaNova = (estante = ''): LinhaColheita => ({
  id: proximoIdDeColheita++, estante, kg_pp: '', kg_p: '', kg_m: '', kg_g: '', kg_gg: '',
});
export interface CorpoColheita { estante: string; kg_pp?: number; kg_p?: number; kg_m?: number; kg_g?: number; kg_gg?: number }
export type ResultadoColheita = { item: CorpoColheita; ok: boolean; erro?: string };

const NOME_DA_FAIXA: Record<'kg_pp' | 'kg_p' | 'kg_m' | 'kg_g' | 'kg_gg', string> = {
  kg_pp: 'PP', kg_p: 'P', kg_m: 'M', kg_g: 'G', kg_gg: 'GG',
};

export function colheitasParaEnvio(
  linhas: LinhaColheita[], mostrarFaixas: boolean,
): { ok: true; corpos: CorpoColheita[] } | { ok: false; erro: string } {
  const corpos: CorpoColheita[] = [];
  const vistas = new Set<string>();
  const camposAtivos = (mostrarFaixas ? (['kg_pp', 'kg_p', 'kg_m', 'kg_g', 'kg_gg'] as const) : (['kg_p'] as const));
  for (const [i, l] of linhas.entries()) {
    const estante = l.estante.trim();
    const comErro = camposAtivos.map((campo) => ({ campo, erro: somaDePesagens(l[campo]).erro })).find((c) => c.erro);
    if (comErro) {
      const onde = estante !== '' ? `estante ${estante}` : `linha ${i + 1}`;
      const faixa = mostrarFaixas ? `tam ${NOME_DA_FAIXA[comErro.campo]}` : 'Total';
      return { ok: false, erro: `O kg ${faixa} da ${onde} não é número nem soma (${comErro.erro}).` };
    }
    const kg_p = somaDePesagens(l.kg_p).total ?? undefined;
    const kg_m = mostrarFaixas ? somaDePesagens(l.kg_m).total ?? undefined : undefined;
    const kg_g = mostrarFaixas ? somaDePesagens(l.kg_g).total ?? undefined : undefined;
    const kg_gg = mostrarFaixas ? somaDePesagens(l.kg_gg).total ?? undefined : undefined;
    const kg_pp = mostrarFaixas ? somaDePesagens(l.kg_pp).total ?? undefined : undefined;
    const temKg = kg_pp !== undefined || kg_p !== undefined || kg_m !== undefined || kg_g !== undefined || kg_gg !== undefined;
    if (estante === '' && !temKg) continue;
    if (estante === '') return { ok: false, erro: `Informe a estante da linha ${i + 1}.` };
    if (estante.includes(',')) return { ok: false, erro: FRASE_COLHEITA_POR_ESTANTE };
    if (vistas.has(estante)) return { ok: false, erro: `A estante ${estante} está repetida na lista.` };
    vistas.add(estante);
    if (!temKg) return { ok: false, erro: `Informe o kg da estante ${estante} (digite 0 se não rendeu).` };
    corpos.push({
      estante,
      ...(kg_pp !== undefined ? { kg_pp } : {}),
      ...(kg_p !== undefined ? { kg_p } : {}),
      ...(kg_m !== undefined ? { kg_m } : {}),
      ...(kg_g !== undefined ? { kg_g } : {}),
      ...(kg_gg !== undefined ? { kg_gg } : {}),
    });
  }
  if (corpos.length === 0) return { ok: false, erro: 'Informe ao menos uma estante com o kg colhido.' };
  return { ok: true, corpos };
}

export function colheitasQueFicam(
  linhas: LinhaColheita[], resultados: Array<{ item: { estante: string }; ok: boolean }>,
): LinhaColheita[] {
  const gravadas = new Set(resultados.filter((r) => r.ok).map((r) => r.item.estante));
  return linhas.filter((l) => !gravadas.has(l.estante.trim()));
}

export const estantesDaLista = (texto: string | null): string[] =>
  (texto ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '');

export function sugestaoDeEstante(lote: Pick<LoteOpcao, 'estante_frutificacao' | 'abertura_por_estante'> | undefined): string {
  if (!lote?.abertura_por_estante) return '';
  const etiquetas = estantesDaLista(lote.estante_frutificacao);
  return etiquetas.length === 1 ? etiquetas[0] : '';
}

export interface ValoresTransferencia {
  data: string; estanteOrigem: string; estanteDestino: string;
  quantidade: string; observacao: string; registradoPor: string;
}

const TRANSFERENCIA_VAZIA: ValoresTransferencia = {
  data: '', estanteOrigem: '', estanteDestino: '', quantidade: '', observacao: '', registradoPor: '',
};

export function corpoDaTransferencia(v: ValoresTransferencia) {
  const linha: {
    data: string; estante_origem: string; estante_destino: string;
    quantidade?: number; observacao?: string; registrado_por?: string;
  } = { data: v.data, estante_origem: v.estanteOrigem.trim(), estante_destino: v.estanteDestino.trim() };
  if (v.quantidade.trim() !== '') linha.quantidade = Number(v.quantidade);
  if (v.observacao.trim() !== '') linha.observacao = v.observacao.trim();
  if (v.registradoPor.trim() !== '') linha.registrado_por = v.registradoPor.trim();
  return [linha];
}

function FormTransferencia({ lotes, salvando, onSubmit }: {
  lotes: LoteOpcao[]; salvando: boolean;
  onSubmit: (loteId: number, linhas: ReturnType<typeof corpoDaTransferencia>) => Promise<unknown>;
}) {
  const [v, setV] = useState<ValoresTransferencia>(TRANSFERENCIA_VAZIA);
  const [loteId, setLoteId] = useState('');
  const [historico, setHistorico] = useState<TransferenciaSalva[] | null>(null);

  useEffect(() => {
    if (!loteId) { setHistorico(null); return; }
    let vivo = true;
    listarTransferenciasJornada(Number(loteId)).then((linhas) => { if (vivo) setHistorico(linhas); })
      .catch(() => { if (vivo) setHistorico([]); });
    return () => { vivo = false; };
  }, [loteId]);

  const ok = !!(loteId && v.data && v.estanteOrigem.trim() && v.estanteDestino.trim()
    && v.estanteOrigem.trim() !== v.estanteDestino.trim());

  async function enviarTransferencia() {
    const id = Number(loteId);
    await onSubmit(id, corpoDaTransferencia(v));
    setV(TRANSFERENCIA_VAZIA);
    const linhas = await listarTransferenciasJornada(id);
    if (id === Number(loteId)) setHistorico(linhas);
  }

  return (
    <div className="form-grid c4">
      <CampoLote lotes={lotes} valor={loteId} editando={false}
        onChange={(lote) => setLoteId(lote)} />
      <div className="fg"><label>Data <span className="req">*</span></label>
        <CampoData value={v.data} onChange={(iso) => setV({ ...v, data: iso })} /></div>
      <div className="fg"><label>Estante de Origem <span className="req">*</span></label>
        <input value={v.estanteOrigem}
          onChange={(e) => setV({ ...v, estanteOrigem: e.target.value })} /></div>
      <div className="fg"><label>Estante de Destino <span className="req">*</span></label>
        <input value={v.estanteDestino}
          onChange={(e) => setV({ ...v, estanteDestino: e.target.value })} /></div>
      {v.estanteOrigem.trim() && v.estanteOrigem.trim() === v.estanteDestino.trim() && (
        <div className="fixvar-none">Origem e destino são a mesma estante.</div>
      )}
      <div className="fg">
        <label>Quantidade <span className="fixvar-none">(vazio = não contaram)</span></label>
        <input type="number" min={1} value={v.quantidade}
          onChange={(e) => setV({ ...v, quantidade: e.target.value })} /></div>
      <div className="fg"><label>Quem registrou</label>
        <input value={v.registradoPor}
          onChange={(e) => setV({ ...v, registradoPor: e.target.value })} /></div>
      <div className="fg"><label>Observação</label>
        <input value={v.observacao}
          onChange={(e) => setV({ ...v, observacao: e.target.value })} /></div>
      <div className="fg"><label>&nbsp;</label>
        <button className="btn" disabled={!ok || salvando} onClick={enviarTransferencia}>
          {salvando ? 'Salvando…' : 'Registrar transferência'}</button>
      </div>
      {historico != null && historico.length > 0 && (
        <div className="obs-tela" role="status">
          <strong>Transferências já registradas deste lote:</strong>
          <ul>
            {historico.map((h) => (
              <li key={h.id}>
                {h.data}: {h.estante_origem} → {h.estante_destino}
                {h.quantidade != null ? ` (${h.quantidade} blocos)` : ''}
                {h.registrado_por ? `, por ${h.registrado_por}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export interface ValoresEventoAtipico {
  lote: string; tipo: string; descricao: string; observacao: string;
  horaInicio: string; horaRetorno: string;
}

export const EVENTO_ATIPICO_VAZIO: ValoresEventoAtipico = {
  lote: '', tipo: '', descricao: '', observacao: '', horaInicio: '', horaRetorno: '',
};

export function corpoDoEventoAtipico(v: ValoresEventoAtipico): CorpoDoEventoAtipico & { tipo: string } {
  const corpo: CorpoDoEventoAtipico & { tipo: string } = { tipo: v.tipo, observacao: v.observacao.trim() || null };
  if (v.tipo === TIPO_OUTROS) corpo.descricao = v.descricao.trim();
  if (v.tipo === TIPO_FALTA_DE_ENERGIA) {
    corpo.hora_inicio = v.horaInicio || null;
    corpo.hora_retorno = v.horaRetorno || null;
  }
  return corpo;
}

export function faltaNoEventoAtipico(v: ValoresEventoAtipico): string[] {
  const falta: string[] = [];
  if (!v.lote) falta.push('o lote');
  if (!v.tipo) falta.push('o tipo da ocorrência');
  if (v.tipo === TIPO_OUTROS && !v.descricao.trim()) falta.push('o que aconteceu (em Outros é obrigatório)');
  if (v.tipo === TIPO_FALTA_DE_ENERGIA) {
    if (v.horaInicio && !horaValida(v.horaInicio)) falta.push('o horário de início no formato HH:MM (ou deixe vazio)');
    if (v.horaRetorno && !horaValida(v.horaRetorno)) falta.push('o horário de retorno da energia no formato HH:MM (ou deixe vazio)');
  }
  return falta;
}

export const valoresDoEventoAtipico = (e: EventoAtipico): ValoresEventoAtipico => ({
  lote: String(e.lote_id), tipo: e.tipo, descricao: e.descricao ?? '', observacao: e.observacao ?? '',
  horaInicio: e.hora_inicio ?? '', horaRetorno: e.hora_retorno ?? '',
});

export function textoDoEventoAtipico(e: EventoAtipico): string {
  const nome = rotuloDoEventoAtipico(e.tipo);
  let texto = nome;
  if (e.tipo === TIPO_OUTROS) texto = `${nome}: ${e.descricao ?? ''}`;
  if (e.tipo === TIPO_FALTA_DE_ENERGIA) {
    texto = `${nome}: `
      + (e.hora_inicio ? `caiu às ${e.hora_inicio}` : 'horário de início não informado') + ', '
      + (e.hora_retorno ? `voltou às ${e.hora_retorno}` : 'horário de retorno não informado');
  }
  return e.observacao ? `${texto} (${e.observacao})` : texto;
}

export async function apagarSeConfirmado<T>(perguntar: () => Promise<boolean>, apagar: () => Promise<T>): Promise<T | undefined> {
  return (await perguntar()) ? apagar() : undefined;
}

export const textoConfirmacaoExclusaoEventoAtipico =(e: EventoAtipico, lote?: string): string => (
  `Apagar esta ocorrência${lote ? ` do lote ${lote}` : ''}?\n\n${textoDoEventoAtipico(e)}\n\n`
  + 'Não dá para desfazer: ela some da lista do lote.'
);

export function FormEventosAtipicos({ lotes, salvando, onSubmit, onSubmitLoteInteiro, onAtualizar, onApagar, inicial, eventosIniciais }: {
  lotes: LoteOpcao[]; salvando: boolean;
  onSubmit: (loteId: number, corpo: ReturnType<typeof corpoDoEventoAtipico>) => Promise<unknown>;
  onSubmitLoteInteiro: (loteId: number, corpo: ReturnType<typeof corpoDoEventoAtipico>) => Promise<unknown>;
  onAtualizar: (id: number, corpo: ReturnType<typeof corpoDoEventoAtipico>) => Promise<unknown>;
  onApagar: (e: EventoAtipico) => Promise<unknown>;
  inicial?: Partial<ValoresEventoAtipico>;
  eventosIniciais?: EventoAtipico[];
}) {
  const [v, setV] = useState<ValoresEventoAtipico>({ ...EVENTO_ATIPICO_VAZIO, ...inicial });
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [loteInteiro, setLoteInteiro] = useState(true);
  const [lista, setLista] = useState<EventoAtipico[] | null>(eventosIniciais ?? null);
  const [erroLista, setErroLista] = useState('');
  const loteAtual = useRef(v.lote);
  loteAtual.current = v.lote;

  const recarregarLista = useCallback(async (loteId: number) => {
    try {
      const linhas = await listarEventosAtipicosDoLote(loteId);
      if (loteAtual.current === String(loteId)) { setLista(linhas); setErroLista(''); }
    } catch (e) {
      const err = e as { response?: { data?: { erro?: string } }; message: string };
      if (loteAtual.current === String(loteId)) { setLista(null); setErroLista(err.response?.data?.erro ?? err.message); }
    }
  }, []);

  useEffect(() => {
    setLista(null);
    setErroLista('');
    if (v.lote) void recarregarLista(Number(v.lote));
  }, [v.lote, recarregarLista]);

  const falta = faltaNoEventoAtipico(v);
  const ok = falta.length === 0;
  const comecou = Boolean(v.tipo || v.descricao || v.observacao || v.horaInicio || v.horaRetorno);
  const editando = editandoId != null;
  const rotuloDoLoteEscolhido = lotes.find((l) => String(l.lote_id) === v.lote)?.rotulo;
  const irmas = estantesDoMesmoLote(lotes, v.lote);
  const temOutrasEstantes = !editando && irmas.length > 1;

  async function salvar() {
    const loteId = Number(v.lote);
    const corpo = corpoDoEventoAtipico(v);
    const r = editandoId != null ? await onAtualizar(editandoId, corpo)
      : temOutrasEstantes && loteInteiro ? await onSubmitLoteInteiro(loteId, corpo)
        : await onSubmit(loteId, corpo);
    if (r) { setV({ ...EVENTO_ATIPICO_VAZIO, lote: v.lote }); setEditandoId(null); }
    await recarregarLista(loteId);
  }
  async function apagar(e: EventoAtipico) {
    const r = await onApagar(e);
    if (r && editandoId === e.id) { setV({ ...EVENTO_ATIPICO_VAZIO, lote: v.lote }); setEditandoId(null); }
    await recarregarLista(e.lote_id);
  }

  return (
    <div className="form-grid c4">
      <CampoLote lotes={lotes} valor={v.lote} editando={editando}
        onChange={(lote) => setV({ ...v, lote })} />
      <div className="fg span2"><label>Tipo da ocorrência <span className="req">*</span></label>
        <select value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
          <option value="">Selecione o tipo…</option>
          {TIPOS_DE_EVENTO_ATIPICO.map((t) => <option key={t.codigo} value={t.codigo}>{t.rotulo}</option>)}
        </select></div>
      {v.tipo === TIPO_OUTROS && (
        <div className="fg span2"><label>O que aconteceu <span className="req">*</span></label>
          <input value={v.descricao} maxLength={TEXTO_MAX_DO_EVENTO_ATIPICO}
            onChange={(e) => setV({ ...v, descricao: e.target.value })} /></div>
      )}
      {v.tipo === TIPO_FALTA_DE_ENERGIA && (
        <>
          <div className="fg">
            <label>Horário de início <span className="fixvar-none">(pode ficar vazio)</span></label>
            <input type="time" value={v.horaInicio}
              onChange={(e) => setV({ ...v, horaInicio: e.target.value })} /></div>
          <div className="fg">
            <label>Horário de retorno da energia <span className="fixvar-none">(pode ficar vazio)</span></label>
            <input type="time" value={v.horaRetorno}
              onChange={(e) => setV({ ...v, horaRetorno: e.target.value })} /></div>
        </>
      )}
      <div className="fg span2"><label>Observação <span className="fixvar-none">(opcional)</span></label>
        <input value={v.observacao} maxLength={TEXTO_MAX_DO_EVENTO_ATIPICO}
          onChange={(e) => setV({ ...v, observacao: e.target.value })} /></div>
      {temOutrasEstantes && (
        <div className="fg span2"><label>
          <input type="checkbox" checked={loteInteiro} onChange={(e) => setLoteInteiro(e.target.checked)} />
          {' '}Registrar no lote inteiro, em todas as estantes de {dataBr(irmas[0].data_lote ?? '')} · {irmas[0].tipo}
        </label></div>
      )}
      <div className="fg"><label>&nbsp;</label>
        <button className="btn" disabled={!ok || salvando} onClick={salvar}>
          {salvando ? 'Salvando…' : (editando ? 'Salvar correção' : 'Registrar ocorrência')}</button>
        {comecou && falta.length > 0 && (
          <span className="fixvar-none" role="status">Para registrar, falta {falta.join(', ')}.</span>
        )}</div>
      {editando && (
        <div className="fg"><label>&nbsp;</label>
          <button className="btn ghost" disabled={salvando}
            onClick={() => { setEditandoId(null); setV({ ...EVENTO_ATIPICO_VAZIO, lote: v.lote }); }}>
            Cancelar correção</button></div>
      )}
      {erroLista && (
        <div className="obs-tela" role="alert">Não foi possível ler as ocorrências deste lote: {erroLista}</div>
      )}
      {v.lote && !erroLista && lista != null && (
        <div className="obs-tela" role="status">
          <strong>Ocorrências deste lote{rotuloDoLoteEscolhido ? ` (${rotuloDoLoteEscolhido})` : ''}:</strong>
          {lista.length === 0 ? ' nenhuma registrada.' : (
            <ul>
              {lista.map((e) => (
                <li key={e.id}>
                  {textoDoEventoAtipico(e)}{' '}
                  <button className="btn ghost" disabled={salvando}
                    onClick={() => { setEditandoId(e.id); setV(valoresDoEventoAtipico(e)); }}>Editar</button>{' '}
                  <button className="btn ghost" disabled={salvando} onClick={() => apagar(e)}>Apagar</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function CampoKg({ id, rotulo, dica, valor, ariaLabel, onChange }: {
  id: string; rotulo: string; dica?: string; valor: string; ariaLabel?: string; onChange: (v: string) => void;
}) {
  const soma = somaDePesagens(valor);
  return (
    <div className="fg"><label htmlFor={id}>{rotulo} {dica && <span className="fixvar-none">({dica})</span>}</label>
      <input id={id} type="text" inputMode="decimal" value={valor} aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)} />
      {soma.erro && <span className="fixvar-none" role="status">{soma.erro}</span>}
      {!soma.erro && soma.parcelas.length > 1 && <span className="fixvar-none">= {num(soma.total, 3)} kg</span>}
    </div>
  );
}

export async function confirmarSemRendimento(
  corpos: CorpoColheita[], confirmar: (texto: string) => Promise<boolean>,
): Promise<boolean> {
  const aZero = corpos
    .filter((c) => (c.kg_pp ?? 0) + (c.kg_p ?? 0) + (c.kg_m ?? 0) + (c.kg_g ?? 0) + (c.kg_gg ?? 0) === 0)
    .map((c) => c.estante);
  if (aZero.length === 0) return true;
  return confirmar(
    `Registrar colheita SEM RENDIMENTO (0 kg) na${aZero.length > 1 ? 's estantes' : ' estante'} ${aZero.join(', ')}?\n\n`
    + 'Isso grava que a estante foi colhida e não rendeu nada, e o 0 entra nos indicadores.',
  );
}

export function FormEdicaoColheita({ lotes, salvando, inicial, tipoFixo, onSubmit, onAcrescentar, linhasAcrescimoIniciais }: {
  lotes: LoteOpcao[]; salvando: boolean;
  inicial: ValoresColheita; tipoFixo: string;
  onSubmit: (b: {
    data: string; kg_p?: number | null; kg_m?: number | null; kg_g?: number | null;
    kg_gg?: number | null; kg_pp?: number | null; estante?: string | null;
  }) => void;
  onAcrescentar?: (data: string, corpos: CorpoColheita[]) => Promise<ResultadoColheita[]>;
  linhasAcrescimoIniciais?: LinhaColheita[];
}) {
  const [v, setV] = useState<ValoresColheita>(inicial);
  const ehSH = tipoFixo === 'SH';
  const mostrarFaixas = mostrarFaixasDaColheita(v, true, ehSH);
  const sufixoSH = ehSH ? ' (SH)' : '';
  const estanteEhLista = v.estante.includes(',') && v.estante.trim() !== inicial.estante.trim();
  const kgValido = (mostrarFaixas ? [v.kg_pp, v.kg_p, v.kg_m, v.kg_g, v.kg_gg] : [v.total])
    .every((texto) => !somaDePesagens(texto).erro);
  const ok = !!(v.lote && v.data) && !estanteEhLista && kgValido;

  const confirmar = useConfirmar();
  const [linhasAcrescimo, setLinhasAcrescimo] = useState<LinhaColheita[]>(
    () => linhasAcrescimoIniciais ?? [linhaColheitaNova()],
  );
  const [relatoAcrescimo, setRelatoAcrescimo] = useState<string | null>(null);
  const atualizarLinhaAcrescimo = (id: number, mudanca: Partial<LinhaColheita>) =>
    setLinhasAcrescimo(linhasAcrescimo.map((l) => (l.id === id ? { ...l, ...mudanca } : l)));
  const removerLinhaAcrescimo = (id: number) => setLinhasAcrescimo(linhasAcrescimo.filter((l) => l.id !== id));
  const validacaoAcrescimo = colheitasParaEnvio(linhasAcrescimo, ehSH);
  const tocadoAcrescimo = linhasAcrescimo.some((l) => [l.estante, l.kg_pp, l.kg_p, l.kg_m, l.kg_g, l.kg_gg].some((s) => s.trim() !== ''));
  const erroAcrescimo = validacaoAcrescimo.ok || !tocadoAcrescimo ? null : validacaoAcrescimo.erro;
  const okAcrescimo = validacaoAcrescimo.ok && validacaoAcrescimo.corpos.length > 0 && !!v.data;
  const totalAcrescimo = validacaoAcrescimo.ok
    ? validacaoAcrescimo.corpos.reduce((s, c) => s + (c.kg_pp ?? 0) + (c.kg_p ?? 0) + (c.kg_m ?? 0) + (c.kg_g ?? 0) + (c.kg_gg ?? 0), 0)
    : null;
  async function acrescentar() {
    if (!validacaoAcrescimo.ok) return;
    if (!onAcrescentar) return;
    if (!(await confirmarSemRendimento(validacaoAcrescimo.corpos, confirmar))) return;
    const resultados = await onAcrescentar(v.data, validacaoAcrescimo.corpos);
    if (resultados.length === 0) return;
    if (resultados.every((r) => r.ok)) {
      setLinhasAcrescimo([linhaColheitaNova()]);
      setRelatoAcrescimo(null);
      return;
    }
    setRelatoAcrescimo(relatoEnvioMultiplo(resultados, { substantivo: 'colheita', etiqueta: (c) => c.estante }));
    setLinhasAcrescimo((prev) => colheitasQueFicam(prev, resultados));
  }
  const campoKgAcrescimo = (l: LinhaColheita, i: number, campo: 'kg_pp' | 'kg_p' | 'kg_m' | 'kg_g' | 'kg_gg', rotulo: string) => (
    <CampoKg id={`edicao-colheita-acrescimo-${campo}-${l.id}`} rotulo={rotulo} valor={l[campo]}
      ariaLabel={`${rotulo} da estante nova ${i + 1}`}
      onChange={(valor) => atualizarLinhaAcrescimo(l.id, { [campo]: valor })} />
  );

  return (
    <div className="form-grid c4">
      <CampoLote lotes={lotes} valor={v.lote} editando
        onChange={(lote) => setV({ ...v, lote })} />
      <div className="fg"><label>Data da Colheita <span className="req">*</span></label>
        <CampoData value={v.data} onChange={(iso) => setV({ ...v, data: iso })} /></div>
      <div className="fg">
        <label htmlFor="edicao-colheita-estante"
          title="Em qual estante esta colheita foi feita. Uma estante só. Vazio = não informado.">
          Estante da Colheita <span className="fixvar-none">(uma estante; vazio = não informado)</span>
        </label>
        <input id="edicao-colheita-estante" value={v.estante} placeholder="6"
          onChange={(e) => setV({ ...v, estante: e.target.value })} />
        {estanteEhLista && <span className="fixvar-none" role="status">{FRASE_COLHEITA_POR_ESTANTE}</span>}
      </div>
      {mostrarFaixas ? (
        <>
          <CampoKg id="edicao-colheita-kg_pp" rotulo={`KG Colhidos tam PP${sufixoSH}`} valor={v.kg_pp}
            onChange={(kg_pp) => setV({ ...v, kg_pp })} />
          <CampoKg id="edicao-colheita-kg_p" rotulo={`KG Colhidos tam P${sufixoSH}`} valor={v.kg_p}
            onChange={(kg_p) => setV({ ...v, kg_p })} />
          <CampoKg id="edicao-colheita-kg_m" rotulo={`KG Colhidos tam M${sufixoSH}`} valor={v.kg_m}
            onChange={(kg_m) => setV({ ...v, kg_m })} />
          <CampoKg id="edicao-colheita-kg_g" rotulo={`KG Colhidos tam G${sufixoSH}`} valor={v.kg_g}
            onChange={(kg_g) => setV({ ...v, kg_g })} />
          <CampoKg id="edicao-colheita-kg_gg" rotulo={`KG Colhidos tam GG${sufixoSH}`} valor={v.kg_gg}
            onChange={(kg_gg) => setV({ ...v, kg_gg })} />
        </>
      ) : (
        <CampoKg id="edicao-colheita-total" rotulo="Total Kg Colhidos" dica="0 = colheita sem rendimento"
          valor={v.total} onChange={(total) => setV({ ...v, total })} />
      )}
      <div className="fg"><label>&nbsp;</label>
        <button className="btn" disabled={!ok || salvando}
          onClick={() => onSubmit(corpoDaColheita(v, true, mostrarFaixas, inicial))}>
          {salvando ? 'Salvando…' : 'Salvar alterações da colheita'}</button>
      </div>
      <div className="fg" style={{ gridColumn: '1 / -1' }}>
        <div className="fsec">Acrescentar estante a esta colheita <span className="fixvar-none">(mesmo lote, na data acima; uma linha por estante)</span></div>
        {linhasAcrescimo.map((l, i) => (
          <div className="form-grid c4" key={l.id}>
            <div className="fg"><label htmlFor={`edicao-colheita-acrescimo-estante-${l.id}`}>Estante de frutificação</label>
              <input id={`edicao-colheita-acrescimo-estante-${l.id}`} value={l.estante} placeholder="8"
                aria-label={`Estante nova ${i + 1}`}
                onChange={(e) => atualizarLinhaAcrescimo(l.id, { estante: e.target.value })} /></div>
            {ehSH ? (
              <>
                {campoKgAcrescimo(l, i, 'kg_pp', `KG Colhidos tam PP${sufixoSH}`)}
                {campoKgAcrescimo(l, i, 'kg_p', `KG Colhidos tam P${sufixoSH}`)}
                {campoKgAcrescimo(l, i, 'kg_m', `KG Colhidos tam M${sufixoSH}`)}
                {campoKgAcrescimo(l, i, 'kg_g', `KG Colhidos tam G${sufixoSH}`)}
                {campoKgAcrescimo(l, i, 'kg_gg', `KG Colhidos tam GG${sufixoSH}`)}
              </>
            ) : campoKgAcrescimo(l, i, 'kg_p', 'Total Kg Colhidos')}
            {linhasAcrescimo.length > 1 && (
              <div className="fg"><label>&nbsp;</label>
                <button type="button" className="btn ghost" onClick={() => removerLinhaAcrescimo(l.id)}>Remover linha {i + 1}</button></div>
            )}
          </div>
        ))}
        <div className="form-acao">
          <button type="button" className="btn ghost"
            onClick={() => setLinhasAcrescimo([...linhasAcrescimo, linhaColheitaNova()])}>
            + Adicionar estante
          </button>
        </div>
        {erroAcrescimo && <span className="fixvar-none" role="status">{erroAcrescimo}</span>}
        {validacaoAcrescimo.ok && validacaoAcrescimo.corpos.length > 0 && (
          <div className="fixvar-none">
            Total a acrescentar: {num(totalAcrescimo, 3)} kg em {validacaoAcrescimo.corpos.length}{' '}
            {validacaoAcrescimo.corpos.length === 1 ? 'estante' : 'estantes'}
          </div>
        )}
        <div className="fg"><label>&nbsp;</label>
          <button className="btn" disabled={!okAcrescimo || salvando} onClick={acrescentar}>
            {salvando ? 'Salvando…' : 'Acrescentar estantes'}</button></div>
        {relatoAcrescimo && <div className="obs-tela" role="status">{relatoAcrescimo}</div>}
      </div>
    </div>
  );
}

export function FormColheita({ lotes, salvando, onSubmit, linhasIniciais, loteInicial }: {
  lotes: LoteOpcao[]; salvando: boolean;
  onSubmit: (loteId: number, data: string, corpos: CorpoColheita[]) => Promise<ResultadoColheita[]>;
  linhasIniciais?: LinhaColheita[]; loteInicial?: string;
}) {
  const confirmar = useConfirmar();
  const loteDe = (id: string) => lotes.find((l) => String(l.lote_id) === id);
  const [v, setV] = useState(() => ({
    lote: loteInicial ?? '', data: hojeISO(),
    linhas: linhasIniciais ?? [linhaColheitaNova(sugestaoDeEstante(loteDe(loteInicial ?? '')))],
  }));
  const [relato, setRelato] = useState<string | null>(null);
  const lote = loteDe(v.lote);
  const ehSH = lote?.tipo === 'SH';
  const mostrarFaixas = ehSH;
  const sufixoSH = ehSH ? ' (SH)' : '';
  const etiquetas = lote?.abertura_por_estante ? estantesDaLista(lote.estante_frutificacao) : [];
  const mudarLote = (id: string) => setV({ ...v, lote: id, linhas: [linhaColheitaNova(sugestaoDeEstante(loteDe(id)))] });
  const atualizarLinha = (id: number, mudanca: Partial<LinhaColheita>) =>
    setV({ ...v, linhas: v.linhas.map((l) => (l.id === id ? { ...l, ...mudanca } : l)) });
  const removerLinha = (id: number) => setV({ ...v, linhas: v.linhas.filter((l) => l.id !== id) });
  const validacao = colheitasParaEnvio(v.linhas, mostrarFaixas);
  const tocado = v.linhas.some((l) => [l.estante, l.kg_pp, l.kg_p, l.kg_m, l.kg_g, l.kg_gg].some((s) => s.trim() !== ''));
  const erroLinhas = validacao.ok || !tocado ? null : validacao.erro;
  const ok = !!(v.lote && v.data) && validacao.ok;

  async function enviar() {
    if (!validacao.ok) return;
    if (!(await confirmarSemRendimento(validacao.corpos, confirmar))) return;
    const resultados = await onSubmit(Number(v.lote), v.data, validacao.corpos);
    if (resultados.every((r) => r.ok)) return;
    setRelato(relatoEnvioMultiplo(resultados, { substantivo: 'colheita', etiqueta: (c) => c.estante }));
    setV((prev) => ({ ...prev, linhas: colheitasQueFicam(prev.linhas, resultados) }));
  }

  const campoKg = (l: LinhaColheita, i: number, campo: 'kg_pp' | 'kg_p' | 'kg_m' | 'kg_g' | 'kg_gg', rotulo: string) => (
    <CampoKg id={`colheita-${campo}-${l.id}`} rotulo={rotulo} valor={l[campo]}
      ariaLabel={`${rotulo} da linha ${i + 1}`}
      onChange={(v) => atualizarLinha(l.id, { [campo]: v })} />
  );

  const totalLancamento = validacao.ok
    ? validacao.corpos.reduce((s, c) => s + (c.kg_pp ?? 0) + (c.kg_p ?? 0) + (c.kg_m ?? 0) + (c.kg_g ?? 0) + (c.kg_gg ?? 0), 0)
    : null;

  return (
    <div className="form-grid c4">
      <CampoLote lotes={lotes} valor={v.lote} editando={false} onChange={mudarLote} />
      <div className="fg"><label>Data da Colheita <span className="req">*</span></label>
        <CampoData value={v.data} onChange={(iso) => setV({ ...v, data: iso })} /></div>
      <div className="fg" style={{ gridColumn: '1 / -1' }}>
        <div className="fsec">Estantes colhidas <span className="fixvar-none">(uma linha por estante; kg vazio = não informado, 0 = não rendeu)</span></div>
        {v.linhas.map((l, i) => (
          <div className="form-grid c4" key={l.id}>
            <div className="fg"><label htmlFor={`colheita-estante-${l.id}`}>Estante de frutificação</label>
              <input id={`colheita-estante-${l.id}`} value={l.estante} placeholder="8"
                list={etiquetas.length > 0 ? `colheita-estantes-${l.id}` : undefined}
                aria-label={`Estante de frutificação da linha ${i + 1}`}
                onChange={(e) => atualizarLinha(l.id, { estante: e.target.value })} />
              {etiquetas.length > 0 && (
                <datalist id={`colheita-estantes-${l.id}`}>
                  {etiquetas.map((e) => <option key={e} value={e} />)}
                </datalist>
              )}</div>
            {mostrarFaixas ? (
              <>
                {campoKg(l, i, 'kg_pp', `KG Colhidos tam PP${sufixoSH}`)}
                {campoKg(l, i, 'kg_p', `KG Colhidos tam P${sufixoSH}`)}
                {campoKg(l, i, 'kg_m', `KG Colhidos tam M${sufixoSH}`)}
                {campoKg(l, i, 'kg_g', `KG Colhidos tam G${sufixoSH}`)}
                {campoKg(l, i, 'kg_gg', `KG Colhidos tam GG${sufixoSH}`)}
              </>
            ) : campoKg(l, i, 'kg_p', 'Total Kg Colhidos')}
            {v.linhas.length > 1 && (
              <div className="fg"><label>&nbsp;</label>
                <button type="button" className="btn ghost" onClick={() => removerLinha(l.id)}>Remover linha {i + 1}</button></div>
            )}
          </div>
        ))}
        <div className="form-acao">
          <button type="button" className="btn ghost" onClick={() => setV({ ...v, linhas: [...v.linhas, linhaColheitaNova()] })}>
            + Adicionar estante
          </button>
        </div>
        {erroLinhas && <span className="fixvar-none" role="status">{erroLinhas}</span>}
        {totalLancamento != null && validacao.ok && (
          <div className="fixvar-none">
            Total do lançamento: {num(totalLancamento, 2)} kg em {validacao.corpos.length}{' '}
            {validacao.corpos.length === 1 ? 'estante' : 'estantes'}
          </div>
        )}
      </div>
      <div className="fg"><label>&nbsp;</label>
        <button className="btn" disabled={!ok || salvando} onClick={enviar}>
          {salvando ? 'Salvando…' : 'Registrar colheita'}</button></div>
      {relato && <div className="fg span2"><div className="obs-tela" role="status">{relato}</div></div>}
    </div>
  );
}

export interface ResultadoContaminacao { cor: TipoContaminado; ok: boolean; erro?: string }

export async function tentarTodasEmSequencia<T extends { cor: TipoContaminado }>(
  itens: T[],
  tentar: (item: T) => Promise<{ ok: true } | { ok: false; erro: string }>,
): Promise<ResultadoContaminacao[]> {
  const resultados: ResultadoContaminacao[] = [];
  for (const item of itens) {
    const r = await tentar(item);
    resultados.push(r.ok ? { cor: item.cor, ok: true } : { cor: item.cor, ok: false, erro: r.erro });
  }
  return resultados;
}

export async function enviarEmSequencia<T>(
  itens: T[],
  tentar: (item: T) => Promise<{ ok: true } | { ok: false; erro: string }>,
): Promise<Array<{ item: T; ok: boolean; erro?: string }>> {
  const resultados: Array<{ item: T; ok: boolean; erro?: string }> = [];
  for (const item of itens) {
    const r = await tentar(item);
    resultados.push(r.ok ? { item, ok: true } : { item, ok: false, erro: r.erro });
  }
  return resultados;
}

export const SEM_LISTA_DE_GALPOES = 'Carregando a lista de galpões… Se não aparecer, recarregue a página.';

const enderecoDoCorpo = (c: { galpao?: string; estante_maturacao?: string }, regras: Parameters<typeof rotuloDoGalpao>[1]) => (
  c.galpao ? `${galpaoCurto(c.galpao, regras)}/${c.estante_maturacao ?? '?'}` : (c.estante_maturacao ?? '?')
);

export function relatoLotesMultiplos(
  resultados: Array<{ item: { galpao?: string; estante_maturacao?: string }; ok: boolean; erro?: string }>,
  regras: Parameters<typeof rotuloDoGalpao>[1] = [],
): string {
  return relatoEnvioMultiplo(resultados, { substantivo: 'lote', etiqueta: (c) => enderecoDoCorpo(c, regras) });
}

const GRAVOU_TUDO = { lote: 'Lote criado', colheita: 'Colheita registrada' } as const;

export function relatoEnvioMultiplo<T>(
  resultados: Array<{ item: T; ok: boolean; erro?: string }>,
  { substantivo, etiqueta }: { substantivo: keyof typeof GRAVOU_TUDO; etiqueta: (item: T) => string },
): string {
  const sim = resultados.filter((r) => r.ok);
  const nao = resultados.filter((r) => !r.ok);
  const lista = (rs: typeof resultados) => rs.map((r) => etiqueta(r.item)).join(', ');
  if (nao.length === 0) {
    return sim.length === 1
      ? `${GRAVOU_TUDO[substantivo]} na estante ${lista(sim)}.`
      : `${GRAVOU_TUDO[substantivo]} em ${sim.length} estantes: ${lista(sim)}.`;
  }
  if (sim.length === 0) {
    return `Nenhuma estante foi gravada. ${nao.map((r) => `${etiqueta(r.item)}: ${r.erro}`).join(' ')}.`;
  }
  return `Gravou ${sim.length} de ${resultados.length} estantes: ${lista(sim)}. `
    + `NÃO gravou ${nao.map((r) => `${etiqueta(r.item)} (${r.erro})`).join(', ')}. `
    + 'As que gravaram não precisam ser reenviadas.';
}

export function galpoesDasRegras(regras: Array<{ galpao_codigo: string; observacao?: string | null }>): string[] {
  return ordenarGalpoes([...new Set(regras.map((r) => r.galpao_codigo.trim()).filter((g) => g !== ''))], regras);
}

export function coresParaEnvio(
  quantidades: Record<TipoContaminado, string>,
): Array<{ tipo_contaminado: TipoContaminado; quantidade: number }> {
  return CORES_CONTAMINACAO
    .map((cor) => ({ tipo_contaminado: cor, quantidade: opcNum(quantidades[cor]) }))
    .filter((c): c is { tipo_contaminado: TipoContaminado; quantidade: number } => (
      c.quantidade !== undefined && c.quantidade > 0
    ));
}

export function relatoContaminacaoMultipla(resultados: ResultadoContaminacao[]): string {
  const sucesso = resultados.filter((r) => r.ok);
  const falha = resultados.filter((r) => !r.ok);
  const total = resultados.length;
  const listaCores = (rs: ResultadoContaminacao[]) => rs.map((r) => r.cor).join(', ');

  if (falha.length === 0) {
    return total === 1
      ? `Contaminação registrada: ${sucesso[0].cor}.`
      : `As ${total} contaminações foram registradas: ${listaCores(sucesso)}.`;
  }
  if (sucesso.length === 0) {
    return total === 1
      ? `A contaminação NÃO foi registrada (${resultados[0].cor}): ${resultados[0].erro}`
      : `Nenhuma das ${total} contaminações foi registrada: `
        + `${falha.map((r) => `${r.cor} (${r.erro})`).join('; ')}`;
  }
  return `${sucesso.length} de ${total} contaminações registradas (${listaCores(sucesso)}); `
    + `${falha.map((r) => `${r.cor} NÃO gravada: ${r.erro}`).join('; ')}`;
}

export interface ValoresContaminacao {
  lote: string; data_retirada: string; tipo_evento: 'CONTAMINACAO' | 'PERDA';
  quantidade: string; estante: string;
  quantidades: Record<TipoContaminado, string>;
  motivo: string; saldo_total: boolean;
}

export const corpoDaContaminacao = (v: ValoresContaminacao) => {
  const base = {
    lote_id: Number(v.lote), data_retirada: v.data_retirada,
    estante: v.estante.trim() || undefined,
  };
  return v.tipo_evento === 'PERDA'
    ? {
      ...base, tipo_evento: 'PERDA' as const,
      ...(v.saldo_total ? { saldo_total: true as const } : { quantidade: Number(v.quantidade) }),
      ...(v.motivo.trim() ? { motivo: v.motivo.trim() } : {}),
    }
    : { ...base, cores: coresParaEnvio(v.quantidades) };
};

export function formContaminacaoOk(v: ValoresContaminacao, lote?: LoteDaContaminacao): boolean {
  return !v.estante.includes(',') && faltaNaContaminacao(v, lote).length === 0;
}

type LoteDaContaminacao = Pick<LoteOpcao, 'tipo' | 'maturacao' | 'estante_maturacao'> | undefined;

export function estanteDoLote(lote: LoteDaContaminacao): string {
  const e = (lote?.estante_maturacao ?? '').trim();
  return /^[A-Za-z0-9]+$/.test(e) ? e : '';
}

export function aoTrocarLote(v: ValoresContaminacao, lote: string, lotes: LoteOpcao[]): ValoresContaminacao {
  if (v.tipo_evento === 'PERDA') return { ...v, lote };
  return { ...v, lote, estante: estanteDoLote(lotes.find((l) => String(l.lote_id) === lote)) };
}

export function aoTrocarTipo(
  v: ValoresContaminacao, tipo: ValoresContaminacao['tipo_evento'], lote: LoteDaContaminacao,
): ValoresContaminacao {
  const doLote = estanteDoLote(lote);
  if (tipo === 'PERDA') return { ...v, tipo_evento: tipo, estante: v.estante.trim() === doLote ? '' : v.estante };
  return { ...v, tipo_evento: tipo, estante: v.estante.trim() || doLote };
}

export function faltaNaContaminacao(v: ValoresContaminacao, lote?: LoteDaContaminacao): string[] {
  const ehPerda = v.tipo_evento === 'PERDA';
  const falta: string[] = [];
  if (!v.lote) falta.push('o lote');
  const doCadastro = v.lote && !ehPerda && lote
    ? [!lote.maturacao && 'a maturação', !lote.tipo?.trim() && 'o tipo (espécie)'].filter(Boolean)
    : [];
  if (doCadastro.length) falta.push(`${doCadastro.join(' e ')} do lote (corrija em Editar lote)`);
  if (!v.data_retirada) falta.push('a data da retirada');
  if (!ehPerda && !v.estante.trim()) falta.push('a estante da retirada');
  if (ehPerda ? !(v.saldo_total || Number(v.quantidade) > 0) : coresParaEnvio(v.quantidades).length === 0) {
    falta.push(ehPerda ? 'a quantidade' : 'a quantidade de pelo menos uma cor');
  }
  return falta;
}

export function FormContaminacao({
  lotes, salvando, onSubmit, inicial, inicialSaldoTotal, inicialLote, pessoas = [], onCriarPessoa = async () => {},
  erroSaldo = null, onRegistrarDivergencia,
}: {
  lotes: LoteOpcao[]; salvando: boolean;
  inicial?: 'CONTAMINACAO' | 'PERDA';
  inicialSaldoTotal?: boolean;
  inicialLote?: string;
  onSubmit: (b: { lote_id: number; data_retirada: string; estante?: string }
    & ({ tipo_evento: 'PERDA'; quantidade?: number; saldo_total?: true; motivo?: string }
      | { cores: Array<{ tipo_contaminado: TipoContaminado; quantidade: number }> })) => void;
  pessoas?: Pessoa[];
  onCriarPessoa?: (nome: string) => Promise<unknown>;
  erroSaldo?: ErroSaldo | null;
  onRegistrarDivergencia?: (corpo: {
    lote_id: number; tipo: 'RETIRADA'; data: string; esperado: number; informado: number;
    responsavel: string; observacao?: string;
  }) => void;
}) {
  const [v, setV] = useState<ValoresContaminacao>(() => aoTrocarLote({
    lote: '', data_retirada: '', tipo_evento: (inicial ?? 'CONTAMINACAO') as 'CONTAMINACAO' | 'PERDA',
    quantidade: '', estante: '',
    quantidades: Object.fromEntries(CORES_CONTAMINACAO.map((c) => [c, ''])) as Record<TipoContaminado, string>,
    motivo: '', saldo_total: inicialSaldoTotal ?? false,
  }, inicialLote ?? '', lotes));
  const ehPerda = v.tipo_evento === 'PERDA';
  const estanteEhLista = v.estante.includes(',');
  const loteEscolhido = lotes.find((l) => String(l.lote_id) === v.lote);
  const ok = formContaminacaoOk(v, loteEscolhido);
  const falta = faltaNaContaminacao(v, loteEscolhido);
  const comecou = Boolean(v.lote || v.data_retirada || v.quantidade || Object.values(v.quantidades).some(Boolean));
  return (
    <div className="form-grid c4">
      <div className="fg span2"><label>Lote <span className="req">*</span></label>
        <SelectLote lotes={lotes} value={v.lote}
          onChange={(lote) => setV(aoTrocarLote(v, lote, lotes))} />
        {loteEscolhido && (
          <span className="fixvar-none">
            Do lote: maturação {loteEscolhido.maturacao ?? 'não informada'}, estante {loteEscolhido.estante_maturacao?.trim() || 'não informada'}, espécie {loteEscolhido.tipo || 'não informada'}.
          </span>
        )}</div>
      <div className="fg"><label>Data da Retirada <span className="req">*</span></label>
        <CampoData value={v.data_retirada} onChange={(iso) => setV({ ...v, data_retirada: iso })} /></div>
      <div className="fg">
        <label title={'De qual estante o bloco saiu. Uma estante só: o registro é por retirada, não pelo endereço inteiro do lote.'
          + (ehPerda ? '' : ' Vem preenchida com a estante do lote.')}>
          Estante da Retirada {ehPerda
            ? <span className="fixvar-none">(vazio = não informado)</span>
            : <span className="req">*</span>}
        </label>
        <input value={v.estante} placeholder="7"
          onChange={(e) => setV({ ...v, estante: e.target.value })} />
        {estanteEhLista && (
          <span className="fixvar-none" role="status">
            A retirada é de UMA estante só. Se a contaminação saiu de mais de uma,
            lance uma retirada para cada: é assim que a plaquinha do galpão registra.
          </span>
        )}</div>
      <div className="fg"><label>Tipo <span className="req">*</span></label>
        <select value={v.tipo_evento} onChange={(e) => setV(aoTrocarTipo(v, e.target.value as 'CONTAMINACAO' | 'PERDA', loteEscolhido))}>
          <option value="CONTAMINACAO">Contaminação</option>
          <option value="PERDA">Perda ou descarte (rasgado, furado, estragado)</option>
        </select></div>
      {ehPerda ? (
        <>
          {!v.saldo_total && (
            <div className="fg"><label>Quantidade <span className="req">*</span></label>
              <input type="number" min={1} value={v.quantidade} onChange={(e) => setV({ ...v, quantidade: e.target.value })} /></div>
          )}
          <div className="fg"><label>
            <input type="checkbox" checked={v.saldo_total}
              onChange={(e) => setV({ ...v, saldo_total: e.target.checked, quantidade: '' })} /> Baixar o saldo total do lote nesta estante
          </label></div>
          <div className="fg span2"><label htmlFor="perda-motivo">Motivo</label>
            <input id="perda-motivo" type="text" maxLength={200}
              placeholder="ex.: passou do prazo de abertura e estragou"
              value={v.motivo} onChange={(e) => setV({ ...v, motivo: e.target.value })} /></div>
        </>
      ) : (
        CORES_CONTAMINACAO.map((cor) => (
          <div className="fg" key={cor}>
            <label htmlFor={`qtd-contaminado-${cor}`}>
              Quantidade {cor} <span className="fixvar-none">(vazio = não houve)</span>
            </label>
            <input id={`qtd-contaminado-${cor}`} type="number" min={1} placeholder="vazio = não houve"
              value={v.quantidades[cor]}
              onChange={(e) => setV({ ...v, quantidades: { ...v.quantidades, [cor]: e.target.value } })} />
          </div>
        ))
      )}
      <div className="fg"><label>&nbsp;</label>
        <button className="btn" disabled={!ok || salvando} onClick={() => onSubmit(corpoDaContaminacao(v))}>
          {salvando ? 'Salvando…' : (ehPerda ? 'Registrar perda' : 'Registrar contaminação')}</button>
        {comecou && falta.length > 0 && (
          <span className="fixvar-none" role="status">Para registrar, falta {falta.join(', ')}.</span>
        )}</div>
      {erroSaldo && (
        <BlocoDivergencia erroSaldo={erroSaldo} pessoas={pessoas} onCriarPessoa={onCriarPessoa}
          onRegistrar={(responsavel, observacao) => onRegistrarDivergencia?.({
            lote_id: Number(v.lote), tipo: 'RETIRADA', data: v.data_retirada,
            esperado: erroSaldo.sobra, informado: erroSaldo.informado,
            responsavel, ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
          })} />
      )}
    </div>
  );
}
