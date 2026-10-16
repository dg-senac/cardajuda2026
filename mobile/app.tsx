import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import type {
  Profile,
  Consulta,
  Medicao,
  Paciente,
  Medico,
  Plano,
  Lembrete,
  CardapioItem,
  Triagem,
  Alerta,
  Pendencia,
} from "../src/types";
import Logo from "../src/components/Logo";
import Icon, { type IconName } from "../src/components/Icon";
import { App as NativeApp } from "@capacitor/app";
const dateBR = (v: string) => v.split("-").reverse().join("/");
const labels: Record<string, string> = { inicio: "Início", consultas: "Consultas", saude: "Saúde", medicos: "Médicos", alertas: "Alertas", pacientes: "Pacientes" };
const icons: Record<string, IconName> = { inicio: "home", consultas: "calendar", saude: "heart", medicos: "stethoscope", alertas: "bell", pacientes: "users" };
declare const __SUPABASE_URL__: string;
// Session stays in memory only: reopening requires login, no medical data/token in backups.
let token = "";
type Dashboard = {
  perfil: Paciente | Medico;
  consultas: Consulta[];
  medicoes?: Medicao[];
  medicos?: Pick<Medico, "id" | "nome" | "especialidade" | "crm">[];
  pacientes?: Paciente[];
  planos?: Plano[];
  lembretes?: Lembrete[];
  cardapio?: CardapioItem[];
  triagens?: Triagem[];
  alertas?: Alerta[];
  pendencias?: Pendencia[];
};
async function api<T>(op: string, extra: object = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${__SUPABASE_URL__}/functions/v1/mobile-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ op, ...extra }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error(
      "Sem conexão com o serviço. Verifique sua internet e tente novamente.",
    );
  }
  const body = await response
    .json()
    .catch(() => ({ error: "Serviço indisponível. Tente novamente." }));
  if (response.status === 401) { token = ""; window.dispatchEvent(new Event("session-expired")); }
  if (!response.ok || body.error)
    throw new Error(body.error || "Serviço indisponível.");
  if (body.result?.success === false) throw new Error(body.result.error);
  if (body.token) token = body.token;
  return body.result;
}
type Field = [string, string, string?];
const common: Field[] = [
  ["nome", "Nome"],
  ["telefone", "Telefone", "tel"],
  ["email", "Email", "email"],
  ["senha", "Senha", "password"],
  ["genero", "Gênero"],
];
const patient: Field[] = [
  ["cpf", "CPF"],
  ["data_nascimento", "Nascimento", "date"],
  ["tipo_sanguineo", "Tipo sanguíneo"],
  ["altura", "Altura em metros (ex.: 1.70)"],
];
const doctor: Field[] = [
  ["crm", "CRM"],
  ["especialidade", "Especialidade"],
  ["formacao", "Formação"],
];
function Form({
  fields,
  submit,
  label,
  children,
  defaults = {},
}: {
  fields: Field[];
  submit: (fields: Record<string, string>) => Promise<void>;
  label: string;
  children?: React.ReactNode;
  defaults?: Record<string, string>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(
          new FormData(e.currentTarget),
        ) as Record<string, string>;
        if (busy) return;
        data.request_id = requestId;
        setBusy(true);
        setError("");
        setOk(false);
        try {
          await submit(data);
          setOk(true);
          setRequestId(crypto.randomUUID());
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields.map(([name, title, type]) => (
        <label key={name}>
          {title}
          <input
            name={name}
            type={type === "password" && showPassword ? "text" : type || "text"}
            required
            maxLength={500}
            defaultValue={defaults[name]}
            inputMode={type === "number" ? "numeric" : name === "altura" ? "decimal" : undefined}
            autoComplete={type === "password" ? (name === "senha" ? "new-password" : "current-password") : name === "email" ? "email" : undefined}
          />
        </label>
      ))}
      {fields.some(f => f[2] === "password") && <button type="button" className="secondary" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Ocultar senha" : "Mostrar senha"}</button>}
      {children}
      {fields.some(f => f[0] === "sistolica") && <button type="reset" className="secondary">Limpar campos</button>}
      <button disabled={busy}>{busy ? "Aguarde…" : label}</button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {ok && <p role="status">Concluído.</p>}
    </form>
  );
}
function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [approved, setApproved] = useState(false);
  const [mode, setMode] = useState("login");
  const [tab, setTab] = useState("inicio");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [record, setRecord] = useState<{
    perfil: Paciente;
    medicoes: Medicao[];
    consultas: Consulta[];
    triagens: Triagem[];
  } | null>(null);
  useEffect(() => {
    const expired = () => { setProfile(null); setData(null); setRecord(null); setError("Sua sessão expirou. Entre novamente."); };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  useEffect(() => {
    const listener = NativeApp.addListener("backButton", () => { if (tab !== "inicio") { setTab("inicio"); setRecord(null); } else if (mode !== "login") setMode("login"); else void NativeApp.minimizeApp(); });
    return () => { void listener.then(l => l.remove()); };
  }, [tab, mode]);
  const load = async () => setData(await api<Dashboard>("home"));
  const enter = async (fields: Record<string, string>) => {
    await api(mode, { fields });
    const me = await api<{ profile: Profile; approved: boolean }>("me");
    setProfile(me.profile);
    setApproved(me.approved);
    if (me.profile.role === "paciente" || me.approved) {
      try {
        await load();
      } catch (e) {
        setError((e as Error).message);
      }
    }
  };
  const act = async (op: string, extra: object) => {
    await api(op, extra);
    await load();
  };
  const safely = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const isDoctor = profile?.role === "medico";
  const schedule: Field[] = [
    ["data", "Data", "date"],
    ["horario", "Horário", "time"],
    ["motivo", "Motivo"],
  ];
  const selectPatient = (
    <label>
      Paciente
      <select name="paciente_id" required>
        <option value="">Selecione</option>
        {data?.pacientes?.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <header>
        <button className="icon-button" aria-label="Voltar ao início" onClick={() => { setTab("inicio"); setMode("login"); }}><Icon name="arrow-left" /></button>
        <Logo size={25} />
        {profile ? <button className="avatar" aria-label="Abrir meu perfil" onClick={() => setTab("perfil")}>{profile.nome.slice(0,1)}</button> : <span className="header-spacer" />}
      </header>
      <main>
        {!profile ? (
          <section>
            <h1>
              {mode === "login"
                ? "Bem-vindo"
                : mode === "signupPaciente"
                  ? "Cadastro de paciente"
                  : "Cadastro de médico"}
            </h1>
            <p>Use sua conta Carda Ajuda. É necessário acesso à internet.</p>
            <Form
              key={mode}
              fields={
                mode === "login"
                  ? [
                      ["email", "Email", "email"],
                      ["password", "Senha", "password"],
                    ]
                  : [
                      ...common,
                      ...(mode === "signupPaciente" ? patient : doctor),
                    ]
              }
              submit={enter}
              label={mode === "login" ? "Entrar" : "Criar conta"}
            />
            <nav>
              {[
                ["login", "Entrar"],
                ["signupPaciente", "Sou paciente"],
                ["signupMedico", "Sou médico"],
              ].map(([key, title]) => (
                <button
                  key={key}
                  className="secondary"
                  onClick={() => setMode(key)}
                >
                  {title}
                </button>
              ))}
            </nav>
          </section>
        ) : (
          <>
            <div className="heading">
              <h1>Olá, {profile.nome}</h1>
              <button
                className="secondary"
                onClick={() =>
                  safely(async () => {
                    try {
                      await api("logout");
                    } finally {
                      token = "";
                      setProfile(null);
                      setData(null);
                      setRecord(null);
                      setMode("login");
                      setTab("inicio");
                    }
                  })
                }
              >
                Sair
              </button>
            </div>
            {isDoctor && !approved ? (
              <section>
                <h2>Cadastro recebido</h2>
                <p>
                  Seu acesso médico aguarda aprovação administrativa. Seus dados
                  foram preservados. Após a aprovação, saia e entre novamente.
                </p>
              </section>
            ) : (
              <>
                <nav className="bottom-nav" aria-label="Navegação principal">
                  {["inicio", "consultas", isDoctor ? "alertas" : "saude", isDoctor ? "pacientes" : "medicos"].map(t => <button key={t} aria-current={tab === t ? "page" : undefined} className={tab === t ? "active" : ""} onClick={() => { setTab(t); setRecord(null); setSearch(""); }}><Icon name={icons[t]} /><span>{labels[t]}</span></button>)}
                </nav>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => safely(load)}
                >
                  {busy ? "Atualizando…" : "Atualizar dados"}
                </button>
                {data && (
                  <>
                    {tab === "inicio" && (
                      <section>
                        <span className="eyebrow">CUIDADO QUE CONECTA</span><h2>Seu acompanhamento</h2>
                        <p>Um passo de cada vez para cuidar da sua saúde.</p>
                        <div className="quick-grid">
                          <button onClick={() => setTab("consultas")}><Icon name="calendar" /> Consultas</button>
                          <button className="secondary" onClick={() => setTab(isDoctor ? "triagens" : "saude")}><Icon name={isDoctor ? "clipboard" : "heart"} />{isDoctor ? "Nova triagem" : "Registrar medição"}</button>
                        </div>
                        {isDoctor ? <p>{data.pacientes?.length ?? 0} pacientes vinculados · {data.alertas?.length ?? 0} alertas · {data.pendencias?.filter(p => !p.concluida).length ?? 0} pendências abertas</p> : <>
                          <details className="feature"><summary><Icon name="bell" /> Lembretes · {data.lembretes?.length ?? 0} ativos</summary><p>Os lembretes abaixo são registros de acompanhamento; não disparam alarmes no Android.</p></details>
                          <details className="feature"><summary><Icon name="lightbulb" /> Dica do dia</summary><p>Registre suas medições conforme orientação do profissional responsável. Alimentação, líquidos e atividade física devem respeitar suas condições individuais. Estas dicas são educativas, não prescrições.</p></details>
                          <h3>Próxima consulta</h3>{(() => { const next = data.consultas.filter(c => c.status === "agendada" && c.data >= new Date().toLocaleDateString("en-CA")).sort((a,b) => (a.data+a.horario).localeCompare(b.data+b.horario))[0]; return <p>{next ? `${dateBR(next.data)} às ${next.horario} · ${next.profissional}` : "Nenhuma consulta futura agendada."}</p>; })()}
                          <button className="secondary" onClick={() => setTab("planos")}><Icon name="wallet" /> Plano: {("plano" in data.perfil && data.perfil.plano) || "Não informado"} · Ver planos</button>
                          <h3>Cardápio do dia</h3><p>Cardápio semanal geral, não uma dieta prescrita individualmente.</p>
                        </>}
                        <p>
                          {
                            data.consultas.filter(
                              (c) => c.status === "agendada",
                            ).length
                          }{" "}
                          consultas agendadas
                        </p>
                        {data.lembretes?.map((l) => (
                          <article key={l.id}>
                            {l.horario} · {l.texto}
                          </article>
                        ))}
                        {data.cardapio?.map((c) => (
                          <article key={c.id}>
                            <b>{c.refeicao}</b>
                            <p>{c.descricao}</p>
                          </article>
                        ))}
                        {isDoctor && (
                          <p>
                            Somente pacientes com consultas vinculadas a você
                            aparecem no aplicativo.
                          </p>
                        )}
                      </section>
                    )}
                    {tab === "consultas" && (
                      <section>
                        <h2>Consultas</h2><div className="segmented"><button className={!history ? "" : "secondary"} onClick={() => setHistory(false)}>Agendadas</button><button className={history ? "" : "secondary"} onClick={() => setHistory(true)}>Histórico</button></div><p>Os horários não representam disponibilidade confirmada. Consulte o profissional.</p>
                        {data.consultas.length === 0 && (
                          <p>Nenhuma consulta.</p>
                        )}
                        {data.consultas.filter(c => history ? c.status !== "agendada" : c.status === "agendada").map((c) => (
                          <article key={c.id}>
                            <b>
                              {dateBR(c.data)} · {c.horario}
                            </b>
                            <p>
                              {isDoctor ? c.nomePaciente : c.profissional} ·{" "}
                              {c.especialidade}
                            </p>
                            <p>
                              {c.motivo} — {c.status}
                            </p>
                            {isDoctor && c.status === "agendada" && (
                              <div>
                                {["realizada", "cancelada"].map((status) => (
                                  <button
                                    key={status}
                                    disabled={busy}
                                    onClick={() =>
                                      safely(() =>
                                        act("appointmentStatus", {
                                          id: c.id,
                                          status,
                                        }),
                                      )
                                    }
                                  >
                                    {status === "realizada"
                                      ? "Marcar realizada"
                                      : "Cancelar"}
                                  </button>
                                ))}
                              </div>
                            )}
                          </article>
                        ))}
                        <h2>Nova consulta</h2>
                        <Form
                          fields={
                            isDoctor
                              ? [
                                  ...schedule,
                                  ["especialidade", "Especialidade"],
                                ]
                              : schedule
                          }
                          label="Agendar"
                          submit={(fields) => act("appointment", { fields })}
                        >
                          {isDoctor ? (
                            selectPatient
                          ) : (
                            <label>
                              Médico
                              <select name="medico_id" value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} required>
                                <option value="">Selecione</option>
                                {data.medicos?.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.nome} · {m.especialidade}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </Form>
                      </section>
                    )}
                    {tab === "saude" && (
                      <section>
                        <h2>Registrar medição</h2><p>Classificação simplificada para acompanhamento, sem diagnóstico. Não considera jejum, sintomas ou hipotensão. Siga as orientações de seu profissional.</p>
                        <Form
                          fields={[
                            ["sistolica", "Pressão sistólica (mmHg)", "number"],
                            [
                              "diastolica",
                              "Pressão diastólica (mmHg)",
                              "number",
                            ],
                            ["glicemia", "Glicemia (mg/dL)", "number"],
                          ]}
                          label="Salvar medição"
                          submit={(fields) => act("measurement", { fields })}
                        />
                        <Measurements rows={data.medicoes || []} onMore={(data.medicoes?.length ?? 0) % 100 === 0 && !!data.medicoes?.length ? async () => { const more = await api<Medicao[]>("measurements", {fields:{offset:String(data.medicoes!.length)}}); setData({...data, medicoes:[...data.medicoes!, ...more]}); } : undefined} />
                      </section>
                    )}
                    {tab === "pacientes" && (
                      <section>
                        <h2>Meus pacientes</h2><label>Buscar paciente<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
                        {!data.pacientes?.length && (
                          <p>
                            Nenhum vínculo. O paciente pode agendar uma consulta
                            com você.
                          </p>
                        )}
                        {data.pacientes?.filter(p => (p.nome + p.cpf).toLowerCase().includes(search.toLowerCase())).map((p) => (
                          <article key={p.id}>
                            <button
                              disabled={busy}
                              onClick={() =>
                                safely(async () =>
                                  setRecord(await api("patient", { id: p.id })),
                                )
                              }
                            >
                              {p.nome}
                            </button>
                          </article>
                        ))}
                        {record && (
                          <>
                            <h3>{record.perfil.nome}</h3>
                            <p>
                              {record.perfil.idade} anos ·{" "}
                              {record.perfil.tipoSanguineo} ·{" "}
                              {record.perfil.doencasCronicas.join(", ")}
                            </p>
                            <Measurements rows={record.medicoes} />
                            <h3>Consultas deste atendimento</h3>{record.consultas.map(c => <article key={c.id}>{dateBR(c.data)} · {c.horario} · {c.status}<p>{c.motivo}</p></article>)}
                            <h3>Triagens do profissional</h3>{record.triagens.map(t => <article key={t.id}>{dateBR(t.data)} · {t.horario} · {t.classificacao}<p>{t.queixaPrincipal}</p></article>)}
                          </>
                        )}
                      </section>
                    )}
                    {tab === "triagens" && (
                      <section>
                        <h2>Nova triagem</h2>
                        <Form
                          fields={[
                            ["data", "Data", "date"],
                            ["horario", "Horário", "time"],
                            ["queixa_principal", "Queixa principal"],
                          ]}
                          label="Salvar triagem"
                          submit={(fields) => act("triage", { fields })}
                        >
                          {selectPatient}
                          <label>
                            Classificação
                            <select name="classificacao">
                              <option value="verde">Verde</option>
                              <option value="amarela">Amarela</option>
                              <option value="vermelha">Vermelha</option>
                            </select>
                          </label>
                        </Form>
                        <h2>Histórico</h2>
                        {data.triagens?.map((t) => (
                          <article key={t.id}>
                            {t.nomePaciente} · {dateBR(t.data)} · {t.classificacao}
                            <p>{t.queixaPrincipal}</p>
                          </article>
                        ))}
                      </section>
                    )}
                    {tab === "alertas" && (
                      <section>
                        <h2>Alertas</h2>
                        {data.alertas?.map((a) => (
                          <article key={a.id}>
                            <b>{a.titulo}</b>
                            <p>
                              {a.descricao} · {a.status}
                            </p>
                          </article>
                        ))}
                        <h2>Pendências</h2>
                        {data.pendencias?.map((p) => (
                          <article key={p.id}>
                            {p.titulo}
                            <button
                              disabled={busy}
                              onClick={() =>
                                safely(() =>
                                  act("pending", {
                                    id: p.id,
                                    concluida: !p.concluida,
                                  }),
                                )
                              }
                            >
                              {p.concluida ? "Reabrir" : "Concluir"}
                            </button>
                          </article>
                        ))}
                      </section>
                    )}
                    {tab === "medicos" && (
                      <section>
                        <h2>Médicos</h2><label>Buscar nome ou especialidade<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
                        {data.medicos?.filter(m => (m.nome + m.especialidade).toLowerCase().includes(search.toLowerCase())).map((m) => (
                          <article key={m.id}>
                            <b>{m.nome}</b>
                            <p>
                              {m.especialidade} · CRM {m.crm}
                            </p><button onClick={() => { setSelectedDoctor(m.id); setTab("consultas"); }}>Agendar com este médico</button>
                          </article>
                        ))}
                      </section>
                    )}
                    {tab === "planos" && (
                      <section>
                        <h2>Planos</h2><p>Adesão registrada no sistema. Não há processamento de pagamento ou cobrança integrada.</p>
                        {data.planos?.map((p) => (
                          <article key={p.id}>
                            <b>
                              {p.nome} · {p.preco.toLocaleString("pt-BR", {style:"currency", currency:"BRL"})}
                            </b>
                            <p>{p.descricao}</p>
                            <button
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Confirmar assinatura do plano ${p.nome}?`,
                                  )
                                )
                                  void safely(() =>
                                    act("subscribe", { id: p.id }),
                                  );
                              }}
                            >
                              Assinar
                            </button>
                          </article>
                        ))}
                      </section>
                    )}
                    {tab === "perfil" && (
                      <section>
                        <h2>Meu perfil</h2><dl>{Object.entries(data.perfil).filter(([k]) => ["cpf", "dataNascimento", "tipoSanguineo", "altura", "genero", "doencasCronicas", "crm", "especialidade", "formacao"].includes(k)).map(([k,v]) => <div key={k}><dt>{{cpf:"CPF",dataNascimento:"Nascimento",tipoSanguineo:"Tipo sanguíneo",altura:"Altura (m)",genero:"Gênero",doencasCronicas:"Condições crônicas",crm:"CRM",especialidade:"Especialidade",formacao:"Formação"}[k]}</dt><dd>{k === "dataNascimento" ? dateBR(String(v)) : (Array.isArray(v) ? v.join(", ") : String(v ?? "")) || "Não informado"}</dd></div>)}</dl>
                        <p>
                          {profile.email} · {profile.role}
                        </p>
                        {"plano" in data.perfil && (
                          <p>Plano: {data.perfil.plano || "Nenhum"}</p>
                        )}
                        <Form
                          key={data.perfil.nome}
                          fields={[
                            ["nome", "Nome"],
                            ["telefone", "Telefone", "tel"],
                            ...(isDoctor
                              ? ([
                                  ["especialidade", "Especialidade"],
                                  ["formacao", "Formação"],
                                ] as Field[])
                              : []),
                          ]}
                          defaults={Object.fromEntries(
                            Object.entries(data.perfil).filter(
                              ([, v]) => typeof v === "string",
                            ),
                          )}
                          label="Salvar perfil"
                          submit={(fields) => act("profile", { fields })}
                        />
                      </section>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer>
          Este aplicativo exige internet. Em uma emergência, ligue 192.
        </footer>
      </main>
    </>
  );
}
function Measurements({ rows, onMore }: { rows: Medicao[]; onMore?: () => Promise<void> }) {
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <h2>Histórico de medições</h2><Evolution rows={rows} />
      {rows.length === 0 && <p>Nenhuma medição registrada.</p>}
      {rows.slice(0, limit).map((m) => (
        <article key={m.id} className={`measurement ${m.status}`}>
          <b>
            {m.sistolica}/{m.diastolica} mmHg · {m.glicemia} mg/dL
          </b>
          <p>
            {new Date(m.createdAt).toLocaleString("pt-BR")} · {m.status === "atencao" ? "Atenção" : m.status === "alerta" ? "Alerta" : "Normal"}
          </p>
        </article>
      ))}
      {onMore && limit >= rows.length && <button disabled={loading} onClick={async () => { setLoading(true); try { await onMore(); setLimit(limit + 100); } catch(e) { setError((e as Error).message); } finally { setLoading(false); } }}>{loading ? "Carregando…" : "Buscar mais registros"}</button>}
      {error && <p role="alert">{error}</p>}
      {rows.length > limit && <button className="secondary" onClick={() => setLimit(limit + 10)}>Carregar mais</button>}
    </>
  );
}
function Evolution({ rows }: { rows: Medicao[] }) {
  if (rows.length < 2) return null;
  const recent = rows.slice(0, 14).reverse();
  return <details className="feature"><summary>Evolução · últimas {recent.length} medições</summary>{[false, true].map(glucose => {
    const max = Math.max(...recent.map(m => glucose ? m.glicemia : m.sistolica)) * 1.15;
    return <figure key={String(glucose)}><figcaption>{glucose ? "Glicemia (mg/dL), pontos laranja" : "Pressão (mmHg), sistólica roxa e diastólica vermelha"}</figcaption><svg viewBox="0 0 320 160" role="img" aria-label="Pontos das medições em ordem cronológica; valores e datas na lista abaixo."><text x="0" y="12" fill="#6B5468" fontSize="12">{Math.round(max)}</text><path d="M30 15V140H310" fill="none" stroke="#E2C2DC" />{recent.map((m,i) => <g key={m.id}><circle cx={40+i*255/Math.max(1,recent.length-1)} cy={140-(glucose ? m.glicemia : m.sistolica)*120/max} r="4" fill={glucose ? "#E09400" : "#8B008B"} />{!glucose && <circle cx={40+i*255/Math.max(1,recent.length-1)} cy={140-m.diastolica*120/max} r="4" fill="#D62839" />}</g>)}<text x="30" y="157" fill="#6B5468" fontSize="12">Mais antiga → mais recente</text></svg></figure>;
  })}<p>Valores e horários completos na lista. Pontos representam apenas registros reais.</p></details>;
}
createRoot(document.getElementById("root")!).render(<App />);
