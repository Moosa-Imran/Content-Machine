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
    const toggleButtonLoading = (button, isLoading, loadingText = 'Loading...') => {
        if (!button) return;
        const icon = button.querySelector('.btn-icon');
        const text = button.querySelector('.btn-text');
        button.disabled = isLoading;

        if (isLoading) {
            icon.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i>';
            if (text) text.textContent = loadingText;
        } else {
            icon.innerHTML = `<i data-lucide="${button.dataset.icon || 'search'}" class="w-4 h-4"></i>`;
            if (text) text.textContent = button.dataset.originalText || 'Submit';
        }
        lucide.createIcons();
    };
    
    const apiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'An unknown server error occurred' }));
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
        toggleButtonLoading(findCompaniesBtn, true, 'Finding...');
        companiesLoader.classList.remove('hidden');
        companiesError.classList.add('hidden');
        companiesContainer.innerHTML = '';
        scriptContainer.classList.add('hidden');

        try {
            const companies = await apiCall('/api/find-companies');
            companiesContainer.innerHTML = companies.map(company => `
                <button data-company="${company}" class="company-select-btn p-2.5 font-medium rounded-lg transition-all text-sm text-center text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700">${company}</button>
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

        document.querySelectorAll('.company-select-btn').forEach(btn => {
            btn.classList.remove('bg-primary-600', 'text-white', 'dark:bg-primary-600', 'scale-105', 'shadow-lg');
            btn.classList.add('text-slate-600', 'dark:text-slate-300', 'bg-slate-100', 'dark:bg-slate-800');
        });
        companyBtn.classList.add('bg-primary-600', 'text-white', 'dark:bg-primary-600', 'scale-105', 'shadow-lg');
        companyBtn.classList.remove('text-slate-600', 'dark:text-slate-300', 'bg-slate-100', 'dark:bg-slate-800');

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
                <div class="flex justify-between items-start mb-4">
                     <h3 class="text-2xl font-bold text-slate-800 dark:text-white">Analysis for: <span class="text-primary-600 dark:text-primary-400">${script.company}</span></h3>
                </div>
                <div class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p class="text-lg text-slate-700 dark:text-slate-200"><strong>Hook:</strong> <span class="italic">"${script.hook}"</span></p>
                </div>
                <div class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p class="text-slate-600 dark:text-slate-300">${script.buildUp}</p>
                </div>
                <div class="space-y-4">
                    ${script.storyBreakdown?.map(tactic => `
                        <div class="border-l-4 border-green-500 pl-4 py-2">
                            <span class="text-xs font-semibold bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-300 px-2.5 py-1 rounded-full">${tactic.pillar}</span>
                            <h4 class="text-xl font-semibold mt-2 text-slate-800 dark:text-white">${tactic.tacticName}</h4>
                            <p class="text-slate-600 dark:text-slate-300">${tactic.explanation}</p>
                        </div>`).join('')}
                </div>
                <div class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border-t-2 border-primary-500">
                    <p class="text-lg text-slate-700 dark:text-slate-200"><strong>Concluding Psychology:</strong> <span class="italic">"${script.concludingPsychology}"</span></p>
                </div>
                <div class="mt-6 text-center">
                    <button onclick="window.location.href='/reels'" class="flex items-center justify-center gap-2 mx-auto bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105">
                        <i data-lucide="pen-square" class="w-5 h-5"></i>
                        Generate a Viral Script from this Tactic
                    </button>
                </div>
            `;
            scriptContainer.classList.remove('hidden');
            lucide.createIcons();
        } catch (error) {
            scriptContainer.innerHTML = `<p class="text-red-500 text-center p-4 bg-red-500/10 rounded-lg border border-red-500/30">${error.message}</p>`;
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
