document.addEventListener('DOMContentLoaded', function() {
    // Cria o elemento do contador flutuante se ainda não existir
    let floatingCounter = document.querySelector('.floating-counter');
    if (!floatingCounter) {
        floatingCounter = document.createElement('div');
        floatingCounter.className = 'floating-counter';
        floatingCounter.innerHTML = `
            <div class="counter-content">
                <div class="counter-item">
                    <span class="counter-label">Perfis:</span>
                    <span class="counter-value" id="profileCounter">0</span>
                </div>
                <div class="counter-item">
                    <span class="counter-label">Comentários:</span>
                    <span class="counter-value" id="commentCounter">0</span>
                </div>
                <div id="counterWarning" class="counter-warning"></div>
            </div>
        `;
        document.body.appendChild(floatingCounter);
    }

    // Função para atualizar os contadores
    function updateCounters() {
        const selectedProfiles = document.querySelectorAll('input[name="profiles"]:checked').length;
        const selectedComments = document.querySelectorAll('input[name="comments"]:checked').length;
        
        // Atualiza os números no contador flutuante
        const profileCounter = document.getElementById('profileCounter');
        const commentCounter = document.getElementById('commentCounter');
        const warningElement = document.getElementById('counterWarning');
        
        if (profileCounter) profileCounter.textContent = selectedProfiles;
        if (commentCounter) commentCounter.textContent = selectedComments;

        // Mostra/esconde o contador flutuante
        if (selectedProfiles > 0 || selectedComments > 0) {
            floatingCounter.style.display = 'block';
            
            // Verifica se os números são diferentes
            if (selectedProfiles !== selectedComments) {
                if (warningElement) {
                    warningElement.textContent = '⚠️ Números diferentes!';
                    warningElement.style.display = 'block';
                }
            } else {
                if (warningElement) {
                    warningElement.style.display = 'none';
                }
            }
        } else {
            floatingCounter.style.display = 'none';
        }

        // Atualiza o número sugerido de instâncias
        const instanceSelect = document.getElementById('instanceSelect');
        if (instanceSelect && selectedProfiles > 0) {
            const suggestedInstances = Math.min(Math.ceil(selectedProfiles / 2), 5);
            instanceSelect.value = suggestedInstances.toString();
        }
    }

    // Adiciona listeners para os checkboxes
    function addCheckboxListeners() {
        const checkboxes = document.querySelectorAll('input[name="profiles"], input[name="comments"]');
        checkboxes.forEach(checkbox => {
            // Remove listeners antigos para evitar duplicação
            checkbox.removeEventListener('change', updateCounters);
            // Adiciona novo listener
            checkbox.addEventListener('change', updateCounters);
        });
    }

    // Inicialização
    addCheckboxListeners();
    updateCounters();

    // Observer para mudanças dinâmicas na DOM
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                addCheckboxListeners();
                updateCounters();
            }
        });
    });

    // Configura o observer para monitorar mudanças em todo o documento
    observer.observe(document.body, { 
        childList: true, 
        subtree: true 
    });

    // Atualiza os contadores quando a página é carregada
    window.addEventListener('load', updateCounters);

    // Atualiza os contadores quando mudar de pasta
    const folderSelects = document.querySelectorAll('#profileFolderSelect, #commentFolderSelect');
    folderSelects.forEach(select => {
        select.addEventListener('change', () => {
            // Pequeno delay para garantir que os checkboxes foram atualizados
            setTimeout(updateCounters, 100);
        });
    });
});
