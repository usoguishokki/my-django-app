import { ChartSetup } from  './chartSetup.js'
import { UIManger } from '../manager/UIManger.js'
import { TableManager } from '../manager/TableManger.js'
import Gantt from '../frappeGantt/NewFrappeGantt.js'
import { $ } from '../frappeGantt/svg_utils.js'
import date_utils from '../frappeGantt/data_utils.js';
import { HomeColumnManager } from './homeMappingConfig.js'
import { adjustGridHeight } from './layout.js'

import { initializeLoadingScreen } from '../manager/loadingManager.js';

class Home {
    constructor() {
        document.addEventListener('DOMContentLoaded', this.onDocumentLoaded.bind(this));
        initializeLoadingScreen();
        const loginMemberContents = document.getElementById('employeeName');
        this.scheduleSelect = document.getElementById('scheduleSelect');
        this.loginMember = loginMemberContents.getAttribute('data-employee-id');
        this.lateDate = null
        this.ganttSetUpInstance = null;
        this.selectedMemberElement = UIManger.selectUserProfile('statusSelect', this.loginMember);
        this.donutChart = new ChartSetup('itemProgress', 'myDonutChart');
        this.beforeAffiliation = '';
        UIManger.addEventListenerToElement(this.selectedMemberElement, 'change', () => {
            this.statusUpdate();
            this.initializeGanttChart();
        });
        this.homeColumnManager = new HomeColumnManager();
        this.getStatusConfig(); 
        this.tableSetup();
        this.statusSelectDataInsert();
    }



    async onDocumentLoaded() {
        this.visibleRows = this.tableManager.homeFilterTable();
        this.shouldCalculateEndDay(this.visibleRows);
        this.setupButtons();
        this.updateScrollTable();
        //this.initStyles();
        this.initializeGanttChart();
        const throttleApplyResponsiveStyles = UIManger.throttle(this.applyResponsiveStyles.bind(this), 200)
        UIManger.addEventListenerToElement(window, 'resize', throttleApplyResponsiveStyles);
        this.applyResponsiveStyles();
        this.mobileSetup();
    }

    getStatusConfig() {
        this.statusConfig = this.homeColumnManager.statusConfig;
        this.statusLabels = Object.values(this.statusConfig).map(config => config.label);
    }

    tableSetup() {
        const onRowClick = (row) => {
            const planId = row.getAttribute('data-plan-id');
            //指定されたplanIdを持つURLへ遷移
            window.location.href = `/card/?planId=${planId}`;
        };

        this.tableManager = new TableManager('myTable', {
            onRowClick,
            'isDraggable': false
        }, null, this.homeColumnManager);
        this.setupTableConditions({'data-status': '実施待ち'},
        'filterVisbledRow');
        this._toggleColumnVisible('label' ,'実施待ち')
        this.subTitleInner('実施待ち');
    }

    mobileSetup() {
        this.scrollToTargetRow(this.visibleRows);
        const modalThisWeek = document.getElementById('modalThisWeek');
        const modalDelay = document.getElementById('modalDelay');
        UIManger.addEventListenerToElement(
            modalThisWeek,
            'click',
            () => {this.getCardForm({'data-status': '実施待ち'}, modalThisWeek)}
        );
        UIManger.addEventListenerToElement(
            modalDelay,
            'click',
            () => {this.getCardForm({'data-status': '遅れ'} ,modalDelay)}
        );
        UIManger.addEventListenerToElement(
            this.tableScroll,
            'scroll',
            UIManger.throttle(this.handleScroll.bind(this), 300)
        );
        window.addEventListener('pageshow', this.handlePageShow.bind(this));
    }

    statusSelectDataInsert() {
        const teams = ["A班", "B班", "C班"]
        teams.forEach(team => {
            const Element = this.selectedMemberElement.querySelectorAll(`option[data-affilation="${team}"]`);
            const shiftStartTime = Element[1] ? Element[1].getAttribute('data-shift-start') : null;
            const shiftStartEnd = Element[1] ? Element[1].getAttribute('data-shift-End') : null;

            Element[0].setAttribute('data-shift-start', shiftStartTime);
            Element[0].setAttribute('data-shift-end', shiftStartEnd);
        })
    }

    insertDayText(text) {
        const dayTextElement = document.getElementById('dayText');
        dayTextElement.textContent = ''
        const formatText = UIManger.formatDate(text, 'm月d日');
        dayTextElement.textContent = formatText
    }

