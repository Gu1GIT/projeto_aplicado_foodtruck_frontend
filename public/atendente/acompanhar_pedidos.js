// public/chapeiro/preparar_pedidos.js
// Lógica para carregar pedidos por status em colunas e permitir a mudança de status,
// incluindo filtro por data de criação com um botão de alternância.

// --- Constantes para Status de Pedidos ---
const STATUS_PEDIDO = {
    PENDENTE: 'PENDING',
    EM_PREPARACAO: 'PROCESSING',
    CONCLUIDO: 'COMPLETED',
    CANCELADO: 'CANCELLED'
};

// --- Constantes para Mensagens e URLs ---
const MENSAGENS = {
    AUTENTICACAO_NECESSARIA: 'Você precisa estar logado para acessar esta página.',
    SESSAO_EXPIRADA: 'Sessão expirada ou acesso negado. Faça login novamente.',
    ERRO_CONFIGURACAO_API: 'Erro de configuração: API_BASE_URL não encontrada.',
    ERRO_CARREGAR_PEDIDOS: 'Erro ao carregar pedidos:',
    ERRO_CONEXAO_SERVIDOR: 'Não foi possível conectar ao servidor.',
    CONFIRMACAO_ATUALIZACAO: (locator, novoStatus) => `Deseja realmente mudar o status do pedido #${locator} para "${novoStatus}"?`,
    ERRO_ATUALIZAR_STATUS: 'Erro ao atualizar status do pedido. Verifique as transições permitidas no backend.',
    ERRO_CARREGAR_PRODUTOS: 'Erro ao carregar produtos:'
};

const URLS = {
    LOGIN: '../index.html'
};

// --- Variáveis de Estado Global ---
let isFilteredByToday = true; // Começamos com os pedidos de hoje filtrados por padrão
let productsCache = new Map(); // Cache para armazenar ID do produto -> Nome do produto

// --- Referências Globais para os Elementos DOM ---
// Declaradas aqui para serem acessíveis por todas as funções após o DOM ser carregado.
let pendingOrdersList;
let processingOrdersList;
let completedOrdersList;
let cancelledOrdersList;

let countPending;
let countProcessing;
let countCompleted;
let countCancelled;

let loadingMessage;
let noOrdersMessage;
let logoutBtn;
let toggleFilterBtn; // Nova referência para o botão único de filtro

// --- Funções Auxiliares ---

/**
 * Obtém o token de acesso do localStorage.
 * @returns {string|null} O token de acesso ou null se não existir.
 */
const obterTokenAcesso = () => localStorage.getItem('accessToken');

/**
 * Remove os dados de sessão do localStorage.
 */
const removerDadosSessao = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentOrder');
};

/**
 * Redireciona o usuário para a página de login.
 */
const redirecionarParaLogin = () => {
    window.location.href = URLS.LOGIN;
};

/**
 * Lida com erros de autenticação ou autorização da API, redirecionando para o login se necessário.
 * @param {Response} resposta - A resposta da requisição fetch.
 * @returns {boolean} True se um erro de autenticação/autorização foi tratado, false caso contrário.
 */
function lidarComErroAutenticacao(resposta) {
    if (resposta.status === 401 || resposta.status === 403) {
        alert(MENSAGENS.SESSAO_EXPIRADA);
        removerDadosSessao();
        redirecionarParaLogin();
        return true;
    }
    return false;
}

/**
 * Formata uma string de data ISO para o formato local brasileiro (DD/MM/AAAA HH:MM).
 * @param {string} dataString - A string de data ISO (ex: "2025-06-10T11:01:07.937046").
 * @returns {string} A data formatada.
 */
const formatarDataCriacao = (dataString) => {
    const dataCriacaoPedido = new Date(dataString);
    return dataCriacaoPedido.toLocaleString('pt-BR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Mexico_City' // Fuso horário de Florianópolis
    });
};

