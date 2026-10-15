import React, { useState } from "react";
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
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(
          new FormData(e.currentTarget),
        ) as Record<string, string>;
        setBusy(true);
        setError("");
        setOk(false);
        try {
          await submit(data);
          setOk(true);
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
            type={type || "text"}
            required
            maxLength={500}
            defaultValue={defaults[name]}
            autoComplete={type === "password" ? "current-password" : undefined}
          />
        </label>
      ))}
      {children}
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
  const [record, setRecord] = useState<{
    perfil: Paciente;
    medicoes: Medicao[];
  } | null>(null);
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
        <strong>♡ Carda Ajuda</strong>
        <small>Saúde perto de você</small>
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
                <nav>
                  {[
                    "inicio",
                    "consultas",
                    isDoctor ? "pacientes" : "saude",
                    ...(isDoctor
                      ? ["triagens", "alertas"]
                      : ["medicos", "planos"]),
                    "perfil",
                  ].map((t) => (
                    <button
                      key={t}
                      className={tab === t ? "" : "secondary"}
                      onClick={() => {
                        setTab(t);
                        setRecord(null);
                      }}
                    >
                      {
                        (
                          {
                            inicio: "Início",
                            consultas: "Consultas",
                            pacientes: "Pacientes",
                            saude: "Saúde",
                            triagens: "Triagens",
                            alertas: "Alertas",
                            medicos: "Médicos",
                            planos: "Planos",
                            perfil: "Perfil",
                          } as Record<string, string>
                        )[t]
                      }
                    </button>
                  ))}
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
                        <h2>Seu acompanhamento</h2>
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
                        <h2>Consultas e histórico</h2>
                        {data.consultas.length === 0 && (
                          <p>Nenhuma consulta.</p>
                        )}
                        {data.consultas.map((c) => (
                          <article key={c.id}>
                            <b>
                              {c.data} · {c.horario}
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
                              <select name="medico_id" required>
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
                        <h2>Registrar medição</h2>
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
                        <Measurements rows={data.medicoes || []} />
                      </section>
                    )}
                    {tab === "pacientes" && (
                      <section>
                        <h2>Meus pacientes</h2>
                        {!data.pacientes?.length && (
                          <p>
                            Nenhum vínculo. O paciente pode agendar uma consulta
                            com você.
                          </p>
                        )}
                        {data.pacientes?.map((p) => (
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
                            {t.nomePaciente} · {t.data} · {t.classificacao}
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
                        <h2>Médicos</h2>
                        {data.medicos?.map((m) => (
                          <article key={m.id}>
                            <b>{m.nome}</b>
                            <p>
                              {m.especialidade} · CRM {m.crm}
                            </p>
                          </article>
                        ))}
                      </section>
                    )}
                    {tab === "planos" && (
                      <section>
                        <h2>Planos</h2>
                        {data.planos?.map((p) => (
                          <article key={p.id}>
                            <b>
                              {p.nome} · R$ {p.preco.toFixed(2)}
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
                        <h2>Meu perfil</h2>
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
function Measurements({ rows }: { rows: Medicao[] }) {
  return (
    <>
      <h2>Últimas medições</h2>
      {rows.length === 0 && <p>Nenhuma medição registrada.</p>}
      {rows.map((m) => (
        <article key={m.id}>
          <b>
            {m.sistolica}/{m.diastolica} mmHg · {m.glicemia} mg/dL
          </b>
          <p>
            {new Date(m.createdAt).toLocaleString("pt-BR")} · {m.status}
          </p>
        </article>
      ))}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
