// public/js/youtube-hashtags-live.js
// Handles interactions for the YouTube live scraping page.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const loader = document.getElementById('news-loader');
    const container = document.getElementById('news-articles-container');
    const errorContainer = document.getElementById('news-error');
    const fetchContentBtn = document.getElementById('fetch-content-btn');
    const initialKeywordsContainer = document.getElementById('initial-keywords-container');
    const initialAddKeywordInput = document.getElementById('initial-add-keyword-input');
    const initialAddKeywordBtn = document.getElementById('initial-add-keyword-btn');
    const initialSearchDepthInput = document.getElementById('initial-search-depth-input');
    const initialCostEstimationText = document.getElementById('initial-cost-estimation-text');
    const paginationContainer = document.getElementById('pagination-container');
    const filterBtn = document.getElementById('filter-btn');
    const filterModal = document.getElementById('filter-modal');
    const closeFilterModalBtn = document.getElementById('close-filter-modal-btn');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const shuffleBtn = document.getElementById('shuffle-btn');
    
    // Additional modal elements
    const transcriptionModal = document.getElementById('transcription-modal');
    const closeTranscriptionModalBtn = document.getElementById('close-transcription-modal-btn');
    const transcriptionLoading = document.getElementById('transcription-loading');
    const transcriptionError = document.getElementById('transcription-error');
    const retryTranscriptionBtn = document.getElementById('retry-transcription-btn');
    const frameworkSelectModal = document.getElementById('framework-select-modal');
    const frameworkOptionsContainer = document.getElementById('framework-options-container');
    const closeFrameworkSelectModalBtn = document.getElementById('close-framework-select-modal-btn');
    const storyLoaderModal = document.getElementById('story-loader-modal');
    
    // Notification modal elements
    const notificationModal = document.getElementById('notification-modal');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    const notificationIconContainer = document.getElementById('notification-icon-container');
    const notificationOkBtn = document.getElementById('notification-ok-btn');

    // --- STATE MANAGEMENT ---
    let allVideos = [];
    let filteredVideos = [];
    let currentPage = 1;
    const videosPerPage = 10;
    let filters = {
        hashtags: [],
        minViews: 0,
        minLikes: 0,
        minComments: 0,
        minDuration: 0,
        maxDuration: 300,
        dateFilter: 'any',
        resultsLimit: 10
    };
    let currentTranscribingBtn = null;
    
    // Map to store video data with transcripts to avoid HTML attribute size limits
    const videoDataStore = new Map();

    // --- API & UI HELPERS ---
    const showNotification = (title, message, type = 'success') => {
        notificationTitle.textContent = title;
        notificationMessage.textContent = message;
        const iconContainer = notificationIconContainer;
        if (type === 'error') {
            iconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-500/20';
            iconContainer.innerHTML = '<i data-lucide="alert-triangle" class="h-6 w-6 text-red-400"></i>';
        } else {
            iconContainer.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-500/20';
            iconContainer.innerHTML = '<i data-lucide="check-circle" class="h-6 w-6 text-green-400"></i>';
        }
        notificationModal.classList.remove('hidden');
        lucide.createIcons();
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
        const numHashtags = filters.hashtags.length;
        const resultsPerHashtag = filters.resultsLimit || 10;
        const totalVideos = numHashtags * resultsPerHashtag;
        // YouTube scraping cost estimation: $0.5 per 1000 videos
        const cost = (totalVideos / 1000) * 0.5;
        if (initialCostEstimationText) {
            initialCostEstimationText.textContent = `$${cost.toFixed(4)}`;
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

    const renderKeywords = (containerEl = initialKeywordsContainer) => {
        if (!containerEl) return;
        containerEl.innerHTML = filters.hashtags.map((keyword, index) => `
            <div class="keyword-bubble flex items-center gap-1.5 bg-gradient-to-r from-red-500 to-pink-600 text-white text-sm font-medium px-3 py-1.5 rounded-full shadow-sm">
                <span>${keyword}</span>
                <button class="remove-keyword-btn" data-index="${index}" title="Remove ${keyword}">
                    <i data-lucide="x" class="w-4 h-4 hover:text-red-200 transition-colors"></i>
                </button>
            </div>
        `).join('');
        lucide.createIcons();
        updateCostEstimation();
    };

    const addKeywordFromInput = (inputEl = initialAddKeywordInput, containerEl = initialKeywordsContainer) => {
        if (!inputEl) return;
        const newKeyword = inputEl.value.trim().replace(/,$/, '');
        if (newKeyword && !filters.hashtags.includes(newKeyword)) {
            filters.hashtags.push(newKeyword);
            renderKeywords(containerEl);
        }
        inputEl.value = '';
        inputEl.focus();
    };

    const handleAddKeywordKeydown = (e, inputEl = initialAddKeywordInput, containerEl = initialKeywordsContainer) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addKeywordFromInput(inputEl, containerEl);
        }
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

    const applyFilters = (videos) => {
        return videos.filter(video => {
            if (filters.minViews > 0 && (video.viewCount || video.views || 0) < filters.minViews) return false;
            if (filters.minLikes > 0 && (video.likeCount || video.likes || 0) < filters.minLikes) return false;
            if (filters.minComments > 0 && (video.commentCount || video.comments || 0) < filters.minComments) return false;
            if (filters.minDuration > 0 && (video.duration || 0) < filters.minDuration) return false;
            return true;
        });
    };

    const renderVideos = (videos) => {
        if (!videos || videos.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-slate-400">
                    <i data-lucide="video-off" class="w-16 h-16 mx-auto mb-4 text-slate-600"></i>
                    <p class="text-lg font-medium mb-2">No YouTube videos found</p>
                    <p>Try adjusting your hashtags or filters and scrape again.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        // Pagination
        const startIndex = (currentPage - 1) * videosPerPage;
        const endIndex = startIndex + videosPerPage;
        const paginatedVideos = videos.slice(startIndex, endIndex);

        container.innerHTML = paginatedVideos.map(video => {
            return `
                <article class="bg-slate-800 rounded-xl shadow-lg border border-slate-700 hover:border-slate-600 transition-colors duration-300">
                    <div class="p-6">
                        <!-- Header with channel info -->
                        <div class="flex items-center gap-3 mb-4">
                            ${video.channel?.thumbnails?.[0]?.url ? `
                                <img src="${video.channel.thumbnails[0].url}" alt="${video.channel?.name || 'Channel'}" class="w-10 h-10 rounded-full object-cover">
                            ` : `
                                <div class="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center">
                                    <i data-lucide="user" class="w-5 h-5 text-slate-400"></i>
                                </div>
                            `}
                            <div class="flex-grow min-w-0">
                                <h3 class="font-semibold text-white truncate">${video.channel?.name || 'Unknown Channel'}</h3>
                                <p class="text-sm text-slate-400">${video.publishDate || video.uploadDate || 'Unknown date'}</p>
                            </div>
                        </div>

                        <!-- Video thumbnail and content -->
                        <div class="grid md:grid-cols-3 gap-4">
                            <div class="md:col-span-1">
                                ${video.thumbnails?.find(t => t.width >= 480)?.url || video.thumbnails?.[0]?.url ? `
                                    <img src="${video.thumbnails.find(t => t.width >= 480)?.url || video.thumbnails[0].url}" alt="${video.title}" class="w-full h-32 md:h-24 object-cover rounded-lg shadow-md">
                                ` : `
                                    <div class="w-full h-32 md:h-24 bg-slate-700 rounded-lg flex items-center justify-center">
                                        <i data-lucide="video" class="w-8 h-8 text-slate-400"></i>
                                    </div>
                                `}
                            </div>
                            <div class="md:col-span-2">
                                <h4 class="font-bold text-white mb-2 line-clamp-2">${video.title || 'Untitled Video'}</h4>
                                ${video.description ? `
                                    <p class="text-slate-300 text-sm mb-3 line-clamp-3">${video.description}</p>
                                ` : ''}
                                
                                <!-- Video stats -->
                                <div class="flex flex-wrap items-center gap-4 text-sm mb-4">
                                    ${video.views !== undefined || video.viewCount !== undefined ? `
                                        <span class="flex items-center gap-1 text-red-400">
                                            <i data-lucide="eye" class="w-4 h-4"></i>
                                            ${formatNumber(video.views || video.viewCount)} views
                                        </span>
                                    ` : ''}
                                    ${video.likes !== undefined || video.likeCount !== undefined ? `
                                        <span class="flex items-center gap-1 text-pink-400">
                                            <i data-lucide="heart" class="w-4 h-4"></i>
                                            ${formatNumber(video.likes || video.likeCount)} likes
                                        </span>
                                    ` : ''}
                                    ${video.comments !== undefined || video.commentCount !== undefined ? `
                                        <span class="flex items-center gap-1 text-blue-400">
                                            <i data-lucide="message-circle" class="w-4 h-4"></i>
                                            ${formatNumber(video.comments || video.commentCount)} comments
                                        </span>
                                    ` : ''}
                                    ${video.duration ? `
                                        <span class="flex items-center gap-1">
                                            <i data-lucide="clock" class="w-4 h-4"></i>
                                            ${formatDuration(video.duration)}
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- Action buttons -->
                        <div class="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                            <div class="flex gap-2">
                                ${video.url ? `
                                    <a href="${video.url}" target="_blank" class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors">
                                        <i data-lucide="external-link" class="w-4 h-4"></i>
                                        Watch
                                    </a>
                                ` : ''}
                                <button class="transcribe-btn flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors" data-url="${video.url}" data-video='${JSON.stringify(video)}'>
                                    <i data-lucide="file-text" class="w-4 h-4"></i>
                                    Transcribe
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

    const handleScrapeVideos = async () => {
        if (filters.hashtags.length === 0) {
            showError('Please add at least one hashtag to scrape.');
            return;
        }

        if (!fetchContentBtn) return;

        fetchContentBtn.disabled = true;
        fetchContentBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-5 h-5 mr-2 animate-spin"></i>Scraping...';
        lucide.createIcons();

        loader.classList.remove('hidden');
        errorContainer.classList.add('hidden');

        try {
            const response = await apiCall('scrape-youtube-keywords', {
                method: 'POST',
                body: JSON.stringify({
                    keywords: filters.hashtags,
                    resultsLimit: filters.resultsLimit || 10,
                    duration: 's', // "s" for short (< 4 minutes) - includes Shorts
                    uploadDate: 'w' // "w" for this week
                })
            });

            allVideos = response || [];
            filteredVideos = applyFilters(allVideos);
            renderVideos(filteredVideos);
            renderPagination();
            
            // Show/hide filter and shuffle buttons
            filterBtn.classList.remove('hidden');
            shuffleBtn.classList.remove('hidden');
            
            if (allVideos.length === 0) {
                showError('No videos found for your hashtags. Try different hashtags or adjust your filters.');
            }
        } catch (error) {
            console.error('Error scraping videos:', error);
            showError(error.message || 'An error occurred while scraping videos. Please try again.');
        } finally {
            fetchContentBtn.disabled = false;
            fetchContentBtn.innerHTML = '<i data-lucide="search" class="w-5 h-5"></i>Search Hashtags';
            lucide.createIcons();
            loader.classList.add('hidden');
        }
    };

    const showError = (message) => {
        errorContainer.textContent = message;
        errorContainer.classList.remove('hidden');
    };

    const updateFilterModalUI = () => {
        const minViewsInput = document.getElementById('min-views-input');
        const minLikesInput = document.getElementById('min-likes-input'); 
        const minCommentsInput = document.getElementById('min-comments-input');
        const minDurationInput = document.getElementById('min-duration-input');
        const maxDurationInput = document.getElementById('max-duration-input');
        const dateUploadedSelect = document.getElementById('date-uploaded-select');
        
        if (minViewsInput) minViewsInput.value = filters.minViews;
        if (minLikesInput) minLikesInput.value = filters.minLikes;
        if (minCommentsInput) minCommentsInput.value = filters.minComments;
        if (minDurationInput) minDurationInput.value = filters.minDuration;
        if (maxDurationInput) maxDurationInput.value = filters.maxDuration;
        if (dateUploadedSelect) dateUploadedSelect.value = filters.dateFilter;
    };

    const handleApplyFilters = () => {
        const minViewsInput = document.getElementById('min-views-input');
        const minLikesInput = document.getElementById('min-likes-input');
        const minCommentsInput = document.getElementById('min-comments-input');
        const minDurationInput = document.getElementById('min-duration-input');
        const maxDurationInput = document.getElementById('max-duration-input');
        const dateUploadedSelect = document.getElementById('date-uploaded-select');
        
        filters.minViews = parseInt(minViewsInput?.value) || 0;
        filters.minLikes = parseInt(minLikesInput?.value) || 0;
        filters.minComments = parseInt(minCommentsInput?.value) || 0;
        filters.minDuration = parseInt(minDurationInput?.value) || 0;
        filters.maxDuration = parseInt(maxDurationInput?.value) || 300;
        filters.dateFilter = dateUploadedSelect?.value || 'any';
        
        filterModal.classList.add('hidden');
        
        if (allVideos.length > 0) {
            filteredVideos = applyFilters(allVideos);
            renderVideos(filteredVideos);
            renderPagination();
        }
    };

    const handleResetFilters = () => {
        filters.minViews = 0;
        filters.minLikes = 0;
        filters.minComments = 0;
        filters.minDuration = 0;
        filters.maxDuration = 300;
        filters.dateFilter = 'any';
        updateFilterModalUI();
    };

    const renderPagination = () => {
        if (!paginationContainer || filteredVideos.length <= videosPerPage) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        const totalPages = Math.ceil(filteredVideos.length / videosPerPage);
        let paginationHTML = `
            <div class="flex items-center justify-center gap-2 mt-8">
                <button id="prev-page" class="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed" ${currentPage <= 1 ? 'disabled' : ''}>
                    Previous
                </button>
        `;
        
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `
                <button class="page-btn px-3 py-2 text-sm font-medium rounded-lg ${i === currentPage ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}" data-page="${i}">
                    ${i}
                </button>
            `;
        }
        
        paginationHTML += `
                <button id="next-page" class="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed" ${currentPage >= totalPages ? 'disabled' : ''}>
                    Next
                </button>
            </div>
        `;
        
        paginationContainer.innerHTML = paginationHTML;
        
        // Add event listeners
        document.getElementById('prev-page')?.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderVideos(filteredVideos);
                renderPagination();
            }
        });
        
        document.getElementById('next-page')?.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredVideos.length / videosPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderVideos(filteredVideos);
                renderPagination();
            }
        });
        
        document.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                renderVideos(filteredVideos);
                renderPagination();
            });
        });
    };

    const handleShuffle = () => {
        if (allVideos.length > 1) {
            for (let i = allVideos.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allVideos[i], allVideos[j]] = [allVideos[j], allVideos[i]];
            }
            filteredVideos = applyFilters(allVideos);
            currentPage = 1; // Reset to first page after shuffle
            renderVideos(filteredVideos);
            renderPagination();
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
        const videoData = JSON.parse(transcribeBtn.dataset.video);
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

                // Store transcript in the video data
                videoData.transcript = response.transcript;
                
                // Generate unique ID and store video data
                const videoId = 'video_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                videoDataStore.set(videoId, videoData);

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
                        <button class="save-post-btn flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors" data-video-id="${videoId}">
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
        const videoId = button.dataset.videoId;
        const postData = videoDataStore.get(videoId);
        
        if (!postData) {
            showNotification('Error', 'Video data not found. Please try again.');
            return;
        }

        button.disabled = true;
        button.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin mr-2"></i>Saving...';
        lucide.createIcons();

        try {
            const response = await apiCall('save-live-post', {
                method: 'POST',
                body: JSON.stringify({ post: { ...postData, platform: 'youtube' } })
            });

            showNotification('Success', response.message);
            button.innerHTML = '<i data-lucide="check" class="w-4 h-4 mr-2"></i>Saved';
            button.classList.remove('bg-green-600', 'hover:bg-green-700');
            button.classList.add('bg-slate-400', 'cursor-not-allowed');
            button.disabled = true;
            
            // Clean up stored video data
            videoDataStore.delete(videoId);
        } catch (error) {
            console.error('Error saving post:', error);
            showNotification('Error', 'Failed to save the video. Please try again.', 'error');
            button.disabled = false;
            button.innerHTML = '<i data-lucide="bookmark-plus" class="w-4 h-4 mr-2"></i>Save';
        } finally {
            lucide.createIcons();
        }
    };

    // --- EVENT LISTENERS & INITIALIZATION ---
    const init = async () => {
        // Start with empty hashtags for live mode (users add their own custom hashtags)
        filters.hashtags = [];
        renderKeywords();
        updateCostEstimation();

        // Update search depth when changed
        if (initialSearchDepthInput) {
            initialSearchDepthInput.addEventListener('input', () => {
                filters.resultsLimit = parseInt(initialSearchDepthInput.value) || 10;
                updateCostEstimation();
            });
        }

        // Event listeners
        if (fetchContentBtn) {
            fetchContentBtn.addEventListener('click', handleScrapeVideos);
        }
        
        if (initialAddKeywordInput) {
            initialAddKeywordInput.addEventListener('keydown', (e) => handleAddKeywordKeydown(e));
        }
        
        if (initialAddKeywordBtn) {
            initialAddKeywordBtn.addEventListener('click', () => addKeywordFromInput());
        }
        
        if (initialKeywordsContainer) {
            initialKeywordsContainer.addEventListener('click', handleRemoveKeyword);
        }

        if (filterBtn) {
            filterBtn.addEventListener('click', () => {
                updateFilterModalUI();
                filterModal.classList.remove('hidden');
            });
        }
        
        if (closeFilterModalBtn) {
            closeFilterModalBtn.addEventListener('click', () => filterModal.classList.add('hidden'));
        }
        
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', handleApplyFilters);
        }
        
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', handleResetFilters);
        }
        
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', handleShuffle);
        }
        
        // Container event listener for dynamically created buttons
        container.addEventListener('click', (e) => {
            const saveBtn = e.target.closest('.save-post-btn');
            const transcribeBtn = e.target.closest('.transcribe-btn');
            
            if (saveBtn) {
                handleSavePost(saveBtn);
            } else if (transcribeBtn) {
                handleTranscribe(e);
            }
        });
        
        // Close transcription modal
        if (closeTranscriptionModalBtn) {
            closeTranscriptionModalBtn.addEventListener('click', () => {
                transcriptionModal.classList.add('hidden');
            });
        }
        
        // Close notification modal
        if (notificationOkBtn) {
            notificationOkBtn.addEventListener('click', () => {
                notificationModal.classList.add('hidden');
            });
        }
        
        // Close modals when clicking outside
        filterModal.addEventListener('click', (e) => {
            if (e.target === filterModal) {
                filterModal.classList.add('hidden');
            }
        });
    };
    
    init();
});