/**
 * Gera o HTML para a lista de itens de um pedido.
 * Usa o productsCache para obter o nome do produto.
 * @param {Array<Object>} itensPedido - Um array de objetos de item de pedido.
 * @returns {string} O HTML formatado da lista de itens.
 */
const gerarHtmlItensPedido = (itensPedido) => {
    console.log('Itens do pedido:', itensPedido); // Adicionado para depuração

    if (!itensPedido || itensPedido.length === 0) {
        return '<li>Nenhum item detalhado disponível.</li>';
    }
    return itensPedido.map(item => {
        // Tenta obter o nome do produto do cache, fallback para o ID se não encontrado
        const productName = productsCache.get(item.product_id) || `(ID: ${item.product_id})`;
        return `
            <li>
                ${productName}
                <span class="item-quantity">x${item.quantity}</span>
                <span class="item-price">R$ ${item.price ? item.price.toFixed(2) : '0.00'}</span>
            </li>`;
    }).join('');
};

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
            productsCache.clear(); // Limpa o cache antes de preencher
            resultado.products.forEach(product => {
                productsCache.set(product.id, product.name);
            });
            console.log('Cache de produtos preenchido:', productsCache);
        } else {
            console.error(MENSAGENS.ERRO_CARREGAR_PRODUTOS, resultado.detail || resultado.message || resposta.statusText);
            alert(`${MENSAGENS.ERRO_CARREGAR_PRODUTOS} ${resultado.detail || resultado.message || resposta.statusText}`);
        }
    } catch (error) {
        console.error('Erro na requisição de produtos:', error);
        alert(MENSAGENS.ERRO_CONEXAO_SERVIDOR);
    }
}


// --- Função para Carregar Pedidos (Requisição GET) ---
/**
 * Carrega e exibe os pedidos por status nas respectivas colunas,
 * aplicando o filtro de data com base na variável de estado global `isFilteredByToday`.
 */