    getMembers() {
        const member = this.selectedMemberElement.value;
        const options = this.selectedMemberElement.options;
        let affiliation = '';
        let shift_start = '';
        let shift_end = '';
        const members = [];
        const excludeAffilations = ['A班', 'B班', 'C班'];
        
        for (let i=0; i < options.length; i++) {
            if(options[i].value === member) {
                affiliation = options[i].getAttribute('data-affilation');
                const str_shift_start = options[i].getAttribute('data-shift-start')
                shift_start = UIManger.addMinutesToDate(new Date(str_shift_start), "-120");
                shift_end = UIManger.addMinutesToDate(new Date(options[i].getAttribute('data-shift-end')), '120');
                this.insertDayText(str_shift_start)
                break;
            }
        }
        for (let i=0; i < options.length; i++) {
            if (options[i].getAttribute('data-affilation') === affiliation && !excludeAffilations.includes(options[i].value)) {
                members.push(options[i].getAttribute("data-user-name"));
            }
        }
        return { members, shift_start, shift_end };
    }

    initializeGanttChart() {
        if(this.ganttSetUpInstance) {
            this.ganttSetUpInstance.atac();
            return;
        }
        this.ganttSetUpInstance = new GanttSetUp(this);
    }

    handlePageShow() {
        this.removeAcitveClass()
    }

    getCardForm(status ,element) {
       this.clickaddStyle(element);
       this.setupTableConditions(status, 'tagetTableListUp');
       const rows= this.tableManager.homeFilterTable();
       const queryString = rows.map(id => `planId=${id}`).join('&');
       const url = `/card/?${queryString}`;
       window.location.href = url
    };

    clickaddStyle(element) {
        const targetElment = element;
        UIManger.toggleClass(targetElment, 'active', 'add');
    }

    removeAcitveClass() {
        const modalThisWeek = document.getElementById('modalThisWeek');
        const modalDelay = document.getElementById('modalDelay');
        UIManger.toggleClass(modalThisWeek, 'active', 'remove');
        UIManger.toggleClass(modalDelay, 'active', 'remove');
    }

    init() {
        adjustGridHeight(this.tableScroll)
        this.donutChart.chartResize();
    }

    updateScrollTable() {
        this.tableScroll = document.getElementById('tableScroll');
    }

    scrollToTargetRow = (visibleRows) => {
        const now = new Date();
        this.updateScrollTable();
        const targetRow = this.findTargetRow(visibleRows, now);
        if (targetRow) {
            this.tableManager.scrollToRow(this.tableScroll, targetRow);
        }
    };

    findTargetRow = (rows, now) => {
        for (const row of rows) {
            const startTimeStr = row.getAttribute('data-start-time');
            const startTime = new Date(startTimeStr);
            if (!isNaN(startTimeStr)) continue;
            if(startTime > now) {
                return row;
            }
        }
        return null;
    }


    mobileAjustHeight() {
        const lHeaderElement = document.querySelector('.l-header');
        this.lHeaderHight = lHeaderElement.getBoundingClientRect().height;
        const windowHeight = UIManger.getScreenHeight();
        const tableContenerHeight = this.tableScroll.getBoundingClientRect().top;
        const tableHight = windowHeight - tableContenerHeight;
        this.tableScroll.style.maxHeight = `${tableHight}px`;
    }
    setupButtons() {
        document.getElementById('btnPending')?.classList.add('active');
        document.querySelector('.buttons-container').addEventListener('click', event => {
            let targetElement = event.target;
            //クリックされた要素が<span>の場合、その親要素を対象とする
            if (targetElement.tagName === 'SPAN') {
                targetElement = targetElement.closest('.filter-btn');
            }
            
            if (targetElement && targetElement.classList.contains('filter-btn')) {
                //全てのボタンから'active'クラスを削除し、クリックされたボタンに'active'クラスを追加
                document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                targetElement.classList.add('active');
                const buttonId = targetElement.id;
                const statusConfig = this._toggleColumnVisible('btn' ,buttonId);
                this.setupTableConditions({'data-status': statusConfig.label}, 'filterVisbledRow');
                this.subTitleInner(statusConfig.label);
            }

            
            this.tableManager.homeFilterTable();
        })
        this.updateButtonCounts();
    }

    subTitleInner(str) {
        const subTitle = document.getElementById('subTitle');
        subTitle.innerText = str;
    }    

