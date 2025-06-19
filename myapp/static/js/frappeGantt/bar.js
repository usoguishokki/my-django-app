import date_utils from './data_utils.js';
import { $, createSVG, animateSVG } from './svg_utils.js';

export default class Bar {
    constructor(gantt, task) {
        this.set_defaults(gantt, task);
        this.prepare();
        this.draw();
        this.bind();
    }

    set_defaults(gantt, task) {
        this.action_completed = false;
        this.gantt = gantt;
        this.task = task;
    }

    prepare() {
        this.prepare_values();
        this.prepare_helpers();
    }

    prepare_values() {
        this.invalid = this.task.invalid;
        this.height = this.gantt.options.bar_height;
        this.compute_x();
        this.compute_y();
        this.compute_duration();
        this.corner_radius = this.gantt.options.bar_corner_radius;
        this.width = this.gantt.options.column_width * this.duration;
        this.progress_width =
            this.gantt.options.column_width *
                this.duration *
                (this.task.progress / 100) || 0;
        this.group = createSVG('g', {
            class: 'bar-wrapper ' + (this.task.custom_class || ''),
            'data-id': this.task.id,
        });
        this.bar_group = createSVG('g', {
            class: 'bar-group',
            append_to: this.group,
        }); 
    }

    prepare_helpers() {
        SVGElement.prototype.getX = function () {
            return +this.getAttribute('x');
        };
        SVGElement.prototype.getY = function () {
            return +this.getAttribute('y');
        };
        SVGElement.prototype.getWidth = function () {
            return +this.getAttribute('width');
        };
        SVGElement.prototype.getHeight = function () {
            return +this.getAttribute('height');
        };
        SVGElement.prototype.getEndX = function () {
            return this.getX() + this.getWidth();
        };
    }

    prepare_expected_progress_values() {
        this.compute_expected_progress();
        this.expected_progress_width =
            this.gantt.options.column_width *
                this.duration *
                (this.expected_progress / 100) || 0;
    }

    draw() {
        this.draw_bar();
        if (this.gantt.options.show_expected_progress) {
            this.prepare_expected_progress_values();
            this.draw_expected_progress_bar();
        }
        //this.draw_progress_bar();
        this.draw_label();
        //this.draw_resize_handles();
    }

