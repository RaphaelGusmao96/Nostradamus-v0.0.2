# Nostradamus - Bot de Negociação de Criptomoedas

Nostradamus é um bot de negociação de criptomoedas desenvolvido em Node.js, que utiliza a API da Binance para realizar operações de compra e venda automatizadas com base em indicadores técnicos.

## Características

- Utiliza a API da Binance para obter dados de mercado em tempo real e executar ordens de compra e venda.
- Implementa indicadores técnicos como RSI, Bandas de Bollinger e MACD para tomar decisões de negociação.
- Suporta a configuração de parâmetros como stop loss, trailing stop loss e tamanho da posição.
- Registra as atividades de negociação em um arquivo de texto para análise posterior.

## Pré-requisitos

- Node.js
- Conta na Binance com API Key e Secret Key

## Configuração

1. Clone o repositório:

   ```bash
   git clone https://github.com/seu-usuario/nostradamus-bot.git
   cd nostradamus-bot

Instale as dependências:

npm install

Crie um arquivo .env na raiz do projeto e adicione suas chaves da API da Binance:

API_KEY=sua_api_key
SECRET_KEY=sua_secret_key

Configure os parâmetros de negociação no arquivo index.js de acordo com suas preferências.

Para iniciar o bot, execute:
node index.js


Aviso Legal
Este bot é fornecido "como está" e não garante lucros. A negociação de criptomoedas envolve riscos significativos e pode resultar na perda total de seu investimento. Use por sua própria conta e risco.