    updateButtonCounts() {
        //ステータスの件数をカウント
        const counts = this.buttonStatusCounts(this.statusLabels);
        document.querySelectorAll('.filter-btn').forEach(button => {
            const label = button.dataset.tooltip;
            const count = counts[label];
            button.querySelector('.count').textContent = `${count}`;
        });
    }

    chartCountStatusValues() {
        const selectedMember = this.selectedMemberElement.value;
        const { affiliation } = this.getAffilationAndUserId();
        const counts = {
            'team': {},
            'personal': {},
            'graph': {}
        }
        const statusValues = ['配布待ち' ,'実施待ち', '承認待ち', '差戻し', '遅れ'];

        statusValues.forEach(status =>{
            counts['personal'][status] = 0;
            counts['team'][status] = 0;
            counts['graph'][status] = 0;
        });

        const holderCounts = {};
        const details = {};

        statusValues.forEach(status => {
            //メンバー今週
            if (status !== '完了') {
                counts['personal'][status] = document.querySelectorAll(`tr[data-status="${status}"][data-holder-member-id="${selectedMember}"]`).length;
            }

            counts['team'][status] = document.querySelectorAll(`tr[data-status="${status}"][data-affilation="${affiliation}"]`).length;
            
            document.querySelectorAll(`tr[data-status="${status}"][data-affilation="${affiliation}"]`).forEach(row => {
                const holder = row.getAttribute('data-holder-name');

                if (!holderCounts[status]) {
                    holderCounts[status] = {};
                }

                if(!holderCounts[status][holder]) {
                    holderCounts[status][holder] = 0;
                }

                holderCounts[status][holder]++;
                counts['graph'][status]++;
            });
        });

        Object.entries(holderCounts).forEach(([status, holders]) => {
            details[status] = {};
            Object.entries(holders).forEach(([holder, count]) => {
                details[status][holder] = count
            });
        });

        this.progressRadioUpdate(counts);
        return { counts, details };
    }

    progressRadioUpdate(counts) {
        const denominator1 = document.getElementById('denominator1');
        denominator1.textContent = counts['team']['配布待ち'] + counts['team']['実施待ち'];

        const molecule2 = document.getElementById('molecule2');
        molecule2.textContent = counts['personal']['実施待ち'] + counts['personal']['遅れ'] + counts['personal']['差戻し'];
    }

    buttonStatusCounts(statusArray) {
        const counts = {};
        const { affiliation } = this.getAffilationAndUserId();
        const selectedOption = this.selectedMemberElement.options[this.selectedMemberElement.selectedIndex];
        const userId = selectedOption.getAttribute('data-user-id');

        let modalDelayMaker = '';
        statusArray.forEach(status => {
            if(userId) {
                if (status != '配布待ち') {
                    if (status !== '完了') {
                        //counts[status] = document.querySelectorAll(`tr[data-status="${status}"][data-holder-member-id="${userId}"][data-affilation="${affiliation}"]`).length;
                        counts[status] = document.querySelectorAll(`tr[data-status="${status}"][data-holder-member-id="${userId}"]`).length;
                    } else {
                        counts[status] = Array.from(document.querySelectorAll(`tr[data-status="完了"]`)).filter(row => {
                            const practitioners = row.getAttribute('data-practitioner-id').split(', ');
                            return practitioners.includes(userId);
                        }).length;
                    }
                }else {
                    counts[status] = document.querySelectorAll(`tr[data-status="${status}"][data-affilation="${affiliation}"]`).length;
                }
            } else {
                counts[status] = document.querySelectorAll(`tr[data-status="${status}"][data-affilation="${affiliation}"]`).length;
            }
            if (counts['遅れ'] > 0) {
                modalDelayMaker = document.getElementById('modalDelayMaker');
                UIManger.toggleClass(modalDelayMaker, 'maker-alarm', 'add');
            } else  {
                modalDelayMaker = document.getElementById('modalDelayMaker');
                UIManger.toggleClass(modalDelayMaker, 'maker-alarm', 'remove');
            }
        });
        return counts;
    }

    getAffilationAndUserId() {
        const selectedOption = this.selectedMemberElement.options[this.selectedMemberElement.selectedIndex];
        if (selectedOption) {
            return {
                affiliation: selectedOption.dataset.affilation || null,
                userId: selectedOption.dataset.userId || null
            };
        } else {
            return {
                affiliation: this.selectedMemberElement.value,
                userId: null
            };
        }
    }

