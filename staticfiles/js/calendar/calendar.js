import { asynchronousCommunication } from '../asyncCommunicator/asyncCommunicator.js';
import { UIManger } from '../manager/UIManger.js'
import { TableManager } from '../manager/TableManger.js'
import { dropdownManger } from '../manager/dropdownbox.js'
import { calendarColumnManager } from './calendarMappingConfig.js'
import { ModalManger } from '../manager/ModalManger.js'

import { initializeLoadingScreen } from '../manager/loadingManager.js';

const getSelectedMember = () => {
    const memberSelect = document.getElementById('memberSelect');
    const selectedOption = memberSelect.options[memberSelect.selectedIndex];
    const selectedLoginNumber = selectedOption.getAttribute('data-login-number');
    const selectedTeam = selectedOption.getAttribute('data-team');
    const allOptions = Array.from(memberSelect.options);

    const defaultOption = document.getElementById('memberSelectDefault');
    const allMemberOption = document.getElementById('allMember');

    const isAllMemberSelected = selectedOption === allMemberOption;

    allOptions.forEach(option => {
        const optionTeam = option.getAttribute('data-team') || '';
        const isDefaultOption = option === defaultOption;

        if (isAllMemberSelected) {
            UIManger.toggleClass(option, 'display-none', isDefaultOption ? 'add' : 'remove');
        } else {
            const shouldHide = selectedTeam !== optionTeam || optionTeam ==='';
            UIManger.toggleClass(option, 'display-none', shouldHide ? 'add' : 'remove');
        }
    });


    if (defaultOption) {
        UIManger.toggleClass(defaultOption, 'display-none', 'add');
    }

    if (allMemberOption) {
        UIManger.toggleClass(allMemberOption, 'display-none', 'remove');
    }

    return selectedLoginNumber || null;
}

const updateStatus = (_status, action) => {
    let updateStatus
    switch(action) {
        case 'drop':
            if (_status === '配布待ち') {
                updateStatus = '実施待ち';
            } else if (_status === '遅れ') {
                updateStatus = '遅れ'
            } else {
                throw new Error(`statusが${status}なので処理できません`);
            }
            break;
        case 'receive':
            if (_status === '遅れ') {
                updateStatus = '遅れ';
            } else if (_status === '実施待ち') {
                updateStatus = '配布待ち';
            } else {
                throw new Error(`statusが${_status}なので処理できません`);
            }
            break;
    }
    return updateStatus;
}

