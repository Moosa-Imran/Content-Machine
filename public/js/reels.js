// public/js/reels.js
// Handles all client-side interactions for the reels.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let contentFeed = [];
    let currentFeedIndex = 0;
    let isCustomSearchActive = false;
    let newsArticles = []; // To store all fetched news articles for pagination
    let selectedArticles = {}; // To store selected articles across pages
    let currentNewsPage = 1;
    const articlesPerPage = 10;
    const DEFAULT_KEYWORDS = "consumer psychology,behavioral economics,marketing psychology,neuromarketing,cognitive bias,pricing psychology,sensory marketing,social engineering,retail psychology,shopping behavior,behavioral design";
    const DEFAULT_CATEGORIES = ["business", "technology", "general"];
    
    // --- ELEMENT SELECTORS ---
    const reelCardContainer = document.getElementById('reel-card-container');
    const paginationContainer = document.getElementById('pagination-container');
    const findNewScriptsBtn = document.getElementById('find-new-scripts-btn');
    const reelsLoader = document.getElementById('reels-loader');
    const newsModal = document.getElementById('news-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const newsArticlesList = document.getElementById('news-articles-list');
    const createStoriesBtn = document.getElementById('create-stories-btn');
    const refreshNewsBtn = document.getElementById('refresh-news-btn');
    const customSearchBtn = document.getElementById('custom-search-btn');
    const customSearchModal = document.getElementById('custom-search-modal');
    const closeSearchModalBtn = document.getElementById('close-search-modal-btn');
    const executeSearchBtn = document.getElementById('execute-search-btn');
    const searchKeywordsInput = document.getElementById('search-keywords');
    const searchCategoryContainer = document.getElementById('search-category-container');
    const resetSearchBtn = document.getElementById('reset-search-btn');
    const usePromptBtn = document.getElementById('use-prompt-btn');
    const promptContainer = document.getElementById('prompt-container');
    const promptTextarea = document.getElementById('prompt-textarea');
    const generateFiltersBtn = document.getElementById('generate-filters-btn');
    const manualFiltersContainer = document.getElementById('manual-filters-container');

    // --- INITIALIZATION ---
    const init = () => {
        const generatedContent = sessionStorage.getItem('generatedContent');
        if (generatedContent) {
            contentFeed = JSON.parse(generatedContent);
            sessionStorage.removeItem('generatedContent');
        } else {
            const initialDataElement = document.getElementById('initial-data');
            if (initialDataElement) {
                try {
                    contentFeed = JSON.parse(initialDataElement.textContent);
                } catch (e) {
                    console.error("Failed to parse initial data:", e);
                    contentFeed = [];
                }
            }
        }

        currentFeedIndex = 0;
        if (contentFeed.length > 0) {
            renderCurrentReel();
        }
        
        attachEventListeners();
    };
    
    // --- EVENT LISTENERS ---
    const attachEventListeners = () => {
        findNewScriptsBtn?.addEventListener('click', openNewsModalAndFetch);
        reelCardContainer.addEventListener('click', handleCardClick);
        
        // News Modal Listeners
        closeModalBtn?.addEventListener('click', () => {
            newsModal.classList.add('hidden');
        });
        createStoriesBtn?.addEventListener('click', handleCreateStoriesClick);
        refreshNewsBtn?.addEventListener('click', handleShuffleNews);
        customSearchBtn?.addEventListener('click', () => {
            setDefaultFilters();
            customSearchModal.classList.remove('hidden');
        });
        newsArticlesList.addEventListener('change', handleArticleSelection);

        // Custom Search Modal Listeners
        closeSearchModalBtn?.addEventListener('click', () => customSearchModal.classList.add('hidden'));
        executeSearchBtn?.addEventListener('click', handleExecuteCustomSearch);
        resetSearchBtn?.addEventListener('click', handleResetSearch);
        usePromptBtn?.addEventListener('click', togglePromptUI);
        generateFiltersBtn?.addEventListener('click', handleGenerateFilters);
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
            
            togglePromptUI(); // Hide prompt UI and re-enable manual filters

        } catch (error) {
            alert(`Failed to generate filters: ${error.message}`);
        } finally {
            toggleButtonLoading(generateFiltersBtn, false);
        }
    };

    const setDefaultFilters = () => {
        searchKeywordsInput.value = DEFAULT_KEYWORDS.replace(/,/g, ', ');
        searchCategoryContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = DEFAULT_CATEGORIES.includes(cb.value);
        });
    };

    const resetFilterState = () => {
        setDefaultFilters();
        if (isCustomSearchActive) {
            isCustomSearchActive = false;
            updateFilterIndicator();
        }
    };

    const handleShuffleNews = () => {
        if (newsArticles.length > 0) {
            for (let i = newsArticles.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newsArticles[i], newsArticles[j]] = [newsArticles[j], newsArticles[i]];
            }
            selectedArticles = {};
            currentNewsPage = 1;
            populateNewsModal();
            newsArticlesList.scrollTop = 0;
        }
    };

    const handleResetSearch = () => {
        customSearchModal.classList.add('hidden');
        resetFilterState();
        fetchNewsForModal();
    };

    const updateFilterIndicator = () => {
        const indicator = customSearchBtn.querySelector('.filter-indicator');
        if (isCustomSearchActive) {
            if (!indicator) {
                customSearchBtn.classList.add('relative');
                customSearchBtn.insertAdjacentHTML('beforeend', '<span class="filter-indicator absolute top-0 right-0 block h-2 w-2 rounded-full bg-primary-500 ring-2 ring-white dark:ring-slate-900"></span>');
            }
            refreshNewsBtn.classList.add('hidden');
        } else {
            if (indicator) {
                indicator.remove();
            }
            refreshNewsBtn.classList.remove('hidden');
        }
    };

    const openNewsModalAndFetch = async () => {
        newsModal.classList.remove('hidden');
        await fetchNewsForModal();
    };

    const handleExecuteCustomSearch = () => {
        const keywords = searchKeywordsInput.value
            .split(',')
            .map(kw => kw.trim())
            .filter(kw => kw)
            .join(',');

        const selectedCategories = Array.from(searchCategoryContainer.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value)
            .join(',');
        
        const queryParams = new URLSearchParams();
        if (keywords) {
            queryParams.append('keyword', keywords);
        }
        if (selectedCategories) {
            queryParams.append('category', selectedCategories);
        }
        
        customSearchModal.classList.add('hidden');
        isCustomSearchActive = !!(keywords || selectedCategories);
        updateFilterIndicator();
        fetchNewsForModal(queryParams.toString());
    };

    const fetchNewsForModal = async (queryParams = '') => {
        newsArticlesList.innerHTML = `
            <div class="flex justify-center items-center h-full py-20">
                <i data-lucide="refresh-cw" class="w-8 h-8 animate-spin text-primary-500"></i>
            </div>`;
        lucide.createIcons();

        try {
            const articles = await apiCall(`/api/fetch-news-for-story-creation?${queryParams}`);
            newsArticles = articles;
            selectedArticles = {};
            currentNewsPage = 1;
            populateNewsModal();
            newsArticlesList.scrollTop = 0;
        } catch (error) {
            newsArticlesList.innerHTML = `<p class="text-center text-red-500 p-4">Failed to load news. Please try again.</p>`;
        }
    };

    const handleArticleSelection = (e) => {
        if (e.target.type === 'checkbox') {
            const articleData = JSON.parse(e.target.dataset.article);
            if (e.target.checked) {
                selectedArticles[articleData.url] = articleData;
            } else {
                delete selectedArticles[articleData.url];
            }
        }
    };

    const populateNewsModal = () => {
        if (!newsArticles || newsArticles.length === 0) {
            newsArticlesList.innerHTML = `<p class="text-center text-slate-500 p-4">No relevant news found for this query.</p>`;
            return;
        }

        const startIndex = (currentNewsPage - 1) * articlesPerPage;
        const endIndex = startIndex + articlesPerPage;
        const paginatedArticles = newsArticles.slice(startIndex, endIndex);

        newsArticlesList.innerHTML = paginatedArticles.map((article, index) => {
            const escapedArticle = JSON.stringify(article).replace(/'/g, "&apos;");
            const isChecked = selectedArticles[article.url] ? 'checked' : '';
            return `
                <label for="article-${startIndex + index}" class="block p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-500/10 has-[:checked]:border-primary-500">
                    <div class="flex items-start gap-4">
                        <input type="checkbox" id="article-${startIndex + index}" class="mt-1" data-article='${escapedArticle}' ${isChecked}>
                        <div>
                            <h4 class="font-semibold text-slate-800 dark:text-white">${article.title}</h4>
                            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">${article.summary}</p>
                            <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-2 inline-block">Read More</a>
                        </div>
                    </div>
                </label>
            `;
        }).join('');

        renderNewsPagination();
    };

    const renderNewsPagination = () => {
        const totalPages = Math.ceil(newsArticles.length / articlesPerPage);
        const existingPagination = newsArticlesList.querySelector('.news-pagination-container');
        if (existingPagination) {
            existingPagination.remove();
        }

        if (totalPages <= 1) return;

        const paginationHTML = `
            <div class="news-pagination-container flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button id="news-prev-btn" class="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <i data-lucide="arrow-left" class="w-5 h-5"></i>
                </button>
                <span class="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Page ${currentNewsPage} of ${totalPages}
                </span>
                <button id="news-next-btn" class="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <i data-lucide="arrow-right" class="w-5 h-5"></i>
                </button>
            </div>
        `;

        newsArticlesList.insertAdjacentHTML('beforeend', paginationHTML);
        lucide.createIcons();

        const prevBtn = document.getElementById('news-prev-btn');
        const nextBtn = document.getElementById('news-next-btn');

        if (currentNewsPage > 1) {
            prevBtn.disabled = false;
            prevBtn.addEventListener('click', () => {
                currentNewsPage--;
                populateNewsModal();
                newsArticlesList.scrollTop = 0;
            }, { once: true });
        }

        if (currentNewsPage < totalPages) {
            nextBtn.disabled = false;
            nextBtn.addEventListener('click', () => {
                currentNewsPage++;
                populateNewsModal();
                newsArticlesList.scrollTop = 0;
            }, { once: true });
        }
    };

    const handleCreateStoriesClick = async () => {
        const articlesToCreate = Object.values(selectedArticles);

        if (articlesToCreate.length === 0) {
            alert('Please select at least one article to create stories from.');
            return;
        }

        toggleButtonLoading(createStoriesBtn, true, 'Creating...');
        try {
            const formattedStories = await apiCall('/api/create-stories-from-news', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ articles: articlesToCreate })
            });

            const validStories = formattedStories.filter(story => story && story.hooks && story.buildUps);
            if(validStories.length === 0) {
                throw new Error("AI failed to generate valid stories from the selected news.");
            }

            contentFeed = validStories;
            currentFeedIndex = 0;
            renderCurrentReel();
            newsModal.classList.add('hidden');
            resetFilterState();
        } catch (error) {
            console.error("Error in handleCreateStoriesClick:", error);
            alert(`Failed to create stories: ${error.message}`);
        } finally {
            toggleButtonLoading(createStoriesBtn, false);
        }
    };
    
    const handleCardClick = (e) => {
        const buildBtn = e.target.closest('.build-script-btn');
        const verifyBtn = e.target.closest('.verify-story-btn');
        const rewriteBtn = e.target.closest('.rewrite-ai-btn');
        const copyBtn = e.target.closest('.copy-text-btn');
        const audioBtn = e.target.closest('.generate-audio-btn');

        if (buildBtn) handleBuildScript();
        if (verifyBtn) handleVerifyStory(verifyBtn);
        if (rewriteBtn) handleAiRewrite(rewriteBtn);
        if (copyBtn) handleCopyScript();
        if (audioBtn) handleGenerateAudio(audioBtn);
    };
    
    const toggleButtonLoading = (button, isLoading, loadingText = 'Loading...') => {
        if (!button) return;
        const icon = button.querySelector('.btn-icon');
        const text = button.querySelector('.btn-text');
        button.disabled = isLoading;

        if (isLoading) {
            if (icon) {
                icon.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i>';
            }
            if (text) text.textContent = loadingText;
        } else {
            if (icon) {
                icon.innerHTML = `<i data-lucide="${button.dataset.icon || 'search'}" class="w-4 h-4"></i>`;
            }
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
    
    const renderCurrentReel = () => {
        if (!contentFeed || contentFeed.length === 0) {
            reelCardContainer.innerHTML = `<div class="text-center text-slate-500 dark:text-slate-400 p-8 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">No scripts found.</div>`;
            return;
        }
        const story = contentFeed[currentFeedIndex];
        reelCardContainer.innerHTML = generateReelCardHTML(story);
        updatePagination();
        document.querySelectorAll('[data-section-type]').forEach(section => {
            const firstOption = section.querySelector('.p-3');
            if (firstOption) {
                selectOption(firstOption, section.dataset.sectionType);
            }
        });
        lucide.createIcons();
    };
    
    const updatePagination = () => {
        if (!contentFeed || contentFeed.length <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        paginationContainer.innerHTML = `
            <div class="flex items-center justify-between">
                <button id="prev-btn" class="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
                <span class="text-sm font-medium text-slate-500 dark:text-slate-400">Script <span class="text-primary-600 dark:text-primary-400 font-bold">${currentFeedIndex + 1}</span> of ${contentFeed.length}</span>
                <button id="next-btn" class="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors">${contentFeed.length - 1 === currentFeedIndex ? 'Find More' : '<i data-lucide="arrow-right" class="w-5 h-5"></i>'}</button>
            </div>`;
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        prevBtn.disabled = currentFeedIndex === 0;
        prevBtn.addEventListener('click', () => {
            if (currentFeedIndex > 0) {
                currentFeedIndex--;
                renderCurrentReel();
            }
        });
        nextBtn.addEventListener('click', () => {
            if (currentFeedIndex < contentFeed.length - 1) {
                currentFeedIndex++;
                renderCurrentReel();
            } else {
                openNewsModalAndFetch();
            }
        });
        if (contentFeed.length - 1 !== currentFeedIndex) {
            lucide.createIcons({ nodes: [nextBtn] });
        }
    };

    const generateReelCardHTML = (story) => {
        const sections = [
            { type: 'hooks', title: 'Hook (0-8s)', icon: 'anchor', color: 'red' },
            { type: 'buildUps', title: 'Build-Up (8-20s)', icon: 'trending-up', color: 'blue' },
            { type: 'stories', title: 'Story (20-45s)', icon: 'book-open', color: 'green' },
            { type: 'psychologies', title: 'Psychology (45-60s)', icon: 'brain-circuit', color: 'purple' }
        ];

        const generateSectionHTML = (sec) => {
            if (!sec || !sec.type) {
                console.error("generateSectionHTML was called with an invalid section:", sec);
                return ''; 
            }
            const options = story[sec.type] || [];
            return `
                <div class="section-block rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div class="flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800" data-color="${sec.color}">
                        <div class="flex items-center gap-2.5">
                            <i data-lucide="${sec.icon}" class="w-5 h-5 text-${sec.color}-500 dark:text-${sec.color}-400"></i>
                            <span class="font-semibold text-sm text-slate-700 dark:text-slate-200">${sec.title}</span>
                        </div>
                    </div>
                    <div class="p-3 space-y-2" data-section-type="${sec.type}">
                        ${options.map((option, index) => `
                            <div class="p-3 rounded-md border cursor-pointer transition-all" onclick="selectOption(this, '${sec.type}')">
                                <label class="flex items-start text-sm cursor-pointer">
                                    <input type="radio" name="${story.id}-${sec.type}" data-index="${index}" ${index === 0 ? 'checked' : ''} class="sr-only" />
                                    <div class="check-icon-container flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 mr-3 flex items-center justify-center transition-all"></div>
                                    <span class="flex-grow text-slate-600 dark:text-slate-300">${(option || '').replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-primary-600 dark:text-primary-400">$1</strong>')}</span>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        };

        return `
            <div class="bg-white dark:bg-slate-900/50 rounded-xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 card-glow max-w-4xl mx-auto" data-story-id="${story.id}">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h3 class="text-2xl font-bold text-slate-800 dark:text-white">Principle: <span class="text-primary-600 dark:text-primary-400">${story.psychology}</span></h3>
                        <div class="flex flex-wrap items-center gap-2 mt-2">
                           <span class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full text-xs font-medium">${story.company}</span>
                           <span class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full text-xs font-medium">${story.industry}</span>
                        </div>
                    </div>
                    <button class="verify-story-btn flex-shrink-0 flex items-center gap-1.5 text-xs bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 px-3 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50" data-icon="shield-check" data-original-text="Verify Story">
                        <span class="btn-icon"><i data-lucide="shield-check" class="w-4 h-4"></i></span>
                        <span class="btn-text">Verify Story</span>
                    </button>
                </div>
                <div class="verification-container mb-4"></div>
                <div class="space-y-4">${sections.map(generateSectionHTML).join('')}</div>
                <div class="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                    <div class="flex flex-wrap gap-2">
                        ${(story.hashtags || []).map(tag => `<span class="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-full">${tag}</span>`).join('')}
                    </div>
                </div>
                <div class="flex justify-center mt-8">
                    <button class="build-script-btn flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg font-semibold text-lg transition-all transform hover:scale-105"><i data-lucide="file-text" class="w-5 h-5"></i> Build Script</button>
                </div>
                <div class="script-editor-container mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 hidden"></div>
            </div>`;
    };

    window.selectOption = (element, type) => {
        const sectionContainer = element.closest(`[data-section-type="${type}"]`);
        const color = element.closest('.section-block').querySelector('[data-color]').dataset.color;

        sectionContainer.querySelectorAll('.p-3').forEach(div => {
            div.className = 'p-3 rounded-md border cursor-pointer transition-all border-slate-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500';
            const iconContainer = div.querySelector('.check-icon-container');
            iconContainer.innerHTML = '';
            iconContainer.className = 'check-icon-container flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 mr-3 flex items-center justify-center transition-all border-slate-400 dark:border-slate-500';
        });
        
        const radioInput = element.querySelector('input[type="radio"]');
        radioInput.checked = true;

        element.className = `p-3 rounded-md border-2 cursor-pointer transition-all border-${color}-500 dark:border-${color}-400 bg-${color}-500/10`;
        const checkDiv = element.querySelector('.check-icon-container');
        checkDiv.className = `check-icon-container flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 mr-3 flex items-center justify-center transition-all border-${color}-400 bg-${color}-500`;
        checkDiv.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-white"></i>';
        
        lucide.createIcons();
    };

    const handleBuildScript = () => {
        const story = contentFeed[currentFeedIndex];
        const selections = {};
        document.querySelectorAll('[data-section-type]').forEach(section => {
            const type = section.dataset.sectionType;
            const checkedRadio = section.querySelector('input[type="radio"]:checked');
            selections[type] = checkedRadio ? parseInt(checkedRadio.dataset.index) : 0;
        });

        const scriptText = `**HOOK:**\n${story.hooks[selections.hooks]}\n\n**BUILD-UP:**\n${story.buildUps[selections.buildUps]}\n\n**STORY:**\n${story.stories[selections.stories]}\n\n**PSYCHOLOGY:**\n${story.psychologies[selections.psychologies]}`;
        
        const editorContainer = document.querySelector('.script-editor-container');
        editorContainer.innerHTML = `
            <div class="bg-white dark:bg-slate-900/50 rounded-xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800">
                <h4 class="text-xl font-bold text-center mb-4 text-slate-800 dark:text-white flex items-center justify-center gap-2"><i data-lucide="edit" class="w-5 h-5 text-primary-500"></i>Script Editor</h4>
                <textarea id="final-script-textarea" class="w-full h-64 p-3 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm">${scriptText}</textarea>
                <div class="mt-4 space-y-4">
                    <input type="text" id="ai-rewrite-prompt" placeholder="Optional: Enter a rewrite instruction (e.g., 'make it funnier')" class="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm" />
                    <button class="rewrite-ai-btn w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50" data-icon="wand-2" data-original-text="Rewrite with AI">
                        <span class="btn-icon"><i data-lucide="wand-2" class="w-5 h-5"></i></span>
                        <span class="btn-text">Rewrite with AI</span>
                    </button>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button class="generate-audio-btn flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50" data-icon="music-4" data-original-text="Generate Audio">
                            <span class="btn-icon"><i data-lucide="music-4" class="w-5 h-5"></i></span>
                            <span class="btn-text">Generate Audio</span>
                        </button>
                        <button class="copy-text-btn flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"><i data-lucide="copy" class="w-5 h-5"></i>Copy Text</button>
                    </div>
                </div>
                <div class="audio-player-container mt-4"></div>
            </div>`;
        editorContainer.classList.remove('hidden');
        lucide.createIcons();
    };

    const handleAiRewrite = async (rewriteBtn) => {
        const aiPromptInput = document.getElementById('ai-rewrite-prompt');
        const finalScriptTextarea = document.getElementById('final-script-textarea');
        if (!aiPromptInput || !finalScriptTextarea) return;

        const aiPrompt = aiPromptInput.value;
        const finalScript = finalScriptTextarea.value;

        if (!aiPrompt) {
            alert('Please enter a rewrite instruction.');
            return;
        }

        toggleButtonLoading(rewriteBtn, true, 'Rewriting...');
        try {
            const result = await apiCall('/api/rewrite-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ finalScript, aiPrompt })
            });
            if (result && result.newScript) {
                finalScriptTextarea.value = result.newScript;
            } else {
                throw new Error('AI did not return a new script.');
            }
        } catch (error) {
            alert(`Failed to rewrite script: ${error.message}`);
        } finally {
            toggleButtonLoading(rewriteBtn, false);
        }
    };

    const handleVerifyStory = async (verifyBtn) => {
        const story = contentFeed[currentFeedIndex];
        toggleButtonLoading(verifyBtn, true, 'Verifying...');
        const verificationContainer = document.querySelector('.verification-container');
        verificationContainer.innerHTML = `<div class="text-center p-4 my-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg"><p class="text-slate-600 dark:text-slate-300">Verifying story with AI...</p></div>`;

        try {
            const result = await apiCall('/api/verify-story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(story)
            });
            verificationContainer.innerHTML = `
                <div class="my-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="font-bold text-slate-700 dark:text-white">Verification Result:</h4>
                        ${story.source_url ? `<a href="${story.source_url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-md font-semibold transition-colors"><i data-lucide="link" class="w-4 h-4"></i>View Source</a>` : ''}
                    </div>
                    <ul class="space-y-2 text-sm mb-3">
                        ${result.checks.map(check => `
                            <li class="flex items-start gap-2">
                                ${check.is_correct ? '<i data-lucide="check-circle-2" class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"></i>' : '<i data-lucide="alert-triangle" class="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"></i>'}
                                <span class="text-slate-600 dark:text-slate-300"><strong>${check.check}:</strong> ${check.comment}</span>
                            </li>`).join('')}
                    </ul>
                    <p class="text-sm font-semibold p-2 rounded ${result.confidence_score > 75 ? 'bg-green-500/10 text-green-700 dark:text-green-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}">
                        <strong>Conclusion:</strong> ${result.conclusion} (Confidence: ${result.confidence_score}%)
                    </p>
                </div>`;
            lucide.createIcons();
        } catch (error) {
            verificationContainer.innerHTML = `<div class="text-center text-red-500 p-4 my-2 bg-red-500/10 rounded-lg border border-red-500/30">${error.message}</div>`;
        } finally {
            toggleButtonLoading(verifyBtn, false);
        }
    };
    
    const handleCopyScript = () => {
        const scriptTextarea = document.getElementById('final-script-textarea');
        const body = scriptTextarea.value.split('\n\n').map(part => (part.split(/:\n/)[1] || part).replace(/\*\*/g, '')).join('\n\n');
        navigator.clipboard.writeText(body).then(() => {
            alert('Script text copied to clipboard!');
        }).catch(err => console.error('Copy failed', err));
    };

    const handleGenerateAudio = async (audioBtn) => {
        const scriptTextarea = document.getElementById('final-script-textarea');
        const audioPlayerContainer = document.querySelector('.audio-player-container');
        
        toggleButtonLoading(audioBtn, true, 'Generating...');
        audioPlayerContainer.innerHTML = '';
        const scriptText = scriptTextarea.value.split('\n\n').map(part => (part.split(/:\n/)[1] || part)).join(' ');

        try {
            const response = await fetch('/api/generate-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scriptText })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to generate audio' }));
                throw new Error(errorData.error);
            }

            const audioBlob = await response.blob();
            const url = URL.createObjectURL(audioBlob);
            audioPlayerContainer.innerHTML = `<audio controls src="${url}" class="w-full">Your browser does not support the audio element.</audio>`;
        } catch (error) {
            audioPlayerContainer.innerHTML = `<p class="text-red-500 dark:text-red-400">Failed to generate audio: ${error.message}</p>`;
        } finally {
            toggleButtonLoading(audioBtn, false);
        }
    };

    // --- START THE APP ---
    init();
});