async function carregarTodosPedidos() {
    // Exibe mensagem de carregamento e oculta a de "sem pedidos"
    loadingMessage.style.display = 'block';
    noOrdersMessage.style.display = 'none';

    // Limpa todas as colunas
    pendingOrdersList.innerHTML = '';
    processingOrdersList.innerHTML = '';
    completedOrdersList.innerHTML = '';
    cancelledOrdersList.innerHTML = '';

    // Reseta contadores
    let contagens = {
        [STATUS_PEDIDO.PENDENTE]: 0,
        [STATUS_PEDIDO.EM_PREPARACAO]: 0,
        [STATUS_PEDIDO.CONCLUIDO]: 0,
        [STATUS_PEDIDO.CANCELADO]: 0
    };

    try {
        const queryParams = new URLSearchParams();
        // Adiciona todos os status que queremos exibir
        Object.values(STATUS_PEDIDO).forEach(status => queryParams.append('status', status));

        // Constrói a URL da API. Assume que API_BASE_URL NÃO termina com barra.
        const resposta = await fetch(`${API_BASE_URL}/api/v1/orders/?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${obterTokenAcesso()}`,
                'Accept': 'application/json'
            }
        });

        if (lidarComErroAutenticacao(resposta)) {
            loadingMessage.style.display = 'none';
            return;
        }

        const resultado = await resposta.json();

        if (resposta.ok) {
            let pedidos = resultado.orders; // Obtenha o array de pedidos
            loadingMessage.style.display = 'none';

            // --- Aplica o filtro de data no frontend se `isFilteredByToday` for true ---
            if (isFilteredByToday && pedidos?.length) {
                // Obtém a data atual em Florianópolis para comparação
                const dataAtualFlorianopolis = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
                const diaAtual = dataAtualFlorianopolis.getDate();
                const mesAtual = dataAtualFlorianopolis.getMonth();
                const anoAtual = dataAtualFlorianopolis.getFullYear();

                pedidos = pedidos.filter(pedido => {
                    const dataPedido = new Date(pedido.created_at);
                    // Converte a data do pedido para o fuso horário de Florianópolis para comparação precisa
                    const dataPedidoFlorianopolis = new Date(dataPedido.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));

                    return dataPedidoFlorianopolis.getDate() === diaAtual &&
                               dataPedidoFlorianopolis.getMonth() === mesAtual &&
                               dataPedidoFlorianopolis.getFullYear() === anoAtual;
                });
            }

            if (!pedidos?.length) { // Verifica se não há pedidos após o filtro
                noOrdersMessage.style.display = 'block';
            } else {
                // Itera sobre os pedidos e os distribui nas colunas
                pedidos.forEach(pedido => {
                    // AQUI ESTÁ A MUDANÇA: 'products' em vez de 'items'
                    const { id, locator, status, products, notes, total, created_at } = pedido; 
                    
                    const statusExibicao = status.toUpperCase();

                    const cartaoPedido = document.createElement('div');
                    cartaoPedido.classList.add('order-card', statusExibicao.toLowerCase());

                    // Agora passamos 'products' para a função gerarHtmlItensPedido
                    const htmlItens = gerarHtmlItensPedido(products); 

                    // --- Regras de Transição de Status ---
                    const transicoesStatus = {
                        [STATUS_PEDIDO.PENDENTE]: [STATUS_PEDIDO.CANCELADO],
                        [STATUS_PEDIDO.EM_PREPARACAO]: [STATUS_PEDIDO.CANCELADO],
                        [STATUS_PEDIDO.CONCLUIDO]: [],
                        [STATUS_PEDIDO.CANCELADO]: [STATUS_PEDIDO.PENDENTE]
                    };

                    const proximoStatusPermitido = transicoesStatus[statusExibicao] || [];

                    let htmlOpcoesStatus = `
                        <select class="status-select" data-order-id="${id}">
                            <option value="${statusExibicao}" selected disabled>${statusExibicao}</option>
                            ${proximoStatusPermitido.map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>
                        <button class="update-status-btn btn-primary" data-order-id="${id}" data-order-locator="${locator}" disabled>Atualizar</button>
                        `;

                    const dataFormatadaCriacao = formatarDataCriacao(created_at);

                    cartaoPedido.innerHTML = `
                        <div class="order-header">
                            <h3>Pedido: ${locator || 'N/A'}</h3>
                        </div>
                        <p class="order-status-display">Status: <span class="status-badge ${statusExibicao.toLowerCase()}">${statusExibicao}</span></p>
                        <div class="order-details">
                            <h4>Itens:</h4>
                            <ul class="order-items-list">${htmlItens}</ul>
                            <p class="order-notes">Observações: ${notes || 'N/A'}</p>
                            <p class="order-total">Total: <strong>R$ ${total ? total.toFixed(2) : '0.00'}</strong></p>
                            <p class="order-created-at">Criado em: ${dataFormatadaCriacao}</p>
                        </div>
                        <div class="order-actions">
                            ${htmlOpcoesStatus}
                        </div>
                        <div class="order-footer-id">
                            <span class="order-id-display">ID: ${id.substring(0, 8)}...</span>
                        </div>
                    `;
                    // Adiciona o cartão à coluna correta com base no status
                    switch (statusExibicao) {
                        case STATUS_PEDIDO.PENDENTE:
                            pendingOrdersList.appendChild(cartaoPedido);
                            contagens.PENDING++;
                            break;
                        case STATUS_PEDIDO.EM_PREPARACAO:
                            processingOrdersList.appendChild(cartaoPedido);
                            contagens.PROCESSING++;
                            break;
                        case STATUS_PEDIDO.CONCLUIDO:
                            completedOrdersList.appendChild(cartaoPedido);
                            contagens.COMPLETED++;
                            break;
                        case STATUS_PEDIDO.CANCELADO:
                            cancelledOrdersList.appendChild(cartaoPedido);
                            contagens.CANCELLED++;
                            break;
                        default:
                            console.warn('Status desconhecido:', status);
                    }
                });

                // Atualiza os contadores exibidos na UI
                countPending.textContent = ` (${contagens.PENDING})`;
                countProcessing.textContent = ` (${contagens.PROCESSING})`;
                countCompleted.textContent = ` (${contagens.COMPLETED})`;
                countCancelled.textContent = ` (${contagens.CANCELLED})`;
            }
        } else {
            // Lida com erros na resposta da API (ex: 400 Bad Request, 500 Internal Server Error)
            loadingMessage.style.display = 'none';
            noOrdersMessage.textContent = `${MENSAGENS.ERRO_CARREGAR_PEDIDOS} ${resultado.detail || resultado.message || resposta.statusText}`;
            noOrdersMessage.style.display = 'block';
            console.error(MENSAGENS.ERRO_CARREGAR_PEDIDOS, resultado.detail || resultado.message || resposta.statusText);
        }
    } catch (error) {
        // Lida com erros de rede ou outros erros que impedem a requisição
        console.error('Erro na requisição de pedidos:', error);
        loadingMessage.style.display = 'none';
        noOrdersMessage.textContent = MENSAGENS.ERRO_CONEXAO_SERVIDOR;
        noOrdersMessage.style.display = 'block';
    }
}
/**
 * Atualiza o texto e a classe do botão de filtro de data com base no estado atual.
 */
