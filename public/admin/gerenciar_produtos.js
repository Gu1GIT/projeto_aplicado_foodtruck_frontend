// public/admin/gerenciar_produtos.js
// Lógica para operações CRUD de produtos.

console.log('>>> gerenciar_produtos.js está sendo carregado!'); // Log de depuração

document.addEventListener('DOMContentLoaded', async () => {
    console.log('>>> DOMContentLoaded disparado no gerenciar_produtos.js!'); // Log de depuração

    // --- Referências aos elementos HTML ---
    const logoutBtn = document.getElementById('logoutBtn');
    const productsList = document.getElementById('productsList');
    const productsPaginationInfo = document.getElementById('productsPaginationInfo');
    const fetchProductsBtn = document.getElementById('fetchProductsBtn');
    const offsetInput = document.getElementById('offset');
    const limitInput = document.getElementById('limit');

    const createProductForm = document.getElementById('createProductForm');
    const createProductMessage = document.getElementById('createProductMessage');

    const getProductIdInput = document.getElementById('getProductId');
    const getProductBtn = document.getElementById('getProductBtn');
    const updateProductForm = document.getElementById('updateProductForm');
    const currentProductIdSpan = document.getElementById('currentProductId');
    const productDetailMessage = document.getElementById('productDetailMessage');
    const submitPatchButton = document.getElementById('submitPatchButton');
    const deleteProductBtn = document.getElementById('deleteProductBtn');

    let currentEditProductId = null; // Para rastrear qual produto está sendo editado

    // --- OBTENÇÃO DO TOKEN DE ACESSO ---
    const accessToken = localStorage.getItem('accessToken');

    if (!accessToken) {
        alert('Você precisa estar logado para acessar esta página.');
        window.location.href = '../index.html'; // Redirecionar para a página de login
        return; // Impede que o restante do script seja executado sem o token
    }

    // --- Lógica de Logout ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (event) => {
            event.preventDefault();
            localStorage.removeItem('accessToken'); // Limpa o token
            window.location.href = '../index.html'; // Redireciona para o login
        });
    }

    // --- Função auxiliar para lidar com respostas da API (401/403 - Autenticação/Autorização) ---
    function handleAuthError(response) {
        if (response.status === 401 || response.status === 403) {
            alert('Sessão expirada ou acesso negado. Faça login novamente.');
            localStorage.removeItem('accessToken'); // Limpa o token expirado/inválido
            window.location.href = '../index.html';
            return true; // Indica que o erro de autenticação foi tratado
        }
        return false; // Indica que não foi um erro de autenticação/autorização
    }

    // --- GET /api/v1/products/ (Fetch Products) ---
    async function fetchProducts() {
        productsList.innerHTML = '<li>Carregando produtos...</li>';
        productsPaginationInfo.innerText = '';
        const offset = offsetInput.value;
        const limit = limitInput.value;

        try {
            const queryParams = new URLSearchParams({ offset, limit });
            const response = await fetch(`${API_BASE_URL}/api/v1/products/?${queryParams.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'accept': 'application/json'
                }
            });

            if (handleAuthError(response)) return;

            const data = await response.json();

            if (response.ok) {
                productsList.innerHTML = '';
                // Acessa 'data.products' para a listagem (conforme o formato JSON fornecido)
                const items = data.products; 

                if (!items || items.length === 0) {
                    productsList.innerHTML = '<li>Nenhum produto encontrado.</li>';
                } else {
                    items.forEach(item => {
                        const listItem = document.createElement('li');
                        listItem.innerHTML = `
                            <strong>ID:</strong> ${item.id}<br>
                            <strong>Nome:</strong> ${item.name}<br>
                            <strong>Preço:</strong> R$ ${item.price ? item.price.toFixed(2) : 'N/A'}<br>
                            <strong>Categoria:</strong> ${item.category || 'N/A'}<br>
                         
                        `;
                        // Adiciona o clique para preencher o campo de busca
                    listItem.style.cursor = 'pointer';
                    listItem.title = 'Clique para carregar este produto';
                    listItem.addEventListener('click', () => {
                        getProductIdInput.value = item.id;
                        getProductBtn.click();
                    });
                        productsList.appendChild(listItem);
                    });
                    const pagination = data.pagination;
                    productsPaginationInfo.innerText = `Página: ${pagination.page} de ${pagination.total_pages} (Total: ${pagination.total_count} produtos)`;
                }
            } else {
                productsList.innerHTML = '<li>Erro ao carregar produtos.</li>';
                console.error('Erro ao carregar produtos:', data.detail || data.message || response.statusText);
            }
        } catch (error) {
            console.error('Erro na requisição de produtos:', error);
            productsList.innerHTML = '<li>Não foi possível conectar ao servidor.</li>';
        }
    }

    // --- Chamadas Iniciais e Event Listeners ---
    fetchProductsBtn.addEventListener('click', fetchProducts);
    fetchProducts();

    // --- POST /api/v1/products/ (Create Product) ---
    createProductForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        createProductMessage.innerText = ''; // Limpa mensagens anteriores

        // Coleta os dados dos campos do formulário de criação
        const newProduct = { // <-- newProduct já contém o nome digitado!
            name: document.getElementById('createName').value,
            description: document.getElementById('createDescription').value,
            price: parseFloat(document.getElementById('createPrice').value),
            category: document.getElementById('createCategory').value,
        };

        // Validação básica no frontend
        if (!newProduct.name || newProduct.name.trim() === '') {
            createProductMessage.style.color = 'red';
            createProductMessage.innerText = 'O Nome do produto é obrigatório.';
            return;
        }
        if (isNaN(newProduct.price) || newProduct.price <= 0) {
            createProductMessage.style.color = 'red';
            createProductMessage.innerText = 'O Preço deve ser um número válido maior que zero.';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/products/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newProduct)
            });

            if (handleAuthError(response)) return;

            const data = await response.json(); // Data agora é {id: ..., action: ...}

            if (response.ok) { // Se a requisição foi bem-sucedida (status 2xx, ex: 201 Created)
                createProductMessage.style.color = 'green';
                
                // --- DEBUG LOGS ---
                console.log('Dados completos da resposta da API (POST create):', data); 
                console.log('ID do produto retornado pela API:', data.id);
                // --- FIM DEBUG LOGS ---

                // *** CORREÇÃO AQUI: Usar newProduct.name (do formulário) e data.id (da resposta da API) ***
                if (data.id) { // Verifica se o ID foi retornado
                    // Usa o nome que foi digitado no formulário, já que a API não o retorna
                    createProductMessage.innerText = `Produto '${newProduct.name}' (ID: ${data.id}) criado com sucesso!`;
                } else {
                    // Fallback caso nem o ID seja retornado (cenário improvável se o `response.ok` é true)
                    createProductMessage.innerText = `Produto criado com sucesso! (ID não disponível na resposta da API)`;
                    console.warn('Resposta da API de criação de produto não contém o ID esperado:', data);
                }
                
                createProductForm.reset(); // Limpa o formulário após sucesso
                fetchProducts(); // Recarrega a lista de produtos para exibir o recém-criado
            } else { // Se houve um erro na resposta (status 4xx ou 5xx)
                createProductMessage.style.color = 'red';
                createProductMessage.innerText = data.detail || data.message || `Erro ao criar produto: ${response.statusText}`;
                console.error('Erro ao criar produto:', data);
            }
        } catch (error) { // Erros de rede ou outros erros na requisição
            console.error('Erro na requisição de criação de produto:', error);
            createProductMessage.style.color = 'red';
            createProductMessage.innerText = 'Não foi possível conectar ao servidor para criar o produto.';
        }
    });

    // --- GET /api/v1/products/{product_id} (Get Product By Id) ---
    getProductBtn.addEventListener('click', async () => {
        const productId = getProductIdInput.value.trim();
        productDetailMessage.innerText = '';
        updateProductForm.style.display = 'none'; // Esconde o formulário de edição

        if (!productId) {
            productDetailMessage.style.color = 'red';
            productDetailMessage.innerText = 'Por favor, insira um ID de produto.';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/products/${productId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'accept': 'application/json'
                }
            });

            if (handleAuthError(response)) return;

            const data = await response.json();

            if (response.ok) {
                currentEditProductId = productId; // Armazena o ID do produto que está sendo editado
                currentProductIdSpan.innerText = productId;

                // Preenche o formulário de atualização com os dados do produto
                document.getElementById('updateName').value = data.name || '';
                document.getElementById('updateDescription').value = data.description || '';
                document.getElementById('updatePrice').value = data.price || '';
                document.getElementById('updateCategory').value = data.category || '';

                updateProductForm.style.display = 'block'; // Mostra o formulário de edição
                productDetailMessage.style.color = 'green';
                productDetailMessage.innerText = `Produto ID ${productId} carregado para edição.`;
            } else if (response.status === 404) {
                productDetailMessage.style.color = 'orange';
                productDetailMessage.innerText = `Produto ID ${productId} não encontrado.`;
            } else {
                productDetailMessage.style.color = 'red';
                productDetailMessage.innerText = data.detail || data.message || 'Erro ao buscar produto.';
                console.error('Erro ao buscar produto:', data);
            }
        } catch (error) {
            console.error('Erro na requisição de buscar produto:', error);
            productDetailMessage.style.color = 'red';
            productDetailMessage.innerText = 'Não foi possível conectar ao servidor para buscar o produto.';
        }
    });

   
    // --- PATCH /api/v1/products/{product_id} (Patch Product) ---
    submitPatchButton.addEventListener('click', async () => {
        if (!currentEditProductId) {
            alert('Nenhum produto selecionado para atualização parcial.');
            return;
        }
        productDetailMessage.innerText = '';

        // Cria um objeto apenas com os campos que foram modificados no formulário
        const patchData = {};
        const name = document.getElementById('updateName').value;
        const description = document.getElementById('updateDescription').value;
        const price = parseFloat(document.getElementById('updatePrice').value);
        const category = document.getElementById('updateCategory').value;

        // Adiciona ao patchData apenas se o campo tiver um valor ou se for booleano
        if (name) patchData.name = name;
        if (description) patchData.description = description;
        if (!isNaN(price) && price > 0) patchData.price = price;
        if (category) patchData.category = category;
       
        if (Object.keys(patchData).length === 0) {
            productDetailMessage.style.color = 'orange';
            productDetailMessage.innerText = 'Nenhum campo para atualização parcial foi modificado.';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/products/${currentEditProductId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(patchData)
            });

            if (handleAuthError(response)) return;

            const data = await response.json();

            if (response.ok) {
                productDetailMessage.style.color = 'green';
                productDetailMessage.innerText = `Produto ID ${currentEditProductId} atualizado (PATCH) com sucesso!`;
                fetchProducts(); // Recarrega a lista
            } else {
                productDetailMessage.style.color = 'red';
                productDetailMessage.innerText = data.detail || data.message || 'Erro ao atualizar produto (PATCH).';
                console.error('Erro ao atualizar produto (PATCH):', data);
            }
        } catch (error) {
            console.error('Erro na requisição de atualização (PATCH):', error);
            productDetailMessage.style.color = 'red';
            productDetailMessage.innerText = 'Não foi possível conectar ao servidor para atualizar o produto.';
        }
    });

    // --- DELETE /api/v1/products/{product_id} (Delete Product) ---
    deleteProductBtn.addEventListener('click', async () => {
        if (!currentEditProductId) {
            alert('Nenhum produto selecionado para exclusão.');
            return;
        }
        productDetailMessage.innerText = '';

        if (!confirm(`Tem certeza que deseja deletar o produto ID ${currentEditProductId}?`)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/products/${currentEditProductId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (handleAuthError(response)) return;

            if (response.ok) { // DELETE geralmente retorna 204 No Content ou 200 OK
                productDetailMessage.style.color = 'green';
                productDetailMessage.innerText = `Produto ID ${currentEditProductId} deletado com sucesso!`;
                updateProductForm.style.display = 'none'; // Esconde o formulário
                currentEditProductId = null; // Reseta o ID
                getProductIdInput.value = ''; // Limpa o campo de busca
                fetchProducts(); // Recarrega a lista
            } else {
                const data = await response.json();
                productDetailMessage.style.color = 'red';
                productDetailMessage.innerText = data.detail || data.message || 'Erro ao deletar produto.';
                console.error('Erro ao deletar produto:', data);
            }
        } catch (error) {
            console.error('Erro na requisição de exclusão de produto:', error);
            productDetailMessage.style.color = 'red';
            productDetailMessage.innerText = 'Não foi possível conectar ao servidor para deletar o produto.';
        }
    });
});