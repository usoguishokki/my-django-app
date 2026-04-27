import { UIManger } from '../../manager/UIManger.js';

export class ScheduleTestCardDateAliasStatusTemplate {
  static create({ activeDateAlias = 'all' } = {}) {
    const displayText =
      activeDateAlias && activeDateAlias !== 'all'
        ? activeDateAlias
        : '未設定';

    return `
      <div class="schedule-page__filterField schedule-page__filterField--dateAliasStatus">
        <span class="schedule-page__filterLabel">
          対象週
        </span>

        <div class="schedule-page__filterStaticValue">
          ${UIManger.escapeHtml(displayText)}
        </div>
      </div>
    `;
  }
}