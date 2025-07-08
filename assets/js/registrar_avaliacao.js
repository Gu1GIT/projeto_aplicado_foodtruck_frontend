// public/chapeiro/avaliar_pedidos.js
// Lógica para atribuir/editar notas de pedidos e exibir ranking de produtos.

// --- Constantes para Mensagens e URLs ---
const MENSAGENS_AVALIAR = {
    AUTENTICACAO_NECESSARIA: 'Você precisa estar logado para acessar esta página.',
    SESSAO_EXPIRADA: 'Sessão expirada ou acesso negado. Faça login novamente.',
    ERRO_CONFIGURACAO_API: 'Erro de configuração: API_BASE_URL não encontrada.',
    ERRO_CARREGAR_PEDIDOS_AVALIAR: 'Erro ao carregar pedidos para avaliação:',
    NENHUM_PEDIDO_AVALIAR: 'Nenhum pedido concluído disponível para avaliação no momento.',
    ERRO_CARREGAR_PEDIDOS_AVALIADOS: 'Erro ao carregar pedidos já avaliados:',
    NENHUM_PEDIDO_AVALIADO: 'Nenhum pedido foi avaliado ainda.',
    ERRO_ATRIBUIR_NOTA: 'Erro ao atribuir/atualizar nota do pedido:',
    NOTA_SUCESSO: (locator) => `Nota de #${locator} atualizada com sucesso!`,
    ERRO_CONEXAO_SERVIDOR: 'Não foi possível conectar ao servidor.',
    ERRO_CARREGAR_PRODUTOS: 'Erro ao carregar produtos para ranking:',
    ERRO_CARREGAR_PEDIDOS_RANKING: 'Erro ao carregar pedidos para ranking:',
};

const URLS_AVALIAR = {
    LOGIN: '../index.html'
};

// --- Referências Globais para os Elementos DOM ---
let logoutBtn;

// Elementos da seção "Avaliar Novos Pedidos Concluídos"
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

// Elementos da seção "Pedidos Já Avaliados"
let evaluatedOrdersLoading;
let noEvaluatedOrdersMessage;
let evaluatedOrdersList;

// Elementos da seção "Ranking de Produtos"
let rankingLoadingMessage;
let noRankingMessage;
let rankingTable;
let rankingTableBody;

// Variáveis globais para dados
let currentSelectedOrderId = null; // Armazena o ID do pedido atualmente selecionado para atribuição de nota
let currentSelectedOrderLocator = null; // Armazena o localizador do pedido atualmente selecionado
let productsCache = new Map(); // Cache para armazenar ID do produto -> Nome do produto
let allOrdersDataForRanking = []; // Para armazenar todos os pedidos para o ranking

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
 * Exibe uma mensagem na tela (sucesso/erro) na seção de avaliação de novos pedidos.
 * @param {string} msg A mensagem a ser exibida.
 * @param {string} type O tipo de mensagem ('success' ou 'error').
 */
const showMainEvaluationMessage = (msg, type) => {
    evaluationMessage.textContent = msg;
    evaluationMessage.className = `message ${type}`;
    evaluationMessage.style.display = 'block';
};

const clearMainEvaluationMessage = () => {
    evaluationMessage.style.display = 'none';
    evaluationMessage.textContent = '';
    evaluationMessage.className = 'message';
};

/**
 * Exibe uma mensagem dentro de um card de pedido avaliado.
 * @param {HTMLElement} cardElement O elemento do card onde a mensagem será exibida.
 * @param {string} msg A mensagem a ser exibida.
 * @param {string} type O tipo de mensagem ('success' ou 'error').
 */
const showCardMessage = (cardElement, msg, type) => {
    let msgElement = cardElement.querySelector('.card-message');
    if (!msgElement) {
        msgElement = document.createElement('p');
        msgElement.className = 'message card-message';
        cardElement.appendChild(msgElement);
    }
    msgElement.textContent = msg;
    msgElement.className = `message card-message ${type}`;
    msgElement.style.display = 'block';
};

