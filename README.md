Nostradamus: Bot de Negociação de Criptomoedas

Nostradamus é um bot de negociação de criptomoedas automatizado que utiliza indicadores técnicos para tomar decisões de compra e venda no mercado. Ele foi desenvolvido para operar na plataforma Binance e pode ser personalizado para atender a diferentes estratégias de negociação.

Características:

Utiliza a API da Binance para obter dados do mercado e enviar ordens de negociação.
Calcula indicadores técnicos como RSI (Índice de Força Relativa), Bandas de Bollinger e MACD (Convergência/Divergência das Médias Móveis) para análise de mercado.

Implementa um sistema de stop loss e trailing stop loss para gerenciamento de riscos.

Registra dados de negociação em um arquivo de texto para análise posterior.

Reage automaticamente a sinais de compra e venda com base nas condições definidas nos indicadores técnicos.

Configuração:

Clone o repositório do bot para o seu ambiente local.

Instale as dependências necessárias usando o comando npm install.

Crie um arquivo .env na raiz do projeto e adicione suas chaves API e Secret da Binance, bem como outras configurações do bot:

makefile
Copy code
API_KEY=sua_chave_api_binance
SECRET_KEY=sua_chave_secreta_binance
PROFITABILITY=0.01
BUY_DISCOUNT=0.01
Ajuste as configurações do bot no arquivo index.js conforme necessário, incluindo parâmetros de indicadores técnicos e tamanho da posição.

Execução:

Para iniciar o bot, execute o seguinte comando no terminal:

bash
Copy code
node index.js

O bot começará a monitorar o mercado e executará ordens de compra e venda com base nos sinais gerados pelos indicadores técnicos.

ATENÇÃO:

O uso de bots de negociação envolve riscos. É importante testar a estratégia em um ambiente de sandbox ou com quantidades pequenas antes de operar com capital significativo.

Certifique-se de entender como os indicadores técnicos funcionam e como eles influenciam as decisões de negociação do bot.

Monitore regularmente o desempenho do bot e faça ajustes conforme necessário para otimizar a estratégia de negociação.