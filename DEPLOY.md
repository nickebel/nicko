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

## 7. Ativar upload de fotos e banners com R2

A comunidade usa R2 para guardar imagens fora do banco SQL.

1. No painel Cloudflare, abra **R2 Object Storage**.
2. Crie um bucket chamado `nicko-community-media`.
3. Abra **Workers & Pages → nicko → Settings → Bindings**.
4. Clique em **Add → R2 bucket**.
5. Em **Variable name**, informe exatamente `MEDIA`.
6. Selecione o bucket `nicko-community-media` e o ambiente **Production**.
7. Salve e faça um novo deploy.

O código envia as imagens para o R2 pelo servidor; as imagens são servidas pela rota `/api/media/...`, sem precisar tornar o bucket publicamente acessível por um domínio próprio.

A interface aceita JPG, PNG, WebP, GIF e AVIF, com limite de 8 MB por imagem. Se o R2 ainda não estiver ligado, o site mostra uma mensagem explicando a configuração pendente.

## 8. Recursos de perfil

Depois da migração D1 e do binding R2, a tela **Meu perfil → Editar perfil** permite alterar nome de exibição, @usuário exclusivo, foto, banner, biografia e link pessoal. Os nomes de usuário são únicos e comparados sem diferenciar maiúsculas e minúsculas. No cadastro, e-mail e nome de usuário também são protegidos por índices UNIQUE no D1.

O formulário de login/cadastro inclui o botão **Mostrar/Ocultar** para conferir a senha digitada. A senha continua armazenada como hash derivado no servidor; não é possível recuperar a senha antiga em texto puro.
