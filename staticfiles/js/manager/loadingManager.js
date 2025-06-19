/**
 * ローディング画面を初期化し、読み込み完了時に非表示にする関数
 */
export const initializeLoadingScreen = () => {
    const loadingScreen = document.getElementById('loading');
    const parentGrid = document.getElementById('parentGrid');
    
    loadingScreen.style.display = 'none'; // ローディング画面を非表示
    parentGrid.style.visibility = 'visible'; // 親グリッドを表示
    if (!loadingScreen || !parentGrid) {
        console.error('ローディング要素が見つかりません');
        return;
    }

    window.addEventListener('load', () => {
        hideLoadingScreen(loadingScreen, parentGrid);
    });

};


/**
 * ローディング画面を非表示にして親グリッドを表示する
 * @param {HTMLElement} loadingScreen - ローディング画面の要素
 * @param {HTMLElement} parentGrid - 親グリッドの要素
 */
const hideLoadingScreen = (loadingScreen, parentGrid) => {
    //フェード開始
    loadingScreen.classList.remove('loading-active');
    loadingScreen.classList.add('loading-hidden');

    setTimeout(() => {
        loadingScreen.style.display = 'none'; // ローディング画面を非表示
        parentGrid.style.visibility = 'visible'; // 親グリッドを表示
    }, 700);
};

/**
 * 指定のクラスのリンクをクリックしたときにローディングを表示する
 * @param {string} selector - 対象とするリンクのcssセレクタ
 */

export const setupLoadingOnLinkClick = (selector = 'a.loading-link') => {
    const loading = document.getElementById('loading');
    if (!loading) return;

    document.querySelectorAll(selector).forEach(anchor => {
        anchor.addEventListener('click', event => {
            const href = anchor.getAttribute('href');
            if (!href || href.startsWith('#') || anchor.target === '_blank') return;

            loading.style.display = 'flex';

            requestAnimationFrame(() => {
                loading.classList.add('loading-active');
                loading.classList.remove('loading-hidden');
            });
        });
    });
}