import { formatDate } from '../../utils/dateTime.js';

export class ScheduleState {
  static VIEW_MODES = {
    TEAM_DAY: 'team-day',
    MEMBER_WEEK: 'member-week',
  };

  constructor(baseDate = new Date(), initialTeam = '', initialAffiliationId) {
    this.selectedDate = formatDate(baseDate);
    this.selectedTeam = initialTeam;
    this.selectedAffiliationId = initialAffiliationId ?? '';

    this.visibleHours = 2;
    this.teamSchedules = [];
  
    this.viewMode = 'team-day';
    this.selectedMemberId = '';
    this.selectedMemberName = '';
  
    this.isDrawerOpen = false;
    this.activePanelId = '';
  
    this.isFilterPaneOpen = false;
    this.selectedTestCardCaseKey = 'all';
    this.selectedTestCardInspectionType = 'all';
    this.selectedTestCardTimeZone = 'all';
    this.selectedTestCardProcessName = 'all';
    this.selectedTestCardMachineName = 'all';

    this.isTestCardMachinePickerOpen = false;
    this.isTestCardCasePickerOpen = false;
  
    this.isMemberDropdownOpen = false;
    this.currentMemberWeekDate = this.selectedDate;
  
    this.isMoveMode = false;

    this.activeTestCardFilterKey = '';

    this.activeDateAlias = '';
    this.dateAliasOptions = [];
    this.selectedTestCardDateAlias = '';

    this.selectedTestCardTeamKey = '';

    this.selectedTestCardAffiliationId = '';

    this.testCardTeamOptions = [];
  }

  setBaseDate(date) {
    this.baseDate = date;
  }

  getBaseDate() {
    return this.baseDate;
  }

  setMemberDropdownOpen(isOpen) {
    this.isMemberDropdownOpen = Boolean(isOpen);
  }
  
  getIsMemberDropdownOpen() {
    return this.isMemberDropdownOpen;
  }
  
  openMemberDropdown() {
    this.setMemberDropdownOpen(true);
  }
  
  closeMemberDropdown() {
    this.setMemberDropdownOpen(false);
  }
  
  toggleMemberDropdown() {
    this.setMemberDropdownOpen(!this.getIsMemberDropdownOpen());
  }

  setSelectedAffiliationId(affiliationId) {
    this.selectedAffiliationId = affiliationId ?? '';
  }

  getSelectedAffiliationId() {
    return this.selectedAffiliationId;
  }

  setSelectedDate(date) {
    this.selectedDate = date;
  }

  getSelectedDate() {
    return this.selectedDate;
  }

  setSelectedTeam(team) {
    this.selectedTeam = team;
  }

  getSelectedTeam() {
    return this.selectedTeam;
  }

  setVisibleHours(hours) {
    this.visibleHours = this.normalizeVisibleHours(hours);
  }

  getVisibleHours() {
    return this.visibleHours;
  }

  setTeamSchedules(teamSchedules) {
    this.teamSchedules = Array.isArray(teamSchedules) ? teamSchedules : [];
  }

  getTeamSchedules() {
    return this.teamSchedules;
  }

  setDrawerOpen(isOpen) {
    this.isDrawerOpen = Boolean(isOpen);
  }

  getIsDrawerOpen() {
    return this.isDrawerOpen;
  }

  setActivePanelId(panelId) {
    this.activePanelId = panelId ?? '';
  }

  getActivePanelId() {
    return this.activePanelId;
  }

  openDrawer(panelId) {
    this.setDrawerOpen(true);
    this.setActivePanelId(panelId);
  }

  closeDrawer() {
    this.setDrawerOpen(false);
    this.setActivePanelId('');
  }

  toggleDrawer(panelId) {
    const nextPanelId = panelId ?? '';
    const isSamePanel =
      this.getIsDrawerOpen() &&
      this.getActivePanelId() === nextPanelId;

    if (isSamePanel) {
      this.closeDrawer();
      return;
    }

    this.openDrawer(nextPanelId);
  }

  setFilterPaneOpen(isOpen) {
    this.isFilterPaneOpen = Boolean(isOpen);
  }
  
  getIsFilterPaneOpen() {
    return this.isFilterPaneOpen;
  }
  
