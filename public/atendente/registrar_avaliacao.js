// public/chapeiro/avaliar_pedidos.js
// Lógica para atribuir notas a pedidos e exibir ranking de produtos.

// --- Constantes para Mensagens e URLs ---
const MENSAGENS_AVALIAR = {
    AUTENTICACAO_NECESSARIA: 'Você precisa estar logado para acessar esta página.',
    SESSAO_EXPIRADA: 'Sessão expirada ou acesso negado. Faça login novamente.',
    ERRO_CONFIGURACAO_API: 'Erro de configuração: API_BASE_URL não encontrada.',
    ERRO_CARREGAR_PEDIDOS_AVALIAR: 'Erro ao carregar pedidos para avaliação:',
    NENHUM_PEDIDO_AVALIAR: 'Nenhum pedido concluído disponível para avaliação no momento.',
    ERRO_ATRIBUIR_NOTA: 'Erro ao atribuir nota ao pedido:',
    NOTA_SUCESSO: (locator) => `Nota atribuída com sucesso ao pedido #${locator}!`,
    ERRO_CONEXAO_SERVIDOR: 'Não foi possível conectar ao servidor.',
    ERRO_CARREGAR_PRODUTOS: 'Erro ao carregar produtos para ranking:',
    ERRO_CARREGAR_PEDIDOS_RANKING: 'Erro ao carregar pedidos para ranking:',
};

const URLS_AVALIAR = {
    LOGIN: '../index.html'
};

// --- Referências Globais para os Elementos DOM ---
let logoutBtn;

let evalOrdersLoading;
let noEvalOrdersMessage;
let ordersToEvaluateList;
let ratingInputCard;
let selectedOrderLocator;
let selectedOrderStatus;
let selectedOrderTotal;
let selectedOrderCreatedAt;
let orderRatingInput;
let submitRatingBtn;
let evaluationMessage;

let rankingLoadingMessage;
let noRankingMessage;
let rankingTable;
let rankingTableBody;

// Variáveis globais para dados
let currentSelectedOrderId = null; // Armazena o ID do pedido atualmente selecionado para avaliação
let currentSelectedOrderLocator = null; // Armazena o localizador do pedido atualmente selecionado
let productsCache = new Map(); // Cache para armazenar ID do produto -> Nome do produto
let allOrdersDataForRanking = []; // Para armazenar todos os pedidos para o ranking
let ordersToEvaluate = []; // Lista de pedidos COMPLETED para exibir e avaliar

// --- Funções Auxiliares ---
const obterTokenAcesso = () => localStorage.getItem('accessToken');

const removerDadosSessao = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentOrder');
};

const redirecionarParaLogin = () => {
    window.location.href = URLS_AVALIAR.LOGIN;
};

function lidarComErroAutenticacao(resposta) {
    if (resposta.status === 401 || resposta.status === 403) {
        alert(MENSAGENS_AVALIAR.SESSAO_EXPIRADA);
        removerDadosSessao();
        redirecionarParaLogin();
        return true;
    }
    return false;
}

// Adaptação da função de formatação de data para GMT-6
const formatarDataCriacao = (dataString) => {
    let dataParaParsear = dataString;
    if (!dataString.endsWith('Z') && !dataString.includes('+') && !dataString.includes('-')) {
        dataParaParsear = dataString + 'Z';
    }
    const dataCriacaoPedido = new Date(dataParaParsear);
    
    return dataCriacaoPedido.toLocaleString('pt-BR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Mexico_City' // GMT-6
    });
};

/**
 * Exibe uma mensagem na tela (sucesso/erro).
 * @param {string} msg A mensagem a ser exibida.
 * @param {string} type O tipo de mensagem ('success' ou 'error').
 */
const showMessage = (msg, type) => {
    evaluationMessage.textContent = msg;
    evaluationMessage.className = `message ${type}`;
    evaluationMessage.style.display = 'block';
};

const clearMessage = () => {
    evaluationMessage.style.display = 'none';
    evaluationMessage.textContent = '';
    evaluationMessage.className = 'message';
};

// --- Funções Principais ---

/**
 * Carrega todos os produtos da API e preenche o productsCache.
 */
async function carregarProdutos() {
    try {
        const resposta = await fetch(`${API_BASE_URL}/api/v1/products/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${obterTokenAcesso()}`,
                'Accept': 'application/json'
            }
        });

        if (lidarComErroAutenticacao(resposta)) {
            return;
        }

        const resultado = await resposta.json();

        if (resposta.ok && resultado.products) {
            productsCache.clear();
            resultado.products.forEach(product => {
                productsCache.set(product.id, product.name);
            });
            console.log('Cache de produtos preenchido:', productsCache);
        } else {
            console.error(MENSAGENS_AVALIAR.ERRO_CARREGAR_PRODUTOS, resultado.detail || resultado.message || resposta.statusText);
        }
    } catch (error) {
        console.error('Erro na requisição de produtos:', error);
    }
}

