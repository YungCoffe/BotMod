# Bot de Moderação e Utilidades

Bot de Discord enxuto: **só moderação + utilidades**, com acesso liberado por **cargo**, confirmação **Sim/Não** antes de cada punição e o comando **`/fastpuni`**, que aplica na hora sem perguntar. Funciona com **comandos de barra** e também com o **prefixo `z?`**.

- **27 comandos** (15 de moderação, 2 de automod, 10 de utilidades/configuração)
- Tempo em formato livre: `1s`, `30s`, `10min`, `1h`, `1d`, `1sem`, `1mes`, `1a` — e combinações como `1d12h`
- Banimento e silenciamento temporários são removidos sozinhos quando o tempo acaba
- Avisos ficam salvos (mesmo se o bot reiniciar)
- Censura de palavras e bloqueio automático de links
- Criação de emojis e figurinhas pelo próprio Discord
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

```bash
npm run deploy
```

Se preencheu o `GUILD_ID`, eles já aparecem no servidor. Para forçar o modo servidor de testes:

```bash
npm run deploy:teste
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
| `/setcargo usuario cargo` | Adiciona ou remove um cargo |
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

## O que funciona no Render

- O bot rodando dentro do Render (gratuito com piscão/controlador, ou pago sem piscão);
- O prefixo `z?`, a censura, o automod e a conversa do bot com o Discord;
- Os comandos de barra `/` (habilitados pelo `npm run deploy`); os dados salvos ficam na pasta `data/`.

**Quem pode usar:** o dono do servidor e Administradores sempre podem. Os demais precisam de um dos cargos liberados com `/config cargo`.

**Confirmação:** banir, desbanir, expulsar, silenciar, avisar, limpar avisos, limpar mensagens, trancar/destrancar e mexer em cargo pedem **Sim/Não**. Só quem digitou o comando consegue clicar, e o pedido expira em 45 segundos. No prefixo, o pedido aparece publicamente no canal.

**Tempo:** `s` = segundos, `min` = minutos, `h` = horas, `d` = dias, `sem` = semanas, `mes` = meses, `a` = anos. Pode juntar: `1d12h`, `1h30min`.

**Silenciamentos longos:** o Discord aceita no máximo 28 dias de castigo por vez. Se você silenciar por mais tempo, o bot **renova automaticamente** até o prazo acabar.

**Banimento temporário:** é desfeito sozinho quando o tempo termina, mesmo que o bot reinicie no meio.

**Avisos:** ficam guardados na pasta `data/` (não apague essa pasta).

**Censura:** vale para palavras inteiras (uma palavra dentro de outra não conta), sem diferenciar maiúsculas, minúsculas ou acentos. A mensagem é apagada, o autor recebe uma DM e o caso vai para o canal de logs. Limite de 100 palavras por servidor.

**Automod de links:** quando ligado, apaga mensagens com links (`https://`, `www.` e domínios comuns como `.com`, `.gg`, `.br`). Quem tem cargo liberado ou Administrador continua podendo enviar links.

**Proteções:** o bot não pune a si mesmo, o dono do servidor, bots, nem alguém com cargo igual ou mais alto que o seu. Ele também avisa quando falta alguma permissão para ele mesmo (Banir, Expulsar, Silenciar, Gerenciar Mensagens, Gerenciar Canais, Gerenciar Cargos, Gerenciar Apelidos, Gerenciar Expressões).

**Privacidade:** para o prefixo, a censura e o automod funcionarem, o bot precisa do **MESSAGE CONTENT INTENT** e lê o texto das mensagens. Ele não guarda conversas: só apaga o que bate nas regras e registra o caso no canal de logs.

---

## Estrutura

```
src/
  index.js              liga o bot, distribui comandos e mensagens
  deploy.js             registra os comandos no Discord
  commands/
    moderacao.js        comandos de moderação
    automod.js          /censura e /automod
    emojis.js           /criaremoji e /criarfigurinha
    utilidades.js       help, ping, userinfo, serverinfo, avatar, say, anuncio
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
  ui.js                 embeds e confirmação Sim/Não
  logger.js             canal de logs
```

## Render

O projeto já vem com um blueprint (`render.yaml`) e um servidor de saúde (`/health`) pronto. O bot está pronto para rodar no Render como **Web Service gratuita** (com piscão externo) ou **Background Worker pago** (sem piscão).

### Pré-requisitos

- **GitHub:** o Render não aceita upload de ZIP. Crie um repositório (pode ser privado) e envie o conteúdo da pasta `bot-moderacao`. O `.env` **nunca** vai pro GitHub.
- **Discord:** habilite **MESSAGE CONTENT INTENT** e **SERVER MEMBERS INTENT** no menu Bot do portal (precisam estar ligados para o prefixo, censura e automod funcionarem), e anexe as permissões moderação na aplicação do bot (o link de convite no README já traz a lista atualizada).
- **Variáveis de ambiente:** `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` (opcional), `PREFIX` (opcional, padrão `z?`).

### Deploy (blueprint)

