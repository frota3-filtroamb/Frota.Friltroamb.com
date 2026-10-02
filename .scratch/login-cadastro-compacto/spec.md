# Spec: Tela de Login e Cadastro Compacta

Status: ready-for-agent

## Problem Statement

A tela de login e cadastro precisa ficar utilizavel em 100% de zoom sem criar barra de rolagem vertical. A etapa que pede codigo de verificacao tambem precisa manter proporcao visual com o restante do formulario, sem campos ou numeros ampliados.

## Solution

Manter o visual atual da autenticacao, com banner de fundo, logo, nome do sistema e formularios do Clerk, mas compactar os espacamentos externos e internos. O formulario deve caber melhor em telas comuns sem depender de zoom do navegador. O aviso inferior deve ser curto e pode ser ocultado em telas baixas.

## User Stories

1. As a usuario do sistema, I want abrir o login em 100% de zoom, so that eu nao precise ajustar o navegador manualmente.
2. As a usuario do sistema, I want que o cadastro siga o mesmo padrao visual do login, so that eu reconheca as duas telas como parte do mesmo sistema.
3. As a usuario do sistema, I want que o codigo de verificacao tenha tamanho normal, so that a etapa de autenticacao nao pareca quebrada.
4. As a usuario do sistema, I want ver apenas um aviso curto de acesso restrito, so that a tela fique limpa e objetiva.
5. As a usuario em tela baixa, I want que elementos secundarios sumam antes de gerar rolagem, so that o login continue fixo e limpo.
6. As a administrador do sistema, I want manter banner e marca, so that a tela continue identificavel como Filtroamb Frota.

## Implementation Decisions

- Login e cadastro continuam usando Clerk.
- As telas de autenticacao continuam forcando tema escuro.
- O layout usa altura dinamica da viewport e evita rolagem no corpo da pagina.
- O conteudo externo e compactado: padding, logo, margens e aviso inferior.
- O formulario do Clerk e compactado por configuracao de aparencia e CSS escopado por atributo da pagina de autenticacao.
- O aviso inferior fica curto: `Acesso restrito a colaboradores autorizados.`
- O aviso inferior e ocultado em telas com altura baixa.
- Os campos de codigo/OTP ficam menores, com fonte menor e espacamento regular.

## Testing Decisions

- Testar visualmente login e cadastro em 100% de zoom.
- Testar a etapa que pede codigo de verificacao.
- Confirmar ausencia de rolagem vertical em telas desktop comuns.
- Confirmar que o CSS escopado da autenticacao nao afeta as telas internas.
- Rodar checagem de TypeScript.

## Out of Scope

- Alterar o fluxo de autenticacao do Clerk.
- Criar um layout novo de login.
- Trocar a imagem de fundo.
- Mudar permissoes, redirecionamentos ou regras de cadastro.

## Further Notes

Se ainda houver rolagem em notebooks com telas muito baixas, o proximo ajuste deve ocultar tambem o subtitulo externo ou reduzir mais o cabecalho visual.
