# Bot de Moderação e Utilidades

Bot de Discord enxuto: **só moderação + utilidades**, com acesso liberado por **cargo**, confirmação **Sim/Não** antes de cada punição e o comando **`/fastpuni`**, que aplica na hora sem perguntar. Funciona com **comandos de barra** e também com o **prefixo `z?`**.

- **30 comandos** (16 de moderação, 2 de automod, 12 de utilidades/configuração)
- Tempo em formato livre: `1s`, `30s`, `10min`, `1h`, `1d`, `1sem`, `1mes`, `1a` — e combinações como `1d12h`
- Banimento e silenciamento temporários são removidos sozinhos quando o tempo acaba
- Avisos ficam salvos (mesmo se o bot reiniciar)
- Censura de palavras e bloqueio automático de links
- Criação de emojis e figurinhas pelo próprio Discord
- **Ranking de call** (`/rankcall`): top 5 de quem ficou mais tempo em call e quem está em call agora
- **Highlight** (`/highlight`): o bot marca você quando alguém fala uma palavra que você escolheu
- **Cargo temporário** (`/cargotemp`): dá um cargo por um tempo e o bot remove sozinho
- Tudo é registrado no canal de logs que você escolher

---

## 1. O que você precisa

- Uma conta no Discord
- **Node.js 20 ou mais novo** — baixe em <https://nodejs.org> (instale a versão LTS)
- Um lugar para o bot ficar ligado 24h (um computador sempre ligado, uma VPS ou uma hospedagem de bot)

## 2. Criar o bot no Discord

1. Abra <https://discord.com/developers/applications> e clique em **New Application**. Dê um nome.
2. No menu **Bot**, clique em **Reset Token** e copie o token (guarde, ele aparece uma vez só).
3. Ainda em **Bot**, ligue **as duas opções** em *Privileged Gateway Intents*:
   - **SERVER MEMBERS INTENT**
   - **MESSAGE CONTENT INTENT** (necessária para o prefixo `z?`, a censura e o automod)

   Salve depois de ligar.
4. No menu **General Information**, copie o **Application ID**.

## 3. Instalar

Na pasta do bot, abra o terminal e rode:

```bash
npm install
```

Depois copie o arquivo `.env.example` e renomeie a cópia para `.env`, preenchendo:

```
DISCORD_TOKEN=seu_token_aqui
CLIENT_ID=seu_application_id_aqui
GUILD_ID=id_do_servidor_de_testes
PREFIX=z?
```

> `GUILD_ID` é opcional. Com ele preenchido, os comandos aparecem na hora no servidor.
> Sem ele, os comandos são globais e podem demorar até 1 hora para aparecer.
> `PREFIX` também é opcional — o padrão é `z?`.

## 4. Convidar o bot

Abra este link trocando `SEU_CLIENT_ID` pelo ID da aplicação:

```
https://discord.com/api/oauth2/authorize?client_id=SEU_CLIENT_ID&permissions=1100988116054&scope=bot%20applications.commands
```

## 5. Registrar os comandos

**Não precisa fazer nada:** o bot registra os comandos de barra (`/`) **sozinho toda vez que liga** (veja a linha `✅ 30 comandos de barra registrados...` no console). Isso vale também no Render e em qualquer hospedagem.

- Com `GUILD_ID` preenchido, eles aparecem **na hora**, mas só nesse servidor. Se o `GUILD_ID` estiver errado ou o bot não estiver nesse servidor, ele registra **globalmente** (pode levar até 1 hora).
- Sem `GUILD_ID`, são globais (todos os servidores, até 1 hora).
- Para desligar o registro automático, ponha `AUTO_DEPLOY=false` no `.env`.

Se preferir registrar na mão (ou depois de mexer nos comandos sem religar o bot):

```bash
npm run deploy          # segue o .env
npm run deploy:teste    # só no servidor do GUILD_ID (aparece na hora)
npm run deploy:global   # em todos os servidores e limpa os do GUILD_ID (evita comandos duplicados)
```

