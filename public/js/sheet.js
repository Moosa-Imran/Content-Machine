// public/js/sheet.js
// Handles all client-side interactions for the sheet.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const analyzeBtn = document.getElementById('analyze-sheet-btn');
    const errorDiv = document.getElementById('sheet-error');
    const pastedDataInput = document.getElementById('pasted-data');
    const sheetUrlInput = document.getElementById('sheet-url');
    
    // --- API & UI HELPERS ---
    const toggleButtonLoading = (button, isLoading) => {
        if (!button) return;
        const icon = button.querySelector('.btn-icon');
        const text = button.querySelector('.btn-text');
        button.disabled = isLoading;

        if (isLoading) {
            icon.innerHTML = '<i data-lucide="refresh-cw" class="w-5 h-5 animate-spin"></i>';
            if (text) text.textContent = 'Analyzing...';
        } else {
            icon.innerHTML = `<i data-lucide="${button.dataset.icon || 'search'}" class="w-5 h-5"></i>`;
            if (text) text.textContent = button.dataset.originalText || 'Submit';
        }
        lucide.createIcons();
    };

    const apiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
                throw new Error(errorData.error);
            }
            return await response.json();
        } catch (error) {
            console.error(`API call to ${endpoint} failed:`, error);
            throw error;
        }
    };

    // --- CORE LOGIC ---
    const analyzeSheet = async () => {
        const pastedData = pastedDataInput.value;
        const sheetUrl = sheetUrlInput.value;

        if (!pastedData.trim() && !sheetUrl.trim()) {
            errorDiv.textContent = 'Please paste data or enter a Google Sheets URL.';
            errorDiv.classList.remove('hidden');
            return;
        }

        toggleButtonLoading(analyzeBtn, true);
        errorDiv.classList.add('hidden');

        try {
            const results = await apiCall('/api/analyze-sheet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pastedData, sheetUrl })
            });
            
            // Store results in sessionStorage to pass to the reels page
            sessionStorage.setItem('generatedContent', JSON.stringify(results));
            
            // Redirect to the reels page to display the new content
            window.location.href = '/reels';
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
            toggleButtonLoading(analyzeBtn, false);
        }
        // No need to toggle loading off on success, as the page will redirect.
    };
    
    // --- EVENT LISTENERS ---
    analyzeBtn.addEventListener('click', analyzeSheet);
});
