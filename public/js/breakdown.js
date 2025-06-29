// public/js/breakdown.js
// Handles all client-side interactions for the breakdown.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const findCompaniesBtn = document.getElementById('find-companies-btn');
    const companiesLoader = document.getElementById('companies-loader');
    const companiesError = document.getElementById('companies-error');
    const companiesContainer = document.getElementById('companies-container');
    const scriptLoader = document.getElementById('script-loader');
    const scriptContainer = document.getElementById('script-container');

    // --- API & UI HELPERS ---
    const toggleButtonLoading = (button, isLoading) => {
        if (!button) return;
        const icon = button.querySelector('.btn-icon');
        const text = button.querySelector('.btn-text');
        button.disabled = isLoading;

        if (isLoading) {
            icon.innerHTML = '<i data-lucide="refresh-cw" class="w-5 h-5 animate-spin"></i>';
            if (text) text.textContent = 'Loading...';
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
    const findCompanies = async () => {
        toggleButtonLoading(findCompaniesBtn, true);
        companiesLoader.classList.remove('hidden');
        companiesError.classList.add('hidden');
        companiesContainer.innerHTML = '';
        scriptContainer.classList.add('hidden');

        try {
            const companies = await apiCall('/api/find-companies');
            companiesContainer.innerHTML = companies.map(company => `
                <button data-company="${company}" class="company-select-btn p-3 font-semibold rounded-lg transition-all text-center bg-white/10 hover:bg-white/20">${company}</button>
            `).join('');
        } catch (error) {
            companiesError.textContent = error.message;
            companiesError.classList.remove('hidden');
        } finally {
            toggleButtonLoading(findCompaniesBtn, false);
            companiesLoader.classList.add('hidden');
        }
    };

    const handleCompanySelection = async (e) => {
        const companyBtn = e.target.closest('.company-select-btn');
        if (!companyBtn) return;
        
        const companyName = companyBtn.dataset.company;

        document.querySelectorAll('.company-select-btn').forEach(btn => btn.classList.remove('bg-yellow-500', 'text-black', 'scale-105'));
        companyBtn.classList.add('bg-yellow-500', 'text-black', 'scale-105');

        scriptLoader.querySelector('p').textContent = `Analyzing ${companyName}...`;
        scriptLoader.classList.remove('hidden');
        scriptContainer.classList.add('hidden');

        try {
            const script = await apiCall('/api/tactic-breakdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName })
            });

            scriptContainer.innerHTML = `
                <div class="flex justify-between items-start">
                     <h3 class="text-3xl font-bold text-yellow-400">${script.company}</h3>
                </div>
                <p class="text-lg italic text-gray-300">"${script.hook}"</p>
                <p class="text-gray-400">${script.buildUp}</p>
                <div class="space-y-4">
                    ${script.storyBreakdown?.map(tactic => `
                        <div class="border-l-4 border-green-500 pl-4 py-2">
                            <span class="text-sm font-semibold bg-green-500/20 text-green-300 px-2 py-1 rounded-full">${tactic.pillar}</span>
                            <h4 class="text-xl font-semibold mt-2 text-green-400">${tactic.tacticName}</h4>
                            <p class="text-gray-300">${tactic.explanation}</p>
                        </div>`).join('')}
                </div>
                <p class="text-lg italic text-gray-300 pt-4 border-t border-white/10">"${script.concludingPsychology}"</p>`;
            scriptContainer.classList.remove('hidden');
            lucide.createIcons();
        } catch (error) {
            scriptContainer.innerHTML = `<p class="text-red-400 text-center">${error.message}</p>`;
            scriptContainer.classList.remove('hidden');
        } finally {
            scriptLoader.classList.add('hidden');
        }
    };

    // --- EVENT LISTENERS ---
    findCompaniesBtn.addEventListener('click', findCompanies);
    companiesContainer.addEventListener('click', handleCompanySelection);

    // --- INITIALIZATION ---
    findCompanies(); // Automatically fetch companies on page load
});
