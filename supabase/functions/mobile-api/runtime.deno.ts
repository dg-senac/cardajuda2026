// Deno real; nunca conecta a produção: URL local e nome explícito de banco descartável.
import { handle } from './api.js';
Deno.test({name:'Deno: autenticação bcrypt, pg, contexto e revogação reais', sanitizeResources:false, sanitizeOps:false, fn: async () => {
  const target = new URL(Deno.env.get('DATABASE_URL') || '');
  if (target.hostname !== '127.0.0.1' || target.pathname !== '/cardajuda_runtime') throw Error('Banco local descartável obrigatório');
  const call = async (op: string, fields = {}, token = '') => {
    const r = await handle(new Request('https://localhost', {method:'POST', headers:{authorization:`Bearer ${token}`},body:JSON.stringify({op,fields})}));
    return {status:r.status, ...await r.json()};
  };
  const login = await call('login', {email:'maria@email.com',password:'123456'});
  if (!login.result?.success || !login.token) throw Error('Login real falhou');
  const me = await call('me', {}, login.token);
  if (me.result.profile.role !== 'paciente') throw Error('Papel incorreto');
  const home = await call('home', {}, login.token);
  if (!home.result?.perfil?.cpf) throw Error('Consulta real falhou');
  await call('logout', {}, login.token);
  if ((await call('me', {}, login.token)).status !== 401) throw Error('Revogação falhou');
  const bad = await call('login', {email:'maria@email.com',password:'invalida'});
  if (bad.result?.success !== false) throw Error('Senha inválida aceita');
}});
