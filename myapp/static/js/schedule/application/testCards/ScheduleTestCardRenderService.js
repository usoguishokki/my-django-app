import { renderScheduleTestCardsHTML } from '../../../ui/renderers/scheduleTestCardsRenderer.js';

export class ScheduleTestCardRenderService {
  constructor({ elements, filterService }) {
    this.elements = elements;
    this.filterService = filterService;
  }

  renderFilterPane() {
    this.renderDrawerPanelTitle();
  
    const container = this.elements.testCardFilterBody;
  
    if (!container) {
      return;
    }
  
    this.renderFilterPaneHeader();
  
    container.innerHTML = this.filterService.renderFilterPaneBody();
  }
  renderFilterPaneHeader() {
    const titleElement = this.elements.testCardFilterTitle;

    if (!titleElement) {
      return;
    }

    titleElement.textContent = this.filterService.getFilterPaneTitle();
  }

  renderDrawerPanelTitle() {
    const titleElement = this.elements.testCardsPanelTitle;
  
    if (!titleElement) {
      return;
    }
  
    const filterSummary = this.filterService.getDrawerPanelFilterSummary();
  
    titleElement.replaceChildren(
      this.createDrawerPanelTitleMain(),
      this.createDrawerPanelTitleMeta(filterSummary)
    );
  }

  createDrawerPanelTitleMain() {
    const element = document.createElement('span');
    element.className = 'schedule-page__drawerPanelTitleMain';
    element.textContent = 'カード';
  
    return element;
  }
  
  createDrawerPanelTitleMeta(filterSummary = '') {
    const element = document.createElement('span');
    element.className = 'schedule-page__drawerPanelTitleMeta';
    element.textContent = filterSummary || 'フィルターなし';
  
    return element;
  }

  renderPanel() {
    this.renderDrawerPanelTitle();
  
    const container = this.elements.testCardsPanelBody;
  
    if (!container) {
      return;
    }
  
    const filteredItems = this.filterService.getFilteredItems();
  
    container.innerHTML = `
      <div class="schedule-page__testCardListSection">
        ${renderScheduleTestCardsHTML(filteredItems)}
      </div>
    `;
  }

  renderAll() {
    this.renderDrawerPanelTitle();
    this.renderFilterPane();
    this.renderPanel();
  }
}