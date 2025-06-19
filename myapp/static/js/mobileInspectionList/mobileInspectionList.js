import { asynchronousCommunication } from '../asyncCommunicator/asyncCommunicator.js';
import { UIManger } from '../manager/UIManger.js'
import { initializeLoadingScreen } from '../manager/loadingManager.js';

class Carousel {
    constructor() {
        this.carousel = document.querySelector('.carousel');
        this.slide = document.querySelectorAll('.carousel-slide');
        this.container = document.querySelector('.carousel-track');
        this.trackContainer = document.querySelector('.carousel-track-container');
        this.totalSlides = this.slide.length;
        this.currentIndex = 0;
        this.newIndexPosition = 0;
        this.slideWidth = this.trackContainer.getBoundingClientRect().width;
        this.touchStartX = 0;
        this.touchCurrentX = 0;
        this.calculateSlideHeights();
        this.setupCarousel();
        this.addEventListeners();
    }

    addEventListeners() {
        this.trackContainer.addEventListener('touchstart', this.handleTouchStart.bind(this), false);
        this.trackContainer.addEventListener('touchmove', this.handleTouchMove.bind(this), false);
        this.trackContainer.addEventListener('touchend', this.handleTouchEnd.bind(this), false)

        this.showFilterOverlay();
        this.closeFilterOverlay();
    }

    setupCarousel() {
        if (this.totalSlides > 0) {
            this.updateSlideIndices()
            this.initialize()
            
        } else {
            this.handleNoSlidesAvailable();
        }
    }

    getFixedLayoutHeights() {
        const windowHeight = window.innerHeight;
        const header = document.querySelector('.l-header');
        const headerHeight = header?.getBoundingClientRect().height || 0;
        const button = document.getElementById('implementation-button');
        const buttonHeight = button?.getBoundingClientRect().height || 0;
    
        return { windowHeight, headerHeight, buttonHeight };
    }

    calculateSlideHeight(slide, layoutHeights) {
        const card = slide.querySelector('.card');
        if (!card) return null;
    
        const cardHeader = card.querySelector('.card-header');
        const cardHeaderHeight = cardHeader?.getBoundingClientRect().height || 0;
        const cardApplicable = slide.querySelector('.applicable-devices-wrappper');
        if (!cardApplicable) return null;
    
        const availableHeight = layoutHeights.windowHeight - (layoutHeights.headerHeight + cardHeaderHeight + layoutHeights.buttonHeight);
        const actualContentHeight = cardApplicable.scrollHeight;
    
        cardApplicable.style.maxHeight = `${availableHeight}px`;
        cardApplicable.dataset.maxHeight = `${availableHeight}`;
        cardApplicable.style.overflowY = actualContentHeight + 30 > availableHeight ? 'auto' : 'hidden';

        const minRequiredHeight = actualContentHeight + 30;
        return Math.max(minRequiredHeight, availableHeight);
    }

    getVisiblesSlides() {
        return document.querySelectorAll('.carousel-slide:not(.display-none)')
    }

    calculateSlideHeights() {
        this.heights = {};
        const slides = this.getVisiblesSlides()
        const layoutHeights = this.getFixedLayoutHeights();
        slides.forEach((slide) => {
            const calculateHeight = this.calculateSlideHeight(slide, layoutHeights);
        });
    }

    moveSlide(direction) {
        this.updateSlidePosition(direction);
        this.changeText()
    }

    //タッチ開始時の処理
    handleTouchStart(event) {
        this.touchStartX = event.touches[0].clientX;
        const style = window.getComputedStyle(this.container);
        this.matrix = new WebKitCSSMatrix(style.transform);
    }

    //タッチ移動時の処理
    handleTouchMove(event) {
        this.touchCurrentX = event.touches[0].clientX;
        const moveX = this.touchCurrentX - (this.touchStartX - this.matrix.m41);
        this.container.style.transform = `translateX(${moveX}px)`;
    }
    
