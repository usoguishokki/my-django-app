import { asynchronousCommunication } from './asyncCommunicator.js';
import { UIManger } from './UIManger.js'
import { dropdownManger } from './dropdownbox.js';

class ModalStateManger {
    constructor() {
        this.savedRadioState = null;
        this.savedTextareaContent = '';
        this.savedSelectState = null;
        this.savedCheckboxStates = {};
        this.checkboxes = document.querySelectorAll('#selectMemberContent input[type="checkbox"]');
        this.radioButtons = document.querySelectorAll('input[type="radio"][name="options"]');
        this.selectedMemberText = document.getElementById('selectedMemberText');
        this.submitElement = document.querySelector('.panel-nav-action-col input');
    }

    initialize() {
        const parts = this.currentSlide.querySelectorAll('.wark_name .part');
        //各'.part'のテキストを結合
        const partsText = Array.from(parts).map(part => part.textContent).join('');
        //対象のdiv要素を選択
        const panelNavbarTitle = document.querySelector('.panelNavbarTitle');
        if(panelNavbarTitle) panelNavbarTitle.textContent = partsText;
    }

    updateCurrentSlide(slide) {
        this.currentSlide = slide
    }
}
class ModalHandler {
    constructor(carousel) {
        this.modalStateManager = new ModalStateManger();
        this.carousel = carousel;
        this.implementationButton = getShareImplementationButton();
        this.modal = document.getElementById('optMyModal');
        this.implementationModal = document.getElementById('implementationResults');
        this.selectMemberContent = document.getElementById('selectMemberContent');
        this.filterContent = document.getElementById('openModal');
        this.memberSelectLabel = document.getElementById('memberSelectLabel');
        this.selectedMemberText = document.getElementById('selectedMemberText');
        this.headerBackBtn = document.getElementById('headerBackBtn');
        this.submitElement = document.querySelector('.panel-nav-action-col input');
        this.checkboxes = document.querySelectorAll('#selectMemberContent input[type="checkbox"]');
        this.handleSubmitClick = this.handleSubmitClick.bind(this);
        this.handleMemberSubmitClick = this.handleMemberSubmitClick.bind(this);
        this.animationflg = false;
        this.setSubmitElementListener();
        this.initialize();
        //this.modalStateManager.initialize()
        
        const itemSelector = "#carouselSlide"
        this.dropdowns = {
            'lineNameSelect' : 'data-line-name',
            'machineSelect': 'data-machin-name',
        };
        this.dropdownManger = new dropdownManger(this.dropdowns, '',itemSelector, this.carousel.setupCarousel.bind(this.carousel));
        this.dropdownManger.liInitDropdowns();
        this.dropdownManger.initEventListeners();
        this.addEventListeners();
    }

    addEventListeners() {
        const filterOverlay = document.getElementById('filterContent');
        const mask = document.getElementById('mask');
        this.implementationButton.addEventListener('click', () => {
            if(!this.animationflg) {
                this.currentIndex = this.carousel.getCurrentIndex();
                this.getPlanId(this.currentIndex);
                this.modal.style.display = 'block';
                this.slideInContent([this.implementationModal], this.implementationModal);
                this.getResultValue();
                this.getPointsToNote();
                this.getResultMahours()
                this.getSelectMemberValues();
                this.getComment();
                //this.modalStateManager.saveStates();
                this.submitElement.dataset.modalstate = 'submit'
                this.submitElement.value = '完了';
                this.modalStateManager.initialize();
                this.setSubmitElementListener();
                this.animationflg = false
            }
        });

        this.memberSelectLabel.addEventListener('click', () => {
            if (!this.animationflg) {
                this.slideInContent([this.implementationModal], this.selectMemberContent);
                this.submitElement.dataset.modalstate = 'memberSubmit';
                this.submitElement.value = '確定';
                this.setSubmitElementListener();
                this.animationflg = false
            }
        });

        this.filterContent.addEventListener('click', () => {
            mask.style.display = 'block';
            requestAnimationFrame(() => {
                filterOverlay.classList.add('show');
            });
        });

        this.headerBackBtn.addEventListener('click', () => {
            if (this.selectMemberContent.style.display === 'block' && !this.animationflg) {
                this.slideOutContent([this.selectMemberContent], this.implementationModal);
                this.submitElement.dataset.modalstate = 'submit';
                this.submitElement.value = '完了';
                this.setSubmitElementListener();
                this.animationflg = false
                //this.modalStateManager.restoreStates();
            } else if(this.implementationModal.style.display === 'block') {
                this.slideOutContent([this.modal], this.carousel.carousel);
                this.animationflg = false
                //this.modalStateManager.restoreStates();
            }
        });
        const closeOverlayButton = document.getElementById('closeOverlayButton');
        closeOverlayButton.addEventListener('click', () => {
            mask.style.display = 'none';
            UIManger.toggleClass(filterOverlay, 'show', 'remove');
        })
    }

