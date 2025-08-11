// public/js/instagram-hashtags-live.js
// Handles all client-side interactions for the instagram-hashtags-live.ejs page.

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
        contentType: 'stories',
        minViews: 0,
        minLikes: 0,
        minComments: 0,
        dateFilter: 'any',
        resultsLimit: 5
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
            <div class="keyword-bubble flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <span>#${keyword}</span>
                <button class="remove-keyword-btn hover:bg-white/20 rounded-full p-0.5 transition-all duration-200" data-index="${index}" title="Remove ${keyword}">
                    <i data-lucide="x" class="w-3 h-3"></i>
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
        const cost = (totalPosts / 1000) * 2.30;
        initialCostEstimationText.textContent = `$${cost.toFixed(4)}`;
    };

    const scrapeHashtags = async () => {
        loader.classList.remove('hidden');
        errorContainer.classList.add('hidden');
        container.innerHTML = '';

        try {
            const results = await apiCall('/api/scrape-instagram-hashtags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hashtags: filters.hashtags, resultsType: filters.contentType, resultsLimit: filters.resultsLimit })
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
            const postDate = new Date(post.timestamp);
            let dateCondition = true;
            if (filters.dateFilter !== 'any') {
                let hours = 0;
                if (filters.dateFilter === '24h') hours = 24;
                if (filters.dateFilter === '7d') hours = 24 * 7;
                if (filters.dateFilter === '30d') hours = 24 * 30;
                const cutoffDate = new Date(now.getTime() - (hours * 60 * 60 * 1000));
                dateCondition = postDate >= cutoffDate;
            }

            const views = post.videoPlayCount || 0;
            const likes = post.likesCount || 0;
            const comments = post.commentsCount || 0;

            const viewsCondition = views >= filters.minViews;
            const likesCondition = likes >= filters.minLikes;
            const commentsCondition = comments >= filters.minComments;

            return dateCondition && viewsCondition && likesCondition && commentsCondition;
        });

        currentPage = 1;
        displayCurrentPage();
    };

    const displayCurrentPage = () => {
        if (filteredPosts.length === 0) {
            container.innerHTML = `
                <div class="text-center py-16 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl">
                    <div class="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <i data-lucide="search-x" class="w-10 h-10 text-white"></i>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-2">No posts found</h3>
                    <p class="text-slate-400 mb-6">No posts match your current filters. Try adjusting your criteria or adding more hashtags.</p>
                    <button onclick="document.getElementById('filter-btn').click()" class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                        <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
                        Adjust Filters
                    </button>
                </div>
            `;
            paginationContainer.innerHTML = '';
            lucide.createIcons();
        } else {
            const startIndex = (currentPage - 1) * postsPerPage;
            const endIndex = startIndex + postsPerPage;
            const paginatedPosts = filteredPosts.slice(startIndex, endIndex);
            renderPosts(paginatedPosts);
            renderPaginationControls();
        }
    };

    const renderPosts = (posts) => {
        container.innerHTML = (posts || []).map(post => {
            const captionWithoutHashtags = (post.caption || '').replace(/#\w+/g, '').trim();
            const viewsHTML = filters.contentType === 'stories' 
                ? `<span class="flex items-center gap-1.5 text-purple-400"><i data-lucide="play-circle" class="w-4 h-4"></i> ${(post.videoPlayCount || 0).toLocaleString()}</span>`
                : '';
            const transcriptBtnHTML = filters.contentType === 'stories'
                ? `<div class="mt-4"><button class="transcribe-btn bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2" data-url="${post.url}">
                    <i data-lucide="file-text" class="w-4 h-4"></i> Transcript It</button></div>`
                : '';

            return `
            <div class="bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-slate-600 transition-all duration-300" data-post-id="${post.id}">
                <div class="flex items-start gap-6">
                    <!-- Post Image -->
                    <div class="relative flex-shrink-0">
                        <img src="/api/image-proxy?url=${encodeURIComponent(post.displayUrl)}" alt="Post by ${post.ownerUsername}" class="w-24 h-24 object-cover rounded-xl border border-slate-600 shadow-lg" onerror="this.onerror=null;this.src='https://placehold.co/96x96/475569/e2e8f0?text=Error';">
                        ${filters.contentType === 'stories' ? '<div class="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center"><i data-lucide="play" class="w-3 h-3 text-white"></i></div>' : ''}
                    </div>
                    
                    <div class="flex-grow min-w-0">
                        <!-- Header -->
                        <div class="flex justify-between items-start mb-3">
                            <div class="min-w-0 flex-grow">
                                <div class="flex items-center gap-3 mb-1">
                                    <h3 class="font-bold text-white truncate">@${post.ownerUsername}</h3>
                                    <button class="add-competitor-btn bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all duration-300" data-username="${post.ownerUsername}" title="Add ${post.ownerUsername} as competitor">
                                        <i data-lucide="user-plus" class="w-3 h-3"></i>
                                        <span>Add Competitor</span>
                                    </button>
                                </div>
                                <p class="text-sm text-slate-400 flex items-center gap-2">
                                    <i data-lucide="calendar" class="w-3 h-3"></i>
                                    ${new Date(post.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                            </div>
                        </div>

                        <!-- Engagement Stats -->
                        <div class="flex items-center gap-4 mb-3 text-sm">
                            <span class="flex items-center gap-1.5 text-pink-400">
                                <i data-lucide="heart" class="w-4 h-4"></i> 
                                <span class="font-medium">${(post.likesCount || 0).toLocaleString()}</span>
                            </span>
                            <span class="flex items-center gap-1.5 text-blue-400">
                                <i data-lucide="message-circle" class="w-4 h-4"></i> 
                                <span class="font-medium">${(post.commentsCount || 0).toLocaleString()}</span>
                            </span>
                            ${viewsHTML ? `<span class="flex items-center gap-1.5 font-medium">${viewsHTML}</span>` : ''}
                        </div>

                        <!-- Caption -->
                        ${captionWithoutHashtags ? `<p class="text-slate-300 text-sm leading-relaxed mb-3 bg-slate-700/50 p-3 rounded-lg">${captionWithoutHashtags.substring(0, 150)}${captionWithoutHashtags.length > 150 ? '...' : ''}</p>` : ''}
                        
                        <div class="transcript-container"></div>
                        
                        <!-- Hashtags -->
                        <div class="flex flex-wrap gap-1 mb-3">
                            ${(post.hashtags || []).slice(0, 6).map(tag => `<span class="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full">#${tag}</span>`).join('')}
                            ${post.hashtags && post.hashtags.length > 6 ? `<span class="text-xs text-slate-500 px-2 py-1">+${post.hashtags.length - 6} more</span>` : ''}
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center gap-3">
                            <a href="${post.url}" target="_blank" class="inline-flex items-center gap-2 text-pink-400 hover:text-pink-300 font-medium text-sm bg-slate-700/50 px-3 py-2 rounded-lg hover:bg-slate-700 transition-all duration-300">
                                <i data-lucide="external-link" class="w-3 h-3"></i>
                                View on Instagram
                            </a>
                            ${transcriptBtnHTML}
                        </div>
                        <div class="save-container mt-3"></div>
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
            <div class="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <div class="flex items-center justify-between">
                    <button id="prev-btn" class="inline-flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed" ${currentPage === 1 ? 'disabled' : ''}>
                        <i data-lucide="arrow-left" class="w-4 h-4"></i>
                        Previous
                    </button>
                    <div class="flex items-center gap-4 text-sm">
                        <span class="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-semibold">
                            Page ${currentPage} of ${totalPages}
                        </span>
                        <span class="text-slate-400">
                            (${filteredPosts.length} posts total)
                        </span>
                    </div>
                    <button id="next-btn" class="inline-flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed" ${currentPage === totalPages ? 'disabled' : ''}>
                        Next
                        <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </button>
                </div>
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
        document.querySelector(`input[name="content-type"][value="${filters.contentType}"]`).checked = true;
        document.getElementById('min-views-input').value = filters.minViews;
        document.getElementById('min-likes-input').value = filters.minLikes;
        document.getElementById('min-comments-input').value = filters.minComments;
        document.getElementById('date-uploaded-select').value = filters.dateFilter;
    };

    const handleApplyFilters = () => {
        filters.contentType = document.querySelector('input[name="content-type"]:checked').value;
        filters.minViews = parseInt(document.getElementById('min-views-input').value) || 0;
        filters.minLikes = parseInt(document.getElementById('min-likes-input').value) || 0;
        filters.minComments = parseInt(document.getElementById('min-comments-input').value) || 0;
        filters.dateFilter = document.getElementById('date-uploaded-select').value;
        filterModal.classList.add('hidden');
        applyClientSideFilters();
    };

    const handleResetFilters = () => {
        filters.minViews = 0;
        filters.minLikes = 0;
        filters.minComments = 0;
        filters.dateFilter = 'any';
        updateFilterModalUI();
    };

    const handleContentTypeChange = (e) => {
        filters.contentType = e.target.value;
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
                const result = await apiCall('/api/transcribe-video', {
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
                    <div class="mt-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                        <div class="flex items-center gap-2 mb-3">
                            <div class="w-6 h-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                                <i data-lucide="file-text" class="w-3 h-3 text-white"></i>
                            </div>
                            <h4 class="font-semibold text-blue-400">Transcript</h4>
                        </div>
                        <p class="text-sm text-slate-300 leading-relaxed">${result.transcript}</p>
                    </div>
                `;
                const saveContainer = postContainer.querySelector('.save-container');
                saveContainer.innerHTML = `
                    <button class="save-post-btn bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2" data-post-id="${postContainer.dataset.postId}">
                        <i data-lucide="save" class="w-4 h-4"></i>
                        Save It
                    </button>
                `;
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
        button.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i><span class="ml-2">Saving...</span>';
        lucide.createIcons();

        try {
            const result = await apiCall('/api/save-live-post', {
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

    const handleAddCompetitor = async (button) => {
        const username = button.dataset.username;
        if (!username) return;

        button.disabled = true;
        button.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-green-500"></i>';
        lucide.createIcons();

        try {
            const result = await apiCall('/api/add-competitor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            console.log(result.message);
        } catch (error) {
            console.error("Failed to add competitor:", error);
            button.disabled = false;
            button.innerHTML = '<i data-lucide="user-plus" class="w-3 h-3"></i>';
            lucide.createIcons();
        }
    };

    // --- EVENT LISTENERS & INITIALIZATION ---
    const init = () => {
        renderKeywords(initialKeywordsContainer);
        updateCostEstimation();

        fetchContentBtn.addEventListener('click', () => {
            document.getElementById('initial-search-container').style.display = 'none';
            filters.resultsLimit = parseInt(initialSearchDepthInput.value) || 5;
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
        document.querySelectorAll('input[name="content-type"]').forEach(radio => {
            radio.addEventListener('change', handleContentTypeChange);
        });
        shuffleBtn.addEventListener('click', handleShuffle);
        paginationContainer.addEventListener('click', handlePaginationClick);
        container.addEventListener('click', (e) => {
            handleTranscribe(e);
            if (e.target.closest('.save-post-btn')) {
                handleSavePost(e.target.closest('.save-post-btn'));
            }
            if (e.target.closest('.add-competitor-btn')) {
                handleAddCompetitor(e.target.closest('.add-competitor-btn'));
            }
        });
        closeTranscriptionModalBtn.addEventListener('click', () => {
            transcriptionModal.classList.add('hidden');
        });
        updateFilterModalUI();
    };
    
    init();
});