    //タッチ終了時の処理
    handleTouchEnd(event) {
        const touchEndX = event.changedTouches[0].clientX;
        const swipeDistance = touchEndX - this.touchStartX;
        const threshold = this.carousel.offsetWidth / 6;

        if (Math.abs(swipeDistance) > threshold) {
            if (swipeDistance < 0) {
                this.moveSlide(1);
            } else {
                this.moveSlide(-1);
            }
        } else {
            this.resetCarouselPosition();
        }
    }
    resetCarouselPosition() {
        this.container.style.transform = `translateX(${this.matrix.m41}px)`;
    }

    initialize() {
        this.removeNoSlidesMessage(); 
        this.currentIndex = 0;
        this.changeText();
        this.updateSlidePosition(this.currentIndex);
    }

    calculateNewIndex() {
        this.indices = Object.keys(this.heights).map(Number);
    }

    updateSlideIndices() {
        const updateSlides = this.getVisiblesSlides()
        this.indices = Array.from(updateSlides)
            .map(slide => Number(slide.dataset.index))
            .filter(index => !isNaN(index));
    }

    getCurrentIndex() {
        return this.indices[this.currentIndex];
    }

    changeText() {
        const titlePosition = this.indices[this.currentIndex]
        this.titleNumber = document.querySelector(`.carousel-slide[data-index="${titlePosition}"] .title-number`);
        this.titleNumber.textContent = `${this.currentIndex + 1}/${this.indices.length}`;
    }

    updateSlidePosition(direction) {
        if (direction !== 0) {
            this.currentIndex = (this.currentIndex + direction + this.indices.length)  % this.indices.length
        }
        const newLeft = -this.currentIndex * this.slideWidth;
        this.container.style.transform = `translateX(${newLeft}px)`;
    }

    handleNoSlidesAvailable() {
        // 「表示する内容がありません。」というメッセージを表示
        const messageElement = document.createElement('div');
        messageElement.textContent = '表示する内容がありません';
        messageElement.classList.add('no-slides-message');
        messageElement.style.fontSize = '24px';
        messageElement.style.textAlign = 'center';
        messageElement.style.padding = '30px';
        this.carousel.appendChild(messageElement);
    }

    removeNoSlidesMessage() {
        const existingMessage = this.carousel.querySelector('.no-slides-message');
        if (existingMessage) {
            this.carousel.removeChild(existingMessage);
        }
    }

    showFilterOverlay() {
        const mask = document.getElementById('mask');
        const filterOverlay = document.getElementById('detailContent');
        const filerOpenButton = document.getElementById('filerOpenButton');
        filerOpenButton.addEventListener('click', () => {
            mask.style.display = 'block';
            requestAnimationFrame(() => {
                filterOverlay.classList.add('show');
            });
            const index = this.getCurrentIndex();
            const currentCarousel = this.getCarousel(index);
            this.changeDetailContents(currentCarousel)
        })
    }
    
    closeFilterOverlay() {
        const closeOverlayButton = document.getElementById('closeOverlayButton');
        const filterOverlay = document.getElementById('detailContent');
        const mask = document.getElementById('mask');
        closeOverlayButton.addEventListener('click', () => {
            mask.style.display = 'none';
            UIManger.toggleClass(filterOverlay, 'show', 'remove');
        });
    }

    getCarousel(index) {
        const currentCarousel = document.querySelector(`.carousel-slide[data-index="${index}"]`);
        return currentCarousel
    }

    changeDetailContents(currentCarousel) {
        this.clearDetailContents()
        document.getElementById('statusValue').textContent = currentCarousel.dataset.status;
        document.getElementById('implementerValue').textContent = currentCarousel.dataset.implementer;
        document.getElementById('dayOfWeekVallue').textContent = currentCarousel.dataset.dayofweek;
        document.getElementById('manHourValue').textContent = currentCarousel.dataset.manhour;
    }

    clearDetailContents() {
        document.getElementById('statusValue').textContent = '';
        document.getElementById('implementerValue').textContent = '';
        document.getElementById('dayOfWeekVallue').textContent = '';
        document.getElementById('manHourValue').textConetent = ''
    }
    
}


document.addEventListener('DOMContentLoaded', () => {
    initializeLoadingScreen();
    new Carousel();
});