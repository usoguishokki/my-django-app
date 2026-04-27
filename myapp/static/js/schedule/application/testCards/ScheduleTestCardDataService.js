export class ScheduleTestCardDataService {
  constructor({
    state,
    dataService,
    getSelectedDate,
    getSelectedDateAlias,
    getSelectedShiftPatternId,
    initialDateAliasOptions = [],
  }) {
    this.state = state;
    this.dataService = dataService;
    this.getSelectedDate = getSelectedDate;
    this.getSelectedDateAlias = getSelectedDateAlias;
    this.getSelectedShiftPatternId = getSelectedShiftPatternId;
    this.initialDateAliasOptions = initialDateAliasOptions;
  }

  getItems() {
    return this.items;
  }

  getDateAliasOptions() {
    return this.dateAliasOptions;
  }

  getActiveDateAlias() {
    return this.activeDateAlias;
  }

  async loadWeek() {
    try {
      const dateAlias = this.getSelectedDateAlias?.() ?? '';
      const shiftPatternId = this.getSelectedShiftPatternId?.() ?? '';
      
      const response = await this.dataService.fetchTestCardsWeek({
        date: this.getSelectedDate?.(),
        dateAlias,
        shiftPatternId,
      });
  
      this.items = response?.data?.items ?? [];
  
      const filterOptions = response?.data?.filterOptions ?? {};
      const responseDateAliasOptions = filterOptions.dateAliases ?? [];
  
      if (
        Array.isArray(responseDateAliasOptions) &&
        responseDateAliasOptions.length > 0
      ) {
        this.dateAliasOptions = responseDateAliasOptions;
      } else {
        this.dateAliasOptions = this.initialDateAliasOptions;
      }
  
      this.activeDateAlias =
        response?.data?.activeDateAlias
        ?? filterOptions.activeDateAlias
        ?? dateAlias
        ?? 'all';
  
      return this.items;
    } catch (error) {
      console.error('[ScheduleTestCardDataService.loadWeek]', error);
  
      this.items = [];
      this.activeDateAlias = 'all';
  
      return this.items;
    }
  }
}