    getChartConfig() {
        const stack = new Error().stack;
        const outerSegments = [
            { label: '実施待ち', color: 'rgb(0, 204, 102)' },
            { label: '承認待ち', color: 'rgb(255, 215, 0)' },
            //{ label:  '完了', color:'rgb(9, 101, 193)' },
            { label: '差戻し', color: 'rgb(255, 153, 153)' },
            { label: '遅れ', color: 'rgb(221, 53, 53)'}
        ];

        const { counts, details } = this.chartCountStatusValues();

        const labels = ['実施待ち', '承認待ち', '差戻し', '遅れ'];
        
        const teamAllCounts = Object.fromEntries(
            Object.entries(counts['graph']).filter(([key]) => key !== '配布待ち')
        );
        
        const pairList = Object.entries(teamAllCounts).map(([key, value]) => `${key}(${value})`);
        const outerData = outerSegments.map(segment => teamAllCounts[segment.label] || 0);
        const innerData = [];
        const innerBackgroundColor = [];
        const innerLabels = [];
        const innerOuterMap = [];

        outerSegments.forEach((segment, outerIndex) => {
            const segmentData = Object.entries(details[segment.label] || {}).length
                                ? Object.entries(details[segment.label])
                                :[['unkwon', 0]];
            segmentData.forEach(([name, data], i) => {
                const hueShift = (i + 1) * 10.8; // 色相のシフトを小さく
                const saturationShift = 0.12; // 彩度のシフト
                const lightnessShift = -0.06; // 明度のシフト
                const shiftedColor = UIManger.shiftHue(segment.color, hueShift, saturationShift, lightnessShift);
                innerData.push(data);
                innerBackgroundColor.push(shiftedColor);
                innerLabels.push(name);
                innerOuterMap.push({ outerIndex, name })
            });
        });
        const chartData = {
            labels: pairList,
            datasets: [{
                data: outerData,
                backgroundColor: outerSegments.map(segment => segment.color),
                hoverOffset: 4,
                borderWidth: 2,
                borderColor: '#fff',
                labels: labels
            }, {
                data: innerData,
                backgroundColor: innerBackgroundColor,
                borderWidht: 4,
                cutout: '55%',
                labels: innerLabels
            }]
        };
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '80%',
            plugins: {
                legend: {  
                    position: 'right',
                    onClick: (e, legendItem, legend) => {
                        const ci = legend.chart;
                        const index = legendItem.index;
                        const outerMeta = ci.getDatasetMeta(0);
                        const innerMeta = ci.getDatasetMeta(1);
            
                        // ArcElementにhiddenプロパティがなければ追加する
                        if (typeof outerMeta.data[index].hidden === 'undefined') {
                            outerMeta.data[index].hidden = false;
                        }
            
                        outerMeta.data[index].hidden = !outerMeta.data[index].hidden;
            
                        // innerデータセットの対応するセグメントの表示/非表示を切り替え
                        innerOuterMap.forEach((mapping, innerIndex) => {
                            if (mapping.outerIndex === index) {
                                if (typeof innerMeta.data[innerIndex].hidden === 'undefined') {
                                    innerMeta.data[innerIndex].hidden = false;
                                }
                                innerMeta.data[innerIndex].hidden = outerMeta.data[index].hidden;
                            }
                        });
                        ci.toggleDataVisibility(index);
                        ci.update();
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function() {
                            return '';
                        },
                        label: function(tooltipItem) {
                            const dataIndex = tooltipItem.dataIndex;
                            const datasetIndex = tooltipItem.datasetIndex;
                            const dataset = tooltipItem.chart.data.datasets[datasetIndex];
                            const label = dataset.labels[dataIndex];
                            if (datasetIndex === 1) { // inner datasetの場合
                                const { outerIndex } = innerOuterMap[dataIndex];
                                const outerLabel = tooltipItem.chart._sortedMetasets[0]._dataset.labels[outerIndex]
                                return `${outerLabel}: ${label}: ${dataset.data[dataIndex]}`;
                            } else { // outer datasetの場合
                                return `${tooltipItem.label}`;
                            }
                        }
                    }
                },
                centerText: {
                    text: '',
                    fontSize: '1.5rem',
                    fontFamily: 'Helvetia',
                    position: {}
                }
            }
        };
        return { chartData, chartOptions };
    }

    initChartsOnDocumentLoaded() {
        try {
            const { chartData, chartOptions } = this.getChartConfig();
            this.donutChart.createDonutChart(chartData, chartOptions);
            this.init()
        } catch (error) {
            console.error("Chart initialization failed:", error);
        }
    }

    statusUpdate() {
        const { chartData, chartOptions } = this.getChartConfig();
        this.donutChart.chart.data = chartData;
        this.donutChart.chart.options = chartOptions;
        this.donutChart.chart.update();
        const activeButton = this.getButtonStatus();
        this.setupTableConditions({ 'data-status': activeButton.dataset.tooltip }, 'filterVisbledRow');
        this._toggleColumnVisible('label', activeButton.dataset.tooltip)
        this.visibleRows = this.tableManager.homeFilterTable();
        this.updateButtonCounts();
        this.shouldCalculateEndDay(this.visibleRows);
    }

    getButtonStatus() {
        const activeButton = document.querySelector(".filter-btn.active");
        return activeButton;
    }

    setupTableConditions(filterConditions, filterPattern) {
        const selectedMemberElement = this.selectedMemberElement;
        const { affiliation, userId }  =  this.getAffilationAndUserId();
        if (UIManger.isValidValue(filterConditions)) {
            this.tableManager.filterConditions = {};
            this.tableManager.filterConditions = { ...filterConditions };
            this.tableManager.options.filterPattern = filterPattern;
            if (!UIManger.isValidValue(userId) && affiliation) {
                this.tableManager.filterConditions['affiliation'] = selectedMemberElement.value;
            } else if (UIManger.isValidValue(userId)) {
                this.tableManager.filterConditions['data-holder-member-id'] = selectedMemberElement.value;
                this.tableManager.filterConditions['affiliation'] = affiliation
            }
        }
    }

    shouldCalculateEndDay(rows) {
        rows.forEach(row => {
            this.appendWorkNameToControlName(row);
            this.appendEndTimeToStartTime(row);            
        });
    }

    appendWorkNameToControlName(row) {
        const workNameText = row.getAttribute('data-work-name');
        const controlNameSpan = row.querySelector('.control-name-line-break');
        if (controlNameSpan) {
            const br = document.createElement('br');
            br.classList.add('margin-br');
            controlNameSpan.appendChild(br);
            controlNameSpan.appendChild(document.createTextNode(workNameText));
        }
    }

    appendEndTimeToStartTime(row) {
        const startTime = row.getAttribute('data-start-time');
        const manHour = row.getAttribute('data-man-hour');

        if (UIManger.isValidDate(startTime)) {
            const endTime = UIManger.addMinutesToDate(startTime, manHour);
            const endTimeISO = UIManger.formatDateStringToISO(endTime);
            const endTimeText = UIManger.formatDate(endTimeISO, 'H:i');

            const startTimeSpan = row.querySelector('.start-time-line-break');
            if (startTimeSpan) {
                const br = document.createElement('br');
                br.classList.add('margin-br');
                startTimeSpan.appendChild(br);
                startTimeSpan.appendChild(document.createTextNode(endTimeText));
            }
        }
    }


    applyResponsiveStyles() {
        const taskTimeLine = document.getElementById('taskTimeLine');
        const itemList = document.getElementById('itemList');
        const breakpoints = UIManger.breakpoints;
        const tableTh = document.getElementById("tableTh");
        const moveTableScroll = () => {
            const innerWidth = UIManger.getScreenWidth()
            if (innerWidth <= breakpoints.xs) {
                if (!taskTimeLine.contains(this.tableScroll)) {
                    taskTimeLine.appendChild(this.tableScroll);
                    UIManger.toggleClass(this.tableScroll, 'desktop-table', 'remove');
                    UIManger.toggleClass(this.tableScroll, 'mobile-table', 'add');
                    this.progressTextUpdate();
                    this._toggleColumnVisible('label', 'mobile');
                    UIManger.toggleClass(tableTh, 'display-none', 'add');
                    this.mobileAjustHeight();
                }
            } else if (innerWidth > breakpoints.xs && innerWidth <= breakpoints.sm) {
            } else if (innerWidth > breakpoints.sm && innerWidth <= breakpoints.md) {
            } else if (innerWidth > breakpoints.md && innerWidth <= breakpoints.lg) {
            } else if(innerWidth > breakpoints.lg) {
                if (taskTimeLine.contains(this.tableScroll)) {
                    itemList.appendChild(this.tableScroll);
                    UIManger.toggleClass(this.tableScroll, 'mobile-table', 'remove');
                    UIManger.toggleClass(this.tableScroll, 'desktop-table', 'add');
                }
                this.initChartsOnDocumentLoaded();
            }
        }
        moveTableScroll();
    }

    _toggleColumnVisible(property, value) {
        const statusColumnsConfig = Object.values(this.statusConfig).find(config => config[property] === value) || null;
        this.tableManager.toggleColumnVisible(statusColumnsConfig.columnsStyle);
        return statusColumnsConfig
    }

    progressTextUpdate() {
        const modalThisWeekTextContent = document.getElementById('modalThisWeekText');
        const modalDelayTextContent = document.getElementById('modalDelayText');
        const countBtnPending = document.querySelector('#btnPending .count');
        const countbtnDelayed = document.querySelector('#btnDelayed .count');
        if (countBtnPending) {
            const countBtnPendingText =  countBtnPending.textContent;
            const covCountBtnPendingText = countBtnPendingText.replace(/[()]/g, '');
            modalThisWeekTextContent.textContent = covCountBtnPendingText;
        }
        if (countbtnDelayed) {
            const countbtnDelayedText = countbtnDelayed.textContent;
            const covcovCountBtnPendingText = countbtnDelayedText.replace(/[()]/g, '');
            modalDelayTextContent.textContent = covcovCountBtnPendingText;
        }
    }

    handleScroll() {
        //this.checkVisibleRows()
    }

    checkVisibleRows() {
        let oldestDate = null;
        let newestDate = null;
        let oldestDateStr = '';
        let newestDateStr = '';
        this.startDay.textContent = ''
        this.visibleRows.forEach((row, index) => {
            const rowRect = row.getBoundingClientRect();
            const containerRect = this.tableScroll.getBoundingClientRect();
            if (rowRect.top >= (containerRect.top -5) && rowRect.bottom <= (containerRect.bottom + 5)) {
                const startTime = row.getAttribute('data-start-time');
                if (startTime) {
                    const date = new Date(startTime);
                    if (!oldestDate || date < oldestDate) {
                        oldestDate = date;
                    }
                    if (!newestDate || date > newestDate) {
                        newestDate = date
                    }
                }
            }
        });
        oldestDateStr = `${oldestDate.getMonth() + 1}月${oldestDate.getDate()}日`;
        if(newestDate) {
            newestDateStr = `${newestDate.getMonth() + 1}月${newestDate.getDate()}日`;
        }
        if (oldestDateStr === newestDateStr) {
            this.startDay.textContent = oldestDateStr; 
        } else if (UIManger.isValidValue(newestDateStr)) {
            this.startDay.textContent = `${oldestDateStr}~${newestDateStr}`
        }
    }
}