## 6. Ligar o bot

```bash
npm start
```

Deixe esse terminal aberto (ou configure o bot para rodar como serviço na hospedagem). Para testar sem parar o bot, use outro terminal.

## 7. Configurar no servidor

Entre no servidor com uma conta **Administradora** e rode:

1. `/config cargo adicionar cargo:@Staff` → só quem tem esse cargo (ou Administrador) usa o bot
2. `/config logs definir canal:#logs-punicoes` → onde as punições e o automod serão registrados
3. `/config ver` → confere tudo

Pronto. Para tirar o acesso de um cargo: `/config cargo remover`.

---

## Comandos

### 🛡️ Moderação

| Comando | O que faz |
|---|---|
| `/ban usuario [tempo] [motivo]` | Bane; com tempo vira banimento temporário |
| `/unban id [motivo]` | Remove o banimento pelo ID |
| `/kick usuario [motivo]` | Expulsa o membro |
| `/mute usuario tempo [motivo]` | Silencia por um tempo |
| `/unmute usuario` | Remove o silenciamento |
| `/warn usuario motivo` | Registra um aviso |
| `/warnings usuario` | Lista os avisos |
| `/clearwarns usuario` | Apaga os avisos |
| `/clear quantidade [usuario]` | Apaga mensagens do canal |
| `/lock` / `/unlock` | Tranca / destranca o canal |
| `/slowmode tempo` | Modo lento (aceita `off`) |
| `/setcargo usuario cargo` | Adiciona ou remove um cargo (dá para usar em **você mesmo**; o cargo precisa estar abaixo do seu e do meu) |
| `/cargotemp usuario cargo tempo [motivo]` | Dá um cargo por tempo limitado (1 min a 365 dias); o bot remove no fim |
| `/nick usuario [apelido]` | Troca o apelido (vazio = restaurar) |
| `/fastpuni acao ...` | Aplica **sem confirmação** |

### 🤖 Automod

| Comando | O que faz |
|---|---|
| `/censura adicionar palavra` | Adiciona uma palavra ou frase à censura |
| `/censura remover palavra` | Remove da censura |
| `/censura listar` | Mostra as palavras censuradas |
| `/automod status:Ligar` | Apaga mensagens com links |
| `/automod status:Desligar` | Libera links novamente |
| `/automod status:Ver` | Mostra o estado atual |

### ⚡ `/fastpuni`

Pula a pergunta Sim/Não. Exemplos:

```
/fastpuni acao:Silenciar usuario:@Fulano tempo:1h motivo:Flood
/fastpuni acao:Banir temporariamente id:123456789012345678 tempo:7d
/fastpuni acao:Expulsar usuario:@Fulano motivo:Desrespeito
```

Ações disponíveis: banir, banir temporariamente, silenciar, expulsar, avisar, remover banimento e limpar avisos.
Para quem não está mais no servidor, use a opção **id** em vez de **usuario**.

### 🧰 Utilidades

| Comando | O que faz |
|---|---|
| `/help` | Lista todos os comandos |
| `/ping` | Latência do bot |
| `/userinfo [usuario]` | Informações do usuário |
| `/serverinfo` | Informações do servidor |
| `/avatar [usuario] [servidor]` | Mostra o avatar |
| `/say texto [canal]` | Faz o bot falar |
| `/anuncio titulo texto [canal] [cor]` | Envia um anúncio em embed |
| `/rankcall` | Ranking de tempo em call (**todos** podem usar) |
| `/highlight adicionar/remover/listar/limpar` | Palavras que fazem o bot te marcar (**todos** podem usar) |
| `/config ...` | Cargos, logs, automod e censura (Administrador) |

### 🎨 Emojis e figurinhas

