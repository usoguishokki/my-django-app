// static/js/home/ui/HomeDetailViewConfig.js

export const HOME_DETAIL_EMPTY_MESSAGES = Object.freeze({
    DEFAULT: '対象の仕事一覧はまだありません。',
    EMPTY_AFTER_ASSIGN: 'この一覧の対象作業はありません。',
    LOAD_FAILED: '対象の仕事一覧の取得に失敗しました。',
});


export const HOME_DETAIL_GROUP_SUMMARY_OPTIONS = Object.freeze({
    OVERALL: Object.freeze({
        listClassName: 'home-overall-detail__list home-overall-group-list',
        cardClassName: 'home-drilldown-group-card home-overall-group-card',
        labelClassName: 'home-drilldown-group-card__label home-overall-group-card__label',
        countClassName: 'home-drilldown-group-card__count home-overall-group-card__count',
        datasetKey: 'overallGroupKey',
    }),

    MY_TEAM: Object.freeze({
        listClassName: 'home-my-team-group-list',
        cardClassName: 'home-drilldown-group-card home-my-team-group-card',
        labelClassName: 'home-drilldown-group-card__label home-my-team-group-card__label',
        countClassName: 'home-drilldown-group-card__count home-my-team-group-card__count',
        datasetKey: 'myTeamGroupKey',
    }),
});


export const HOME_DETAIL_TASK_LIST_OPTIONS = Object.freeze({
    OVERALL: Object.freeze({
        className: 'home-overall-detail__list home-task-list',
    }),
});