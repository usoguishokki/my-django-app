import {
    setAriaExpanded,
  } from '../../../ui/componets/helpers/domState.js';
  
export class ScheduleAsideUiService {
  constructor({ elements }) {
    this.elements = elements;
  }

  bindEvents() {
    this.bindToggle({
      card: this.elements.legend,
      toggle: this.elements.legendToggle,
    });

    this.bindToggle({
      card: this.elements.range,
      toggle: this.elements.rangeToggle,
    });
  }

  bindToggle({ card, toggle }) {
    if (!card || !toggle) {
      return;
    }

    toggle.addEventListener('click', () => {
      this.toggleCard(card, toggle);
    });

    toggle.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      this.toggleCard(card, toggle);
    });
  }

  toggleCard(card, toggle) {
    const isCollapsed = card.classList.toggle('is-collapsed');

    setAriaExpanded(toggle, !isCollapsed);
  }
}