class Calendar {
    constructor() {
        const Calendar = FullCalendar.Calendar;
        const Draggable = FullCalendar.Draggable;
        const containerEl = document.getElementById('external-events');
        const calendarEl = document.getElementById('calendar');
        this.isCalendarRendered = false
        new Draggable(containerEl, {
            itemSelector: '.fc-event',
            eventData: (eventEl) => {
                const manHours = eventEl.getAttribute('data-man-hour');
                const hours = Math.floor(manHours / 60);
                const minutes = manHours % 60;
                const duration = ('00' + hours).slice(-2) + ':' + ('00' + minutes).slice(-2);
                const _title = eventEl.getAttribute('data-work-name');
                const _machineName = eventEl.getAttribute('data-control-name');
                const _monthAndWeek  = eventEl.getAttribute('data-week');
                const _dayOfWeek = eventEl.getAttribute('data-weekday');
                const _mouHours = parseFloat(eventEl.getAttribute('data-man-hour'));
                const _planStatus = eventEl.getAttribute('data-status');
                return {
                    extendedProps: {
                        title: _title,
                        machineName: _machineName,
                        draggable: eventEl.getAttribute('data-draggable') !== false,
                        dayOfWeek: _dayOfWeek,
                        monthAndWeek: _monthAndWeek,
                        man_hours: _mouHours,
                        planStatus: _planStatus
                    },
                    duration: duration,
                    id: eventEl.getAttribute('data-plan-id'),
                    inspectionNo: eventEl.getAttribute('data-plan-inspection-no')
                };
            }
        });
        
        this.myCalendar = new Calendar(calendarEl, {
            headerToolbar: {
                left: 'prev,next',
                center: 'title',
                right: 'timeGridDay,listMonth',
            },
            initialView: 'timeGridDay',
            locale: 'ja',
            timeZone: 'Asia/Tokyo',
            navLinks: true,
            businessHours: true,
            editable: true,
            droppable: true,
            allDaySlot: false,
            slotDuration: '00:05:00',
            slotMinTime: '06:30:00',
            slotMaxTime: '30:30:00',
    
            eventDrop: function(info) {
                const draggedMember = getSelectedMember();
                const event_id = info.event.id;
                const event_date = info.event.startStr;
                const event_status = info.event._def.extendedProps.planStatus
                asynchronousCommunication({
                    url: '/calendar/',
                    method: 'POST',
                    data: {
                        action: "update_date_time",
                        plan_id: event_id,
                        new_date: event_date,
                        member: draggedMember,
                        status: event_status
                    }
                });
            },
            drop: (info) => {
                const droppedMember = getSelectedMember();
                const eventId = info.draggedEl.getAttribute('data-plan-id');
                const new_date = info.dateStr;
                const drop_man_hour = parseFloat(info.draggedEl.getAttribute('data-man-hour'));
                const status = info.draggedEl.getAttribute('data-status');

                const _updateStatus = updateStatus(status, 'drop');
                console.log('Updated Status:', _updateStatus);
  
                asynchronousCommunication({
                    url: '/calendar/',
                    method: 'POST',
                    data: {
                        action: "update_date_time",
                        plan_id: eventId,
                        new_date: new_date,
                        member: droppedMember,
                        status: _updateStatus
                    }
                })
                .then(() => {
                    updateProgressText(drop_man_hour, 1, 0, 0);
                    decrementCardTotalContents(drop_man_hour);
                    const event = this.myCalendar.getEventById(eventId);
                    event.setExtendedProp('planStatus', _updateStatus);
                });
            },
            eventReceive: (info) => {
                const eventId = info.event.id;
                if (info.draggedEl) {
                    info.draggedEl.remove();
                }
            },
            eventClick: (info) => {
                // クリックイベントの発火を遅延させ、ダブルクリックの有無を確認
                if (this.clickTimeout) clearTimeout(this.clickTimeout);
                this.clickTimeout = setTimeout(() => {
                    this.clickTimeout = null; // ダブルクリックでないと判定された時のみ実行
                    const inspectionNo = info.event.extendedProps.inspectionNo;
                    handleRowClick(inspectionNo);
                }, 300); // 300ms以内にダブルクリックが発生しない場合にクリック処理を実行
            },
            
            eventDidMount: (info) => {
                const harnessElement = info.el.closest('.fc-timegrid-event-harness.fc-timegrid-event-harness-inset');
                if (harnessElement) {
                    harnessElement.addEventListener('dblclick', () => {
                        // ダブルクリックイベントが発生した場合、クリックイベントの発火を停止
                        if (this.clickTimeout) clearTimeout(this.clickTimeout);
                        this.clickTimeout = null;
                        const event = this.myCalendar.getEventById(info.event.id);
                        const eventDetails = {
                            eventId: event.id,
                            monthAndWeek: event.extendedProps.monthAndWeek,
                            dayOfWeek: event.extendedProps.dayOfWeek,
                            machineName: event.extendedProps.machineName,
                            title: event.extendedProps.title,
                            status: event.extendedProps.planStatus
                        };
                        showModal(eventDetails)
                            .then(() => {
                                //非同期通信が完了した後にイベントを削除
                                info.event.remove();
                                const allEvents = this.myCalendar.getEvents();
                                updateBarWidthAndPercentage(allEvents);
                            })
                            .catch(error => {
                                alert('モーダル完了後の削除エラーが発生しました');
                            })
                    });
                }
            },
            eventContent: (arg) => {
                const eventData =arg.event;
                const modifiedTitle = `<span>${eventData.extendedProps.machineName}: ${eventData.extendedProps.title}<spant>`;
                return { html: modifiedTitle };
            },
        });

        const showModal = (detail) => {
            return new Promise((resolve, reject) => {
                const createResponseMessage = data => {
                    return `<p>${data["message"]}</p>`;
                };
        
                let messagedata = {
                    "message": `${detail.monthAndWeek}週目(${detail.dayOfWeek})_
                        ${detail.machineName}(${detail.title})を引き戻しますか？`
                };
        
                const message = createResponseMessage(messagedata);
                let _updateStatus;
                try {
                    _updateStatus = updateStatus(detail.status, 'receive')
                } catch (error) {
                    alert(error.message);
                    return
                }
                
                const fetchPullBackAction = () => {
                    return asynchronousCommunication({
                        url: '/calendar/',
                        method: 'POST',
                        data: {
                            action: "fetch_pull-back",
                            planId: detail.eventId,
                            status: _updateStatus
                        }
                    });
                };
        
                const pullBackButtonClickListener = () => {
                    fetchPullBackAction()
                        .then((result) => {

                            const resultData = {
                                'duties': [result.update_weekly_duty]
                            }

                            this.calendarUI.tableManager.createTableRow(resultData);
                            const visibleRows = this.calendarUI.tableManager.filterTable();
                            initCardTotalContents(visibleRows);
                            //this.tableManager.createTableRow(resultData);
                            UIManger.removeElement('.mybutton');
                            ModalManger.closeModal();
                            ModalManger.showModal('success', 'green', true);
                            resolve();
                        })
                        .finally(() => {
                            pullBackButton.removeEventListener('click', pullBackButtonClickListener)
                        });
                };
        
                ModalManger.showModal(message, 'default', false, () => {
                    UIManger.removeElement('.mybutton');
                });
        
                const pullBackButton = UIManger.addActionElement('.mybutton.pull-back-button', 'a', null, '実行', pullBackButtonClickListener);
            
                // ボタンに一度のみリスナーを追加する（`once: true`を指定）
                if (pullBackButton) {
                    pullBackButton.addEventListener('click', pullBackButtonClickListener, { once: true });
                }
            });

        }
        this.calendarUI = new CalendarUI(this);
    }

