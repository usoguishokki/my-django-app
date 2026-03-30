export class inspectionHistoryManager {
    constructor() {

    }
    getDatasetMapping() {
        
    }

    getTrInf() {
        return [
            {
                id: 'implementationDateCol',
                colgroup: 'implementation-date-content',
                className: 'implementation-date-content implementation-date-row',
                tdData: (item) => item,
                mappingKey: ''
            },
            {
                id: 'resultManCol',
                colgroup: 'result_man-content',
                className: 'result_man-content result_man-row',
                tdData: (item) => item,
                mappingKey: ''
            },
            {
                id: 'resultCol',
                colgroup: 'result-content',
                className: 'result-content result-row',
                tdData: (item) => item,
                mappingKey: ''
            },
            {
                id: 'pointsToNoteCol',
                colgroup: 'points_to_note-content',
                className: 'points_to_note-content points_to_note-row',
                tdData: (item) => item,
                mappingKey: ''
            },
            {
                id: 'practitionerCol',
                colgroup: 'practitioner-content',
                className: 'practitioner-content practitioner-row',
                tdData: (item) => item,
                mappingKey: ''
            },
            {
                id: 'approverCol',
                colgroup: 'approver-content',
                className: 'approver-content approver-row',
                tdData: (item) => item,
                mappingKey: ''
            },
        ];
    };
    
    statusConfig() {
        const statusConfig = {
            'default': {
                label: '',
                btn:  '',
                columnsStyle: {
                    implementationDateCol: {visible: true, width: '10%'}, 
                    resultManCol: {visible: true, width: '7%'}, 
                    resultCol: {visible: true, width: '10%'}, 
                    pointsToNoteCol: {visible: true, width: '58%'}, 
                    practitionerCol: {visible: true, width: '10%'}, 
                    approverCol: {visible: true, width: '10%'}, 
                }
            }
        }
        return statusConfig
    };
}