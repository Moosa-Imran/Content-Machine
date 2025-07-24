// public/js/instagram-hashtags.js
// Handles interactions for the Instagram content pool page.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const loader = document.getElementById('loader');
    const container = document.getElementById('articles-container');
    const errorContainer = document.getElementById('error-container');
    const updatePoolBtn = document.getElementById('update-pool-btn');
    const updatePoolModal = document.getElementById('update-pool-modal');
    const closeUpdateModalBtn = document.getElementById('close-update-modal-btn');
    const runScrapeJobBtn = document.getElementById('run-scrape-job-btn');
    const hashtagsContainerModal = document.getElementById('hashtags-container-modal');
    const addHashtagInput = document.getElementById('add-hashtag-input');
    const addHashtagBtn = document.getElementById('add-hashtag-btn');
    const searchDepthInput = document.getElementById('search-depth-input');
    const paginationContainer = document.getElementById('pagination-container');
    const notificationModal = document.getElementById('notification-modal');
    const notificationIconContainer = document.getElementById('notification-icon-container');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    const notificationOkBtn = document.getElementById('notification-ok-btn');
    const filterBtn = document.getElementById('filter-btn');
    const filterModal = document.getElementById('filter-modal');
    const closeFilterModalBtn = document.getElementById('close-filter-modal-btn');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const filterIndicator = document.getElementById('filter-indicator');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const costEstimationText = document.getElementById('cost-estimation-text');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmActionBtn = document.getElementById('confirm-action-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const confirmModalTitle = document.getElementById('confirm-modal-title');
    const confirmModalMessage = document.getElementById('confirm-modal-message');
    const fetchContentBtn = document.getElementById('fetch-content-btn');
    
    // Additional modal elements
    const transcriptionModal = document.getElementById('transcription-modal');
    const closeTranscriptionModalBtn = document.getElementById('close-transcription-modal-btn');
    const transcriptionLoading = document.getElementById('transcription-loading');
    const transcriptionError = document.getElementById('transcription-error');
    const retryTranscriptionBtn = document.getElementById('retry-transcription-btn');
    const frameworkSelectModal = document.getElementById('framework-select-modal');
    const frameworkOptionsContainer = document.getElementById('framework-options-container');
    const closeFrameworkModalBtn = document.getElementById('close-framework-modal-btn');
    const storyLoaderModal = document.getElementById('story-loader-modal');

    // --- STATE MANAGEMENT ---
    let allPosts = [];
    let currentPage = 1;
    const postsPerPage = 10;
    let hashtagsToScrape = [];
    let DEFAULT_HASHTAGS = [];
    let postToProcess = null;
    let currentTranscribingBtn = null;
    const DEFAULT_FILTERS = {
        minViews: 0,
        minLikes: 0,
        dateFilter: 'any'
    };
    let filters = { ...DEFAULT_FILTERS };
    let confirmCallback = null;

    // --- API & UI HELPERS ---
    const showNotification = (title, message, type = 'success') => {
        notificationTitle.textContent = title;
        notificationMessage.textContent = message;
        const iconContainer = notificationIconContainer;
        if (type === 'error') {
            iconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-500/20';
            iconContainer.innerHTML = '<i data-lucide="alert-triangle" class="h-6 w-6 text-red-600 dark:text-red-400"></i>';
        } else {
            iconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-500/20';
            iconContainer.innerHTML = '<i data-lucide="check-circle" class="h-6 w-6 text-green-600 dark:text-green-400"></i>';
        }
        notificationModal.classList.remove('hidden');
        lucide.createIcons();
    };

    const showConfirmModal = (title, message, onConfirm) => {
        confirmModalTitle.textContent = title;
        confirmModalMessage.textContent = message;
        confirmCallback = onConfirm;
        confirmModal.classList.remove('hidden');
        lucide.createIcons();
    };

    const hideConfirmModal = () => {
        confirmModal.classList.add('hidden');
        confirmCallback = null;
    };

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

    const updateCostEstimation = () => {
        const numHashtags = hashtagsToScrape.length;
        const depth = parseInt(searchDepthInput.value) || 0;
        const totalPosts = numHashtags * depth;
        const cost = (totalPosts / 1000) * 2.30;
        costEstimationText.textContent = `$${cost.toFixed(4)}`;
    };
    
    const renderHashtagsInModal = () => {
        hashtagsContainerModal.innerHTML = hashtagsToScrape.map((hashtag, index) => `
            <div class="keyword-bubble flex items-center gap-1.5 bg-primary-500 text-white text-sm font-medium px-3 py-1 rounded-full">
                <span>${hashtag}</span>
                <button class="remove-hashtag-btn" data-index="${index}" title="Remove ${hashtag}">
                    <i data-lucide="x" class="w-4 h-4 hover:text-red-200"></i>
                </button>
            </div>
        `).join('');
        lucide.createIcons();
        updateCostEstimation();
    };

    const addHashtagFromInput = () => {
        const newHashtag = addHashtagInput.value.trim().replace(/,$/, '');
        if (newHashtag && !hashtagsToScrape.includes(newHashtag)) {
            hashtagsToScrape.push(newHashtag);
            renderHashtagsInModal();
        }
        addHashtagInput.value = '';
        addHashtagInput.focus();
    };

    const handleAddHashtagKeydown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addHashtagFromInput();
        }
    };

    const handleRemoveHashtag = (e) => {
        const removeBtn = e.target.closest('.remove-hashtag-btn');
        if (removeBtn) {
            const indexToRemove = parseInt(removeBtn.dataset.index);
            hashtagsToScrape.splice(indexToRemove, 1);
            renderHashtagsInModal();
        }
    };

    const fetchPostsFromDB = async (page = 1) => {
        loader.classList.remove('hidden');
        errorContainer.classList.add('hidden');
        container.innerHTML = '';

        try {
            const queryParams = new URLSearchParams({
                page: page,
                limit: postsPerPage,
                minViews: filters.minViews,
                minLikes: filters.minLikes,
                dateFilter: filters.dateFilter
            });
            const data = await apiCall(`/api/instagram-posts?${queryParams.toString()}`);
            allPosts = data.posts || [];
            currentPage = data.currentPage;
            renderPosts(allPosts);
            renderPaginationControls(data.totalPages, data.currentPage);
        } catch (error) {
            errorContainer.textContent = `Error: ${error.message}`;
            errorContainer.classList.remove('hidden');
        } finally {
            loader.classList.add('hidden');
        }
    };

    const renderPosts = (posts) => {
        if (posts.length === 0) {
            container.innerHTML = `<div class="text-center text-slate-500 p-8 bg-white dark:bg-slate-900/50 rounded-xl">Your content pool is empty or no posts match your filters.</div>`;
            return;
        }

        container.innerHTML = posts.map(post => {
            const captionWithoutHashtags = (post.caption || '').replace(/#\w+/g, '').trim();
            const viewsHTML = post.videoPlayCount ? `<span class="flex items-center gap-1"><i data-lucide="play-circle" class="w-4 h-4"></i> ${post.videoPlayCount}</span>` : '';
            const transcriptBtnHTML = post.type === 'Video' ? `<div class="mt-4"><button class="transcribe-btn text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold" data-url="${post.url}">Transcript It</button></div>` : '';
            return `
            <div class="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800" data-post-id="${post._id}">
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
                                <button class="delete-post-btn p-1.5 rounded-full hover:bg-red-500/10 text-red-500" data-post-id="${post._id}" title="Delete Post">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
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
            </div>`;
        }).join('');
        lucide.createIcons();
    };

    const renderPaginationControls = (totalPages, currentPage) => {
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
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

        getPaginationItems(currentPage, totalPages).forEach(item => {
            if (item === '...') {
                paginationHTML += `<span class="px-2 py-2 text-sm font-medium text-slate-500">...</span>`;
            } else {
                paginationHTML += `<button data-page="${item}" class="page-btn px-4 py-2 text-sm font-medium rounded-md ${item === currentPage ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'}">${item}</button>`;
            }
        });
        
        paginationHTML += `<button data-page="${currentPage + 1}" class="page-btn p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" ${currentPage === totalPages ? 'disabled' : ''}><i data-lucide="chevron-right" class="w-5 h-5"></i></button>`;
        paginationHTML += '</div>';
        paginationContainer.innerHTML = paginationHTML;
        lucide.createIcons();
    };

    const handlePaginationClick = (e) => {
        const pageBtn = e.target.closest('.page-btn');
        if (pageBtn && !pageBtn.disabled) {
            const page = parseInt(pageBtn.dataset.page);
            fetchPostsFromDB(page);
        }
    };

    const handleRunScrapeJob = async () => {
        runScrapeJobBtn.disabled = true;
        runScrapeJobBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i> Updating...';
        lucide.createIcons();

        try {
            const resultsLimit = parseInt(searchDepthInput.value) || 5;
            const result = await apiCall('/api/run-hashtag-scrape-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hashtags: hashtagsToScrape, resultsLimit })
            });
            showNotification('Success', result.message);
            fetchPostsFromDB(1); // Refresh the view
        } catch (error) {
            showNotification('Error', error.message, 'error');
        } finally {
            runScrapeJobBtn.disabled = false;
            runScrapeJobBtn.innerHTML = 'Start Scraping';
            updatePoolModal.classList.add('hidden');
        }
    };

    const updateFilterModalUI = () => {
        document.getElementById('min-views-input').value = filters.minViews;
        document.getElementById('min-likes-input').value = filters.minLikes;
        document.getElementById('date-uploaded-select').value = filters.dateFilter;
    };

    const updateFilterIndicator = () => {
        const isDefault = filters.minViews === DEFAULT_FILTERS.minViews &&
                          filters.minLikes === DEFAULT_FILTERS.minLikes &&
                          filters.dateFilter === DEFAULT_FILTERS.dateFilter;
        filterIndicator.classList.toggle('hidden', isDefault);
    };

    const handleApplyFilters = () => {
        filters.minViews = parseInt(document.getElementById('min-views-input').value) || 0;
        filters.minLikes = parseInt(document.getElementById('min-likes-input').value) || 0;
        filters.dateFilter = document.getElementById('date-uploaded-select').value;
        filterModal.classList.add('hidden');
        updateFilterIndicator();
        fetchPostsFromDB(1);
    };

    const handleResetFilters = () => {
        filters = { ...DEFAULT_FILTERS };
        updateFilterModalUI();
    };

    const handleShuffle = () => {
        if (allPosts.length > 1) {
            for (let i = allPosts.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allPosts[i], allPosts[j]] = [allPosts[j], allPosts[i]];
            }
            renderPosts(allPosts);
        }
    };

    const handleTranscribe = async (e) => {
        const transcribeBtn = e.target.closest('.transcribe-btn');
        if (!transcribeBtn) return;

        if (currentTranscribingBtn) return;

        currentTranscribingBtn = transcribeBtn;
        currentTranscribingBtn.disabled = true;
        currentTranscribingBtn.innerHTML = 'Transcribing...';

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
                const post = allPosts.find(p => p._id === postId);
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
                currentTranscribingBtn = null;
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
        postToProcess = allPosts.find(p => p._id === postId);
        
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

    const handleDeletePost = (button) => {
        const postId = button.dataset.postId;
        showConfirmModal('Delete Post?', 'This will permanently remove this post from your content pool. This action cannot be undone.', async () => {
            try {
                await apiCall(`/api/instagram-posts/${postId}`, { method: 'DELETE' });
                hideConfirmModal();
                showNotification('Post Deleted', 'The post has been successfully removed from your content pool.');
                fetchPostsFromDB(currentPage);
            } catch (error) {
                hideConfirmModal();
                showNotification('Error', `Failed to delete post: ${error.message}`, 'error');
            }
        });
    };

    // --- EVENT LISTENERS & INITIALIZATION ---
    const init = async () => {
        try {
            const defaults = await apiCall('/api/default-ig-hashtags');
            DEFAULT_HASHTAGS = defaults.hashtags || [];
            hashtagsToScrape = [...DEFAULT_HASHTAGS];
            
            renderHashtagsInModal();
        } catch (error) {
            errorContainer.textContent = `Error loading initial data: ${error.message}`;
            errorContainer.classList.remove('hidden');
        }

        fetchPostsFromDB();

        updatePoolBtn.addEventListener('click', async () => {
            try {
                const defaults = await apiCall('/api/default-ig-hashtags');
                hashtagsToScrape = defaults.hashtags || [];
                renderHashtagsInModal();
                updatePoolModal.classList.remove('hidden');
            } catch (error) {
                showNotification('Error', "Could not load default hashtags.", 'error');
            }
        });

        closeUpdateModalBtn.addEventListener('click', () => updatePoolModal.classList.add('hidden'));
        runScrapeJobBtn.addEventListener('click', handleRunScrapeJob);
        addHashtagInput.addEventListener('keydown', handleAddHashtagKeydown);
        addHashtagBtn.addEventListener('click', addHashtagFromInput);
        hashtagsContainerModal.addEventListener('click', handleRemoveHashtag);
        searchDepthInput.addEventListener('input', updateCostEstimation);
        paginationContainer.addEventListener('click', handlePaginationClick);
        notificationOkBtn.addEventListener('click', () => notificationModal.classList.add('hidden'));
        filterBtn.addEventListener('click', () => {
            updateFilterModalUI();
            filterModal.classList.remove('hidden');
        });
        closeFilterModalBtn.addEventListener('click', () => filterModal.classList.add('hidden'));
        applyFiltersBtn.addEventListener('click', handleApplyFilters);
        resetFiltersBtn.addEventListener('click', handleResetFilters);
        shuffleBtn.addEventListener('click', handleShuffle);
        container.addEventListener('click', (e) => {
            handleTranscribe(e);
            handleGenerateStory(e);
            if (e.target.closest('.delete-post-btn')) {
                handleDeletePost(e.target.closest('.delete-post-btn'));
            }
        });
        closeTranscriptionModalBtn.addEventListener('click', () => {
            transcriptionModal.classList.add('hidden');
            if (currentTranscribingBtn) {
                currentTranscribingBtn.disabled = false;
                currentTranscribingBtn.innerHTML = 'Transcript It';
                currentTranscribingBtn = null;
            }
        });
        
        closeFrameworkModalBtn.addEventListener('click', () => {
            frameworkSelectModal.classList.add('hidden');
        });
        
        confirmCancelBtn.addEventListener('click', hideConfirmModal);
        confirmActionBtn.addEventListener('click', () => {
            if (confirmCallback) {
                confirmCallback();
            }
            hideConfirmModal();
        });
        
        // Close modals when clicking outside
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                hideConfirmModal();
            }
        });
        
        filterModal.addEventListener('click', (e) => {
            if (e.target === filterModal) {
                filterModal.classList.add('hidden');
            }
        });
        
        updatePoolModal.addEventListener('click', (e) => {
            if (e.target === updatePoolModal) {
                updatePoolModal.classList.add('hidden');
            }
        });
    };
    
    init();
});
