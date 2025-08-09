// public/js/saved-content.js
// Handles interactions for the saved content page with platform filtering.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const loader = document.getElementById('loader');
    const container = document.getElementById('articles-container');
    const errorContainer = document.getElementById('error-container');
    const paginationContainer = document.getElementById('pagination-container');
    const frameworkSelectModal = document.getElementById('framework-select-modal');
    const frameworkOptionsContainer = document.getElementById('framework-options-container');
    const closeFrameworkSelectModalBtn = document.getElementById('close-framework-select-modal-btn');
    const storyLoaderModal = document.getElementById('story-loader-modal');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmActionBtn = document.getElementById('confirm-action-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const confirmModalTitle = document.getElementById('confirm-modal-title');
    const confirmModalMessage = document.getElementById('confirm-modal-message');
    const notificationModal = document.getElementById('notification-modal');
    const notificationIconContainer = document.getElementById('notification-icon-container');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    const notificationOkBtn = document.getElementById('notification-ok-btn');
    
    // Platform tab elements
    const instagramTab = document.getElementById('instagram-tab');
    const tiktokTab = document.getElementById('tiktok-tab');
    const youtubeTab = document.getElementById('youtube-tab');

    // --- STATE MANAGEMENT ---
    let allPosts = [];
    let currentPage = 1;
    let currentPlatform = 'instagram'; // Default to Instagram
    const postsPerPage = 10;
    let postToProcess = null;
    let confirmCallback = null;

    // --- API & UI HELPERS ---
    const showNotification = (title, message, type = 'success') => {
        notificationTitle.textContent = title;
        notificationMessage.textContent = message;
        const iconContainer = notificationIconContainer;
        if (type === 'error') {
            iconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-500/20';
            iconContainer.innerHTML = '<i data-lucide="alert-triangle" class="h-6 w-6 text-red-600 dark:text-red-400"></i>';
        } else if (type === 'info') {
            iconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-500/20';
            iconContainer.innerHTML = '<i data-lucide="info" class="h-6 w-6 text-blue-600 dark:text-blue-400"></i>';
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

    const fetchSavedPosts = async (page = 1, platform = currentPlatform) => {
        loader.classList.remove('hidden');
        errorContainer.classList.add('hidden');
        container.innerHTML = '';

        try {
            const data = await apiCall(`/api/saved-posts?page=${page}&limit=${postsPerPage}&platform=${platform}`);
            allPosts = data.posts || [];
            renderPosts(allPosts, platform);
            renderPaginationControls(data.totalPages, data.currentPage);
        } catch (error) {
            errorContainer.textContent = `Error: ${error.message}`;
            errorContainer.classList.remove('hidden');
        } finally {
            loader.classList.add('hidden');
        }
    };

    const renderPosts = (posts, platform) => {
        if (posts.length === 0) {
            container.innerHTML = `<div class="text-center text-slate-500 p-8 bg-white dark:bg-slate-900/50 rounded-xl">You have no saved ${platform} posts.</div>`;
            return;
        }

        container.innerHTML = posts.map(post => {
            if (platform === 'instagram' || post.ownerUsername || post.url?.includes('instagram.com')) {
                return renderInstagramPost(post);
            } else if (platform === 'tiktok' || post.authorMeta || post.webVideoUrl) {
                return renderTikTokPost(post);
            } else {
                // Fallback to Instagram format for unknown posts
                return renderInstagramPost(post);
            }
        }).join('');
        lucide.createIcons();
    };

    const renderInstagramPost = (post) => {
        const captionWithoutHashtags = (post.caption || '').replace(/#\w+/g, '').trim();
        const viewsHTML = post.videoPlayCount ? `<span class="flex items-center gap-1"><i data-lucide="play-circle" class="w-4 h-4"></i> ${post.videoPlayCount}</span>` : '';
        return `
        <div class="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800" data-post-id="${post._id}">
            <div class="flex items-start gap-4">
                <img src="/api/image-proxy?url=${encodeURIComponent(post.displayUrl)}" alt="Post by ${post.ownerUsername}" class="w-24 h-24 object-cover rounded-md" onerror="this.onerror=null;this.src='https://placehold.co/96x96/e2e8f0/475569?text=Error';">
                <div class="flex-grow">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold text-slate-800 dark:text-white">${post.ownerUsername}</p>
                            <p class="text-xs text-slate-400">${new Date(post.timestamp || post.savedAt).toLocaleString()}</p>
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
                    <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Transcript</h4>
                        <p class="text-xs text-slate-500 dark:text-slate-400 p-2 bg-slate-100 dark:bg-slate-800 rounded-md">${post.transcript}</p>
                    </div>
                     <a href="${post.url}" target="_blank" class="text-primary-600 dark:text-primary-400 text-xs font-semibold mt-2 inline-block">View on Instagram</a>
                     <div class="mt-4"><button class="generate-story-btn text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold" data-post-id="${post._id}">Generate Story</button></div>
                </div>
            </div>
        </div>`;
    };

    const renderTikTokPost = (post) => {
        const author = post.authorMeta?.nickName || 'Unknown Author';
        const avatar = post.authorMeta?.avatar || 'https://placehold.co/96x96/e2e8f0/475569?text=TT';
        const playCount = post.playCount || 0;
        const diggCount = post.diggCount || 0;
        const commentCount = post.commentCount || 0;
        
        return `
        <div class="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800" data-post-id="${post._id}">
            <div class="flex items-start gap-4">
                <img src="${avatar}" alt="Post by ${author}" class="w-24 h-24 object-cover rounded-md" onerror="this.onerror=null;this.src='https://placehold.co/96x96/e2e8f0/475569?text=TT';">
                <div class="flex-grow">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold text-slate-800 dark:text-white">${author}</p>
                            <p class="text-xs text-slate-400">${new Date(post.createTimeISO || post.savedAt).toLocaleString()}</p>
                        </div>
                        <div class="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                            <span class="flex items-center gap-1"><i data-lucide="play-circle" class="w-4 h-4"></i> ${playCount}</span>
                            <span class="flex items-center gap-1"><i data-lucide="heart" class="w-4 h-4"></i> ${diggCount}</span>
                            <span class="flex items-center gap-1"><i data-lucide="message-circle" class="w-4 h-4"></i> ${commentCount}</span>
                            <button class="delete-post-btn p-1.5 rounded-full hover:bg-red-500/10 text-red-500" data-post-id="${post._id}" title="Delete Post">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-wrap">${post.text || ''}</p>
                    <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Transcript</h4>
                        <p class="text-xs text-slate-500 dark:text-slate-400 p-2 bg-slate-100 dark:bg-slate-800 rounded-md">${post.transcript}</p>
                    </div>
                     <a href="${post.webVideoUrl}" target="_blank" class="text-primary-600 dark:text-primary-400 text-xs font-semibold mt-2 inline-block">View on TikTok</a>
                     <div class="mt-4"><button class="generate-story-btn text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold" data-post-id="${post._id}">Generate Story</button></div>
                </div>
            </div>
        </div>`;
    };

    const renderPaginationControls = (totalPages, currentPage) => {
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        let paginationHTML = '<div class="flex items-center justify-between">';
        paginationHTML += `<button data-page="${currentPage - 1}" class="page-btn p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" ${currentPage === 1 ? 'disabled' : ''}><i data-lucide="arrow-left" class="w-5 h-5"></i></button>`;
        paginationHTML += `<span class="text-sm font-medium text-slate-500">Page ${currentPage} of ${totalPages}</span>`;
        paginationHTML += `<button data-page="${currentPage + 1}" class="page-btn p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" ${currentPage === totalPages ? 'disabled' : ''}><i data-lucide="arrow-right" class="w-5 h-5"></i></button>`;
        paginationHTML += '</div>';
        paginationContainer.innerHTML = paginationHTML;
        lucide.createIcons();
    };

    const handlePaginationClick = (e) => {
        const pageBtn = e.target.closest('.page-btn');
        if (pageBtn && !pageBtn.disabled) {
            const page = parseInt(pageBtn.dataset.page);
            currentPage = page;
            fetchSavedPosts(page, currentPlatform);
        }
    };

    const handleTabClick = (platform) => {
        // Update active tab styling
        instagramTab?.classList.remove('border-primary-500', 'text-primary-600', 'dark:text-primary-400');
        tiktokTab?.classList.remove('border-primary-500', 'text-primary-600', 'dark:text-primary-400');
        youtubeTab?.classList.remove('border-primary-500', 'text-primary-600', 'dark:text-primary-400');
        
        instagramTab?.classList.add('border-transparent', 'text-slate-500', 'hover:text-slate-700');
        tiktokTab?.classList.add('border-transparent', 'text-slate-500', 'hover:text-slate-700');
        youtubeTab?.classList.add('border-transparent', 'text-slate-500', 'hover:text-slate-700');

        // Activate selected tab
        const activeTab = platform === 'instagram' ? instagramTab : 
                          platform === 'tiktok' ? tiktokTab : youtubeTab;
        if (activeTab) {
            activeTab.classList.remove('border-transparent', 'text-slate-500', 'hover:text-slate-700');
            activeTab.classList.add('border-primary-500', 'text-primary-600', 'dark:text-primary-400');
        }

        // Update current platform and fetch posts
        currentPlatform = platform;
        currentPage = 1;
        fetchSavedPosts(1, platform);
    };

    const handleGenerateStory = (e) => {
        const generateBtn = e.target.closest('.generate-story-btn');
        if (!generateBtn) return;
        
        const postId = generateBtn.dataset.postId;
        postToProcess = allPosts.find(p => p._id === postId);
        
        if (postToProcess) {
            showFrameworkSelector(processStoryCreation);
        } else {
            console.error("Could not find post for story generation.");
        }
    };

    const showFrameworkSelector = async (onSelectCallback) => {
        frameworkOptionsContainer.innerHTML = `<div class="flex justify-center items-center py-10"><i data-lucide="refresh-cw" class="w-6 h-6 animate-spin text-primary-500"></i></div>`;
        lucide.createIcons();
        frameworkSelectModal.classList.remove('hidden');

        try {
            const frameworks = await apiCall('/api/frameworks');
            frameworkOptionsContainer.innerHTML = frameworks.map(fw => `
                <button class="framework-option-btn w-full text-left p-4 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex justify-between items-center" data-id="${fw._id}">
                    <span>
                        <span class="font-semibold text-slate-800 dark:text-white">${fw.name}</span>
                         <span class="ml-2 text-xs ${fw.type === 'news_commentary' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'} px-2 py-0.5 rounded-full font-medium">${fw.type === 'news_commentary' ? 'News Commentary' : 'Viral Script'}</span>
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
            const newStory = await apiCall('/api/create-story-from-social', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post: postToProcess, transcript: postToProcess.transcript, frameworkId })
            });
            sessionStorage.setItem('generatedContent', JSON.stringify([newStory]));
            window.location.href = '/reels';
        } catch (error) {
            // Handle error, e.g., show a notification
            console.error("Error creating story:", error);
            showNotification('Error', `Failed to generate story: ${error.message}`, 'error');
        } finally {
            storyLoaderModal.classList.add('hidden');
            postToProcess = null;
        }
    };

    const handleDeletePost = (button) => {
        const postId = button.dataset.postId;
        showConfirmModal('Delete Post?', 'This will permanently remove this post from your saved content. This action cannot be undone.', async () => {
            try {
                await apiCall(`/api/saved-posts/${postId}`, { method: 'DELETE' });
                hideConfirmModal();
                showNotification('Post Deleted', 'The post has been successfully removed from your saved content.');
                fetchSavedPosts(currentPage, currentPlatform);
            } catch (error) {
                hideConfirmModal();
                showNotification('Error', `Failed to delete post: ${error.message}`, 'error');
            }
        });
    };

    // --- EVENT LISTENERS & INITIALIZATION ---
    const init = () => {
        fetchSavedPosts();
        paginationContainer.addEventListener('click', handlePaginationClick);
        container.addEventListener('click', (e) => {
            handleGenerateStory(e);
            if (e.target.closest('.delete-post-btn')) {
                handleDeletePost(e.target.closest('.delete-post-btn'));
            }
        });
        closeFrameworkSelectModalBtn.addEventListener('click', () => {
            frameworkSelectModal.classList.add('hidden');
        });
        notificationOkBtn.addEventListener('click', () => notificationModal.classList.add('hidden'));
        confirmCancelBtn.addEventListener('click', hideConfirmModal);
        confirmActionBtn.addEventListener('click', () => {
            if (confirmCallback) confirmCallback();
        });
        
        // Platform tab event listeners
        instagramTab?.addEventListener('click', () => handleTabClick('instagram'));
        tiktokTab?.addEventListener('click', () => handleTabClick('tiktok'));
        youtubeTab?.addEventListener('click', () => {
            showNotification('Coming Soon', 'YouTube integration is temporarily disabled and will be available soon.', 'info');
        });
    };
    
    init();
});
