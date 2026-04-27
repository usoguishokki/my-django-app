export function setClassState(element, className, isEnabled) {
    if (!element || !className) {
      return;
    }
  
    element.classList.toggle(className, Boolean(isEnabled));
  }
  
  export function setAriaPressed(element, isPressed) {
    if (!element) {
      return;
    }
  
    element.setAttribute('aria-pressed', String(Boolean(isPressed)));
  }
  
  export function setAriaExpanded(element, isExpanded) {
    if (!element) {
      return;
    }
  
    element.setAttribute('aria-expanded', String(Boolean(isExpanded)));
  }
  
  export function setAriaHidden(element, isHidden) {
    if (!element) {
      return;
    }
  
    element.setAttribute('aria-hidden', String(Boolean(isHidden)));
  }
  
  export function setHidden(element, isHidden) {
    if (!element) {
      return;
    }
  
    element.hidden = Boolean(isHidden);
  }
  
  export function setDatasetValue(element, key, value) {
    if (!element || !key) {
      return;
    }
  
    element.dataset[key] = String(value);
  }
  
  export function setActivePressedState(
    element,
    isActive,
    activeClassName = 'is-active'
  ) {
    setClassState(element, activeClassName, isActive);
    setAriaPressed(element, isActive);
  }

  export function setDisabledState(element, isDisabled) {
    if (!element) {
      return;
    }
  
    element.disabled = Boolean(isDisabled);
    element.setAttribute('aria-disabled', String(Boolean(isDisabled)));
  }