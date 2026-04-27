// static/js/utils/currentUser.js

function getEmployeeElement() {
    return document.getElementById('employeeName');
  }
  
  export function getCurrentUserName() {
    const employee = getEmployeeElement();
  
    if (!employee) {
      return '';
    }
  
    const userProfile = employee.querySelector('#userProfile');
  
    return userProfile?.textContent?.trim() || '';
  }
  
  export function getCurrentUserAffiliationId() {
    const employee = getEmployeeElement();
  
    if (!employee) {
      return '';
    }
  
    return (
      employee.dataset.affiliationId ??
      employee.dataset.affiliation_id ??
      ''
    );
  }
  
  export function getCurrentUserAffiliationName() {
    const employee = getEmployeeElement();
  
    if (!employee) {
      return '';
    }
  
    return employee.dataset.affiliation ?? '';
  }
  
  export function getCurrentUser() {
    return {
      name: getCurrentUserName(),
      affiliationId: getCurrentUserAffiliationId(),
      affiliationName: getCurrentUserAffiliationName(),
    };
  }