export class ScheduleTeamDropdownService {
    constructor({ elements }) {
      this.elements = elements;
  
      this.handleDocumentClick = this.handleDocumentClick.bind(this);
      this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);
    }
  
    toggle() {
      const isOpen = this.isOpen();
      this.setOpen(!isOpen);
    }
  
    close() {
      this.setOpen(false);
    }
  
    isOpen() {
      return this.elements.teamDropdown?.dataset?.state === 'open';
    }
  
    setOpen(isOpen) {
      const dropdown = this.elements.teamDropdown;
      const trigger = this.elements.teamDropdownTrigger;
      const panel = this.elements.teamDropdownPanel;
  
      if (!dropdown) {
        return;
      }
  
      dropdown.dataset.state = isOpen ? 'open' : 'closed';
  
      if (trigger) {
        trigger.setAttribute('aria-expanded', String(isOpen));
      }
  
      if (panel) {
        panel.hidden = !isOpen;
      }
    }
  
    bindGlobalEvents() {
      document.addEventListener('click', this.handleDocumentClick);
      document.addEventListener('keydown', this.handleDocumentKeydown);
    }
  
    handleDocumentClick(event) {
      const dropdown = this.elements.teamDropdown;
  
      if (!this.isOpen()) {
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