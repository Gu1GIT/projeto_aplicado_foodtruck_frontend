// public/atendente/registrar_pedido.js
// Lógica para registrar um novo pedido.

let currentOrder = []; // Array para armazenar os itens do pedido localmente

document.addEventListener('DOMContentLoaded', async () => {
    const itemSelect = document.getElementById('itemSelect');
    const quantityInput = document.getElementById('quantity');
    const addItemToOrderBtn = document.getElementById('addItemToOrder');
    const currentOrderList = document.getElementById('currentOrderList');
    const orderTotalSpan = document.getElementById('orderTotal');
    const confirmOrderBtn = document.getElementById('confirmOrder');
    const orderConfirmationMessage = document.getElementById('orderConfirmationMessage');
    const estimatedTimeSpan = document.getElementById('estimatedTime');
    const logoutBtn = document.getElementById('logoutBtn');

    const accessToken = localStorage.getItem('accessToken');

    if (!accessToken) {
        alert('Você precisa estar logado para acessar esta página.');
        window.location.href = '../index.html';
        return;
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (event) => {
            event.preventDefault();
            localStorage.removeItem('accessToken');
            window.location.href = '../index.html';
        });
    }

    // 1. Popular o dropdown de itens do menu
    try {
        const response = await fetch(`${API_BASE_URL}/api/menu`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401 || response.status === 403) {
            alert('Sessão expirada ou acesso negado. Faça login novamente.');
            localStorage.removeItem('accessToken');
            window.location.href = '../index.html';
            return;
        }

        const menuItems = await response.json();
        if (response.ok) {
            itemSelect.innerHTML = '<option value="">-- Selecione --</option>'; // Limpa o placeholder
            menuItems.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.name} (R$ ${item.price.toFixed(2)})`;
                option.dataset.price = item.price; // Armazena o preço no dataset
                itemSelect.appendChild(option);
            });
        } else {
            console.error('Erro ao popular itens do menu para pedido:', menuItems.message || response.statusText);
            itemSelect.innerHTML = '<option value="">-- Erro ao carregar itens --</option>';
        }
    } catch (error) {
        console.error('Erro na requisição do menu para pedido:', error);
        itemSelect.innerHTML = '<option value="">-- Erro de conexão --</option>';
    }

    // Função para atualizar a lista de pedido e o total
    function updateOrderDisplay() {
        currentOrderList.innerHTML = '';
        let total = 0;
        currentOrder.forEach((item, index) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                ${item.name} (x${item.quantity}) - R$ ${(item.price * item.quantity).toFixed(2)}
                <button class="remove-item-btn" data-index="${index}">Remover</button>
            `;
            currentOrderList.appendChild(listItem);
            total += item.price * item.quantity;
        });
        orderTotalSpan.textContent = `R$ ${total.toFixed(2)}`;
    }

    // Adicionar item ao pedido (lógica frontend)
    addItemToOrderBtn.addEventListener('click', () => {
        const selectedOption = itemSelect.options[itemSelect.selectedIndex];
        const selectedItemId = selectedOption.value;
        const selectedItemName = selectedOption.textContent.split('(')[0].trim();
        const selectedItemPrice = parseFloat(selectedOption.dataset.price);
        const quantity = parseInt(quantityInput.value);

        if (selectedItemId && quantity > 0) {
            const existingItemIndex = currentOrder.findIndex(item => item.id === selectedItemId);
            if (existingItemIndex > -1) {
                currentOrder[existingItemIndex].quantity += quantity;
            } else {
                currentOrder.push({
                    id: selectedItemId,
                    name: selectedItemName,
                    price: selectedItemPrice,
                    quantity: quantity
                });
            }
            updateOrderDisplay();
            quantityInput.value = 1; // Reseta a quantidade
            itemSelect.value = ""; // Reseta a seleção
        } else {
            alert('Selecione um item e insira uma quantidade válida.');
        }
    });

    // Remover item do pedido (lógica frontend)
    currentOrderList.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-item-btn')) {
            const indexToRemove = parseInt(event.target.dataset.index);
            currentOrder.splice(indexToRemove, 1);
            updateOrderDisplay();
        }
    });


    // 2. Confirmar Pedido
    confirmOrderBtn.addEventListener('click', async () => {
        if (currentOrder.length === 0) {
            alert('Adicione itens ao pedido antes de confirmar.');
            return;
        }

        // Mapeia currentOrder para o formato esperado pelo backend
        const orderItemsForBackend = currentOrder.map(item => ({
            item_id: item.id,
            quantity: item.quantity
        }));

        try {
            const response = await fetch(`${API_BASE_URL}/api/pedidos`, { // Assumindo /api/pedidos para registrar pedidos
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ items: orderItemsForBackend }),
            });

            if (response.status === 401 || response.status === 403) {
                alert('Sessão expirada ou acesso negado. Faça login novamente.');
                localStorage.removeItem('accessToken');
                window.location.href = '../index.html';
                return;
            }

            const data = await response.json();

            if (response.ok) {
                orderConfirmationMessage.innerText = `Pedido #${data.order_id} confirmado com sucesso!`;
                estimatedTimeSpan.innerText = `Tempo estimado de preparo: ${data.estimated_time || 'N/A'} minutos.`;
                currentOrder = []; // Limpa o pedido após a confirmação
                updateOrderDisplay(); // Atualiza a exibição
            } else {
                orderConfirmationMessage.innerText = data.message || 'Erro ao confirmar pedido.';
                console.error('Erro ao confirmar pedido:', data);
            }
        } catch (error) {
            console.error('Erro na requisição de confirmação de pedido:', error);
            orderConfirmationMessage.innerText = 'Não foi possível conectar ao servidor para confirmar o pedido.';
        }
    });
});