import { asynchronousCommunication } from './asyncCommunicator.js';
import { UIManger } from './UIManger.js'
import { ModalManger } from './ModalManger.js'
let calendar
let isCalendarRendered = false



function getSelectedMember() {
    const memberFilter = document.getElementById('memberFilter')
    const memberSelectElement = memberFilter.querySelector('select');
    const selectOption = memberSelectElement.options[memberSelectElement.selectedIndex];
    const memberName =selectOption.textContent;
    const memberTeam = selectOption.getAttribute('data-team');
    const memberFilterAllOptions = memberFilter.querySelectorAll('.option');
    memberFilterAllOptions.forEach(option => {
        if(option.getAttribute('data-team') !== memberTeam) {
            option.style.display = 'none';
        } else {
            option.style.display = '';
        }
    });
    return memberName ? memberName : null;
}

function handleRowClick(inspectionNo) {
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
        tableBody.classList.add('table-fade-out');
        tableInitialize();
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

document.addEventListener('DOMContentLoaded', function() {
    const Calendar = FullCalendar.Calendar;
    const Draggable = FullCalendar.Draggable;
    const containerEl = document.getElementById('external-events');
    const calendarEl = document.getElementById('calendar');

    function showModal(detail) {
        let registrationMember = getSelectedMember()
        const createResponseMessage = data => {
            const message = `<p>${data["message"]}</p>`;
            return message;
        };

        let messagedata = {
            "message": `${detail.extendedPlanMonth}月${detail.extendedPlanWeek}週目(${detail.extendedDayOfWeek})_
                ${detail.extendedTitle}(${detail.title})を引き戻しますか？`
        }

        const message = createResponseMessage(messagedata);
        ModalManger.showModal(message, 'default', false, () => {
            UIManger.removeElement('.mybutton');
        });
        UIManger.addActionElement('.modal-content', 'div', 'mybutton pull-back-button', null);
        UIManger.addActionElement('.mybutton.pull-back-button', 'a', null, '実行', pullBackButtonClickListener);

        function pullBackButtonClickListener() {
            asynchronousCommunication({
                url: '/calendar/',
                method: 'POST',
                data: {
                    action: "fetch_pull-back",
                    planId: detail.eventId
                }
            }).then(() => {
                updateCalendar(registrationMember);
                UIManger.removeElement('.mybutton')
                ModalManger.closeModal()
                ModalManger.showModal('success', 'green', true)
            });
            pullBackButton.removeEventListener('click', pullBackButtonClickListener)
        }
    }

    new Draggable(containerEl, {
        
        itemSelector: '.fc-event',
        eventData: function(eventEl) {
            const manHours = eventEl.getAttribute('data-man-hours')
            const hours = Math.floor(manHours / 60);
            const minutes = manHours % 60;
            const duration = ('00' + hours).slice(-2) + ':' + ('00' + minutes).slice(-2);
            const dayOfWeek = eventEl.getAttribute('data-weekday');
            const planMonth = eventEl.getAttribute('data-plan-month');
            const planWeek = eventEl.getAttribute('data-plan-week')
            return {
                extendedProps: {
                    title: eventEl.children[2].innerText,
                    machineName: eventEl.children[1].innerText,
                    draggable: eventEl.getAttribute('data-draggable') !== false,
                    dayOfWeek: dayOfWeek,
                    planMonth: planMonth,
                    planWeek: planWeek
                },
                duration: duration,
                id: eventEl.getAttribute('data-id'),
                title: eventEl.getAttribute('data-inspection_no')
            };
        }
    });
    
    calendar = new Calendar(calendarEl, {
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
            asynchronousCommunication({
                url: '/calendar/',
                method: 'POST',
                data: {
                    action: "update_date_time",
                    plan_id: event_id,
                    new_date: event_date,
                    new_time: event_date,
                    member: draggedMember
                }
            });
        },
        drop: function(info) {
            const droppedMember = getSelectedMember()
            const event_id = info.draggedEl.getAttribute('data-id');
            const new_date = info.dateStr;
            const drop_man_hour = parseFloat(info.draggedEl.getAttribute('data-man-hours'));
            asynchronousCommunication({
                url: '/calendar/',
                method: 'POST',
                data: {
                    action: "update_date_time",
                    plan_id: event_id,
                    new_date: new_date,
                    member: droppedMember
                }
            })
            .then(() => {
                updateProgressText(drop_man_hour, 1, 0, 0);
                decrementCounters(drop_man_hour);
            });
            tableInitialize()
        },
        eventReceive: function(info) {
            const eventId = info.event.id;
            //const tableRow = document.querySelector(`.fc-event[data-id="${eventId}"]`);
            if (info.draggedEl) {
                info.draggedEl.remove();
            }
        },
        eventClick: function(info) {
            const inspectionNo = info.event.title;
            handleRowClick(inspectionNo)
        },
        eventDidMount: function(info) {
            const harnessElement = info.el.closest('.fc-timegrid-event-harness.fc-timegrid-event-harness-inset')
            if (harnessElement) {
                harnessElement.addEventListener('dblclick', function() {
                    const eventDetails = {
                        eventId: info.event.id,
                        title: info.event.title,
                        extendedTitle: info.event.extendedProps.title,
                        eventId: info.event.id,
                        extendedDayOfWeek: info.event.extendedProps.dayOfWeek,
                        extendedPlanMonth: info.event.extendedProps.planMonth,
                        extendedPlanWeek: info.event.extendedProps.planWeek
                    }
                    showModal(eventDetails);
                })
            }
        },
        eventContent: function(arg) {
            const eventData =arg.event;
            const modifiedTitle =
             `<span>${eventData.extendedProps.machineName}: ${eventData.extendedProps.title}<spant>`;
             return { html: modifiedTitle };
        },
    })
});

