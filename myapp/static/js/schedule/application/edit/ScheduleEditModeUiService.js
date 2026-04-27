import {
    setActivePressedState,
    setClassState,
  } from '../../../ui/componets/helpers/domState.js';
  
export class ScheduleEditModeUiService {
  constructor({ elements }) {
    this.elements = elements;
  }

  syncButton({ isMoveMode }) {
    const button = this.elements?.editModeButton;

    if (!button) {
      return;
    }

    setActivePressedState(button, isMoveMode);

    button.setAttribute(
      'aria-label',
      isMoveMode ? '編集モードを終了する' : '編集モードを開く'
    );

    button.setAttribute(
      'title',
      isMoveMode ? '編集モード中' : '編集モード'
    );
  }

  syncView({ isMoveMode }) {
    setClassState(
      this.elements?.scheduleContainer,
      'is-move-mode',
      isMoveMode
    );
  }

  sync({ isMoveMode }) {
    this.syncButton({ isMoveMode });
    this.syncView({ isMoveMode });
  }
}