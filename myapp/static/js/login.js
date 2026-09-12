window.addEventListener('pageshow', function (event) {
    const navEntries = performance.getEntriesByType('navigation');
    const navType = navEntries.length > 0 ? navEntries[0].type : '';
    if (event.persisted || navType === 'back_forward') {
        window.location.reload();
    }
});
