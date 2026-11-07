# Análise do bot — erros, falhas e o que mudou

> Análise feita lendo o código inteiro e testando a lógica nova/alterada com mocks do Discord (ranking, agendador de punições, leitura de dados). Não rodei o bot de verdade (sem token/rede aqui): teste num servidor de teste antes de ir para produção.

## ✅ Corrigido nesta versão

| # | Gravidade | Problema | Correção |
|---|---|---|---|
| 1 | Alta | Se o desbanimento automático falhava (permissão, erro do Discord), a punição era **apagada mesmo assim**: a pessoa ficava banida para sempre e o log dizia "expirou". | `punish.js`: só apaga se conseguiu. Tenta de novo a cada minuto (5 vezes) e, se não der, avisa no canal de logs para remover na mão. |
| 2 | Alta | Punições **empilhavam**: `mute 10min` e depois `mute 7d` → aos 10min o bot soltava a pessoa no meio do mute de 7d. Idem `tempban` seguido de `ban` permanente → era desbanida quando o tempban vencia. | `actions.js`: um ban/mute novo substitui o anterior da mesma pessoa. |
| 3 | Média | Mute de menos de 28 dias liberado manualmente pelo Discord era **reaplicado em até 1 min** pelo agendador. | `punish.js`: só mutes maiores que 28 dias são renovados. |
| 4 | Média | `/ban tempo:0` (ou `off`) criava um "tempban de 0s": a pessoa era desbanida em 1 min. | Tempo mínimo de 1 segundo em `/ban` e em `actions.ban`. |
| 5 | Média | Censura e bloqueio de links eram burlados **editando** a mensagem depois de enviar. | `index.js`: mensagens editadas passam pelo automod. |
| 6 | Média | Arquivo em `data/*.json` corrompido era lido como vazio e **sobrescrito** no próximo salvamento (perda de avisos/punições). | `store.js`: guarda uma cópia `*.corrompido-<hora>` e avisa no console. |
| 7 | Média | Sem `client.on('error')`/`shardError`: erro de conexão derrubava o processo. Nada era salvo ao desligar. | `index.js`: handlers de erro e salvamento ao receber SIGINT/SIGTERM. |
| 8 | Baixa | O agendador podia rodar duas verificações ao mesmo tempo e agia em servidor indisponível (queda do Discord). | Trava contra sobreposição; servidor indisponível é pulado. |
| 9 | Baixa | `/lock` e `/unlock` checavam *Gerenciar Canais*, mas editar permissões de canal exige *Gerenciar Cargos* (Gerenciar Permissões) → erro genérico. | Checagem e mensagem corrigidas. |

## ⚠️ Recomendo, mas **não alterei** (decisão sua)

**Alta**
- **Todo cargo liberado em `/config cargo` recebe TODOS os comandos** (ban, kick, `/clear 1000`, `/say`, `/fastpuni`…), mesmo que o cargo não tenha essas permissões no Discord. Sugestão: exigir a permissão nativa de cada ação (ex.: *Banir Membros* para `/ban`) ou criar níveis (mod / admin).
- **Dados em arquivo (`data/`)**: em hospedagem com disco temporário (Render grátis, Heroku…), avisos, punições e o ranking somem a cada reinício/deploy. Use disco persistente ou um banco.

**Média**
- `/unlock` volta a permissão de @everyone para "neutro": um canal que já era somente leitura (regras, avisos) fica **aberto** depois de `/lock` + `/unlock`. Dá para guardar o estado anterior e restaurar.
- `/unmute` não checa hierarquia: cargo baixo pode soltar mute dado por cargo maior (ou a si mesmo).
- `/clear`, `/lock`, `/unlock`, `/slowmode`, `/say`, `/anuncio` e os comandos de emoji **não vão para o canal de logs**.
- Não dá para punir **bots** (bloqueado em `assertCanTarget`): um bot de spam/raid precisa ser banido na mão.

**Baixa**
- Regex de links dá falso positivo em textos tipo `legal.me` / `ok.com` (sem espaço depois do ponto) e é burlável (`dis cord . gg`). Sem lista de exceções (canais/domínios) e sem escalonamento (só apaga, não dá aviso/mute).
- Censura não pega `p.u.t.a`, `puuuta` nem leet (`p0rra`).
- `/lock`/`/unlock` em thread ou canal de voz falham (threads não têm `permissionOverwrites`).
- Checagens de permissão do bot são do servidor, não do canal (override de canal pode barrar).
- `deploy.js`: com `GUILD_ID` preenchido nunca registra global e não limpa o outro escopo → comandos duplicados no servidor de testes.
- `/ban`: a DM "você foi banido" vai antes do ban; se o ban falhar, a pessoa já recebeu. A mensagem de erro 50035/10013 ("já pode estar banido") é genérica.
- Highlight aberto a todos: alguém pode cadastrar palavras comuns (3+ letras) e fazer o bot responder com frequência no chat (limitado a 1 resposta/min por pessoa e canal). Se virar problema, deixe o comando só para a equipe.
- Sem tempo máximo (`999999a` é aceito). `/criaremoji` baixa qualquer URL http(s) (risco baixo, só equipe).
- Cosmético: `/serverinfo` mostra a verificação como número e `/criarfigurinha` o formato como número. `assertNotProtected` está duplicado em `guard.js` e `actions.js`.

## 🆕 Ranking de call (`/rankcall`)

Veja a seção "Ranking de call" no README. Resumo: top 5 com colocação e tempo, 🟢 em quem está em call agora, lista de até 5 pessoas em call com colocação/tempo/canal, e a sua posição no rodapé. Detalhes de contagem: troca de canal não zera, o canal AFK conta (com 💤) e bots não, quem sai do servidor sai do ranking, quem fica sozinho na call **conta** (sem antifarm).

## 🆕 Highlight (`/highlight`)

Cada pessoa cadastra até 10 palavras; quando alguém fala uma delas, o bot responde à mensagem marcando quem cadastrou e destaca a palavra. Só marca quem enxerga o canal, nunca marca o próprio autor, tem anti-spam (1 min por pessoa/canal, 5 marcações por mensagem) e é aberto a todos. Detalhes no README.

## 🔧 Outros ajustes pedidos

- **`/setcargo` em si mesmo:** liberado. Para o autor ele pula só a regra "o alvo precisa estar abaixo de você". As regras do **cargo** continuam: precisa estar abaixo do seu cargo mais alto (quem tem permissão de Administrador é isento, como já era) e abaixo do meu. Ou seja, ninguém consegue se dar um cargo maior que o próprio.
- **Porta HTTP para o Render:** `src/server.js` escuta em `PORT` (padrão 3000) com `/` e `/health`. No plano grátis o Render hiberna o serviço sem tráfego HTTP: use um monitor (ex.: UptimeRobot) chamando `/health` a cada 5 min.
- **Canal AFK conta** no ranking de call (aparece com 💤). Para ignorá-lo, `COUNT_AFK = false` em `src/voice.js`.
- **`/cargotemp usuario cargo tempo [motivo]`:** dá o cargo por 1 min a 365 dias e o agendador remove no fim (a verificação é a mesma das punições temporárias, então sobrevive a reinícios). Mesma hierarquia do `/setcargo`, funciona em si mesmo, renova se repetido e **recusa** se a pessoa já tem o cargo sem prazo. Mexer no cargo com `/setcargo` cancela o prazo, para um cargo dado depois nunca ser removido por um prazo antigo.