    destroyCalendar() {
        if(this.myCalendar) {
            this.myCalendar.removeAllEvents();
            this.myCalendar.removeAllEventSources();
            this.myCalendar.destroy();
            
        }
    };
}

class CalendarUI {
    constructor(calendar) {
        this.calendar = calendar
        this.calendarColumnManager = new calendarColumnManager();
        this.myCalendar = this.calendar.myCalendar
        this.isCalendarRendered = this.calendar.isCalendarRendered
        this.tableMangerSetup();
        this.dropdownMangerSetup();
        this.setupDropdown();
        const visibleRows = this.tableManager.filterTable();
        initCardTotalContents(visibleRows);
        this.fetchTableData();
    }
    
    async fetchTableData() {
        const resultData = await this.tableManager.loadUpdateTableData({
            url: '/api/non-matching-weekly-duties/',
            method: 'GET',
        });
        if (resultData && resultData.duties.length > 0) {
            this.tableManager.createTableRow(resultData);
        }
    }

    tableMangerSetup() {
        const tableId = "myTable"
        const onRowClick = (row) => {
            handleRowClick(row.getAttribute("data-plan-inspection-no"));
        }
        this.tableManager = new TableManager(tableId, {
            onRowClick,
            'isDraggable': true,
            'isDisplayNone': true,
            'addClass': ['fc-event']
        }, null, this.calendarColumnManager);
        this.statusConfig = this.calendarColumnManager.statusConfig();
        this._toggleColumnVisible('label' ,'')
    }

    _toggleColumnVisible(property, value) {
        const statusColumnsConfig = Object.values(this.statusConfig).find(config => config[property] === value) || null;
        this.tableManager.toggleColumnVisible(statusColumnsConfig.columnsStyle);
        return statusColumnsConfig
    }


    addDropdownEventListeners() {
        const filterArea = document.getElementById('filterarea');
        const memberSelect = document.getElementById('memberSelect');
        const dropdowns = filterArea.querySelectorAll('select');
        const select = document.querySelector('select');

        let isDropdownOpen = false;

        memberSelect.addEventListener('change', () => {
            const member = getSelectedMember();
            if (UIManger.isValidValue(member)) {
                this.updateCalendar(member);
                setupRegistrationButton(this.myCalendar, this)
            } else {
                this.destroyCalendarInstance();
                this.isCalendarRendered = false;
                const defaultCalendarLabel = document.querySelector('.noneDisplay');
                UIManger.toggleClass(defaultCalendarLabel, 'display-none', 'remove');
                resetUIValues();
            }
        });

        filterArea.addEventListener('mouseleave', () => {
            setTimeout(() => {
                dropdowns.forEach(dropdown => {
                    dropdown.blur();
                });
            }, 50);
        })
    }

    destroyCalendarInstance() {
        this.calendar.destroyCalendar();
    }

    updateCalendar = (memberName) => {
        asynchronousCommunication({
            url: '/calendar/',
            method: 'POST',
            data: {
                action: "calendar_open",
                member: memberName
            }
        }).then((data) => {
            if (!this.isCalendarRendered) {
                this.isCalendarRendered = true
                const defaultCalendarLabel = document.querySelector('.noneDisplay');
                UIManger.toggleClass(defaultCalendarLabel, 'display-none', 'add');
    
                const memberStartTime = data.member_start_time;
                const dateObj = new Date(memberStartTime);

                // 日付部分を取得（YYYY-MM-DD形式）
                const date = dateObj.toISOString().split('T')[0];
                
                // 時間部分を取得（HH:mm:ss形式）
                const time = memberStartTime.split('T')[1];

                const viewType = this.myCalendar.view.type;
                if(viewType.includes("timeGrid")) {
                    this.myCalendar.setOption('initalDate', date);
                    this.myCalendar.setOption('scrollTime', time);
                    this.myCalendar.render();
                }
            } else {
                this.myCalendar.removeAllEvents()
                this.myCalendar.removeAllEventSources();
            }
    
            this.myCalendar.addEventSource(data.events);
            updateBarWidthAndPercentage(data.events);
        });
    }
    
