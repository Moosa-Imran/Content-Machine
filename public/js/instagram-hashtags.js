// public/js/instagram-hashtags.js
// Handles all client-side interactions for the instagram-hashtags.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const scrapeBtn = document.getElementById('scrape-hashtags-btn');
    const loader = document.getElementById('news-loader');
    const container = document.getElementById('news-articles-container');
    const errorContainer = document.getElementById('news-error');
    const keywordsContainer = document.getElementById('keywords-container');
    const addKeywordInput = document.getElementById('add-keyword-input');
    const addKeywordBtn = document.getElementById('add-keyword-btn');

    // --- STATE MANAGEMENT ---
    let hashtags = ["marketingpsychology", "behavioraleconomics", "neuromarketing", "cognitivebias", "pricingpsychology", "marketingtips", "psychologyfacts", "businesstips"];

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
        keywordsContainer.innerHTML = hashtags.map((keyword, index) => `
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
        if (newKeyword && !hashtags.includes(newKeyword)) {
            hashtags.push(newKeyword);
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
            hashtags.splice(indexToRemove, 1);
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
                body: JSON.stringify({ hashtags })
            });

            if (!results || results.length === 0) {
                container.innerHTML = `<div class="text-center text-slate-500 p-8 bg-white dark:bg-slate-900/50 rounded-xl">No posts found for the given hashtags.</div>`;
            } else {
                renderPosts(results);
            }
        } catch (error) {
            errorContainer.textContent = `Error: ${error.message}`;
            errorContainer.classList.remove('hidden');
        } finally {
            loader.classList.add('hidden');
        }
    };

    const renderPosts = (posts) => {
        container.innerHTML = (posts || []).map(post => {
            // Remove hashtags from the caption and display the full text
            const captionWithoutHashtags = (post.caption || '').replace(/#\w+/g, '').trim();

            return `
            <div class="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
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
                                <span class="flex items-center gap-1"><i data-lucide="play-circle" class="w-4 h-4"></i> ${post.videoPlayCount || 0}</span>
                            </div>
                        </div>
                        <p class="text-sm text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-wrap">${captionWithoutHashtags}</p>
                        <div class="mt-2 flex flex-wrap gap-1">
                            ${(post.hashtags || []).map(tag => `<span class="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-full">#${tag}</span>`).join('')}
                        </div>
                         <a href="${post.url}" target="_blank" class="text-primary-600 dark:text-primary-400 text-xs font-semibold mt-2 inline-block">View on Instagram</a>
                    </div>
                </div>
            </div>
        `}).join('');
        lucide.createIcons();
    };

    // --- EVENT LISTENERS & INITIALIZATION ---
    const init = () => {
        scrapeBtn.addEventListener('click', scrapeHashtags);
        addKeywordInput.addEventListener('keydown', handleAddKeywordKeydown);
        addKeywordBtn.addEventListener('click', addKeywordFromInput);
        keywordsContainer.addEventListener('click', handleRemoveKeyword);
        renderKeywords();
    };
    
    init();
});
