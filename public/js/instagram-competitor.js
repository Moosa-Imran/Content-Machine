// public/js/instagram-competitor.js
// Handles all client-side interactions for the instagram-competitor.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const loader = document.getElementById('loader');
    const container = document.getElementById('articles-container');
    const errorContainer = document.getElementById('error-container');
    const updatePoolBtn = document.getElementById('update-pool-btn');
    const updatePoolModal = document.getElementById('update-pool-modal');
    const closeUpdateModalBtn = document.getElementById('close-update-modal-btn');
    const runScrapeJobBtn = document.getElementById('run-scrape-job-btn');
    const competitorsContainerModal = document.getElementById('competitors-container-modal');
    const addCompetitorInput = document.getElementById('add-competitor-input');
    const addCompetitorBtn = document.getElementById('add-competitor-btn');
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

    // --- STATE MANAGEMENT ---
    let allPosts = [];
    let currentPage = 1;
    const postsPerPage = 10;
    let competitorsToScrape = [];
    let DEFAULT_COMPETITORS = [];
    let postToProcess = null;
    let confirmCallback = null;
    const DEFAULT_FILTERS = {
        minViews: 10000,
        minLikes: 0,
        minComments: 0,
        dateFilter: 'any'
    };
    let filters = { ...DEFAULT_FILTERS };

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
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || 'An unknown error occurred.');
            }
            return await response.json();
        } catch (error) {
            console.error(`API call to ${endpoint} failed:`, error);
            throw error;
        }
    };
    
    const updateCostEstimation = () => {
        const numCompetitors = competitorsToScrape.length;
        const depth = parseInt(searchDepthInput.value) || 0;
        const totalPosts = numCompetitors * depth;
        const cost = (totalPosts / 1000) * 2.30;
        costEstimationText.textContent = `$${cost.toFixed(4)}`;
    };

    const renderCompetitorsInModal = () => {
        competitorsContainerModal.innerHTML = competitorsToScrape.map((username, index) => `
            <div class="keyword-bubble flex items-center gap-1.5 bg-primary-500 text-white text-sm font-medium px-3 py-1 rounded-full">
                <span>${username}</span>
                <button class="remove-competitor-btn" data-index="${index}" title="Remove ${username}">
                    <i data-lucide="x" class="w-4 h-4 hover:text-red-200"></i>
                </button>
            </div>
        `).join('');
        lucide.createIcons();
        updateCostEstimation();
    };

    const addCompetitorFromInput = () => {
        const newCompetitor = addCompetitorInput.value.trim().replace(/,$/, '');
        if (newCompetitor && !competitorsToScrape.includes(newCompetitor)) {
            competitorsToScrape.push(newCompetitor);
            renderCompetitorsInModal();
        }
        addCompetitorInput.value = '';
        addCompetitorInput.focus();
    };

    const handleAddCompetitorKeydown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addCompetitorFromInput();
        }
    };

    const handleRemoveCompetitor = (e) => {
        const removeBtn = e.target.closest('.remove-competitor-btn');
        if (removeBtn) {
            const indexToRemove = parseInt(removeBtn.dataset.index);
            competitorsToScrape.splice(indexToRemove, 1);
            renderCompetitorsInModal();
        }
    };

    const fetchPostsFromDB = async (page = 1) => {
        loader.classList.remove('hidden');
        errorContainer.classList.add('hidden');
        container.innerHTML = '';
        try {
            const params = new URLSearchParams({
                page,
                limit: postsPerPage,
                minViews: filters.minViews,
                minLikes: filters.minLikes,
                minComments: filters.minComments,
                dateFilter: filters.dateFilter
            });
            const data = await apiCall(`/api/competitor-posts?${params.toString()}`);
            allPosts = data.posts || [];
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
            container.innerHTML = `<div class="text-center text-slate-500 p-8 bg-white dark:bg-slate-900/50 rounded-xl">No competitor posts found matching your filters.</div>`;
            return;
        }
        container.innerHTML = posts.map(post => {
            const captionWithoutHashtags = (post.caption || '').replace(/#\w+/g, '').trim();
            const viewsHTML = post.videoPlayCount ? `<span class="flex items-center gap-1"><i data-lucide=\"play-circle\" class=\"w-4 h-4\"></i> ${post.videoPlayCount}</span>` : '';
            const transcriptBtnHTML = post.type === 'Video' ? `<div class="mt-4"><button class="transcribe-btn text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold" data-url="${post.url}">Transcript It</button></div>` : '';
            return `
            <div class="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 group relative" data-post-id="${post._id}">
                <button class="delete-btn p-1.5 rounded-full hover:bg-red-500/10 text-red-500 absolute top-4 right-4 z-10" data-post-id="${post._id}" title="Delete Post">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
                <div class="flex items-start gap-4">
                    <img src="/api/image-proxy?url=${encodeURIComponent(post.displayUrl)}" alt="Post by ${post.ownerUsername}" class="w-24 h-24 object-cover rounded-md" onerror="this.onerror=null;this.src='https://placehold.co/96x96/e2e8f0/475569?text=Error';">
                    <div class="flex-grow">
                        <div class="flex justify-between items-start">
                            <div>
                                <div class="flex items-center gap-2">
                                    <p class="font-bold text-slate-800 dark:text-white">${post.ownerUsername}</p>
                                </div>
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
                        <div class="save-container mt-4"></div>
                    </div>
                </div>
            </div>
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
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `<button data-page="${i}" class="page-btn px-3 py-1 rounded-md ${i === currentPage ? 'bg-primary-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}">${i}</button>`;
        }
        paginationHTML += `<button data-page="${currentPage + 1}" class="page-btn p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" ${currentPage === totalPages ? 'disabled' : ''}><i data-lucide="chevron-right" class="w-5 h-5"></i></button>`;
        paginationHTML += '</div>';
        paginationContainer.innerHTML = paginationHTML;
        lucide.createIcons();
    };

    const handlePaginationClick = (e) => {
        const pageBtn = e.target.closest('.page-btn');
        if (pageBtn && !pageBtn.disabled) {
            const page = parseInt(pageBtn.dataset.page);
            if (!isNaN(page)) {
                currentPage = page;
                fetchPostsFromDB(currentPage);
            }
        }
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

    // Save button will be rendered after transcription (if any)
    const handleSavePost = async (button) => {
        const postId = button.dataset.postId;
        const post = allPosts.find(p => p._id === postId);
        if (!post) return;
        button.disabled = true;
        button.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin mr-2"></i>Saving...';
        lucide.createIcons();
        try {
            await apiCall('/api/save-competitor-post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post })
            });
            showNotification('Saved', 'Post successfully saved and marked as used.');
            fetchPostsFromDB(currentPage);
        } catch (error) {
            showNotification('Error', error.message || 'Failed to save post.', 'error');
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
            await apiCall(`/api/competitor-posts/${postId}`, { method: 'DELETE' });
            showNotification('Deleted', 'Post marked as used.');
            fetchPostsFromDB(currentPage);
        } catch (error) {
            showNotification('Error', error.message || 'Failed to delete post.', 'error');
        }
    };

    // --- EVENT LISTENERS & INITIALIZATION ---
    const handleRunScrapeJob = async () => {
        runScrapeJobBtn.disabled = true;
        runScrapeJobBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i> Updating...';
        lucide.createIcons();
        try {
            const res = await apiCall('/api/run-competitor-scrape-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ competitors: competitorsToScrape, resultsLimit: parseInt(searchDepthInput.value) || 5 })
            });
            showNotification('Success', res.message || 'Competitor pool updated!');
            updatePoolModal.classList.add('hidden');
            fetchPostsFromDB(1);
        } catch (error) {
            showNotification('Error', error.message || 'Failed to update competitor pool.', 'error');
        } finally {
            runScrapeJobBtn.disabled = false;
            runScrapeJobBtn.innerHTML = 'Start Scraping';
            lucide.createIcons();
        }
    };

    // Save button after transcription, delete icon in upper right
    const init = async () => {
        competitorsToScrape = [];
        renderCompetitorsInModal();
        fetchPostsFromDB();

        updatePoolBtn.addEventListener('click', async () => {
            try {
                const res = await apiCall('/api/default-ig-competitors');
                DEFAULT_COMPETITORS = res.competitors || [];
                if (competitorsToScrape.length === 0) {
                    competitorsToScrape = [...DEFAULT_COMPETITORS];
                }
                renderCompetitorsInModal();
            } catch (err) {
                showNotification('Error', 'Failed to load default competitors.', 'error');
            }
            updatePoolModal.classList.remove('hidden');
        });
        closeUpdateModalBtn.addEventListener('click', () => updatePoolModal.classList.add('hidden'));
        runScrapeJobBtn.addEventListener('click', handleRunScrapeJob);
        addCompetitorInput.addEventListener('keydown', handleAddCompetitorKeydown);
        addCompetitorBtn.addEventListener('click', addCompetitorFromInput);
        competitorsContainerModal.addEventListener('click', handleRemoveCompetitor);
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
            // Save button after transcription
            const saveBtn = e.target.closest('.save-btn');
            if (saveBtn) {
                handleSavePost(saveBtn);
                return;
            }
            // Delete icon in upper right
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                showConfirmModal('Delete Post', 'Are you sure you want to mark this post as used?', () => {
                    hideConfirmModal();
                    handleDeletePost(deleteBtn);
                });
                return;
            }
            // Transcript button logic (if you have it)
            const transcribeBtn = e.target.closest('.transcribe-btn');
            if (transcribeBtn) {
                // Insert your transcription logic here, and after transcription, render the save button in the .save-container
                // For now, just show the save button immediately for demonstration
                const postCard = transcribeBtn.closest('[data-post-id]');
                if (postCard) {
                    const saveContainer = postCard.querySelector('.save-container');
                    if (saveContainer && !saveContainer.querySelector('.save-btn')) {
                        saveContainer.innerHTML = `<button class="save-btn text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold mt-2" data-post-id="${postCard.dataset.postId}">Save</button>`;
                        lucide.createIcons();
                    }
                }
            }
        });
        confirmCancelBtn.addEventListener('click', hideConfirmModal);
        confirmActionBtn.addEventListener('click', () => {
            if (confirmCallback) confirmCallback();
        });
        // Close modals when clicking outside
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) hideConfirmModal();
        });
        filterModal.addEventListener('click', (e) => {
            if (e.target === filterModal) filterModal.classList.add('hidden');
        });
        updatePoolModal.addEventListener('click', (e) => {
            if (e.target === updatePoolModal) updatePoolModal.classList.add('hidden');
        });
    };
    init();
});