/**
 * Carrega e exibe todos os pedidos concluídos que podem ser avaliados.
 */
async function carregarPedidosParaAvaliar() {
    evalOrdersLoading.style.display = 'block';
    noEvalOrdersMessage.style.display = 'none';
    ordersToEvaluateList.innerHTML = ''; // Limpa a lista existente
    ratingInputCard.style.display = 'none'; // Esconde o card de input de nota
    clearMessage();

    try {
        const queryParams = new URLSearchParams();
        queryParams.append('status', 'COMPLETED'); // Apenas pedidos concluídos
        queryParams.append('limit', 500); // Exemplo: limite alto para buscar muitos pedidos
        // Opcional: Adicionar filtro para pedidos sem rating? (se sua API suportar)
        // queryParams.append('rating', 'null'); // Se sua API suportar, para pegar apenas não avaliados

        const resposta = await fetch(`${API_BASE_URL}/api/v1/orders/?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${obterTokenAcesso()}`,
                'Accept': 'application/json'
            }
        });

        if (lidarComErroAutenticacao(resposta)) {
            evalOrdersLoading.style.display = 'none';
            return;
        }

        const resultado = await resposta.json();

        if (resposta.ok && resultado.orders) {
            // Filtra localmente se a API não suportar 'rating=null'
            // Mantém apenas pedidos COMPLETED que ainda não têm nota
            ordersToEvaluate = resultado.orders.filter(order => 
                order.status.toUpperCase() === 'COMPLETED' && (order.rating === undefined || order.rating === null)
            );
            
            if (ordersToEvaluate.length === 0) {
                noEvalOrdersMessage.style.display = 'block';
            } else {
                ordersToEvaluate.forEach(pedido => {
                    const orderCard = document.createElement('div');
                    orderCard.className = 'order-to-evaluate-card';
                    orderCard.dataset.orderId = pedido.id; // Armazena o ID no dataset
                    orderCard.innerHTML = `
                        <h4>Pedido: ${pedido.locator}</h4>
                        <p>Status: <strong>${pedido.status.toUpperCase()}</strong></p>
                        <p>Total: <strong>R$ ${pedido.total ? pedido.total.toFixed(2) : '0.00'}</strong></p>
                        <p>Criado em: <strong>${formatarDataCriacao(pedido.created_at)}</strong></p>
                        ${pedido.rating !== undefined && pedido.rating !== null ? `<p>Nota atual: <strong>${pedido.rating}</strong></p>` : ''}
                    `;
                    orderCard.addEventListener('click', () => selectOrderForRating(pedido));
                    ordersToEvaluateList.appendChild(orderCard);
                });
            }
        } else {
            console.error(MENSAGENS_AVALIAR.ERRO_CARREGAR_PEDIDOS_AVALIAR, resultado.detail || resultado.message || resposta.statusText);
            noEvalOrdersMessage.textContent = MENSAGENS_AVALIAR.ERRO_CARREGAR_PEDIDOS_AVALIAR + ' ' + (resultado.detail || resposta.statusText);
            noEvalOrdersMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro na requisição de pedidos para avaliação:', error);
        noEvalOrdersMessage.textContent = MENSAGENS_AVALIAR.ERRO_CONEXAO_SERVIDOR;
        noEvalOrdersMessage.style.display = 'block';
    } finally {
        evalOrdersLoading.style.display = 'none';
    }
}

/**
 * Seleciona um pedido para avaliação, exibe seus detalhes e prepara o formulário.
 * @param {object} pedido - O objeto do pedido a ser avaliado.
 */
