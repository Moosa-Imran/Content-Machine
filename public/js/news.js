// public/js/news.js
// Handles all client-side interactions for the news.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const shuffleBtn = document.getElementById('shuffle-news-btn');
    const loader = document.getElementById('news-loader');
    const container = document.getElementById('news-articles-container');
    const customSearchBtn = document.getElementById('custom-search-btn');
    const customSearchModal = document.getElementById('custom-search-modal');
    const closeSearchModalBtn = document.getElementById('close-search-modal-btn');
    const executeSearchBtn = document.getElementById('execute-search-btn');
    const keywordsContainer = document.getElementById('keywords-container');
    const addKeywordInput = document.getElementById('add-keyword-input');
    const addKeywordBtn = document.getElementById('add-keyword-btn');
    const searchCategoryContainer = document.getElementById('search-category-container');
    const sortByContainer = document.getElementById('sort-by-container');
    const dateFilterSelect = document.getElementById('date-filter-select');
    const resetSearchBtn = document.getElementById('reset-search-btn');
    const usePromptBtn = document.getElementById('use-prompt-btn');
    const promptContainer = document.getElementById('prompt-container');
    const promptTextarea = document.getElementById('prompt-textarea');
    const generateFiltersBtn = document.getElementById('generate-filters-btn');
    const manualFiltersContainer = document.getElementById('manual-filters-container');
    const filterIndicator = document.getElementById('filter-indicator');
    const storyLoaderModal = document.getElementById('story-loader-modal');
    const generationStatusText = document.getElementById('generation-status-text');
    const errorModal = document.getElementById('error-modal');
    const closeErrorModalBtn = document.getElementById('close-error-modal-btn');
    const validateNewsToggle = document.getElementById('validate-news-toggle');
    const frameworkSelectModal = document.getElementById('framework-select-modal');
    const frameworkOptionsContainer = document.getElementById('framework-options-container');
    const closeFrameworkSelectModalBtn = document.getElementById('close-framework-select-modal-btn');

    // --- STATE MANAGEMENT ---
    const DEFAULT_KEYWORDS = ["marketing psychology", "behavioral economics", "neuromarketing", "cognitive bias", "pricing psychology"];
    const DEFAULT_CATEGORIES = ["business", "technology", "general"];
    const DEFAULT_SORTBY = 'rel';
    const DEFAULT_DATE_FILTER = '31';
    let currentFilters = { keywords: [...DEFAULT_KEYWORDS], categories: [...DEFAULT_CATEGORIES], sortBy: DEFAULT_SORTBY, dateFilter: DEFAULT_DATE_FILTER };
    let allFetchedArticles = [];
    let currentPage = 1;
    const articlesPerPage = 10;
    let currentApiPage = 1;
    let totalApiPages = 1;
    let articleToProcess = null;

    // --- API & UI HELPERS ---
    const showErrorModal = (type = 'general', message = '') => {
        document.getElementById('general-error-content').classList.toggle('hidden', type === 'modelBusy');
        document.getElementById('model-busy-content').classList.toggle('hidden', type !== 'modelBusy');
        if (type === 'general') console.error("An error occurred:", message);
        errorModal.classList.remove('hidden');
        lucide.createIcons();
    };

    const apiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) throw new Error((await response.json()).error || 'Server error');
            return await response.json();
        } catch (error) {
            console.error(`API call to ${endpoint} failed:`, error);
            throw error;
        }
    };

    const formatRelativeTime = (dateString) => {
        const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
        let interval = seconds / 86400;
        if (interval > 7) return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        if (interval > 1) return `${Math.floor(interval)} days ago`;
        interval = seconds / 3600;
        if (interval > 1) return `${Math.floor(interval)} hours ago`;
        interval = seconds / 60;
        if (interval > 1) return `${Math.floor(interval)} minutes ago`;
        return "just now";
    };
    
    const showFrameworkSelector = async (onSelectCallback) => {
        frameworkOptionsContainer.innerHTML = `<div class="flex justify-center items-center py-10"><i data-lucide="refresh-cw" class="w-6 h-6 animate-spin text-primary-500"></i></div>`;
        lucide.createIcons();
        frameworkSelectModal.classList.remove('hidden');

        try {
            const frameworks = await apiCall('/api/frameworks');
            frameworkOptionsContainer.innerHTML = frameworks.map(fw => `
                <button class="framework-option-btn w-full text-left p-4 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex justify-between items-center" data-id="${fw._id}">
                    <span>
                        <span class="font-semibold text-slate-800 dark:text-white">${fw.name}</span>
                         <span class="ml-2 text-xs ${fw.type === 'news_commentary' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'} px-2 py-0.5 rounded-full font-medium">${fw.type === 'news_commentary' ? 'News Commentary' : 'Viral Script'}</span>
                        ${fw.isDefault ? '<span class="ml-2 text-xs bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full font-medium">Default</span>' : ''}
                    </span>
                    <i data-lucide="arrow-right" class="w-4 h-4 text-slate-400"></i>
                </button>
            `).join('');
            lucide.createIcons();
            
            document.querySelectorAll('.framework-option-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const frameworkId = btn.dataset.id;
                    frameworkSelectModal.classList.add('hidden');
                    onSelectCallback(frameworkId);
                });
            });
        } catch (error) {
            frameworkOptionsContainer.innerHTML = `<p class="text-red-500">Could not load frameworks. Using default.</p>`;
            setTimeout(() => {
                frameworkSelectModal.classList.add('hidden');
                onSelectCallback(null);
            }, 1500);
        }
    };

    const renderKeywords = () => {
        keywordsContainer.innerHTML = currentFilters.keywords.map((keyword, index) => `
            <div class="keyword-bubble flex items-center gap-1.5 bg-primary-500 text-white text-sm font-medium px-3 py-1 rounded-full">
                <span>${keyword}</span>
                <button class="remove-keyword-btn" data-index="${index}" title="Remove ${keyword}">
                    <i data-lucide="x" class="w-4 h-4 hover:text-red-200"></i>
                </button>
            </div>
        `).join('');
        lucide.createIcons();
    };

    const addKeywordFromInput = () => {
        const newKeyword = addKeywordInput.value.trim().replace(/,$/, '');
        if (newKeyword && !currentFilters.keywords.includes(newKeyword)) {
            currentFilters.keywords.push(newKeyword);
            renderKeywords();
        }
        addKeywordInput.value = '';
        addKeywordInput.focus();
    };

    const handleAddKeywordKeydown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addKeywordFromInput();
        }
    };

    const handleRemoveKeyword = (e) => {
        const removeBtn = e.target.closest('.remove-keyword-btn');
        if (removeBtn) {
            const indexToRemove = parseInt(removeBtn.dataset.index);
            currentFilters.keywords.splice(indexToRemove, 1);
            renderKeywords();
        }
    };

    const scanForNews = async (page = 1) => {
        loader.classList.remove('hidden');
        if (page === 1) {
             container.innerHTML = '';
             allFetchedArticles = [];
             currentPage = 1;
        }
        currentApiPage = page;
        const queryParams = new URLSearchParams({
            keyword: currentFilters.keywords.join(','),
            category: currentFilters.categories.join(','),
            sortBy: currentFilters.sortBy,
            dateWindow: currentFilters.dateFilter,
            validate: validateNewsToggle.checked,
            page: page
        });

        try {
            const apiResponse = await apiCall(`/api/scan-news?${queryParams.toString()}`);
            allFetchedArticles.push(...(apiResponse.articles?.results || []));
            totalApiPages = apiResponse.articles?.pages || 1;
            if (allFetchedArticles.length === 0) {
                container.innerHTML = `<div class="text-center text-slate-500 p-8 bg-white dark:bg-slate-900/50 rounded-xl">No relevant news found.</div>`;
            } else {
                renderNewsPage();
            }
        } catch (error) {
            showErrorModal(error.message === 'MODEL_BUSY' ? 'modelBusy' : 'general', error.message);
        } finally {
            loader.classList.add('hidden');
            updateFilterIndicator();
        }
    };
    
    const renderNewsPage = () => {
        const articlesToDisplay = allFetchedArticles.slice((currentPage - 1) * articlesPerPage, currentPage * articlesPerPage);
        container.innerHTML = articlesToDisplay.map(article => {
            const getHotScoreColor = (score) => {
                if (score > 85) return 'text-red-500 dark:text-red-400';
                if (score > 70) return 'text-orange-500 dark:text-orange-400';
                return 'text-yellow-500 dark:text-yellow-400';
            };
            const escapedArticle = JSON.stringify(article).replace(/'/g, '&apos;').replace(/"/g, '&quot;');
            return `<div class="article-card bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800" data-article='${escapedArticle}'>
                <div class="flex justify-between items-start gap-4">
                    <div class="flex-grow">
                        <h3 class="font-bold text-lg text-slate-800 dark:text-white">${article.title}</h3>
                        <p class="text-xs text-slate-400 mt-1"><i data-lucide="calendar" class="w-3 h-3 inline-block mr-1"></i>${formatRelativeTime(article.dateTimePub)}</p>
                    </div>
                    <div class="flex-shrink-0 flex items-center gap-2 text-sm font-bold" title="Hot Score: ${article.hot_score}">
                        <i data-lucide="flame" class="w-5 h-5 ${getHotScoreColor(article.hot_score)}"></i>
                        <span class="${getHotScoreColor(article.hot_score)}">${article.hot_score}</span>
                    </div>
                </div>
                <p class="text-sm text-slate-500 dark:text-slate-400 my-3">${article.summary.substring(0, 400)}...</p>
                <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                     <div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                         <p class="text-sm font-semibold text-slate-600 dark:text-slate-300"><span class="text-primary-600 dark:text-primary-400 font-bold">Tactic:</span> ${article.tactic}</p>
                         <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${article.tactic_explanation}</p>
                     </div>
                </div>
                <div class="flex justify-between items-center mt-4">
                    <a href="${article.url}" target="_blank" class="text-xs font-semibold text-slate-500 hover:text-primary-600">View Source</a>
                    <button class="create-story-btn text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold">Create Story</button>
                </div>
            </div>`;
        }).join('');
        renderPaginationControls();
        lucide.createIcons();
    };

    const renderPaginationControls = () => {
        const totalFrontendPages = Math.ceil(allFetchedArticles.length / articlesPerPage);
        if (totalFrontendPages <= 1 && currentApiPage >= totalApiPages) return;

        let paginationHTML = '<div class="flex items-center justify-center gap-1 sm:gap-2 mt-8">';
        paginationHTML += `<button data-page="${currentPage - 1}" class="page-btn p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" ${currentPage === 1 ? 'disabled' : ''}><i data-lucide="chevron-left" class="w-5 h-5"></i></button>`;

        const getPaginationItems = (currentPage, totalPages, contextRange = 1) => {
            const pages = [];
            if (totalPages <= 1) return [];
            pages.push(1);
            if (currentPage > contextRange + 2) pages.push('...');
            const startPage = Math.max(2, currentPage - contextRange);
            const endPage = Math.min(totalPages - 1, currentPage + contextRange);
            for (let i = startPage; i <= endPage; i++) pages.push(i);
            if (currentPage < totalPages - contextRange - 1) pages.push('...');
            if (totalPages > 1) pages.push(totalPages);
            return [...new Set(pages)];
        };

        getPaginationItems(currentPage, totalFrontendPages).forEach(item => {
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

        document.querySelectorAll('.page-btn').forEach(btn => btn.addEventListener('click', (e) => {
            currentPage = parseInt(e.currentTarget.dataset.page);
            renderNewsPage();
        }));
        
        const fetchMoreBtn = document.getElementById('fetch-more-btn');
        if (fetchMoreBtn) fetchMoreBtn.addEventListener('click', () => scanForNews(currentApiPage + 1));
        
        lucide.createIcons();
    };
    
    const handleCreateStoryFromNews = (e) => {
        const createBtn = e.target.closest('.create-story-btn');
        if (!createBtn) return;
        const articleDiv = createBtn.closest('.article-card');
        articleToProcess = JSON.parse(articleDiv.dataset.article.replace(/&apos;/g, "'").replace(/&quot;/g, '"'));
        showFrameworkSelector(processStoryCreation);
    };
    
    const processStoryCreation = async (frameworkId) => {
        if (!articleToProcess) return;
        storyLoaderModal.classList.remove('hidden');
        try {
            const newStory = await apiCall('/api/create-story-from-news', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article: articleToProcess, frameworkId })
            });
            sessionStorage.setItem('generatedContent', JSON.stringify([newStory]));
            window.location.href = '/reels';
        } catch (error) {
            showErrorModal(error.message === 'MODEL_BUSY' ? 'modelBusy' : 'general', error.message);
        } finally {
            storyLoaderModal.classList.add('hidden');
            articleToProcess = null;
        }
    };

    const handleShuffleNews = () => {
        if (allFetchedArticles.length > 1) {
            for (let i = allFetchedArticles.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allFetchedArticles[i], allFetchedArticles[j]] = [allFetchedArticles[j], allFetchedArticles[i]];
            }
            currentPage = 1;
            renderNewsPage();
        }
    };
    
    const updateFilterModalUI = () => {
        renderKeywords();
        sortByContainer.querySelector(`input[value="${currentFilters.sortBy}"]`).checked = true;
        dateFilterSelect.value = currentFilters.dateFilter;
        const noneCheckbox = document.getElementById('cat-none');
        const hasCategories = currentFilters.categories.length > 0;
        noneCheckbox.checked = !hasCategories;
        searchCategoryContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb.id !== 'cat-none') {
                cb.checked = hasCategories && currentFilters.categories.includes(cb.value);
            }
        });
    };
    
    const updateFilterIndicator = () => {
        const isDefaultKeywords = currentFilters.keywords.length === DEFAULT_KEYWORDS.length && currentFilters.keywords.every((kw, i) => kw === DEFAULT_KEYWORDS[i]);
        const isDefaultSort = currentFilters.sortBy === DEFAULT_SORTBY;
        const isDefaultCategories = currentFilters.categories.length === DEFAULT_CATEGORIES.length && currentFilters.categories.every(cat => DEFAULT_CATEGORIES.includes(cat));
        const isDefaultDateFilter = currentFilters.dateFilter === DEFAULT_DATE_FILTER;
        filterIndicator.classList.toggle('hidden', isDefaultKeywords && isDefaultSort && isDefaultCategories && isDefaultDateFilter);
    };

    const setDefaultFilters = () => {
        currentFilters = { keywords: [...DEFAULT_KEYWORDS], categories: [...DEFAULT_CATEGORIES], sortBy: DEFAULT_SORTBY, dateFilter: DEFAULT_DATE_FILTER };
        updateFilterModalUI();
    };

    const handleExecuteCustomSearch = () => {
        currentFilters.categories = Array.from(searchCategoryContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value).filter(val => val !== 'none');
        currentFilters.sortBy = sortByContainer.querySelector('input[name="sort_by"]:checked').value;
        currentFilters.dateFilter = dateFilterSelect.value;
        customSearchModal.classList.add('hidden');
        scanForNews(1);
    };
    
    const togglePromptUI = () => {
        const isHidden = promptContainer.classList.toggle('hidden');
        const isDisabled = !isHidden;
        manualFiltersContainer.style.opacity = isDisabled ? '0.5' : '1';
        manualFiltersContainer.querySelectorAll('input, button, label, select').forEach(el => {
            if (el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'SELECT') {
                el.disabled = isDisabled;
            }
        });
    };

    const handleGenerateFilters = async () => {
        const userPrompt = promptTextarea.value;
        if (!userPrompt.trim()) {
            showErrorModal('general', 'Please enter a prompt.');
            return;
        }
        const generateBtn = generateFiltersBtn;
        const icon = generateBtn.querySelector('.btn-icon');
        const text = generateBtn.querySelector('.btn-text');
        const originalText = text.textContent;
        icon.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i>';
        text.textContent = 'Generating...';
        lucide.createIcons();
        generateBtn.disabled = true;

        try {
            const result = await apiCall('/api/generate-filters-from-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userPrompt })
            });
            if (result.keywords) currentFilters.keywords = result.keywords.split(',').map(kw => kw.trim()).filter(kw => kw);
            if (result.categories && Array.isArray(result.categories)) currentFilters.categories = result.categories;
            updateFilterModalUI();
            togglePromptUI();
        } catch (error) {
            showErrorModal(error.message === 'MODEL_BUSY' ? 'modelBusy' : 'general', `Failed to generate filters: ${error.message}`);
        } finally {
            icon.innerHTML = '<i data-lucide="wand-2" class="w-4 h-4"></i>';
            text.textContent = originalText;
            lucide.createIcons();
            generateBtn.disabled = false;
        }
    };
    
    const handleCategorySelection = (e) => {
        const target = e.target;
        if (target.type !== 'checkbox') return;
        const noneCheckbox = document.getElementById('cat-none');
        if (target.id === 'cat-none' && target.checked) {
            searchCategoryContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (cb.id !== 'cat-none') cb.checked = false;
            });
        } else if (target.id !== 'cat-none' && target.checked) {
            noneCheckbox.checked = false;
        }
    };

    // --- EVENT LISTENERS & INITIALIZATION ---
    shuffleBtn.addEventListener('click', handleShuffleNews);
    container.addEventListener('click', handleCreateStoryFromNews);
    customSearchBtn.addEventListener('click', () => {
        updateFilterModalUI();
        customSearchModal.classList.remove('hidden');
    });
    closeSearchModalBtn.addEventListener('click', () => customSearchModal.classList.add('hidden'));
    executeSearchBtn.addEventListener('click', handleExecuteCustomSearch);
    resetSearchBtn.addEventListener('click', setDefaultFilters);
    usePromptBtn.addEventListener('click', togglePromptUI);
    generateFiltersBtn.addEventListener('click', handleGenerateFilters);
    searchCategoryContainer.addEventListener('change', handleCategorySelection);
    addKeywordInput.addEventListener('keydown', handleAddKeywordKeydown);
    addKeywordBtn.addEventListener('click', addKeywordFromInput);
    keywordsContainer.addEventListener('click', handleRemoveKeyword);
    closeErrorModalBtn.addEventListener('click', () => errorModal.classList.add('hidden'));
    validateNewsToggle.addEventListener('change', () => scanForNews(1));
    closeFrameworkSelectModalBtn?.addEventListener('click', () => frameworkSelectModal.classList.add('hidden'));
    
    scanForNews();
});
