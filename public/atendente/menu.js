// public/cliente/menu.js
// Lógica para carregar produtos por categoria em colunas e gerenciar o carrinho.

document.addEventListener('DOMContentLoaded', async () => {

    // OCULTAR MENU ADMIN PARA ATENDENTE E CHAPEIRO
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'attendant' || userRole === 'kitchen') {
        const menuItem = document.querySelector('li > a[href="../admin/gerenciar_produtos.html"]');
        if (menuItem && menuItem.parentElement) {
            menuItem.parentElement.style.display = 'none';
        }
    } 
    // NOVO: Referência para o campo de observações
    const orderNotesInput = document.getElementById('orderNotes');

    // Referências para os contêineres de cada categoria
    const foodProductsList = document.getElementById('foodProductsList');
    const drinkProductsList = document.getElementById('drinkProductsList');
    const dessertProductsList = document.getElementById('dessertProductsList');
    const snackProductsList = document.getElementById('snackProductsList');

    // Referências para os contadores de cada categoria
    const countFood = document.getElementById('count-food');
    const countDrink = document.getElementById('count-drink');
    const countDessert = document.getElementById('count-dessert');
    const countSnack = document.getElementById('count-snack');

    const loadingMessage = document.getElementById('loadingMessage');
    const noProductsMessage = document.getElementById('noProductsMessage');
    const logoutBtn = document.getElementById('logoutBtn');
    const viewCartBtn = document.getElementById('viewCartBtn');
    const cartItemCount = document.getElementById('cartItemCount');

    // Elemento para a estimativa de tempo
    const preparationTimeEstimate = document.getElementById('preparationTimeEstimate');
    const estimatedMinutesSpan = document.getElementById('estimatedMinutes');

     // NOVO: Referência para o contador de pedidos pendentes/em preparo
     const pendingOrdersCountSpan = document.getElementById('pendingOrdersCount');

    // Modal do Carrinho
    const cartModal = document.getElementById('cartModal');
    const closeButton = document.querySelector('.close-button');
    const cartItemsList = document.getElementById('cartItems');
    const cartTotalSpan = document.getElementById('cartTotal');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');

    let cart = JSON.parse(localStorage.getItem('cart')) || []; // Carrega carrinho do localStorage
    let products = []; // Para armazenar os produtos carregados

    const accessToken = localStorage.getItem('accessToken');
    const currentOrderLocator = localStorage.getItem('currentOrder'); // O 'locator' (mesa/senha) do pedido

    // --- Validação de Autenticação ---
    if (!accessToken) {
        alert('Você precisa estar logado para acessar esta página.');
        window.location.href = '../index.html';
        return;
    }

    // --- Configuração da API_BASE_URL ---
    // Presumindo que API_BASE_URL é definida em common.js, que é carregado antes.
    if (typeof API_BASE_URL === 'undefined') {
        console.error("API_BASE_URL não está definida. Verifique common.js ou seu escopo.");
        alert("Erro de configuração: API_BASE_URL não encontrada.");
        return;
    }

    // --- Logout ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (event) => {
            event.preventDefault();
            localStorage.removeItem('accessToken');
            localStorage.removeItem('currentOrder'); // Limpa o localizador do pedido também
            localStorage.removeItem('cart'); // Limpa o carrinho ao sair
            window.location.href = '../index.html';
        });
    }

    // --- Tratamento de Erros de Autenticação/Autorização da API ---
    function handleAuthError(response) {
        if (response.status === 401 || response.status === 403) {
            alert('Sessão expirada ou acesso negado. Faça login novamente.');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('currentOrder');
            localStorage.removeItem('cart');
            window.location.href = '../index.html';
            return true;
        }
        return false;
    }

    // --- Atualiza o contador de itens no carrinho no cabeçalho ---
    function updateCartCount() {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartItemCount.textContent = totalItems;
    }

    // --- Renderiza o carrinho no modal ---
    function renderCart() {
        cartItemsList.innerHTML = '';
        let total = 0;

        if (cart.length === 0) {
            cartItemsList.innerHTML = '<li class="empty-cart-message">Seu carrinho está vazio.</li>';
            cartTotalSpan.textContent = '0.00';
            checkoutBtn.disabled = true; // Desabilita o botão se o carrinho estiver vazio
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
            cartItemsList.appendChild(li);
            total += item.price * item.quantity;
        });

        cartTotalSpan.textContent = total.toFixed(2);
        checkoutBtn.disabled = false; // Habilita o botão se houver itens no carrinho
    }

    // --- Adicionar/Remover do Carrinho ---
    function addToCart(product) {
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        renderCart(); // Para atualizar o modal se estiver aberto
    }

    function updateCartItemQuantity(productId, change) {
        const itemIndex = cart.findIndex(item => item.id === productId);
        if (itemIndex > -1) {
            cart[itemIndex].quantity += change;
            if (cart[itemIndex].quantity <= 0) {
                cart.splice(itemIndex, 1); // Remove se a quantidade for 0 ou menos
            }
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartCount();
            renderCart();
        }
    }

    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        renderCart();
    }

    // --- Função para Carregar Produtos (Requisição GET) ---
    async function loadProducts() {
        loadingMessage.style.display = 'block';
        noProductsMessage.style.display = 'none';

        // Limpa todas as colunas
        foodProductsList.innerHTML = '';
        drinkProductsList.innerHTML = '';
        dessertProductsList.innerHTML = '';
        snackProductsList.innerHTML = '';

        // Reseta contadores
        let counts = { FOOD: 0, DRINK: 0, DESSERT: 0, SNACK: 0 };

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/products/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'accept': 'application/json'
                }
            });

            if (handleAuthError(response)) {
                loadingMessage.style.display = 'none';
                return;
            }

            const result = await response.json();

            if (response.ok) {
                products = result.products; // Armazena produtos globalmente
                loadingMessage.style.display = 'none';

                if (!products || products.length === 0) {
                    noProductsMessage.style.display = 'block';
                } else {
                    // Distribui os produtos nas colunas corretas
                    products.forEach(product => {
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

                        // Adiciona o card à coluna correta
                        switch (product.category.toUpperCase()) {
                            case 'FOOD':
                                foodProductsList.appendChild(productCard);
                                counts.FOOD++;
                                break;
                            case 'DRINK':
                                drinkProductsList.appendChild(productCard);
                                counts.DRINK++;
                                break;
                            case 'DESSERT':
                                dessertProductsList.appendChild(productCard);
                                counts.DESSERT++;
                                break;
                            case 'SNACK':
                                snackProductsList.appendChild(productCard);
                                counts.SNACK++;
                                break;
                            default:
                                console.warn('Categoria de produto desconhecida:', product.category);
                        }
                    });

                    // Atualiza os contadores
                    countFood.textContent = ` (${counts.FOOD})`;
                    countDrink.textContent = ` (${counts.DRINK})`;
                    countDessert.textContent = ` (${counts.DESSERT})`;
                    countSnack.textContent = ` (${counts.SNACK})`;
                }
            } else {
                loadingMessage.style.display = 'none';
                noProductsMessage.textContent = `Erro ao carregar produtos: ${result.detail || result.message || response.statusText}`;
                noProductsMessage.style.display = 'block';
                console.error('Erro ao carregar produtos:', result.detail || result.message || response.statusText);
            }
        } catch (error) {
            console.error('Erro na requisição de produtos:', error);
            loadingMessage.style.display = 'none';
            noProductsMessage.textContent = 'Não foi possível conectar ao servidor.';
            noProductsMessage.style.display = 'block';
        }
    }

    // --- Lógica de cálculo de tempo ---
    function calculateEstimatedTime(pendingOrProcessingOrders) {
        if (pendingOrProcessingOrders === 0) {
            return 12; // Se não há pedidos na fila, o primeiro leva 12 min
        }
        // Calcula o tempo base para os pedidos existentes na fila
        const baseBlocks = Math.ceil(pendingOrProcessingOrders / 2);
        const baseTime = baseBlocks * 12;
        // Adiciona 12 minutos para o "próximo" pedido (o que será feito agora)
        return baseTime + 12;
    }

    // --- Função para exibir a estimativa de tempo ---
   // public/cliente/menu.js