  openFilterPane() {
    this.setFilterPaneOpen(true);
  }
  
  closeFilterPane() {
    this.setFilterPaneOpen(false);
  }
  
  toggleFilterPane() {
    this.setFilterPaneOpen(!this.getIsFilterPaneOpen());
    return this.getIsFilterPaneOpen();
  }

  setViewMode(viewMode) {
    const allowedViewModes = Object.values(ScheduleState.VIEW_MODES);

    this.viewMode = allowedViewModes.includes(viewMode)
      ? viewMode
      : ScheduleState.VIEW_MODES.TEAM_DAY;
  }

  getViewMode() {
    return this.viewMode;
  }

  isTeamDayView() {
    return this.viewMode === ScheduleState.VIEW_MODES.TEAM_DAY;
  }

  isMemberWeekView() {
    return this.viewMode === ScheduleState.VIEW_MODES.MEMBER_WEEK;
  }

  setSelectedMemberId(memberId) {
    this.selectedMemberId = memberId ?? '';
  }

  getSelectedMemberId() {
    return this.selectedMemberId;
  }

  setSelectedMemberName(memberName) {
    this.selectedMemberName = memberName ?? '';
  }
  
  getSelectedMemberName() {
    return this.selectedMemberName;
  }

  showTeamDayView() {
    this.setViewMode(ScheduleState.VIEW_MODES.TEAM_DAY);
    this.setSelectedMemberId('');
    this.setSelectedMemberName('');
    this.closeMemberDropdown();
  }

  showMemberWeekView(memberId, memberName = '') {
    this.setViewMode(ScheduleState.VIEW_MODES.MEMBER_WEEK);
    this.setSelectedMemberId(memberId);
    this.setSelectedMemberName(memberName);
    this.closeMemberDropdown();
  }

  normalizeVisibleHours(hours) {
    const value = Number(hours);
    const allowedHours = [2, 4, 8];

    return allowedHours.includes(value) ? value : 2;
  }

  moveDay(delta) {
    const current = new Date(`${this.selectedDate}T00:00:00`);
    current.setDate(current.getDate() + delta);
    this.selectedDate = formatDate(current);
  }

  setMoveMode(isMoveMode) {
    this.isMoveMode = Boolean(isMoveMode);
  }
  
  getIsMoveMode() {
    return this.isMoveMode;
  }
  
  enableMoveMode() {
    this.setMoveMode(true);
  }
  
  disableMoveMode() {
    this.setMoveMode(false);
  }
  
  toggleMoveMode() {
    this.setMoveMode(!this.getIsMoveMode());
    return this.getIsMoveMode();
  }

  setSelectedTestCardCaseKey(caseKey) {
    this.selectedTestCardCaseKey = caseKey ?? 'all';
  }

  setSelectedTestCardInspectionType(inspectionType) {
    this.selectedTestCardInspectionType = inspectionType
      ? String(inspectionType)
      : 'all';
  }
  
  getSelectedTestCardInspectionType() {
    return this.selectedTestCardInspectionType;
  }

  setSelectedTestCardTimeZone(timeZone) {
    this.selectedTestCardTimeZone = timeZone
      ? String(timeZone)
      : 'all';
  }
  
  getSelectedTestCardTimeZone() {
    return this.selectedTestCardTimeZone;
  }

  getSelectedTestCardCaseKey() {
    return this.selectedTestCardCaseKey;
  }

  setTestCardCasePickerOpen(isOpen) {
    this.isTestCardCasePickerOpen = Boolean(isOpen);
  }
  
  getIsTestCardCasePickerOpen() {
    return this.isTestCardCasePickerOpen;
  }
  
  openTestCardCasePicker() {
    this.setTestCardCasePickerOpen(true);
  }
  
  closeTestCardCasePicker() {
    this.setTestCardCasePickerOpen(false);
  }
  
  toggleTestCardCasePicker() {
    this.setTestCardCasePickerOpen(!this.getIsTestCardCasePickerOpen());
    return this.getIsTestCardCasePickerOpen();
  }

  setSelectedTestCardProcessName(processName) {
    this.selectedTestCardProcessName = processName
      ? String(processName)
      : 'all';
  }
  
