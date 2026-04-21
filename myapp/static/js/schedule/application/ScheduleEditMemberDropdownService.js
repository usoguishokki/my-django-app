export class ScheduleEditMemberDropdownService {
    constructor({ elements, getMembers, onChange }) {
      this.elements = elements;
      this.getMembers = getMembers;
      this.onChange = onChange;
  
      this.isOpen = false;
  
      this.handleOutsideClick = this.handleOutsideClick.bind(this);
      this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);
    }
  
    getParts() {
      const summaryRoot = this.elements?.editAfterSummary;
      const rootEl = summaryRoot?.querySelector('[data-role="edit-member-dropdown"]');
      const panelEl = rootEl?.querySelector('[data-role="edit-member-dropdown-panel"]');
      const listEl = rootEl?.querySelector('[data-role="edit-member-dropdown-list"]');
  
      return { rootEl, panelEl, listEl };
    }
  
    open() {
      this.isOpen = true;
      this.render();
      this.show();
      this.syncPickingState();
      document.addEventListener('click', this.handleOutsideClick);
      document.addEventListener('keydown', this.handleDocumentKeydown);
    }
  
    close() {
      this.isOpen = false;
      this.hide();
      this.syncPickingState();
      document.removeEventListener('click', this.handleOutsideClick);
      document.removeEventListener('keydown', this.handleDocumentKeydown);
    }
  
    toggle() {
      this.isOpen ? this.close() : this.open();
    }
  
    render() {
      const { listEl } = this.getParts();
      const members = this.getMembers();
  
      if (!listEl) return;
  
      listEl.innerHTML = members.map((member) => `
        <button
          type="button"
          class="custom-dropdown__option"
          data-member-id="${member.id}"
        >
          ${member.name}
        </button>
      `).join('');
  
      this.bindOptionEvents();
    }
  
    bindOptionEvents() {
      const { listEl } = this.getParts();
      if (!listEl) return;
  
      listEl.querySelectorAll('[data-member-id]').forEach((el) => {
        el.addEventListener('click', () => {
          const memberId = el.dataset.memberId;
          this.onChange?.({ memberId });
          this.close();
        });
      });
    }
  
    show() {
      const { rootEl, panelEl } = this.getParts();
      if (!rootEl || !panelEl) return;
  
      rootEl.dataset.state = 'open';
      panelEl.hidden = false;
    }
  
    hide() {
      const { rootEl, panelEl } = this.getParts();
      if (!rootEl || !panelEl) return;
  
      rootEl.dataset.state = 'closed';
      panelEl.hidden = true;
    }
  
    handleOutsideClick(event) {
      const { rootEl } = this.getParts();
      if (!rootEl || rootEl.contains(event.target)) return;
      this.close();
    }
  
    sync() {
      if (!this.isOpen) return;
      this.render();
      this.show();
      this.syncPickingState();
    }

    syncPickingState() {
      const summaryRoot = this.elements?.editAfterSummary;
      const afterCard = summaryRoot?.closest('[data-role="schedule-edit-after"]');
    
      if (!afterCard) return;
    
      afterCard.classList.toggle('is-member-picking', this.isOpen);
    }

    handleDocumentKeydown(event) {
      if (event.key !== 'Escape' || !this.isOpen) return;
      this.close();
    }
}