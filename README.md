# Nicko Community

**somewhere, not everywhere.** — uma comunidade digital inspirada na estética minimalista e azul-noite do perfil [@nicko_mp4](https://www.instagram.com/nicko_mp4/).

## Funcionalidades

- Cadastro e login com sessão em cookie HttpOnly.
- Perfil com nome de exibição, @usuário exclusivo, foto de perfil, banner, biografia e link pessoal.
- Feed e perfis da comunidade visíveis somente para usuários autenticados.
- Menu de publicação: salvar, republicar, arquivar e apagar (com controle de propriedade).
- Área privada de publicações salvas e arquivo pessoal com restauração.
- Curtidas e comentários.
- Descoberta de usuários e seguir/deixar de seguir.
- Modo demonstração local, para testar a interface sem configurar o banco.
- API em Cloudflare Pages Functions com Cloudflare D1; fotos e banners usam links diretos de imagens públicas, sem R2.
- Controle mostrar/ocultar senha no cadastro e login.
- Botão de saída visível na barra superior.
- Alternância entre modo claro e escuro, com preferência salva no navegador.
- Favicon próprio.

## Estrutura

- `index.html`: interface responsiva e cliente da comunidade.
- `functions/api/[[path]].js`: API de autenticação, perfis, feed e interações.
- `schema.sql`: estrutura completa do banco D1 para instalações novas.
- `migrations/0002_profile_customization.sql` e `migrations/0003_post_controls.sql`: atualizações para bancos existentes.
- `DEPLOY.md`: instruções de publicação no Cloudflare Pages.

## Testar

Ao abrir sem a API conectada, o site entra em **Modo demonstração**. Criações feitas nesse modo ficam apenas no armazenamento local daquele navegador e não são compartilhadas com outras pessoas.

Para contas e conteúdo reais, publique pelo **Cloudflare Pages** e conecte um banco D1 conforme `DEPLOY.md`. O GitHub Pages, sozinho, hospeda apenas os arquivos estáticos e não executa as funções da API.

## Limitações desta primeira versão

- Imagens de publicações, avatares e banners usam links externos; upload de arquivos não está incluído.
- Não há verificação de e-mail, recuperação de senha, mensagens privadas, denúncias ou painel de moderação.
- Para foto e banner, informe links diretos e públicos de imagens no editor de perfil. Não é necessário R2.
- Em bancos criados antes da versão atual, execute uma única vez as migrações `migrations/0002_profile_customization.sql` e `migrations/0003_post_controls.sql` no D1. Não repita migrações já aplicadas.
- Antes de abrir a comunidade publicamente, implemente regras de uso, política de privacidade, exclusão de conta e ferramentas de moderação.
- Verifique os limites e custos atuais do plano Cloudflare escolhido. Não há promessa de uso ilimitado gratuito.

## Segurança

As senhas do modo real são derivadas no servidor com PBKDF2; o navegador recebe um cookie de sessão HttpOnly, SameSite=Lax. Não coloque segredos ou senhas no repositório. Configure o binding D1 com o nome exato `DB`.