    dropdownMangerSetup() {
        const dropdownsObj = {
            'teamSelect': 'data-affilation',
            'weekSelect': 'data-week',
            'lineSelect': 'data-line',
            'machineSelect': 'data-control-name',
            'daySelect': 'data-plan-week-of-day',
            'timezoneSelect': 'data-time-zone'
        }

        this.dropdownManger = new dropdownManger(dropdownsObj, this.tableManager);
        this.tableManager.setupDropdownManager(this.dropdownManger);
        this.addDropdownEventListeners();
    }

    setupDropdown() {
        const loginUserProfile = document.getElementById('employeeName');
        const loginUserTeam = loginUserProfile.getAttribute('data-affiliation');
        const filterArea = document.getElementById('filterarea');
        const thisWeek = filterArea.getAttribute('data-this-week');
        this.dropdownManger.selectedValue('teamSelect', loginUserTeam);
        this.dropdownManger.selectedValue('weekSelect', thisWeek);

        this.dropdownManger.setupDropdowns(() => {
            this.onRowFilters();
        })
        this.dropdownManger.updateFilterConditionsFromDropdowns();
    }

    onRowFilters() {
        this.dropdownManger.updateFilterConditionsFromDropdowns();
        const visibleRows = this.tableManager.filterTable();
        initCardTotalContents(visibleRows);
    }
}

const handleRowClick = (inspectionNo) => {
    const tableBody = document.getElementById("card-detail-table-body");
    asynchronousCommunication({
        url: '/calendar/',
        method: 'POST',
        data:{
            action: "fetch_inspection_data",
            inspection_no: inspectionNo
        }
        
    })
    .then((data) => {
        const records = JSON.parse(data.data);
        clearCardDetailsCells();
        tableBody.classList.add('table-fade-out');
        records.forEach((record) => {
            const newRow = document.createElement('tr');
            const deviceCell = document.createElement('td');
            deviceCell.textContent = record.fields.applicable_device;
            newRow.appendChild(deviceCell);
            const newCell = document.createElement('td');
            newCell.textContent = record.fields.contents;
            newRow.appendChild(newCell);
            tableBody.appendChild(newRow);
            
        });
        tableBody.classList.remove('table-fade-out');
    });
}

const clearCardDetailsCells = () => {
    const tbody = document.getElementById('card-detail-table-body');

    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
        tr.innerHTML = '';
    });
}

const handleRegistration = (myCalendar, calendarUIIns) => {
    const dateObjStart = new Date(myCalendar.view.activeStart.getTime() + 9 * 60 * 60 *1000);
    const dateObjEnd = new Date(myCalendar.view.activeEnd.getTime() + 9 * 60 * 60 * 1000);
    const registrationMember = getSelectedMember();
    const tableRows = document.querySelectorAll('#card-table tbody tr');
    const filteredRows = [...tableRows].filter(UIManger.isElementVisible);
    const dataPlanIds = filteredRows
        .map(row => row.getAttribute('data-plan-id'))
        .filter(dataPlanId => dataPlanId !== null);

    asynchronousCommunication({
        url: '/calendar/',
        method: 'POST',
        data: {
            action: "fetch_registration",
            dateStart: dateObjStart,
            dateEnd: dateObjEnd,
            dataPlanIds,
            member: registrationMember,
        }
    }).then(data => {
        updateAfterRegistration(data, registrationMember, filteredRows, calendarUIIns)
    })
};


const initCardTotalContents = (visibleRows) => {
    const totalCountElem = document.getElementById('totalCount');
    const manHourElem = document.getElementById('manHours');
    let totalCardCount = 0;
    let totalManHour = 0
    visibleRows.forEach(row => {
        const manHourStr = row.getAttribute('data-man-hour');
        const manHour = parseFloat(manHourStr);
        if (UIManger.isValidValue(manHour)) {
            totalManHour += manHour;
            totalCardCount++
        }
    });
    totalCountElem.textContent = `全${totalCardCount}枚`;
    manHourElem.textContent = `総工数${totalManHour}分`;
}