const clearCardMessage = (cardElement) => {
    const msgElement = cardElement.querySelector('.card-message');
    if (msgElement) {
        msgElement.style.display = 'none';
        msgElement.textContent = '';
        msgElement.className = 'message card-message';
    }
};

/**
 * Gera a lista de produtos para exibir dentro de um card de pedido.
 * @param {Array} products Array de objetos de produto do pedido (ex: [{product_id: 'abc', quantity: 1}]).
 * @returns {string} HTML formatado da lista de produtos.
 */
function renderOrderProducts(products) {
    if (!products || products.length === 0) {
        return '<p>Nenhum produto listado.</p>';
    }
    const productItems = products.map(item => {
        const productName = productsCache.get(item.product_id) || `Produto Desconhecido (ID: ${item.product_id})`;
        return `<li>${item.quantity}x ${productName}</li>`;
    }).join('');
    return `<ul class="order-products-list">${productItems}</ul>`;
}

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
 * Carrega e exibe todos os pedidos concluídos que **ainda não foram avaliados**.
 */
async function carregarPedidosParaAvaliar() {
    evalOrdersLoading.style.display = 'block';
    noEvalOrdersMessage.style.display = 'none';
    ordersToEvaluateList.innerHTML = ''; // Limpa a lista existente
    ratingInputCard.style.display = 'none'; // Esconde o card de input de nota
    clearMainEvaluationMessage();

    try {
        const queryParams = new URLSearchParams();
        queryParams.append('status', 'COMPLETED'); // Apenas pedidos concluídos
        queryParams.append('limit', 500); 

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
            // Filtra localmente para pegar apenas pedidos COMPLETED que ainda não têm nota
            const pedidosSemNota = resultado.orders.filter(order => 
                order.status.toUpperCase() === 'COMPLETED' && (order.rating === undefined || order.rating === null)
            );
            
            if (pedidosSemNota.length === 0) {
                noEvalOrdersMessage.style.display = 'block';
            } else {
                pedidosSemNota.forEach(pedido => {
                    const orderCard = document.createElement('div');
                    orderCard.className = 'order-to-evaluate-card';
                    orderCard.dataset.orderId = pedido.id; 
                    orderCard.innerHTML = `
                        <h4>Pedido: ${pedido.locator}</h4>
                        <p>Total: <strong>R$ ${pedido.total ? pedido.total.toFixed(2) : '0.00'}</strong></p>
                        <p>Criado em: <strong>${formatarDataCriacao(pedido.created_at)}</strong></p>
                        ${renderOrderProducts(pedido.products)} `;
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
 * Seleciona um pedido para avaliação (primeira vez), exibe seus detalhes e prepara o formulário.
 * @param {object} pedido - O objeto do pedido a ser avaliado.
 */
function selectOrderForRating(pedido) {
    // Remove a classe 'selected' de todos os cards de "novos pedidos"
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
    selectedOrderStatus.textContent = pedido.status.toUpperCase(); // Pode remover isso se quiser, já que são sempre COMPLETED
    selectedOrderTotal.textContent = pedido.total ? pedido.total.toFixed(2) : '0.00';
    selectedOrderCreatedAt.textContent = formatarDataCriacao(pedido.created_at);
    
    orderRatingInput.value = ''; // Limpa o campo de nota para nova avaliação
    ratingInputCard.style.display = 'block'; // Mostra o card de input de nota
    submitRatingBtn.disabled = false;
    clearMainEvaluationMessage();
}

/**
 * Atribui/Atualiza uma nota a um pedido.
 * Esta função agora é genérica para atribuir ou editar.
 * @param {string} orderId O ID do pedido.
 * @param {string} orderLocator O localizador do pedido.
 * @param {number} rating A nota a ser atribuída.
 * @param {HTMLElement} [messageElement] Elemento HTML para exibir a mensagem (opcional, para cards individuais).
 */
async function updateOrderRating(orderId, orderLocator, rating, messageElement = null) {
    clearMainEvaluationMessage(); // Limpa a mensagem principal
    if (messageElement) clearCardMessage(messageElement.closest('.evaluated-order-card')); // Limpa mensagem do card se houver

    if (isNaN(rating) || rating < 0 || rating > 5) {
        if (messageElement) {
            showCardMessage(messageElement.closest('.evaluated-order-card'), 'Nota inválida (0-5).', 'error');
        } else {
            showMainEvaluationMessage('Por favor, insira uma nota válida entre 0 e 5.', 'error');
        }
        return false;
    }

    try {
        const resposta = await fetch(`${API_BASE_URL}/api/v1/orders/${orderId}`, {
            method: 'PATCH', // PATCH para atualizar apenas o campo 'rating'
            headers: {
                'Authorization': `Bearer ${obterTokenAcesso()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ rating: rating }),
        });

        if (lidarComErroAutenticacao(resposta)) return false;

        const resultado = await resposta.json();

        if (resposta.ok) {
            if (messageElement) {
                showCardMessage(messageElement.closest('.evaluated-order-card'), MENSAGENS_AVALIAR.NOTA_SUCESSO(orderLocator), 'success');
            } else {
                showMainEvaluationMessage(MENSAGENS_AVALIAR.NOTA_SUCESSO(orderLocator), 'success');
            }
            
            // Após a avaliação/edição, recarrega ambas as listas de pedidos e o ranking
            await carregarPedidosParaAvaliar(); 
            await carregarPedidosAvaliados();
            await carregarTodosPedidosParaRanking(); // Recarrega os dados completos para o ranking
            calcularEExibirRanking();

            // Reseta a interface de nova avaliação se foi de lá que veio a chamada
            if (!messageElement) { 
                ratingInputCard.style.display = 'none';
                orderRatingInput.value = '';
                currentSelectedOrderId = null;
                currentSelectedOrderLocator = null;
            }
            return true;
        } else {
            const errorMsg = `${MENSAGENS_AVALIAR.ERRO_ATRIBUIR_NOTA} ${resultado.detail || resultado.message || resposta.statusText}`;
            if (messageElement) {
                showCardMessage(messageElement.closest('.evaluated-order-card'), errorMsg, 'error');
            } else {
                showMainEvaluationMessage(errorMsg, 'error');
            }
            console.error('Erro ao atribuir nota:', resultado);
            return false;
        }
    } catch (error) {
        console.error('Erro na requisição de atribuição de nota:', error);
        if (messageElement) {
            showCardMessage(messageElement.closest('.evaluated-order-card'), MENSAGENS_AVALIAR.ERRO_CONEXAO_SERVIDOR, 'error');
        } else {
            showMainEvaluationMessage(MENSAGENS_AVALIAR.ERRO_CONEXAO_SERVIDOR, 'error');
        }
        return false;
    }
}

// Event listener para o botão de atribuir nota na seção de novos pedidos
async function handleSubmitNewRating() {
    await updateOrderRating(currentSelectedOrderId, currentSelectedOrderLocator, parseFloat(orderRatingInput.value));
}


/**
 * Carrega e exibe todos os pedidos concluídos que **já foram avaliados**.
 */
async function carregarPedidosAvaliados() {
    evaluatedOrdersLoading.style.display = 'block';
    noEvaluatedOrdersMessage.style.display = 'none';
    evaluatedOrdersList.innerHTML = ''; // Limpa a lista existente

    try {
        const queryParams = new URLSearchParams();
        queryParams.append('status', 'COMPLETED'); // Apenas pedidos concluídos
        queryParams.append('limit', 500); 

        const resposta = await fetch(`${API_BASE_URL}/api/v1/orders/?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${obterTokenAcesso()}`,
                'Accept': 'application/json'
            }
        });

        if (lidarComErroAutenticacao(resposta)) {
            evaluatedOrdersLoading.style.display = 'none';
            return;
        }

        const resultado = await resposta.json();

        if (resposta.ok && resultado.orders) {
            // Filtra localmente para pegar apenas pedidos COMPLETED que já têm nota
            const pedidosComNota = resultado.orders.filter(order => 
                order.status.toUpperCase() === 'COMPLETED' && (order.rating !== undefined && order.rating !== null)
            );
            
            if (pedidosComNota.length === 0) {
                noEvaluatedOrdersMessage.style.display = 'block';
            } else {
                pedidosComNota.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Ordena pelos mais recentes
                pedidosComNota.forEach(pedido => {
                    const orderCard = document.createElement('div');
                    orderCard.className = 'evaluated-order-card';
                    orderCard.dataset.orderId = pedido.id; 
                    orderCard.innerHTML = `
                        <h4>Pedido: ${pedido.locator}</h4>
                        <p>Total: <strong>R$ ${pedido.total ? pedido.total.toFixed(2) : '0.00'}</strong></p>
                        <p>Criado em: <strong>${formatarDataCriacao(pedido.created_at)}</strong></p>
                        ${renderOrderProducts(pedido.products)} <div class="current-rating">Nota Atual: <strong>${pedido.rating.toFixed(1)}</strong></div>
                        <div class="rating-edit-group">
                            <label for="editRating-${pedido.id}">Nova Nota:</label>
                            <input type="number" id="editRating-${pedido.id}" min="0" max="5" step="0.5" value="${pedido.rating}">
                            <button class="btn-secondary update-evaluated-rating-btn" data-order-id="${pedido.id}" data-order-locator="${pedido.locator}">Atualizar</button>
                        </div>
                    `;
                    evaluatedOrdersList.appendChild(orderCard);
                });

                // Adiciona event listeners aos botões de atualização dos pedidos avaliados
                document.querySelectorAll('.update-evaluated-rating-btn').forEach(button => {
                    button.addEventListener('click', async (event) => {
                        const orderId = event.target.dataset.orderId;
                        const orderLocator = event.target.dataset.orderLocator;
                        const ratingInput = document.getElementById(`editRating-${orderId}`);
                        const newRating = parseFloat(ratingInput.value);
                        await updateOrderRating(orderId, orderLocator, newRating, event.target); // Passa o elemento para showCardMessage
                    });
                });
            }
        } else {
            console.error(MENSAGENS_AVALIAR.ERRO_CARREGAR_PEDIDOS_AVALIADOS, resultado.detail || resultado.message || resposta.statusText);
            noEvaluatedOrdersMessage.textContent = MENSAGENS_AVALIAR.ERRO_CARREGAR_PEDIDOS_AVALIADOS + ' ' + (resultado.detail || resposta.statusText);
            noEvaluatedOrdersMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro na requisição de pedidos avaliados:', error);
        noEvaluatedOrdersMessage.textContent = MENSAGENS_AVALIAR.ERRO_CONEXAO_SERVIDOR;
        noEvaluatedOrdersMessage.style.display = 'block';
    } finally {
        evaluatedOrdersLoading.style.display = 'none';
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

    // Seção de Avaliar Novos Pedidos
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

    // Seção de Pedidos Já Avaliados
    evaluatedOrdersLoading = document.getElementById('evaluatedOrdersLoading');
    noEvaluatedOrdersMessage = document.getElementById('noEvaluatedOrdersMessage');
    evaluatedOrdersList = document.getElementById('evaluatedOrdersList');

    // Seção de Ranking
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
        submitRatingBtn.addEventListener('click', handleSubmitNewRating);
    }
    
    // --- Carregamento Inicial de Dados ---
    await carregarProdutos(); // Essencial para o ranking E para exibir nomes dos produtos nos pedidos
    await carregarPedidosParaAvaliar(); // Preenche a lista de pedidos SEM NOTA
    await carregarPedidosAvaliados(); // Preenche a lista de pedidos COM NOTA
    await carregarTodosPedidosParaRanking(); // Preenche os dados completos para o ranking

    // Após carregar os dados, calcula e exibe o ranking
    if (productsCache.size > 0 && allOrdersDataForRanking.length > 0) {
        calcularEExibirRanking();
    } else {
        noRankingMessage.style.display = 'block';
    }
});