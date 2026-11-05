const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'color', 'file']);

export const isEditableTarget = (target) => {
    if (!target || typeof target.closest !== 'function') return false;
    const field = target.closest('input, textarea, select, [contenteditable="true"]');
    if (!field) return false;

    // A focused range/checkbox isn't a text-editing context: app shortcuts
    // such as undo and save should still work there.
    if (String(field.tagName).toLowerCase() === 'input' && NON_TEXT_INPUTS.has(field.type)) {
        return false;
    }

    return true;
};
