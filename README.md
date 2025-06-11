# projeto_aplicado_foodtruck_frontend

Projeto Aplicado: Food Truck
Este projeto consiste em uma aplicação completa para gerenciar um negócio de food truck, dividida em dois módulos principais: Frontend (a interface do usuário) e Backend (a lógica de negócios e API).

Este repositório é dedicado ao Frontend da aplicação.

# Visão Geral do Projeto
Este sistema tem como objetivo principal otimizar a gestão de operações de food trucks, desde o gerenciamento de cardápios e pedidos até a interação com o cliente.

# Tecnologias Utilizadas
## Frontend
O lado do cliente desta aplicação é construído utilizando as seguintes tecnologias:

HTML: Estrutura fundamental das páginas web.
CSS: Estilização e design da interface do usuário.
JavaScript: Interatividade e lógica do lado do cliente.

## Backend
O backend, responsável pela lógica de negócios e comunicação com o banco de dados, está em um repositório separado e utiliza:

Python: Linguagem de programação principal.
FastAPI: Framework web moderno e de alta performance para construir APIs.

Para rodar este projeto em sua máquina local, siga os passos abaixo. Certifique-se de que você tem o Node.js/npm e o Python/pip instalados.

# 1. Configurar o Backend
Primeiro, você precisará clonar e configurar o repositório do backend.

Clone o repositório do Backend:

````
git clone https://github.com/bentoluizv/projeto_aplicado_foodtruck.git
cd projeto_aplicado_foodtruck
````

# 2. Configurar o Frontend
Agora, vamos configurar e rodar a interface do usuário.

Clone o repositório do Frontend:

````
git clone https://github.com/Gu1GIT/projeto_aplicado_foodtruck_frontend.git
cd projeto_aplicado_foodtruck_frontend
````

Execute o Frontend: Para projetos puros de HTML/CSS/JS, você pode simplesmente abrir o arquivo index.html no seu navegador. Se houver um servidor de desenvolvimento configurado (como live-server ou similar), execute-o:



# Entendendo assets/js/common.js
O arquivo assets/js/common.js centraliza a URL base do backend (API_BASE_URL) e outras variáveis/funções comuns para que o frontend se comunique corretamente com o servidor.


````
const API_BASE_URL = 'http://localhost:8000/';
````
Se o seu backend não estiver rodando na porta HTTP padrão (porta 80, que é a implícita quando não há um número de porta na URL), você precisará modificar essa URL para incluir a porta correta.


