/**
 * ローディング画面を初期化し、読み込み完了時に非表示にする関数
 */
export const initializeLoadingScreen = () => {
    const loadingScreen = document.getElementById('loading');
    const parentGrid = document.getElementById('parentGrid');

    if (!loadingScreen || !parentGrid) {
        console.error('ローディング要素が見つかりません');
        return;
    }
    
    loadingScreen.style.display = 'none'; // ローディング画面を非表示
    parentGrid.style.visibility = 'visible'; // 親グリッドを表示

    window.addEventListener('load', hideLoadingScreen);
};


/**
 * ローディング画面を非表示にして親グリッドを表示する
 * 
 */
const hideLoadingScreen = () => {
    const loading = document.getElementById('loading');
    const parentGrid = document.getElementById('parentGrid');
    if (!!loading || !!parentGrid) return;

    loading.classList.remove('loading-active');
    loading.classList.add('loading-hidden');

    setTimeout(() => {
        loading.style.display = 'none'; // ローディング画面を非表示
        parentGrid.style.visibility = 'visible'; // 親グリッドを表示
    }, 700);
};

/**
 * 指定のクラスのリンクをクリックしたときにローディングを表示する
 * @param {string} selector - 対象とするリンクのcssセレクタ
 */

/**
 * ローディングを表示する関数
 */
export const showLoadingScreen = () => {
    const loading = document.getElementById('loading');
    if (!loading) return;

    loading.style.display = 'flex';

    requestAnimationFrame(() => {
        loading.classList.add('loading-active');
        loading.classList.remove('loading-hidden');
    });
};

export const setupLoadingOnLinkClick = (selector = 'a.loading-link') => {
    const loading = document.getElementById('loading');
    if (!loading) return;

    document.querySelectorAll(selector).forEach(anchor => {
        anchor.addEventListener('click', event => {
            const href = anchor.getAttribute('href');
            if (!href || href.startsWith('#') || anchor.target === '_blank') return;
            showLoadingScreen();
        });
    });
}