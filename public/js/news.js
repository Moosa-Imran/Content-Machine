// public/js/news.js
// Handles all client-side interactions for the news.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const scanBtn = document.getElementById('scan-news-btn');
    const loader = document.getElementById('news-loader');
    const errorDiv = document.getElementById('news-error');
    const container = document.getElementById('news-articles-container');

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
    const scanForNews = async () => {
        toggleButtonLoading(scanBtn, true, 'Scanning...');
        loader.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        container.innerHTML = '';
        container.style.minHeight = '400px';
        
        try {
            const articles = await apiCall('/api/scan-news');
            if (articles.length === 0) {
                container.innerHTML = `<div class="text-center text-slate-500 dark:text-slate-400 p-8 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">No relevant news found at the moment. Try again in a bit!</div>`;
            } else {
                container.innerHTML = articles.map(article => {
                    const getHotScoreColor = (score) => {
                        if (score > 85) return 'text-red-500 dark:text-red-400';
                        if (score > 70) return 'text-orange-500 dark:text-orange-400';
                        if (score > 50) return 'text-yellow-500 dark:text-yellow-400';
                        return 'text-blue-500 dark:text-blue-400';
                    };

                    return `
                    <div class="article-card bg-white dark:bg-slate-900/50 p-4 rounded-xl text-left transition-all border border-slate-200 dark:border-slate-800 hover:border-primary-500 dark:hover:border-primary-500 card-glow" data-article='${JSON.stringify(article)}'>
                        <div class="flex justify-between items-start gap-4">
                            <h3 class="font-bold text-lg text-slate-800 dark:text-white">${article.title}</h3>
                            <div class="flex-shrink-0 flex items-center gap-2 text-sm font-bold" title="Hot Score: ${article.hot_score}">
                                <i data-lucide="flame" class="w-5 h-5 ${getHotScoreColor(article.hot_score)}"></i>
                                <span class="${getHotScoreColor(article.hot_score)}">${article.hot_score}</span>
                            </div>
                        </div>
                        <p class="text-sm text-slate-500 dark:text-slate-400 my-3">${article.summary}</p>
                        
                        <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                             <div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                    <span class="text-primary-600 dark:text-primary-400 font-bold">Identified Tactic:</span> ${article.tactic}
                                </p>
                                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${article.tactic_explanation}</p>
                            </div>
                        </div>

                        <div class="flex flex-wrap items-center justify-between gap-4 mt-4">
                            <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"><i data-lucide="link-2" class="w-3 h-3"></i>Source</a>
                            <button class="create-story-btn flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50" data-icon="wand-2" data-original-text="Create Story">
                                <span class="btn-icon"><i data-lucide="wand-2" class="w-4 h-4"></i></span>
                                <span class="btn-text">Create Story</span>
                            </button>
                        </div>
                    </div>`;
                }).join('');
                lucide.createIcons();
            }
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
        } finally {
            toggleButtonLoading(scanBtn, false);
            loader.classList.add('hidden');
            container.style.minHeight = 'auto';
        }
    };

    const handleCreateStoryFromNews = async (e) => {
        const createBtn = e.target.closest('.create-story-btn');
        if (!createBtn) return;
        
        const articleDiv = createBtn.closest('.article-card');
        const article = JSON.parse(articleDiv.dataset.article);
        
        toggleButtonLoading(createBtn, true, 'Creating...');
        
        try {
            const newStory = await apiCall('/api/create-story-from-news', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article })
            });
            
            // Store results in sessionStorage and redirect to reels page
            sessionStorage.setItem('generatedContent', JSON.stringify([newStory]));
            window.location.href = '/reels';
            
        } catch (error) {
            alert(`Failed to create story: ${error.message}`);
            toggleButtonLoading(createBtn, false);
        }
    };

    // --- EVENT LISTENERS ---
    scanBtn.addEventListener('click', scanForNews);
    container.addEventListener('click', handleCreateStoryFromNews);

    // --- INITIALIZATION ---
    scanForNews();
});