class GanttSetUp {
    constructor(homeInstance) {
        this.homeInstance = homeInstance
        this.ganttElement = document.getElementById('gantt');
        this.makeOptions();
        this.makeTasks();
        this.gantt = new Gantt('#gantt', this.tasks, this.options, this);
        this.rowHeight = this.gantt.options.bar_height + this.gantt.options.padding
        this.makeAssigneeNames();
        this.computeInitialSize();
        this.initaGanttdjustGridHeight();
        this.attachEvnetListeners();    
        this.updatePeding = false; //更新が保留されているかを追跡するフラグ
        this.isScrolling;
        this.scrollToPosition()
    }

    makeTasks() {
        const { affiliation } =  this.homeInstance.getAffilationAndUserId();

        const filteredRows = Array.from(document.querySelectorAll('#myTable tbody tr'))
            .filter(row => 
                (row.dataset.status === '実施待ち' || row.dataset.status === '遅れ')
            );
        const shift_start = this.options.shift_start;
        const shift_end = this.options.shift_end;
        this.tasks = filteredRows.map(row => {
            const taskStartTime = new Date(row.dataset.startTime);
            const manHour = parseInt(row.dataset.manHour, 10);
            if ((taskStartTime >= shift_start) && (taskStartTime < shift_end)) {
                return {
                    id: row.dataset.planId,
                    name: `${row.dataset.controlName}_${row.dataset.workName}`,
                    start: taskStartTime,
                    end: date_utils.add(taskStartTime, manHour, 'minute'),
                    assignee: row.dataset.holderName
                };
            } else {
                return null;
            }
        }).filter(task => task != null);
    }

