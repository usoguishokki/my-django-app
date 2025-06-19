import { UIManger } from "../manager/UIManger.js";

export class HomeColumnManager {
    constructor() {
        this.statusConfig = this.statusConfig()
    }
    getDatasetMapping(practitioners) {
        const formatPractitioners = (item, index) => {
            const myPractitioners = practitioners[item['plan__plan_id']] || null;
            return myPractitioners ? myPractitioners.map(p => p[index]).join(', ') : '';
        }
        return {
            plan__plan_id: { datasetKey: 'planId' },
            status: { datasetKey: 'status' },
            plan__plan_time: {
                datasetKey: 'startTime',
                formatFn: (value) => value ? UIManger.removeZFromISODate(value) : ''
            },
            plan__inspection_no__wark_name: { datasetKey: 'workName' },
            plan__inspection_no__man_hours: { datasetKey: 'manHour' },
            holder_name: { datasetKey: 'holderName' },
            holder_member_id: { datasetKey: 'holderMemberId' },
            this_week: { datasetKey: 'thisWeek', formatFn: (value) => value ? 'True': 'False' },
            affilation__affilation: { datasetKey: 'affilation' },
            plan__inspection_no__time_zone: { datasetKey: 'timeZone' },
            plan__inspection_no__control_no__machine: { datasetKey: 'controlName' },
            practitioner_id: { 
                datasetKey: 'practitionerId',
                formatFn: (value ,item) => formatPractitioners(item, 0),
            },
            practitioner_name: { 
                datasetKey: 'practitionerName',
                formatFn: (value, item) => formatPractitioners(item, 1),
            },
            plan__comment: { datasetKey: 'planComment'},
            plan__inspection_no__inspection_no: { datasetKey: 'planInspectionNo' },
            plan__points_to_note: { datasetKey: 'planPointsToNote' },
        };
    }