  getSelectedTestCardProcessName() {
    return this.selectedTestCardProcessName;
  }

  setSelectedTestCardMachineName(machineName) {
    this.selectedTestCardMachineName = machineName
      ? String(machineName)
      : 'all';
  }
  
  getSelectedTestCardMachineName() {
    return this.selectedTestCardMachineName;
  }

  setTestCardMachinePickerOpen(isOpen) {
    this.isTestCardMachinePickerOpen = Boolean(isOpen);
  }
  
  getIsTestCardMachinePickerOpen() {
    return this.isTestCardMachinePickerOpen;
  }
  
  openTestCardMachinePicker() {
    this.setTestCardMachinePickerOpen(true);
  }
  
  closeTestCardMachinePicker() {
    this.setTestCardMachinePickerOpen(false);
  }
  
  toggleTestCardMachinePicker() {
    this.setTestCardMachinePickerOpen(!this.getIsTestCardMachinePickerOpen());
    return this.getIsTestCardMachinePickerOpen();
  }

  setActiveTestCardFilterKey(filterKey = '') {
    this.activeTestCardFilterKey = filterKey ? String(filterKey) : '';
  }
  
  getActiveTestCardFilterKey() {
    return this.activeTestCardFilterKey;
  }
  
  openTestCardFilter(filterKey) {
    this.setActiveTestCardFilterKey(filterKey);
  }
  
  closeActiveTestCardFilter() {
    this.setActiveTestCardFilterKey('');
  }
  
  toggleTestCardFilter(filterKey) {
    const normalizedKey = filterKey ? String(filterKey) : '';
  
    if (!normalizedKey) {
      this.closeActiveTestCardFilter();
      return '';
    }
  
    if (this.getActiveTestCardFilterKey() === normalizedKey) {
      this.closeActiveTestCardFilter();
      return '';
    }
  
    this.openTestCardFilter(normalizedKey);
    return normalizedKey;
  }
  
  isTestCardFilterOpen(filterKey) {
    return this.getActiveTestCardFilterKey() === String(filterKey);
  }

  setActiveDateAlias(activeDateAlias = '') {
    this.activeDateAlias = activeDateAlias || '';
  }
  
  getActiveDateAlias() {
    return this.activeDateAlias;
  }
  
  setSelectedTestCardDateAlias(dateAlias = '') {
    this.selectedTestCardDateAlias = dateAlias || '';
  }
  
  getSelectedTestCardDateAlias() {
    return this.selectedTestCardDateAlias || this.activeDateAlias || '';
  }
  
  setTestCardTeamOptions(teamOptions = []) {
    this.testCardTeamOptions = Array.isArray(teamOptions)
      ? teamOptions
      : [];
  }
  
  getTestCardTeamOptions() {
    return this.testCardTeamOptions;
  }

  setSelectedTestCardTeamKey(teamKey) {
    this.selectedTestCardTeamKey = teamKey;
  }

  setDateAliasOptions(dateAliasOptions = []) {
    this.dateAliasOptions = Array.isArray(dateAliasOptions)
      ? dateAliasOptions
      : [];
  }
  
  getDateAliasOptions() {
    return this.dateAliasOptions;
  }

  getSelectedTestCardTeamKey() {
    return this.selectedTestCardTeamKey;
  }

  setSelectedTestCardAffiliationId(affiliationId) {
    this.selectedTestCardAffiliationId = String(affiliationId ?? '');
  }
  
  getSelectedTestCardAffiliationId() {
    return this.selectedTestCardAffiliationId;
  }

  getSelectedTestCardShiftPatternId() {
    const selectedAffiliationId =
      this.getSelectedTestCardAffiliationId?.() ?? '';
  
    if (!selectedAffiliationId) {
      return '';
    }
  
    const teamOptions = this.getTestCardTeamOptions?.() ?? [];
  
    if (!Array.isArray(teamOptions) || teamOptions.length === 0) {
      return '';
    }
  
    const selectedTeam = teamOptions.find(
      (team) =>
        String(team.affiliationId ?? '') === String(selectedAffiliationId)
    );
  
    return String(selectedTeam?.shiftPatternId ?? '');
  }
}