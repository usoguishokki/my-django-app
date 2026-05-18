import { UIManger } from '../../../manager/UIManger.js';

export class ScheduleBulkRegistrationMemberDropdownService {
  constructor({
    elements,
    getMembers,
    getSelectedMemberId,
    onChange,
  }) {
    this.elements = elements;
    this.getMembers = getMembers;
    this.getSelectedMemberId = getSelectedMemberId;
    this.onChange = onChange;

    this.isOpen = false;

    this.handleOutsideClick = this.handleOutsideClick.bind(this);
    this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);
  }

  getParts() {
    const searchRoot = this.elements?.root ?? document;
  
    const rootEl = searchRoot.querySelector(
      '[data-role="bulk-registration-member-dropdown"]'
    );
  
    const triggerEl = rootEl?.querySelector(
      '[data-ui-action="schedule:toggle-bulk-registration-member-dropdown"]'
    );
  
    const valueEl = rootEl?.querySelector(
      '[data-role="bulk-registration-member-value"]'
    );
  
    const labelEl = rootEl?.querySelector(
      '[data-role="bulk-registration-member-label"]'
    );
  
    const panelEl = rootEl?.querySelector(
      '[data-role="bulk-registration-member-dropdown-panel"]'
    );
  
    const listEl = rootEl?.querySelector(
      '[data-role="bulk-registration-member-dropdown-list"]'
    );
  
    return {
      rootEl,
      triggerEl,
      valueEl,
      labelEl,
      panelEl,
      listEl,
    };
  }
  
  open() {
    this.isOpen = true;
    this.render();
    this.show();

    document.addEventListener('click', this.handleOutsideClick);
    document.addEventListener('keydown', this.handleDocumentKeydown);
  }

  close() {
    this.isOpen = false;
    this.hide();

    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('keydown', this.handleDocumentKeydown);
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  render() {
    const { listEl } = this.getParts();

    if (!listEl) {
      return;
    }

    const members = this.getMembers?.() ?? [];
    const selectedMemberId = String(this.getSelectedMemberId?.() ?? '');

    listEl.innerHTML = members.map((member) => {
      const memberId = String(member?.id ?? '');
      const memberName = String(member?.name ?? '');
      const isActive = memberId === selectedMemberId;

      return `
        <button
          type="button"
          class="custom-dropdown__option ${isActive ? 'is-active' : ''}"
          data-member-id="${UIManger.escapeHtml(memberId)}"
          data-member-name="${UIManger.escapeHtml(memberName)}"
        >
          ${UIManger.escapeHtml(memberName)}
        </button>
      `;
    }).join('');

    this.bindOptionEvents();
  }

  bindOptionEvents() {
    const { listEl } = this.getParts();

    if (!listEl) {
      return;
    }

    listEl.querySelectorAll('[data-member-id]').forEach((optionEl) => {
      optionEl.addEventListener('click', () => {
        const memberId = optionEl.dataset.memberId ?? '';
        const memberName = optionEl.dataset.memberName ?? '';

        this.onChange?.({
          memberId,
          memberName,
        });

        this.close();
      });
    });
  }

  syncSelection({ memberId = '', memberName = '' } = {}) {
    const { valueEl, labelEl } = this.getParts();

    if (valueEl) {
      valueEl.value = String(memberId ?? '');
    }

    if (labelEl) {
      labelEl.textContent = memberName || '選択してください';
    }
  }

  show() {
    const { rootEl, triggerEl, panelEl } = this.getParts();

    if (!rootEl || !panelEl) {
      return;
    }

    rootEl.dataset.state = 'open';
    panelEl.hidden = false;

    if (triggerEl) {
      triggerEl.setAttribute('aria-expanded', 'true');
    }
  }

  hide() {
    const { rootEl, triggerEl, panelEl } = this.getParts();

    if (!rootEl || !panelEl) {
      return;
    }

    rootEl.dataset.state = 'closed';
    panelEl.hidden = true;

    if (triggerEl) {
      triggerEl.setAttribute('aria-expanded', 'false');
    }
  }

  handleOutsideClick(event) {
    const { rootEl } = this.getParts();

    if (!rootEl || rootEl.contains(event.target)) {
      return;
    }

    this.close();
  }

  handleDocumentKeydown(event) {
    if (event.key !== 'Escape' || !this.isOpen) {
      return;
    }

    this.close();
  }
}