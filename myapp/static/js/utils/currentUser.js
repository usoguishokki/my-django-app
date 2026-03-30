// static/js/utils/currentUser.js
export function getCurrentUserName() {
    const employee = document.getElementById('employeeName');
    if (!employee) return '';

    const userProfile = employee.querySelector('#userProfile');
    return userProfile?.textContent?.trim() || '';
}