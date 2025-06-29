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
            icon.innerHTML = '<i data-lucide="refresh-cw" class="w-5 h-5 animate-spin"></i>';
            if (text) text.textContent = loadingText;
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
    const scanForNews = async () => {
        toggleButtonLoading(scanBtn, true, 'Scanning...');
        loader.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        container.innerHTML = '';
        
        try {
            const articles = await apiCall('/api/scan-news');
            if (articles.length === 0) {
                container.innerHTML = '<p class="text-gray-400 text-center">No relevant news found at the moment.</p>';
            } else {
                container.innerHTML = articles.map(article => {
                    const getHotScoreColor = (score) => {
                        if (score > 85) return 'text-red-500';
                        if (score > 70) return 'text-orange-500';
                        if (score > 50) return 'text-yellow-500';
                        return 'text-blue-500';
                    };

                    return `
                    <div class="article-card bg-black/20 p-4 rounded-lg text-left transition-all hover:bg-black/30" data-article='${JSON.stringify(article)}'>
                        <h3 class="font-bold text-lg text-blue-300">${article.title}</h3>
                        <p class="text-sm text-gray-400 my-3">${article.summary}</p>
                        
                        <div class="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-white/10">
                            <div class='flex flex-wrap gap-2 items-center'>
                                <button class="create-story-btn flex items-center gap-1.5 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-300 px-3 py-1 rounded-full font-semibold transition-colors disabled:opacity-50" data-icon="wand-2" data-original-text="Create Story">
                                    <span class="btn-icon"><i data-lucide="wand-2" class="w-4 h-4"></i></span>
                                    <span class="btn-text">Create Story</span>
                                </button>
                                <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400"><i data-lucide="link" class="w-3 h-3"></i>Source</a>
                            </div>
                            <div class="flex items-center gap-2 text-sm font-bold" title="Hot Score: ${article.hot_score}">
                                <i data-lucide="flame" class="w-5 h-5 ${getHotScoreColor(article.hot_score)}"></i>
                                <span class="${getHotScoreColor(article.hot_score)}">${article.hot_score}</span>
                            </div>
                        </div>
                         <div class="mt-4 bg-white/5 p-3 rounded-lg">
                            <p class="text-sm font-semibold text-gray-300">
                                <span class="text-blue-400 font-bold">Identified Tactic:</span> ${article.tactic}
                            </p>
                            <p class="text-xs text-gray-400 mt-1">${article.tactic_explanation}</p>
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
