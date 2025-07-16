// public/js/validate.js
// Handles client-side interactions for the validate.ejs page.

document.addEventListener('DOMContentLoaded', () => {
    const promptTextarea = document.getElementById('prompt-textarea');
    const saveBtn = document.getElementById('save-prompt-btn');
    const resetBtn = document.getElementById('reset-prompt-btn');
    const feedbackDiv = document.getElementById('action-feedback');

    // Confirmation Modal Elements
    const confirmModal = document.getElementById('confirm-modal');
    const confirmActionBtn = document.getElementById('confirm-action-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const confirmModalTitle = document.getElementById('confirm-modal-title');
    const confirmModalMessage = document.getElementById('confirm-modal-message');
    let confirmCallback = null;

    const toggleButtonLoading = (button, isLoading, loadingText = 'Loading...') => {
        if (!button) return;
        const icon = button.querySelector('.btn-icon');
        const text = button.querySelector('.btn-text');
        button.disabled = isLoading;

        if (isLoading) {
            if (icon) icon.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i>';
            if (text) text.textContent = loadingText;
        } else {
            if (icon) icon.innerHTML = `<i data-lucide="${button.dataset.icon || 'save'}" class="w-4 h-4"></i>`;
            if (text) text.textContent = button.dataset.originalText || 'Submit';
        }
        lucide.createIcons();
    };

    const showFeedback = (message, isError = false) => {
        feedbackDiv.textContent = message;
        feedbackDiv.className = `mt-4 text-sm font-medium h-5 ${isError ? 'text-red-500' : 'text-green-500'}`;
        setTimeout(() => {
            feedbackDiv.textContent = '';
        }, 3000);
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

    const fetchPrompt = async () => {
        try {
            const data = await fetch('/api/get-validation-prompt').then(res => res.json());
            if (data.error) {
                throw new Error(data.error);
            }
            promptTextarea.value = data.prompt;
        } catch (error) {
            promptTextarea.value = "Error loading prompt.";
            showFeedback(error.message, true);
        }
    };

    const savePrompt = async () => {
        toggleButtonLoading(saveBtn, true, 'Saving...');
        const prompt = promptTextarea.value;
        try {
            const data = await fetch('/api/save-validation-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            }).then(res => res.json());

            if (data.error) {
                throw new Error(data.error);
            }
            showFeedback('Prompt saved successfully!');
        } catch (error) {
            showFeedback(error.message, true);
        } finally {
            toggleButtonLoading(saveBtn, false);
        }
    };

    const performReset = async () => {
        toggleButtonLoading(resetBtn, true, 'Resetting...');
        try {
            const data = await fetch('/api/reset-validation-prompt', {
                method: 'POST'
            }).then(res => res.json());

            if (data.error) {
                throw new Error(data.error);
            }
            promptTextarea.value = data.prompt;
            showFeedback('Prompt has been reset to default.');
        } catch (error) {
            showFeedback(error.message, true);
        } finally {
            toggleButtonLoading(resetBtn, false);
            hideConfirmModal();
        }
    };

    saveBtn.addEventListener('click', savePrompt);
    resetBtn.addEventListener('click', () => {
        showConfirmModal(
            'Reset to Default?',
            'Are you sure you want to reset the prompt to its default version? This will discard any custom changes.',
            performReset
        );
    });

    confirmCancelBtn.addEventListener('click', hideConfirmModal);
    confirmActionBtn.addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
        }
    });

    fetchPrompt();
});
