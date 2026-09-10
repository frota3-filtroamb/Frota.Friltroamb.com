# Gestão de Frota - FiltroAmb

Sistema interno de gerenciamento e controle operacional de frota veicular, portaria, transferências, liberação e almoxarifado.

## Language

**Veículo**:
Ativo automotivo cadastrado na frota ativa da empresa, identificado univocamente por sua Placa (`NR_PLACA`), com dados cadastrais de modelo, marca, ano, cor, combustível e tipo.
_Avoid_: Carro, automóvel (como termo geral)

**Placa**:
Identificador alfanumérico único oficial do veículo no padrão Mercosul ou antigo.
_Avoid_: Registro, matrícula

**Frota Ativa**:
Conjunto total de veículos operacionais disponíveis e mantidos no acervo da empresa.
_Avoid_: Lista de carros, inventário

**Filtros de Frota**:
Controles de interface que restringem dinamicamente a listagem de veículos por atributos cadastrais (Marca, Tipo de Veículo, Combustível, Placa/Modelo).
_Avoid_: Pesquisa avançada

**Portaria**:
Ponto de controle físico e operacional de registro de entrada e saída de veículos, pedestres e transferências da base operacional.
_Avoid_: Guarita, recepção

**Paginação de Frota**:
Divisão dos veículos em páginas navegáveis com seletor de quantidade por página para manter alta performance visual e ergonomia de leitura.
_Avoid_: Rolagem infinita (neste contexto)

**Ordenação Interativa**:
Alternância bidirecional (crescente e decrescente) da ordem dos registros acionada diretamente no cabeçalho das colunas da tabela.
_Avoid_: Reorganização manual
