
export class workContentsManager {
    constructor() {

    }
    getDatasetMapping() {
        
    }

    getTrInf() {
        return [
            {
                id: 'impleMentationCol',
                colgroup: 'implementation-date-content',
                className: 'implementation-date-content implementation-date-row',
                tdData: (item) => item,
                mappingKey: ''
            },
            {
                id: 'statusCol',
                colgroup: 'status-content',
                className: 'status-content status-row',
                tdData: (item) => item,
                mappingKey: ''
            },
            {
                id: 'workNameCol',
                colgroup: 'work-name-content',
                className: 'work-name-content work-name-row',
                tdData: (item) => item,
                mappingKey: ''
            },
            {
                id: 'implementationContentCol',
                colgroup: 'implementation-content',
                className: 'implementation-content implementation-content-row',
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
                id: 'applicantCol',
                colgroup: 'applicant-content',
                className: 'applicant-content applicant-row',
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
            {
                id: 'approveRejectCol',
                colgroup: 'approve-reject-content',
                className: 'approve-reject-content approve-reject-row',
                tdData: (item) => item,
                mappingKey: ''
            },
            {
                id: 'commentCol',
                colgroup: 'comment-content',
                className: 'comment-content comment-row',
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
                    impleMentationCol: {visible: true, width: '8%'}, 
                    statusCol: {visible: true, width: '8%'}, 
                    workNameCol: {visible: true, width: '18%'}, 
                    implementationContentCol: {visible: true, width: '20%'}, 
                    resultCol: {visible: true, width: '4%'}, 
                    applicantCol: {visible: true, width: '8%'}, 
                    approverCol: {visible: true, width: '8%'},
                    approveRejectCol: {visible: true, width: '10%'},
                    commentCol: {visible: true, width: '16%'},
                }
            }
        }
        return statusConfig
    };
}