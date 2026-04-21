export class ScheduleMemberDropdownService {
    constructor({
      state,
      elements,
      getMembers,
      onSyncViewHeaderUI,
      onChange,
    }) {
      this.state = state;
      this.elements = elements;
      this.getMembers = getMembers;
      this.onSyncViewHeaderUI = onSyncViewHeaderUI;
      this.onChange = onChange;
    
      this.handleDocumentClick = this.handleDocumentClick.bind(this);
      this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);
    
      this.mode = 'view'; // 'view' or 'edit'
    }
  
    renderOptions() {
      const listEl = this.elements.memberDropdownList;
      const members = this.getMembers();
    
      if (!listEl) return;
    
      listEl.innerHTML = members.map((member) => `
        <button
          type="button"
          class="custom-dropdown__option"
          data-member-id="${member.id}"
          data-member-name="${member.name}"
        >
          ${member.name}
        </button>
      `).join('');
    
      this.bindOptionEvents();
    }

    bindOptionEvents() {
      const listEl = this.elements.memberDropdownList;
      if (!listEl) return;
    
      listEl.querySelectorAll('[data-member-id]').forEach((el) => {
        el.addEventListener('click', async () => {
          const memberId = el.dataset.memberId ?? '';
          const memberName = el.dataset.memberName ?? '';
    
          if (this.mode === 'edit') {
            this.onSelectMember?.(memberId);
          } else {
            await this.onChange?.({ memberId, memberName });
          }
    
          this.close();
        });
      });
    }
  
    open() {
      if (this.state.getIsMemberDropdownOpen()) {
        return;
      }
  
      this.state.openMemberDropdown();
      this.onSyncViewHeaderUI?.();
    }
  
    close() {
      if (!this.state.getIsMemberDropdownOpen()) {
        return;
      }
  
      this.state.closeMemberDropdown();
      this.onSyncViewHeaderUI?.();
    }
  
    toggle() {
      this.state.toggleMemberDropdown();
      this.onSyncViewHeaderUI?.();
    }

    openForEdit() {
      this.mode = 'edit';
      this.state.openMemberDropdown();
      this.renderOptions();
    }
  
    bindGlobalEvents() {
      document.addEventListener('click', this.handleDocumentClick);
      document.addEventListener('keydown', this.handleDocumentKeydown);
    }
  
    handleDocumentClick(event) {
      const dropdown = this.elements.memberDropdown;
  
      if (!this.state.getIsMemberDropdownOpen()) {
        return;
      }
  
      if (!dropdown || dropdown.contains(event.target)) {
        return;
      }
  
      this.close();
    }
  
    handleDocumentKeydown(event) {
      if (event.key !== 'Escape') {
        return;
      }
  
      this.close();
    }
}