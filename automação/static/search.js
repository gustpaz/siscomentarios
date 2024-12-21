document.addEventListener('DOMContentLoaded', function() {
    // Função de busca
    function setupSearch(searchInput, itemSelector) {
        const input = document.getElementById(searchInput);
        if (!input) return;

        input.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            const items = document.querySelectorAll(itemSelector);

            items.forEach(item => {
                const label = item.querySelector('label');
                if (!label) return;
                
                const text = label.textContent.toLowerCase();
                const shouldShow = text.includes(searchTerm);
                
                // Animação suave de fade
                if (shouldShow) {
                    item.style.display = '';
                    item.style.opacity = '1';
                } else {
                    item.style.opacity = '0';
                    setTimeout(() => {
                        if (item.style.opacity === '0') { // Verifica se ainda deve estar escondido
                            item.style.display = 'none';
                        }
                    }, 200); // Tempo da animação
                }
            });

            // Atualiza a altura do grid se necessário
            const grid = input.closest('.form-group').querySelector('.checkbox-grid');
            if (grid) {
                const visibleItems = Array.from(items).filter(item => item.style.display !== 'none');
                if (visibleItems.length === 0) {
                    grid.style.minHeight = '60px'; // Altura mínima para mostrar mensagem
                } else {
                    grid.style.minHeight = '';
                }
            }
        });

        // Limpa a busca quando trocar de pasta
        const folderSelects = document.querySelectorAll('#profileFolderSelect, #commentFolderSelect');
        folderSelects.forEach(select => {
            select.addEventListener('change', () => {
                input.value = '';
                const items = document.querySelectorAll(itemSelector);
                items.forEach(item => {
                    item.style.display = '';
                    item.style.opacity = '1';
                });
            });
        });
    }

    // Configura a busca para perfis e comentários
    setupSearch('profileSearch', '.profile-checkbox-container');
    setupSearch('commentSearch', '.comment-checkbox-container');

    // Adiciona ícone de limpar busca
    function setupClearButton(searchInput) {
        const input = document.getElementById(searchInput);
        if (!input) return;

        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'clear-search';
        clearButton.innerHTML = '<i data-lucide="x"></i>';
        clearButton.style.display = 'none';

        input.parentNode.appendChild(clearButton);

        input.addEventListener('input', function() {
            clearButton.style.display = this.value ? 'block' : 'none';
        });

        clearButton.addEventListener('click', function() {
            input.value = '';
            input.dispatchEvent(new Event('input'));
            this.style.display = 'none';
            input.focus();
        });
    }

    // Configura botões de limpar para ambos os campos de busca
    setupClearButton('profileSearch');
    setupClearButton('commentSearch');

    // Atualiza os ícones do Lucide
    if (window.lucide) {
        lucide.createIcons();
    }
});
