// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

// Importa os módulos necessários
const WebSocket = require("ws");
const Binance = require('node-binance-api');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

// Configura a API da Binance com suas chaves API e Secret
const binance = new Binance().options({
  APIKEY: process.env.API_KEY,
  APISECRET: process.env.SECRET_KEY
});

console.log("Iniciando o bot de negociação de criptomoedas...");


// Define as configurações e parâmetros para a estratégia de negociação
const config = {
  PROFITABILITY: parseFloat(process.env.PROFITABILITY),
  STOP_LOSS_PERCENT: 3,
  RSI_PERIOD: 9,
  BB_PERIOD: 11,
  MACD_SHORT_PERIOD: 9,
  MACD_LONG_PERIOD: 21,
  MACD_SIGNAL_PERIOD: 9,
  RSI_OVERBOUGHT: 75,
  RSI_OVERSOLD: 25,
  RSI_BUFFER: 10,  
  BUY_DISCOUNT: parseFloat(process.env.BUY_DISCOUNT),
  TRAILING_STOP_LOSS_PERCENT: 2,  // Novo parâmetro para trailing stop loss
  POSITION_SIZE: 0.0003,  // Define o tamanho fixo da posição
};

// Função para calcular o trailing stop loss
function calculateTrailingStopLoss(currentPrice, entryPrice) {
  const trailingStopLoss = currentPrice * (1 - config.TRAILING_STOP_LOSS_PERCENT / 100);
  return Math.max(trailingStopLoss, entryPrice * (1 - config.STOP_LOSS_PERCENT / 100));
}

// Define o estado inicial do trade, incluindo preços, indicadores e volumes
let tradeState = {
  sellPrice: 0,
  buyPrice: 0,
  isBuying: false,
  stopLossPrice: 0,
  rsi: null,
  bbUpper: null,
  bbLower: null,
  macd: null,
  macdSignal: null,
  closingPrices: [],
  volume: [],
  pivotPoint: 0,
  supportLevel: 0,
  resistanceLevel: 0
};
let previousBuyConditions = null;
let previousSellConditions = null;


function formatBoolean(value) {
  return value ? "\x1b[32mtrue\x1b[0m" : "\x1b[31mfalse\x1b[0m";
}


// Calcula os pontos de pivô, suporte e resistência com base nos dados históricos
async function calculatePivotPoints(symbol) {
  const historicalData = await binance.futuresCandles(symbol, '1d', { limit: 2 });
  const previousSession = historicalData[0];
  const high = parseFloat(previousSession[2]);
  const low = parseFloat(previousSession[3]);
  const close = parseFloat(previousSession[4]);

  const pivotPoint = (high + low + close) / 3;
  const s1 = (2 * pivotPoint) - high;
  const r1 = (2 * pivotPoint) - low;
  const s2 = pivotPoint - (high - low);
  const r2 = pivotPoint + (high - low);

  tradeState.pivotPoint = pivotPoint;
  tradeState.supportLevel = s1; // Use s2 for a more conservative support level
  tradeState.resistanceLevel = r1; // Use r2 for a more conservative resistance level
  
  console.log(`Níveis de Suporte e Resistência calculados - Suporte: $:${tradeState.supportLevel}, Resistência: $:${tradeState.resistanceLevel}`);
}

// Calcula o índice de força relativa (RSI)
function calculateRSI() {
  if (tradeState.closingPrices.length < config.RSI_PERIOD) return;

  const recentCloses = tradeState.closingPrices.slice(-config.RSI_PERIOD);
  const gains = recentCloses.slice(1).reduce((acc, close, i) => acc + Math.max(0, close - recentCloses[i]), 0) / config.RSI_PERIOD;
  const losses = recentCloses.slice(1).reduce((acc, close, i) => acc + Math.max(0, recentCloses[i] - close), 0) / config.RSI_PERIOD;

  const rs = gains / losses;
  tradeState.rsi = 100 - (100 / (1 + rs));
}

