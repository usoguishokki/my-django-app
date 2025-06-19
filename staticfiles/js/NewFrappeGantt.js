import date_utils from './data_utils.js';
import { $, createSVG } from './svg_utils.js';
import Bar from './bar.js';
import Arrow from './arrow.js';
import Popup from './popup.js';
import { ModalManger } from './ModalManger.js'
import { asynchronousCommunication } from './asyncCommunicator.js';

const VIEW_MODE = {
    QUARTER_DAY: 'Quarter Day',
    HALF_DAY: 'Half Day',
    DAY: 'Day',
    WEEK: 'Week',
    MONTH: 'Month',
    YEAR: 'Year',
    TIME: 'Time'
};

export default class Gantt {
    constructor(wrapper, tasks, options, GanttSetUpInstance) {
        //this.groupSchduleLayout = document.getElementById("groupSchedule");
        
        this.gantt_offset_width = 120;
        this.setup_options(options);
        this.setup_wrapper(wrapper);
        this.setup_tasks(tasks);
        this.change_view_mode();
        this.bind_events();
        this.GanttSetUpInstance = GanttSetUpInstance
        // initialize with default view mode
    }

    setup_wrapper(element) {
        console.log('setup_wrapper')
        let svg_element, wrapper_element;

        // CSS Selector is passed
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }

        // get the SVGElement
        if (element instanceof HTMLElement) {
            wrapper_element = element;
            svg_element = element.querySelector('svg');
        } else if (element instanceof SVGElement) {
            svg_element = element;
        } else {
            throw new TypeError(
                'Frappé Gantt only supports usage of a string CSS selector,' +
                    " HTML DOM element or SVG DOM element for the 'element' parameter"
            );
        }

        // svg element
        if (!svg_element) {
            // create it
            this.$svg = createSVG('svg', {
                append_to: wrapper_element,
                class: 'gantt',
            });
        } else {
            this.$svg = svg_element;
            this.$svg.classList.add('gantt');
        }
        
        //parent_element
        const ganttHeaderContainer = document.createElement('div');
        this.ganttContainerParent = document.querySelector('.gantt-container-parent')
        ganttHeaderContainer.classList.add('gantt-header-container');
        ganttHeaderContainer.style.height =  `${this.options.header_height}px`;
        this.ganttContainerParent.parentNode.insertBefore(ganttHeaderContainer, this.ganttContainerParent);
        this.ganttHeader = createSVG('svg', {
            x: 0,
            y: 0,
            append_to: ganttHeaderContainer,
            class: 'gantt-header',
        });
        
        // wrapper element
        this.$container = document.createElement('div');
        this.$container.classList.add('gantt-container');

        const parent_element = this.$svg.parentElement;
        parent_element.appendChild(this.$container);
        this.$container.appendChild(this.$svg);

