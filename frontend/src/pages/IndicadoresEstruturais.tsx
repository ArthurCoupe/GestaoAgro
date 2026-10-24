import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getEstruturais, num, putEstruturaisMensal, putEstruturaisSala,
  type EstruturaisResposta,
} from '../api/client';
import { useAuth } from '../auth';
import { criarGuardaDeCorrida, useRecarregarAtual } from '../components/BlocosOperacionais';
import { Panel, useToast } from '../components/ui';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const fmCb = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export function anoValido(texto: string): number | null {
  const n = Number(texto);
  return Number.isInteger(n) && n >= 2000 ? n : null;
}

export type LadoSalvo = 'bio' | 'sala';
export function proximoEditBio(lado: LadoSalvo, atual: Record<string, string>): Record<string, string> {
  return lado === 'bio' ? {} : atual;
}
export function proximoEditSala(lado: LadoSalvo, atual: Record<string, string>): Record<string, string> {
  return lado === 'sala' ? {} : atual;
}

export type CorpoSala = {
  salaId: number;
  num_estantes?: number | null;
  capacidade_blocos?: number | null;
  dias_medios?: number | null;
  galpao_codigo?: string | null;
  apelido?: string | null;
};

export function corpoSala(editSala: Record<string, string>, salaId: number): CorpoSala {
  const corpo: CorpoSala = { salaId };
  const numero = (campo: string): number | null | undefined => {
    const v = editSala[`${salaId}:${campo}`];
    if (v === undefined) return undefined;
    return v === '' ? null : Number(v);
  };
  const palavra = (campo: string): string | null | undefined => {
    const v = editSala[`${salaId}:${campo}`];
    if (v === undefined) return undefined;
    const t = v.trim();
    return t === '' ? null : t;
  };

  const estantes = numero('estantes');
  if (estantes !== undefined) corpo.num_estantes = estantes;
  const capacidade = numero('capacidade');
  if (capacidade !== undefined) corpo.capacidade_blocos = capacidade;
  const dias = numero('dias');
  if (dias !== undefined) corpo.dias_medios = dias;
  const galpao = palavra('galpao');
  if (galpao !== undefined) corpo.galpao_codigo = galpao;
  const apelido = palavra('apelido');
  if (apelido !== undefined) corpo.apelido = apelido;
  return corpo;
}

export function corpoMensal(editBio: Record<string, string>, salaId: number, ano: number, mes: number): {
  salaId: number; ano: number; mes: number; blocos_abertos?: number | null; bandejas_produzidas?: number | null;
} {
  const body: ReturnType<typeof corpoMensal> = { salaId, ano, mes };
  const blocos = editBio[`${salaId}:${mes}:blocos`];
  if (blocos !== undefined) body.blocos_abertos = blocos === '' ? null : Number(blocos);
  const bandejas = editBio[`${salaId}:${mes}:bandejas`];
  if (bandejas !== undefined) body.bandejas_produzidas = bandejas === '' ? null : Number(bandejas);
  return body;
}

export function enviarSala(editSala: Record<string, string>, salaId: number) {
  return putEstruturaisSala(corpoSala(editSala, salaId));
}

export function FaixaFiltros({ anoTexto, onAnoChange, erro, gestor, salvando, temEdicoesBio, onSalvarBiologica, onDescartarBiologica }: {
  anoTexto: string;
  onAnoChange: (texto: string) => void;
  erro: string;
  gestor: boolean;
  salvando: boolean;
  temEdicoesBio: boolean;
  onSalvarBiologica: () => void;
  onDescartarBiologica?: () => void;
}) {
  return (
    <>
      <div className="filtros">
        <div className="fg">
          <label>Ano</label>
          <input type="number" min={2000} value={anoTexto} disabled={temEdicoesBio}
            title={temEdicoesBio ? 'Salve ou descarte as edições antes de trocar o ano.' : undefined}
            onChange={(e) => onAnoChange(e.target.value)} style={{ width: 110 }} />
        </div>
        {gestor && (
          <div className="fg">
            <label>&nbsp;</label>
            <button className="btn" disabled={salvando || !temEdicoesBio} onClick={onSalvarBiologica}>
              {salvando ? 'Salvando…' : 'Salvar capacidade biológica'}
            </button>
          </div>
        )}
        {gestor && temEdicoesBio && onDescartarBiologica && (
          <div className="fg">
            <label>&nbsp;</label>
            <button className="btn ghost" disabled={salvando} onClick={onDescartarBiologica}>Descartar edições</button>
          </div>
        )}
      </div>
      {erro !== '' && <div className="alert-banner">Erro: {erro}</div>}
    </>
  );
}