document.addEventListener("DOMContentLoaded", function() {
    const registrationButton = document.querySelector('.buttonRegistration a');
    registrationButton.addEventListener('click', function() {
        let dateObjStart = calendar.view.activeStart;
        dateObjStart.setTime(dateObjStart.getTime() + 9 * 60 * 60 * 1000);
        let dateObjEnd = calendar.view.activeEnd;
        dateObjEnd.setTime(dateObjEnd.getTime() + 9 * 60 * 60 * 1000);
        const registrationMember = getSelectedMember()
        const tableRows = document.querySelectorAll("#card-table tbody tr");
        const dataIds = [];
        tableRows.forEach(function(row) {
            if(row.style.display !== "none") {
                const dataId = row.getAttribute('data-id');
                if (dataId) {
                    dataIds.push(dataId);
                }
            }
        });
        asynchronousCommunication({
            url: '/calendar/',
            method: 'POST',
            data: {
                action: "fetch_registration",
                dateStart: dateObjStart,
                dateEnd: dateObjEnd,
                dataIds: dataIds,
                member: registrationMember,
            }  
        }).then((data) => {
            updateCalendar(registrationMember);
            let totalManHoursLabel = document.getElementById('manHours');
            let totalCountLabel = document.getElementById('totalCount');
            let totalManHours = 0
            const planIdsList = data.events.plan_ids_list;
            const afterRegistrationRows = document.querySelectorAll(".fc-event");
            afterRegistrationRows.forEach(row => {
                const dataId = parseInt(row.getAttribute('data-id'));
                if (planIdsList.includes(dataId) && row.style.display !== "none") {
                    totalManHours += parseInt(row.getAttribute('data-man-hours'));
                } else if (row.style.display !== "none") {
                    row.parentNode.removeChild(row);
                }
            });
            const remainingRowCount = document.querySelectorAll('.fc-event:not([style*="display: none"])').length;
            totalCountLabel.innerText = `全${remainingRowCount}枚`;
            totalManHoursLabel.innerText = `全${totalManHours}分`;
        });
    })
    const tableRows = document.querySelectorAll("#card-table tbody tr");
    tableRows.forEach((row) => {
        row.addEventListener("click", function() {
            const inspectionNo = this.getAttribute("data-inspection_no");
            handleRowClick(inspectionNo);
        });
    });
});