| Comando | O que faz |
|---|---|
| `/criaremoji nome [arquivo] [imagem]` | Cria um emoji a partir de imagem, link ou emoji personalizado |
| `/criarfigurinha nome [arquivo] [imagem] [tags] [descricao]` | Cria uma figurinha (sticker) |

Regras do Discord:

- **Emoji:** PNG, JPG ou GIF de até **256 KB** (recomendado 128x128). Nome com 2 a 32 letras/números/`_`.
- **Figurinha:** PNG ou APNG de **320x320** pixels e até **512 KB**. Nome com 2 a 30 caracteres.
- O bot precisa da permissão **Gerenciar Expressões**.

---

## Prefixo `z?`

Quase todos os comandos funcionam também como mensagem normal, sem barra:

```
z?ban @Fulano 1d Flood
z?mute @Fulano 30min Flood
z?warn @Fulano Desrespeito
z?fastpuni mute @Fulano 1h Flood
z?clear 50
z?censura add palavra
z?automod ligar
z?criaremoji meuemoji https://exemplo.com/img.png
```

Regras do prefixo:

- Para textos com espaço, use **aspas duplas**: `z?say "Bom dia a todos"`.
- Usuário pode ser **@menção** ou ID. Cargo e canal podem ser menção, ID ou nome.
- As respostas do prefixo são **públicas** (as dos comandos de barra são privadas).
- `/config` só funciona com barra, porque tem muitos subcomandos.
- O prefixo pode ser trocado no `.env` (`PREFIX=`), mas `z?` é o padrão.

---

## Ranking de call

`/rankcall` (ou `z?rankcall`) mostra, em uma mensagem pública:

- **Top 5** de quem mais ficou em call, com 🥇🥈🥉4️⃣5️⃣, o tempo total e um 🟢 em quem está em call agora
- **Em call agora**: até 5 pessoas que estão em canal de voz neste momento, com a colocação (`#N`), o tempo total, há quanto tempo estão na call e em qual canal
- No rodapé, a **sua** colocação e o seu tempo

Como funciona:

- O tempo de quem está em call já entra na colocação em tempo real (quem está na call sobe no ranking enquanto fala).
- Trocar de canal de voz **não** zera a contagem. O canal **AFK** do servidor **conta** (aparece com 💤 em "Em call agora"); os **bots** não contam. Para ignorar o AFK, troque `COUNT_AFK` para `false` em `src/voice.js`.
- Quem **sai do servidor** (ou é expulso/banido) sai do ranking.
- O tempo é salvo em `data/voz.json` a cada minuto e ao desligar o bot. Se o bot cair, perde-se no máximo 1 minuto. A contagem começa quando o bot é ligado pela primeira vez com esta versão.
- Não precisa ativar nada no portal do Discord: a intent de voz (`GUILD_VOICE_STATES`) não é privilegiada. Os comandos novos são registrados sozinhos ao religar o bot.
- Para deixar o comando só para a equipe, troque `staffOnly: false` por `true` em `src/commands/voz.js`.

---

## Detalhes importantes

**Quem pode usar:** o dono do servidor e Administradores sempre podem. Os demais precisam de um dos cargos liberados com `/config cargo`.

**Confirmação:** banir, desbanir, expulsar, silenciar, avisar, limpar avisos, limpar mensagens, trancar/destrancar e mexer em cargo pedem **Sim/Não**. Só quem digitou o comando consegue clicar, e o pedido expira em 45 segundos. No prefixo, o pedido aparece publicamente no canal.

**Tempo:** `s` = segundos, `min` = minutos, `h` = horas, `d` = dias, `sem` = semanas, `mes` = meses, `a` = anos. Pode juntar: `1d12h`, `1h30min`.

**Silenciamentos longos:** o Discord aceita no máximo 28 dias de castigo por vez. Se você silenciar por mais tempo, o bot **renova automaticamente** até o prazo acabar.

**Banimento temporário:** é desfeito sozinho quando o tempo termina, mesmo que o bot reinicie no meio.

