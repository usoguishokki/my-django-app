export class ScheduleActiveDateAliasRenderer {
    constructor({ element }) {
      this.element = element;
    }
  
    render(activeDateAlias) {
      if (!this.element) {
        return;
      }
  
      const label = String(activeDateAlias ?? '').trim();
  
      this.element.textContent = label;
      this.element.hidden = label.length === 0;
    }
  
    clear() {
      if (!this.element) {
        return;
      }
  
      this.element.textContent = '';
      this.element.hidden = true;
    }
}