// Calcula as bandas de Bollinger
function calculateBollingerBands() {
  if (tradeState.closingPrices.length < config.BB_PERIOD) return;

  const recentCloses = tradeState.closingPrices.slice(-config.BB_PERIOD);
  const sma = recentCloses.reduce((acc, curr) => acc + curr, 0) / config.BB_PERIOD;
  const variance = recentCloses.reduce((acc, curr) => acc + Math.pow(curr - sma, 2), 0) / config.BB_PERIOD;
  const standardDeviation = Math.sqrt(variance);
  tradeState.bbUpper = sma + (2 * standardDeviation);
  tradeState.bbLower = sma - (2 * standardDeviation);
}

// Calcula o indicador MACD
function calculateMACD() {
  if (tradeState.closingPrices.length < config.MACD_LONG_PERIOD) return;

  const emaShort = calculateEMA(tradeState.closingPrices, config.MACD_SHORT_PERIOD);
  const emaLong = calculateEMA(tradeState.closingPrices, config.MACD_LONG_PERIOD);
  tradeState.macd = emaShort - emaLong;

  if (tradeState.closingPrices.length >= config.MACD_LONG_PERIOD + config.MACD_SIGNAL_PERIOD - 1) {
    const macdArray = tradeState.closingPrices.slice(config.MACD_LONG_PERIOD - config.MACD_SHORT_PERIOD).map((_, index, array) => {
      const shortEma = calculateEMA(array.slice(0, index + config.MACD_SHORT_PERIOD), config.MACD_SHORT_PERIOD);
      const longEma = calculateEMA(array.slice(0, index + config.MACD_SHORT_PERIOD), config.MACD_LONG_PERIOD);
      return shortEma - longEma;
    });
    tradeState.macdSignal = calculateEMA(macdArray, config.MACD_SIGNAL_PERIOD);
  }
}

// Calcula a média exponencial móvel (EMA)
function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((acc, curr) => acc + curr, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = (data[i] * k) + (ema * (1 - k));
  }
  return ema;
}

// Calcula a média de volume para um determinado período
function averageVolume(volumeArray, period) {
  if (volumeArray.length < period) return 0;
  const recentVolume = volumeArray.slice(-period);
  return recentVolume.reduce((acc, curr) => acc + curr, 0) / period;
}



// Salva os dados de negociação em um arquivo de texto
function salvarDadosNoTxt(dados) {
  const dataFormatada = new Date().toISOString();
  const linha = `${dataFormatada}: ${dados}\n`;

  fs.appendFile('dados_bot.txt', linha, (erro) => {
    if (erro) {
      console.error('\x1b[31mErro\x1b[0m ao salvar dados no arquivo TXT:', erro);
    }
  });
}

// Adicione esta variável fora da função para manter o controle
let indicatorsInitialized = false;
let isIndicatorsInitializationAttempted = false;

// Inicializa os indicadores técnicos com dados históricos
async function initializeIndicators(symbol) {
  try {
    await calculatePivotPoints(symbol);
    const historicalData = await binance.futuresCandles(symbol, '15m', { limit: Math.max(config.RSI_PERIOD, config.BB_PERIOD, config.MACD_LONG_PERIOD) + 1 });
    tradeState.closingPrices = historicalData.map(data => parseFloat(data[4]));
    tradeState.volume = historicalData.map(data => parseFloat(data[5]));
    calculateRSI();
    calculateBollingerBands();
    calculateMACD();

    // Verifique se os indicadores já foram inicializados
    if (!indicatorsInitialized) {
      console.log("Indicadores calculados e monitoramento \x1b[32mOK\x1b[0m.");
      console.log("Executando estratégia...");
      indicatorsInitialized = true; // Evita que a mensagem seja impressa novamente
    }

  } catch (error) {
    console.error("\x1b[31mErro\x1b[0m ao inicializar os indicadores:", error);
    setTimeout(() => initializeIndicators(symbol), 10000);
  }
}