const decrementCardTotalContents = (dropManHour) => {
    const totalCountElem = document.getElementById('totalCount');
    const currentTotalCount = parseFloat(totalCountElem.textContent.match(/\d+/)[0]) - 1;
    totalCountElem.textContent = `全${currentTotalCount}枚`;
    const manHoursElem = document.getElementById('manHours');
    const currentManHours = parseFloat(manHoursElem.textContent.match(/\d+/)[0]) - dropManHour;
    manHoursElem.textContent = `総工数${currentManHours}分`;
}

const updateProgressText = (totalManHoursThisWeek, thisWeekEventsSize, totalManHoursLate, lateEventsSize) => {
    const necessaryTimeElement = document.getElementById('necessaryTime');
    const necessaryTime = parseInt(necessaryTimeElement.textContent, 10);
    necessaryTimeElement.textContent = `${necessaryTime + totalManHoursThisWeek}分`;
    
    const thisWeekTotalCardElement =  document.getElementById('thisWeekTotalCard');
    const thisWeekTotalCard = parseInt(thisWeekTotalCardElement.textContent, 10);
    thisWeekTotalCardElement.textContent = `${thisWeekTotalCard + thisWeekEventsSize}枚`;

    const necessaryLateTimeElement = document.getElementById('necessaryLateTime');
    const necessaryLateTime = parseInt(necessaryLateTimeElement.textContent, 10);
    necessaryLateTimeElement.textContent = `${necessaryLateTime + totalManHoursLate}分`;

    const thisWeekLateTotalCardElement = document.getElementById('thisWeekLateTotalCard');
    const thisWeekLateTotalCard = parseInt(thisWeekLateTotalCardElement.textContent, 10);
    thisWeekLateTotalCardElement.textContent = `${thisWeekLateTotalCard + lateEventsSize}枚`;
}

const updateBarWidthAndPercentage = (events) => {
    resetUIValues();
    const stats = calculateEventStats(events);
    updateProgressText(stats.totalManHoursThisWeek, stats.thisWeekEventsSize, stats.totalManHoursLate, stats.lateEventsSize);
}

const calculateEventStats = (events) => {
    const thisWeekEvents = events.filter(event => event.extendedProps.planStatus==='実施待ち');
    const totalManHoursThisWeek = thisWeekEvents.reduce((total, event) => total + event.extendedProps.man_hours, 0);
    const thisWeekEventsSize = thisWeekEvents.length;

    const lateEvents = events.filter(event => event.extendedProps.planStatus === '遅れ');
    const totalManHoursLate = lateEvents.reduce((total, event) => total + event.extendedProps.man_hours, 0);
    const lateEventsSize = lateEvents.length;

    return {
        totalManHoursThisWeek,
        thisWeekEventsSize,
        totalManHoursLate,
        lateEventsSize
    };
};

const resetUIValues = () => {
    document.getElementById('necessaryTime').textContent = 0;
    document.getElementById('thisWeekTotalCard').textContent = 0;
    document.getElementById('necessaryLateTime').textContent = 0;
    document.getElementById('thisWeekLateTotalCard').textContent = 0;
};

const setupRegistrationButton = (myCalendar, calendarUIIns) => {
    const registrationButton = document.getElementById('buttonRegistration');
    UIManger.toggleClass(registrationButton, 'disable-events', 'remove')
    registrationButton.addEventListener('click', () => handleRegistration(myCalendar, calendarUIIns));
};

const updateAfterRegistration = (data, registrationMember, filteredRows, calendarUIIns) => {
    calendarUIIns.updateCalendar(registrationMember);
    const totalManHoursLabel = document.getElementById('manHours');
    const totalCountLabel = document.getElementById('totalCount');
    let totalManHours = 0;
    let totalCount = 0;
    //const planIdsList = data.events.plan_ids_list;
    const planIdsList = data.events;
    filteredRows.forEach(row => {
        const dataId = parseInt(row.getAttribute('data-plan-id'), 10);
        if (planIdsList.includes(dataId) && row.style.display !== "none") {
            row.parentNode.removeChild(row);
        } else {
            totalManHours += parseInt(row.getAttribute('data-man-hour'))
            totalCount += 1;
        }
    })
    totalCountLabel.textContent = `全${totalCount}枚`;
    totalManHoursLabel.textContent = `総工数${totalManHours}分`;
};




document.addEventListener('DOMContentLoaded', () => {
    initializeLoadingScreen();
    const calendar = new Calendar();    
});