**Avisos, punições, ranking de call e highlights:** ficam guardados na pasta `data/` (não apague essa pasta). Em hospedagens com disco temporário (ex.: planos grátis do Render ou Heroku) essa pasta some a cada reinício: use um disco persistente.

**Censura:** vale para palavras inteiras (uma palavra dentro de outra não conta), sem diferenciar maiúsculas, minúsculas ou acentos. A mensagem é apagada, o autor recebe uma DM e o caso vai para o canal de logs. Limite de 100 palavras por servidor.

**Automod de links:** quando ligado, apaga mensagens com links (`https://`, `www.` e domínios comuns como `.com`, `.gg`, `.br`). Quem tem cargo liberado ou Administrador continua podendo enviar links.

**Proteções:** o bot não pune a si mesmo, o dono do servidor, bots, nem alguém com cargo igual ou mais alto que o seu. Ele também avisa quando falta alguma permissão para ele mesmo (Banir, Expulsar, Silenciar, Gerenciar Mensagens, Gerenciar Canais, Gerenciar Cargos, Gerenciar Apelidos, Gerenciar Expressões).

**Privacidade:** para o prefixo, a censura e o automod funcionarem, o bot precisa do **MESSAGE CONTENT INTENT** e lê o texto das mensagens. Ele não guarda conversas: só apaga o que bate nas regras e registra o caso no canal de logs.

---

## Estrutura

```
src/
  index.js              liga o bot, distribui comandos e mensagens
  server.js             porta HTTP (/health) para o Render
  deploy.js             registra os comandos na mão (npm run deploy)
  register.js           registro automático dos comandos ao ligar
  commands/
    moderacao.js        comandos de moderação
    automod.js          /censura e /automod
    emojis.js           /criaremoji e /criarfigurinha
    utilidades.js       help, ping, userinfo, serverinfo, avatar, say, anuncio
    voz.js              /rankcall (ranking de call)
    highlight.js        /highlight (palavras que marcam você)
    config.js           /config (cargos, logs, automod)
  prefix.js             comandos com z? e adaptação das interações
  automod.js            censura de palavras e bloqueio de links
  execute.js            execução e tratamento de erros
  actions.js            as ações de punição em si
  guard.js              checagens de permissão e hierarquia
  permissions.js        quem é staff
  punish.js             expiração automática de tempban/mute
  store.js              dados salvos em data/*.json
  time.js               leitura de 1s, 1min, 1d, 1a...
  voice.js              contagem do tempo em call
  highlight.js          busca de palavras e marcação (highlight)
  ui.js                 embeds e confirmação Sim/Não
  logger.js             canal de logs
```

## Cargo temporário

`/cargotemp usuario cargo tempo [motivo]` (ou `z?cargotemp @pessoa @cargo 2h motivo`) dá o cargo e o bot **remove sozinho** quando o tempo acabar. O tempo vai de **1 minuto a 365 dias** (`30min`, `2h`, `1d`, `1sem`...).

- Vale a mesma regra do `/setcargo`: o cargo precisa estar **abaixo do seu cargo mais alto** e **abaixo do meu**. Dá para usar em você mesmo.
- Usar de novo no mesmo cargo **renova** o prazo (substitui o anterior).
- Se a pessoa **já tem o cargo sem prazo**, o comando recusa: senão ela o perderia no fim. Remova antes com `/setcargo`.
- Mexer no cargo com `/setcargo` (tirar ou dar de novo) **cancela o prazo**, então um cargo dado depois nunca é removido por um prazo antigo.
- A remoção é conferida a cada minuto e o prazo sobrevive a reinícios (`data/punicoes.json`). Se eu não conseguir remover (falta de permissão), tento de novo por 5 minutos e aviso no canal de logs.
- Se a pessoa sair do servidor, o prazo é só descartado. Aparece na contagem de "Punições temporárias ativas" do `/config`.

---

## Highlight