function updateFilterButtonState() {
    if (isFilteredByToday) {
        toggleFilterBtn.textContent = 'Ver Pedidos de Outros Dias';
        toggleFilterBtn.classList.add('active'); // Adiciona classe para estilização de "ativo"
    } else {
        toggleFilterBtn.textContent = 'Ver Pedidos de Hoje';
        toggleFilterBtn.classList.remove('active'); // Remove classe quando não está filtrado por hoje
    }
}

// --- Lógica Principal: Executada quando o DOM está completamente carregado ---
document.addEventListener('DOMContentLoaded', async () => {
    // --- Atribuição das Referências DOM ---
    // Obtém as referências dos elementos HTML e as atribui às variáveis globais.
    pendingOrdersList = document.getElementById('pendingOrdersList');
    processingOrdersList = document.getElementById('processingOrdersList');
    completedOrdersList = document.getElementById('completedOrdersList');
    cancelledOrdersList = document.getElementById('cancelledOrdersList');

    countPending = document.getElementById('count-pending');
    countProcessing = document.getElementById('count-processing');
    countCompleted = document.getElementById('count-completed');
    countCancelled = document.getElementById('count-cancelled');

    loadingMessage = document.getElementById('loadingMessage');
    noOrdersMessage = document.getElementById('noOrdersMessage');
    logoutBtn = document.getElementById('logoutBtn');
    toggleFilterBtn = document.getElementById('toggleFilterBtn'); // Atribui a referência do novo botão

    const accessToken = obterTokenAcesso();

    // --- Validação de Autenticação na Inicialização ---
    if (!accessToken) {
        alert(MENSAGENS.AUTENTICACAO_NECESSARIA);
        redirecionarParaLogin();
        return; // Interrompe a execução se não houver token
    }

    // --- Configuração da API_BASE_URL ---
    // Garante que API_BASE_URL esteja definida (geralmente em um arquivo common.js incluído antes).
    if (typeof API_BASE_URL === 'undefined') {
        console.error(MENSAGENS.ERRO_CONFIGURACAO_API.replace('API_BASE_URL não encontrada.', 'API_BASE_URL não está definida. Verifique common.js ou seu escopo.'));
        alert(MENSAGENS.ERRO_CONFIGURACAO_API);
        return; // Interrompe a execução se a URL base da API não estiver configurada
    }

    // --- Primeiro, carregue os produtos, depois os pedidos ---
    await carregarProdutos(); // Garante que o cache de produtos esteja preenchido

    // --- Event Listener para o Botão de Logout ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (evento) => {
            evento.preventDefault(); // Impede o comportamento padrão do link
            removerDadosSessao();
            redirecionarParaLogin();
        });
    }

    // --- Event Listener para o Botão Único de Filtro de Data ---
    if (toggleFilterBtn) {
        toggleFilterBtn.addEventListener('click', () => {
            isFilteredByToday = !isFilteredByToday; // Inverte o estado do filtro
            updateFilterButtonState(); // Atualiza o texto e a classe do botão
            carregarTodosPedidos(); // Recarrega os pedidos com o novo estado do filtro
        });
    }

    // --- Delegação de Eventos para Dropdown de Status e Botão de Atualização ---
    // Ouve eventos 'change' e 'click' no elemento pai 'orders-board' para otimizar a performance.
    const ordersBoard = document.querySelector('.orders-board');

    // Evento de mudança no dropdown de status
    ordersBoard.addEventListener('change', (evento) => {
        if (evento.target.classList.contains('status-select')) {
            const elementoSelecao = evento.target;
            const botaoAtualizar = elementoSelecao.nextElementSibling; // O botão 'Atualizar' é o próximo irmão

            const valorSelecionado = elementoSelecao.value;
            // Pega o status atual que está na opção disabled (selecionada por padrão)
            const statusAtualReal = elementoSelecao.querySelector('option[selected][disabled]').value;

            // Habilita ou desabilita o botão 'Atualizar' se a seleção do dropdown mudou ou não
            botaoAtualizar.disabled = (valorSelecionado === statusAtualReal);
        }
    });

    // Evento de clique no botão 'Atualizar' status
    ordersBoard.addEventListener('click', async (evento) => {
        if (evento.target.classList.contains('update-status-btn')) {
            const botao = evento.target;
            const idPedido = botao.dataset.orderId; // ID do pedido do atributo data-order-id
            const elementoSelecao = botao.previousElementSibling;
            const novoStatus = elementoSelecao.value;

            const locatorPedido = botao.dataset.orderLocator;

            // Solicita confirmação antes de atualizar o status
            const confirmarAtualizacao = confirm(MENSAGENS.CONFIRMACAO_ATUALIZACAO(locatorPedido, novoStatus));
            if (!confirmarAtualizacao) {
                return; // Aborta se o usuário cancelar
            }

            try {
                const resposta = await fetch(`${API_BASE_URL}/api/v1/orders/${idPedido}`, {
                    method: 'PATCH', // Método HTTP para atualizar parcialmente um recurso
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json', // Informa que o corpo da requisição é JSON
                        'Accept': 'application/json' // Informa que esperamos uma resposta JSON
                    },
                    body: JSON.stringify({ status: novoStatus }), // Envia o novo status no corpo da requisição
                });

                if (lidarComErroAutenticacao(resposta)) return; // Lida com erros de autenticação/autorização

                const resultado = await resposta.json();

                if (resposta.ok) {
                    // Se a atualização foi bem-sucedida, recarrega todos os pedidos
                    // para refletir as mudanças na UI (o pedido mudará de coluna).
                    carregarTodosPedidos();
                } else {
                    // Exibe mensagem de erro detalhada da API ou uma mensagem padrão
                    alert(resultado.detail || resultado.message || MENSAGENS.ERRO_ATUALIZAR_STATUS);
                    console.error('Erro ao atualizar status:', resultado);
                }
            } catch (error) {
                // Lida com erros de rede durante a atualização do status
                console.error('Erro na requisição de atualização de status:', error);
                alert(MENSAGENS.ERRO_CONEXAO_SERVIDOR);
            }
        }
    });

    // --- Carrega Pedidos na Inicialização ---
    // Inicia a aplicação carregando os pedidos filtrados por hoje (isFilteredByToday = true por padrão).
    updateFilterButtonState(); // Atualiza o texto do botão para "Ver Todos os Pedidos"
    carregarTodosPedidos();
});