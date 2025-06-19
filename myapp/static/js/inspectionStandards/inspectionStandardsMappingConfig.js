export class inspectionStandardManager {
    constructor() {

    }
    getDatasetMapping() {
        return {
            inspection_no__inspection_no: { datasetKey: 'inspection_no' },
            inspection_no__wark_name: { datasetKey: 'wark_name' },
            applicable_device: { datasetKey: 'applicable_device' },
            method: { datasetKey: 'method' },
            contents: { datasetKey: 'contents' },
            period: { datasetKey: 'period' },
            inspection_no__time_zone: { datasetKey: 'time_zone' },
            standard: { datasetKey: 'standard' },
            remarks: { datasetKey: 'remarks' }
        };
    }

    getTrInf() {
        return [
            {
                id: 'inspectionNoCol',
                colgroup: 'inspection-no-content',
                className: 'inspection-no-content inspection-no-row',
                tdData: (item) => item,
                mappingKey: 'inspection_no__inspection_no'
            },
            {
                id: 'workNameCol',
                colgroup: 'work-name-content',
                className: 'work-name-content work-name-row',
                tdData: (item) => item,
                mappingKey: 'inspection_no__wark_name'
            },
            {
                id: 'applicableDeviceCol',
                colgroup: 'applicable-device-content',
                className: 'applicable-device-content applicable-device-row',
                tdData: (item) => item,
                mappingKey: 'applicable_device'
            },
            {
                id: 'methodCol',
                colgroup: 'method-content',
                className: 'method-content method-row',
                tdData: (item) => item,
                mappingKey: 'method'
            },
            {
                id: 'contentsCol',
                colgroup: 'contents-content',
                className: 'contents-content contents-row',
                tdData: (item) => item,
                mappingKey: 'contents'
            },
            {
                id: 'periodCol',
                colgroup: 'period-content',
                className: 'period-content period-row',
                tdData: (item) => item,
                mappingKey: 'period'
            },
            {
                id: 'timezoneCol',
                colgroup: 'timezone-content',
                className: 'timezone-content timezone-row',
                tdData: (item) => item,
                mappingKey: 'inspection_no__time_zone'
            },
            {
                id: 'standardCol',
                colgroup: 'standard-content',
                className: 'standard-content standard-row',
                tdData: (item) => item,
                mappingKey: 'standard'
            },
            {
                id: 'remarksCol',
                colgroup: 'remarks-content',
                className: 'remarks-content remarks-row',
                tdData: (item) => item,
                mappingKey: 'remarks'
            },
        ];
    };
    statusConfig() {
        const statusConfig = {
            'default': {
                label: '',
                btn:  '',
                columnsStyle: {
                    inspectionNoCol: {visible: true, width: '11.1%'}, 
                    workNameCol: {visible: true, width: '11.1%'}, 
                    applicableDeviceCol: {visible: true, width: '11.1%'}, 
                    methodCol: {visible: true, width: '11.1%'}, 
                    contentsCol: {visible: true, width: '11.1%'}, 
                    periodCol: {visible: true, width: '11.1%'}, 
                    timezoneCol: {visible: true, width: '11.1%'},
                    standardCol: {visible: true, width: '11.%'},
                    remarksCol: {visible: true, width: '11.%'},
                }
            }
        }
        return statusConfig
    };
}