    getTrInf() {
        const isValidDate = (item) => UIManger.isValidDate(item);
        const formatDate = (item, format) => UIManger.formatDate(item, format);
        return [
            {
                id: 'startDate',
                colgroup: 'start-date-content',
                className: 'start-date-content start-date-row',
                tdData: (item) => isValidDate(item) ? formatDate(item, 'm月d日') : '',
                mappingKey: 'plan__plan_time'
            },
            {
                id: 'startTime',
                colgroup: 'start-time-content',
                className: 'start-time-content start-time-row',
                tdData: (item) => isValidDate(item) ? `${formatDate(item, 'H:i')}~ <span class="start-time-line-break"></span>` : '',
                mappingKey: 'plan__plan_time'
            },
            {
                id: 'idColumn',
                colgroup: 'id-content',
                className: 'id-content card-no-row',
                tdData: (item) => item,
                mappingKey: 'plan__inspection_no__inspection_no'
            },
            {
                id: 'statusColumn',
                colgroup: 'status-content',
                className: 'status-content status-row',
                tdData: (item) => item,
                mappingKey: 'status'
            },
            {
                id: 'workNameColumn',
                colgroup: 'work-name-content',
                className: 'work-name-content work-name-row',
                tdData: (item) => item,
                mappingKey: 'plan__inspection_no__wark_name'
            },
            {
                id: 'timeZoneColumn',
                colgroup: 'time-zone-content',
                className: 'time-zone-content time-zone-row',
                tdData: (item) => item,
                mappingKey: 'plan__inspection_no__time_zone'
            },
            {
                id: 'manHourColumn',
                colgroup: 'man-hour-content',
                className: 'man-hour-content man-hour-row',
                tdData: (item) => item,
                mappingKey: 'plan__inspection_no__man_hours',
            },
            {
                id: 'controlNameColumn',
                colgroup: 'control-name-content',
                className: 'control-name-content control-name-row',
                tdData: (item) => `${item}<span class="control-name-line-break"></span>`,
                mappingKey: 'plan__inspection_no__control_no__machine'
            },
            {
                id: 'commentColumn',
                colgroup: 'comment-content',
                className: 'comment-content comment-row',
                tdData: (item) => item,
                mappingKey: 'plan__comment'
            },
            {
                id: 'holderNameColumn',
                colgroup: 'holder-name-content',
                className: 'holder-name-content holder-name-row',
                tdData: (item) => item,
                mappingKey: 'holder_name'
            },
            {
                id: 'practitionerNameColumn',
                colgroup: 'practitioner-name-content',
                className: 'practitioner-name-content practitioner-name-row',
                tdData: (item) => item,
                mappingKey: 'practitioner_name'
            },
        ];
    };
    statusConfig() {
        const statusConfig = {
            'waiting': {
                label: '配布待ち',
                btn:  'btnWaiting',
                columnsStyle: {
                    startDate: {visible: false, width: '0%'}, 
                    startTime: {visible: false, width: '0%'}, 
                    idColumn: {visible: true, width: '29%'}, 
                    statusColumn: {visible: false, width: '0%'}, 
                    workNameColumn: {visible: true, width: '53%'}, 
                    timeZoneColumn: {visible: true, width: '10%'}, 
                    manHourColumn: {visible: true, width: '8%'}, 
                    controlNameColumn: {visible: false, width: '0%'}, 
                    commentColumn: {visible: false, width: '0%'}, 
                    holderNameColumn: {visible: false, width: '0%'}, 
                    practitionerNameColumn: {visible: false, width: '0%'}
                }
            },
            'pending': {
                label: '実施待ち',
                btn: 'btnPending',
                columnsStyle: {
                    startDate: {visible: false, width: '0%'}, 
                    startTime: {visible: false, width: '0%'}, 
                    idColumn: {visible: true, width: '29%'}, 
                    statusColumn: {visible: false, width: '0%'}, 
                    workNameColumn: {visible: true, width: '53%'}, 
                    timeZoneColumn: {visible: true, width: '10%'}, 
                    manHourColumn: {visible: true, width: '8%'}, 
                    controlNameColumn: {visible: false, width: '0%'}, 
                    commentColumn: {visible: false, width: '0%'}, 
                    holderNameColumn: {visible: false, width: '0%'}, 
                    practitionerNameColumn: {visible: false, width: '0%'}
                }
            },
            'approval': {
                label: '承認待ち',
                btn: 'btnApproval',
                columnsStyle: {
                    startDate: {visible: false, width: '0%'}, 
                    startTime: {visible: false, width: '0%'}, 
                    idColumn: {visible: true, width: '29%'}, 
                    statusColumn: {visible: false, width: '0%'}, 
                    workNameColumn: {visible: true, width: '53%'}, 
                    timeZoneColumn: {visible: true, width: '10%'}, 
                    manHourColumn: {visible: true, width: '8%'}, 
                    controlNameColumn: {visible: false, width: '0%'}, 
                    commentColumn: {visible: false, width: '0%'}, 
                    holderNameColumn: {visible: false, width: '0%'}, 
                    practitionerNameColumn: {visible: false, width: '0%'}
                }
            },
            'delayed': {
                label: '遅れ',
                btn: 'btnDelayed',
                columnsStyle: {
                    startDate: {visible: false, width: '0%'}, 
                    startTime: {visible: false, width: '0%'}, 
                    idColumn: {visible: true, width: '29%'}, 
                    statusColumn: {visible: false, width: '0%'}, 
                    workNameColumn: {visible: true, width: '53%'}, 
                    timeZoneColumn: {visible: true, width: '10%'}, 
                    manHourColumn: {visible: true, width: '8%'}, 
                    controlNameColumn: {visible: false, width: '0%'}, 
                    commentColumn: {visible: false, width: '0%'}, 
                    holderNameColumn: {visible: false, width: '0%'}, 
                    practitionerNameColumn: {visible: false, width: '0%'}
                }
            },
            'completion': {
                label: '完了',
                btn: 'btnCompletion',
                columnsStyle: {
                    startDate: {visible: false, width: '0%'}, 
                    startTime: {visible: false, width: '0%'}, 
                    idColumn: {visible: true, width: '29%'}, 
                    statusColumn: {visible: false, width: '0%'}, 
                    workNameColumn: {visible: true, width: '53%'}, 
                    timeZoneColumn: {visible: true, width: '10%'}, 
                    manHourColumn: {visible: true, width: '8%'}, 
                    controlNameColumn: {visible: false, width: '0%'}, 
                    commentColumn: {visible: false, width: '0%'}, 
                    holderNameColumn: {visible: false, width: '0%'}, 
                    practitionerNameColumn: {visible: false, width: '0%'}
                }
            },
            'rejected': {
                label: '差戻し',
                btn: 'btnRejected',
                columnsStyle: {
                    startDate: {visible: false, width: '0%'}, 
                    startTime: {visible: false, width: '0%'}, 
                    idColumn: {visible: false, width: '0%'}, 
                    statusColumn: {visible: false, width: '0%'}, 
                    workNameColumn: {visible: true, width: '50%'}, 
                    timeZoneColumn: {visible: false, width: '0%'}, 
                    manHourColumn: {visible: false, width: '0%'}, 
                    controlNameColumn: {visible: false, width: '0%'}, 
                    commentColumn: {visible: true, width: '50%'}, 
                    holderNameColumn: {visible: false, width: '0%'}, 
                    practitionerNameColumn: {visible: false, width: '0%'}
                }
            },
            'mobile': {
                label: 'mobile',
                btn: '',
                columnsStyle: {
                    startDate: {visible: false, width: '0%'}, 
                    startTime: {visible: true, width: '30%'}, 
                    idColumn: {visible: false, width: '0%'}, 
                    statusColumn: {visible: false, width: '0%'}, 
                    workNameColumn: {visible: false, width: '0%'}, 
                    timeZoneColumn: {visible: false, width: '0%'}, 
                    manHourColumn: {visible: false, width: '0%'}, 
                    controlNameColumn: {visible: true, width: '70%'}, 
                    commentColumn: {visible: false, width: '0%'}, 
                    holderNameColumn: {visible: false, width: '0%'}, 
                    practitionerNameColumn: {visible: false, width: '0%'}
                }
            }
        }
        return statusConfig;
    };
}

