/**
 * CustomDropdown 用 mapping 定義
 * 個別UI仕様はここに集約する
 */
export const CustomDropdownMappings = Object.freeze({
    machineName: {
        placeholder: '設備を選択してください',

        mapItems: (items = []) => ([
            {
                value: 'all',
                label: '全て',
                attributes: {
                    'data-control-no': 'all',
                },
            },
            ...items.map((item) => {
                const controlNo = item.control_no ?? '';

                return {
                    value: controlNo,
                    label: item.label ?? '',
                    attributes: {
                        'data-control-no': controlNo,
                    },
                };
            }),
        ]),
    },
});