        // popup wrapper
        this.popup_wrapper = document.createElement('div');
        this.popup_wrapper.classList.add('popup-wrapper');
        this.$container.appendChild(this.popup_wrapper);
    }

    setup_options(options) {
        const default_options = {
            header_height: 50,
            column_width: 30,
            step: 24,
            view_modes: [...Object.values(VIEW_MODE)],
            bar_height: 20,
            bar_corner_radius: 3,
            arrow_curve: 5,
            padding: 18,
            view_mode: 'Day',
            date_format: 'YYYY-MM-DD',
            popup_trigger: 'click',
            custom_popup_html: null,
            language: 'en',
        };
        this.options = Object.assign({}, default_options, options);
    }

    setup_tasks(tasks) {
        //担当者ごとの行のインデックスを保持するオブジェクト
        this.assigneeRows = {};
        
        this.options.members.map((member, i) => {
            this.assigneeRows[member] = i
        });
        
        let currentRowIndex = 0
        // prepare tasks
        this.tasks = tasks.map((task, i) => {
            // convert to Date objects
            task._start = date_utils.parse(task.start);
            task._end = date_utils.parse(task.end);

            // make task invalid if duration too large
            if (date_utils.diff(task._end, task._start, 'year') > 10) {
                task.end = null;
            }

            /*
            if (!(task.assignee in this.assigneeRows)) {
                this.assigneeRows[task.assignee] = currentRowIndex++;
            }
            */
            // cache index
            //task._index = i;
            task._index = this.assigneeRows[task.assignee];

            // invalid dates
            if (!task.start && !task.end) {
                const today = date_utils.today();
                task._start = today;
                task._end = date_utils.add(today, 2, 'day');
            }

            if (!task.start && task.end) {
                task._start = date_utils.add(task._end, -2, 'day');
            }

            if (task.start && !task.end) {
                task._end = date_utils.add(task._start, 2, 'day');
            }

            // if hours is not set, assume the last day is full day
            // e.g: 2018-09-09 becomes 2018-09-09 23:59:59
            /*
            const task_end_values = date_utils.get_date_values(task._end);
            if (task_end_values.slice(3).every((d) => d === 0)) {
                task._end = date_utils.add(task._end, 24, 'hour');
            }
            */

            // invalid flag
            if (!task.start || !task.end) {
                task.invalid = true;
            }

            // dependencies
            if (typeof task.dependencies === 'string' || !task.dependencies) {
                let deps = [];
                if (task.dependencies) {
                    deps = task.dependencies
                        .split(',')
                        .map((d) => d.trim())
                        .filter((d) => d);
                }
                task.dependencies = deps;
            }

            // uids
            if (!task.id) {
                task.id = generate_id(task);
            }

            return task;
        });
        
        this.assigneeSize = Object.keys(this.assigneeRows).length;

        this.setup_dependencies();
    }

    setup_dependencies() {
        this.dependency_map = {};
        for (let t of this.tasks) {
            for (let d of t.dependencies) {
                this.dependency_map[d] = this.dependency_map[d] || [];
                this.dependency_map[d].push(t.id);
            }
        }
    }

    refresh(tasks) {
        this.setup_tasks(tasks);
        this.change_view_mode();
    }

    change_view_mode(mode = this.options.view_mode) {
        this.update_view_scale(mode);
        this.setup_dates();
        this.render();
        this.trigger_event('view_change', [mode]);
        // fire viewmode_change event
        
    }

    update_view_scale(view_mode) {
        this.options.view_mode = view_mode;

        switch(view_mode) {
            case VIEW_MODE.DAY:
                //日単位の設定
                this.options.step = 24;
                this.options.column_width = 38;
                break
            case VIEW_MODE.HALF_DAY:
                //半日単位の設定
                this.options.step = 24 / 2;
                this.options.column_width = 38;
                break
            case VIEW_MODE.QUARTER_DAY:
                //四半期単位の設定
                this.options.step = 24 / 4;
                this.options.column_width = 38;
                break
            case VIEW_MODE.WEEK:
                //週単位の設定
                this.options.step = 24 * 7;
                this.options.column_width = 140;
                break
            case VIEW_MODE.MONTH:
                //月単位の設定
                this.options.step = 24 * 30;
                this.options.column_width = 120;
                break
            case VIEW_MODE.YEAR:
                //年単位の設定
                this.options.step = 24 * 365;
                this.options.column_width = 120;
                break
            case VIEW_MODE.TIME:
                //オリジナル時間単位の設定
                //this.options.step = 24 / 288; //1日を(1440分 / 分割したい'分')に分割
                //this.options.column_width = 20; //列の幅は実際のUIを使いやすさに基づいて調整可能
                this.options.step = 24 / 1440;
                this.options.column_width = 12;
                break
        }
    }

    setup_dates() {
        this.setup_gantt_dates();
        this.setup_date_values();
    }

    setup_gantt_dates() {
        this.gantt_start = this.gantt_end = null;

        for (let task of this.tasks) {
            // set global start and end date
            if (!this.gantt_start || task._start < this.gantt_start) {
                this.gantt_start = task._start;
            }
            if (!this.gantt_end || task._end > this.gantt_end) {
                this.gantt_end = task._end;
            }
        }
        
        if (this.gantt_start && this.gantt_end) {
            this.gantt_start = date_utils.start_of(this.gantt_start, 'day');
            this.gantt_end = date_utils.start_of(this.gantt_end, 'day');
        }


        // add date padding on both sides
        if (this.view_is([VIEW_MODE.QUARTER_DAY, VIEW_MODE.HALF_DAY])) {
            this.gantt_start = date_utils.add(this.gantt_start, -7, 'day');
            this.gantt_end = date_utils.add(this.gantt_end, 7, 'day');
        } else if (this.view_is(VIEW_MODE.MONTH)) {
            this.gantt_start = date_utils.start_of(this.gantt_start, 'year');
            this.gantt_end = date_utils.add(this.gantt_end, 1, 'year');
        } else if (this.view_is(VIEW_MODE.YEAR)) {
            this.gantt_start = date_utils.add(this.gantt_start, -2, 'year');
            this.gantt_end = date_utils.add(this.gantt_end, 2, 'year');
        } else if (this.view_is(VIEW_MODE.TIME)) {
            //this.gantt_start = date_utils.add(this.gantt_start, -1, 'day');
            //this.gantt_end = date_utils.add(this.gantt_end, 1, 'day');
            this.gantt_start = date_utils.add(this.options.shift_start, -2, 'hour');
            this.gantt_end = date_utils.add(this.options.shift_end, 2, 'hour');
        } else {
            this.gantt_start = date_utils.add(this.gantt_start, -1, 'month');
            this.gantt_end = date_utils.add(this.gantt_end, 1, 'month');
        }
    }

    setup_date_values() {
        this.dates = [];
        let cur_date = null;

        while (cur_date === null || cur_date < this.gantt_end) {
            if (!cur_date) {
                cur_date = date_utils.clone(this.gantt_start);
            } else {
                if (this.view_is(VIEW_MODE.YEAR)) {
                    cur_date = date_utils.add(cur_date, 1, 'year');
                } else if (this.view_is(VIEW_MODE.MONTH)) {
                    cur_date = date_utils.add(cur_date, 1, 'month');
                } else if (this.view_is(VIEW_MODE.TIME)) {
                    cur_date = date_utils.add(cur_date, 1, 'minute')
                } else {
                    cur_date = date_utils.add(
                        cur_date,
                        this.options.step,
                        'hour'
                    );
                }
            }
            this.dates.push(cur_date);
        }
    }

    bind_events() {
        this.bind_grid_click();
        this.bind_bar_events();
    }

    render() {
        this.clear();
        this.setup_layers();
        this.make_grid();
        this.make_dates();
        this.make_bars();
        this.make_arrows();
        this.map_arrows_on_bars();
        this.set_width();
        this.set_scroll_position();
    }

    custom_render(wrapper, tasks, options) {
        this.header_clear()
        this.clear();

        //this.setup_options(options);
        this.setup_wrapper(wrapper);
        this.setup_options(options)
        this.setup_tasks(tasks);
        this.change_view_mode();
        this.bind_events();
    }

    setup_layers() {
        this.layers = {};
        const layers = ['grid', 'date', 'arrow', 'progress', 'bar', 'details'];
        // make group layers
        for (let layer of layers) {
            this.layers[layer] = createSVG('g', {
                class: layer,
                append_to: this.$svg,
            });
        }
    }

    make_grid() {
        this.make_grid_background();
        this.make_grid_rows();
        this.make_grid_header();
        this.make_grid_ticks();
        this.make_grid_highlights();
    }
    

    make_grid_background() {
        const grid_width = this.dates.length * this.options.column_width;
        const grid_height =
            //this.options.header_height +
            this.options.padding +
            (this.options.bar_height + this.options.padding) *
                this.assigneeSize + 30;

        createSVG('rect', {
            //x: this.gantt_offset_width,
            x: 0,
            y: 0,
            width: grid_width,
            height: grid_height,
            class: 'grid-background',
            append_to: this.layers.grid,
        });

        $.attr(this.$svg, {
            height: grid_height,
            width: '100%',
        });
    }

    make_grid_rows() {
        const rows_layer = createSVG('g', { append_to: this.layers.grid });
        const lines_layer = createSVG('g', { append_to: this.layers.grid });

        const row_width = this.dates.length * this.options.column_width;
        this.row_height = this.options.bar_height + this.options.padding;

        let row_y = 0;

        Object.keys(this.assigneeRows).forEach((assignee, index) => {
            createSVG('rect', {
                x: 0,
                y: row_y,
                width: row_width,
                height: this.row_height,
                class: 'grid-row',
                append_to: rows_layer,
                'data-row-number': index,
            });
            row_y += this.options.bar_height + this.options.padding;
        });
    }

    make_grid_header() {
        const header_width = this.dates.length * this.options.column_width;
        const header_height = this.options.header_height;
        const ganttHeaderlayer = createSVG('g', {append_to: this.ganttHeader});             
        createSVG('rect', {
            x: 0,
            y: 25,
            width: header_width + this.gantt_offset_width,
            height: header_height -25,
            class: 'gantt-header-grid',
            append_to: ganttHeaderlayer,
        });
        
        $.attr(this.ganttHeader, {
            height: header_height,
            width: header_width + this.gantt_offset_width,
        });
        
        
    }

    make_grid_ticks() {
        let tick_x = 0;
        let tick_y = 0;
        let tick_height =
            (this.options.bar_height + this.options.padding) *
                this.assigneeSize;

        for (let date of this.dates) {
            let tick_class = 'tick';
            // thick tick for monday
            if (this.view_is(VIEW_MODE.DAY) && date.getDate() === 1) {
                tick_class += ' thick';
            }
            // thick tick for first week
            if (
                this.view_is(VIEW_MODE.WEEK) &&
                date.getDate() >= 1 &&
                date.getDate() < 8
            ) {
                tick_class += ' thick';
            }
            // thick ticks for quarters
            if (this.view_is(VIEW_MODE.MONTH) && date.getMonth() % 3 === 0) {
                tick_class += ' thick';
            }

            if (this.view_is(VIEW_MODE.TIME)) {
                if (date.getMinutes() % 60 === 0) {
                    tick_class += ' thick';
                }
                if (date.getMinutes() % 15 === 0 && date.getMinutes() % 60 !== 0) {
                    tick_class += ' subthick'; 
                }
            }

            createSVG('path', {
                d: `M ${tick_x} ${tick_y} v ${tick_height}`,
                class: tick_class,
                append_to: this.layers.grid,
            });

            if (this.view_is(VIEW_MODE.MONTH)) {
                tick_x +=
                    (date_utils.get_days_in_month(date) *
                        this.options.column_width) /
                    30;
            } else {
                tick_x += this.options.column_width;
            }
        }
    }

    //compute the horizontal x distance
    computeGridHighlightDimensions(view_mode) {
        let xDist = 0;

        switch(view_mode) {
            case VIEW_MODE.DAY:
                return (date_utils.diff(date_utils.today(), this.gantt_start, 'hour') / 
                this.options.step) *
                this.options.column_width;
            case VIEW_MODE.TIME:
                //timeビューモードの場合
                const now = new Date();
                const minutesDiff = date_utils.diff(now, this.gantt_start, 'minute');
                
                //return (minutesDiff * this.options.column_width) + this.gantt_offset_width;
                return (minutesDiff * this.options.column_width)
        }


        for (let date of this.dates) {
            const todayDate = new Date();
            const startDate = new Date(date);
            const endDate = new Date(date);
            switch (view_mode) {
                case VIEW_MODE.WEEK:
                    endDate.setDate(date.getDate() + 7);
                    break;
                case VIEW_MODE.MONTH:
                    endDate.setMonth(date.getMonth() + 1);
                    break;
                case VIEW_MODE.YEAR:
                    endDate.setFullYear(date.getFullYear() + 1);
                    break;
            }
            if (todayDate >= startDate && todayDate <= endDate) {
                break;
            } else {
                xDist += this.options.column_width;
            }
        }
        return xDist;
    }

    make_grid_highlights() {
        // highlight today's | week's | month's | year's
        if (this.view_is(VIEW_MODE.DAY) || this.view_is(VIEW_MODE.WEEK) || this.view_is(VIEW_MODE.MONTH) || this.view_is(VIEW_MODE.YEAR) || this.view_is(VIEW_MODE.TIME)) {

            const x = this.computeGridHighlightDimensions(this.options.view_mode);
            this.containerXCoorinate = x;

            //const y = this.options.header_height + this.options.padding / 2;
            const y = 0;
            const width = this.options.column_width;
            const height =
                (this.options.bar_height + this.options.padding) * this.assigneeSize;
            let className = '';
            switch (this.options.view_mode) {
                case VIEW_MODE.DAY:
                    className = 'today-highlight'
                    break;
                case VIEW_MODE.WEEK:
                    className = 'week-highlight'
                    break;
                case VIEW_MODE.MONTH:
                    className = 'month-highlight'
                    break;
                case VIEW_MODE.YEAR:
                    className = 'year-highlight'
                    break;
                case VIEW_MODE.TIME:
                    className = 'time-highlight'
            }
            createSVG('rect', {
                x,
                y,
                width,
                height,
                class: className,
                append_to: this.layers.grid,
            });
        }
    }

    make_dates() {
        for (let date of this.get_dates_to_draw()) {
            createSVG('text', {
                x: date.lower_x,
                y: date.lower_y,
                innerHTML: date.lower_text,
                class: 'lower-text',
                'data-day': date.upper_text,
                append_to: this.ganttHeader,
                //append_to: this.ganttHeaderlayer
            });
        }
    }

    get_dates_to_draw() {
        let last_date = null;
        const dates = this.dates.map((date, i) => {
            const d = this.get_date_info(date, last_date, i);
            last_date = date;
            return d;
        });
        return dates;
    }

    get_date_info(date, last_date, i) {
        if (last_date) {
            last_date = date_utils.add(date, 1, 'year');
        }

        let upper_text = '', lower_text = '';
        let x_pos_lower = 0, x_pos_upper = 0;
        switch (this.options.view_mode) {
            case 'Quarter Day':
                lower_text = date_utils.format(date, 'HH', this.options.language);
                upper_text = date.getDate() !== last_date.getDate()
                    ? date_utils.format(date, 'D MMM', this.options.language)
                    : '';
                x_pos_lower = (this.options.column_width * 4) / 2;
                x_pos_upper =  0;
                break;
            case 'Half Day':
                lower_text = date_utils.format(date, 'HH', this.options.language);
                upper_text = date.getDate() !== last_date.getDate()
                    ? (date.getMonth() !== last_date.getMonth()
                        ? date_utils.format(date, 'D MMM', this.options.language)
                        : date_utils.format(date, 'D', this.options.language))
                    : '';
                x_pos_lower = (this.options.column_width * 2) / 2;
                x_pos_upper = 0;
                break;
            case 'Day':
                lower_text = date.getDate() !== last_date.getDate()
                    ? date_utils.format(date, 'D', this.options.language)
                    : '';
                upper_text = date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(date, 'MMMM', this.options.language)
                    : '';
                x_pos_lower = this.options.column_width / 2;
                x_pos_upper = (this.options.column_width * 30) / 2;
                break;
            case 'Week':
                lower_text = date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(date, 'D MMM', this.options.language)
                    : date_utils.format(date, 'D', this.options.language);
                upper_text = date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(date, 'MMMM', this.options.language)
                    : '';
                x_pos_lower = 0;
                x_pos_upper = (this.options.column_width * 4) / 2;
                break;
            case 'Month':
                lower_text = date_utils.format(date, 'MMMM', this.options.language);
                upper_text = date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'YYYY', this.options.language)
                    : '';
                x_pos_lower = this.options.column_width / 2;
                x_pos_upper = (this.options.column_width * 12) / 2;
                break;
            case 'Year':
                lower_text = date_utils.format(date, 'YYYY', this.options.language);
                upper_text = date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'YYYY', this.options.language)
                    : '';
                x_pos_lower = this.options.column_width / 2;
                x_pos_upper = (this.options.column_width * 30) / 2;                    
                break;
            case 'Time':
                lower_text = (date.getMinutes() % 15 === 0)
                    ? date_utils.format(date, 'HH:mm', this.options.language)
                    : '';
                x_pos_lower = this.options.column_width / 2;
                if(!this.lastProcessedDate ||
                    this.lastProcessedDate.getDate() !== date.getDate()) {
                        upper_text = date_utils.format(date, 'MM月D日', this.options.language)
                        x_pos_upper = 100;
                        this.lastProcessedDate = date
                        this.last_upper_text = upper_text
                } else {
                    upper_text = this.last_upper_text;
                    x_pos_upper = 100;
                };
                break;
        }

        const base_pos = {
            x: i * this.options.column_width + this.gantt_offset_width + 12,//変更
            lower_y: this.options.header_height -5,
            upper_y: this.options.header_height - 25,
        };

        return {
            upper_text: upper_text,
            lower_text: lower_text,
            upper_x: base_pos.x + x_pos_upper,
            upper_y: base_pos.upper_y,
            lower_x: base_pos.x + x_pos_lower,
            lower_y: base_pos.lower_y,
        };
    }

    make_bars() {
        this.bars = this.tasks.map((task) => {
            const bar = new Bar(this, task);
            this.layers.bar.appendChild(bar.group);
            return bar;
        });
    }

    make_arrows() {
        this.arrows = [];
        for (let task of this.tasks) {
            let arrows = [];
            arrows = task.dependencies
                .map((task_id) => {
                    const dependency = this.get_task(task_id);
                    if (!dependency) return;
                    const arrow = new Arrow(
                        this,
                        this.bars[dependency._index], // from_task
                        this.bars[task._index] // to_task
                    );
                    this.layers.arrow.appendChild(arrow.element);
                    return arrow;
                })
                .filter(Boolean); // filter falsy values
            this.arrows = this.arrows.concat(arrows);
        }
    }

    map_arrows_on_bars() {
        for (let bar of this.bars) {
            bar.arrows = this.arrows.filter((arrow) => {
                return (
                    arrow.from_task.task.id === bar.task.id ||
                    arrow.to_task.task.id === bar.task.id
                );
            });
        }
    }

    set_width() {
        const cur_width = this.$svg.getBoundingClientRect().width;
        const actual_width = this.$svg
            .querySelector('.grid .grid-row')
            .getAttribute('width');
        if (cur_width < actual_width) {
            this.$svg.setAttribute('width', actual_width);
        }
    }

    set_scroll_position() {
        if (this.tasks.length > 0) {
            const parent_element = this.$svg.parentElement;
            if (!parent_element) return;
            const hours_before_first_task = date_utils.diff(
                this.get_oldest_starting_date(),
                this.gantt_start,
                'hour'
            );
            const scroll_pos =
                (hours_before_first_task / this.options.step) *
                    this.options.column_width -
                this.options.column_width;
            parent_element.scrollLeft = scroll_pos;
        }
    }

    bind_grid_click() {
        $.on(
            this.$svg,
            this.options.popup_trigger,
            '.grid-row, .grid-header',
            () => {
                this.unselect_all();
                this.hide_popup();
            }
        );
    }

    bind_bar_events() {
        let is_dragging = false;
        let bar_offset = (this.row_height / 2) - (this.options.bar_height / 2)
        let x_on_start = 0;
        let y_on_start = 0;
        let is_resizing_left = false;
        let is_resizing_right = false;
        let parent_bar_id = null;
        let bars = []; // instanceof Bar
        let lastRowIndex = null;
        let highLightSelectors = ['.assignee-name', '.grid-row'];
        this.bar_being_dragged = null;
        $.on(this.layers.bar, 'mousedown', '.bar-wrapper, .handle', (e, element) => {
            const bar_wrapper = $.closest('.bar-wrapper', element);
            if (element.classList.contains('bar-wrapper')) {
                is_dragging = true;
            }
            bar_wrapper.classList.add('active');

            x_on_start = e.offsetX;
            y_on_start = e.offsetY;

            parent_bar_id = bar_wrapper.getAttribute('data-id');
            const ids = [
                parent_bar_id,
                ...this.get_all_dependent_tasks(parent_bar_id),
            ];
            bars = ids.map((id) => this.get_bar(id));

            this.bar_being_dragged = parent_bar_id;

            bars.forEach((bar) => {
                const $bar = bar.$bar;
                $bar.ox = $bar.getX();
                $bar.oy = $bar.getY();
                $bar.owidth = $bar.getWidth();
                $bar.finaldx = 0;
            });
        });
        $.on(this.$svg, 'mousemove', (e) => {
            if (!is_dragging && !is_resizing_left &&  !is_resizing_right) return;
            const dx = e.offsetX - x_on_start;
            const dy = e.offsetY - y_on_start;

            bars.forEach((bar) => {
                const $bar = bar.$bar;
                const snapDetailsX = this.get_snap_position(dx, 'x');
                const snapDetailsY = this.get_snap_position(dy, 'y', $bar.oy, lastRowIndex, highLightSelectors);
                $bar.finaldx = snapDetailsX.position;
                $bar.finaldy = snapDetailsY.position;
                $bar.snapY = snapDetailsY.snap_position + bar_offset;
                lastRowIndex = snapDetailsY.newLastRowIndex;
                this.hide_popup();
                if (is_dragging) {
                    bar.update_bar_position({ x: $bar.ox + $bar.finaldx, y: $bar.oy + $bar.finaldy, axis: 'xy'});
                }
            });
        });

        document.addEventListener('mouseup', (e) => {
            if (is_dragging || is_resizing_left || is_resizing_right) {
                bars.forEach((bar) => bar.group.classList.remove('active'));
            }
            is_dragging = false;
            is_resizing_left = false;
            is_resizing_right = false;
        });
        $.on(this.$svg, 'mouseup', async (e) => {
            this.bar_being_dragged = null;
            let upDateDict = {}
            for (const bar of bars) {
                const $bar = bar.$bar;
                let upDateNeeded = false;
                if ($bar.finaldx) {
                    bar.date_changed();
                    bar.set_action_completed();
                    upDateDict = {...upDateDict, ...this.handleHorizontalDrag(bar)};
                    upDateNeeded = true;
                }
                if($bar.snapY) {
                    bar.update_bar_position({ y: $bar.snapY, axis: 'y'});
                    if ($bar.snapY != $bar.oy) {
                        const holder = this.findHolder(lastRowIndex);
                        highLightSelectors.forEach(selector => {
                            const lastElement = this.ganttContainerParent.querySelector(`${selector}[data-row-number="${lastRowIndex}"]`);
                            lastElement.classList.remove('row-highlight');    
                        });
                        if (!holder) {
                            await ModalManger.showModal("メンバーが見つかりません", 'red');
                            bar.update_bar_position({ x: $bar.ox, y: $bar.oy, axis: 'xy'});
                            break;
                        }
                        bar.task.assignee = holder
                        upDateDict = {...upDateDict, ...this.handleVerticalDrag(bar, holder)};
                        upDateNeeded = true;
                    }
                }
                $bar.finaldx = 0;
                $bar.finaldy = 0;
                $bar.snapY = 0;
                if (upDateNeeded) {
                    await this.performAsynchronousOperation(upDateDict);
                }   
            }
        });
        this.bind_bar_progress();
    }

    async performAsynchronousOperation(upDateDict) {
        try {
            const params = this.createRequestParams(upDateDict);
            const response = await asynchronousCommunication(params);
            if (response && response.status === 'success') {
                const message = this.createResponseMessage(response.data);
                this.GanttSetUpInstance.upDateGantt(response.data)
                await ModalManger.showModal(message, 'green', true);
            } else {
                throw new Error("リクエストが失敗したか、応答がありません。");
            }
        } catch (error) {
            console.error("通信中のエラー:", error);
            await ModalManger.showModal("エラーが発生しました。", 'red');
        }
    }

    createRequestParams(upDateDict) {
        return {
            url: '/home/',
            method: 'POST',
            data: {
                action: 'fetch_update_bar',
                upDateDict
            }
        };
    }

    createResponseMessage(data) {
        if (!data) return "<p>データは利用できません。</p>";

        let messageParts = [
            `<p>plan_id: ${data["plan_id"] || "不明"}</p>`
        ];

        this.appendChangeMessage(messageParts, data, 'old_member_holder', 'new_member_holder', '実施者');
        this.appendChangeMessage(messageParts, data, 'old_plan_time', 'new_plan_time', '実施時間');

        return messageParts.join('');
    }

    appendChangeMessage(parts, data, oldKey, newKey, label) {
        if (data[oldKey] && data[newKey]) {
            parts.push(`<p>${label}: ${data[oldKey]} ⇒ ${data[newKey]}に変更されました。</p>`);
        } else {
            parts.push(`<p>${label}: 変更はありません。</p>`);
        }
    }
    
    handleHorizontalDrag(bar) {
        return {
            "plan_id": bar.task.id,
            "plan_time": bar.task._start,
        };
    }

    handleVerticalDrag(bar, holder) {
        return {
            "plan_id": bar.task.id,
            "member": holder
        };
    }

    findHolder(rowIndex) {
        const entry = Object.entries(this.assigneeRows).find(([key,val]) => val === rowIndex);
        return entry ? entry[0] : null;
    }

    bind_bar_progress() {
        let x_on_start = 0;
        let y_on_start = 0;
        let is_resizing = null;
        let bar = null;
        let $bar_progress = null;
        let $bar = null;

        $.on(this.$svg, 'mousemove', (e) => {
            if (!is_resizing) return;
            let dx = e.offsetX - x_on_start;
            let dy = e.offsetY - y_on_start;

            if (dx > $bar_progress.max_dx) {
                dx = $bar_progress.max_dx;
            }
            if (dx < $bar_progress.min_dx) {
                dx = $bar_progress.min_dx;
            }
        });

        $.on(this.$svg, 'mouseup', () => {
            is_resizing = false;
            if (!($bar_progress && $bar_progress.finaldx)) return;
            bar.progress_changed();
            bar.set_action_completed();
        });
    }

    get_all_dependent_tasks(task_id) {
        let out = [];
        let to_process = [task_id];
        while (to_process.length) {
            const deps = to_process.reduce((acc, curr) => {
                acc = acc.concat(this.dependency_map[curr]);
                return acc;
            }, []);

            out = out.concat(deps);
            to_process = deps.filter((d) => !to_process.includes(d));
        }

        return out.filter(Boolean);
    }
    
    get_snap_position(value, axis, oy, lastRowIndex, selectors) {
        let odx = value,
            rem,
            position,
            snap_position,
            newLastRowIndex = lastRowIndex
        
        switch (axis) {
            case 'x':
                if (this.view_is(VIEW_MODE.WEEK)) {
                    rem = value % (this.options.column_width / 7);
                    position =
                        odx -
                        rem +
                        (rem < this.options.column_width / 14
                            ? 0
                            : this.options.column_width / 7);
                } else if (this.view_is(VIEW_MODE.MONTH)) {
                    rem = value % (this.options.column_width / 30);
                    position =
                        odx -
                        rem +
                        (rem < this.options.column_width / 60
                            ? 0
                            : this.options.column_width / 30);
                } else {
                    rem = value % this.options.column_width;
                    position =
                        odx -
                        rem +
                        (rem < this.options.column_width / 2
                            ? 0
                            : this.options.column_width);
                }
                break;
            case 'y':
                const newY = oy + value;
                const barCenter = newY + this.options.bar_height/2;
                const rowIndex = Math.floor(barCenter / this.row_height);
                if (rowIndex < 0) {
                    snap_position = 0
                } else if (rowIndex > this.assigneeSize-1) {
                    snap_position = (this.assigneeSize-1) * this.row_height;
                } else {
                    snap_position = rowIndex * this.row_height;
                }
                newLastRowIndex = rowIndex;
                if (rowIndex !== lastRowIndex) {
                    selectors.forEach(selector => {
                        const newElement = this.ganttContainerParent.querySelector(`${selector}[data-row-number="${newLastRowIndex}"]`);
                        const oldElement = this.ganttContainerParent.querySelector(`${selector}[data-row-number="${lastRowIndex}"]`);
                        if (newElement && oldElement) {
                            newElement.classList.add('row-highlight');
                            oldElement.classList.remove('row-highlight');
                        }
                    })
                }
                position = value;
                break;
        }
        return { position, snap_position, newLastRowIndex };
    }

    unselect_all() {
        [...this.$svg.querySelectorAll('.bar-wrapper')].forEach((el) => {
            el.classList.remove('active');
        });
    }

    view_is(modes) {
        if (typeof modes === 'string') {
            return this.options.view_mode === modes;
        }

        if (Array.isArray(modes)) {
            return modes.some((mode) => this.options.view_mode === mode);
        }

        return false;
    }

    get_task(id) {
        return this.tasks.find((task) => {
            return task.id === id;
        });
    }

    get_bar(id) {
        return this.bars.find((bar) => {
            return bar.task.id === id;
        });
    }

    show_popup(title_name) {
        const title_content = document.getElementById("workContenxt");
        title_content.textContent = title_name;
    }

    hide_popup() {
        //this.popup && this.popup.hide();
        const title_content = document.getElementById("workContenxt");
        title_content.textContent = '';
    }

    trigger_event(event, args) {
        if (this.options['on_' + event]) {
            this.options['on_' + event].apply(null, args);
        }
    }

    /**
     * Gets the oldest starting date from the list of tasks
     *
     * @returns Date
     * @memberof Gantt
     */
    get_oldest_starting_date() {
        return this.tasks
            .map((task) => task._start)
            .reduce((prev_date, cur_date) =>
                cur_date <= prev_date ? cur_date : prev_date
            );
    }

    /**
     * Clear all elements from the parent svg element
     *
     * @memberof Gantt
     */
    clear() {
        this.$svg.innerHTML = '';
    }

    header_clear() {
        const ganttHeaderContainer = document.querySelector('.gantt-header-container');
        ganttHeaderContainer.parentNode.removeChild(ganttHeaderContainer);
    }

    assignee_clear() {
        this.ganttContainerParent.removeChild()
    }
}

Gantt.VIEW_MODE = VIEW_MODE;

function generate_id(task) {
    return task.name + '_' + Math.random().toString(36).slice(2, 12);
}