function decrementCounters(drop_man_hour) {
    const totalCountElem = document.getElementById('totalCount');
    const currentTotalCount = parseFloat(totalCountElem.textContent.match(/\d+/)[0]) - 1;
    totalCountElem.textContent = `全${currentTotalCount}枚`;
    const manHoursElem = document.getElementById('manHours');
    const currentManHours = parseFloat(manHoursElem.textContent.match(/\d+/)[0]) - drop_man_hour;
    manHoursElem.textContent = `総工数${currentManHours}分`;
}

function tableInitialize() {
    const tableBody = document.getElementById("card-detail-table-body");
    tableBody.innerHTML = '';
}

function updateProgressText(totalManHoursThisWeek, thisWeekEventsSize, totalManHoursLate, lateEventsSize) {
    const necessaryTimeElement = document.getElementById('necessaryTime');
    const necessaryTime = parseInt(necessaryTimeElement.textContent);
    necessaryTimeElement.textContent = necessaryTime + totalManHoursThisWeek;
    
    const thisWeekTotalCardElement =  document.getElementById('thisWeekTotalCard');
    const thisWeekTotalCard = parseInt(thisWeekTotalCardElement.textContent);
    thisWeekTotalCardElement.textContent = thisWeekTotalCard + thisWeekEventsSize;

    const necessaryLateTimeElement = document.getElementById('necessaryLateTime');
    const necessaryLateTime = parseInt(necessaryLateTimeElement.textContent);
    necessaryLateTimeElement.textContent = necessaryLateTime + totalManHoursLate;

    const thisWeekLateTotalCardElement = document.getElementById('thisWeekLateTotalCard');
    const thisWeekLateTotalCard = parseInt(thisWeekLateTotalCardElement.textContent);
    thisWeekLateTotalCardElement.textContent = thisWeekLateTotalCard + lateEventsSize;

}

function updateBarWidthAndPercentage(events) {
    const necessaryTimeElement = document.getElementById('necessaryTime');
    necessaryTimeElement.textContent = 0;

    const thisWeekTotalCardElement =  document.getElementById('thisWeekTotalCard');
    thisWeekTotalCardElement.textContent = 0;

    const necessaryLateTimeElement = document.getElementById('necessaryLateTime');
    necessaryLateTimeElement.textContent = 0;

    const thisWeekLateTotalCardElement = document.getElementById('thisWeekLateTotalCard');
    thisWeekLateTotalCardElement.textContent = 0;

    //const thisWeekEvents = events.filter(event => event.extendedProps.this_week === true);
    const thisWeekEvents = events.filter(event => event.extendedProps.planStatus === '実施待ち')
    const totalManHoursThisWeek = thisWeekEvents.reduce((total, event) => {
        return total + event.extendedProps.man_hours;
    }, 0);
    const thisWeekEventsSize = thisWeekEvents.length;
    const lateEvents = events.filter(event => event.extendedProps.planStatus === '遅れ');
    const totalManHoursLate = lateEvents.reduce((total, event) => {
        return total + event.extendedProps.man_hours;
    }, 0);
    const lateEventsSize = lateEvents.length
    updateProgressText(totalManHoursThisWeek, thisWeekEventsSize, totalManHoursLate, lateEventsSize);
}