// Definição de variáveis para controle de taxa de requisições
let lastRequestTime = 0;
const REQUEST_INTERVAL = 1000; // Intervalo mínimo entre requisições em milissegundos
const MAX_BUY_COUNT = 1; // Limite máximo de compras
let buyCount = 0; // Contador de compras
// Envia uma nova ordem de negociação para a Binance
async function newOrder(quantity, side, price, attempts = 3) {
  try {
    const currentTime = Date.now();
    const timeElapsed = currentTime - lastRequestTime;
    const waitTime = Math.max(0, REQUEST_INTERVAL - timeElapsed);

    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    //console.log(`Enviando ordem de ${side}: Quantidade - ${quantity}, Preço - $:${price}`);
    const data = {
      symbol: process.env.SYMBOL,
      type: 'LIMIT',
      side,
      quantity,
      price,
      timeInForce: 'GTC'
    };

    const timestamp = Date.now();
    const recvWindow = 4000;

    const signature = crypto
      .createHmac('sha256', process.env.SECRET_KEY)
      .update(`${new URLSearchParams({ ...data, timestamp, recvWindow })}`)
      .digest('hex');

    const newData = { ...data, timestamp, recvWindow, signature };
    const qs = `?${new URLSearchParams(newData)}`;

    const result = await axios({
      method: 'POST',
      url: `${process.env.API_URL}/v3/order${qs}`,
      headers: { 'X-MBX-APIKEY': process.env.API_KEY }
    });

   lastRequestTime = Date.now(); // Atualiza o tempo da última requisição
    if (attempts === 3 || attempts === 1) { // Modificação: Exibe o log apenas na primeira tentativa ou na última tentativa
      console.log(`Ordem de ${side} executada: Quantidade - ${quantity}, Preço - $:${price}`);
    }
    return result.data;
  } catch (err) {
    console.error(`Erro ao executar a ordem ${side}:`, err);
    if (attempts > 1) {
      console.log(`Tentando novamente... (${attempts - 1} tentativas restantes)`);
      return newOrder(quantity, side, price, attempts - 1);
    } else {
      console.log('Número máximo de tentativas atingido. A ordem \x1b[31mfalhou\x1b[0m.');
      throw err;
    }
  }
}