    makeOptions() {
        const { members, shift_start, shift_end } = this.homeInstance.getMembers();
        this.options = {
            header_height: 50,
            bar_height: 20,
            view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month', 'Time'],
            view_mode: 'Time',
            date_format: 'YYYY-MM-DDTHH:mm',
            shift_start: shift_start,
            shift_end: shift_end,
            popup_trigger: 'mouseover',
            members: members
        }
    }

    makeAssigneeNames() {
        //担当者の名前をHTMLに追加
        const assigneeNames = Object.keys(this.gantt.assigneeRows);
        //担当者名を表示するためのdiv要素を作成
        const assigneeNamesDiv = document.createElement('div');
        assigneeNamesDiv.className = 'assignee-names';
        //assignee-namesの位置の指定
        assigneeNamesDiv.style.top = `${this.assigneeNamesHeaderHeight}px`
        const nameDivHeight = this.gantt.options.bar_height + this.gantt.options.padding;
        assigneeNames.forEach((assignee, index) => {
            const nameDiv = document.createElement('div');
            nameDiv.classList.add('assignee-name');
            nameDiv.setAttribute('data-row-number', index);
            nameDiv.style.height = `${nameDivHeight}px`;
            nameDiv.style.width = `${this.gantt.gantt_offset_width}px`;
            const nameSpan = document.createElement('span');
            nameSpan.textContent = assignee;
            nameDiv.appendChild(nameSpan);
            assigneeNamesDiv.appendChild(nameDiv);
        });
        const assigneeContainer = document.querySelector('.assignee-container');                     
        assigneeContainer.appendChild(assigneeNamesDiv);
        this.ganttHeaderText = document.querySelectorAll('.gantt-header text');
    }