export function IndicadoresEstruturais() {
  const { usuario } = useAuth();
  const gestor = usuario?.role == null || usuario.role === 'GESTAO_GERAL';
  const toast = useToast();

  const [anoTexto, setAnoTexto] = useState('2026');
  const [ano, setAno] = useState(2026);
  const [dados, setDados] = useState<EstruturaisResposta | null>(null);
  const [erro, setErro] = useState('');
  const [editBio, setEditBio] = useState<Record<string, string>>({});
  const [editSala, setEditSala] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const guarda = useRef(criarGuardaDeCorrida());
  const recarregarDoAno = useCallback(() => {
    const id = guarda.current.iniciar();
    setErro('');
    getEstruturais(ano)
      .then((d) => { if (guarda.current.vale(id)) setDados(d); })
      .catch((e) => { if (guarda.current.vale(id)) setErro(e?.response?.data?.erro ?? e.message); });
  }, [ano]);
  useEffect(recarregarDoAno, [recarregarDoAno]);
  const recarregar = useRecarregarAtual(recarregarDoAno);

  const onAnoChange = (texto: string) => {
    setAnoTexto(texto);
    const v = anoValido(texto);
    if (v != null) setAno(v);
  };

  const valorBio = (salaId: number, mes: number, campo: 'blocos' | 'bandejas', original: number | null) =>
    editBio[`${salaId}:${mes}:${campo}`] ?? (original != null ? String(original) : '');

  const salvarBiologica = async () => {
    if (!dados) return;
    const pares = new Set(
      Object.keys(editBio).map((k) => k.split(':').slice(0, 2).join(':')),
    );
    if (pares.size === 0) return;
    setSalvando(true);
    try {
      for (const par of pares) {
        const [salaId, mes] = par.split(':').map(Number);
        await putEstruturaisMensal(corpoMensal(editBio, salaId, ano, mes));
      }
      toast('Capacidade biológica salva.');
      setEditBio((prev) => proximoEditBio('bio', prev));
      recarregar();
    } catch (e) {
      const err = e as { response?: { data?: { erro?: string } }; message: string };
      toast(err.response?.data?.erro ?? err.message, true);
    } finally {
      setSalvando(false);
    }
  };

  const salvarSala = (salaId: number) => {
    if (!dados) return;
    const sala = dados.fisica.find((s) => s.id === salaId);
    if (!sala) return;
    setSalvando(true);
    enviarSala(editSala, salaId)
      .then(() => {
        toast(`Sala "${sala.nome}" atualizada.`);
        setEditSala((prev) => proximoEditSala('sala', prev));
        recarregar();
      })
      .catch((e) => toast(e?.response?.data?.erro ?? e.message, true))
      .finally(() => setSalvando(false));
  };

  const inputSala = (salaId: number, campo: string, original: number | null) => (
    <input className="cell-input" type="number" min={0}
      value={editSala[`${salaId}:${campo}`] ?? (original != null ? String(original) : '')}
      onChange={(e) => setEditSala({ ...editSala, [`${salaId}:${campo}`]: e.target.value })} />
  );

  const inputTexto = (salaId: number, campo: string, original: string | null) => (
    <input className="cell-input" type="text" maxLength={60}
      value={editSala[`${salaId}:${campo}`] ?? (original ?? '')}
      onChange={(e) => setEditSala({ ...editSala, [`${salaId}:${campo}`]: e.target.value })} />
  );

  return (
    <div className="plan-stack">
      <FaixaFiltros anoTexto={anoTexto} onAnoChange={onAnoChange} erro={erro} gestor={gestor}
        salvando={salvando} temEdicoesBio={Object.keys(editBio).length > 0}
        onSalvarBiologica={salvarBiologica} onDescartarBiologica={() => setEditBio({})} />

      {!dados && !erro && <div className="loading">Carregando capacidade produtiva…</div>}

      {dados && (
        <>
          <Panel title="Capacidade Biológica" tag={String(ano)}
            sub="Qtas bandejas cada bloco consegue entregar? CB = Bandejas Produzidas ÷ Blocos Abertos">
            <div className="plan-wrap">
              <table className="plan">
                <thead>
                  <tr>
                    <th className="rotulo">Sala</th>
                    <th>&nbsp;</th>
                    {MESES.map((m) => <th key={m} className="num">{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dados.biologica.map((b) => (
                    <LinhasBiologica key={b.sala_id} b={b} gestor={gestor}
                      valorBio={valorBio}
                      onEdit={(mes, campo, valor) =>
                        setEditBio((prev) => ({ ...prev, [`${b.sala_id}:${mes}:${campo}`]: valor }))} />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Capacidade Física"
            sub="Qtos blocos cabem simultaneamente nas salas?">
            <div className="plan-wrap cp">
              <table className="plan cp">
                <thead>
                  <tr>
                    <th className="rotulo">Sala</th>
                    <th className="rotulo">Galpão</th>
                    <th className="rotulo">Apelido</th>
                    <th className="num">Estantes</th>
                    <th className="num">capac de Blocos</th>
                    {gestor && <th className="num" />}
                  </tr>
                </thead>
                <tbody>
                  {dados.fisica.map((s) => (
                    <tr key={s.id}>
                      <td className="rotulo">{s.nome}</td>
                      <td className="rotulo">{gestor ? inputTexto(s.id, 'galpao', s.galpao_codigo) : (s.galpao_codigo ?? '—')}</td>
                      <td className="rotulo">{gestor ? inputTexto(s.id, 'apelido', s.apelido) : (s.apelido ?? '—')}</td>
                      <td className="num">{gestor ? inputSala(s.id, 'estantes', s.num_estantes) : num(s.num_estantes)}</td>
                      <td className="num">{gestor ? inputSala(s.id, 'capacidade', s.capacidade_blocos) : num(s.capacidade_blocos)}</td>
                      {gestor && (
                        <td className="num">
                          <button className="btn ghost split-btn" disabled={salvando}
                            onClick={() => salvarSala(s.id)}>Salvar</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Capacidade mensal de abertura"
            sub="Quantos blocos consigo girar por mês? Capac Mensal = Capac Blocos ÷ Dias Médios × 30">
            <div className="plan-wrap cp">
              <table className="plan cp">
                <thead>
                  <tr>
                    <th className="rotulo">Sala</th>
                    <th className="num">Capac Blocos</th>
                    <th className="num">Dias Médios</th>
                    <th className="num">Capac Mensal bl</th>
                    {gestor && <th className="num" />}
                  </tr>
                </thead>
                <tbody>
                  {dados.abertura.map((a) => (
                    <tr key={a.sala_id}>
                      <td className="rotulo">{a.nome}</td>
                      <td className="num">{num(a.capac_blocos)}</td>
                      <td className="num">{gestor ? inputSala(a.sala_id, 'dias', a.dias_medios) : num(a.dias_medios)}</td>
                      <td className="num total">{a.capac_mensal != null ? num(a.capac_mensal, 1) : '—'}</td>
                      {gestor && (
                        <td className="num">
                          <button className="btn ghost split-btn" disabled={salvando}
                            onClick={() => salvarSala(a.sala_id)}>Salvar</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Capacidade total de produção de bandejas"
            sub="CPB mês = Capacidade Física mensal × Capacidade Biológica">
            <div className="plan-wrap cp">
              <table className="plan cp">
                <thead>
                  <tr>
                    <th className="rotulo">Sala</th>
                    <th className="num">CF mensal</th>
                    <th className="num">CB</th>
                    <th className="num">CPB mês</th>
                    <th className="num">Conta do CPB mês</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.bandejas.map((b) => <LinhaBandejas key={b.sala_id} b={b} insumos={insumosDoCpb(dados, b)} />)}
                </tbody>
              </table>
            </div>
            <div className="obs-tela">
              Blocos com células vazias seguem a planilha (parcialmente preenchida): os valores
              calculados aparecem conforme os inputs forem informados.
              CB e CPB mês mostram o MÊS MAIS RECENTE com dado (indicado entre parênteses), não
              janeiro. Sem nenhum mês preenchido, a célula fica em branco.
              CF mensal e CB aparecem arredondados. A conta ao lado usa os números lançados (Capac
              Blocos, Dias Médios, Bandejas e Blocos do mês), e o CPB mês é essa conta arredondada
              para a bandeja inteira.
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

export function LinhaBandejas({ b, insumos = null }: { b: EstruturaisResposta['bandejas'][number]; insumos?: InsumosDoCpb | null }) {
  const mesLabel = b.cb_mes != null ? MESES[b.cb_mes - 1] : null;
  return (
    <tr>
      <td className="rotulo">{b.nome}</td>
      <td className="num">{b.cf_mensal != null ? num(b.cf_mensal, 1) : '—'}</td>
      <td className="num">{mesLabel ? `${fmCb(b.cb)} (${mesLabel})` : fmCb(b.cb)}</td>
      <td className="num total">{b.cpb_mes != null && mesLabel ? `${num(b.cpb_mes)} (${mesLabel})` : num(b.cpb_mes)}</td>
      <td className="num">{b.cpb_mes != null && insumos ? contaDoCpb(insumos, b.cpb_mes) : '—'}</td>
    </tr>
  );
}

export type InsumosDoCpb = { capac_blocos: number; dias_medios: number; bandejas: number; blocos: number };
export function insumosDoCpb(dados: EstruturaisResposta, b: EstruturaisResposta['bandejas'][number]): InsumosDoCpb | null {
  if (b.cb_mes == null || b.cpb_mes == null) return null;
  const ab = dados.abertura.find((a) => a.sala_id === b.sala_id);
  const bio = dados.biologica.find((x) => x.sala_id === b.sala_id);
  const capac = ab?.capac_blocos ?? null;
  const dias = ab?.dias_medios ?? null;
  const bandejas = bio?.bandejas_produzidas[b.cb_mes - 1] ?? null;
  const blocos = bio?.blocos_abertos[b.cb_mes - 1] ?? null;
  if (capac == null || dias == null || bandejas == null || blocos == null) return null;
  return { capac_blocos: capac, dias_medios: dias, bandejas, blocos };
}

export function contaDoCpb(i: InsumosDoCpb, cpb: number): string {
  const r1 = cpb.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `(${num(i.capac_blocos)} ÷ ${num(i.dias_medios)} × 30) × (${num(i.bandejas)} ÷ ${num(i.blocos)}) = ${r1}`;
}

function LinhasBiologica({ b, gestor, valorBio, onEdit }: {
  b: EstruturaisResposta['biologica'][number];
  gestor: boolean;
  valorBio: (salaId: number, mes: number, campo: 'blocos' | 'bandejas', original: number | null) => string;
  onEdit: (mes: number, campo: 'blocos' | 'bandejas', valor: string) => void;
}) {
  const celInput = (mes: number, campo: 'blocos' | 'bandejas', original: number | null) =>
    gestor ? (
      <input className="cell-input" type="number" min={0}
        value={valorBio(b.sala_id, mes, campo, original)}
        onChange={(e) => onEdit(mes, campo, e.target.value)} />
    ) : (original != null ? num(original) : '');

  return (
    <>
      <tr>
        <td className="rotulo" rowSpan={3} style={{ verticalAlign: 'top', fontWeight: 700 }}>{b.nome}</td>
        <td>Blocos Abertos</td>
        {MESES.map((_, i) => (
          <td key={i} className="num">{celInput(i + 1, 'blocos', b.blocos_abertos[i])}</td>
        ))}
      </tr>
      <tr>
        <td>Bandejas Produzidas</td>
        {MESES.map((_, i) => (
          <td key={i} className="num">{celInput(i + 1, 'bandejas', b.bandejas_produzidas[i])}</td>
        ))}
      </tr>
      <tr className="ln-grupo">
        <td>CB</td>
        {MESES.map((_, i) => (
          <td key={i} className="num">{fmCb(b.cb[i])}</td>
        ))}
      </tr>
    </>
  );
}
