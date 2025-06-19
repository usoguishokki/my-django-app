

/*
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tooltip').forEach(element => {
        element.addEventListener('focus', () => {
            element.classList.add('tooltip-hidden');
            
            setTimeout(() => {
                element.classList.remove('tooltip-hidden');
                element.blur()
            }, 800);
            
        });
    });
});
*/

(() => {
    /**
     * スマホのブラウザーUIに対応した高さ変数を設定
     */
    const setVh = () => {
        const vh =window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    /**
     * ツールチップのフォーカス処理
     */

    const initializeTooltips = () => {
        document.querySelectorAll('.tooltip').forEach(element => {
            element.addEventListener('docus', () => {
                element.classList.add('tooltip-hidden');
                setTimeout(() => {
                    element.classList.remove('tooltip-hidden');
                    element.blur();
                }, 800);
            });
        });
    };

    const initializeApp = () => {
        setVh();
        initializeTooltips();
    };

    //初回読み込み時に初期化
    window.addEventListener('DOMContentLoaded', initializeApp);

    //スクロールや回転でビューポートが変化したときに高さ再計算
    window.addEventListener('resize', setVh);

})();