function updateCalendar(memberName) {
    asynchronousCommunication({
        url: '/calendar/',
        method: 'POST',
        data: {
            action: "calendar_open",
            member: memberName
        }
    }).then((data) => {
        if (!isCalendarRendered) {
            //calendar.render();
            isCalendarRendered = true
            document.getElementById('calendarLabel').remove();
            document.getElementById('memberGraphLabel').remove()
            document.getElementById('memberGraph').style.display = 'block';
            let elementsWithNoneDisplay = document.querySelectorAll('.noneDisplay');
            elementsWithNoneDisplay.forEach(element => {
                element.classList.remove('noneDisplay');
            });
            //const memberStartTime = data.member_progress.member_start_time
            const memberStartTime = data.member_start_time
            const viewType = calendar.view.type;
            if(viewType.includes("timeGrid")) {
                calendar.setOption('scrollTime', memberStartTime);
                calendar.render();
            }
        } else {
            calendar.removeAllEvents()
            calendar.removeAllEventSources();
        }
        calendar.addEventSource(data.events);
        
        updateBarWidthAndPercentage(data.events);
        
    });
}
const orderedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function getOrderedOptions(options) {
    return orderedDays.filter(day => options.has(day));
}

document.addEventListener('DOMContentLoaded', function() {
    const filters = [
        {id: 'lineFilter', attribute: 'textContent', visible: new Set(), callback: filterTable},
        {id: 'machineFilter', attribute: 'textContent', visible: new Set(), callback: filterTable},
        {id: 'memberFilter', attribute: '', visible: new Set(),callback: null},
        {id: 'daysFilter', attribute: 'covdaysweek', visible: new Set(), callback: filterTable},
        {id: 'practitionerFilter', attribute: 'practitioner', visible: new Set(), callback: filterTable},
        {id: 'timezoneFilter', attribute: 'timezone', visible: new Set(), callback: filterTable},
    ];
    const dayMapping = {'月': 'Mon','火': 'Tue','水': 'Wed','木': 'Thu','金': 'Fri',
                        '土': 'Sat', '日': 'Sun', '': ''
    };
    filters.forEach(filter => initializeCustomSelect(filter.id, filter.callback));
    filterTable(filters);

    function initializeCustomSelect(id, callback) {
        tableInitialize()
        const customSelect = document.getElementById(id);
        const placeholder = customSelect.querySelector('.select-placeholder');
        const options = customSelect.querySelectorAll('.option');
        const select = customSelect.querySelector('select');
        const initiallySelectedOption = select.options[select.selectedIndex];
        const selectLabel = customSelect.querySelector('.select-label');

        placeholder.addEventListener('click', toggleOptions);
        selectLabel.addEventListener('click', toggleOptions);

        if (id !== 'memberFilter') {
            const allOption = document.createElement('div');
            allOption.className = 'option';
            allOption.dataset.value = "";
            allOption.textContent = "全て";
            customSelect.querySelector('.select-options').insertBefore(allOption, customSelect.querySelector('.select-options').firstChild);
            allOption.addEventListener('click', () => {
                placeholder.textContent = allOption.textContent;
                select.value = allOption.getAttribute('data-value');
                customSelect.classList.remove('open');
                if (callback) {
                    callback()
                }
            });
        }
        if (id !== 'daysFilter' && initiallySelectedOption) {
            placeholder.textContent = initiallySelectedOption.textContent;
        } else if (id === 'daysFilter') {
            placeholder.textContent = customSelect.getAttribute('data-today-weekday');
        }
        options.forEach(option => {
            option.addEventListener('click', () => {
                placeholder.textContent = option.textContent;
                select.value = option.getAttribute('data-value')
                customSelect.classList.remove('open');
                const event = new Event('change');
                select.dispatchEvent(event);
                if (callback) {
                    callback();
                }
            });
        });
        if (id === 'memberFilter') {
            select.addEventListener('change', function() {
                const updateMemberName = getSelectedMember();
                updateCalendar(updateMemberName);
                const registrationButton = document.querySelector('.buttonRegistration');
                registrationButton.style.pointerEvents = 'auto';
                registrationButton.style.opacity= '1'
            });
        }
        window.addEventListener('click', e => {
            if (!customSelect.contains(e.target)) {
                customSelect.classList.remove('open');
            }
        });
        function toggleOptions() {
            customSelect.classList.toggle('open');
        }
    }
    
    function filterTable(filters) {
        tableInitialize()
        const tableRows = document.querySelectorAll('#dataTable tbody tr');
        let totalManHours = 0;
        let totalCount = 0;
        let totalManHoursLabel = document.getElementById('manHours');
        let totalCountLabel = document.getElementById('totalCount');

        filters.forEach(filter => {
            filter.visible.clear()
            filter.value = document.getElementById(filter.id).querySelector('select').value;
            if (filter.id === 'daysFilter') {
                filter.value = dayMapping[filter.value]
            }
        });

        tableRows.forEach(row => {
            let visibleArr = []
            let shouldDisplay = true;
            filters.forEach(filter => {
                if (filter.id !== 'memberFilter') {
                    if (filter.attribute === 'textContent') {
                        filter.filterValue = row.querySelector(`td[data-type="${filter.id}"]`)[filter.attribute];
                    } else {
                        filter.filterValue = row.dataset[filter.attribute];
                    }
                    if (filter.filterValue != filter.value && filter.value !== "") {
                        visibleArr.push('False')
                        shouldDisplay = false;
                    } else {
                        visibleArr.push('True')
                    }
                } 
            });
            if (shouldDisplay) {
                row.style.display = "";
                totalManHours += parseInt(row.dataset.manHours, 10);
                totalCount += 1;
            } else {
                row.style.display = "none";
            }
            if (visibleArr.every(val => val === 'True')) {
                filters.forEach(filter => {
                    filter.visible.add(filter.filterValue);
                });
            }
        });

        totalCountLabel.innerText = '全' + totalCount + '枚';
        totalManHoursLabel.innerText = '総工数' + totalManHours + '分';

        filters.forEach(filter => {
            if (filter.id !== 'memberFilter'){
                updateSelectOptions(filter.id, filter.visible);
            }
        });
    }

    function updateSelectOptions(selectId, newOptions) {
        const select = document.getElementById(selectId).querySelector('select');
        const customOptionsContainer = document.getElementById(selectId).querySelector('.select-options');
        const currentSelectValue = select.value;
        const currentPlaceholder = document.getElementById(selectId).querySelector('.select-placeholder').textContent;
        select.innerHTML = '';
        customOptionsContainer.innerHTML = '';
        const allOption = new Option("全て", "");
        select.appendChild(allOption);
        const customAllOption = document.createElement('div');
        customAllOption.className = 'option';
        customAllOption.dataset.value = "";
        customAllOption.textContent = "全て";
        customOptionsContainer.appendChild(customAllOption)
        customAllOption.addEventListener('click', function() {
            select.value = "";
            document.getElementById(selectId).querySelector('.select-placeholder').textContent = "全て";
            customOptionsContainer.parentElement.classList.remove('open');
            filterTable(filters)
        });

        if (selectId === 'daysFilter') {
            newOptions = getOrderedOptions(newOptions);
        }

        newOptions.forEach(optionValue => {
            if (selectId === 'daysFilter') {
                optionValue = Object.keys(dayMapping).find(key => dayMapping[key] === optionValue)
            };
            const option = new Option(optionValue, optionValue);
            select.appendChild(option);
            const customOption = document.createElement('div');
            customOption.className = 'option';
            customOption.dataset.value = optionValue;
            customOption.textContent = optionValue;
            customOptionsContainer.appendChild(customOption);
            customOption.addEventListener('click', function() {
                select.value = optionValue;
                document.getElementById(selectId).querySelector('.select-placeholder').textContent = optionValue;
                customOptionsContainer.parentElement.classList.remove('open');
                filterTable(filters)
            });
        });
        select.value = currentSelectValue;
        const placeholder = document.getElementById(selectId).querySelector('.select-placeholder');
        if (select.value == '') {
            placeholder.textContent = currentPlaceholder;
        } else {
            placeholder.textContent = select.value;
        }
    }
});
