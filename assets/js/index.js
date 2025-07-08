// public/index.js
// Lógica de manipulação do formulário de login e chamada à API de autenticação.

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const roleGroup = document.getElementById('role-group');
    const roleSelect = document.getElementById('role');

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            errorMessage.style.display = 'block';
            errorMessage.innerText = '';

            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            try {
                const response = await fetch(`${API_BASE_URL}/api/v1/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData.toString(),
                });

                const data = await response.json();
                console.log('Resposta da API:', data);

                if (response.ok) {
                    localStorage.setItem('accessToken', data.access_token);
                  
                    const userRole = data.user?.role;
                    localStorage.setItem('userRole', userRole);
                    
                    if (userRole === 'attendant') {
                        window.location.href = './atendente/menu.html';
                    } else if (userRole === 'kitchen') {
                        window.location.href = './chapeiro/preparar_pedidos.html';
                    } else if (userRole === 'admin') {
                        // Mostra o campo de seleção de perfil
                        roleGroup.style.display = 'block';
                        errorMessage.innerText = 'Selecione o perfil para acessar.';

                        // Espera o admin escolher e redireciona
                        roleSelect.addEventListener('change', function onChange() {
                            if (roleSelect.value === 'atendente') {
                                window.location.href = './atendente/menu.html';
                            } else if (roleSelect.value === 'chapeiro') {
                                window.location.href = './chapeiro/preparar_pedidos.html';
                            }
                            // Remove o listener após o uso
                            roleSelect.removeEventListener('change', onChange);
                        });
                    } else {
                        errorMessage.innerText = 'Tipo de usuário não reconhecido.';
                    }
                } else {
                    errorMessage.innerText = data.detail || data.message || 'Usuário ou senha inválidos.';
                    console.error('Erro de login:', data);
                }
            } catch (error) {
                console.error('Erro na requisição de login:', error);
                errorMessage.innerText = 'Ocorreu um erro ao tentar fazer login. Verifique sua conexão.';
            }
        });
    }
});