    initialize() {
        this.selectMemberContent.style.display = 'none';
        this.modal.style.display = 'none';
        this.implementationModal.style.display = 'none';
        
    }

    getPlanId(cardIndex) {
        this.slide = document.querySelector(`.carousel-slide[data-index="${cardIndex}"]`);
        this.planId = document.querySelector('input[name="plan_id"]');
        this.planId.value = this.slide.getAttribute('plan-id');
        this.modalStateManager.updateCurrentSlide(this.slide);
    }

    getResultValue() {
        const planId = this.planId.value;
        const liElement = document.querySelector(`.carousel-slide[plan-id="${planId}"]`);
        const resultRadioButton_OK = document.getElementById('id_options_0');
        const resultRadioButton_NG = document.getElementById('id_options_1');
        if (liElement) {
            const result = liElement.getAttribute('data-result')
            if (result !=='NG') {
                resultRadioButton_OK.checked = true;
            } else {
                resultRadioButton_NG.checked = true;
            }
        }
    }

    getPointsToNote() {
        const planId = this.planId.value;
        const liElement = document.querySelector(`.carousel-slide[plan-id="${planId}"]`);
        const textarea = document.getElementById('issueDetails');
        if (liElement) {
            const pointsToNone = liElement.getAttribute('data-point-to-note');
            if (UIManger.isValidValue(pointsToNone)) {
                textarea.value = pointsToNone;
            }
        }
    }

    getResultMahours() {
        const planId = this.planId.value;
        const liElement = document.querySelector(`.carousel-slide[plan-id="${planId}"]`);
        const manHoursSelectBox = document.getElementById('selected-manhours');
        if (liElement) {
            const manHours = liElement.getAttribute('data-result-mahours');
            if (UIManger.isValidValue(manHours)) {
                manHoursSelectBox.value = manHours;
            } else {
                manHoursSelectBox.selectedIndex = 0;
            }
        }

    }

