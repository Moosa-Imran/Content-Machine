// public/js/instagram-hashtags.js
// Handles all client-side interactions for the instagram-hashtags.ejs page.

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
    const keywordsContainer = document.getElementById('keywords-container');
    const addKeywordInput = document.getElementById('add-keyword-input');
    const addKeywordBtn = document.getElementById('add-keyword-btn');
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

    // --- STATE MANAGEMENT ---
    let allPosts = [];
    let filteredPosts = [];
    let currentPage = 1;
    const postsPerPage = 10;
    let filters = {
        hashtags: ["marketingpsychology", "behavioraleconomics", "neuromarketing", "cognitivebias", "pricingpsychology", "marketingtips", "psychologyfacts", "businesstips"],
        contentType: 'stories', // Default to reels
        minViews: 10000,
        minLikes: 100, // Default likes for reels
        dateFilter: 'any'
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
    
    const renderKeywords = () => {
        keywordsContainer.innerHTML = filters.hashtags.map((keyword, index) => `
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
        if (newKeyword && !filters.hashtags.includes(newKeyword)) {
            filters.hashtags.push(newKeyword);
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
            filters.hashtags.splice(indexToRemove, 1);
            renderKeywords();
        }
    };

    const scrapeHashtags = async () => {
        loader.classList.remove('hidden');
        errorContainer.classList.add('hidden');
        container.innerHTML = '';

        try {
            const results = await apiCall('/api/scrape-instagram-hashtags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hashtags: filters.hashtags, resultsType: filters.contentType })
            });

            allPosts = results || [];
            applyClientSideFilters();
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

            const viewsCondition = filters.contentType === 'stories' ? views >= filters.minViews : true;
            const likesCondition = likes >= filters.minLikes;

            return dateCondition && viewsCondition && likesCondition;
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

    const renderPosts = (posts) => {
        container.innerHTML = (posts || []).map(post => {
            const captionWithoutHashtags = (post.caption || '').replace(/#\w+/g, '').trim();
            const viewsHTML = filters.contentType === 'stories' 
                ? `<span class="flex items-center gap-1"><i data-lucide="play-circle" class="w-4 h-4"></i> ${post.videoPlayCount || 0}</span>`
                : '';
            const transcriptBtnHTML = filters.contentType === 'stories'
                ? `<div class="mt-4"><button class="transcribe-btn text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold" data-url="${post.url}">Transcript It</button></div>`
                : '';

            return `
            <div class="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800" data-post-id="${post.id}">
                <div class="flex items-start gap-4">
                    <img src="/api/image-proxy?url=${encodeURIComponent(post.displayUrl)}" alt="Post by ${post.ownerUsername}" class="w-24 h-24 object-cover rounded-md" onerror="this.onerror=null;this.src='https://placehold.co/96x96/e2e8f0/475569?text=Error';">
                    <div class="flex-grow">
                        <div class="flex justify-between items-start">
                             <div>
                                <p class="font-bold text-slate-800 dark:text-white">${post.ownerUsername}</p>
                                <p class="text-xs text-slate-400">${new Date(post.timestamp).toLocaleString()}</p>
                            </div>
                            <div class="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                <span class="flex items-center gap-1"><i data-lucide="heart" class="w-4 h-4"></i> ${post.likesCount || 0}</span>
                                <span class="flex items-center gap-1"><i data-lucide="message-circle" class="w-4 h-4"></i> ${post.commentsCount || 0}</span>
                                ${viewsHTML}
                            </div>
                        </div>
                        <p class="text-sm text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-wrap">${captionWithoutHashtags}</p>
                        <div class="transcript-container"></div>
                        <div class="mt-2 flex flex-wrap gap-1">
                            ${(post.hashtags || []).map(tag => `<span class="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-full">#${tag}</span>`).join('')}
                        </div>
                         <a href="${post.url}" target="_blank" class="text-primary-600 dark:text-primary-400 text-xs font-semibold mt-2 inline-block">View on Instagram</a>
                         ${transcriptBtnHTML}
                         <div class="generate-story-container"></div>
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
            <div class="flex items-center justify-between">
                <button id="prev-btn" class="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" ${currentPage === 1 ? 'disabled' : ''}>
                    <i data-lucide="arrow-left" class="w-5 h-5"></i>
                </button>
                <span class="text-sm font-medium text-slate-500">Page ${currentPage} of ${totalPages}</span>
                <button id="next-btn" class="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" ${currentPage === totalPages ? 'disabled' : ''}>
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
        document.querySelector(`input[name="content-type"][value="${filters.contentType}"]`).checked = true;
        const minViewsContainer = document.getElementById('min-views-container');
        const minLikesInput = document.getElementById('min-likes-input');

        if (filters.contentType === 'stories') {
            minViewsContainer.style.display = 'block';
            minViewsContainer.querySelector('input').value = filters.minViews;
            minLikesInput.value = filters.minLikes;
        } else {
            minViewsContainer.style.display = 'none';
            minLikesInput.value = filters.minLikes;
        }

        document.getElementById('date-uploaded-select').value = filters.dateFilter;
        renderKeywords();
    };

    const handleApplyFilters = () => {
        filters.contentType = document.querySelector('input[name="content-type"]:checked').value;
        filters.minViews = parseInt(document.getElementById('min-views-input').value) || 0;
        filters.minLikes = parseInt(document.getElementById('min-likes-input').value) || 0;
        filters.dateFilter = document.getElementById('date-uploaded-select').value;
        filterModal.classList.add('hidden');
        scrapeHashtags();
    };

    const handleResetFilters = () => {
        filters = {
            hashtags: ["marketingpsychology", "behavioraleconomics", "neuromarketing", "cognitivebias", "pricingpsychology", "marketingtips", "psychologyfacts", "businesstips"],
            contentType: 'stories',
            minViews: 10000,
            minLikes: 100,
            dateFilter: 'any'
        };
        updateFilterModalUI();
    };

    const handleContentTypeChange = (e) => {
        const minViewsContainer = document.getElementById('min-views-container');
        const minLikesInput = document.getElementById('min-likes-input');
        filters.contentType = e.target.value;
        if (e.target.value === 'stories') {
            minViewsContainer.style.display = 'block';
            minLikesInput.value = 100;
            filters.minLikes = 100;
        } else {
            minViewsContainer.style.display = 'none';
            minLikesInput.value = 50;
            filters.minLikes = 50;
        }
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
                    <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Transcript</h4>
                        <p class="text-xs text-slate-500 dark:text-slate-400 p-2 bg-slate-100 dark:bg-slate-800 rounded-md">${result.transcript}</p>
                    </div>
                `;
                const generateStoryContainer = postContainer.querySelector('.generate-story-container');
                generateStoryContainer.innerHTML = `<div class="mt-4"><button class="generate-story-btn text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold" data-post-id="${postContainer.dataset.postId}">Generate Story</button></div>`;
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
            // showErrorModal(error.message === 'MODEL_BUSY' ? 'modelBusy' : 'general', error.message);
        } finally {
            storyLoaderModal.classList.add('hidden');
            postToProcess = null;
        }
    };

    // --- EVENT LISTENERS & INITIALIZATION ---
    const init = () => {
        scrapeHashtags(); // Fetch on page load
        filterBtn.addEventListener('click', () => {
            updateFilterModalUI();
            filterModal.classList.remove('hidden');
        });
        closeFilterModalBtn.addEventListener('click', () => filterModal.classList.add('hidden'));
        applyFiltersBtn.addEventListener('click', handleApplyFilters);
        resetFiltersBtn.addEventListener('click', handleResetFilters);
        addKeywordInput.addEventListener('keydown', handleAddKeywordKeydown);
        addKeywordBtn.addEventListener('click', addKeywordFromInput);
        keywordsContainer.addEventListener('click', handleRemoveKeyword);
        document.querySelectorAll('input[name="content-type"]').forEach(radio => {
            radio.addEventListener('change', handleContentTypeChange);
        });
        shuffleBtn.addEventListener('click', handleShuffle);
        paginationContainer.addEventListener('click', handlePaginationClick);
        container.addEventListener('click', (e) => {
            handleTranscribe(e);
            handleGenerateStory(e);
        });
        closeTranscriptionModalBtn.addEventListener('click', () => {
            transcriptionModal.classList.add('hidden');
        });
        updateFilterModalUI(); // Set initial state of the modal
    };
    
    init();
});
