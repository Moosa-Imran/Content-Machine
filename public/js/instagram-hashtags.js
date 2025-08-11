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
    const makeDefaultHashtagsBtn = document.getElementById('make-default-hashtags-btn');

    // --- STATE MANAGEMENT ---
    let allPosts = [];
    let currentPage = 1;
    const postsPerPage = 10;
    let hashtagsToScrape = [];
    let DEFAULT_HASHTAGS = [];
    let postToProcess = null;
    let currentTranscribingBtn = null;
    const DEFAULT_FILTERS = {
        minViews: 10000,
        minLikes: 0,
        minComments: 0,
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
            iconContainer.className = 'mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-500/20';
            iconContainer.innerHTML = '<i data-lucide="alert-triangle" class="h-8 w-8 text-red-600 dark:text-red-400"></i>';
        } else if (type === 'warning') {
            iconContainer.className = 'mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-500/20';
            iconContainer.innerHTML = '<i data-lucide="alert-circle" class="h-8 w-8 text-amber-600 dark:text-amber-400"></i>';
        } else {
            iconContainer.className = 'mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-500/20';
            iconContainer.innerHTML = '<i data-lucide="check-circle" class="h-8 w-8 text-green-600 dark:text-green-400"></i>';
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
            <div class="group flex items-center gap-2 bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200/50 dark:border-pink-700/30 text-slate-800 dark:text-slate-200 text-sm font-medium px-3 py-2 rounded-xl backdrop-blur-sm transition-all hover:from-pink-500/20 hover:to-purple-500/20">
                <span class="font-semibold">#${hashtag}</span>
                <button class="remove-hashtag-btn opacity-70 hover:opacity-100 hover:text-red-500 transition-all" data-index="${index}" title="Remove ${hashtag}">
                    <i data-lucide="x" class="w-4 h-4 hover:scale-110 transition-transform"></i>
                </button>
            </div>
        `).join('') || '<div class="text-slate-500 dark:text-slate-400 text-sm italic py-2">No hashtags added yet</div>';
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
                minComments: filters.minComments,
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
            container.innerHTML = `
                <div class="text-center py-16">
                    <div class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm rounded-3xl p-8 border border-slate-200/50 dark:border-slate-700/50">
                        <div class="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i data-lucide="search" class="w-8 h-8 text-slate-400 dark:text-slate-500"></i>
                        </div>
                        <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No content found</h3>
                        <p class="text-slate-500 dark:text-slate-400">Your content pool is empty or no posts match your current filters.</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = posts.map(post => {
            const captionWithoutHashtags = (post.caption || '').replace(/#\w+/g, '').trim();
            const viewsHTML = post.videoPlayCount ? 
                `<div class="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                    <i data-lucide="play-circle" class="w-4 h-4"></i> 
                    <span class="font-semibold">${post.videoPlayCount.toLocaleString()}</span>
                </div>` : '';
            
            const transcriptBtnHTML = post.type === 'Video' ? 
                `<button class="transcribe-btn group flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl transition-all transform hover:scale-105 shadow-lg" data-url="${post.url}">
                    <i data-lucide="mic" class="w-4 h-4 group-hover:scale-110 transition-transform"></i>
                    Transcribe
                </button>` : '';

            return `
            <div class="group bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-slate-800/50 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] transform" data-post-id="${post._id}">
                <div class="flex gap-6">
                    <!-- Post Image -->
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
                                    <div class="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                                        <i data-lucide="instagram" class="w-4 h-4 text-white"></i>
                                    </div>
                                    <div>
                                        <p class="font-bold text-slate-800 dark:text-white">${post.ownerUsername}</p>
                                        <p class="text-xs text-slate-500 dark:text-slate-400">${new Date(post.timestamp).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <button class="add-competitor-btn group flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100/80 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-800/50 rounded-xl transition-all transform hover:scale-105" data-username="${post.ownerUsername}">
                                    <i data-lucide="user-plus" class="w-3 h-3 group-hover:rotate-12 transition-transform"></i>
                                    Add Competitor
                                </button>
                            </div>
                            
                            <!-- Delete Button -->
                            <button class="delete-post-btn group p-2 rounded-xl hover:bg-red-500/10 text-red-500 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100" data-post-id="${post._id}">
                                <i data-lucide="trash-2" class="w-4 h-4 group-hover:scale-110 transition-transform"></i>
                            </button>
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
                            <div class="save-container"></div>
                        </div>
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

        let paginationHTML = `
            <div class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl p-4 border border-white/20 dark:border-slate-800/50 shadow-lg">
                <div class="flex items-center justify-center gap-2">
        `;
        
        // Previous button
        paginationHTML += `
            <button data-page="${currentPage - 1}" 
                    class="page-btn group p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${currentPage === 1 ? 'disabled' : ''}" 
                    ${currentPage === 1 ? 'disabled' : ''}>
                <i data-lucide="chevron-left" class="w-5 h-5 group-hover:-translate-x-0.5 transition-transform"></i>
            </button>
        `;

        const getPaginationItems = (currentPage, totalPages, contextRange = 2) => {
            const pages = [];
            if (totalPages <= 1) return [];
            
            // Always show first page
            pages.push(1);
            
            // Add ellipsis if needed
            if (currentPage > contextRange + 2) pages.push('...');
            
            // Add pages around current page
            const startPage = Math.max(2, currentPage - contextRange);
            const endPage = Math.min(totalPages - 1, currentPage + contextRange);
            
            for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
            }
            
            // Add ellipsis if needed
            if (currentPage < totalPages - contextRange - 1) pages.push('...');
            
            // Always show last page if not already included
            if (totalPages > 1) pages.push(totalPages);
            
            return [...new Set(pages)];
        };

        getPaginationItems(currentPage, totalPages).forEach(item => {
            if (item === '...') {
                paginationHTML += `<span class="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">⋯</span>`;
            } else {
                const isActive = item === currentPage;
                paginationHTML += `
                    <button data-page="${item}" 
                            class="page-btn px-4 py-2.5 text-sm font-semibold rounded-xl transition-all transform hover:scale-105 ${
                                isActive 
                                    ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg' 
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }">
                        ${item}
                    </button>
                `;
            }
        });
        
        // Next button
        paginationHTML += `
            <button data-page="${currentPage + 1}" 
                    class="page-btn group p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${currentPage === totalPages ? 'disabled' : ''}" 
                    ${currentPage === totalPages ? 'disabled' : ''}>
                <i data-lucide="chevron-right" class="w-5 h-5 group-hover:translate-x-0.5 transition-transform"></i>
            </button>
        `;
        
        paginationHTML += '</div></div>';
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
        // Show patience message next to the button
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
        patienceMsg.textContent = 'Updating the content pool can take a few minutes. Please be patient.';

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
            runScrapeJobBtn.innerHTML = '<span style="display: flex; align-items: center; gap: 0.5em;"><i data-lucide="refresh-cw" class="w-4 h-4"></i>Start Scraping</span>';
            lucide.createIcons();
            // Remove patience message after update
            if (patienceMsg) {
                setTimeout(() => { patienceMsg.remove(); }, 2000);
            }
            updatePoolModal.classList.add('hidden');
        }
    };

    const updateFilterModalUI = () => {
        document.getElementById('min-views-input').value = filters.minViews;
        document.getElementById('min-likes-input').value = filters.minLikes;
        document.getElementById('min-comments-input').value = filters.minComments;
        document.getElementById('date-uploaded-select').value = filters.dateFilter;
    };

    const updateFilterIndicator = () => {
        const isDefault = filters.minViews === DEFAULT_FILTERS.minViews &&
                          filters.minLikes === DEFAULT_FILTERS.minLikes &&
                          filters.minComments === DEFAULT_FILTERS.minComments &&
                          filters.dateFilter === DEFAULT_FILTERS.dateFilter;
        filterIndicator.classList.toggle('hidden', isDefault);
    };

    const handleApplyFilters = () => {
        filters.minViews = parseInt(document.getElementById('min-views-input').value) || 0;
        filters.minLikes = parseInt(document.getElementById('min-likes-input').value) || 0;
        filters.minComments = parseInt(document.getElementById('min-comments-input').value) || 0;
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

    const handleMakeDefaultHashtags = async () => {
        if (hashtagsToScrape.length === 0) {
            showNotification('Warning', 'Please add some hashtags before saving as default.', 'error');
            return;
        }

        try {
            // Store original button state
            const originalText = makeDefaultHashtagsBtn.innerHTML;
            makeDefaultHashtagsBtn.disabled = true;
            makeDefaultHashtagsBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i><span>Saving...</span>';
            lucide.createIcons();

            await apiCall('/api/save-default-ig-hashtags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hashtags: hashtagsToScrape })
            });

            showNotification('Success', 'Default hashtags saved successfully!');

        } catch (error) {
            console.error('Error saving default hashtags:', error);
            showNotification('Error', error.message || 'Failed to save default hashtags.', 'error');
        } finally {
            // Restore button state
            makeDefaultHashtagsBtn.disabled = false;
            makeDefaultHashtagsBtn.innerHTML = '<i data-lucide="bookmark" class="w-4 h-4"></i><span>Make Default</span>';
            lucide.createIcons();
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
                    <div class="bg-gradient-to-r from-blue-50/80 to-purple-50/80 dark:from-blue-950/20 dark:to-purple-950/20 backdrop-blur-sm rounded-2xl p-4 border border-blue-200/50 dark:border-blue-800/30">
                        <div class="flex items-center gap-2 mb-3">
                            <div class="bg-blue-500/20 p-1.5 rounded-lg">
                                <i data-lucide="file-text" class="w-4 h-4 text-blue-600 dark:text-blue-400"></i>
                            </div>
                            <h4 class="text-sm font-bold text-blue-800 dark:text-blue-300">Video Transcript</h4>
                        </div>
                        <p class="text-sm text-blue-700 dark:text-blue-300 leading-relaxed bg-white/50 dark:bg-slate-900/30 rounded-xl p-3 border border-blue-200/30 dark:border-blue-700/30">${result.transcript}</p>
                    </div>
                `;
                const saveContainer = postContainer.querySelector('.save-container');
                saveContainer.innerHTML = `
                    <button class="save-post-btn group flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105" data-post-id="${postContainer.dataset.postId}">
                        <i data-lucide="bookmark" class="w-4 h-4 group-hover:scale-110 transition-transform"></i>
                        Save to Collection
                    </button>
                `;
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
            const result = await apiCall('/api/save-instagram-post', {
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
            await apiCall(`/api/instagram-posts/${postId}`, { method: 'DELETE' });
            
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
        makeDefaultHashtagsBtn.addEventListener('click', handleMakeDefaultHashtags);
        container.addEventListener('click', (e) => {
            handleTranscribe(e);
            if (e.target.closest('.save-post-btn')) {
                handleSavePost(e.target.closest('.save-post-btn'));
            }
            if (e.target.closest('.delete-post-btn')) {
                handleDeletePost(e.target.closest('.delete-post-btn'));
            }
            if (e.target.closest('.add-competitor-btn')) {
                handleAddCompetitor(e.target.closest('.add-competitor-btn'));
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
