// public/js/instagram-competitors-live.js
// Handles all client-side interactions for the instagram-competitors-live.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const loader = document.getElementById('news-loader');
    const container = document.getElementById('news-articles-container');
    const errorContainer = document.getElementById('news-error');
    // Filter button and modal elements removed
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
    const initialCompetitorsContainer = document.getElementById('initial-competitors-container');
    const initialAddCompetitorInput = document.getElementById('initial-add-competitor-input');
    const initialAddCompetitorBtn = document.getElementById('initial-add-competitor-btn');
    const initialSearchDepthInput = document.getElementById('initial-search-depth-input');
    const initialCostEstimationText = document.getElementById('initial-cost-estimation-text');

    // --- STATE MANAGEMENT ---
    let allPosts = [];
    let filteredPosts = [];
    let currentPage = 1;
    const postsPerPage = 10;
    let filters = {
        competitors: [],
        contentType: 'stories',
        minViews: 0,
        minLikes: 0,
        minComments: 0,
        dateFilter: 'any',
        resultsLimit: 5
    };
    let postToProcess = null;

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
    
    const renderCompetitors = (containerEl) => {
        containerEl.innerHTML = filters.competitors.map((competitor, index) => `
            <div class="group flex items-center gap-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200/50 dark:border-indigo-700/30 text-slate-800 dark:text-slate-200 text-sm font-medium px-3 py-2 rounded-xl backdrop-blur-sm transition-all hover:from-indigo-500/20 hover:to-purple-500/20">
                <span class="font-semibold">@${competitor}</span>
                <button class="remove-competitor-btn opacity-70 hover:opacity-100 hover:text-red-500 transition-all" data-index="${index}" title="Remove ${competitor}">
                    <i data-lucide="x" class="w-4 h-4 hover:scale-110 transition-transform"></i>
                </button>
            </div>
        `).join('') || '<div class="text-slate-500 dark:text-slate-400 text-sm italic py-2">No competitors added yet</div>';
        lucide.createIcons();
    };

    const addCompetitorFromInput = (inputEl, containerEl) => {
        const newCompetitor = inputEl.value.trim();
        if (newCompetitor && !filters.competitors.includes(newCompetitor)) {
            filters.competitors.push(newCompetitor);
            renderCompetitors(containerEl);
            updateCostEstimation();
        }
        inputEl.value = '';
        inputEl.focus();
    };

    const handleRemoveCompetitor = (e) => {
        const removeBtn = e.target.closest('.remove-competitor-btn');
        if (removeBtn) {
            const indexToRemove = parseInt(removeBtn.dataset.index);
            filters.competitors.splice(indexToRemove, 1);
            renderCompetitors(initialCompetitorsContainer);
            updateCostEstimation();
        }
    };

    const updateCostEstimation = () => {
        const numCompetitors = filters.competitors.length;
        const depth = parseInt(initialSearchDepthInput.value) || 0;
        const totalPosts = numCompetitors * depth;
        const cost = (totalPosts / 1000) * 2.30; // Assuming a similar cost structure
        initialCostEstimationText.textContent = `$${cost.toFixed(4)}`;
    };

    const scrapeCompetitors = async () => {
        loader.classList.remove('hidden');
        errorContainer.classList.add('hidden');
        container.innerHTML = '';

        try {
            // Get the value from the new select for recency
            const onlyPostsNewerThan = document.getElementById('initial-only-newer-than-select')?.value || '1 week';
            const results = await apiCall('/api/scrape-instagram-competitors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    directUrls: filters.competitors,
                    resultsType: filters.contentType,
                    resultsLimit: filters.resultsLimit,
                    onlyPostsNewerThan
                })
            });

            allPosts = results || [];
            applyClientSideFilters();
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
                <div class="text-center py-16">
                    <div class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-3xl p-8 border border-slate-200/50 dark:border-slate-700/50">
                        <div class="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i data-lucide="users" class="w-8 h-8 text-slate-400 dark:text-slate-500"></i>
                        </div>
                        <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No competitor content found</h3>
                        <p class="text-slate-500 dark:text-slate-400">Try adjusting your filters or adding different competitors.</p>
                    </div>
                </div>
            `;
            paginationContainer.innerHTML = '';
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
                ? `<div class="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                    <i data-lucide="play-circle" class="w-4 h-4"></i> 
                    <span class="font-semibold">${(post.videoPlayCount || 0).toLocaleString()}</span>
                </div>` : '';
            
            const transcriptBtnHTML = filters.contentType === 'stories'
                ? `<button class="transcribe-btn group flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl transition-all transform hover:scale-105 shadow-lg" data-url="${post.url}">
                    <i data-lucide="mic" class="w-4 h-4 group-hover:scale-110 transition-transform"></i>
                    Analyze Content
                </button>`
                : '';

            return `
            <div class="group bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-slate-800/50 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] transform" data-post-id="${post.id}">
                <div class="flex gap-6">
                    <!-- Competitor Post Image -->
                    <div class="relative flex-shrink-0">
                        <img src="/api/image-proxy?url=${encodeURIComponent(post.displayUrl)}" 
                             alt="Post by ${post.ownerUsername}" 
                             class="w-32 h-32 object-cover rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50" 
                             onerror="this.onerror=null;this.src='https://placehold.co/128x128/e2e8f0/475569?text=Error';">
                    </div>
                    
                    <!-- Post Content -->
                    <div class="flex-grow min-w-0">
                        <!-- Header with Creator Info -->
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center gap-3">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                                        <i data-lucide="instagram" class="w-4 h-4 text-white"></i>
                                    </div>
                                    <div>
                                        <p class="font-bold text-slate-800 dark:text-white">@${post.ownerUsername}</p>
                                        <p class="text-xs text-slate-500 dark:text-slate-400">${new Date(post.timestamp).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div class="bg-indigo-100/80 dark:bg-indigo-900/30 px-2.5 py-1 rounded-full">
                                    <span class="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Competitor</span>
                                </div>
                            </div>
                        </div>

                        <!-- Post Caption -->
                        ${captionWithoutHashtags ? 
                            `<div class="mb-4">
                                <p class="text-slate-700 dark:text-slate-300 text-sm leading-relaxed line-clamp-3">${captionWithoutHashtags}</p>
                            </div>` : ''
                        }

                        <!-- Engagement Stats -->
                        <div class="flex items-center gap-6 mb-4 text-sm">
                            <div class="flex items-center gap-1.5 text-red-500 dark:text-red-400">
                                <i data-lucide="heart" class="w-4 h-4"></i>
                                <span class="font-semibold">${(post.likesCount || 0).toLocaleString()}</span>
                            </div>
                            <div class="flex items-center gap-1.5 text-blue-500 dark:text-blue-400">
                                <i data-lucide="message-circle" class="w-4 h-4"></i>
                                <span class="font-semibold">${(post.commentsCount || 0).toLocaleString()}</span>
                            </div>
                            ${viewsHTML}
                        </div>

                        <!-- Hashtags -->
                        ${(post.hashtags && post.hashtags.length > 0) ? 
                            `<div class="flex flex-wrap gap-1.5 mb-4">
                                ${post.hashtags.slice(0, 6).map(tag => 
                                    `<span class="text-xs bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full border border-slate-200/50 dark:border-slate-700/50">#${tag}</span>`
                                ).join('')}
                                ${post.hashtags.length > 6 ? 
                                    `<span class="text-xs text-slate-500 dark:text-slate-400 px-2 py-1">+${post.hashtags.length - 6} more</span>` : ''
                                }
                            </div>` : ''
                        }

                        <!-- Transcript Container -->
                        <div class="transcript-container mb-4"></div>

                        <!-- Action Buttons -->
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <a href="${post.url}" target="_blank" class="group flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all">
                                    <i data-lucide="external-link" class="w-4 h-4 group-hover:rotate-12 transition-transform"></i>
                                    View Post
                                </a>
                                ${transcriptBtnHTML}
                            </div>
                            <div class="generate-story-container"></div>
                        </div>
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
            <div class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl p-4 border border-white/20 dark:border-slate-800/50 shadow-lg">
                <div class="flex items-center justify-center gap-4">
                    <button id="prev-btn" class="group p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${currentPage === 1 ? 'disabled' : ''}" ${currentPage === 1 ? 'disabled' : ''}>
                        <i data-lucide="chevron-left" class="w-5 h-5 group-hover:-translate-x-0.5 transition-transform"></i>
                    </button>
                    <div class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-200/50 dark:border-indigo-700/30">
                        <span class="text-sm font-bold text-slate-700 dark:text-slate-300">Page ${currentPage}</span>
                        <span class="text-sm text-slate-500 dark:text-slate-400">of ${totalPages}</span>
                    </div>
                    <button id="next-btn" class="group p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${currentPage === totalPages ? 'disabled' : ''}" ${currentPage === totalPages ? 'disabled' : ''}>
                        <i data-lucide="chevron-right" class="w-5 h-5 group-hover:translate-x-0.5 transition-transform"></i>
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
                    <div class="bg-gradient-to-r from-blue-50/80 to-purple-50/80 dark:from-blue-950/20 dark:to-purple-950/20 backdrop-blur-sm rounded-2xl p-4 border border-blue-200/50 dark:border-blue-800/30">
                        <div class="flex items-center gap-2 mb-3">
                            <div class="bg-blue-500/20 p-1.5 rounded-lg">
                                <i data-lucide="file-text" class="w-4 h-4 text-blue-600 dark:text-blue-400"></i>
                            </div>
                            <h4 class="text-sm font-bold text-blue-800 dark:text-blue-300">Competitor Analysis</h4>
                        </div>
                        <p class="text-sm text-blue-700 dark:text-blue-300 leading-relaxed bg-white/50 dark:bg-slate-900/30 rounded-xl p-3 border border-blue-200/30 dark:border-blue-700/30">${result.transcript}</p>
                    </div>
                `;
                const generateStoryContainer = postContainer.querySelector('.generate-story-container');
                generateStoryContainer.innerHTML = `
                    <button class="generate-story-btn group flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105" data-post-id="${postContainer.dataset.postId}">
                        <i data-lucide="sparkles" class="w-4 h-4 group-hover:scale-110 transition-transform"></i>
                        Create Viral Script
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

    const handleGenerateStory = (e) => {
        const generateBtn = e.target.closest('.generate-story-btn');
        if (!generateBtn) return;
        
        const postId = generateBtn.dataset.postId;
        postToProcess = allPosts.find(p => p.id === postId);
        
        if (postToProcess && postToProcess.transcript) {
            showFrameworkSelector(processStoryCreation);
        } else {
            console.error("Could not find post or transcript for story generation.");
        }
    };

    const showFrameworkSelector = async (onSelectCallback) => {
        frameworkOptionsContainer.innerHTML = `<div class="flex justify-center items-center py-10"><i data-lucide="refresh-cw" class="w-6 h-6 animate-spin text-primary-500"></i></div>`;
        lucide.createIcons();
        frameworkSelectModal.classList.remove('hidden');

        try {
            const frameworks = await apiCall('/api/frameworks');
            const viralFrameworks = frameworks.filter(fw => fw.type === 'viral_framework');
            frameworkOptionsContainer.innerHTML = viralFrameworks.map(fw => `
                <button class="framework-option-btn w-full text-left p-4 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex justify-between items-center" data-id="${fw._id}">
                    <span>
                        <span class="font-semibold text-slate-800 dark:text-white">${fw.name}</span>
                         <span class="ml-2 text-xs bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full font-medium">Viral Script</span>
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

    const processStoryCreation = async (frameworkId) => {
        if (!postToProcess) return;
        storyLoaderModal.classList.remove('hidden');
        try {
            const newStory = await apiCall('/api/create-story-from-instagram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post: postToProcess, transcript: postToProcess.transcript, frameworkId })
            });
            sessionStorage.setItem('generatedContent', JSON.stringify([newStory]));
            window.location.href = '/reels';
        } catch (error) {
            showErrorModal(error.message === 'MODEL_BUSY' ? 'modelBusy' : 'general', error.message);
        } finally {
            storyLoaderModal.classList.add('hidden');
            postToProcess = null;
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
        renderCompetitors(initialCompetitorsContainer);
        updateCostEstimation();

        fetchContentBtn.addEventListener('click', () => {
            document.getElementById('initial-search-container').style.display = 'none';
            filters.resultsLimit = parseInt(initialSearchDepthInput.value) || 5;
            scrapeCompetitors();
        });

        // Filter button and modal event listeners removed
        initialAddCompetitorInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addCompetitorFromInput(initialAddCompetitorInput, initialCompetitorsContainer);
            }
        });
        initialAddCompetitorBtn.addEventListener('click', () => addCompetitorFromInput(initialAddCompetitorInput, initialCompetitorsContainer));
        initialCompetitorsContainer.addEventListener('click', handleRemoveCompetitor);
        initialSearchDepthInput.addEventListener('input', updateCostEstimation);
        document.querySelectorAll('input[name="content-type"]').forEach(radio => {
            radio.addEventListener('change', handleContentTypeChange);
        });
        shuffleBtn.addEventListener('click', handleShuffle);
        paginationContainer.addEventListener('click', handlePaginationClick);
        container.addEventListener('click', (e) => {
            handleTranscribe(e);
            handleGenerateStory(e);
            if (e.target.closest('.add-competitor-btn')) {
                handleAddCompetitor(e.target.closest('.add-competitor-btn'));
            }
        });
        closeTranscriptionModalBtn.addEventListener('click', () => {
            transcriptionModal.classList.add('hidden');
        });
        // updateFilterModalUI removed
    };
    
    init();
});
