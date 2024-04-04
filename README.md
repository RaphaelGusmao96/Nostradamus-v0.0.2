# Nostradamus: Bot de Negociação de Criptomoedas

Nostradamus é um bot de negociação automatizado projetado para operar no mercado de criptomoedas. Ele utiliza uma combinação de indicadores técnicos para tomar decisões de compra e venda com o objetivo de maximizar os lucros e minimizar os riscos.

## Recursos

- **Indicadores Técnicos:** Utiliza RSI, Bandas de Bollinger, MACD e Média Móvel Exponencial (EMA) para analisar o mercado.
- **Gestão de Risco:** Implementa um stop loss fixo e um trailing stop loss para proteger o capital.
- **Estratégia Dinâmica:** Ajusta o número de condições de compra e venda com base na volatilidade do mercado, medida pelo ATR.
- **Registro de Dados:** Salva os dados de negociação em um arquivo de texto para análise posterior.

## Pré-requisitos

- Node.js
- Uma conta na Binance com API Key e Secret Key

## Configuração

1. Clone o repositório do bot:

git clone https://github.com/seuusuario/nostradamus-bot.git

2. Navegue até a pasta do bot e instale as dependências:

```bash
cd nostradamus-bot
npm install
```


3. Modifique o arquivo .env na raiz do projeto e adicione suas chaves da API da Binance e outros parâmetros de configuração:

API_KEY='sua_api_key'
SECRET_KEY='sua_secret_key'
SYMBOL=BTCUSDT
PROFITABILITY=0.01
BUY_DISCOUNT=0.01

## Uso

Para iniciar o bot, execute o seguinte comando na raiz do projeto:

```bash
node index.js
```

## Aviso

A negociação de criptomoedas envolve riscos significativos. Use este bot por sua própria conta e risco. É recomendável testar a estratégia em um ambiente de sandbox ou com quantidades pequenas antes de operar com capital significativo.