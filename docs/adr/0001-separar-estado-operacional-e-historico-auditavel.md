# Separar estado operacional e historico auditavel

Decidimos manter `movimentacoes` como o estado operacional usado pela portaria e registrar o historico auditavel em `movimentacoes_acoes`.

A alternativa de transformar `movimentacoes` em uma linha por acao foi rejeitada porque essa tabela ja sustenta o fluxo de trabalho atual. Separar o historico permite uma linha imutavel para liberacao, saida, entrada e correcao sem quebrar o controle operacional.
