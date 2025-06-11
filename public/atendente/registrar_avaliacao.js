// public/atendente/registrar_avaliacao.js
// Lógica para registrar uma avaliação de cliente.

document.addEventListener('DOMContentLoaded', () => {
    const reviewForm = document.getElementById('reviewForm');
    const reviewConfirmationMessage = document.getElementById('reviewConfirmationMessage');
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

    reviewForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const orderId = document.getElementById('orderId').value;
        const rating = parseInt(document.getElementById('rating').value);
        const comments = document.getElementById('comments').value;

        reviewConfirmationMessage.innerText = ''; // Limpa mensagens anteriores

        if (!orderId || isNaN(rating) || rating < 1 || rating > 5) {
            reviewConfirmationMessage.innerText = 'Preencha todos os campos corretamente (Nota de 1 a 5).';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/avaliacoes`, { // Assumindo /api/avaliacoes para registrar avaliações
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    order_id: orderId,
                    note: rating,
                    comment: comments
                }),
            });

            if (response.status === 401 || response.status === 403) {
                alert('Sessão expirada ou acesso negado. Faça login novamente.');
                localStorage.removeItem('accessToken');
                window.location.href = '../index.html';
                return;
            }

            const data = await response.json();

            if (response.ok) {
                reviewConfirmationMessage.innerText = 'Avaliação registrada com sucesso!';
                reviewForm.reset(); // Limpa o formulário
            } else {
                reviewConfirmationMessage.innerText = data.message || 'Erro ao registrar avaliação.';
                console.error('Erro ao registrar avaliação:', data);
            }
        } catch (error) {
            console.error('Erro na requisição de avaliação:', error);
            reviewConfirmationMessage.innerText = 'Não foi possível conectar ao servidor para registrar a avaliação.';
        }
    });
});