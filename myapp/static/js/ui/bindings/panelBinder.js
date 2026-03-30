export const panelBinder = {
    setTitle(el, text) {
      if (el) el.textContent = text;
    },
  
    setBodyHTML(el, html) {
      if (el) el.innerHTML = html;
    },
  
    showLoading(titleEl, bodyEl, title) {
      this.setTitle(titleEl, title);
      this.setBodyHTML(bodyEl, 'データを読み込んでいます…');
    },
  
    showError(titleEl, bodyEl) {
      this.setTitle(titleEl, '読み込みエラー');
      this.setBodyHTML(bodyEl, 'データの取得に失敗しました。');
    },
};