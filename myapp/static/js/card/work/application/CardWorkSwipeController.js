// static/js/card/work/application/CardWorkSwipeController.js

const CARD_WORK_SWIPE_MEDIA_QUERY = '(max-width: 640px)';

const CARD_WORK_SWIPE_TARGET_SELECTOR = '.card-work-plan-card';
const CARD_WORK_SWIPE_IGNORE_SELECTOR = 'button, a, input, select, textarea, label, [contenteditable="true"]';

const CARD_WORK_SWIPE_MIN_DISTANCE_PX = 72;
const CARD_WORK_SWIPE_AXIS_RATIO = 1.25;


export class CardWorkSwipeController {
    constructor({
        root,
        onSwipeLeft,
        onSwipeRight,
    } = {}) {
        this.root = root;
        this.onSwipeLeft = typeof onSwipeLeft === 'function'
            ? onSwipeLeft
            : null;
        this.onSwipeRight = typeof onSwipeRight === 'function'
            ? onSwipeRight
            : null;
        this.swipeState = null;

        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handlePointerCancel = this.handlePointerCancel.bind(this);
    }


    bind() {
        this.root?.addEventListener('pointerdown', this.handlePointerDown);
        this.root?.addEventListener('pointermove', this.handlePointerMove);
        this.root?.addEventListener('pointerup', this.handlePointerUp);
        this.root?.addEventListener('pointercancel', this.handlePointerCancel);
    }


    destroy() {
        this.root?.removeEventListener('pointerdown', this.handlePointerDown);
        this.root?.removeEventListener('pointermove', this.handlePointerMove);
        this.root?.removeEventListener('pointerup', this.handlePointerUp);
        this.root?.removeEventListener('pointercancel', this.handlePointerCancel);

        this.swipeState = null;
    }


    handlePointerDown(event) {
        if (!this.isSwipeEnabled(event)) {
            return;
        }

        if (this.shouldIgnoreSwipeTarget(event.target)) {
            return;
        }

        const targetCard = event.target.closest(CARD_WORK_SWIPE_TARGET_SELECTOR);

        if (!targetCard) {
            return;
        }

        this.swipeState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            cancelled: false,
        };

        event.target.setPointerCapture?.(event.pointerId);
    }


    handlePointerMove(event) {
        if (!this.isActiveSwipePointer(event)) {
            return;
        }

        const deltaX = event.clientX - this.swipeState.startX;
        const deltaY = event.clientY - this.swipeState.startY;

        if (Math.abs(deltaY) > 24 && Math.abs(deltaY) > Math.abs(deltaX)) {
            this.swipeState.cancelled = true;
        }
    }


    handlePointerUp(event) {
        if (!this.isActiveSwipePointer(event)) {
            return;
        }

        const swipeState = this.swipeState;
        this.swipeState = null;

        if (swipeState.cancelled) {
            return;
        }

        const deltaX = event.clientX - swipeState.startX;
        const deltaY = event.clientY - swipeState.startY;

        if (!this.isHorizontalSwipe(deltaX, deltaY)) {
            return;
        }

        if (deltaX < 0) {
            this.onSwipeLeft?.();
            return;
        }

        this.onSwipeRight?.();
    }


    handlePointerCancel(event) {
        if (!this.isActiveSwipePointer(event)) {
            return;
        }

        this.swipeState = null;
    }


    isActiveSwipePointer(event) {
        return (
            this.swipeState !== null &&
            this.swipeState.pointerId === event.pointerId
        );
    }


    isSwipeEnabled(event) {
        const isMobileWidth = window.matchMedia(CARD_WORK_SWIPE_MEDIA_QUERY).matches;

        if (!isMobileWidth) {
            return false;
        }

        return (
            event.pointerType === 'touch' ||
            event.pointerType === 'pen' ||
            navigator.maxTouchPoints > 0 ||
            this.isDebugMouseSwipeEnabled(event)
        );
    }


    isDebugMouseSwipeEnabled(event) {
        return (
            event.pointerType === 'mouse' &&
            window.matchMedia(CARD_WORK_SWIPE_MEDIA_QUERY).matches
        );
    }


    shouldIgnoreSwipeTarget(target) {
        return Boolean(target?.closest(CARD_WORK_SWIPE_IGNORE_SELECTOR));
    }


    isHorizontalSwipe(deltaX, deltaY) {
        return (
            Math.abs(deltaX) >= CARD_WORK_SWIPE_MIN_DISTANCE_PX &&
            Math.abs(deltaX) >= Math.abs(deltaY) * CARD_WORK_SWIPE_AXIS_RATIO
        );
    }
}