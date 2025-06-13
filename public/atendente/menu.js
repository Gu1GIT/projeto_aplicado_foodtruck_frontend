// public/cliente/menu.js
// Lógica para carregar produtos por categoria em colunas e gerenciar o carrinho.

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Referências a Elementos do DOM (agrupadas e padronizadas) ---
    const DOM = {
        // Navegação e usuário
        adminMenuItem: document.querySelector('li > a[href="../admin/gerenciar_produtos.html"]'),
        logoutBtn: document.getElementById('logoutBtn'),
        
        // Mensagens de estado
        loadingMessage: document.getElementById('loadingMessage'),
        noProductsMessage: document.getElementById('noProductsMessage'),

        // Listas de produtos por categoria
        foodProductsList: document.getElementById('foodProductsList'),
        drinkProductsList: document.getElementById('drinkProductsList'),
        dessertProductsList: document.getElementById('dessertProductsList'),
        snackProductsList: document.getElementById('snackProductsList'),

        // Contadores de categoria
        countFood: document.getElementById('count-food'),
        countDrink: document.getElementById('count-drink'),
        countDessert: document.getElementById('count-dessert'),
        countSnack: document.getElementById('count-snack'),

        // Carrinho (botão e contador)
        viewCartBtn: document.getElementById('viewCartBtn'),
        cartItemCount: document.getElementById('cartItemCount'),

        // Estimativa de tempo
        preparationTimeEstimate: document.getElementById('preparationTimeEstimate'),
        estimatedMinutesSpan: document.getElementById('estimatedMinutes'),
        pendingOrdersCountSpan: document.getElementById('pendingOrdersCount'),

        // Modal do Carrinho
        cartModal: document.getElementById('cartModal'),
        closeButton: document.querySelector('.close-button'),
        cartItemsList: document.getElementById('cartItems'),
        cartTotalSpan: document.getElementById('cartTotal'),
        clearCartBtn: document.getElementById('clearCartBtn'),
        checkoutBtn: document.getElementById('checkoutBtn'),
        orderNotesInput: document.getElementById('orderNotes'), // Campo de observações
        productsBoard: document.querySelector('.products-board') // Board de produtos para delegação de eventos
    };

    // --- 2. Variáveis de Estado Globais (com inicialização padrão) ---
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let products = []; // Para armazenar os produtos carregados
    const accessToken = localStorage.getItem('accessToken');
    const currentOrderLocator = localStorage.getItem('currentOrder');

    // --- 3. Constantes ---
    const CATEGORY_MAP = {
        FOOD: DOM.foodProductsList,
        DRINK: DOM.drinkProductsList,
        DESSERT: DOM.dessertProductsList,
        SNACK: DOM.snackProductsList
    };

    const COUNT_MAP = {
        FOOD: DOM.countFood,
        DRINK: DOM.countDrink,
        DESSERT: DOM.countDessert,
        SNACK: DOM.countSnack
    };
    
    const ESTIMATED_TIME_PER_ORDER_BLOCK = 8; // Em minutos
    const ORDERS_PER_BLOCK = 2; // Número de pedidos por bloco de tempo
    const REFRESH_INTERVAL_MS = 30000; // 30 segundos

    // --- 4. Funções Utilitárias ---

    /**
     * Redireciona para a página de login e limpa o armazenamento local em caso de erro de autenticação.
     */
    function redirectToLoginAndClearStorage() {
        alert('Sessão expirada ou acesso negado. Faça login novamente.');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('currentOrder');
        localStorage.removeItem('cart');
        window.location.href = '../index.html';
    }

    /**
     * Lida com erros de autenticação e autorização de respostas da API.
     * @param {Response} response - A resposta da requisição Fetch.
     * @returns {boolean} True se houve um erro de autenticação/autorização e o tratamento foi iniciado.
     */
    function handleAuthError(response) {
        if (response.status === 401 || response.status === 403) {
            redirectToLoginAndClearStorage();
            return true;
        }
        return false;
    }

    /**
     * Atualiza o contador de itens no ícone do carrinho no cabeçalho.
     */
    function updateCartCount() {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        DOM.cartItemCount.textContent = totalItems;
    }

    /**
     * Renderiza os itens do carrinho no modal.
     */
    function renderCart() {
        DOM.cartItemsList.innerHTML = '';
        let total = 0;

        if (cart.length === 0) {
            DOM.cartItemsList.innerHTML = '<li class="empty-cart-message">Seu carrinho está vazio.</li>';
            DOM.cartTotalSpan.textContent = '0.00';
            DOM.checkoutBtn.disabled = true;
            return;
        }

        cart.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${item.name} (R$ ${item.price.toFixed(2)})</span>
                <div class="cart-item-controls">
                    <button class="quantity-btn decrease-quantity" data-id="${item.id}">-</button>
                    <span class="quantity">${item.quantity}</span>
                    <button class="quantity-btn increase-quantity" data-id="${item.id}">+</button>
                    <button class="remove-from-cart-btn btn-danger" data-id="${item.id}">Remover</button>
                </div>
            `;
            DOM.cartItemsList.appendChild(li);
            total += item.price * item.quantity;
        });

        DOM.cartTotalSpan.textContent = total.toFixed(2);
        DOM.checkoutBtn.disabled = false;
    }

    /**
     * Adiciona um produto ao carrinho ou aumenta sua quantidade se já existir.
     * @param {object} product - O objeto do produto a ser adicionado.
     */
    function addToCart(product) {
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        renderCart();
    }

    /**
     * Atualiza a quantidade de um item no carrinho.
     * @param {string} productId - O ID do produto.
     * @param {number} change - O valor a ser adicionado/removido da quantidade (ex: 1, -1).
     */
    function updateCartItemQuantity(productId, change) {
        const itemIndex = cart.findIndex(item => item.id === productId);
        if (itemIndex > -1) {
            cart[itemIndex].quantity += change;
            if (cart[itemIndex].quantity <= 0) {
                cart.splice(itemIndex, 1);
            }
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartCount();
            renderCart();
        }
    }

    /**
     * Remove um produto completamente do carrinho.
     * @param {string} productId - O ID do produto a ser removido.
     */
    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        renderCart();
    }

    /**
     * Cria e retorna um card de produto HTML.
     * @param {object} product - O objeto do produto.
     * @returns {HTMLElement} O elemento div do card do produto.
     */
    function createProductCard(product) {
        const productCard = document.createElement('div');
        productCard.classList.add('product-card');
        productCard.innerHTML = `
            <div class="product-header">
                <h3>${product.name}</h3>
                <span class="product-category">${product.category}</span>
            </div>
            <p class="product-description">${product.description || 'Sem descrição.'}</p>
            <p class="product-price">R$ ${product.price.toFixed(2)}</p>
            <button class="add-to-cart-btn btn-primary" data-id="${product.id}">Adicionar ao Carrinho</button>
        `;
        return productCard;
    }

    /**
     * Carrega os produtos da API e os exibe nas categorias correspondentes.
     */
    async function loadProducts() {
        DOM.loadingMessage.style.display = 'block';
        DOM.noProductsMessage.style.display = 'none';

        // Limpa todas as colunas e reseta contadores
        Object.values(CATEGORY_MAP).forEach(list => list.innerHTML = '');
        let counts = { FOOD: 0, DRINK: 0, DESSERT: 0, SNACK: 0 };

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/products/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'accept': 'application/json'
                }
            });

            if (handleAuthError(response)) return;

            const result = await response.json();

            if (response.ok) {
                products = result.products;
                DOM.loadingMessage.style.display = 'none';

                if (!products || products.length === 0) {
                    DOM.noProductsMessage.style.display = 'block';
                } else {
                    products.forEach(product => {
                        const productCard = createProductCard(product);
                        const categoryList = CATEGORY_MAP[product.category.toUpperCase()];
                        if (categoryList) {
                            categoryList.appendChild(productCard);
                            counts[product.category.toUpperCase()]++;
                        } else {
                            console.warn('Categoria de produto desconhecida:', product.category);
                        }
                    });

                    // Atualiza os contadores
                    Object.keys(COUNT_MAP).forEach(category => {
                        COUNT_MAP[category].textContent = ` (${counts[category]})`;
                    });
                }
            } else {
                DOM.loadingMessage.style.display = 'none';
                DOM.noProductsMessage.textContent = `Erro ao carregar produtos: ${result.detail || result.message || response.statusText}`;
                DOM.noProductsMessage.style.display = 'block';
                console.error('Erro ao carregar produtos:', result.detail || result.message || response.statusText);
            }
        } catch (error) {
            console.error('Erro na requisição de produtos:', error);
            DOM.loadingMessage.style.display = 'none';
            DOM.noProductsMessage.textContent = 'Não foi possível conectar ao servidor.';
            DOM.noProductsMessage.style.display = 'block';
        }
    }

    /**
     * Calcula a estimativa de tempo de preparo baseada no número de pedidos pendentes/em preparo.
     * @param {number} pendingOrProcessingOrders - Número de pedidos com status PENDING ou PROCESSING.
     * @returns {number} O tempo estimado em minutos.
     */
    function calculateEstimatedTime(pendingOrProcessingOrders) {
        if (pendingOrProcessingOrders === 0) {
            return ESTIMATED_TIME_PER_ORDER_BLOCK; // Se não há pedidos na fila, o primeiro leva o tempo base
        }
        // Calcula o tempo base para os pedidos existentes na fila
        const baseBlocks = Math.floor((pendingOrProcessingOrders + 1) / ORDERS_PER_BLOCK); // +1 para o pedido atual
        const baseTime = baseBlocks * ESTIMATED_TIME_PER_ORDER_BLOCK;
        return baseTime;
    }

    /**
     * Busca o número de pedidos pendentes/em preparo e exibe a estimativa de tempo.
     */
    async function displayEstimatedTime() {
        try {
            const queryParams = new URLSearchParams();
            queryParams.append('status', 'PENDING');
            queryParams.append('status', 'PROCESSING');

            const response = await fetch(`${API_BASE_URL}/api/v1/orders/?${queryParams.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'accept': 'application/json'
                }
            });

            if (handleAuthError(response)) return;

            const result = await response.json();

            if (response.ok && result.orders) {
                const relevantOrders = result.orders.filter(order => {
                    const orderStatusUpperCase = (order.status || '').toUpperCase();
                    return orderStatusUpperCase === 'PENDING' || orderStatusUpperCase === 'PROCESSING';
                });

                const pendingProcessingCount = relevantOrders.length;
                const estimatedTime = calculateEstimatedTime(pendingProcessingCount);

                DOM.estimatedMinutesSpan.textContent = estimatedTime;
                DOM.pendingOrdersCountSpan.textContent = pendingProcessingCount;
                DOM.preparationTimeEstimate.style.display = 'block';
            } else {
                console.error('Erro ao buscar pedidos para estimativa de tempo:', result.detail || response.statusText);
                DOM.estimatedMinutesSpan.textContent = '--';
                DOM.pendingOrdersCountSpan.textContent = '--';
                DOM.preparationTimeEstimate.style.display = 'block';
            }
        } catch (error) {
            console.error('Erro de rede ao buscar pedidos para estimativa de tempo:', error);
            DOM.estimatedMinutesSpan.textContent = '--';
            DOM.pendingOrdersCountSpan.textContent = '--';
            DOM.preparationTimeEstimate.style.display = 'block';
        }
    }

    /**
     * Busca o último pedido criado e exibe um alerta com suas informações.
     */
    async function displayLastOrder() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/orders/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'accept': 'application/json'
                }
            });

            if (handleAuthError(response)) return;

            const result = await response.json();

            if (response.ok && result.orders && result.orders.length > 0) {
                // MODIFICAÇÃO AQUI: Pega o último elemento do array 'orders'
                const lastOrder = result.orders[result.orders.length - 1];
                
                // Ou, se a API não retornar ordenado, você pode fazer algo como:
                // const lastOrder = result.orders.reduce((latest, current) => 
                //     new Date(latest.created_at) > new Date(current.created_at) ? latest : current
                // );

                alert(`Pedido Criado:
                Nº: ${lastOrder.locator}
                ID: #${lastOrder.id.substring(0, 8)}                         
                Observações: ${lastOrder.notes || 'Nenhuma'}`);
             

            } else if (response.ok && result.orders.length === 0) {
                alert('Não há pedidos registrados no momento.');
            } else {
                console.error('Erro ao buscar o último pedido:', result.detail || response.statusText);
                alert('Não foi possível carregar as informações do último pedido.');
            }
        } catch (error) {
            console.error('Erro de rede ao buscar o último pedido:', error);
            alert('Erro de conexão ao tentar buscar o último pedido.');
        }
    }

    /**
     * Finaliza o pedido, enviando-o para a API.
     */
    async function checkout() {
        if (cart.length === 0) {
            alert('Seu carrinho está vazio!');
            return;
        }

        const orderItems = cart.map(item => ({
            product_id: item.id,
            quantity: item.quantity,
            price: item.price
        }));

        const notes = DOM.orderNotesInput ? DOM.orderNotesInput.value.trim() : '';

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/orders/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                },
                body: JSON.stringify({
                    locator: currentOrderLocator,
                    items: orderItems,
                    notes: notes
                })
            });

            if (handleAuthError(response)) return;

            const result = await response.json();

            if (response.ok) {
                //alert(`Pedido ID: #${result.id.substring(0, 8)}) enviado com sucesso!`);
                
                // --- NOVO: CHAMA A FUNÇÃO PARA EXIBIR O ÚLTIMO PEDIDO CRIADO ---
                await displayLastOrder(); // Garante que o alerta do último pedido só apareça após o sucesso do checkout
                // --- FIM DA NOVIDADE ---

                cart = [];
                localStorage.removeItem('cart');
                updateCartCount();
                renderCart();
                DOM.cartModal.style.display = 'none';

                if (DOM.orderNotesInput) {
                    DOM.orderNotesInput.value = '';
                }
                displayEstimatedTime();
            } else {
                alert(`Erro ao finalizar pedido: ${result.detail || result.message || response.statusText}`);
                console.error('Erro ao finalizar pedido:', result);
            }
        } catch (error) {
            console.error('Erro na requisição de finalização de pedido:', error);
            alert('Não foi possível conectar ao servidor para finalizar o pedido.');
        }
    }

    // --- 5. Inicialização e Configuração ---

    // Validação de Autenticação inicial
    if (!accessToken) {
        alert('Você precisa estar logado para acessar esta página.');
        window.location.href = '../index.html';
        return;
    }

    // Ocultar menu admin para atendente e chapeiro
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'attendant' || userRole === 'kitchen') {
        if (DOM.adminMenuItem && DOM.adminMenuItem.parentElement) {
            DOM.adminMenuItem.parentElement.style.display = 'none';
        }
    }

    // Verificação de API_BASE_URL (assumindo common.js está carregado)
    if (typeof API_BASE_URL === 'undefined') {
        console.error("API_BASE_URL não está definida. Verifique common.js ou seu escopo.");
        alert("Erro de configuração: API_BASE_URL não encontrada.");
        return;
    }

    // --- 6. Event Listeners (centralizados e concisos) ---

    // Logout
    DOM.logoutBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        redirectToLoginAndClearStorage();
    });

    // Adicionar ao carrinho (delegação de evento)
    DOM.productsBoard?.addEventListener('click', (event) => {
        if (event.target.classList.contains('add-to-cart-btn')) {
            const productId = event.target.dataset.id;
            const productToAdd = products.find(p => p.id === productId);
            if (productToAdd) {
                addToCart(productToAdd);
            }
        }
    });

    // Abrir Modal do Carrinho
    DOM.viewCartBtn?.addEventListener('click', () => {
        renderCart();
        DOM.cartModal.style.display = 'block';
    });

    // Fechar Modal do Carrinho (botão "x" e clique fora)
    DOM.closeButton?.addEventListener('click', () => {
        DOM.cartModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === DOM.cartModal) {
            DOM.cartModal.style.display = 'none';
        }
    });

    // Ações do Carrinho (dentro do modal - delegação de evento)
    DOM.cartItemsList?.addEventListener('click', (event) => {
        const target = event.target;
        const productId = target.dataset.id;

        if (target.classList.contains('decrease-quantity')) {
            updateCartItemQuantity(productId, -1);
        } else if (target.classList.contains('increase-quantity')) {
            updateCartItemQuantity(productId, 1);
        } else if (target.classList.contains('remove-from-cart-btn')) {
            removeFromCart(productId);
        }
    });

    // Limpar Carrinho
    DOM.clearCartBtn?.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja limpar o carrinho?')) {
            cart = [];
            localStorage.removeItem('cart');
            updateCartCount();
            renderCart();
            if (DOM.orderNotesInput) {
                DOM.orderNotesInput.value = '';
            }
            alert('Carrinho limpo.');
        }
    });

    // Finalizar Pedido
    DOM.checkoutBtn?.addEventListener('click', checkout);

    // --- 7. Execução Inicial ---
    updateCartCount();
    loadProducts();
    displayEstimatedTime();
    setInterval(displayEstimatedTime, REFRESH_INTERVAL_MS);
});