let ws;
let reconnectAttempts = 0;
let isConnected = false; // Adiciona uma flag para controlar o estado da conexão
const BUY_CONDITIONS_COUNT = 3; // Número mínimo de condições de compra que devem ser verdadeiras
const SELL_CONDITIONS_COUNT = 3; // Número mínimo de condições de venda que devem ser verdadeiras
const CONSECUTIVE_COUNT = 10; // Número de vezes consecutivas que as condições devem ser verdadeiras
let buyConditionsTrueCount = 0; // Contador para as condições de compra verdadeiras consecutivas
let sellConditionsTrueCount = 0; // Contador para as condições de venda verdadeiras consecutivas
let isOrderExecuted = false; // Indica se uma ordem foi executada
let buyOrderSent = false;
async function connectWebSocket() {
    if (isConnected) return; // Se já estiver conectado, não tenta reconectar
    ws = new WebSocket(`${process.env.STREAM_URL}/${process.env.SYMBOL.toLowerCase()}@kline_15m`);

    ws.onopen = async () => {
        console.log('Conexão WebSocket estabelecida com \x1b[32msucesso\x1b[0m.');
        reconnectAttempts = 0;
        isConnected = true; // Define a flag como true quando a conexão é estabelecida
    };

    ws.onerror = (error) => {
        console.error('\x1b[31mErro\x1b[0m na conexão WebSocket:', error.message);
        if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
            console.log('Tentando reconectar...');
            ws.close();
            reconnectAttempts = (reconnectAttempts + 1) % 5; // Reinicia a contagem a cada 5 tentativas
            setTimeout(connectWebSocket, 10000);
        } else {
            console.error('\x1b[31mErro\x1b[0m desconhecido na conexão WebSocket.');
        }
    };

    // Função que é chamada sempre que uma mensagem é recebida do WebSocket
    ws.onmessage = async (event) => {
        try {
            // Analisa o JSON recebido do WebSocket
            const obj = JSON.parse(event.data);

            // Extrai o preço atual e o volume da vela (kline)
            const kline = obj.k;
            const currentPrice = parseFloat(kline.c);
            const currentVolume = parseFloat(kline.v);

            // Atualiza os arrays de preços de fechamento e volume com os dados mais recentes
            tradeState.closingPrices.push(currentPrice);
            tradeState.volume.push(currentVolume);

            // Verifica se os indicadores já foram inicializados
            if (!indicatorsInitialized && !isIndicatorsInitializationAttempted) {
                isIndicatorsInitializationAttempted = true; // Marca que a inicialização dos indicadores foi tentada
                await initializeIndicators(process.env.SYMBOL); // Inicializa os indicadores
            }

            // Calcula os indicadores técnicos
            calculateRSI();
            calculateBollingerBands();
            calculateMACD();
            const emaPeriod = 10; // Define o período desejado para a EMA
            const ema = calculateEMA(tradeState.closingPrices, emaPeriod); // Calcula a EMA

            // Verifica se os indicadores estão prontos para uso
            if (tradeState.rsi !== null && tradeState.bbUpper !== null && tradeState.bbLower !== null && tradeState.macd !== null && tradeState.macdSignal !== null) {
              // Verifica se o bot não está comprando e o número de compras é menor que o limite máximo
              if (!tradeState.isBuying && buyCount < MAX_BUY_COUNT) {
                  // Avalia as condições de compra
                  const buyConditionsMet = [
                      tradeState.rsi <= config.RSI_OVERSOLD + config.RSI_BUFFER,
                      currentPrice < tradeState.bbLower,
                      tradeState.macd < tradeState.macdSignal,
                      currentVolume > averageVolume(tradeState.volume, 15),
                      currentPrice > ema
                  ].filter(condition => condition).length >= BUY_CONDITIONS_COUNT;

                  // Atualiza o contador de condições de compra verdadeiras
                  buyConditionsTrueCount = buyConditionsMet ? buyConditionsTrueCount + 1 : 0;
                  console.log(`Contador de Condições de Compra: ${buyConditionsTrueCount}`);

                  // Verifica se as condições de compra foram atendidas pelo número necessário de vezes consecutivas
                  if (buyConditionsTrueCount >= CONSECUTIVE_COUNT && !isOrderExecuted && !buyOrderSent) {
                    // Executa a ordem de compra
                    tradeState.buyPrice = currentPrice * (1 - config.BUY_DISCOUNT); // Define o preço de compra
                    tradeState.isBuying = true; // Marca que o bot está em uma posição de compra
                    if (!isOrderExecuted) { // Verifica se a ordem ainda não foi executada
                        console.log(`Enviando ordem de BUY: Quantidade - ${config.POSITION_SIZE}, Preço - $:${tradeState.buyPrice.toFixed(2)}`);
                        await newOrder(config.POSITION_SIZE, "BUY", currentPrice); // Executa a ordem de compra
                        console.log(`Ordem de BUY executada: Quantidade - ${config.POSITION_SIZE}, Preço Total - $:${(tradeState.buyPrice * config.POSITION_SIZE).toFixed(2)}`);
                        isOrderExecuted = true; // Marca que a ordem foi executada
                    }
                    tradeState.sellPrice = currentPrice * (1 + config.PROFITABILITY); // Define o preço de venda com base na rentabilidade desejada
                    tradeState.stopLossPrice = currentPrice * (1 - config.STOP_LOSS_PERCENT / 100); // Define o preço de stop loss
                    buyCount++; // Incrementa o contador de compras
                    buyConditionsTrueCount = 0; // Reinicia o contador de condições de compra verdadeiras
                    console.log(`Compra executada com sucesso. Quantidade: ${config.POSITION_SIZE}, Preço Total Pago: $:${(tradeState.buyPrice * config.POSITION_SIZE).toFixed(2)}`);
                  }
              }

              // Verifica se uma ordem de compra foi executada
              if (isOrderExecuted) {
                  // Avalia as condições de venda
                  const sellConditionsMet = [
                      tradeState.rsi >= config.RSI_OVERBOUGHT - config.RSI_BUFFER,
                      currentPrice > tradeState.bbUpper,
                      tradeState.macd > tradeState.macdSignal,
                      currentVolume > averageVolume(tradeState.volume, 20),
                      currentPrice < ema
                  ].filter(condition => condition).length >= SELL_CONDITIONS_COUNT;

                  // Atualiza o contador de condições de venda verdadeiras
                  sellConditionsTrueCount = sellConditionsMet ? sellConditionsTrueCount + 1 : 0;
                  console.log(`Contador de Condições de Venda: ${sellConditionsTrueCount}`);

                  // Verifica se as condições de venda foram atendidas pelo número necessário de vezes consecutivas
                  if (sellConditionsTrueCount >= CONSECUTIVE_COUNT || currentPrice <= tradeState.buyPrice * 0.98) {
                      // Executa a ordem de venda
                      const executedSellPrice = currentPrice; 
                      await newOrder(config.POSITION_SIZE, "SELL", executedSellPrice); // Executa a ordem de venda
                      const profitOrLoss = (executedSellPrice - tradeState.buyPrice) * config.POSITION_SIZE;
                      console.log(`Venda executada: Quantidade - ${config.POSITION_SIZE}, Preço Total de Venda - $:${(executedSellPrice * config.POSITION_SIZE).toFixed(2)}. ${(profitOrLoss > 0) ? "\x1b[32mLucro\x1b[0m" : "\x1b[31mPrejuízo\x1b[0m"}: $:${profitOrLoss.toFixed(2)}`);
                      tradeState.sellPrice = 0; // Reinicia o preço de venda
                      tradeState.stopLossPrice = 0; // Reinicia o preço de stop loss
                      tradeState.isBuying = false; // Marca que o bot não está mais em uma posição de compra
                      isOrderExecuted = false; // Marca que a ordem de venda foi executada
                      buyCount = 0; // Reinicia o contador de compras
                      sellConditionsTrueCount = 0; // Reinicia o contador de condições de venda verdadeiras
                      buyOrderSent = false;
                      console.log("Venda executada com sucesso. Preço de venda: $:" + executedSellPrice.toFixed(2));
                  } else if (!sellConditionsMet) {
                      console.log("Condições de venda não atendidas. Contador reiniciado.");
                  }
              }

              // Atualiza o stop loss de acordo com o trailing stop loss, se necessário
              if (isOrderExecuted && currentPrice > tradeState.buyPrice) {
                  tradeState.stopLossPrice = calculateTrailingStopLoss(currentPrice, tradeState.buyPrice);
              }
            }
        } catch (error) {
            console.error("Erro ao processar mensagem:", error);
            isIndicatorsInitializationAttempted = false;
        }
    };
  
  ws.onclose = () => {
    console.log("Conexão WebSocket \x1b[31mfechada\x1b[0m. Tentando reconectar...");
    isConnected = false; // Define a flag como false quando a conexão é fechada
    setTimeout(connectWebSocket, 10000 * (reconnectAttempts + 1));
    reconnectAttempts++;
  };
}

connectWebSocket();
console.log("Nostradamus \x1b[32miniciado\x1b[0m. Aguardando dados...");

// Função para encerrar o programa de forma suave
function gracefulShutdown() {
  console.log("Encerrando o bot de negociação de criptomoedas...");

  // Fechar a conexão WebSocket
  if (ws) {
      console.log("Fechando conexão WebSocket...");
      ws.close();
  }

  // Realizar outras limpezas necessárias

  // Encerrar o processo
  process.exit(0);
}

// Escutar por sinais de interrupção (SIGINT) como CTRL+C
process.on('SIGINT', gracefulShutdown);


