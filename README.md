
1. O Banco de Dados: Supabase (O Cofre)
É onde ficam guardadas todas as informações da empresa: a lista de veículos, placas, modelos, marcas, anos e status da portaria.

Em vez de salvar arquivos de texto na sua Área de Trabalho, os dados ficam armazenados na nuvem de forma segura e organizada.

2. O Código: GitHub (O Armário de Projetos)
É o local onde todo o código-fonte do sistema (escrito em Next.js, React e Tailwind CSS) fica guardado e protegido.

Sempre que você faz uma alteração no seu computador (no VS Code) e roda os comandos git add e git push, o arquivo atualizado é enviado direto para o GitHub.

3. A Hospedagem: Vercel (O Motor da Aplicação)
É o serviço que pega o código que está no seu GitHub e faz ele "rodar" na internet 24 horas por dia.

Ela se conecta com o Supabase usando as chaves de segurança que configuramos (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY) para conseguir buscar a lista de veículos.

O segredo: Toda vez que entra código novo no GitHub, a Vercel percebe sozinha e atualiza o site no ar automaticamente!

4. O Site Operando: FiltroAmb - Frota Ativa (A Sua Tela)
É o resultado final! É o link que você pode abrir no seu computador, celular ou enviar para um colega.

Quando a página carrega, ela faz um pedido silencioso para o Supabase, pega os 368 veículos cadastrados e exibe na tela com esse visual escuro (Dark Mode), com a busca por placa e o menu da Portaria.

Link do Sistema para visualização : https://frota.filtroamb.com.br
