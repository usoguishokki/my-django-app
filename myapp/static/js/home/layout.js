import { UIManger } from '../manager/UIManger.js';
export const adjustGridHeight = (tableScroll) => {
    const childGrid = document.getElementById('childGrid');
    //Calaculate the height of grid
    const childGridBoxModelDimensions = UIManger.calculateBoxModelDimensions(childGrid, ['paddingTop', 'paddingBottom', 'rowGap']);
    const childUsableDimensions = childGrid.offsetHeight - childGridBoxModelDimensions;
    //Heights for the first and second rows
    const row1Height = childUsableDimensions * (2.5 / 5.5);
    const row2Height = childUsableDimensions * (3 / 5.5);
    //Obtain the height of h3 title
    const titleGrid = document.querySelector('.grid-title');
    const titleBoxModelDimensions = UIManger.calculateBoxModelDimensions(titleGrid, ['marginTop', 'marginBottom']);
    const titleTotalHeight = titleGrid.offsetHeight + titleBoxModelDimensions;

    const buttonContainer = document.querySelector('.buttons-container');
    const buttonConatinerDimensions = UIManger.calculateBoxModelDimensions(buttonContainer, ['marginTop', 'marginBottom']);
    const buttonTotalHeight = buttonContainer.offsetHeight + buttonConatinerDimensions;
    //Adjust heights for each row
    const row1Elements = document.querySelectorAll('.row1');
    row1Elements.forEach(row1Element => {
        row1Element.style.height = `${row1Height}px`;
    });

    const row2Elements = document.querySelectorAll('.row2');
    
    row2Elements.forEach(row2Element => {
        row2Element.style.height = `${row2Height}px`;
    });

    //Adjust the drawing height of the first row
    const itemList = document.getElementById('itemList');
    const itemListPaddingBottom = UIManger.calculateBoxModelDimensions(itemList, ['paddingBottom']);
    const headerAndButtons = document.querySelector('.header-and-buttons');
    const headerAndButtonsRect = headerAndButtons.getBoundingClientRect();
    const headerAndButtonsBottomPosition = headerAndButtonsRect.bottom;
    const itemListRect = itemList.getBoundingClientRect();
    const itemListBottomPositionPosition = itemListRect.bottom;
    const calaculatedHeight = itemListBottomPositionPosition - (headerAndButtonsBottomPosition + itemListPaddingBottom);
    const usableRange = `${calaculatedHeight}px`

    //this.tableScroll.style.height = usableRange;
    //this.tableScroll.style.maxHeight = usableRange;
    tableScroll.style.height = usableRange;
    tableScroll.style.maxHeight = usableRange;

    const chartContainer = document.getElementById('chartContainer');
    const chartCalaculateHeight = row1Height - titleTotalHeight - itemListPaddingBottom;
    const chartUsableRange = `${chartCalaculateHeight}px`;
    chartContainer.style.height = chartUsableRange;
    chartContainer.style.maxHeight = chartUsableRange;
}