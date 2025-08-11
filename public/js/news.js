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
    const keywordLocContainer = document.getElementById('keyword-loc-container');
    const resetSearchBtn = document.getElementById('reset-search-btn');
    const usePromptBtn = document.getElementById('use-prompt-btn');
    const promptContainer = document.getElementById('prompt-container');
    const promptTextarea = document.getElementById('prompt-textarea');
    const generateFiltersBtn = document.getElementById('generate-filters-btn');
    const manualFiltersContainer = document.getElementById('manual-filters-container');
    const filterIndicator = document.getElementById('filter-indicator');
    const storyLoaderModal = document.getElementById('story-loader-modal');
    const promptUpdateLoaderModal = document.getElementById('prompt-update-loader-modal');
    const generationStatusText = document.getElementById('generation-status-text');
    const errorModal = document.getElementById('error-modal');
    const generalErrorContent = document.getElementById('general-error-content');
    const modelBusyContent = document.getElementById('model-busy-content');
    const closeErrorModalBtn = document.getElementById('close-error-modal-btn');
    const validateNewsToggle = document.getElementById('validate-news-toggle');
    const frameworkSelectModal = document.getElementById('framework-select-modal');
    const frameworkOptionsContainer = document.getElementById('framework-options-container');
    const closeFrameworkSelectModalBtn = document.getElementById('close-framework-select-modal-btn');
    const fetchContentBtn = document.getElementById('fetch-content-btn');
    const makeDefaultBtn = document.getElementById('make-default-btn');

    // --- STATE MANAGEMENT ---
    let DEFAULT_KEYWORDS = [];
    let DEFAULT_CATEGORIES = [];
    const DEFAULT_SORTBY = 'rel';
    const DEFAULT_DATE_FILTER = '31';
    const DEFAULT_KEYWORD_LOC = 'body';
    let currentFilters = { keywords: [], categories: [], sortBy: DEFAULT_SORTBY, dateFilter: DEFAULT_DATE_FILTER, keywordLoc: DEFAULT_KEYWORD_LOC };
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
                if (response.status === 503) {
                    throw new Error('MODEL_BUSY');
                }
                const errorData = await response.json().catch(() => ({ error: 'An unknown server error occurred' }));
                throw new Error(errorData.error || 'An unknown error occurred.');
            }
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
        frameworkOptionsContainer.innerHTML = `<div class="flex justify-center items-center py-10"><div class="relative"><div class="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-purple-500"></div><div class="absolute inset-0 flex items-center justify-center"><i data-lucide="settings" class="w-4 h-4 text-purple-500 animate-pulse"></i></div></div></div>`;
        lucide.createIcons();
        frameworkSelectModal.classList.remove('hidden');

        try {
            const frameworks = await apiCall('/api/frameworks');
            frameworkOptionsContainer.innerHTML = frameworks.map(fw => `
                <button class="framework-option-btn group w-full text-left p-5 rounded-2xl hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 dark:hover:from-purple-900/20 dark:hover:to-blue-900/20 transition-all duration-300 border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-700" data-id="${fw._id}">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-4">
                            <div class="bg-gradient-to-r ${fw.type === 'news_commentary' ? 'from-blue-500 to-indigo-500' : 'from-purple-500 to-pink-500'} p-2.5 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                                <i data-lucide="${fw.type === 'news_commentary' ? 'newspaper' : 'zap'}" class="w-5 h-5 text-white"></i>
                            </div>
                            <div>
                                <span class="font-bold text-slate-800 dark:text-white text-base group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">${fw.name}</span>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="text-xs ${fw.type === 'news_commentary' ? 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800' : 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800'} px-2 py-1 rounded-full font-semibold border">${fw.type === 'news_commentary' ? 'News Commentary' : 'Viral Script'}</span>
                                    ${fw.isDefault ? '<span class="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded-full font-semibold border border-green-200 dark:border-green-800">Default</span>' : ''}
                                </div>
                            </div>
                        </div>
                        <i data-lucide="arrow-right" class="w-5 h-5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all"></i>
                    </div>
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
            frameworkOptionsContainer.innerHTML = `<div class="text-center p-8"><div class="bg-red-500/10 border border-red-500/20 rounded-xl p-4"><i data-lucide="alert-circle" class="w-8 h-8 text-red-500 mx-auto mb-2"></i><p class="text-red-600 dark:text-red-400 font-semibold">Could not load frameworks</p><p class="text-red-500 text-sm">Using default framework...</p></div></div>`;
            lucide.createIcons();
            setTimeout(() => {
                frameworkSelectModal.classList.add('hidden');
                onSelectCallback(null);
            }, 2000);
        }
    };


    const renderKeywords = () => {
        keywordsContainer.innerHTML = currentFilters.keywords.map((keyword, index) => `
            <div class="keyword-bubble group flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-semibold px-3 py-1.5 rounded-full shadow-md hover:shadow-lg transition-all">
                <span>${keyword}</span>
                <button class="remove-keyword-btn opacity-80 hover:opacity-100 hover:scale-110 transition-all" data-index="${index}" title="Remove ${keyword}">
                    <i data-lucide="x" class="w-3 h-3 hover:text-red-200"></i>
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
            sortBy: currentFilters.sortBy,
            dateWindow: currentFilters.dateFilter,
            validate: validateNewsToggle.checked,
            page: page,
            keywordLoc: currentFilters.keywordLoc
        });

        if (currentFilters.keywords.length > 0) {
            queryParams.set('keyword', currentFilters.keywords.join(','));
        }
        if (currentFilters.categories.length > 0) {
            queryParams.set('category', currentFilters.categories.join(','));
        }


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
            const getHotScoreBg = (score) => {
                if (score > 85) return 'bg-red-500/10 border-red-500/20';
                if (score > 70) return 'bg-orange-500/10 border-orange-500/20';
                return 'bg-yellow-500/10 border-yellow-500/20';
            };
            const escapedArticle = JSON.stringify(article).replace(/'/g, '&apos;').replace(/"/g, '&quot;');
            return `
                <div class="article-card group bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-slate-800/50 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden" data-article='${escapedArticle}'>
                    <div class="p-6">
                        <!-- Header with title and hot score -->
                        <div class="flex justify-between items-start gap-4 mb-4">
                            <div class="flex-grow">
                                <h3 class="font-bold text-lg text-slate-800 dark:text-white leading-tight group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">${article.title}</h3>
                                <div class="flex items-center gap-3 mt-2">
                                    <p class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        <i data-lucide="calendar" class="w-3 h-3"></i>
                                        ${formatRelativeTime(article.dateTimePub)}
                                    </p>
                                    <a href="${article.url}" target="_blank" class="text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors">
                                        <i data-lucide="external-link" class="w-3 h-3"></i>
                                        Source
                                    </a>
                                </div>
                            </div>
                            <div class="flex-shrink-0">
                                <div class="flex items-center gap-2 px-3 py-1.5 rounded-full border-2 ${getHotScoreBg(article.hot_score)}" title="Viral Potential Score: ${article.hot_score}/100">
                                    <i data-lucide="flame" class="w-4 h-4 ${getHotScoreColor(article.hot_score)}"></i>
                                    <span class="text-sm font-bold ${getHotScoreColor(article.hot_score)}">${article.hot_score}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Article summary -->
                        <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">${article.summary.substring(0, 300)}...</p>

                        <!-- Psychology tactic section -->
                        <div class="bg-gradient-to-r from-purple-500/5 to-blue-500/5 p-4 rounded-xl border border-purple-200/30 dark:border-purple-700/30 mb-6">
                            <div class="flex items-start gap-3">
                                <div class="bg-gradient-to-r from-purple-500 to-blue-500 p-2 rounded-lg">
                                    <i data-lucide="brain" class="w-4 h-4 text-white"></i>
                                </div>
                                <div class="flex-1">
                                    <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                                        <span class="text-purple-600 dark:text-purple-400 font-bold">Psychology:</span> 
                                        ${article.tactic}
                                    </p>
                                    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">${article.tactic_explanation}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Actions section -->
                        <div class="flex justify-between items-center pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                            <div class="flex items-center gap-2">
                                <button class="feedback-btn group p-2.5 rounded-xl hover:bg-green-500/10 text-slate-500 hover:text-green-500 transition-all hover:scale-110" data-feedback="thumbs_up" title="Good article - find more like this">
                                    <i data-lucide="thumbs-up" class="w-5 h-5 group-hover:scale-110 transition-transform"></i>
                                </button>
                                <button class="feedback-btn group p-2.5 rounded-xl hover:bg-red-500/10 text-slate-500 hover:text-red-500 transition-all hover:scale-110" data-feedback="thumbs_down" title="Not relevant - find less like this">
                                    <i data-lucide="thumbs-down" class="w-5 h-5 group-hover:scale-110 transition-transform"></i>
                                </button>
                            </div>
                            <button class="create-story-btn group bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
                                <i data-lucide="zap" class="w-4 h-4 inline mr-2 group-hover:rotate-12 transition-transform"></i>
                                Create Viral Script
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        renderPaginationControls();
        lucide.createIcons();
    };

    const renderPaginationControls = () => {
        const totalFrontendPages = Math.ceil(allFetchedArticles.length / articlesPerPage);
        if (totalFrontendPages <= 1 && currentApiPage >= totalApiPages) return;

        let paginationHTML = '<div class="flex items-center justify-center gap-2 mt-8 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-slate-800/50 shadow-lg">';
        paginationHTML += `<button data-page="${currentPage - 1}" class="page-btn group p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-all hover:scale-105" ${currentPage === 1 ? 'disabled' : ''}><i data-lucide="chevron-left" class="w-5 h-5 group-hover:-translate-x-1 transition-transform"></i></button>`;

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
                paginationHTML += `<span class="px-3 py-2 text-sm font-medium text-slate-500">...</span>`;
            } else {
                paginationHTML += `<button data-page="${item}" class="page-btn px-4 py-2 text-sm font-semibold rounded-xl transition-all hover:scale-105 ${item === currentPage ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}">${item}</button>`;
            }
        });
        
        paginationHTML += `<button data-page="${currentPage + 1}" class="page-btn group p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-all hover:scale-105" ${currentPage === totalFrontendPages ? 'disabled' : ''}><i data-lucide="chevron-right" class="w-5 h-5 group-hover:translate-x-1 transition-transform"></i></button>`;
        if (currentApiPage < totalApiPages && currentPage === totalFrontendPages) {
             paginationHTML += `<button id="fetch-more-btn" class="group ml-2 px-6 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105">Load More <i data-lucide="chevrons-right" class="w-4 h-4 inline-block ml-1 group-hover:translate-x-1 transition-transform"></i></button>`;
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
    
    const handleArticleFeedback = async (e) => {
        const feedbackBtn = e.target.closest('.feedback-btn');
        if (!feedbackBtn || feedbackBtn.disabled) return;

        const articleDiv = feedbackBtn.closest('.article-card');
        const article = JSON.parse(articleDiv.dataset.article.replace(/&apos;/g, "'").replace(/"/g, '"'));
        const feedback = feedbackBtn.dataset.feedback;

        const thumbsUpBtn = articleDiv.querySelector('[data-feedback="thumbs_up"]');
        const thumbsDownBtn = articleDiv.querySelector('[data-feedback="thumbs_down"]');

        thumbsUpBtn.disabled = true;
        thumbsDownBtn.disabled = true;

        promptUpdateLoaderModal.classList.remove('hidden');

        try {
            await apiCall('/api/update-validation-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article, feedback })
            });
            console.log("Feedback sent successfully for article:", article.title);

            if (feedback === 'thumbs_down') {
                articleDiv.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
                articleDiv.style.opacity = '0';
                articleDiv.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    allFetchedArticles = allFetchedArticles.filter(a => a.url !== article.url);
                    renderNewsPage();
                }, 500);
            } else {
                thumbsUpBtn.classList.remove('hover:bg-green-500/10', 'hover:text-green-500');
                thumbsUpBtn.classList.add('bg-green-500/10', 'text-green-500');
            }
        } catch (error) {
            showErrorModal(error.message === 'MODEL_BUSY' ? 'modelBusy' : 'general', error.message);
            thumbsUpBtn.disabled = false;
            thumbsDownBtn.disabled = false;
            if (feedback === 'thumbs_up') {
                thumbsUpBtn.classList.add('hover:bg-green-500/10', 'hover:text-green-500');
                thumbsUpBtn.classList.remove('bg-green-500/10', 'text-green-500');
            }
        } finally {
            promptUpdateLoaderModal.classList.add('hidden');
        }
    };

    const handleCreateStoryFromNews = (e) => {
        const createBtn = e.target.closest('.create-story-btn');
        if (!createBtn) return;
        const articleDiv = createBtn.closest('.article-card');
        articleToProcess = JSON.parse(articleDiv.dataset.article.replace(/&apos;/g, "'").replace(/"/g, '"'));
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
        keywordLocContainer.querySelector(`input[value="${currentFilters.keywordLoc}"]`).checked = true;
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

    const setDefaultFilters = async () => {
        try {
            const defaults = await apiCall('/api/default-keywords-and-categories');
            DEFAULT_KEYWORDS = defaults.keywords || [];
            DEFAULT_CATEGORIES = defaults.categories || [];
            currentFilters = { 
                keywords: [...DEFAULT_KEYWORDS], 
                categories: [...DEFAULT_CATEGORIES], 
                sortBy: DEFAULT_SORTBY, 
                dateFilter: DEFAULT_DATE_FILTER,
                keywordLoc: DEFAULT_KEYWORD_LOC
            };
            updateFilterModalUI();
        } catch (error) {
            showErrorModal('general', 'Could not load default filters.');
        }
    };

    const handleExecuteCustomSearch = () => {
        currentFilters.categories = Array.from(searchCategoryContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value).filter(val => val !== 'none');
        currentFilters.sortBy = sortByContainer.querySelector('input[name="sort_by"]:checked').value;
        currentFilters.dateFilter = dateFilterSelect.value;
        currentFilters.keywordLoc = keywordLocContainer.querySelector('input[name="keyword_loc"]:checked').value;
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
        toggleButtonLoading(generateBtn, true, 'Generating...');

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
            toggleButtonLoading(generateBtn, false);
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

    const handleMakeDefault = async () => {
        const makeDefaultButton = makeDefaultBtn;
        
        // Manually set loading state
        const btnText = makeDefaultButton.querySelector('.btn-text');
        const btnIcon = makeDefaultButton.querySelector('.btn-icon');
        
        if (!btnText || !btnIcon) {
            console.error('Button elements not found');
            return;
        }
        
        // Store original state
        const originalText = btnText.textContent;
        const originalIcon = makeDefaultButton.dataset.icon || 'bookmark';
        const originalClasses = makeDefaultButton.className;
        
        // Set loading state manually
        btnText.textContent = 'Saving...';
        btnIcon.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i>';
        makeDefaultButton.disabled = true;
        lucide.createIcons();

        try {
            // Get current filter values from UI
            const currentKeywords = [...currentFilters.keywords];
            const currentCategories = Array.from(searchCategoryContainer.querySelectorAll('input[type="checkbox"]:checked'))
                .map(cb => cb.value)
                .filter(val => val !== 'none');

            // Prepare the data to save
            const defaultData = {
                keywords: currentKeywords,
                categories: currentCategories
            };

            // Send to backend
            const response = await apiCall('/api/save-default-keywords-categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(defaultData)
            });

            if (response.success) {
                // Update local defaults
                DEFAULT_KEYWORDS = [...currentKeywords];
                DEFAULT_CATEGORIES = [...currentCategories];
                
                // Update the filter indicator
                updateFilterIndicator();
                
                // Show success state - green button
                btnText.textContent = 'Saved!';
                btnIcon.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
                makeDefaultButton.className = makeDefaultButton.className.replace(
                    /bg-slate-\d+\s+dark:bg-slate-\d+\s+hover:bg-slate-\d+\s+dark:hover:bg-slate-\d+\s+text-slate-\d+\s+dark:text-slate-\d+/g,
                    'bg-green-500 hover:bg-green-600 text-white'
                );
                makeDefaultButton.disabled = false;
                lucide.createIcons();
                
                // Reset to original state after 2 seconds
                setTimeout(() => {
                    btnText.textContent = originalText;
                    btnIcon.innerHTML = `<i data-lucide="${originalIcon}" class="w-4 h-4"></i>`;
                    makeDefaultButton.className = originalClasses;
                    makeDefaultButton.disabled = false;
                    lucide.createIcons();
                }, 2000);
                
            } else {
                // Reset to original state on failure
                btnText.textContent = originalText;
                btnIcon.innerHTML = `<i data-lucide="${originalIcon}" class="w-4 h-4"></i>`;
                makeDefaultButton.disabled = false;
                lucide.createIcons();
            }
        } catch (error) {
            console.error('Failed to save default settings:', error);
            showErrorModal('general', 'Failed to save default settings. Please try again.');
            
            // Reset to original state on error
            btnText.textContent = originalText;
            btnIcon.innerHTML = `<i data-lucide="${originalIcon}" class="w-4 h-4"></i>`;
            makeDefaultButton.disabled = false;
            lucide.createIcons();
        }
    };

    // --- EVENT LISTENERS & INITIALIZATION ---
    const init = async () => {
        await setDefaultFilters(); // Load defaults first
        
        fetchContentBtn.addEventListener('click', () => {
            fetchContentBtn.parentElement.style.display = 'none';
            scanForNews();
        });

        shuffleBtn.addEventListener('click', handleShuffleNews);
        container.addEventListener('click', (e) => {
            handleCreateStoryFromNews(e);
            handleArticleFeedback(e);
        });
        customSearchBtn.addEventListener('click', () => {
            updateFilterModalUI();
            customSearchModal.classList.remove('hidden');
        });
        closeSearchModalBtn.addEventListener('click', () => customSearchModal.classList.add('hidden'));
        executeSearchBtn.addEventListener('click', handleExecuteCustomSearch);
        resetSearchBtn.addEventListener('click', setDefaultFilters);
        makeDefaultBtn.addEventListener('click', handleMakeDefault);
        usePromptBtn.addEventListener('click', togglePromptUI);
        generateFiltersBtn.addEventListener('click', handleGenerateFilters);
        searchCategoryContainer.addEventListener('change', handleCategorySelection);
        addKeywordInput.addEventListener('keydown', handleAddKeywordKeydown);
        addKeywordBtn.addEventListener('click', addKeywordFromInput);
        keywordsContainer.addEventListener('click', handleRemoveKeyword);
        closeErrorModalBtn.addEventListener('click', () => errorModal.classList.add('hidden'));
        validateNewsToggle.addEventListener('change', () => scanForNews(1));
        closeFrameworkSelectModalBtn?.addEventListener('click', () => frameworkSelectModal.classList.add('hidden'));
    };
    
    init();
});
