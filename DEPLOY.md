# Publicar o Nicko Community no Cloudflare Pages

A API deste projeto usa **Cloudflare Pages Functions** e um banco **D1**. Por isso, não basta ativar GitHub Pages: o site deve ser publicado no Cloudflare Pages para executar `functions/api/[[path]].js`.

## 1. Conectar o repositório

1. Entre no painel Cloudflare e abra **Workers & Pages**.
2. Escolha **Create application → Pages → Connect to Git**.
3. Conecte o GitHub e selecione `nickebel/nicko`.
4. Escolha a branch de produção `main`.
5. Como o projeto não usa framework nem etapa de build, deixe o campo **Build command** vazio.
6. Defina o **Build output directory** como `.` (raiz do repositório).
7. Salve e faça o primeiro deploy.

## 2. Criar o banco D1

1. Em **Workers & Pages**, abra a área **D1 SQL Database** (ou D1).
2. Crie um banco, por exemplo `nicko-community-db`.
3. Abra o Console SQL desse banco.
4. Copie todo o conteúdo de `schema.sql` deste repositório e execute no Console.

Isso cria as tabelas de usuários, sessões, publicações, curtidas, comentários e seguidores.

## 3. Conectar o D1 ao projeto Pages

1. Volte ao projeto Pages `nicko`.
2. Abra **Settings → Bindings**.
3. Selecione **Add → D1 database**.
4. Em **Variable name**, escreva exatamente `DB`.
5. Selecione o banco `nicko-community-db`.
6. Salve e faça um novo deploy para a ligação estar disponível nas Functions.

## 4. Conferir a conexão

Abra o endereço `https://SEU-PROJETO.pages.dev/api/health`.

A resposta esperada é:

```json
{"ok":true,"database":true}
```

Quando o site detectar a API e o D1, a faixa “Modo demonstração” desaparece. Cadastros, sessões, publicações, curtidas, comentários e seguidores passam a ficar no banco e a ser compartilhados entre visitantes.

## 5. Teste inicial recomendado

1. Abra o site em uma janela anônima.
2. Crie uma conta com e-mail válido e senha forte.
3. Publique um texto sem imagem.
4. Abra o mesmo site em outro navegador e crie outra conta.
5. Confira se a primeira publicação aparece, curta e comente.

## Observações importantes

- A variável de ligação D1 precisa se chamar `DB`, respeitando maiúsculas e minúsculas.
- Se o site ainda mostrar “Modo demonstração”, confira a rota `/api/health`, o binding e se houve um novo deploy depois de salvar a ligação.
- Não configure GitHub Pages como hospedagem final desta versão: GitHub Pages não executa Cloudflare Pages Functions.
- O sistema aceita URLs de imagem HTTP/HTTPS, mas ainda não tem upload de arquivos.
- Não existe recuperação de senha nem verificação de e-mail nesta versão. Não use senhas importantes ou reutilizadas enquanto essas funções não forem adicionadas.
- A versão inicial não possui painel de moderação. Faça testes com poucas pessoas antes de divulgar publicamente e estabeleça regras de comunidade e política de privacidade.
- Confira os limites e a cobrança do plano Cloudflare da sua conta antes de disponibilizar para muitos usuários.


## 6. Atualizar os campos de perfil

Para habilitar banner e link pessoal, abra o Console SQL do banco D1 `nicko-community-db` e execute uma única vez o conteúdo de `migrations/0002_profile_customization.sql`:

```sql
ALTER TABLE users ADD COLUMN banner_url TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN website_url TEXT NOT NULL DEFAULT '';
```

Não execute novamente depois que as colunas forem criadas. Essa migração preserva as contas já cadastradas.

## 7. Usar fotos e banners sem R2

Para manter o projeto sem depender de armazenamento adicional, fotos de perfil e banners são informados por **links diretos de imagens públicas**.

1. Hospede a imagem em um serviço de imagens de sua preferência.
2. Copie o endereço direto do arquivo da imagem (por exemplo, um link que termina em `.jpg`, `.png` ou `.webp`).
3. Abra **Meu perfil → Editar perfil** no Nicko Community.
4. Cole o endereço nos campos **Link da foto de perfil** e **Link do banner / capa**.
5. Confira a prévia e salve.

Os endereços precisam começar com `https://` ou `http://` e permitir acesso público direto. Links de páginas de visualização (em vez do arquivo de imagem) podem não funcionar. O site não envia arquivos nem armazena essas imagens; apenas guarda os endereços no D1. Se o serviço de hospedagem apagar ou tornar privada a imagem, ela deixará de aparecer.

Não é necessário criar bucket R2, adicionar binding `MEDIA` ou ativar assinatura do R2.

## 8. Adicionar arquivo, salvos, republicação e controle das publicações

Para a base D1 que já existe, abra **D1 → nicko-community-db → Console** e execute uma única vez o conteúdo de `migrations/0003_post_controls.sql`.

A migração adiciona:
- `archived_at` e `repost_of` na tabela `posts`;
- tabela `bookmarks` para publicações salvas;
- índices para o arquivo e os salvos.

Não execute essa migração novamente depois de bem-sucedida; ela não deve ser repetida porque usa `ALTER TABLE`.

Depois de o deploy terminar, cada publicação terá um menu com:
- **Salvar publicação** ou remover dos salvos;
- **Republicar** no seu próprio perfil;
- **Arquivar publicação** (somente publicações suas);
- **Apagar publicação** (somente publicações suas).

O menu **Salvos** mostra sua lista privada. O **Arquivo pessoal** mostra suas publicações arquivadas, com opção de restaurá-las. Publicações arquivadas deixam de aparecer no feed.

## 9. Acesso restrito a membros

Visitantes sem sessão veem somente a tela de entrada/cadastro. O feed, comentários, descoberta de pessoas, perfis e listas de salvos/arquivo exigem autenticação. A API também verifica a sessão; ocultar elementos na interface não é a única proteção.

## 10. Recursos de perfil

Depois da migração D1, a tela **Meu perfil → Editar perfil** permite alterar nome de exibição, @usuário exclusivo, foto, banner, biografia e link pessoal. Os nomes de usuário são únicos e comparados sem diferenciar maiúsculas e minúsculas. No cadastro, e-mail e nome de usuário também são protegidos por índices UNIQUE no D1.

O formulário de login/cadastro inclui o botão **Mostrar/Ocultar** para conferir a senha digitada. A senha continua armazenada como hash derivado no servidor; não é possível recuperar a senha antiga em texto puro.
