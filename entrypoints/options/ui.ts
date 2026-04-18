export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) =>
    ch === '&'
      ? '&amp;'
      : ch === '<'
      ? '&lt;'
      : ch === '>'
      ? '&gt;'
      : ch === '"'
      ? '&quot;'
      : '&#39;',
  );
}

export function randomId(): string {
  return (
    'id-' +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  );
}

type ModalArgs = {
  title: string;
  body: HTMLElement;
  onSave?: () => Promise<void> | void;
  saveLabel?: string;
};

export function openModal({
  title,
  body,
  onSave,
  saveLabel = 'Save',
}: ModalArgs): () => void {
  const root = document.getElementById('modal-root')!;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<h2>${escapeHtml(title)}</h2>`;
  modal.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  const save = document.createElement('button');
  save.textContent = saveLabel;
  save.className = 'primary';
  actions.append(cancel, save);
  modal.appendChild(actions);
  backdrop.appendChild(modal);
  root.appendChild(backdrop);

  const close = () => {
    root.removeChild(backdrop);
  };
  cancel.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  save.addEventListener('click', async () => {
    try {
      await onSave?.();
      close();
    } catch (err) {
      alert(String(err));
    }
  });
  return close;
}

export function confirmDialog(message: string): boolean {
  return confirm(message);
}