Cada pessoa cadastra até **10 palavras** com `/highlight adicionar palavra`. Quando alguém falar uma delas em um canal, o bot **responde à mensagem marcando** quem cadastrou, destacando a palavra em negrito: `🔔 @você — palavra destacada: **bola**`.

- Vale para **palavra inteira** (`bola` não pega `bolada`), sem diferenciar maiúsculas, acentos ou pontuação. Frases também funcionam (`cafe com leite`).
- Mínimo de **3 letras** por palavra. A pessoa nunca é marcada pela própria mensagem, e bots não disparam.
- **Só marca quem enxerga o canal**, para a mensagem não vazar para quem não deveria vê-la.
- Anti-spam: a mesma pessoa só é marcada de novo **no mesmo canal após 1 minuto**, e no máximo **5 pessoas** por mensagem.
- Mensagem apagada pelo automod/censura não marca ninguém. Quem sai do servidor perde as próprias palavras.
- As palavras ficam em `data/highlights.json`.
- Use pelos comandos de barra (`/highlight ...`): as respostas são só suas. Pelo prefixo (`z?highlight ...`) a resposta aparece para todo mundo.
- Para deixar só a equipe, troque `staffOnly: false` por `true` em `src/commands/highlight.js`.

---

## Hospedar no Render (Web Service)

O bot abre uma porta HTTP (variável `PORT`, que o Render define sozinho) com as rotas `/` e `/health`, que respondem `200` com o estado do bot. Isso evita o erro "Port scan timeout".

- **Build Command:** `npm install` · **Start Command:** `npm start`
- Variáveis de ambiente: `DISCORD_TOKEN`, `CLIENT_ID` (e `GUILD_ID` / `PREFIX` se usar).
- **Health Check Path:** `/health`
- No plano grátis, o Render **hiberna** o serviço depois de ~15 min sem acesso HTTP e o bot cai. Use um monitor (ex.: UptimeRobot) chamando `https://SEU-APP.onrender.com/health` a cada 5 minutos.
- O disco do plano grátis é temporário: a pasta `data/` (avisos, punições, ranking de call) some a cada reinício. Para não perder dados, use um disco persistente.

---

## Problemas comuns

- **"Usou intents não permitidas" ao ligar:** ative **MESSAGE CONTENT INTENT** e **SERVER MEMBERS INTENT** no menu Bot do portal.
- **O prefixo `z?` não responde:** confira o `PREFIX` no `.env` e se o MESSAGE CONTENT INTENT está ligado.
- **"Sem permissão" para todo mundo:** configure `/config cargo adicionar` com o cargo da equipe.
- **Os comandos `/` não aparecem:** veja o console de quando o bot liga (no Render: aba *Logs*).
  - `✅ N comandos de barra registrados` → deu certo. Se foi global, pode levar até 1 hora; com `GUILD_ID` aparece na hora, só nesse servidor. Feche e abra o Discord (Ctrl+R no computador) para atualizar a lista.
  - `❌ ... Dica: ...` → siga a dica (token inválido, `CLIENT_ID` errado ou convite sem o escopo `applications.commands`; nesse caso convide de novo pelo link do passo 4).
  - Nenhuma dessas linhas → o `AUTO_DEPLOY` está `false` ou o Render ainda está rodando a versão antiga (confira o último deploy).
  - Comandos **duplicados** (um do servidor e um global): rode `npm run deploy:global` uma vez.
- **"Eu preciso da permissão ...":** o próprio bot precisa das permissões no servidor. Use o link de convite acima ou ajuste o cargo dele.
- **Figurinha recusada:** ela precisa ser PNG/APNG de 320x320 e até 512 KB.
- **`/rankcall` vem vazio:** o ranking só passa a contar a partir da primeira vez que o bot fica ligado com esta versão.
- **Não consegui entrar no Discord:** o token está errado ou foi resetado. Gere outro e atualize o `.env`.