    getSelectMemberValues() {
        const planId = this.planId.value;
        const liElement = document.querySelector(`.carousel-slide[plan-id="${planId}"]`);
        const selectedMemberText = document.getElementById('selectedMemberText');
        this.selectedValues = [];
        let checkedCount = 0;
        if(liElement) {
            const memberCheckList = JSON.parse(liElement.getAttribute('data-member-check-list').replace(/'/g, '"'));
            memberCheckList.forEach(member => {
                const checkbox = document.querySelector(`input[type="checkbox"][data-member-id="${member.user_id}"]`);
                if (checkbox) {
                    checkbox.checked = member.checked;
                    // チェックされているか確認してカウントを増やす
                    if (checkbox.checked) {
                        this.selectedValues.push(checkbox.value);
                        checkedCount++;
                    }
                }
                selectedMemberText.textContent = `${this.selectedValues[0]}, 全${this.selectedValues.length}名`;
            })
        }
    }

    getComment() {
        const planId = this.planId.value;
        const liElement = document.querySelector(`.carousel-slide[plan-id="${planId}"]`);
        const commentTextarea = document.getElementById('comment');
        if(liElement) {
            const comment = liElement.getAttribute('data-comment');
            if (UIManger.isValidValue(comment)) {
                commentTextarea.value = comment;
            }
        }
    }

    updateMemberValues() {
        this.selectedValues = []
        this.checkboxes.forEach((checkbox) => {
            if (checkbox.checked) {
                this.selectedValues.push(checkbox.value);
            }
        });
        const selectedMemberText = document.getElementById('selectedMemberText');
        if (this.selectedValues.length > 0) {
            selectedMemberText.textContent = `${this.selectedValues[0]}, 全${this.selectedValues.length}名`;
        } else {
            selectedMemberText.textContent = '選択者なし';
        }
    }

    slideInContent(hideElements=[], showElement) {
        this.animationflg = true;
        console.log('slideInContent called');
        hideElements.forEach(hideElement => {
            hideElement.style.display = 'none'
            console.log(`Hiding element: ${hideElement.id}`);
        })
        showElement.style.display = 'block';
        showElement.classList.remove('slide-out');
        showElement.classList.add('animated');
        console.log(`Showing element: ${showElement.id}`);
        showElement.addEventListener('animationend', () => {
            console.log('Animation ended');
            this.animationflg = false;
        }, { once: true });
    }

    slideOutContent(hideElements=[], showElement) {
        this.animationflg = true;
        hideElements.forEach(hideElement => {
            hideElement.classList.remove('animated');
            hideElement.style.display = 'none';
        });
        showElement.style.display = 'block';
        showElement.classList.add('slide-out');
        showElement.addEventListener('animationend', () => {
            //showElement.classList.remove('slide-out');
            this.animationflg = false;
        }, { once: true });
    }
    setSubmitElementListener() {
        const state = this.submitElement.dataset.modalstate;
        this.submitElement.removeEventListener('click', this.handleSubmitClick);
        this.submitElement.removeEventListener('click', this.handleMemberSubmitClick);
        if (state === 'submit') {
            this.submitElement.addEventListener('click', this.handleSubmitClick);
        } else if (state === 'memberSubmit') {
            this.submitElement.addEventListener('click', this.handleMemberSubmitClick);
        }
    }

    handleSubmitClick() {
        if(!isInputSelected('customRadio', 'radio')) {
            showAlert("結果を選択してください。");
            return false;
        }
        if (!isInputSelected('selectMemberContent', 'checkbox')) {
            showAlert("メンバーを選択してください。");
            return false;
        }
        this.form = document.getElementById('post-form');
        const formData = new FormData(this.form);
        formData.append('checkedCheckboxes', JSON.stringify(this.selectedValues));
        asynchronousCommunication({
            url: '/card/',
            method: 'POST',
            data:{
                action: 'fetch_post_form',
                form_data: Object.fromEntries(formData)
            }
        })
        .then(response => {
            console.log('Response', response);
            if(this.slide) {
                document.getElementById('overModal').style.display = 'flex';
                this.slideOutContent([this.modal], this.carousel.carousel);
                this.slide.parentNode.removeChild(this.slide);
                delete this.carousel.indices[this.currentIndex];
                delete this.carousel.heights[this.currentIndex];
                this.carousel.calculateNewIndex();
                this.animationflg = false;
                if (this.carousel.indices != 0) {
                    setTimeout(() => {
                        document.getElementById('overModal').style.display = 'none';
                        this.dropdownManger.liInitDropdowns();
                        this.carousel.moveSlide(0);
                    }, 800);
                } else {
                    setTimeout(() => {
                        document.getElementById('overModal').style.display = 'none';
                        this.carousel.handleNoSlidesAvailable();
                    }, 800)              
                }
            }
        })
        .catch(error => {
            console.log('Error', error);
        })
    }

    handleMemberSubmitClick() {
        if (!this.animationflg) {
            //this.slideInContent([this.implementationModal], this.selectMemberContent);
            //this.getSelectMemberValues();
            this.updateMemberValues();
            this.slideOutContent([this.selectMemberContent], this.implementationModal);
            this.submitElement.dataset.modalstate = 'submit';
            this.submitElement.value = '完了';
            this.setSubmitElementListener();
        }
    }
}

class Carousel {
    constructor() {
        this.initStyles();
        this.carousel = document.querySelector('.carousel');
        this.slide = document.querySelectorAll('.carousel-slide');
        this.container = document.querySelector('.carousel-track');
        this.trackContainer = document.querySelector('.carousel-track-container');
        this.totalSlides = this.slide.length;
        this.currentIndex = 0;
        this.newIndexPosition = 0;
        this.slideWidth = this.trackContainer.offsetWidth;
        
        this.touchStartX = 0;
        this.touchCurrentX = 0;
        //this.ajustHeight()
        this.setupCarousel();
        this.addEventListeners();
    }

    addEventListeners() {
        const leftButton = document.getElementById('carouselButtonLeft');
        const rightButton = document.getElementById('carouselButtonRight');
        this.trackContainer.addEventListener('touchstart', this.handleTouchStart.bind(this), false);
        this.trackContainer.addEventListener('touchmove', this.handleTouchMove.bind(this), false);
        this.trackContainer.addEventListener('touchend', this.handleTouchEnd.bind(this), false)

        leftButton.addEventListener('click', () => {
            this.moveSlide(-1);
        });
        
        rightButton.addEventListener('click', () => {
            this.moveSlide(1);
        });
    }

    setupCarousel() {
        if (this.totalSlides > 0) {
            this.calculateSlideHeights();
            this.initialize()
            
        } else {
            this.handleNoSlidesAvailable();
        }
    }

    initStyles() {
        const headerContetOpenModal = document.getElementById('openModal');
        UIManger.toggleClass(headerContetOpenModal, 'hidden', 'remove');
    }

    ajustHeight() {
        const windowHeight = UIManger.getScreenHeight();
        const reptionContainer = document.querySelector('reptionContner');
        const reptionContainerBottom =  reptionContainer.getBoundingClientRect().bottom;
    }

    calculateSlideHeights() {
        this.heights = {};
        const witdth = window.innerWidth;
        const height = window.innerHeight;
        const header = document.querySelector('.l-header');
        const headerHeight = header.getBoundingClientRect().height + 2;
        const childHight = document.getElementById('childGrid');
        this.slides = document.querySelectorAll('.carousel-slide:not(.hidden)');
        this.slides.forEach((slide) => {
            const card = slide.querySelector('.card');
            if (card) {
                let cardHeight = card.getBoundingClientRect().height;
                if (height < cardHeight + 30) {
                    this.heights[slide.dataset.index] = cardHeight + 30;
                } else {
                    this.heights[slide.dataset.index] = childHight.clientHeight;
                }
            }
        });
        if (Object.keys(this.heights).length > 0) {
            this.calculateNewIndex();
        } 
    }

    moveSlide(direction) {
        this.updateSlidePosition(direction);
        this.updateCarouselHeight();
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
        this.currentIndex = 0;
        this.updateCarouselHeight();
        this.changeText();
        this.updateSlidePosition(this.currentIndex);
    }

    calculateNewIndex() {
        this.indices = Object.keys(this.heights).map(Number);
    }

    getCurrentIndex() {
        return this.newIndexPosition;
    }

    changeText() {
        this.titleNumber = document.querySelector(`.carousel-slide[data-index="${this.newIndexPosition}"] .title-number`);
        this.titleNumber.textContent = `${this.currentIndex + 1}/${this.indices.length}`;
    }

    updateSlidePosition(direction) {
        if (direction !== 0) {
            this.currentIndex = (this.currentIndex + direction + this.indices.length)  % this.indices.length
        }
        const newLeft = -this.currentIndex * this.slideWidth;
        this.container.style.transform = `translateX(${newLeft}px)`;
    }

    updateCarouselHeight() {
        this.newIndexPosition = this.indices[this.currentIndex];
        if (this.heights[this.newIndexPosition]) {
            this.carousel.style.height = `${this.heights[this.newIndexPosition]}px`
        }
    }

    handleNoSlidesAvailable() {
        // 「表示する内容がありません。」というメッセージを表示
        const messageElement = document.createElement('div');
        messageElement.textContent = '表示する内容がありません';
        messageElement.style.fontSize = '24px';
        messageElement.style.textAlign = 'center';
        messageElement.style.padding = '30px';
        this.carousel.appendChild(messageElement);

        //不要なボタンを非表示にする
        const buttonsToHide = ['carouselButtonLeft', 'carouselButtonRight', 'implementation-button'];
        buttonsToHide.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.style.display = 'none';
            }
        });
    }
}

const getShareImplementationButton = () => document.getElementById('implementation-button');

const isInputSelected = (id, inputType) => {
    const container = document.getElementById(id);
    const inputs = container.querySelectorAll(`input[type="${inputType}"]`);
    return Array.from(inputs).some(input => input.checked);
}

const showAlert = (message) => {
    alert(message)
}

document.addEventListener('DOMContentLoaded', () => {
    const carousel = new Carousel();
    const modalHandler = new ModalHandler(carousel);
});
