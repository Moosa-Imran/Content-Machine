// public/js/tiktok-hashtags-live.js
// Handles all client-side interactions for the tiktok-hashtags-live.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const loader = document.getElementById('news-loader');
    const container = document.getElementById('news-articles-container');
    const errorContainer = document.getElementById('news-error');
    const filterBtn = document.getElementById('filter-btn');
    const filterModal = document.getElementById('filter-modal');
    const closeFilterModalBtn = document.getElementById('close-filter-modal-btn');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const paginationContainer = document.getElementById('pagination-container');
    const transcriptionModal = document.getElementById('transcription-modal');
    const transcriptionLoading = document.getElementById('transcription-loading');
    const transcriptionError = document.getElementById('transcription-error');
    const retryTranscriptionBtn = document.getElementById('retry-transcription-btn');
    const closeTranscriptionModalBtn = document.getElementById('close-transcription-modal-btn');
    const frameworkSelectModal = document.getElementById('framework-select-modal');
    const frameworkOptionsContainer = document.getElementById('framework-options-container');
    const closeFrameworkSelectModalBtn = document.getElementById('close-framework-select-modal-btn');
    const storyLoaderModal = document.getElementById('story-loader-modal');
    const fetchContentBtn = document.getElementById('fetch-content-btn');
    const initialKeywordsContainer = document.getElementById('initial-keywords-container');
    const initialAddKeywordInput = document.getElementById('initial-add-keyword-input');
    const initialAddKeywordBtn = document.getElementById('initial-add-keyword-btn');
    const initialSearchDepthInput = document.getElementById('initial-search-depth-input');
    const initialCostEstimationText = document.getElementById('initial-cost-estimation-text');

    // --- STATE MANAGEMENT ---
    let allPosts = [];
    let filteredPosts = [];
    let currentPage = 1;
    const postsPerPage = 10;
    let filters = {
        hashtags: [],
        minPlays: 0,
        minLikes: 0,
        minComments: 0,
        minShares: 0,
        dateFilter: 'any',
        minDuration: 0,
        maxDuration: 300,
        resultsLimit: 10
    };
    let postToProcess = null;
    let currentTranscribingBtn = null;

    // --- API & UI HELPERS ---
    const apiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'An unknown server error occurred' }));
                throw new Error(errorData.error || 'An unknown error occurred.');
            }
            return await response.json();
        } catch (error) {
            console.error(`API call to ${endpoint} failed:`, error);
            throw error;
        }
    };
    
    const renderKeywords = (containerEl) => {
        containerEl.innerHTML = filters.hashtags.map((keyword, index) => `
            <div class="keyword-bubble flex items-center gap-1.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-medium px-3 py-1.5 rounded-full shadow-sm">
                <span>${keyword}</span>
                <button class="remove-keyword-btn" data-index="${index}" title="Remove ${keyword}">
                    <i data-lucide="x" class="w-4 h-4 hover:text-red-200 transition-colors"></i>
                </button>
            </div>
        `).join('');
        lucide.createIcons();
    };

    const addKeywordFromInput = (inputEl, containerEl) => {
        const newKeyword = inputEl.value.trim().replace(/,$/, '');
        if (newKeyword && !filters.hashtags.includes(newKeyword)) {
            filters.hashtags.push(newKeyword);
            renderKeywords(containerEl);
            updateCostEstimation();
        }
        inputEl.value = '';
        inputEl.focus();
    };

    const handleRemoveKeyword = (e) => {
        const removeBtn = e.target.closest('.remove-keyword-btn');
        if (removeBtn) {
            const indexToRemove = parseInt(removeBtn.dataset.index);
            filters.hashtags.splice(indexToRemove, 1);
            renderKeywords(initialKeywordsContainer);
            updateCostEstimation();
        }
    };

    const updateCostEstimation = () => {
        const numHashtags = filters.hashtags.length;
        const depth = parseInt(initialSearchDepthInput.value) || 0;
        const totalPosts = numHashtags * depth;
        // TikTok scraping cost estimation: $5.00 per 1000 posts
        const cost = (totalPosts / 1000) * 5.00;
        initialCostEstimationText.textContent = `$${cost.toFixed(4)}`;
    };

    const scrapeHashtags = async () => {
        loader.classList.remove('hidden');
        errorContainer.classList.add('hidden');
        container.innerHTML = '';

        try {
            const results = await apiCall('/api/scrape-tiktok-hashtags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    hashtags: filters.hashtags, 
                    resultsLimit: filters.resultsLimit 
                })
            });

            allPosts = results || [];
            applyClientSideFilters();
            filterBtn.classList.remove('hidden');
            shuffleBtn.classList.remove('hidden');
        } catch (error) {
            errorContainer.textContent = `Error: ${error.message}`;
            errorContainer.classList.remove('hidden');
        } finally {
            loader.classList.add('hidden');
        }
    };

    const applyClientSideFilters = () => {
        const now = new Date();
        filteredPosts = allPosts.filter(post => {
            const postDate = new Date(post.createTimeISO);
            let dateCondition = true;
            if (filters.dateFilter !== 'any') {
                let hours = 0;
                if (filters.dateFilter === '24h') hours = 24;
                if (filters.dateFilter === '7d') hours = 24 * 7;
                if (filters.dateFilter === '30d') hours = 24 * 30;
                const cutoffDate = new Date(now.getTime() - (hours * 60 * 60 * 1000));
                dateCondition = postDate >= cutoffDate;
            }

            const plays = post.playCount || 0;
            const likes = post.diggCount || 0;
            const comments = post.commentCount || 0;
            const shares = post.shareCount || 0;
            const duration = post.videoMeta?.duration || 0;

            const playsCondition = plays >= filters.minPlays;
            const likesCondition = likes >= filters.minLikes;
            const commentsCondition = comments >= filters.minComments;
            const sharesCondition = shares >= filters.minShares;
            const durationCondition = duration >= filters.minDuration && duration <= filters.maxDuration;

            return dateCondition && playsCondition && likesCondition && commentsCondition && sharesCondition && durationCondition;
        });

        currentPage = 1;
        displayCurrentPage();
    };

    const displayCurrentPage = () => {
        if (filteredPosts.length === 0) {
            container.innerHTML = `<div class="text-center text-slate-500 p-8 bg-white dark:bg-slate-900/50 rounded-xl">No posts found matching your filters.</div>`;
            paginationContainer.innerHTML = '';
        } else {
            const startIndex = (currentPage - 1) * postsPerPage;
            const endIndex = startIndex + postsPerPage;
            const paginatedPosts = filteredPosts.slice(startIndex, endIndex);
            renderPosts(paginatedPosts);
            renderPaginationControls();
        }
    };

    const formatNumber = (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    };

    const renderPosts = (posts) => {
        container.innerHTML = (posts || []).map(post => {
            const textWithoutHashtags = (post.text || '').replace(/#\w+/g, '').trim();
            const duration = post.videoMeta?.duration ? `${post.videoMeta.duration}s` : 'N/A';
            const transcriptBtnHTML = `
                <div class="mt-4">
                    <button class="transcribe-btn text-sm bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg font-semibold" data-url="${post.webVideoUrl}">
                        Transcript It
                    </button>
                </div>
            `;

            return `
            <div class="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors" data-post-id="${post.id}">
                <div class="flex items-start gap-4">
                    <img src="/api/image-proxy?url=${encodeURIComponent(post.videoMeta?.coverUrl || post.authorMeta?.avatar)}" alt="Post by ${post.authorMeta?.nickName}" class="w-24 h-24 object-cover rounded-lg shadow-lg" onerror="this.onerror=null;this.src='https://placehold.co/96x96/475569/64748B?text=TikTok';">
                    <div class="flex-grow">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <div class="flex items-center gap-2 mb-1">
                                    <p class="font-bold text-white">${post.authorMeta?.nickName || post.authorMeta?.name || 'Unknown'}</p>
                                    ${post.authorMeta?.verified ? '<i data-lucide="badge-check" class="w-4 h-4 text-blue-400" title="Verified"></i>' : ''}
                                </div>
                                <p class="text-xs text-slate-400">${new Date(post.createTimeISO).toLocaleString()}</p>
                                <p class="text-xs text-slate-400">Duration: ${duration}</p>
                            </div>
                            <div class="flex items-center gap-4 text-sm">
                                <span class="flex items-center gap-1 text-purple-400"><i data-lucide="play-circle" class="w-4 h-4"></i> ${formatNumber(post.playCount || 0)}</span>
                                <span class="flex items-center gap-1 text-pink-400"><i data-lucide="heart" class="w-4 h-4"></i> ${formatNumber(post.diggCount || 0)}</span>
                                <span class="flex items-center gap-1 text-blue-400"><i data-lucide="message-circle" class="w-4 h-4"></i> ${formatNumber(post.commentCount || 0)}</span>
                                <span class="flex items-center gap-1 text-emerald-400"><i data-lucide="share" class="w-4 h-4"></i> ${formatNumber(post.shareCount || 0)}</span>
                            </div>
                        </div>
                        <p class="text-sm text-slate-300 mb-3 whitespace-pre-wrap leading-relaxed">${textWithoutHashtags}</p>
                        <div class="transcript-container mb-3"></div>
                        <div class="mb-3 flex flex-wrap gap-1">
                            ${(post.hashtags || []).map(tag => `<span class="text-xs bg-gradient-to-r from-pink-500/10 to-purple-500/10 text-pink-300 px-2 py-1 rounded-full border border-pink-500/20">#${tag.name || tag}</span>`).join('')}
                        </div>
                        <a href="${post.webVideoUrl}" target="_blank" class="text-pink-400 hover:text-pink-300 text-xs font-semibold inline-block transition-colors">View on TikTok</a>
                        ${transcriptBtnHTML}
                        <div class="save-container"></div>
                    </div>
                </div>
            </div>
        `}).join('');
        lucide.createIcons();
    };

    const renderPaginationControls = () => {
        const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        paginationContainer.innerHTML = `
            <div class="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                <button id="prev-btn" class="p-3 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 hover:text-white transition-colors" ${currentPage === 1 ? 'disabled' : ''}>
                    <i data-lucide="arrow-left" class="w-5 h-5"></i>
                </button>
                <div class="flex items-center space-x-2">
                    <span class="text-sm font-medium text-slate-300">Page</span>
                    <span class="px-3 py-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg text-sm font-bold">${currentPage}</span>
                    <span class="text-sm font-medium text-slate-300">of ${totalPages}</span>
                </div>
                <button id="next-btn" class="p-3 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 hover:text-white transition-colors" ${currentPage === totalPages ? 'disabled' : ''}>
                    <i data-lucide="arrow-right" class="w-5 h-5"></i>
                </button>
            </div>
        `;
        lucide.createIcons();
    };

    const handlePaginationClick = (e) => {
        const prevBtn = e.target.closest('#prev-btn');
        const nextBtn = e.target.closest('#next-btn');

        if (prevBtn && currentPage > 1) {
            currentPage--;
            displayCurrentPage();
        }
        if (nextBtn && currentPage < Math.ceil(filteredPosts.length / postsPerPage)) {
            currentPage++;
            displayCurrentPage();
        }
    };

    const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    };

    const handleShuffle = () => {
        if (filteredPosts.length > 1) {
            shuffleArray(filteredPosts);
            currentPage = 1;
            displayCurrentPage();
        }
    };

    const updateFilterModalUI = () => {
        document.getElementById('min-plays-input').value = filters.minPlays;
        document.getElementById('min-likes-input').value = filters.minLikes;
        document.getElementById('min-comments-input').value = filters.minComments;
        document.getElementById('min-shares-input').value = filters.minShares;
        document.getElementById('date-uploaded-select').value = filters.dateFilter;
        document.getElementById('min-duration-input').value = filters.minDuration;
        document.getElementById('max-duration-input').value = filters.maxDuration;
    };

    const handleApplyFilters = () => {
        filters.minPlays = parseInt(document.getElementById('min-plays-input').value) || 0;
        filters.minLikes = parseInt(document.getElementById('min-likes-input').value) || 0;
        filters.minComments = parseInt(document.getElementById('min-comments-input').value) || 0;
        filters.minShares = parseInt(document.getElementById('min-shares-input').value) || 0;
        filters.dateFilter = document.getElementById('date-uploaded-select').value;
        filters.minDuration = parseInt(document.getElementById('min-duration-input').value) || 0;
        filters.maxDuration = parseInt(document.getElementById('max-duration-input').value) || 300;
        filterModal.classList.add('hidden');
        applyClientSideFilters();
    };

    const handleResetFilters = () => {
        filters.minPlays = 0;
        filters.minLikes = 0;
        filters.minComments = 0;
        filters.minShares = 0;
        filters.dateFilter = 'any';
        filters.minDuration = 0;
        filters.maxDuration = 300;
        updateFilterModalUI();
    };

    const handleTranscribe = async (e) => {
        const transcribeBtn = e.target.closest('.transcribe-btn');
        if (!transcribeBtn) return;

        const url = transcribeBtn.dataset.url;
        const postContainer = transcribeBtn.closest('[data-post-id]');
        const transcriptContainer = postContainer.querySelector('.transcript-container');
        
        const transcribe = async () => {
            transcriptionModal.classList.remove('hidden');
            transcriptionLoading.classList.remove('hidden');
            transcriptionError.classList.add('hidden');

            try {
                const result = await apiCall('/api/transcribe-tiktok-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });

                const postId = postContainer.dataset.postId;
                const post = allPosts.find(p => p.id === postId);
                if (post) {
                    post.transcript = result.transcript;
                }

                transcriptContainer.innerHTML = `
                    <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Transcript</h4>
                        <p class="text-xs text-slate-500 dark:text-slate-400 p-2 bg-slate-100 dark:bg-slate-800 rounded-md">${result.transcript}</p>
                    </div>
                `;
                const saveContainer = postContainer.querySelector('.save-container');
                saveContainer.innerHTML = `<div class="mt-4"><button class="save-post-btn text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold" data-post-id="${postContainer.dataset.postId}">Save It</button></div>`;
                transcriptionModal.classList.add('hidden');
                transcribeBtn.style.display = 'none';
                lucide.createIcons();
            } catch (error) {
                transcriptionLoading.classList.add('hidden');
                transcriptionError.classList.remove('hidden');
            }
        };

        retryTranscriptionBtn.onclick = () => {
            transcribe();
        };

        transcribe();
    };

    const handleSavePost = async (button) => {
        const postId = button.dataset.postId;
        const post = allPosts.find(p => p.id === postId);

        if (!post) {
            alert('Error: Could not find the post to save.');
            return;
        }

        button.disabled = true;
        button.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin mr-2"></i>Saving...';
        lucide.createIcons();

        try {
            const result = await apiCall('/api/save-tiktok-post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post })
            });
            
            button.innerHTML = '<i data-lucide="check" class="w-4 h-4 mr-2"></i>Saved';
            button.classList.remove('bg-green-600', 'hover:bg-green-700');
            button.classList.add('bg-slate-400', 'cursor-not-allowed');
            lucide.createIcons();
        } catch (error) {
            alert(`Error: ${error.message}`);
            button.disabled = false;
            button.innerHTML = 'Save It';
        }
    };

    // --- EVENT LISTENERS & INITIALIZATION ---
    const init = () => {
        renderKeywords(initialKeywordsContainer);
        updateCostEstimation();

        fetchContentBtn.addEventListener('click', () => {
            document.getElementById('initial-search-container').style.display = 'none';
            filters.resultsLimit = parseInt(initialSearchDepthInput.value) || 10;
            scrapeHashtags();
        });

        filterBtn.addEventListener('click', () => {
            updateFilterModalUI();
            filterModal.classList.remove('hidden');
        });
        closeFilterModalBtn.addEventListener('click', () => filterModal.classList.add('hidden'));
        applyFiltersBtn.addEventListener('click', handleApplyFilters);
        resetFiltersBtn.addEventListener('click', handleResetFilters);
        initialAddKeywordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addKeywordFromInput(initialAddKeywordInput, initialKeywordsContainer);
            }
        });
        initialAddKeywordBtn.addEventListener('click', () => addKeywordFromInput(initialAddKeywordInput, initialKeywordsContainer));
        initialKeywordsContainer.addEventListener('click', handleRemoveKeyword);
        initialSearchDepthInput.addEventListener('input', updateCostEstimation);
        shuffleBtn.addEventListener('click', handleShuffle);
        paginationContainer.addEventListener('click', handlePaginationClick);
        container.addEventListener('click', (e) => {
            handleTranscribe(e);
            if (e.target.closest('.save-post-btn')) {
                handleSavePost(e.target.closest('.save-post-btn'));
            }
        });
        closeTranscriptionModalBtn.addEventListener('click', () => {
            transcriptionModal.classList.add('hidden');
        });
        updateFilterModalUI();
    };
    
    init();
});
