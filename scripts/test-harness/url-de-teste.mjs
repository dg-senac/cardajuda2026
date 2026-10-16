/**
 * Nome do banco que as suítes de teste criam para si.
 *
 * Recebe a URL que a pessoa passou em TEST_DATABASE_URL e devolve a MESMA
 * origem com um banco derivado (`<nome><sufixo>`). O objetivo é de segurança:
 * os testes de actions fazem `drop database` + `create database`, e isso nunca
 * pode acontecer no banco escrito na variável de ambiente -- um `app_db` de
 * desenvolvimento com um typo já foi suficiente para estragar dados reais.
 *
 * Só os sufixos de teste que este repositório gera é que são trocados, para que
 * rodar de novo reuse o mesmo banco em vez de acumular `_test_actions_e2e`.
 */
const SUFIXO_DE_TESTE = /_(tests?|integ|racao|integration|actions?|e2e)$/i;

export function urlDoBancoDeTeste(urlBase, sufixo) {
  const u = new URL(urlBase);
  const nome = u.pathname.slice(1).replace(SUFIXO_DE_TESTE, "");
  u.pathname = `/${nome}${sufixo}`;
  return u.toString();
}

/** URL do banco `postgres` do mesmo servidor, para poder criar/apagar banco. */
export function urlDeAdministrador(urlDoBanco) {
  const u = new URL(urlDoBanco);
  u.pathname = "/postgres";
  return u.toString();
}