function selectOrderForRating(pedido) {
    // Remove a classe 'selected' de todos os cards
    document.querySelectorAll('.order-to-evaluate-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Adiciona a classe 'selected' ao card clicado
    const selectedCard = document.querySelector(`.order-to-evaluate-card[data-order-id="${pedido.id}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }

    currentSelectedOrderId = pedido.id;
    currentSelectedOrderLocator = pedido.locator;
    
    selectedOrderLocator.textContent = pedido.locator;
    selectedOrderStatus.textContent = pedido.status.toUpperCase();
    selectedOrderTotal.textContent = pedido.total ? pedido.total.toFixed(2) : '0.00';
    selectedOrderCreatedAt.textContent = formatarDataCriacao(pedido.created_at);
    
    // Pré-preenche a nota se já existir (e o pedido foi filtrado para ser avaliável)
    orderRatingInput.value = pedido.rating !== undefined && pedido.rating !== null ? pedido.rating : '';

    ratingInputCard.style.display = 'block'; // Mostra o card de input de nota
    submitRatingBtn.disabled = false;
    clearMessage();
}

/**
 * Atribui uma nota a um pedido.
 */
async function submitOrderRating() {
    clearMessage();
    if (!currentSelectedOrderId) {
        showMessage('Nenhum pedido selecionado para avaliação.', 'error');
        return;
    }

    const rating = parseFloat(orderRatingInput.value);
    if (isNaN(rating) || rating < 0 || rating > 5) {
        showMessage('Por favor, insira uma nota válida entre 0 e 5.', 'error');
        return;
    }

    try {
        const resposta = await fetch(`${API_BASE_URL}/api/v1/orders/${currentSelectedOrderId}`, {
            method: 'PATCH', // PATCH para atualizar apenas o campo 'rating'
            headers: {
                'Authorization': `Bearer ${obterTokenAcesso()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ rating: rating }),
        });

        if (lidarComErroAutenticacao(resposta)) return;

        const resultado = await resposta.json();

        if (resposta.ok) {
            showMessage(MENSAGENS_AVALIAR.NOTA_SUCESSO(currentSelectedOrderLocator), 'success');
            // Após a avaliação, recarrega a lista de pedidos avaliáveis
            // e também o ranking para refletir a mudança.
            await carregarPedidosParaAvaliar(); 
            await carregarTodosPedidosParaRanking();
            calcularEExibirRanking();
            // Opcional: Limpar o formulário de avaliação ou escondê-lo após o sucesso
            ratingInputCard.style.display = 'none';
            orderRatingInput.value = '';
            currentSelectedOrderId = null;
            currentSelectedOrderLocator = null;

        } else {
            showMessage(`${MENSAGENS_AVALIAR.ERRO_ATRIBUIR_NOTA} ${resultado.detail || resultado.message || resposta.statusText}`, 'error');
            console.error('Erro ao atribuir nota:', resultado);
        }
    } catch (error) {
        console.error('Erro na requisição de atribuição de nota:', error);
        showMessage(MENSAGENS_AVALIAR.ERRO_CONEXAO_SERVIDOR, 'error');
    }
}

/**
 * Carrega todos os pedidos (especificamente os COMPLETED) para o cálculo do ranking.
 */
async function carregarTodosPedidosParaRanking() {
    rankingLoadingMessage.style.display = 'block';
    noRankingMessage.style.display = 'none';
    rankingTable.style.display = 'none';
    allOrdersDataForRanking = []; // Limpa dados anteriores

    try {
        const queryParams = new URLSearchParams();
        queryParams.append('status', 'COMPLETED'); // Apenas pedidos concluídos para ranking
        queryParams.append('limit', 1000); // Exemplo: limite alto para buscar muitos pedidos

        const resposta = await fetch(`${API_BASE_URL}/api/v1/orders/?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${obterTokenAcesso()}`,
                'Accept': 'application/json'
            }
        });

        if (lidarComErroAutenticacao(resposta)) {
            rankingLoadingMessage.style.display = 'none';
            return;
        }

        const resultado = await resposta.json();

        if (resposta.ok && resultado.orders) {
            allOrdersDataForRanking = resultado.orders;
            console.log('Pedidos carregados para ranking:', allOrdersDataForRanking.length);
        } else {
            console.error(MENSAGENS_AVALIAR.ERRO_CARREGAR_PEDIDOS_RANKING, resultado.detail || resultado.message || resposta.statusText);
            noRankingMessage.textContent = `Erro ao carregar ranking: ${resultado.detail || resultado.message || resposta.statusText}`;
            noRankingMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro na requisição de pedidos para ranking:', error);
        noRankingMessage.textContent = MENSAGENS_AVALIAR.ERRO_CONEXAO_SERVIDOR;
        noRankingMessage.style.display = 'block';
    } finally {
        rankingLoadingMessage.style.display = 'none';
    }
}

/**
 * Calcula e exibe o ranking dos produtos com base nas notas dos pedidos.
 */