1. No Render, `New` → `Blueprint` e selecione o repositório. O `render.yaml` no topo do projeto será lido.
2. Detalhes do serviço:
   - `name`: usa o que quiser (só letras/minúsculas/hífens).
   - `runtime`: `node`.
   - `buildCommand`: `npm ci` (usa o package-lock.json).
   - `startCommand`: `npm start`.
   - `healthCheckPath`: `/health` (requerido só na opção grátis, abaixo).
   - `envVars`: adicione os 4 campos acima (os 3 primeiros como *Secure*).
3. Se o deploy falhar com `node: not found` ou `[nodemon] not found`, ajuste o `runtime` do serviço para `node` (não precisa mudar a versão: o Render já sobe a LTS do Node contemporânea). Caso queira fixar a versão, crie um arquivo `.node-version` com `22.14.0`.

### Duas opções de execução

**Opção 1 (grátis, com piscão externo).** Web Service `plan: free` com `healthCheckPath: /health`. Sem conexão HTTP by 15 minutos, Render "dorme" o serviço e o bot para. Use um monitor grátis (UptimeRobot, Cron-job.org) que faça GET `/health` a cada 5 minutos. O bot volta a subir automaticamente. Limite do Render: 750 horas mensais — um serviço semi-rigide 24h/dia cabe no limite quase todo mês.

**Opção 2 (recomendada, sem piscão).** `type: worker`, `plan: starter` (US$ 7/mês). Sem porta aberta, sem piscão, não dorme. Em `render.yaml`, conserte:

```yaml
services:
  - type: worker
    name: bot-moderacao
    runtime: node
    plan: starter
    buildCommand: npm ci
    startCommand: npm start
    envVars:
      - key: DISCORD_TOKEN
        sync: false
      - key: CLIENT_ID
        sync: false
      - key: GUILD_ID
        sync: false
      - key: PREFIX
        value: z?
```

Com a opção 2 o bot fica disponível 24h em 24h e não consome horas de 15min, mas o data/* continua sendo ephemeno (perde em cada redeploy/reload). Para persistir adicione um Render Disk na pasta `/opt/render/project/src/data` (opcional, $0,25/GB/mês).

### Atualizar depois

- `npm run deploy` atualiza os comandos do Discord;
- Envie o código para o GitHub: o Render reconstrói automaticamente o serviço;
- O token expira se o Discord resetar: gere outro no portal e atualize a variável no Render.
1. **GitHub:** o Render não aceita upload de ZIP. Crie um repositório (pode ser privado) e envie o conteúdo da pasta `bot-moderacao` (o `.env` **nunca** vá pro GitHub).
2. **Render:** Abra <https://dashboard.render.com>, `New` → `Blueprint`, selecione o repositório e `Parse Render YAML`.
3. **Variáveis de ambiente:** em *Environment* do serviço, acrescente:
   - `DISCORD_TOKEN` (secreto, não exporte na sua máquina)
   - `CLIENT_ID` e `GUILD_ID` (opcionais)
   - `PREFIX` (opcional, padrão `z?`)

### O que está no `render.yaml`

- `type: web` com `plan: free`, `healthCheckPath: /health` e `buildCommand: npm ci`.
- Se não quiser manter uma tela aberta, troque `type: web` por `type: worker` e `plan: starter`, e retire `healthCheckPath`. O worker não volta a dormir e não consome horas de 15min.

### Manter o bot acordado (opção grátis)

Web services gratuitos **dormem** se ficarem 15 minutos sem requisições. O bot é notificado pelo Discord do lado de fora, então ele não "acorda" por si só: fique de olho em um serviço externo que faça GET `https://seu-servico.onrender.com/health` a cada alguns minutos (UptimeRobot, Cron-job.org, etc.). Se o plano gratuito terminar (750 horas por mês), o Render suspende todos os serviços até o mês seguinte.

### O dado não sobrevive a reinícios

File systems em serviços gratuitos são **ephemeral**: `data/*.json` (avisos e multas temporárias) é limpo quando o serviço reinicia, recarrega ou é atualizado. Para não perder, crie um **Render Disk** (pago, $0,25/GB/mês) na pasta `/opt/render/project/src/data` — ou use um banco Postgres/Key Value gratuito, se quiser guardar de verdade.

### Teste

- Vá em *Logs* do serviço e espere o bot entrar no canal.
- Use `npm run deploy` ou o menu *Builds* para atualizar sem perder o estado.

- **"Usou intents não permitidas" ao ligar:** ative **MESSAGE CONTENT INTENT** e **SERVER MEMBERS INTENT** no menu Bot do portal.
- **O prefixo `z?` não responde:** confira o `PREFIX` no `.env` e se o MESSAGE CONTENT INTENT está ligado.
- **"Sem permissão" para todo mundo:** configure `/config cargo adicionar` com o cargo da equipe.
- **Comandos não aparecem:** rode `npm run deploy` de novo e confira o `CLIENT_ID` no `.env`. Comandos globais podem levar 1 hora.
- **"Eu preciso da permissão ...":** o próprio bot precisa das permissões no servidor. Use o link de convite acima ou ajuste o cargo dele.
- **Figurinha recusada:** ela precisa ser PNG/APNG de 320x320 e até 512 KB.
- **Não consegui entrar no Discord:** o token está errado ou foi resetado. Gere outro e atualize o `.env`.
