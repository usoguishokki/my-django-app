import { UIManger } from "../manager/UIManger.js";

export class calendarColumnManager {
    constructor() {

    }
    getDatasetMapping(practitioners) {
        return {
            plan__inspection_no__control_no__line_name__line_name: { datasetKey: 'line' },
            plan__inspection_no__control_no__machine: { datasetKey: 'controlName' },
            plan__inspection_no__wark_name: { datasetKey: 'workName' },
            plan__inspection_no__man_hours: { datasetKey: 'manHour'},
            plan__plan_id: { datasetKey: 'planId'},
            status: { datasetKey: 'status'},
            affilation__affilation: { datasetKey: 'affilation'},
            plan__inspection_no__time_zone: { datasetKey: 'timeZone' },
            plan__inspection_no__inspection_no: { datasetKey: 'planInspectionNo' },
            plan__inspection_no__day_of_week: { datasetKey: 'weekday' },
            plan__p_date__date_alias: { datasetKey: 'week' },
            plan__p_date__h_day_of_week: {datasetKey: 'planWeekOfDay'},
            option_event: {
                datasetKey: 'event',
                formatFn: (value, item) => `{"title": "Plan ID: ${item.plan__plan_id}", "id": "${item.plan__plan_id}"}`
            },
            option_draggable: {
                datasetKey: 'draggable',
                formatFn: () => 'false'
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
                mappingKey: 'plan__inspection_no__control_no__line_name__line_name'
            },
            {
                id: 'machineColumn',
                colgroup: 'machine-content',
                className: 'machine-content machine-row',
                tdData: (item) => item,
                mappingKey: 'plan__inspection_no__control_no__machine'
            },
            {
                id: 'workNameCol',
                colgroup: 'work-name-content',
                className: 'work-name-content work-name-row',
                tdData: (item) => item,
                mappingKey: 'plan__inspection_no__wark_name'
            },
            {
                id: 'manHourCol',
                colgroup: 'man-hour-content',
                className: 'man-hour-content man-hour-row',
                tdData: (item) => item,
                mappingKey: 'plan__inspection_no__man_hours'
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
                    machineColumn: {visible: true, width: '35%'}, 
                    workNameCol: {visible: true, width: '35%'}, 
                    manHourCol: {visible: true, width: '10%'}, 
                }
            }
        }
        return statusConfig
    };
}