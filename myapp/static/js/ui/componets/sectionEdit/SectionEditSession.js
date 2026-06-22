export class SectionEditSession {
    constructor() {
      this.reset();
    }
  
    reset() {
      this.context = {};
      this.sections = [];
      this.selectedSectionId = '';
    }
  
    start({
      context = {},
      sections = [],
      selectedSectionId = '',
    } = {}) {
      this.context = { ...context };
      this.sections = this.normalizeSections(sections);
      this.selectedSectionId = '';
  
      if (selectedSectionId) {
        this.select(selectedSectionId);
      }
    }
  
    isActive() {
      return this.sections.length > 0;
    }
  
    getContext() {
      return { ...this.context };
    }
  
    getSections() {
      return this.sections.map((section) => ({ ...section }));
    }
  
    getSelectedSectionId() {
      return this.selectedSectionId;
    }
  
    getSelectedSection() {
      if (!this.selectedSectionId) {
        return null;
      }
  
      const section = this.sections.find(
        (item) => item.id === this.selectedSectionId
      );
  
      return section ? { ...section } : null;
    }
  
    select(sectionId) {
      const normalizedSectionId = SectionEditSession.normalizeId(sectionId);
  
      if (!normalizedSectionId) {
        this.selectedSectionId = '';
        return null;
      }
  
      const exists = this.sections.some(
        (section) => section.id === normalizedSectionId
      );
  
      if (!exists) {
        this.selectedSectionId = '';
        return null;
      }
  
      this.selectedSectionId = normalizedSectionId;
  
      return this.getSelectedSection();
    }
  
    updateSection(sectionId, patch = {}) {
      const normalizedSectionId = SectionEditSession.normalizeId(sectionId);
  
      if (!normalizedSectionId) {
        return null;
      }
  
      this.sections = this.sections.map((section) => {
        if (section.id !== normalizedSectionId) {
          return section;
        }
  
        return {
          ...section,
          ...patch,
          id: section.id,
        };
      });
  
      if (this.selectedSectionId === normalizedSectionId) {
        return this.getSelectedSection();
      }
  
      return this.sections.find(
        (section) => section.id === normalizedSectionId
      ) ?? null;
    }
  
    updateSelectedSection(patch = {}) {
      if (!this.selectedSectionId) {
        return null;
      }
  
      return this.updateSection(this.selectedSectionId, patch);
    }
  
    normalizeSections(sections) {
      if (!Array.isArray(sections)) {
        return [];
      }
  
      return sections.map((section, index) => {
        const fallbackId = `section-${index + 1}`;
        const id = SectionEditSession.normalizeId(
          section?.id ?? section?.sectionId ?? fallbackId
        );
  
        return {
          ...section,
          id,
        };
      });
    }
  
    static normalizeId(value) {
      return String(value ?? '').trim();
    }
}