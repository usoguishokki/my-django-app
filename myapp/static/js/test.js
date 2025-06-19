import Gantt from './NewFrappeGantt.js';
import { $ } from './svg_utils.js';

class GanttSetUp {
    constructor() {
        this.makeTasks();
        this.makeOptions();
        this.gantt = new Gantt('#gantt', this.tasks, this.options);
        this.makeAssigneeContainer();
        this.makeAssigneeHeader();
        this.makeAssigneeNames();
        this.attachEvnetListeners();
        this.updatePeding = false; //更新が保留されているかを追跡するフラグ
        this.scrollToPosition()
    }

    makeTasks() {
        this.tasks = [
            {
                id: 'Task 1',
                name: 'プロジェクト計画',
                start: '2024-04-05 07:00', //日付と時間は空白で区切る
                end: '2024-04-05 07:50', //日付と時間は空白で区切る
                progress: 100,
                dependencies: '',
                assignee: '山田太郎'
            },
            {
                id: 'Task 2',
                name: 'プロジェクト開発',
                start: '2024-04-02 22:00',
                end: '2024-04-02 23:00',
                progress: 60,
                dependencies: '', //複数のdependenciesを設定する際は'Task 1, Task 2'のように記述する
                assignee: '山田太郎'
            },
            {
                id: 'Task 3',
                name: '品質検証',
                start: '2024-04-03 01:00',
                end: '2024-04-03 01:15',
                progress: 30,
                dependencies: '',
                assignee: '鈴木一郎'
            },
            {
                id: 'Task 1',
                name: 'プロジェクト計画',
                start: '2024-04-02 23:00', //日付と時間は空白で区切る
                end: '2024-04-02 23:25', //日付と時間は空白で区切る
                progress: 100,
                dependencies: '',
                assignee: '山田太郎'
            },

            {
                id: 'Task 2',
                name: 'プロジェクト開発',
                start: '2024-04-02 22:00',
                end: '2024-04-02 23:00',
                progress: 60,
                dependencies: '', //複数のdependenciesを設定する際は'Task 1, Task 2'のように記述する
                assignee: '山田郎'
            },
            {
                id: 'Task 3',
                name: '品質検証',
                start: '2024-04-03 01:00',
                end: '2024-04-03 01:15',
                progress: 30,
                dependencies: '',
                assignee: '鈴木郎'
            },

            {
                id: 'Task 1',
                name: 'プロジェクト計画',
                start: '2024-04-02 23:00', //日付と時間は空白で区切る
                end: '2024-04-02 23:25', //日付と時間は空白で区切る
                progress: 100,
                dependencies: '',
                assignee: '山田太郎'
            },
            {
                id: 'Task 2',
                name: 'プロジェクト開発',
                start: '2024-04-02 22:00',
                end: '2024-04-02 23:00',
                progress: 60,
                dependencies: '', //複数のdependenciesを設定する際は'Task 1, Task 2'のように記述する
                assignee: '田太郎'
            },
            {
                id: 'Task 3',
                name: '品質検証',
                start: '2024-04-03 01:00',
                end: '2024-04-03 01:15',
                progress: 30,
                dependencies: '',
                assignee: '木一郎'
            },

            {
                id: 'Task 1',
                name: 'プロジェクト計画',
                start: '2024-04-02 23:00', //日付と時間は空白で区切る
                end: '2024-04-02 23:25', //日付と時間は空白で区切る
                progress: 100,
                dependencies: '',
                assignee: '郎'
            },
            {
                id: 'Task 2',
                name: 'プロジェクト開発',
                start: '2024-04-02 22:00',
                end: '2024-04-02 23:00',
                progress: 60,
                dependencies: '', //複数のdependenciesを設定する際は'Task 1, Task 2'のように記述する
                assignee: '山郎'
            },
            {
                id: 'Task 3',
                name: '品質検証',
                start: '2024-04-03 01:00',
                end: '2024-04-03 01:15',
                progress: 30,
                dependencies: '',
                assignee: '鈴郎'
            },

            {
                id: 'Task 1',
                name: 'プロジェクト計画',
                start: '2024-04-02 23:00', //日付と時間は空白で区切る
                end: '2024-04-02 23:25', //日付と時間は空白で区切る
                progress: 100,
                dependencies: '',
                assignee: '山田太郎'
            },
            {
                id: 'Task 2',
                name: 'プロジェクト開発',
                start: '2024-04-02 22:00',
                end: '2024-04-02 23:00',
                progress: 60,
                dependencies: '', //複数のdependenciesを設定する際は'Task 1, Task 2'のように記述する
                assignee: 's'
            },
            {
                id: 'Task 3',
                name: '品質検証',
                start: '2024-04-03 01:00',
                end: '2024-04-03 01:15',
                progress: 30,
                dependencies: '',
                assignee: 'v'
            },

            {
                id: 'Task 1',
                name: 'プロジェクト計画',
                start: '2024-04-02 23:00', //日付と時間は空白で区切る
                end: '2024-04-02 23:25', //日付と時間は空白で区切る
                progress: 100,
                dependencies: '',
                assignee: '山田太郎'
            },
            {
                id: 'Task 2',
                name: 'プロジェクト開発',
                start: '2024-04-02 22:00',
                end: '2024-04-02 23:00',
                progress: 60,
                dependencies: '', //複数のdependenciesを設定する際は'Task 1, Task 2'のように記述する
                assignee: '山g郎'
            },
            {
                id: 'Task 3',
                name: '品質検証',
                start: '2024-04-03 01:00',
                end: '2024-04-03 01:15',
                progress: 30,
                dependencies: '',
                assignee: '鈴d郎'
            }
        ]
    }

