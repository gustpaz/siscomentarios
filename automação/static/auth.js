// Função para gerenciar o logout
async function handleLogout() {
    try {
        // Primeiro libera a máquina
        const liberarResponse = await fetch('/api/auth/liberar-maquina', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: sessionStorage.getItem('user_email'),
                machineId: localStorage.getItem('machine_id')
            })
        });
        
        // Depois faz o logout
        const logoutResponse = await fetch('/logout', { method: 'GET' });
        
        // Limpa a sessão e redireciona
        sessionStorage.clear();
        window.location.href = '/login';
    } catch (error) {
        console.error('Erro:', error);
        // Mesmo com erro, tenta fazer logout
        window.location.href = '/login';
    }
}

// Função para gerenciar o encerramento
async function handleEncerramento() {
    if (!confirm('Tem certeza que deseja encerrar o sistema?')) {
        return;
    }

    try {
        // Primeiro libera a máquina
        const liberarResponse = await fetch('/api/auth/liberar-maquina', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: sessionStorage.getItem('user_email'),
                machineId: localStorage.getItem('machine_id')
            })
        });
        
        // Limpa a sessão
        sessionStorage.clear();
        
        // Então encerra o servidor
        alert('Sistema está sendo encerrado...');
        
        // Faz a chamada para encerrar o servidor
        const response = await fetch('/encerrar', { method: 'GET' });
        
        // Aguarda um pouco antes de redirecionar
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000); // Aumentei o tempo para 2 segundos para dar mais tempo ao servidor
        
    } catch (error) {
        console.error('Erro:', error);
        // Mesmo com erro, tenta redirecionar
        window.location.href = '/login';
    }
}

// Adiciona os event listeners aos botões quando o documento carregar
document.addEventListener('DOMContentLoaded', function() {
    // Gera e armazena um ID único para a máquina se ainda não existir
    if (!localStorage.getItem('machine_id')) {
        const machineId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('machine_id', machineId);
    }
    
    // Armazena o email do usuário na sessão se estiver disponível
    const userEmail = document.querySelector('.user-email');
    if (userEmail) {
        const email = userEmail.textContent.trim();
        sessionStorage.setItem('user_email', email);
    }
    
    const logoutBtn = document.querySelector('[onclick*="logout"]');
    const encerrarBtn = document.querySelector('[onclick*="encerrar"]');
    
    if (logoutBtn) {
        logoutBtn.onclick = (e) => {
            e.preventDefault();
            handleLogout();
        };
    }
    
    if (encerrarBtn) {
        encerrarBtn.onclick = (e) => {
            e.preventDefault();
            handleEncerramento();
        };
    }
});
