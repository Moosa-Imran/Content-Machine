// public/js/news.js
// Handles all client-side interactions for the news.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const scanBtn = document.getElementById('scan-news-btn');
    const loader = document.getElementById('news-loader');
    const errorDiv = document.getElementById('news-error');
    const container = document.getElementById('news-articles-container');
    const customSearchBtn = document.getElementById('custom-search-btn');
    const customSearchModal = document.getElementById('custom-search-modal');
    const closeSearchModalBtn = document.getElementById('close-search-modal-btn');
    const executeSearchBtn = document.getElementById('execute-search-btn');
    const searchKeywordsInput = document.getElementById('search-keywords');
    const searchCategoryContainer = document.getElementById('search-category-container');
    const sortByContainer = document.getElementById('sort-by-container');
    const resetSearchBtn = document.getElementById('reset-search-btn');
    const usePromptBtn = document.getElementById('use-prompt-btn');
    const promptContainer = document.getElementById('prompt-container');
    const promptTextarea = document.getElementById('prompt-textarea');
    const generateFiltersBtn = document.getElementById('generate-filters-btn');
    const manualFiltersContainer = document.getElementById('manual-filters-container');

    // --- STATE MANAGEMENT ---
    const DEFAULT_KEYWORDS = "marketing psychology,behavioral economics,neuromarketing,cognitive bias,pricing psychology";
    const DEFAULT_CATEGORIES = ["business", "technology", "general"];
    
    let allFetchedArticles = [];
    let currentPage = 1;
    const articlesPerPage = 10;
    
    let currentApiPage = 1;
    let totalApiPages = 1;
    let currentQueryParams = '';

    // --- API & UI HELPERS ---
    const toggleButtonLoading = (button, isLoading, loadingText = 'Loading...') => {
        if (!button) return;
        const icon = button.querySelector('.btn-icon');
        const text = button.querySelector('.btn-text');
        button.disabled = isLoading;

        if (isLoading) {
            if (icon) icon.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i>';
            if (text) text.textContent = loadingText;
        } else {
            if (icon) icon.innerHTML = `<i data-lucide="${button.dataset.icon || 'search'}" class="w-4 h-4"></i>`;
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
    const scanForNews = async (queryParams = '', page = 1) => {
        toggleButtonLoading(scanBtn, true, 'Scanning...');
        loader.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        
        if (page === 1) {
             container.innerHTML = '';
             container.style.minHeight = '400px';
             allFetchedArticles = [];
             currentPage = 1;
        }
        
        currentQueryParams = queryParams;
        currentApiPage = page;

        try {
            const fullQuery = `${queryParams}&page=${page}`;
            const apiResponse = await apiCall(`/api/scan-news?${fullQuery}`);
            
            const newArticles = apiResponse.articles?.results || [];
            allFetchedArticles.push(...newArticles);
            totalApiPages = apiResponse.articles?.pages || 1;

            if (allFetchedArticles.length === 0) {
                container.innerHTML = `<div class="text-center text-slate-500 dark:text-slate-400 p-8 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">No relevant news found. Try adjusting your filters or scanning again later.</div>`;
            } else {
                renderNewsPage();
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
    
    const renderNewsPage = () => {
        const startIndex = (currentPage - 1) * articlesPerPage;
        const endIndex = startIndex + articlesPerPage;
        const articlesToDisplay = allFetchedArticles.slice(startIndex, endIndex);

        container.innerHTML = articlesToDisplay.map(article => {
            const getHotScoreColor = (score) => {
                if (score > 85) return 'text-red-500 dark:text-red-400';
                if (score > 70) return 'text-orange-500 dark:text-orange-400';
                if (score > 50) return 'text-yellow-500 dark:text-yellow-400';
                return 'text-blue-500 dark:text-blue-400';
            };

            const truncatedSummary = article.summary.length > 400 
                ? article.summary.substring(0, 400) + '...' 
                : article.summary;

            const escapedArticle = JSON.stringify(article)
                .replace(/'/g, '&apos;')
                .replace(/"/g, '&quot;');

            return `
            <div class="article-card bg-white dark:bg-slate-900/50 p-4 rounded-xl text-left transition-all border border-slate-200 dark:border-slate-800 hover:border-primary-500 dark:hover:border-primary-500 card-glow" data-article='${escapedArticle}'>
                <div class="flex justify-between items-start gap-4">
                    <h3 class="font-bold text-lg text-slate-800 dark:text-white">${article.title}</h3>
                    <div class="flex-shrink-0 flex items-center gap-2 text-sm font-bold" title="Hot Score: ${article.hot_score}">
                        <i data-lucide="flame" class="w-5 h-5 ${getHotScoreColor(article.hot_score)}"></i>
                        <span class="${getHotScoreColor(article.hot_score)}">${article.hot_score}</span>
                    </div>
                </div>
                <p class="text-sm text-slate-500 dark:text-slate-400 my-3">${truncatedSummary}</p>
                
                <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                     <div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                         <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">
                             <span class="text-primary-600 dark:text-primary-400 font-bold">Identified Tactic:</span> ${article.tactic}
                         </p>
                         <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${article.tactic_explanation}</p>
                     </div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-4 mt-4">
                    <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-md transition-colors"><i data-lucide="link-2" class="w-4 h-4"></i>View Source</a>
                    <button class="create-story-btn flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50" data-icon="wand-2" data-original-text="Create Story">
                        <span class="btn-icon"><i data-lucide="wand-2" class="w-4 h-4"></i></span>
                        <span class="btn-text">Create Story</span>
                    </button>
                </div>
            </div>`;
        }).join('');
        
        renderPaginationControls();
        lucide.createIcons();
    };

    const getPaginationItems = (currentPage, totalPages, contextRange = 1) => {
        const pages = [];
        if (totalPages <= 1) return [];
        
        pages.push(1);

        if (currentPage > contextRange + 2) {
            pages.push('...');
        }

        const startPage = Math.max(2, currentPage - contextRange);
        const endPage = Math.min(totalPages - 1, currentPage + contextRange);
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        if (currentPage < totalPages - contextRange - 1) {
            pages.push('...');
        }

        if (totalPages > 1) {
            pages.push(totalPages);
        }
        
        return [...new Set(pages)];
    };

    const renderPaginationControls = () => {
        const totalFrontendPages = Math.ceil(allFetchedArticles.length / articlesPerPage);
        if (totalFrontendPages <= 1 && currentApiPage >= totalApiPages) return;

        let paginationHTML = '<div class="flex items-center justify-center gap-1 sm:gap-2 mt-8">';

        paginationHTML += `<button data-page="${currentPage - 1}" class="page-btn p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" ${currentPage === 1 ? 'disabled' : ''}><i data-lucide="chevron-left" class="w-5 h-5"></i></button>`;

        const paginationItems = getPaginationItems(currentPage, totalFrontendPages);
        paginationItems.forEach(item => {
            if (item === '...') {
                paginationHTML += `<span class="px-2 py-2 text-sm font-medium text-slate-500">...</span>`;
            } else {
                paginationHTML += `<button data-page="${item}" class="page-btn px-4 py-2 text-sm font-medium rounded-md ${item === currentPage ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'}">${item}</button>`;
            }
        });
        
        paginationHTML += `<button data-page="${currentPage + 1}" class="page-btn p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" ${currentPage === totalFrontendPages ? 'disabled' : ''}><i data-lucide="chevron-right" class="w-5 h-5"></i></button>`;

        if (currentApiPage < totalApiPages && currentPage === totalFrontendPages) {
             paginationHTML += `<button id="fetch-more-btn" class="ml-2 px-4 py-2 text-sm font-medium rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">Next <i data-lucide="chevrons-right" class="w-4 h-4 inline-block ml-1"></i></button>`;
        }
        
        paginationHTML += '</div>';
        container.insertAdjacentHTML('beforeend', paginationHTML);

        document.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentPage = parseInt(e.currentTarget.dataset.page);
                renderNewsPage();
            });
        });
        
        const fetchMoreBtn = document.getElementById('fetch-more-btn');
        if (fetchMoreBtn) {
            fetchMoreBtn.addEventListener('click', () => {
                scanForNews(currentQueryParams, currentApiPage + 1);
            });
        }
        
        lucide.createIcons();
    };


    const handleCreateStoryFromNews = async (e) => {
        const createBtn = e.target.closest('.create-story-btn');
        if (!createBtn) return;
        
        const articleDiv = createBtn.closest('.article-card');
        const unescapedArticleString = articleDiv.dataset.article
            .replace(/&apos;/g, "'")
            .replace(/&quot;/g, '"');
        const article = JSON.parse(unescapedArticleString);
        
        toggleButtonLoading(createBtn, true, 'Creating...');
        
        try {
            const newStory = await apiCall('/api/create-story-from-news', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article })
            });
            
            sessionStorage.setItem('generatedContent', JSON.stringify([newStory]));
            window.location.href = '/reels';
            
        } catch (error) {
            alert(`Failed to create story: ${error.message}`);
            toggleButtonLoading(createBtn, false);
        }
    };
    
    const setDefaultFilters = () => {
        searchKeywordsInput.value = DEFAULT_KEYWORDS.replace(/,/g, ', ');
        document.getElementById('sort-rel').checked = true;
        
        const noneCheckbox = document.getElementById('cat-none');
        noneCheckbox.checked = false;

        searchCategoryContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if(cb.id !== 'cat-none') {
                cb.checked = DEFAULT_CATEGORIES.includes(cb.value);
            }
        });
    };

    const handleExecuteCustomSearch = () => {
        const keywords = searchKeywordsInput.value
            .split(',')
            .map(kw => kw.trim())
            .filter(kw => kw)
            .join(',');

        let selectedCategories = Array.from(searchCategoryContainer.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value)
            .filter(val => val !== 'none')
            .join(',');

        const sortBy = sortByContainer.querySelector('input[name="sort_by"]:checked').value;
        
        const queryParams = new URLSearchParams();
        if (keywords) {
            queryParams.append('keyword', keywords);
        }
        if (selectedCategories) {
            queryParams.append('category', selectedCategories);
        }
        if (sortBy) {
            queryParams.append('sortBy', sortBy);
        }
        
        customSearchModal.classList.add('hidden');
        scanForNews(queryParams.toString(), 1);
    };
    
    const togglePromptUI = () => {
        const isHidden = promptContainer.classList.toggle('hidden');
        const isDisabled = !isHidden;
        
        manualFiltersContainer.style.opacity = isDisabled ? '0.5' : '1';
        manualFiltersContainer.querySelectorAll('input, button').forEach(el => el.disabled = isDisabled);
    };

    const handleGenerateFilters = async () => {
        const userPrompt = promptTextarea.value;
        if (!userPrompt.trim()) {
            alert('Please enter a prompt.');
            return;
        }

        toggleButtonLoading(generateFiltersBtn, true, 'Generating...');
        try {
            const result = await apiCall('/api/generate-filters-from-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userPrompt })
            });

            if (result.keywords) {
                searchKeywordsInput.value = result.keywords;
            }
            if (result.categories && Array.isArray(result.categories)) {
                searchCategoryContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = result.categories.includes(cb.value);
                });
            }
            
            togglePromptUI();

        } catch (error) {
            alert(`Failed to generate filters: ${error.message}`);
        } finally {
            toggleButtonLoading(generateFiltersBtn, false);
        }
    };
    
    const handleCategorySelection = (e) => {
        const target = e.target;
        if (target.type !== 'checkbox') return;

        const noneCheckbox = document.getElementById('cat-none');
        
        if (target.id === 'cat-none' && target.checked) {
            // If "None" is checked, uncheck all others
            searchCategoryContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (cb.id !== 'cat-none') {
                    cb.checked = false;
                }
            });
        } else if (target.id !== 'cat-none' && target.checked) {
            // If any other category is checked, uncheck "None"
            noneCheckbox.checked = false;
        }
    };

    // --- EVENT LISTENERS ---
    scanBtn.addEventListener('click', () => scanForNews(currentQueryParams, 1));
    container.addEventListener('click', handleCreateStoryFromNews);
    customSearchBtn.addEventListener('click', () => {
        setDefaultFilters();
        customSearchModal.classList.remove('hidden');
    });
    closeSearchModalBtn.addEventListener('click', () => customSearchModal.classList.add('hidden'));
    executeSearchBtn.addEventListener('click', handleExecuteCustomSearch);
    resetSearchBtn.addEventListener('click', setDefaultFilters);
    usePromptBtn.addEventListener('click', togglePromptUI);
    generateFiltersBtn.addEventListener('click', handleGenerateFilters);
    searchCategoryContainer.addEventListener('change', handleCategorySelection);

    // --- INITIALIZATION ---
    scanForNews();
});
