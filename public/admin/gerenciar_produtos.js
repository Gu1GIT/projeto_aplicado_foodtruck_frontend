// public/admin/gerenciar_produtos.js
// Lógica para operações CRUD de produtos.

document.addEventListener('DOMContentLoaded', async () => {
    // --- Configurações e Referências ---
    const API_BASE_URL = window.API_BASE_URL ; 

    const ELEMENTS = {
        logoutBtn: document.getElementById('logoutBtn'),
        productsList: document.getElementById('productsList'),
        productsPaginationInfo: document.getElementById('productsPaginationInfo'),
        fetchProductsBtn: document.getElementById('fetchProductsBtn'),
        offsetInput: document.getElementById('offset'),
        limitInput: document.getElementById('limit'),

        createProductForm: document.getElementById('createProductForm'),
        createProductMessage: document.getElementById('createProductMessage'),
        createName: document.getElementById('createName'),
        createDescription: document.getElementById('createDescription'),
        createPrice: document.getElementById('createPrice'),
        createCategory: document.getElementById('createCategory'),

        getProductIdInput: document.getElementById('getProductId'),
        getProductBtn: document.getElementById('getProductBtn'),
        updateProductForm: document.getElementById('updateProductForm'),
        currentProductIdSpan: document.getElementById('currentProductId'),
        productDetailMessage: document.getElementById('productDetailMessage'),
        updateName: document.getElementById('updateName'),
        updateDescription: document.getElementById('updateDescription'),
        updatePrice: document.getElementById('updatePrice'),
        updateCategory: document.getElementById('updateCategory'),
        submitPatchButton: document.getElementById('submitPatchButton'),
        deleteProductBtn: document.getElementById('deleteProductBtn'),
    };

    const MESSAGES = {
        authRequired: 'Você precisa estar logado para acessar esta página.',
        sessionExpired: 'Sessão expirada ou acesso negado. Faça login novamente.',
        loadingProducts: 'Carregando produtos...',
        noProductsFound: 'Nenhum produto encontrado.',
        errorFetchingProducts: 'Erro ao carregar produtos.',
        serverConnectionError: 'Não foi possível conectar ao servidor.',
        nameRequired: 'O Nome do produto é obrigatório.',
        priceInvalid: 'O Preço deve ser um número válido maior que zero.',
        productCreatedSuccess: (name, id) => `Produto '${name}' (ID: ${id}) criado com sucesso!`,
        productCreatedSuccessNoId: 'Produto criado com sucesso! (ID não disponível na resposta da API)',
        errorCreatingProduct: 'Erro ao criar produto.',
        idRequired: 'Por favor, insira um ID de produto.',
        productLoadedForEdit: (id) => `Produto ID ${id} carregado para edição.`,
        productNotFound: (id) => `Produto ID ${id} não encontrado.`,
        errorFetchingProduct: 'Erro ao buscar produto.',
        noFieldsToPatch: 'Nenhum campo para atualização parcial foi modificado.',
        productUpdatedSuccess: (id) => `Produto ID ${id} atualizado com sucesso!`,
        errorUpdatingProduct: 'Erro ao atualizar produto.',
        noProductSelected: 'Nenhum produto selecionado para ',
        confirmDelete: (id) => `Tem certeza que deseja deletar o produto ID ${id}?`,
        productDeletedSuccess: (id) => `Produto ID ${id} deletado com sucesso!`,
        errorDeletingProduct: 'Erro ao deletar produto.',
    };

    let currentEditProductId = null; // Para rastrear qual produto está sendo editado
    const accessToken = localStorage.getItem('accessToken');

    // --- Validação de Autenticação Inicial ---
    if (!accessToken) {
        alert(MESSAGES.authRequired);
        window.location.href = '../index.html'; // Redirecionar para a página de login
        return; // Impede que o restante do script seja executado sem o token
    }

    // --- Funções Auxiliares ---

    /**
     * Exibe uma mensagem em um elemento HTML especificado.
     * @param {HTMLElement} element - O elemento HTML onde a mensagem será exibida.
     * @param {string} message - O texto da mensagem.
     * @param {string} type - O tipo da mensagem ('success', 'error', 'warning').
     */
    function displayMessage(element, message, type) {
        element.innerText = message;
        switch (type) {
            case 'success':
                element.style.color = 'green';
                break;
            case 'error':
                element.style.color = 'red';
                break;
            case 'warning':
                element.style.color = 'orange';
                break;
            default:
                element.style.color = 'black'; // Cor padrão
        }
    }

    /**
     * Limpa os campos de um formulário.
     * @param {HTMLFormElement} form - O formulário a ser limpo.
     */
    function clearForm(form) {
        form.reset();
    }

    /**
     * Função genérica para fazer requisições à API.
     * Lida com autenticação e tratamento de erros comuns.
     * @param {string} url - A URL do endpoint da API.
     * @param {object} options - Opções para a requisição fetch.
     * @returns {Promise<object|null>} Os dados da resposta JSON ou null em caso de erro.
     */
    async function fetchData(url, options) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${accessToken}`,
                    'accept': 'application/json'
                },
            });

            if (response.status === 401 || response.status === 403) {
                displayMessage(ELEMENTS.productDetailMessage, MESSAGES.sessionExpired, 'error'); // Usar um elemento mais genérico para esta mensagem
                localStorage.removeItem('accessToken');
                window.location.href = '../index.html';
                return null; // Indica que o erro de autenticação foi tratado
            }

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data.detail || data.message || response.statusText;
                console.error(`Erro na requisição para ${url}:`, errorMessage, data);
                throw new Error(errorMessage); // Lança um erro para ser pego pelo catch externo
            }
            return data;
        } catch (error) {
            console.error('Erro na requisição:', error);
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.serverConnectionError, 'error');
            return null;
        }
    }

    // --- Lógica de Logout ---
    if (ELEMENTS.logoutBtn) {
        ELEMENTS.logoutBtn.addEventListener('click', (event) => {
            event.preventDefault();
            localStorage.removeItem('accessToken');
            window.location.href = '../index.html';
        });
    }

    // --- Operações CRUD de Produtos ---

    // GET /api/v1/products/ (Fetch Products)
    async function fetchProducts() {
        ELEMENTS.productsList.innerHTML = `<li>${MESSAGES.loadingProducts}</li>`;
        ELEMENTS.productsPaginationInfo.innerText = '';

        const offset = ELEMENTS.offsetInput.value;
        const limit = ELEMENTS.limitInput.value;
        const queryParams = new URLSearchParams({ offset, limit });

        const data = await fetchData(`${API_BASE_URL}/api/v1/products/?${queryParams.toString()}`, {
            method: 'GET',
        });

        if (data) {
            ELEMENTS.productsList.innerHTML = '';
            const items = data.products;

            if (!items || items.length === 0) {
                ELEMENTS.productsList.innerHTML = `<li>${MESSAGES.noProductsFound}</li>`;
            } else {
                items.forEach(item => {
                    const listItem = document.createElement('li');
                    listItem.innerHTML = `
                        <strong>ID:</strong> ${item.id}<br>
                        <strong>Nome:</strong> ${item.name}<br>
                        <strong>Preço:</strong> R$ ${item.price ? item.price.toFixed(2) : 'N/A'}<br>
                         <strong>Descrição:</strong> ${item.description || 'N/A'}<br>
                        <strong>Categoria:</strong> ${item.category || 'N/A'}<br>
                    `;
                    listItem.style.cursor = 'pointer';
                    listItem.title = 'Clique para carregar este produto';
                    listItem.addEventListener('click', () => {
                        ELEMENTS.getProductIdInput.value = item.id;
                        ELEMENTS.getProductBtn.click();
                    });
                    ELEMENTS.productsList.appendChild(listItem);
                });
                const pagination = data.pagination;
                ELEMENTS.productsPaginationInfo.innerText = `Página: ${pagination.page} de ${pagination.total_pages} (Total: ${pagination.total_count} produtos)`;
            }
        } else {
            ELEMENTS.productsList.innerHTML = `<li>${MESSAGES.errorFetchingProducts}</li>`;
        }
    }

    // POST /api/v1/products/ (Create Product)
    async function createProduct(event) {
        event.preventDefault();
        displayMessage(ELEMENTS.createProductMessage, '', 'default'); // Limpa mensagens anteriores

        const newProduct = {
            name: ELEMENTS.createName.value,
            description: ELEMENTS.createDescription.value,
            price: parseFloat(ELEMENTS.createPrice.value),
            category: ELEMENTS.createCategory.value,
        };

        // Validação básica no frontend
        if (!newProduct.name || newProduct.name.trim() === '') {
            displayMessage(ELEMENTS.createProductMessage, MESSAGES.nameRequired, 'error');
            return;
        }
        if (isNaN(newProduct.price) || newProduct.price <= 0) {
            displayMessage(ELEMENTS.createProductMessage, MESSAGES.priceInvalid, 'error');
            return;
        }

        const data = await fetchData(`${API_BASE_URL}/api/v1/products/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProduct)
        });

        if (data) {
            if (data.id) {
                displayMessage(ELEMENTS.createProductMessage, MESSAGES.productCreatedSuccess(newProduct.name, data.id), 'success');
            } else {
                displayMessage(ELEMENTS.createProductMessage, MESSAGES.productCreatedSuccessNoId, 'warning');
            }
            clearForm(ELEMENTS.createProductForm);
            fetchProducts(); // Recarrega a lista
        } else {
            displayMessage(ELEMENTS.createProductMessage, MESSAGES.errorCreatingProduct, 'error');
        }
    }

    // GET /api/v1/products/{product_id} (Get Product By Id)
    async function getProductById() {
        const productId = ELEMENTS.getProductIdInput.value.trim();
        displayMessage(ELEMENTS.productDetailMessage, '', 'default');
        ELEMENTS.updateProductForm.style.display = 'none';

        if (!productId) {
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.idRequired, 'error');
            return;
        }

        const data = await fetchData(`${API_BASE_URL}/api/v1/products/${productId}`, {
            method: 'GET',
        });

        if (data) {
            currentEditProductId = productId;
            ELEMENTS.currentProductIdSpan.innerText = productId;

            ELEMENTS.updateName.value = data.name || '';
            ELEMENTS.updateDescription.value = data.description || '';
            ELEMENTS.updatePrice.value = data.price || '';
            ELEMENTS.updateCategory.value = data.category || '';

            ELEMENTS.updateProductForm.style.display = 'block';
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.productLoadedForEdit(productId), 'success');
        } else {
            // fetchData já trata erros de conexão e autenticação
            // Aqui podemos adicionar tratamento para 404 especificamente se fetchData não o fizer
            // Por simplicidade, fetchData lança erro, então o 'null' já cobre
            if (productId && ELEMENTS.productDetailMessage.innerText === MESSAGES.serverConnectionError) {
                // Se o erro foi de conexão, a mensagem já está lá
            } else {
                displayMessage(ELEMENTS.productDetailMessage, MESSAGES.productNotFound(productId), 'warning');
            }
        }
    }

    // PATCH /api/v1/products/{product_id} (Patch Product)
    async function patchProduct() {
        if (!currentEditProductId) {
            alert(`${MESSAGES.noProductSelected}atualização parcial.`);
            return;
        }
        displayMessage(ELEMENTS.productDetailMessage, '', 'default');

        const patchData = {};
        const name = ELEMENTS.updateName.value;
        const description = ELEMENTS.updateDescription.value;
        const price = parseFloat(ELEMENTS.updatePrice.value);
        const category = ELEMENTS.updateCategory.value;

        if (name) patchData.name = name;
        if (description) patchData.description = description;
        if (!isNaN(price) && price > 0) patchData.price = price;
        if (category) patchData.category = category;

        if (Object.keys(patchData).length === 0) {
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.noFieldsToPatch, 'warning');
            return;
        }

        const data = await fetchData(`${API_BASE_URL}/api/v1/products/${currentEditProductId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchData)
        });

        if (data) {
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.productUpdatedSuccess(currentEditProductId), 'success');
            fetchProducts();
        } else {
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.errorUpdatingProduct, 'error');
        }
    }

    // DELETE /api/v1/products/{product_id} (Delete Product)
    async function deleteProduct() {
        if (!currentEditProductId) {
            alert(`${MESSAGES.noProductSelected}exclusão.`);
            return;
        }
        displayMessage(ELEMENTS.productDetailMessage, '', 'default');

        if (!confirm(MESSAGES.confirmDelete(currentEditProductId))) {
            return;
        }

        const data = await fetchData(`${API_BASE_URL}/api/v1/products/${currentEditProductId}`, {
            method: 'DELETE',
        });

        // Para DELETE, data pode ser vazia se a resposta for 204 No Content
        // A função fetchData já verifica response.ok, então se não for null, a operação foi bem-sucedida.
        if (data !== null) { // Se a requisição não retornou erro (mesmo que a resposta seja vazia)
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.productDeletedSuccess(currentEditProductId), 'success');
            ELEMENTS.updateProductForm.style.display = 'none';
            currentEditProductId = null;
            ELEMENTS.getProductIdInput.value = '';
            fetchProducts();
        } else {
            // A mensagem de erro já foi definida por fetchData se houver um erro de rede/auth
            // Caso contrário, significa que a API retornou um erro específico no data.detail/message
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.errorDeletingProduct, 'error');
        }
    }

    // --- Chamadas Iniciais e Event Listeners ---
    ELEMENTS.fetchProductsBtn.addEventListener('click', fetchProducts);
    ELEMENTS.createProductForm.addEventListener('submit', createProduct);
    ELEMENTS.getProductBtn.addEventListener('click', getProductById);
    ELEMENTS.submitPatchButton.addEventListener('click', patchProduct);
    ELEMENTS.deleteProductBtn.addEventListener('click', deleteProduct);

    // Carrega os produtos ao iniciar a página
    fetchProducts();
});