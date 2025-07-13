// public/js/stories.js
// Handles client-side interactions for the stories.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const audioModal = document.getElementById('audio-modal');
    const audioPlayer = document.getElementById('audio-player');
    const closeAudioModalBtn = document.getElementById('close-audio-modal-btn');

    // --- EVENT LISTENERS ---

    // Event delegation for play audio buttons
    document.body.addEventListener('click', (e) => {
        const playBtn = e.target.closest('.play-audio-btn');
        if (playBtn) {
            const audioSrc = playBtn.dataset.audioSrc;
            if (audioSrc) {
                playAudio(audioSrc);
            }
        }
    });

    // Event delegation for "Show More/Less" buttons
    document.body.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.show-more-btn');
        if (toggleBtn) {
            toggleTextExpansion(toggleBtn);
        }
    });

    // Close audio modal
    if (closeAudioModalBtn) {
        closeAudioModalBtn.addEventListener('click', () => {
            audioModal.classList.add('hidden');
            audioPlayer.pause();
            audioPlayer.src = '';
        });
    }

    // --- FUNCTIONS ---

    /**
     * Plays an audio file in the modal.
     * @param {string} src - The source URL of the audio file.
     */
    const playAudio = (src) => {
        if (audioPlayer && audioModal) {
            audioPlayer.src = src;
            audioModal.classList.remove('hidden');
            audioPlayer.play();
        }
    };

    /**
     * Toggles the expansion of text content.
     * @param {HTMLElement} button - The "Show More/Less" button that was clicked.
     */
    const toggleTextExpansion = (button) => {
        const container = button.parentElement;
        const textElement = container.querySelector('.truncated-text');
        const fullText = container.dataset.fullText;
        
        container.classList.toggle('expanded');

        if (container.classList.contains('expanded')) {
            textElement.textContent = fullText;
            button.textContent = 'Show Less';
        } else {
            textElement.textContent = getTruncatedText(fullText);
            button.textContent = 'Show More';
        }
    };

    /**
     * Truncates text to a specified length.
     * @param {string} text - The full text to truncate.
     * @param {number} [length=100] - The maximum length of the truncated text.
     * @returns {string} The truncated text.
     */
    const getTruncatedText = (text, length = 100) => {
        if (text.length <= length) {
            return text;
        }
        return text.substring(0, length) + '...';
    };

    /**
     * Initializes all expandable text areas on the page.
     */
    const initializeExpandableText = () => {
        document.querySelectorAll('.expandable-text').forEach(container => {
            const fullText = container.dataset.fullText;
            const textElement = container.querySelector('.truncated-text');
            const button = container.querySelector('.show-more-btn');
            
            if (fullText.length > 100) {
                textElement.textContent = getTruncatedText(fullText);
                button.classList.remove('hidden');
            } else {
                textElement.textContent = fullText;
                button.classList.add('hidden');
            }
        });
    };

    // --- INITIALIZATION ---
    initializeExpandableText();
    lucide.createIcons();
});