    draw_bar() {
        if (this.y === undefined) {
            debugger
        }
        this.$bar = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'bar',
            append_to: this.bar_group,
        });

        animateSVG(this.$bar, 'width', 0, this.width);

        if (this.invalid) {
            this.$bar.classList.add('bar-invalid');
        }
    }

    draw_expected_progress_bar() {
        if (this.invalid) return;
        this.$expected_bar_progress = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.expected_progress_width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'bar-expected-progress',
            append_to: this.bar_group,
        });

        animateSVG(this.$expected_bar_progress, 'width', 0, this.expected_progress_width);
    }

    draw_label() {
        createSVG('text', {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2,
            innerHTML: this.task.name,
            class: 'bar-label',
            append_to: this.bar_group,
        });
        // labels get BBox in the next tick
        requestAnimationFrame(() => this.update_label_position());
    }

    get_progress_polygon_points() {
        const bar_progress = this.$bar_progress;
        return [
            bar_progress.getEndX() - 5,
            bar_progress.getY() + bar_progress.getHeight(),
            bar_progress.getEndX() + 5,
            bar_progress.getY() + bar_progress.getHeight(),
            bar_progress.getEndX(),
            bar_progress.getY() + bar_progress.getHeight() - 8.66,
        ];
    }

    bind() {
        if (this.invalid) return;
        this.setup_click_event();
    }

    setup_click_event() {
        $.on(this.group, 'focus ' + this.gantt.options.popup_trigger, (e) => {
            if (this.action_completed) {
                // just finished a move action, wait for a few seconds
                return;
            }

            this.show_popup();
            //this.gantt.unselect_all();
            //this.group.classList.add('active');
        });

        $.on(this.group, 'dblclick', (e) => {
            if (this.action_completed) {
                // just finished a move action, wait for a few seconds
                return;
            }

            this.gantt.trigger_event('click', [this.task]);
        });
    }

    show_popup() {
        if (this.gantt.bar_being_dragged) return;
        const start_hour = this.task._start.getHours();
        const start_minutes = this.task._start.getMinutes();
        const end_hour = this.task._end.getHours();
        const end_minutes = this.task._end.getMinutes();
        const title_name = `${start_hour}:${start_minutes}-${end_hour}:${end_minutes} ${this.task.name}`;
        this.gantt.show_popup(title_name)
    }

    update_bar_position({ x = null, y = null, width = null, axis = null }) {
        const bar = this.$bar;
        switch (axis) {
            case 'x':
                this.update_attr(bar, 'x', x);
                break;
            case 'y':
                this.update_attr(bar, 'y', y)
                break;
            case 'xy':
                this.update_attr(bar, 'x', x);
                this.update_attr(bar, 'y', y);
                break;
        }

        this.update_label_position();
        //this.update_handle_position();
        if (this.gantt.options.show_expected_progress){
            this.date_changed();
            this.compute_duration();
            this.update_expected_progressbar_position();
        }
        //this.update_progressbar_position();
        this.update_arrow_position();
    }

    date_changed() {
        let changed = false;
        const { new_start_date, new_end_date } = this.compute_start_end_date();

        if (Number(this.task._start) !== Number(new_start_date)) {
            changed = true;
            this.task._start = new_start_date;
        }

        if (Number(this.task._end) !== Number(new_end_date)) {
            changed = true;
            this.task._end = new_end_date;
        }

        if (!changed) return;

        this.gantt.trigger_event('date_change', [
            this.task,
            new_start_date,
            date_utils.add(new_end_date, -1, 'second'),
        ]);
    }

    progress_changed() {
        const new_progress = this.compute_progress();
        this.task.progress = new_progress;
        this.gantt.trigger_event('progress_change', [this.task, new_progress]);
    }

    set_action_completed() {
        this.action_completed = true;
        setTimeout(() => (this.action_completed = false), 1000);
    }

    compute_start_end_date() {
        const bar = this.$bar;

        const x_in_units = (bar.getX()) / this.gantt.options.column_width;
        const new_start_date = date_utils.add(
            this.gantt.gantt_start,
            x_in_units,
            'minute'
        );
        const width_in_units = bar.getWidth() / this.gantt.options.column_width;

        const new_end_date = date_utils.add(
            new_start_date,
            width_in_units,
            'minute'
        );

        return { new_start_date, new_end_date };
    }

    compute_progress() {
        const progress =
            (this.$bar_progress.getWidth() / this.$bar.getWidth()) * 100;
        return parseInt(progress, 10);
    }

    compute_expected_progress() {
        this.expected_progress = date_utils.diff(date_utils.today(), this.task._start, 'hour') / this.gantt.options.step;
        this.expected_progress = ((this.expected_progress < this.duration) ? this.expected_progress : this.duration) * 100 / this.duration;
    }

    compute_x() {
        const { step, column_width } = this.gantt.options;
        const task_start = this.task._start;
        const gantt_start = this.gantt.gantt_start;

        const diff = date_utils.diff(task_start, gantt_start, 'hour');
        let x = (diff / step) * column_width;

        if (this.gantt.view_is('Month')) {
            const diff = date_utils.diff(task_start, gantt_start, 'day');
            x = (diff * column_width) / 30;
        } else if (this.gantt.view_is('Time')) {
            const diff = date_utils.diff(task_start, gantt_start, 'minutes');
            x = diff * column_width;
        }
        //this.x = x + this.gantt.gantt_offset_width;
        this.x = x
    }

    compute_y() {
        if (Number.isInteger(this.task._index)) {
            this.y = (
                (this.height + this.gantt.options.padding) * this.task._index + (this.gantt.options.padding / 2)
            );
        }
        
    }

    compute_duration() {
        if (this.gantt.view_is('Time')) {
            //this.duration = date_utils.diff(this.task._end, this.task._start, 'minutes') / 5;
            this.duration = date_utils.diff(this.task._end, this.task._start, 'minutes');
        } else {
            this.duration = date_utils.diff(this.task._end, this.task._start, 'hour') / this.gantt.options.step;
        }
    }

    update_attr(element, attr, value) {
        value = +value;
        if (!isNaN(value)) {
            element.setAttribute(attr, value);
        }
        return element;
    }

    update_expected_progressbar_position() {
        if (this.invalid) return;
        this.$expected_bar_progress.setAttribute('x', this.$bar.getX());
        this.compute_expected_progress();
        this.$expected_bar_progress.setAttribute(
            'width',
            this.gantt.options.column_width * this.duration * (this.expected_progress / 100) || 0
        );
    }

    update_progressbar_position() {
        if (this.invalid) return;
        this.$bar_progress.setAttribute('x', this.$bar.getX());
        this.$bar_progress.setAttribute(
            'width',
            this.$bar.getWidth() * (this.task.progress / 100)
        );
    }

    update_label_position() {
        const bar = this.$bar;
        const label = this.group.querySelector('.bar-label')

        if (label.getBBox().width > bar.getWidth()) {
            this.truncateTextToFit(label, bar.getWidth())
        }

        label.setAttribute('x', bar.getX() + bar.getWidth() / 2);
        label.setAttribute('y', bar.getY() + this.height / 2,);
    }

    truncateTextToFit = (textElement, maxWidth) => {
        let textContent = textElement.textContent;
        while (textElement.getBBox().width > maxWidth && textContent.length >0) {
            textContent = textContent.slice(0, -1);
            textElement.textContent = `${textContent}...`
        }
        
    }

    update_handle_position() {
        if (this.invalid) return;
        const bar = this.$bar;
        this.handle_group
            .querySelector('.handle.left')
            .setAttribute('x', bar.getX() + 1);
        this.handle_group
            .querySelector('.handle.right')
            .setAttribute('x', bar.getEndX() - 9);
        const handle = this.group.querySelector('.handle.progress');
        handle &&
            handle.setAttribute('points', this.get_progress_polygon_points());
    }

    update_arrow_position() {
        this.arrows = this.arrows || [];
        for (let arrow of this.arrows) {
            arrow.update();
        }
    }
}

function isFunction(functionToCheck) {
    var getType = {};
    return (
        functionToCheck &&
        getType.toString.call(functionToCheck) === '[object Function]'
    );
}