    computeInitialSize(){
        this.row2Rect = document.querySelector('.row2').getBoundingClientRect();
        const groupScheduleTitle = document.getElementById('groupScheduleTitle')
        this.groupScheduleTitleHeight = UIManger.calculateBoxModelDimensions(groupScheduleTitle, ['marginTop', 'marginBottom']);
        this.ganttHeaderContainerRect = document.querySelector('.gantt-header-container').getBoundingClientRect();

        const headerGrid = document.querySelector('.gantt-header-grid');
        const headerGridRect = headerGrid.getBoundingClientRect();
        this.headerGridBottomY = headerGridRect.top + headerGridRect.height;
    }

    initaGanttdjustGridHeight() {
        const ganttContainerParent = document.querySelector('.gantt-container-parent');
        const ganttContainerMaxHeight = this.row2Rect.height - (this.groupScheduleTitleHeight + this.ganttHeaderContainerRect.height + 20)
        ganttContainerParent.style.maxHeight = `${ganttContainerMaxHeight}px`
    }

    //イベントリスナーをアタッチするメソッド
    attachEvnetListeners() {
        let lastScrollTop = this.ganttElement.scrollTop;
        let lastScrollLeft = this.ganttElement.scrollLeft;
        $.on(this.ganttElement , 'scroll', () => {
            let scrollDirection = '';
            let currentScrollTop = this.ganttElement.scrollTop;
            let currentScrollLeft = this.ganttElement.scrollLeft;

            if (currentScrollTop !== lastScrollTop) {
                scrollDirection = 'vertical'
            } else if (currentScrollLeft !== lastScrollLeft) {
                scrollDirection = 'horizontal';
            }
            if (scrollDirection) {
                this.requestUpdate(scrollDirection);
            }
            lastScrollTop = this.ganttElement.scrollTop;
            lastScrollLeft = this.ganttElement.scrollLeft;
        });
    }
    

    //更新をリクエストするメソッド
    requestUpdate(scrollDirection) {
        //更新が既に保留されている場合は、何もしない
        if(this.updatePending) {
            return;
        }
        this.updatePending = true;

        //次に描画前に更新をスケジュールする
        requestAnimationFrame(() => {
            this.updatePositions(scrollDirection);
            this.updatePending = false;
        });
    }

    updatePositions(scrollDirection) {
        clearTimeout(this.isScrolling);
        switch (scrollDirection) {
            case 'vertical':
                this.updateAssigneeContainerPosition(this.ganttElement.scrollTop);
                this.isScrolling = setTimeout(() => {
                    const currentScrollTop = this.ganttElement.scrollTop;
                    const nearstRowStart = Math.round(currentScrollTop / this.rowHeight) * this.rowHeight
                    this.ganttElement.scrollTop = nearstRowStart;
                }, 66);
                break;

            
            //横スクロールが発生したか検出
            case 'horizontal':
                this.isScrolling = setTimeout(() => {
                    const currentScrollLeft = this.ganttElement.scrollLeft;
                    this.updateGanttHeaderPosition(currentScrollLeft);
                    this.lastScrollLeft = currentScrollLeft;
                }, 22);
                break;
        }
    }

