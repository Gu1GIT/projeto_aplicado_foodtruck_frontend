// public/atendente/acompanhar_pedidos.js
// Lógica para carregar e exibir pedidos.

document.addEventListener('DOMContentLoaded', async () => {
    const ordersTableBody = document.querySelector('#ordersTable tbody');
    const loadingMessage = document.getElementById('loadingMessage');
    const noOrdersMessage = document.getElementById('noOrdersMessage');
    const logoutBtn = document.getElementById('logoutBtn');

    const accessToken = localStorage.getItem('accessToken');

    if (!accessToken) {
        alert('Você precisa estar logado para acessar esta página.');
        window.location.href = '../index.html'; // Redirecionar para a página de login
        return;
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (event) => {
            event.preventDefault();
            localStorage.removeItem('accessToken');
            localStorage.removeItem('currentOrder'); // Limpa qualquer pedido em andamento
            window.location.href = '../index.html';
        });
    }

    // --- Função auxiliar para lidar com respostas da API (401/403 - Autenticação/Autorização) ---
    function handleAuthError(response) {
        if (response.status === 401 || response.status === 403) {
            alert('Sessão expirada ou acesso negado. Faça login novamente.');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('currentOrder');
            window.location.href = '../index.html';
            return true;
        }
        return false;
    }

    // --- FUNÇÃO PARA CARREGAR E EXIBIR OS PEDIDOS ---
    async function fetchOrders() {
        loadingMessage.style.display = 'block';
        ordersTableBody.innerHTML = ''; // Limpa a tabela
        noOrdersMessage.style.display = 'none';

        try {
            const offset = 0; // Para paginação futura
            const limit = 100; // Para paginação futura

            const queryParams = new URLSearchParams({
                offset: offset,
                limit: limit
            });

            const response = await fetch(`${API_BASE_URL}/api/v1/orders/?${queryParams.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'accept': 'application/json'
                }
            });

            if (handleAuthError(response)) return;

            const result = await response.json(); // <-- Renomeado para 'result' para clareza

            if (response.ok) {
                // AQUI ESTÁ A MUDANÇA: acesse a propriedade 'orders'
                const orders = result.orders; 

                if (!orders || orders.length === 0) {
                    noOrdersMessage.style.display = 'block';
                    loadingMessage.style.display = 'none';
                    return;
                }

                orders.forEach(order => { // <-- AGORA USAMOS 'orders.forEach'
                    const row = ordersTableBody.insertRow();
                    row.insertCell(0).textContent = order.id.substring(0, 8) + '...'; // Mostra apenas parte do ID
                    row.insertCell(1).textContent = order.table_number;
                    row.insertCell(2).textContent = `R$ ${order.total ? order.total.toFixed(2) : 'N/A'}`; // Use 'total' conforme o JSON
                    row.insertCell(3).textContent = order.status;
                    row.insertCell(4).textContent = new Date(order.created_at).toLocaleString();
                    row.insertCell(5).textContent = order.notes || 'N/A';
                    
                    const actionsCell = row.insertCell(6);
                    const detailsButton = document.createElement('button');
                    detailsButton.textContent = 'Ver Detalhes';
                    detailsButton.classList.add('details-btn');
                    detailsButton.addEventListener('click', () => {
                        // O JSON não inclui os itens do pedido diretamente no objeto 'order',
                        // então 'order.items' será indefinido.
                        // Se você quiser mostrar os itens, precisará modificar o endpoint GET do backend
                        // para incluir os itens do pedido no 'OrderResponse'.
                        alert(`Detalhes do Pedido ${order.id}:\n\nMesa: ${order.table_number}\nStatus: ${order.status}\nTotal: R$ ${order.total.toFixed(2)}\nObservações: ${order.notes || 'N/A'}`);
                        console.log('Detalhes completos do pedido:', order);
                    });
                    actionsCell.appendChild(detailsButton);

                    // Futuramente: Botões de ação como "Marcar como Pronto", "Cancelar", etc.
                });
                loadingMessage.style.display = 'none';

            } else {
                loadingMessage.style.display = 'none';
                noOrdersMessage.textContent = `Erro ao carregar pedidos: ${result.detail || result.message || response.statusText}`;
                noOrdersMessage.style.display = 'block';
                console.error('Erro ao carregar pedidos:', result.detail || result.message || response.statusText);
            }
        } catch (error) {
            console.error('Erro na requisição dos pedidos:', error);
            loadingMessage.style.display = 'none';
            noOrdersMessage.textContent = 'Não foi possível conectar ao servidor para carregar os pedidos.';
            noOrdersMessage.style.display = 'block';
        }
    }

    // Chama a função para carregar os pedidos quando a página é carregada
    fetchOrders();
});