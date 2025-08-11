// public/js/tiktok-hashtags.js
// Handles interactions for the TikTok content pool page.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const loader = document.getElementById('loader');
    const container = document.getElementById('articles-container');
    const errorContainer = document.getElementById('error-container');
    const updatePoolBtn = document.getElementById('update-pool-btn');
    const updatePoolModal = document.getElementById('update-pool-modal');
    const closeUpdateModalBtn = document.getElementById('close-update-modal-btn');
    const runScrapeJobBtn = document.getElementById('run-scrape-job-btn');
    const makeDefaultHashtagsBtn = document.getElementById('make-default-hashtags-btn');
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
        minPlays: 10000,
        minLikes: 0,
        minComments: 0,
        minShares: 0,
        dateFilter: 'any',
        minDuration: 0
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
        // TikTok scraping cost estimation: $5 per 1000 posts
        const cost = (totalPosts / 1000) * 5;
        costEstimationText.textContent = `$${cost.toFixed(4)}`;
    };

    const formatNumber = (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
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
                minPlays: filters.minPlays,
                minLikes: filters.minLikes,
                minComments: filters.minComments,
                minShares: filters.minShares,
                dateFilter: filters.dateFilter,
                minDuration: filters.minDuration
            });
            const data = await apiCall(`/api/tiktok-posts?${queryParams.toString()}`);
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
            container.innerHTML = `<div class="text-center text-slate-500 p-8 bg-white dark:bg-slate-900/50 rounded-xl">Your TikTok content pool is empty or no posts match your filters.</div>`;
            return;
        }

        container.innerHTML = posts.map(post => {
            const textWithoutHashtags = (post.text || '').replace(/#\w+/g, '').trim();
            const duration = post.videoMeta?.duration ? `${post.videoMeta.duration}s` : 'N/A';
            const transcriptBtnHTML = `<div class="mt-4"><button class="transcribe-btn text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold" data-url="${post.webVideoUrl}">Transcript It</button></div>`;
            
            return `
            <div class="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800" data-post-id="${post._id}">
                <div class="flex items-start gap-4">
                    <img src="/api/image-proxy?url=${encodeURIComponent(post.videoMeta?.coverUrl || post.authorMeta?.avatar)}" alt="Post by ${post.authorMeta?.nickName}" class="w-24 h-24 object-cover rounded-md" onerror="this.onerror=null;this.src='https://placehold.co/96x96/e2e8f0/475569?text=TikTok';">
                    <div class="flex-grow">
                        <div class="flex justify-between items-start">
                            <div>
                                <div class="flex items-center gap-2">
                                    <p class="font-bold text-slate-800 dark:text-white">${post.authorMeta?.nickName || post.authorMeta?.name || 'Unknown'}</p>
                                    ${post.authorMeta?.verified ? '<i data-lucide="badge-check" class="w-4 h-4 text-blue-500" title="Verified"></i>' : ''}
                                </div>
                                <p class="text-xs text-slate-400">${new Date(post.createTimeISO).toLocaleString()}</p>
                                <p class="text-xs text-slate-500">Duration: ${duration}</p>
                            </div>
                            <div class="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                <span class="flex items-center gap-1"><i data-lucide="play-circle" class="w-4 h-4"></i> ${formatNumber(post.playCount || 0)}</span>
                                <span class="flex items-center gap-1"><i data-lucide="heart" class="w-4 h-4"></i> ${formatNumber(post.diggCount || 0)}</span>
                                <span class="flex items-center gap-1"><i data-lucide="message-circle" class="w-4 h-4"></i> ${formatNumber(post.commentCount || 0)}</span>
                                <span class="flex items-center gap-1"><i data-lucide="share" class="w-4 h-4"></i> ${formatNumber(post.shareCount || 0)}</span>
                                <button class="delete-post-btn p-1.5 rounded-full hover:bg-red-500/10 text-red-500" data-post-id="${post._id}" title="Delete Post">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                        <p class="text-sm text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-wrap">${textWithoutHashtags}</p>
                        <div class="transcript-container"></div>
                        <div class="mt-2 flex flex-wrap gap-1">
                            ${(post.hashtags || []).map(tag => `<span class="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-full">#${tag.name || tag}</span>`).join('')}
                        </div>
                        <a href="${post.webVideoUrl}" target="_blank" class="text-primary-600 dark:text-primary-400 text-xs font-semibold mt-2 inline-block">View on TikTok</a>
                        ${transcriptBtnHTML}
                        <div class="save-container"></div>
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
        runScrapeJobBtn.innerHTML = '<span style="display: flex; align-items: center; gap: 0.5em;"><i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i>Updating...</span>';
        lucide.createIcons();
        
        let patienceMsg = document.getElementById('patience-message');
        if (!patienceMsg) {
            patienceMsg = document.createElement('div');
            patienceMsg.id = 'patience-message';
            patienceMsg.style.marginLeft = '1rem';
            patienceMsg.style.display = 'inline-block';
            patienceMsg.style.verticalAlign = 'middle';
            patienceMsg.style.color = '#fbbf24'; // amber-400
            patienceMsg.style.fontWeight = '500';
            patienceMsg.style.fontSize = '0.95em';
            runScrapeJobBtn.parentNode.insertBefore(patienceMsg, runScrapeJobBtn.nextSibling);
        }
        patienceMsg.textContent = 'Updating the TikTok content pool can take a few minutes. Please be patient.';

        try {
            const resultsLimit = parseInt(searchDepthInput.value) || 10;
            const result = await apiCall('/api/run-tiktok-hashtag-scrape-job', {
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
            runScrapeJobBtn.innerHTML = '<span style="display: flex; align-items: center; gap: 0.5em;"><i data-lucide="refresh-cw" class="w-4 h-4"></i>Start Scraping</span>';
            lucide.createIcons();
            if (patienceMsg) {
                setTimeout(() => { patienceMsg.remove(); }, 2000);
            }
            updatePoolModal.classList.add('hidden');
        }
    };

    const updateFilterModalUI = () => {
        document.getElementById('min-plays-input').value = filters.minPlays;
        document.getElementById('min-likes-input').value = filters.minLikes;
        document.getElementById('min-comments-input').value = filters.minComments;
        document.getElementById('min-shares-input').value = filters.minShares;
        document.getElementById('date-uploaded-select').value = filters.dateFilter;
        document.getElementById('min-duration-input').value = filters.minDuration;
    };

    const updateFilterIndicator = () => {
        const isDefault = filters.minPlays === DEFAULT_FILTERS.minPlays &&
                          filters.minLikes === DEFAULT_FILTERS.minLikes &&
                          filters.minComments === DEFAULT_FILTERS.minComments &&
                          filters.minShares === DEFAULT_FILTERS.minShares &&
                          filters.dateFilter === DEFAULT_FILTERS.dateFilter &&
                          filters.minDuration === DEFAULT_FILTERS.minDuration;
        filterIndicator.classList.toggle('hidden', isDefault);
    };

    const handleApplyFilters = () => {
        filters.minPlays = parseInt(document.getElementById('min-plays-input').value) || 0;
        filters.minLikes = parseInt(document.getElementById('min-likes-input').value) || 0;
        filters.minComments = parseInt(document.getElementById('min-comments-input').value) || 0;
        filters.minShares = parseInt(document.getElementById('min-shares-input').value) || 0;
        filters.dateFilter = document.getElementById('date-uploaded-select').value;
        filters.minDuration = parseInt(document.getElementById('min-duration-input').value) || 0;
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

    const handleMakeDefaultHashtags = async () => {
        const hashtags = Array.from(hashtagsContainerModal.children).map(tag => {
            const text = tag.textContent.trim();
            return text.replace('×', '').trim();
        });

        if (hashtags.length === 0) {
            showNotification('Error', 'Please add at least one hashtag before making it default.', 'error');
            return;
        }

        try {
            const response = await apiCall('/api/save-default-tiktok-hashtags', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ hashtags })
            });

            if (response.success) {
                showNotification('Success', `Successfully saved ${hashtags.length} hashtag(s) as default.`, 'success');
            } else {
                throw new Error(response.error || 'Failed to save default hashtags');
            }
        } catch (error) {
            console.error('Error saving default hashtags:', error);
            showNotification('Error', 'Failed to save default hashtags. Please try again.', 'error');
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
                const result = await apiCall('/api/transcribe-tiktok-video', {
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
                const saveContainer = postContainer.querySelector('.save-container');
                saveContainer.innerHTML = `<div class="mt-4"><button class="save-post-btn text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold" data-post-id="${postContainer.dataset.postId}">Save It</button></div>`;
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

    const handleSavePost = async (button) => {
        const postId = button.dataset.postId;
        const post = allPosts.find(p => p._id === postId);

        if (!post) {
            showNotification('Error', 'Could not find the post to save.', 'error');
            return;
        }

        button.disabled = true;
        button.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin mr-2"></i>Saving...';
        lucide.createIcons();

        try {
            const result = await apiCall('/api/save-tiktok-post-pool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post })
            });
            
            button.innerHTML = '<i data-lucide="check" class="w-4 h-4 mr-2"></i>Saved';
            button.classList.remove('bg-green-600', 'hover:bg-green-700');
            button.classList.add('bg-slate-400', 'cursor-not-allowed');
            lucide.createIcons();

        } catch (error) {
            showNotification('Error', `Failed to save post: ${error.message}`, 'error');
            button.disabled = false;
            button.innerHTML = 'Save It';
        }
    };

    const handleDeletePost = async (button) => {
        const postId = button.dataset.postId;
        const postCard = button.closest('[data-post-id]');

        if (!postCard) return;

        postCard.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        postCard.style.opacity = '0';
        postCard.style.transform = 'scale(0.95)';

        try {
            await apiCall(`/api/tiktok-posts/${postId}`, { method: 'DELETE' });
            
            setTimeout(() => {
                allPosts = allPosts.filter(p => p._id !== postId);
                renderPosts(allPosts);
                if (container.children.length === 0) {
                    fetchPostsFromDB(Math.max(1, currentPage - 1));
                }
            }, 500);

        } catch (error) {
            showNotification('Error', `Failed to delete post: ${error.message}`, 'error');
            postCard.style.opacity = '1';
            postCard.style.transform = 'scale(1)';
        }
    };

    // --- EVENT LISTENERS & INITIALIZATION ---
    const init = async () => {
        try {
            const defaults = await apiCall('/api/default-tiktok-hashtags');
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
                const defaults = await apiCall('/api/default-tiktok-hashtags');
                hashtagsToScrape = defaults.hashtags || [];
                renderHashtagsInModal();
                updatePoolModal.classList.remove('hidden');
            } catch (error) {
                showNotification('Error', "Could not load default hashtags.", 'error');
            }
        });

        closeUpdateModalBtn.addEventListener('click', () => updatePoolModal.classList.add('hidden'));
        runScrapeJobBtn.addEventListener('click', handleRunScrapeJob);
        makeDefaultHashtagsBtn.addEventListener('click', handleMakeDefaultHashtags);
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
            if (e.target.closest('.save-post-btn')) {
                handleSavePost(e.target.closest('.save-post-btn'));
            }
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