    makeOptions() {
        this.options = {
            header_height: 50,
            bar_height: 20,
            view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month', 'Time'],
            view_mode: 'Time',
            date_format: 'YYYY-MM-DDTHH:mm',
            popup_trigger: 'mouseover'
        }
    }

    makeAssigneeContainer() {
        const ganttContainer = document.querySelector('.gantt-container');
        const gridHeader = document.querySelector('.grid .grid-header');
        const gridHeaderPosition = gridHeader.getBoundingClientRect();
        this.assigneeContainer = document.createElement('div');
        this.assigneeContainer.className = 'assignee-container';
        this.assigneeContainer.style.top = `${gridHeaderPosition.top}px`;
        this.assigneeContainer.style.left = `${gridHeaderPosition.left - gantt.gantt_offset_width}px`;
        ganttContainer.appendChild(this.assigneeContainer);
    }

    makeAssigneeHeader() {
        const assigneeNamesHeader = document.createElement('div');
        assigneeNamesHeader.className = 'assignee-header';
        assigneeNamesHeader.style.width = `${this.gantt.gantt_offset_width}px`;
        this.assigneeNamesHeaderHeight = this.gantt.options.header_height + 10;
        assigneeNamesHeader.style.height =`${this.assigneeNamesHeaderHeight}px`;
        this.assigneeContainer.appendChild(assigneeNamesHeader);
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

        assigneeNames.forEach(assignee => {
            const nameDiv = document.createElement('div');
            nameDiv.classList.add('assignee-name');
            nameDiv.style.height = `${nameDivHeight}px`;
            nameDiv.style.width = `${this.gantt.gantt_offset_width}px`
        
            const nameSpan = document.createElement('span');
            nameSpan.textContent = assignee
            
            nameDiv.appendChild(nameSpan);
        
            assigneeNamesDiv.appendChild(nameDiv);
        });
                                                
        this.assigneeContainer.appendChild(assigneeNamesDiv);
    }

    //イベントリスナーをアタッチするメソッド
    attachEvnetListeners() {
        $.on(window, 'scroll', () => this.requestUpdate());
        $.on(window, 'resize', () => this.requestUpdate());
    }

    //更新をリクエストするメソッド
    requestUpdate() {
        //更新が既に保留されている場合は、何もしない
        if(this.updatePending) {
            return;
        }
        this.updatePeding = true;

        //次に描画前に更新をスケジュールする
        requestAnimationFrame(() => this.updateAssigneeContainerPosition());
    }

    updateAssigneeContainerPosition() {
        const gridHeader = document.querySelector('.grid .grid-header');
        const gridHeaderPosition = gridHeader.getBoundingClientRect();
        this.assigneeContainer.style.top = `${gridHeaderPosition.top}px`;
        this.updatePending = false;
    }

    scrollToPosition() {
        const  container = document.querySelector('.gantt-container');
        if (container) {
            container.scrollTo({
                left: this.gantt.containerXCoorinate -250,
                behavior: 'smooth'
            });
        }
    }
}

new GanttSetUp()


getSelectedMemberperttern() {
    const selectedMember = this.selectedMemberElement.value;
    const scheduleSelect = this.scheduleSelect.value;
    let statusValues = [];
    let backgroundColor = [];
    let chartTooltips = ''
    let pattern = 0
    if (!selectedMember.endsWith('班')) {
        if (scheduleSelect == 'all') {
            pattern = 1
            statusValues = ['実施待ち', '承認待ち', '完了', '差戻し', '遅れ']
            backgroundColor = ['rgb(51, 112, 173)', 'rgb(255,215,0)', 'rgb(34,139,34)', 'rgb(255,0,255)', 'rgb(178,34,34)']
            chartTooltips = '(完了+承認待ち)/(実施待ち+差戻し+遅れ)'
        } else if (scheduleSelect == 'this-week') {
            pattern = 2
            statusValues = ['実施待ち', '承認待ち', '完了', '差戻し']
            backgroundColor = ['rgb(51, 112, 173)', 'rgb(255,215,0)', 'rgb(34,139,34)', 'rgb(255,0,255)']
            chartTooltips = '(完了+承認待ち)/(実施待ち+差戻し)'
        }
        
    } else {
        if (this.scheduleSelect.value == 'all') {
            pattern = 3
            statusValues = ['配布待ち', '実施待ち', '承認待ち', '完了', '差戻し', '遅れ']
            backgroundColor = ['rgb(169,169,169)', 'rgb(51, 112, 173)', 'rgb(255,215,0)', 'rgb(34,139,34)', 'rgb(255,0,255)', 'rgb(178,34,34)']
            chartTooltips = '完了/(配布待ち+実施待ち+承認待ち+差戻し+遅れ)'
        } else if (this.scheduleSelect.value == 'this-week') {
            pattern = 4
            statusValues = ['配布待ち', '実施待ち', '承認待ち', '完了', '差戻し']
            backgroundColor = ['rgb(169,169,169)', 'rgb(51, 112, 173)', 'rgb(255,215,0)', 'rgb(34,139,34)', 'rgb(255,0,255)']
            chartTooltips = '完了/(配布待ち+実施待ち+承認待ち+差戻し)'
        }
    }
    return { pattern, statusValues, backgroundColor, chartTooltips };
}




