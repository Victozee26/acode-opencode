export interface ConfirmModalConfig {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function createConfirmModal(config: ConfirmModalConfig): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'opencode-confirm-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'opencode-confirm-dialog';

  const message = document.createElement('p');
  message.className = 'opencode-confirm-message';
  message.textContent = config.message;
  dialog.appendChild(message);

  const actions = document.createElement('div');
  actions.className = 'opencode-confirm-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'opencode-confirm-btn opencode-confirm-btn--cancel';
  cancelBtn.textContent = config.cancelLabel ?? 'Cancel';
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    config.onCancel();
  });
  actions.appendChild(cancelBtn);

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'opencode-confirm-btn opencode-confirm-btn--confirm';
  confirmBtn.textContent = config.confirmLabel ?? 'Reinstall';
  confirmBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    config.onConfirm();
  });
  actions.appendChild(confirmBtn);

  dialog.appendChild(actions);
  overlay.appendChild(dialog);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      config.onCancel();
    }
  });

  return overlay;
}
