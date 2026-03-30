/**
 * Dropdown 用 mapping 定義
 * 
 * dropdownManger.setRemoteOptions() に渡す設定をまとめる
 * UIの個別仕様はここに集約する
 */

export const dropdownMappings = Object.freeze({

    machineName: {
        placeholderLabel: '設備を選択してください',

        includePlaceholder: true,

        includeAll: true,

        allLabel: '全て',

        allValue: 'all',

        allAttributes: {
            'data-control-no': 'all',
        },

        restorePreviousValue: true,

        mapItemToOption: (item) => ({
            value: item.value ?? '',
            label: item.label ?? '',
            attributes: {
                'data-control-no': item.control_no ?? '',
            },
        }),
    },

});