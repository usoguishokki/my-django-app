import { UIManger } from "../manager/UIManger.js";

export class calendarColumnManager {
    constructor() {
        
    }
    normalizeRow(row) {
        const alias = {
            line:             ['inspection_no__control_no__line_name__line_name'],
            controlName:      ['inspection_no__control_no__machine'],
            workName:         ['inspection_no__wark_name'],
            manHour:          ['inspection_no__man_hours'],
            planId:           ['plan_id'],
            status:           ['status'],
            affilation:       ['cal_affilation_name'],
            timeZone:         ['inspection_no__time_zone'],
            planInspectionNo: ['inspection_no__inspection_no'],
            weekday:          ['inspection_no__day_of_week'],
            week:             ['p_date__h_day_of_week'],
            planWeekOfDay:    ['p_date__date_alias'],
        }

        
        const pick = (arr, fb='') => {
            for (const k of arr) {
                const v = row?.[k];
                if (v !== undefined && v !== null && v !== '') return v;
            }
            return fb;
        };

        const norm = {};
        for (const key of Object.keys(alias)) {
            norm[key] = pick(alias[key], key === 'manHour' ? 0 : '');
        }

        // event/draggable もここで確定（フロントの責務）
        norm.event = JSON.stringify({ title: `Plan ID: ${norm.planId}`, id: String(norm.planId) });
        norm.draggable = 'false';

        return norm;
    }

    
    getDatasetMapping(practitioners) {
        return {
            inspection_no__control_no__line_name__line_name: { datasetKey: 'line' },
            inspection_no__control_no__machine: { datasetKey: 'controlName' },
            inspection_no__wark_name: { datasetKey: 'workName' },
            inspection_no__man_hours: { datasetKey: 'manHour'},
            plan_id: { datasetKey: 'planId'},
            status: { datasetKey: 'status'},
            inspection_no__status: {datasetKey: 'checkStatus'},
            cal_affilation_name: { datasetKey: 'affilation'},
            inspection_no__time_zone: { datasetKey: 'timeZone' },
            inspection_no__inspection_no: { datasetKey: 'planInspectionNo' },
            inspection_no__day_of_week: { datasetKey: 'weekday' },
            p_date__date_alias: { datasetKey: 'week' },
            p_date__h_day_of_week: {datasetKey: 'planWeekOfDay'},
            inspection_no__rule__unit: { datasetKey: "periodUnit" },
            inspection_no__rule__interval: { datasetKey: "periodInterval" },
            __period: {
                datasetKey: "period",
                formatFn: (_, item) => {
                    const unit = item["inspection_no__rule__unit"];
                    const interval = item["inspection_no__rule__interval"];
                    if (!unit || interval == null || interval === "") return "";
                    return `${interval}${unit}`;
                },
            },

            option_event: {
                datasetKey: 'event',
                formatFn: (value, item) => `{"title": "Plan ID: ${item.plan_id}", "id": "${item.plan_id}"}`
            },
            option_draggable: {
                datasetKey: 'draggable',
                formatFn: () => 'true'
            }
        };
    }

    getTrInf() {
        return [
            {
                id: 'lineColumn',
                colgroup: 'line-content',
                className: 'line-content line-row',
                tdData: (item) => item,
                mappingKey: 'inspection_no__control_no__line_name__line_name'
            },
            {
                id: 'machineColumn',
                colgroup: 'machine-content',
                className: 'machine-content machine-row',
                tdData: (item) => item,
                mappingKey: 'inspection_no__control_no__machine'
            },
            {
                id: 'workNameCol',
                colgroup: 'work-name-content',
                className: 'work-name-content work-name-row',
                tdData: (item) => item,
                mappingKey: 'inspection_no__wark_name'
            },
            {                
                id: 'workPeriodCol',
                colgroup: 'work-period-content',
                className: 'work-period-content work-period-row',
                tdData: (item) => item,
                mappingKey: '__period'
            },
            {
                id: 'manHourCol',
                colgroup: 'man-hour-content',
                className: 'man-hour-content man-hour-row',
                tdData: (item) => item,
                mappingKey: 'inspection_no__man_hours'
            },
        ];
    };
    statusConfig() {
        const statusConfig = {
            'default': {
                label: '',
                btn:  '',
                columnsStyle: {
                    lineColumn: {visible: true, width: '20%'}, 
                    machineColumn: {visible: true, width: '25%'}, 
                    workNameCol: {visible: true, width: '35%'}, 
                    workPeriodCol: {visible: true, width: '10%'},
                    manHourCol: {visible: true, width: '10%'}, 
                }
            }
        }
        return statusConfig
    };
}