function calcularEExibirRanking() {
    rankingTableBody.innerHTML = ''; // Limpa o corpo da tabela

    const productStats = new Map(); // Map: productId -> { totalRating: number, countRating: number, salesCount: number }

    allOrdersDataForRanking.forEach(order => {
        // Apenas pedidos com rating e status CONCLUIDO
        if (order.status.toUpperCase() === 'COMPLETED' && order.rating !== undefined && order.rating !== null) {
            order.products.forEach(item => { // Assume que `order.products` é o array de itens
                const productId = item.product_id;
                
                if (!productStats.has(productId)) {
                    productStats.set(productId, { totalRating: 0, countRating: 0, salesCount: 0 });
                }
                const stats = productStats.get(productId);
                
                stats.totalRating += order.rating;
                stats.countRating++;
                stats.salesCount += item.quantity; // Soma a quantidade vendida de cada item
            });
        }
    });

    if (productStats.size === 0) {
        noRankingMessage.style.display = 'block';
        rankingTable.style.display = 'none';
        return;
    }

    const rankingArray = Array.from(productStats.entries()).map(([productId, stats]) => {
        const productName = productsCache.get(productId) || `Produto Desconhecido (ID: ${productId})`;
        const averageRating = stats.countRating > 0 ? (stats.totalRating / stats.countRating) : 0;
        return {
            productId,
            productName,
            averageRating: parseFloat(averageRating.toFixed(2)), // Formata para 2 casas decimais
            salesCount: stats.salesCount
        };
    });

    // Ordena o ranking: primeiro por média de notas (maior para menor), depois por vendas (maior para menor)
    rankingArray.sort((a, b) => {
        if (b.averageRating !== a.averageRating) {
            return b.averageRating - a.averageRating;
        }
        return b.salesCount - a.salesCount;
    });

    // Preenche a tabela
    rankingArray.forEach(product => {
        const row = rankingTableBody.insertRow();
        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);
        const cell3 = row.insertCell(2);

        cell1.textContent = product.productName;
        cell2.textContent = product.salesCount;
        cell3.textContent = product.averageRating.toFixed(2); // Exibe com 2 casas decimais
    });

    rankingTable.style.display = 'table';
    noRankingMessage.style.display = 'none';
}

// --- Lógica Principal: Executada quando o DOM está completamente carregado ---
document.addEventListener('DOMContentLoaded', async () => {
    // --- Atribuição das Referências DOM ---
    logoutBtn = document.getElementById('logoutBtn');

    evalOrdersLoading = document.getElementById('evalOrdersLoading');
    noEvalOrdersMessage = document.getElementById('noEvalOrdersMessage');
    ordersToEvaluateList = document.getElementById('ordersToEvaluateList');
    ratingInputCard = document.getElementById('ratingInputCard');
    selectedOrderLocator = document.getElementById('selectedOrderLocator');
    selectedOrderStatus = document.getElementById('selectedOrderStatus');
    selectedOrderTotal = document.getElementById('selectedOrderTotal');
    selectedOrderCreatedAt = document.getElementById('selectedOrderCreatedAt');
    orderRatingInput = document.getElementById('orderRatingInput');
    submitRatingBtn = document.getElementById('submitRatingBtn');
    evaluationMessage = document.getElementById('evaluationMessage');

    rankingLoadingMessage = document.getElementById('rankingLoadingMessage');
    noRankingMessage = document.getElementById('noRankingMessage');
    rankingTable = document.getElementById('rankingTable');
    rankingTableBody = document.getElementById('rankingTableBody');

    const accessToken = obterTokenAcesso();

    // --- Validação de Autenticação na Inicialização ---
    if (!accessToken) {
        alert(MENSAGENS_AVALIAR.AUTENTICACAO_NECESSARIA);
        redirecionarParaLogin();
        return;
    }

    // --- Configuração da API_BASE_URL ---
    if (typeof API_BASE_URL === 'undefined') {
        console.error(MENSAGENS_AVALIAR.ERRO_CONFIGURACAO_API.replace('API_BASE_URL não encontrada.', 'API_BASE_URL não está definida. Verifique common.js ou seu escopo.'));
        alert(MENSAGENS_AVALIAR.ERRO_CONFIGURACAO_API);
        return;
    }

    // --- Event Listeners ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (evento) => {
            evento.preventDefault();
            removerDadosSessao();
            redirecionarParaLogin();
        });
    }

    if (submitRatingBtn) {
        submitRatingBtn.addEventListener('click', submitOrderRating);
    }

    // Carrega produtos e pedidos para o ranking e para avaliação na inicialização
    await carregarProdutos(); // Essencial para o ranking
    await carregarPedidosParaAvaliar(); // Preenche a lista de pedidos para avaliar
    await carregarTodosPedidosParaRanking(); // Preenche os dados para o ranking

    if (productsCache.size > 0 && allOrdersDataForRanking.length > 0) {
        calcularEExibirRanking();
    } else {
        noRankingMessage.style.display = 'block';
    }
});