// ... (código anterior) ...

    // public/cliente/menu.js

// ... (código anterior) ...

    async function displayEstimatedTime() {
        try {
            const queryParams = new URLSearchParams();
            queryParams.append('status', 'PENDING'); // Mantemos estes para a requisição API
            queryParams.append('status', 'PROCESSING'); // Mantemos estes para a requisição API

            const response = await fetch(`${API_BASE_URL}/api/v1/orders/?${queryParams.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'accept': 'application/json'
                }
            });

            if (handleAuthError(response)) {
                return;
            }

            const result = await response.json();

            if (response.ok && result.orders) {
                // MODIFICAÇÃO: Filtra os pedidos comparando o status em maiúsculas para ignorar a capitalização
                const relevantOrders = result.orders.filter(order => {
                    // Garante que order.status é uma string e converte para maiúsculas antes de comparar
                    const orderStatusUpperCase = (order.status || '').toUpperCase(); 
                    return orderStatusUpperCase === 'PENDING' || orderStatusUpperCase === 'PROCESSING';
                });

                const pendingProcessingCount = relevantOrders.length;
                const estimatedTime = calculateEstimatedTime(pendingProcessingCount);
                
                estimatedMinutesSpan.textContent = estimatedTime;
                pendingOrdersCountSpan.textContent = pendingProcessingCount;
                preparationTimeEstimate.style.display = 'block';
            } else {
                console.error('Erro ao buscar pedidos para estimativa de tempo:', result.detail || response.statusText);
                estimatedMinutesSpan.textContent = '--';
                pendingOrdersCountSpan.textContent = '--';
                preparationTimeEstimate.style.display = 'block';
            }
        } catch (error) {
            console.error('Erro de rede ao buscar pedidos para estimativa de tempo:', error);
            estimatedMinutesSpan.textContent = '--';
            pendingOrdersCountSpan.textContent = '--';
            preparationTimeEstimate.style.display = 'block';
        }
    }

// ... (código restante) ...

// ... (código restante) ...


    // --- Event Listeners ---

    // Adicionar ao carrinho (delegação de evento no board de produtos)
    const productsBoard = document.querySelector('.products-board');
    productsBoard.addEventListener('click', (event) => {
        if (event.target.classList.contains('add-to-cart-btn')) {
            const productId = event.target.dataset.id;
            const productToAdd = products.find(p => p.id === productId);
            if (productToAdd) {
                addToCart(productToAdd);
                // Não alerta mais, pois o modal já mostra os itens
                // alert(`${productToAdd.name} adicionado ao carrinho!`);
            }
        }
    });

    // Abrir Modal do Carrinho
    viewCartBtn.addEventListener('click', () => {
        renderCart();
        cartModal.style.display = 'block';
    });

    // Fechar Modal do Carrinho
    closeButton.addEventListener('click', () => {
        cartModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === cartModal) {
            cartModal.style.display = 'none';
        }
    });

    // Ações do Carrinho (dentro do modal)
    cartItemsList.addEventListener('click', (event) => {
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

    clearCartBtn.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja limpar o carrinho?')) {
            cart = [];
            localStorage.removeItem('cart');
            updateCartCount();
            renderCart();
            // NOVO: Limpar o campo de observação ao limpar o carrinho
            if (orderNotesInput) {
                orderNotesInput.value = '';
            }
            alert('Carrinho limpo.');
        }
    });

    checkoutBtn.addEventListener('click', async () => {
        if (cart.length === 0) {
            alert('Seu carrinho está vazio!');
            return;
        }

        // DESCOMENTADO E CORRIGIDO: Validação do currentOrderLocator
        /*if (!currentOrderLocator) {
            alert('Erro: Localizador do pedido (mesa/senha) não encontrado. Por favor, faça login novamente.');
            window.location.href = '../index.html'; // Redireciona para a página de login
            return;
        }*/

        const orderItems = cart.map(item => ({
            product_id: item.id,
            quantity: item.quantity,
            price: item.price
        }));

        // CORREÇÃO: Pega o valor do campo de observação
        const notes = orderNotesInput ? orderNotesInput.value.trim() : ""; // Pega o valor do input, ou string vazia se o input não existir ou estiver vazio

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
                    notes: notes // AGORA ESTÁ USANDO A VARIÁVEL 'notes' DO INPUT
                })
            });

            if (handleAuthError(response)) return;

            const result = await response.json();

            if (response.ok) {
                // CORREÇÃO FINAL E DEFINITIVA: Usar result.locator e result.id diretamente da resposta da API
                alert(`Pedido ${result.locator} (ID: #${result.id.substring(0, 8)}) enviado com sucesso!`);
                cart = []; // Limpa o carrinho após o pedido
                cart = []; // Limpa o carrinho após o pedido
                localStorage.removeItem('cart');
                updateCartCount();
                renderCart();
                cartModal.style.display = 'none'; // Fecha o modal

                // NOVO: Limpar o campo de observação após o pedido ser finalizado com sucesso
                if (orderNotesInput) {
                    orderNotesInput.value = '';
                }

                displayEstimatedTime(); // Atualiza a estimativa de tempo após o pedido
            } else {
                alert(`Erro ao finalizar pedido: ${result.detail || result.message || response.statusText}`);
                console.error('Erro ao finalizar pedido:', result);
            }
        } catch (error) {
            console.error('Erro na requisição de finalização de pedido:', error);
            alert('Não foi possível conectar ao servidor para finalizar o pedido.');
        }
    });


    // --- Inicialização ---
    updateCartCount(); // Atualiza o contador de itens no carrinho ao carregar a página
    loadProducts(); // Carrega os produtos ao iniciar a página
    displayEstimatedTime(); // Exibe a estimativa de tempo ao carregar a página
    setInterval(displayEstimatedTime, 30000); // Atualiza a cada 30 segundos
});