    //assignee-containerの縦位置を更新するメソッド
    updateAssigneeContainerPosition(scrollTop) {
        const ganttContainerParentRect = document.querySelector('.gantt-container-parent').getBoundingClientRect();
        const assigneeContainer = document.querySelector('.assignee-container');
        assigneeContainer.style.transform = `translateY(${-scrollTop}px)`;
        const assigneeNames = document.querySelectorAll('.assignee-name');
        assigneeNames.forEach(name => {
            const nameRect = name.getBoundingClientRect();
            let rowNumber = name.getAttribute('data-row-number');
            let element = document.querySelector(`.grid-row[data-row-number="${rowNumber}"]`);
            if (nameRect.bottom < this.headerGridBottomY) {
                UIManger.toggleClass([element, name], 'display-none', 'add');
            } else {
                UIManger.toggleClass([element, name], 'display-none', 'remove');
            }
            if (nameRect.bottom > (ganttContainerParentRect.top + ganttContainerParentRect.height)) {
                UIManger.toggleClass([element, name], 'display-none', 'add');
            }
        })   
    }

    //gantt-header-containerの横位置を更新するメソッド
    updateGanttHeaderPosition(scrollLeft) {
        const ganttHeaderContainer = document.querySelector('.gantt-header-container');
        ganttHeaderContainer.style.transform = `translateX(${-scrollLeft}px)`;

        const dayTextElement = document.getElementById('dayText');
        dayTextElement.textContent = ''
        const dataDictionary = {};
        let textDay = ''

        //transformの値からtranlateXの値を取得
        const transformXValue = ganttHeaderContainer.style.transform;
        const translateX = parseInt(transformXValue.replace('translateX(', '').replace('px)', ''), 10);
        const widthXMin = translateX - this.gantt.gantt_offset_width;
        const widthXMax = widthXMin - this.ganttElement.offsetWidth;

        this.ganttHeaderText.forEach((textElements) => {
            const xPosition = parseInt(textElements.getAttribute('x'), 10);
            if (xPosition <= Math.abs(widthXMin) || xPosition > Math.abs(widthXMax)) {
                UIManger.toggleClass([textElements], 'display-none', 'add');
            } else {
                UIManger.toggleClass([textElements], 'display-none', 'remove')
                textDay = textElements.getAttribute('data-day');
                if (textDay && !(textDay in dataDictionary)) {
                    dataDictionary[textDay] = true;
                    let currentText = dayTextElement.textContent;
                    if (currentText) {
                        dayTextElement.textContent = `${currentText} - ${textDay}`;
                    } else {
                        dayTextElement.textContent = textDay;
                    }
                }
            }
        });
    }

    scrollToPosition() {
        if (this.ganttElement ) {
            this.ganttElement .scrollTo({
                left: this.gantt.containerXCoorinate -250,
                behavior: 'smooth'
            });
        }
    }

    upDateGantt(data) {
        const tbodies = document.getElementById('myTable');
        const tableTr = tbodies.querySelectorAll('tr');
        const tagetValue = data.plan_id;
        const updates = {
            'data-holder-name': data.new_member_holder,
            'data-holder-member-id': data.new_member_holder_id
        }
        const _isValidDate = UIManger.isValidDate(data.new_plan_time)
        if (_isValidDate) {
            const startDate = UIManger.formatDateStringToISO(data.new_plan_time);
            updates['data-start-time'] = startDate
        }
        UIManger.changeMulitipeElementsAttributeValue(tableTr, 'data-plan-id', tagetValue, updates);

        this.homeInstance.updateButtonCounts()
        this.homeInstance.statusUpdate();
    }

    clear_assignee_names() {
        const assigneeNames_Div = document.querySelector('.assignee-names');
        if (assigneeNames_Div && assigneeNames_Div.parentNode) {
            assigneeNames_Div.parentNode.removeChild(assigneeNames_Div);
        }
    }

    atac() {
        this.clear_assignee_names();
        const { members, shift_start, shift_end } = this.homeInstance.getMembers();
        this.options.members = members;
        this.options.shift_start = shift_start;
        this.options.shift_end = shift_end;
        this.makeTasks();
        this.gantt.custom_render('#gantt', this.tasks, this.options)
        this.makeAssigneeNames();
        this.computeInitialSize();
        this.initaGanttdjustGridHeight();
        this.attachEvnetListeners();
        this.scrollToPosition()
    }
}

new Home()


