import { asynchronousCommunication } from '../asyncCommunicator/asyncCommunicator.js';
import { UIManger } from '../manager/UIManger.js'
import { dropdownManger } from '../manager/dropdownbox.js';

import { initializeLoadingScreen } from '../manager/loadingManager.js';

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
        this.filterContent = document.getElementById('filerOpenButton');

        this.memberSelectLabel = document.getElementById('memberSelectLabel');
        this.selectedMemberText = document.getElementById('selectedMemberText');
        this.headerBackBtn = document.getElementById('headerBackBtn');
        this.submitElement = document.querySelector('.panel-nav-action-col input');
        this.checkboxes = document.querySelectorAll('#selectMemberContent input[type="checkbox"]');
        this.handleSubmitClick = this.handleSubmitClick.bind(this);
        this.handleMemberSubmitClick = this.handleMemberSubmitClick.bind(this);
        this.animationflg = false;
        this.setSubmitElementListener();

        const itemSelector = "#carouselSlide"
        this.dropdowns = {
            'lineNameSelect' : 'data-line-name',
            'machineSelect': 'data-machine-name',
        };
        //this.dropdownManger = new dropdownManger(this.dropdowns, '',itemSelector, this.carousel.setupCarousel.bind(this.carousel));
        this.dropdownManger = new dropdownManger(this.dropdowns, '', itemSelector);
        this.initialize();


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
                this.getDatetimeValue();
                this.getResultValue();
                this.getPointsToNote();
                this.getResultMahours()
                this.getSelectMemberValues();
                this.getComment();
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
            this.showFilterOverlay();
        });

        this.headerBackBtn.addEventListener('click', () => {
            if (this.selectMemberContent.style.display === 'block' && !this.animationflg) {
                this.slideOutContent([this.selectMemberContent], this.implementationModal);
                this.submitElement.dataset.modalstate = 'submit';
                this.submitElement.value = '完了';
                this.setSubmitElementListener();
                this.animationflg = false
            } else if(this.implementationModal.style.display === 'block') {
                this.slideOutContent([this.modal], this.carousel.carousel);
                this.animationflg = false
            }
        });
        const closeOverlayButton = document.getElementById('closeOverlayButton');
        closeOverlayButton.addEventListener('click', () => {
            mask.style.display = 'none';
            UIManger.toggleClass(filterOverlay, 'show', 'remove');
            this.carousel.setupCarousel()
            if (this.carousel.indices.length > 0) {
                const buttonImplementation = document.getElementById('implementation-button');
                if (buttonImplementation && buttonImplementation.style.visibility !== '') {
                    buttonImplementation.style.visibility = '';
                }
            }
            
        });

        const textarea = document.getElementById('issueDetails');
        const buttonContainer = document.getElementById('textInsertButtonContainer');
        const toppatsuButton = document.getElementById('toppatsuButton');
        textarea.addEventListener('click', () => {
            UIManger.toggleClass(buttonContainer, 'hidden', 'remove');
        });

        textarea.addEventListener('blur', () => {
            setTimeout(() => {
                UIManger.toggleClass(buttonContainer, 'hidden', 'add');
            }, 150);
        });

        toppatsuButton.addEventListener('click', () => {
            textarea.value += toppatsuButton.value;
        })
    }

    initialize() {
        this.hideModalUIs();
        //this.dropdownManger.liInitDropdowns(true);
        this.dropdownManger.initDropdownsWithAttributes()

        this.dropdownManger.setChangeListener('lineNameSelect', () => {
            this.dropdownManger.filterChaineDropdowns([
                { id: 'lineNameSelect' },
                { id: 'machineSelect', filterAttr: 'data-line-name', idAttr: 'data-machine-name' }
            ]);
        });
        
        /*
        this.dropdownManger.setupDropdowns(async (event, attribute) => {
            await this.carousel.setupCarousel()
        });
        */

        this.addEventListeners();
    }

    hideModalUIs() {
        this.selectMemberContent.style.display = 'none';
        this.modal.style.display = 'none';
        this.implementationModal.style.display = 'none';
    }

    showFilterOverlay() {
        const mask = document.getElementById('mask');
        const filterOverlay = document.getElementById('filterContent');

        mask.style.display = 'block';
        requestAnimationFrame(() => {
            filterOverlay.classList.add('show');
        });
    }

    getPlanId(cardIndex) {
        this.slide = document.querySelector(`.carousel-slide[data-index="${cardIndex}"]`);
        this.planId = document.querySelector('input[name="plan_id"]');
        this.planId.value = this.slide.getAttribute('plan-id');
        this.modalStateManager.updateCurrentSlide(this.slide);
    }

    getDatetimeValue() {
        const now = new Date();
        const formattedNow = UIManger.formatDateStringToISO(now);
        document.getElementById('datetime').value = formattedNow
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
        hideElements.forEach(hideElement => {
            hideElement.style.display = 'none'
        })
        showElement.style.display = 'block';
        showElement.classList.remove('slide-out');
        showElement.classList.add('animated');
        showElement.addEventListener('animationend', () => {
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
            if(this.slide) {
                const data = this.getSlideAttributes();

                this.removeCurrentSlide();
                this.updateCarouselAfterRemoval();
                this.resetIssueDetails();
                this.animationflg = false;
                
                if (this.carousel.indices != 0) {
                    for (const [dropdownId, attr] of Object.entries(this.dropdownManger.dropdowns)) {
                        const dropdown = document.getElementById(dropdownId);
                        this.dropdownManger.updateOptionCount(
                            dropdown, 
                            attr, 
                            data
                        );
                    };
                    this.carousel.totalSlides -= 1;
                    this.showOverModal();
                    setTimeout(() => {
                        document.getElementById('overModal').style.display = 'none';
                        this.carousel.moveSlide(0);
                    }, 800);
                } else {
                    for (const [dropdownId, attr] of Object.entries(this.dropdownManger.dropdowns)) {
                        const dropdown = document.getElementById(dropdownId);
                        this.dropdownManger.updateOptionCount(
                            dropdown, 
                            attr, 
                            data
                        );
                    };
                    this.carousel.totalSlides -= 1;
                    if  (this.carousel.totalSlides === 0) {
                        this.showCompletionMessage();
                        return;
                    }

                    this.showOverModal();
                    setTimeout(() => {
                        document.getElementById('overModal').style.display = 'none';

                        this.carousel.handleNoSlidesAvailable();
                        this.showFilterOverlay();
                    }, 800)              
                }

                const completedPlanId = this.slide.getAttribute('plan-id');
                this.removePlanIdFromUrl(completedPlanId);
            }
        })
        .catch(error => {
            console.log('Error', error);
        })
    }

    showCompletionMessage() {
        const modal = document.getElementById('overModal');
        if (!modal) return;

        const svg = modal.querySelector('svg');
        if (svg) svg.remove();

        const messageDiv = modal.querySelector('.submit-message');
        if (messageDiv) {
            messageDiv.innerHTML = `
                全て終了しました。<br>お疲れ様した。<br>
                <span id="countdown">3秒後<br>homeに戻ります。 </span>
            `;
        }
        modal.style.display = 'flex';

        let countdown = 3;
        const countdownSpan = document.getElementById('countdown');

        const intervalId = setInterval(() => {
            countdown--;
            if (countdownSpan) {
                countdownSpan.innerHTML = `${countdown}秒後<br>homeに戻ります。`;
            }

            if (countdown === 0) {
                clearInterval(intervalId);
                const basePath = window.location.origin;
                window.location.href = `${basePath}/home/`
            }
        }, 1000);
    }

    getSlideAttributes() {
        return {
            'data-line-name': this.slide.getAttribute('data-line-name'),
            'data-machine-name': this.slide.getAttribute('data-machine-name')
        };
    }

    showOverModal() {
        const modal = document.getElementById('overModal');
        if (modal) modal.style.display = 'flex';
        this.slideOutContent([this.modal], this.carousel.carousel);
    }

    removeCurrentSlide() {
        if (this.slide && this.slide.parentNode) {
            this.slide.parentNode.removeChild(this.slide);
        }
    }

    updateCarouselAfterRemoval() {
        delete this.carousel.indices[this.currentIndex];
        delete this.carousel.heights[this.currentIndex];
        this.carousel.updateSlideIndices();
    }

    resetIssueDetails() {
        const textArea = document.getElementById('issueDetails');
        if (textArea) textArea.value = '';
    }

    handleMemberSubmitClick() {
        if (!this.animationflg) {
            this.updateMemberValues();
            this.slideOutContent([this.selectMemberContent], this.implementationModal);
            this.submitElement.dataset.modalstate = 'submit';
            this.submitElement.value = '完了';
            this.setSubmitElementListener();
        }
    }

    getPlanIdsFromUrl() {
        const url = new URL(window.location.href);
        return url.searchParams.getAll('planId');
    }

    removePlanIdFromUrl(completedId) {
        const url = new URL(window.location.href);
        const params = url.searchParams;

        const remainingIds = this.getPlanIdsFromUrl().filter(id => id !== completedId);

        params.delete('planId');

        remainingIds.forEach(id => params.append('planId', id));
        const newUrl = `${url.pathname}?${params.toString()}`;
        history.replaceState(null, '', newUrl);
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
        this.slideWidth = this.trackContainer.getBoundingClientRect().width;
        
        this.touchStartX = 0;
        this.touchCurrentX = 0;
        this.calculateSlideHeights();
        this.setupCarousel();
        this.addEventListeners();
        this.ModalHandler = new ModalHandler(this);
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
            if (this.ModalHandler) {
                this.updateCalsesCarousel();
            }
            this.updateSlideIndices()
            this.initialize()
            
        } else {
            this.handleNoSlidesAvailable();
        }
    }

    updateCalsesCarousel() {
        const carousels = document.querySelectorAll('.carousel-slide');
        //carousels.forEach(carousel => UIManger.toggleClass(carousel, 'hidden', 'remove'));
        carousels.forEach(carousel => UIManger.toggleClass(carousel, 'display-none', 'remove'));
        const dropdowns = this.ModalHandler.dropdownManger.dropdowns;
        Object.keys(dropdowns).forEach(dropdownId => {
            const dropdownElement = document.getElementById(dropdownId);
            const dataAttribute = dropdowns[dropdownId];
            const selectedValue = dropdownElement.value;

            if (selectedValue) {
                carousels.forEach(carousel => {
                    if (carousel.getAttribute(dataAttribute) !== selectedValue) {
                        //UIManger.toggleClass(carousel, 'hidden', 'add');
                        UIManger.toggleClass(carousel, 'display-none', 'add');
                    }
                });
            }
        });
    }

    initStyles() {
        const filterModal = document.getElementById('optMyModal');
        UIManger.toggleClass(filterModal, 'hidden', 'remove');
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
        //return document.querySelectorAll('.carousel-slide:not(.hidden)')
        return document.querySelectorAll('.carousel-slide:not(.display-none)')
    }

    
    calculateSlideHeights() {
        this.heights = {};
        const slides = this.getVisiblesSlides()
        const layoutHeights = this.getFixedLayoutHeights();
        slides.forEach((slide) => {
            const calculateHeight = this.calculateSlideHeight(slide, layoutHeights);
            /*
            if (calculateHeight !== null) {
                const index = slide.dataset.index;
            }
            */
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

        //不要なボタンを非表示にする
        const buttonsToHide = ['carouselButtonLeft', 'carouselButtonRight', 'implementation-button'];
        buttonsToHide.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.style.visibility = 'hidden';
            }
        });
    }

    removeNoSlidesMessage() {
        const existingMessage = this.carousel.querySelector('.no-slides-message');
        if (existingMessage) {
            this.carousel.removeChild(existingMessage);
        }
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
    initializeLoadingScreen();
    new Carousel();
});
