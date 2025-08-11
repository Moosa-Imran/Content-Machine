// public/js/youtube-hashtags.js
// Handles interactions for the YouTube content pool page.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const loader = document.getElementById('loader');
    const container = document.getElementById('articles-container');
    const errorContainer = document.getElementById('error-container');
    const updatePoolBtn = document.getElementById('update-pool-btn');
    const updatePoolModal = document.getElementById('update-pool-modal');
    const closeUpdateModalBtn = document.getElementById('close-update-modal-btn');
    const runScrapeJobBtn = document.getElementById('run-scrape-job-btn');
    const makeDefaultKeywordsBtn = document.getElementById('make-default-keywords-btn');
    const keywordsContainerModal = document.getElementById('keywords-container-modal');
    const addKeywordInput = document.getElementById('add-keyword-input');
    const addKeywordBtn = document.getElementById('add-keyword-btn');
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
    let keywordsToScrape = [];
    let DEFAULT_KEYWORDS = [];
    let postToProcess = null;
    let currentTranscribingBtn = null;
    const DEFAULT_FILTERS = {
        minViews: 10000,
        minLikes: 0,
        minComments: 0,
        dateFilter: 'any',
        minDuration: 0,
        maxDuration: 0
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
            const response = await fetch(`/api/${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                },
                ...options,
            });

            if (!response.ok) {
                throw new Error(`API call failed with status ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    };

    const updateCostEstimation = () => {
        const numKeywords = keywordsToScrape.length;
        const depth = parseInt(searchDepthInput.value) || 0;
        const totalVideos = numKeywords * depth;
        // YouTube scraping cost estimation: $0.5 per 1000 videos
        const cost = (totalVideos / 1000) * 0.5;
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

    const formatDuration = (seconds) => {
        if (!seconds) return 'Unknown';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };
    
    const renderKeywordsInModal = () => {
        keywordsContainerModal.innerHTML = keywordsToScrape.map((keyword, index) => `
            <div class="keyword-bubble flex items-center gap-1.5 bg-primary-500 text-white text-sm font-medium px-3 py-1 rounded-full">
                <span>${keyword}</span>
                <button class="remove-keyword-btn" data-index="${index}" title="Remove ${keyword}">
                    <i data-lucide="x" class="w-4 h-4 hover:text-red-200"></i>
                </button>
            </div>
        `).join('');
        lucide.createIcons();
        updateCostEstimation();
    };

    const addKeywordFromInput = () => {
        const newKeyword = addKeywordInput.value.trim().replace(/,$/, '');
        if (newKeyword && !keywordsToScrape.includes(newKeyword)) {
            keywordsToScrape.push(newKeyword);
            renderKeywordsInModal();
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
            const index = parseInt(removeBtn.dataset.index);
            keywordsToScrape.splice(index, 1);
            renderKeywordsInModal();
        }
    };

    const fetchPostsFromDB = async (page = 1) => {
        loader.classList.remove('hidden');
        errorContainer.classList.add('hidden');
        container.innerHTML = '';

        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: postsPerPage.toString(),
                minViews: filters.minViews.toString(),
                minLikes: filters.minLikes.toString(),
                minComments: filters.minComments.toString(),
                dateFilter: filters.dateFilter,
                minDuration: filters.minDuration.toString(),
                maxDuration: filters.maxDuration.toString()
            });

            const data = await apiCall(`youtube-posts?${params}`);
            allPosts = data.posts;
            currentPage = data.currentPage;
            
            renderPosts(data.posts);
            renderPaginationControls(data.totalPages, currentPage);
        } catch (error) {
            console.error('Error fetching YouTube posts:', error);
            errorContainer.textContent = 'Failed to load YouTube posts from database.';
            errorContainer.classList.remove('hidden');
        } finally {
            loader.classList.add('hidden');
        }
    };

    const renderPosts = (posts) => {
        if (posts.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-slate-500 dark:text-slate-400">
                    <i data-lucide="video-off" class="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600"></i>
                    <p class="text-lg font-medium mb-2">No YouTube videos found</p>
                    <p>Try adjusting your filters or update the content pool.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        container.innerHTML = posts.map(post => {
            return `
                <article class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow duration-300" data-post-id="${post._id}">
                    <div class="p-6">
                        <!-- Header with channel info -->
                        <div class="flex items-center gap-3 mb-4">
                            ${post.channelThumbnail ? `
                                <img src="${post.channelThumbnail}" alt="${post.channelTitle}" class="w-10 h-10 rounded-full object-cover">
                            ` : `
                                <div class="w-10 h-10 bg-slate-300 dark:bg-slate-600 rounded-full flex items-center justify-center">
                                    <i data-lucide="user" class="w-5 h-5 text-slate-500 dark:text-slate-400"></i>
                                </div>
                            `}
                            <div class="flex-grow min-w-0">
                                <h3 class="font-semibold text-slate-900 dark:text-white truncate">${post.channelTitle || 'Unknown Channel'}</h3>
                                <p class="text-sm text-slate-500 dark:text-slate-400">${post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Unknown date'}</p>
                            </div>
                        </div>

                        <!-- Video thumbnail and content -->
                        <div class="grid md:grid-cols-3 gap-4">
                            <div class="md:col-span-1">
                                ${post.thumbnail ? `
                                    <img src="${post.thumbnail}" alt="${post.title}" class="w-full h-32 md:h-24 object-cover rounded-lg">
                                ` : `
                                    <div class="w-full h-32 md:h-24 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                                        <i data-lucide="video" class="w-8 h-8 text-slate-400"></i>
                                    </div>
                                `}
                            </div>
                            <div class="md:col-span-2">
                                <h4 class="font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">${post.title || 'Untitled Video'}</h4>
                                ${post.description ? `
                                    <p class="text-slate-600 dark:text-slate-300 text-sm mb-3 line-clamp-3">${post.description}</p>
                                ` : ''}
                                
                                <!-- Video stats -->
                                <div class="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    ${post.viewCount !== undefined ? `
                                        <span class="flex items-center gap-1">
                                            <i data-lucide="eye" class="w-4 h-4"></i>
                                            ${formatNumber(post.viewCount)} views
                                        </span>
                                    ` : ''}
                                    ${post.likeCount !== undefined ? `
                                        <span class="flex items-center gap-1">
                                            <i data-lucide="heart" class="w-4 h-4"></i>
                                            ${formatNumber(post.likeCount)} likes
                                        </span>
                                    ` : ''}
                                    ${post.commentCount !== undefined ? `
                                        <span class="flex items-center gap-1">
                                            <i data-lucide="message-circle" class="w-4 h-4"></i>
                                            ${formatNumber(post.commentCount)} comments
                                        </span>
                                    ` : ''}
                                    ${post.duration ? `
                                        <span class="flex items-center gap-1">
                                            <i data-lucide="clock" class="w-4 h-4"></i>
                                            ${formatDuration(post.duration)}
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- Action buttons -->
                        <div class="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                            <div class="flex gap-2">
                                ${post.url ? `
                                    <a href="${post.url}" target="_blank" class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors">
                                        <i data-lucide="external-link" class="w-4 h-4"></i>
                                        Watch
                                    </a>
                                ` : ''}
                                <button class="transcribe-btn flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors" data-url="${post.url}">
                                    <i data-lucide="file-text" class="w-4 h-4"></i>
                                    Transcribe
                                </button>
                            </div>
                            <div class="flex gap-2">
                                <button class="delete-post-btn flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2" data-post-id="${post._id}">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                    Delete
                                </button>
                            </div>
                        </div>

                        <!-- Transcript container (initially hidden) -->
                        <div class="transcript-container"></div>
                        
                        <!-- Save container (initially empty) -->
                        <div class="save-container"></div>
                    </div>
                </article>
            `;
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
            const items = [];
            const startPage = Math.max(1, currentPage - contextRange);
            const endPage = Math.min(totalPages, currentPage + contextRange);

            if (startPage > 1) {
                items.push(1);
                if (startPage > 2) items.push('...');
            }

            for (let i = startPage; i <= endPage; i++) {
                items.push(i);
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) items.push('...');
                items.push(totalPages);
            }

            return items;
        };

        getPaginationItems(currentPage, totalPages).forEach(item => {
            if (item === '...') {
                paginationHTML += `<span class="px-3 py-2 text-slate-500 dark:text-slate-400">...</span>`;
            } else {
                const isActive = item === currentPage;
                paginationHTML += `<button data-page="${item}" class="page-btn px-3 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-primary-600 text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}">${item}</button>`;
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
            if (page && page !== currentPage) {
                fetchPostsFromDB(page);
            }
        }
    };

    const handleRunScrapeJob = async () => {
        runScrapeJobBtn.disabled = true;
        runScrapeJobBtn.innerHTML = '<span style="display: flex; align-items: center; gap: 0.5em;"><i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i>Updating...</span>';
        lucide.createIcons();
        
        let patienceMsg = document.getElementById('patience-message');
        if (!patienceMsg) {
            patienceMsg = document.createElement('p');
            patienceMsg.id = 'patience-message';
            patienceMsg.className = 'text-sm text-blue-600 dark:text-blue-400 mt-2 text-center';
            runScrapeJobBtn.parentNode.appendChild(patienceMsg);
        }
        patienceMsg.textContent = 'Updating the YouTube content pool can take a few minutes. Please be patient.';

        try {
            const response = await apiCall('run-youtube-keyword-scrape-job', {
                method: 'POST',
                body: JSON.stringify({
                    keywords: keywordsToScrape,
                    resultsLimit: parseInt(searchDepthInput.value) || 20
                })
            });

            showNotification('Success', response.message);
            updatePoolModal.classList.add('hidden');
            fetchPostsFromDB(1);
        } catch (error) {
            console.error('Scrape job error:', error);
            showNotification('Error', 'Failed to update the YouTube content pool. Please try again.', 'error');
        } finally {
            runScrapeJobBtn.disabled = false;
            runScrapeJobBtn.innerHTML = 'Start Scraping';
            if (patienceMsg) patienceMsg.remove();
        }
    };

    const updateFilterModalUI = () => {
        document.getElementById('min-views-input').value = filters.minViews;
        document.getElementById('min-likes-input').value = filters.minLikes;
        document.getElementById('min-comments-input').value = filters.minComments;
        document.getElementById('date-uploaded-select').value = filters.dateFilter;
        document.getElementById('min-duration-input').value = filters.minDuration;
        document.getElementById('max-duration-input').value = filters.maxDuration;
    };

    const updateFilterIndicator = () => {
        const isDefault = filters.minViews === DEFAULT_FILTERS.minViews &&
                          filters.minLikes === DEFAULT_FILTERS.minLikes &&
                          filters.minComments === DEFAULT_FILTERS.minComments &&
                          filters.dateFilter === DEFAULT_FILTERS.dateFilter &&
                          filters.minDuration === DEFAULT_FILTERS.minDuration &&
                          filters.maxDuration === DEFAULT_FILTERS.maxDuration;
        filterIndicator.classList.toggle('hidden', isDefault);
    };

    const handleApplyFilters = () => {
        filters.minViews = parseInt(document.getElementById('min-views-input').value) || 0;
        filters.minLikes = parseInt(document.getElementById('min-likes-input').value) || 0;
        filters.minComments = parseInt(document.getElementById('min-comments-input').value) || 0;
        filters.dateFilter = document.getElementById('date-uploaded-select').value;
        filters.minDuration = parseInt(document.getElementById('min-duration-input').value) || 0;
        filters.maxDuration = parseInt(document.getElementById('max-duration-input').value) || 0;
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

    const handleMakeDefaultKeywords = async () => {
        const keywords = Array.from(keywordsContainerModal.children).map(tag => {
            return tag.querySelector('span').textContent;
        });

        if (keywords.length === 0) {
            showNotification('Error', 'Please add at least one keyword before making them default.', 'error');
            return;
        }

        try {
            const response = await apiCall('save-default-youtube-keywords', {
                method: 'POST',
                body: JSON.stringify({ keywords })
            });

            showNotification('Success', 'Default YouTube keywords saved successfully!');
            DEFAULT_KEYWORDS = [...keywords];
        } catch (error) {
            console.error('Error saving default keywords:', error);
            showNotification('Error', 'Failed to save default keywords. Please try again.', 'error');
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
        const postContainer = transcribeBtn.closest('article');
        const transcriptContainer = postContainer.querySelector('.transcript-container');
        const saveContainer = postContainer.querySelector('.save-container');
        
        const transcribe = async () => {
            transcriptionLoading.classList.remove('hidden');
            transcriptionError.classList.add('hidden');
            transcriptionModal.classList.remove('hidden');

            try {
                const response = await apiCall('transcribe-youtube-video', {
                    method: 'POST',
                    body: JSON.stringify({ url })
                });

                // Store transcript in the post data
                const postId = postContainer.dataset.postId || transcribeBtn.closest('[data-post-id]')?.dataset.postId;
                const post = allPosts.find(p => p._id === postId);
                if (post) {
                    post.transcript = response.transcript;
                }

                // Show transcript
                transcriptContainer.innerHTML = `
                    <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Transcript:</h5>
                        <p class="text-sm text-slate-600 dark:text-slate-300 p-3 bg-slate-50 dark:bg-slate-800 rounded-md">${response.transcript || 'No transcript available.'}</p>
                    </div>
                `;
                
                // Show save button
                saveContainer.innerHTML = `
                    <div class="mt-4">
                        <button class="save-post-btn flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors" data-post-id="${postId}">
                            <i data-lucide="bookmark-plus" class="w-4 h-4"></i>
                            Save It
                        </button>
                    </div>
                `;
                
                // Hide transcribe button
                transcribeBtn.style.display = 'none';
                transcriptionModal.classList.add('hidden');
                lucide.createIcons();
            } catch (error) {
                console.error('Transcription error:', error);
                transcriptionLoading.classList.add('hidden');
                transcriptionError.classList.remove('hidden');
            } finally {
                currentTranscribingBtn.disabled = false;
                currentTranscribingBtn.innerHTML = '<i data-lucide="file-text" class="w-4 h-4"></i> Transcribe';
                lucide.createIcons();
                currentTranscribingBtn = null;
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
            showNotification('Error', 'Post not found.', 'error');
            return;
        }

        button.disabled = true;
        button.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin mr-2"></i>Saving...';
        lucide.createIcons();

        try {
            const response = await apiCall('save-youtube-post-pool', {
                method: 'POST',
                body: JSON.stringify({ post })
            });

            showNotification('Success', response.message);
            // Remove the post from current view
            const postElement = button.closest('[data-post-id]');
            if (postElement) {
                postElement.remove();
            }
            // Remove from allPosts array
            const postIndex = allPosts.findIndex(p => p._id === postId);
            if (postIndex > -1) {
                allPosts.splice(postIndex, 1);
            }
        } catch (error) {
            console.error('Error saving post:', error);
            showNotification('Error', 'Failed to save the post. Please try again.', 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = '<i data-lucide="bookmark-plus" class="w-4 h-4 mr-2"></i>Save';
            lucide.createIcons();
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
            await apiCall(`youtube-posts/${postId}`, { method: 'DELETE' });
            
            setTimeout(() => {
                postCard.remove();
                const postIndex = allPosts.findIndex(p => p._id === postId);
                if (postIndex > -1) {
                    allPosts.splice(postIndex, 1);
                }
            }, 500);
        } catch (error) {
            console.error('Error deleting post:', error);
            postCard.style.opacity = '1';
            postCard.style.transform = 'scale(1)';
            showNotification('Error', 'Failed to delete the post. Please try again.', 'error');
        }
    };

    // --- EVENT LISTENERS & INITIALIZATION ---
    const init = async () => {
        try {
            const response = await apiCall('default-youtube-hashtags');
            DEFAULT_KEYWORDS = response.keywords || [];
            keywordsToScrape = [...DEFAULT_KEYWORDS];
            renderKeywordsInModal();
        } catch (error) {
            console.error('Error fetching default keywords:', error);
        }

        fetchPostsFromDB();

        updatePoolBtn.addEventListener('click', async () => {
            keywordsToScrape = [...DEFAULT_KEYWORDS];
            renderKeywordsInModal();
            updatePoolModal.classList.remove('hidden');
        });

        closeUpdateModalBtn.addEventListener('click', () => updatePoolModal.classList.add('hidden'));
        runScrapeJobBtn.addEventListener('click', handleRunScrapeJob);
        makeDefaultKeywordsBtn.addEventListener('click', handleMakeDefaultKeywords);
        addKeywordInput.addEventListener('keydown', handleAddKeywordKeydown);
        addKeywordBtn.addEventListener('click', addKeywordFromInput);
        keywordsContainerModal.addEventListener('click', handleRemoveKeyword);
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
            const saveBtn = e.target.closest('.save-post-btn');
            const deleteBtn = e.target.closest('.delete-post-btn');
            const transcribeBtn = e.target.closest('.transcribe-btn');
            
            if (saveBtn) {
                handleSavePost(saveBtn);
            } else if (deleteBtn) {
                showConfirmModal(
                    'Delete Post',
                    'Are you sure you want to delete this post from the content pool?',
                    () => {
                        handleDeletePost(deleteBtn);
                        hideConfirmModal();
                    }
                );
            } else if (transcribeBtn) {
                handleTranscribe(e);
            }
        });
        closeTranscriptionModalBtn.addEventListener('click', () => {
            transcriptionModal.classList.add('hidden');
        });
        
        confirmCancelBtn.addEventListener('click', hideConfirmModal);
        confirmActionBtn.addEventListener('click', () => {
            if (confirmCallback) {
                confirmCallback();
            }
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
