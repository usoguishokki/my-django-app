import { UIManger } from '../manager/UIManger.js';
export class achivementsManager {
    constructor() {

    }
    getDatasetMapping() {
        return {
            date: {
                datasetKey: 'day',
                formatFn: (value, item) => UIManger.formatDate(value, 'm月d日')
            },
            hozen_calendar: {datasetKey: 'calendar'},
            active_hours: {
                datasetKey: 'activeHours',
                formatFn: (value, item) => `${value}分`
            },
            inactive_hours: {
                datasetKey: 'inactiveHours',
                formatFn: (value, item) => `${value}分`
            },
            total_count: {
                datasetKey: 'totalCount',
                formatFn: (value, item) => `${value}枚`
            }
        };
    }

    getTrInf() {
        return [
            {
                id: 'dayCol',
                colgroup: 'day-content',
                className: 'day-content day-row',
                tdData: (item) => {
                    const selectElement = document.getElementById('monthSelect');
                    const selectedValue = selectElement.value;
                    const year = selectedValue.split('年')[0];
                    return `${year}年${item}`
                },
                mappingKey: 'date'
            },
            {
                id: 'hozenCalendarCol',
                colgroup: 'hozen-calendar-content',
                className: 'hozen-calendar-content hozen-calendar-row',
                tdData: (item) => item,
                mappingKey: 'hozen_calendar'
            },
            {
                id: 'operatingCol',
                colgroup: 'operating-content',
                className: 'operating-content operating-row',
                tdData: (item) => item,
                mappingKey: 'active_hours'
            },
            {
                id: 'notOperatingCol',
                colgroup: 'not-operating-content',
                className: 'not-operating-content not-operating-row',
                tdData: (item) => item,
                mappingKey: 'inactive_hours'
            },
            {
                id: 'totalNumberCol',
                colgroup: 'total-number-content',
                className: 'total-number-content total-number-row',
                tdData: (item) => item,
                mappingKey: 'total_count'
            },
            
        ];
    };
    statusConfig() {
        const statusConfig = {
            'default': {
                label: '',
                btn:  '',
                columnsStyle: {
                    dayCol: {visible: true, width: '20%'}, 
                    hozenCalendarCol: {visible: true, width: '20%'}, 
                    operatingCol: {visible: true, width: '20%'}, 
                    notOperatingCol: {visible: true, width: '20%'}, 
                    totalNumberCol: {visible: true, width: '20%'}
                }
            }
        }
        return statusConfig
    };
}