// static/js/inspectionStandards/ui/InspectionStandardHistoryDetailRenderer.js

import { UIManger } from '../../manager/UIManger.js';

import {
  formatJapaneseWeekdayLabel,
  normalizeDateInputValue,
} from '../../utils/dateTime.js';

import {
  formatInspectionStandardDayOfWeekLabel,
} from '../domain/InspectionStandardDayOfWeekPolicy.js';

import {
  INSPECTION_STANDARD_DRAWER_ACTIONS,
} from '../domain/InspectionStandardActions.js';

import {
  renderCheckboxHTML,
} from '../../ui/componets/checkbox/index.js';

export function renderInspectionStandardHistoryDetailHTML({
  history = {},
  currentUserJobTitle = '',
} = {}) {
  const vm = buildInspectionStandardHistoryDetailVM({
    history,
    currentUserJobTitle,
  });

  return `
    <div class="inspection-standard-history-detail">
      ${renderSummaryHTML(vm)}
      ${renderTargetsHTML(vm.targets)}
      ${renderApprovalHTML(vm)}
    </div>
  `;
}

function buildInspectionStandardHistoryDetailVM({
  history = {},
  currentUserJobTitle = '',
} = {}) {
  const teamLeaderApproval = buildApprovalVM(
    history.teamLeaderApproval ?? history.team_leader_approval,
    history.teamLeaderApprovedByName,
    history.team_leader_approved_by_name
  );

  const leaderApproval = buildApprovalVM(
    history.leaderApproval ?? history.leader_approval,
    history.leaderApprovedByName,
    history.leader_approved_by_name
  );

  const foremanApproval = buildApprovalVM(
    history.foremanApproval ?? history.foreman_approval,
    history.foremanApprovedByName,
    history.foreman_approved_by_name
  );

  return {
    id: pickText(history.id, history.historyId, history.history_id),
    eventId: pickText(history.eventId, history.event_id),
    currentUserJobTitle: pickText(currentUserJobTitle),

    sourceLabel: pickText(
      history.sourceLabel,
      history.source_label,
      history.operationLabel,
      history.operation_label
    ),
    summary: pickText(
      history.summary,
      history.note,
      history.description,
      history.message
    ),
    inspectionNo: pickText(
      history.inspectionNo,
      history.inspection_no,
      history.inspectionNoSnapshot,
      history.inspection_no_snapshot
    ),
    controlNo: pickText(
      history.controlNo,
      history.control_no,
      history.controlNoSnapshot,
      history.control_no_snapshot
    ),
    machine: pickText(
      history.machine,
      history.machineSnapshot,
      history.machine_snapshot
    ),
    operatedByName: pickText(
      history.operatedByName,
      history.operated_by_name,
      history.operatedBy,
      history.operated_by
    ),
    operatedAtText: pickText(
      history.operatedAtText,
      history.operated_at_text,
      history.operatedAt,
      history.operated_at
    ),
    teamLeaderApproval,
    leaderApproval,
    foremanApproval,

    targets: Array.isArray(history.targets)
      ? history.targets.map((target) => buildTargetVM(target))
      : [],
  };
}

function buildApprovalVM(approval = {}, ...fallbackNames) {
  const approvedByName = pickText(
    approval?.approvedByName,
    approval?.approved_by_name,
    ...fallbackNames
  );

  const approved = Boolean(
    approval?.approved ||
    approval?.approved_at ||
    approval?.approvedAt ||
    approvedByName
  );

  return {
    approved,
    approvedByName,
    displayName: approved
      ? approvedByName || '承認済み'
      : '未承認',
  };
}

function buildTargetVM(target = {}) {
  return {
    id: pickText(target.id),
    targetTypeLabel: pickText(
      target.targetTypeLabel,
      target.target_type_label,
      target.targetType,
      target.target_type
    ),
    operation: pickText(
      target.operation,
      target.operation_value
    ),
    operationLabel: pickText(
      target.operationLabel,
      target.operation_label,
      target.operation
    ),
    labelSnapshot: pickText(
      target.labelSnapshot,
      target.label_snapshot,
      target.targetPkSnapshot,
      target.target_pk_snapshot
    ),
    beforeSnapshot: normalizeSnapshot(
      target.beforeSnapshot ?? target.before_snapshot
    ),
    afterSnapshot: normalizeSnapshot(
      target.afterSnapshot ?? target.after_snapshot
    ),
    fieldChanges: Array.isArray(target.fieldChanges)
    ? target.fieldChanges
        .map((change) => buildFieldChangeVM(change))
        .filter((change) => shouldDisplayFieldChange(change))
    : [],
  };
}

function buildFieldChangeVM(change = {}) {
  const fieldName = pickText(
    change.fieldName,
    change.field_name
  );

  const fieldLabel = pickText(
    change.fieldLabel,
    change.field_label,
    fieldName
  );

  const beforeDisplay = pickText(
    change.beforeDisplay,
    change.before_display,
    change.beforeValue,
    change.before_value
  );

  const afterDisplay = pickText(
    change.afterDisplay,
    change.after_display,
    change.afterValue,
    change.after_value
  );

  return {
    id: pickText(change.id),
    fieldName,
    fieldLabel,
    beforeDisplay: formatFieldChangeDisplayValue({
      fieldName,
      fieldLabel,
      value: beforeDisplay,
    }),
    afterDisplay: formatFieldChangeDisplayValue({
      fieldName,
      fieldLabel,
      value: afterDisplay,
    }),
  };
}

const HIDDEN_FIELD_CHANGE_NAMES = new Set([
  'practitionerPatternId',
  'practitioner_pattern_id',
]);

const HIDDEN_FIELD_CHANGE_LABELS = new Set([
  '実施直ID',
  '実施直Id',
  '実施直id',
]);

function shouldDisplayFieldChange(change = {}) {
  const fieldName = String(change.fieldName ?? '').trim();
  const fieldLabel = String(change.fieldLabel ?? '').trim();

  if (HIDDEN_FIELD_CHANGE_NAMES.has(fieldName)) {
    return false;
  }

  if (HIDDEN_FIELD_CHANGE_LABELS.has(fieldLabel)) {
    return false;
  }

  return true;
}

function formatFieldChangeDisplayValue({
  fieldName = '',
  fieldLabel = '',
  value = '',
} = {}) {
  if (isDayOfWeekFieldChange({ fieldName, fieldLabel })) {
    return formatInspectionStandardDayOfWeekLabel(value);
  }

  return String(value ?? '').trim();
}

function isDayOfWeekFieldChange({
  fieldName = '',
  fieldLabel = '',
} = {}) {
  return [
    'dayOfWeek',
    'day_of_week',
  ].includes(String(fieldName ?? '').trim()) ||
    String(fieldLabel ?? '').trim() === '曜日';
}

function renderSummaryHTML(vm) {
  return `
    <section class="inspection-standard-history-detail__summary">
      <dl class="inspection-standard-history-detail__metaGrid inspection-standard-history-detail__metaGrid--compact">
        ${renderMetaRowHTML('日時', vm.operatedAtText)}
        ${renderMetaRowHTML('実施者', vm.operatedByName)}
      </dl>

      <div class="inspection-standard-history-detail__reason">
        <div class="inspection-standard-history-detail__reasonLabel">
          変更理由
        </div>
        <div class="inspection-standard-history-detail__reasonText">
          ${escapeHtml(vm.summary || '-')}
        </div>
      </div>
    </section>
  `;
}

function renderTargetsHTML(targets = []) {
  if (!targets.length) {
    return `
      <div class="drawer__placeholder">
        変更対象の詳細がありません。
      </div>
    `;
  }

  const sectionTitle = targets.every((target) => isDeletedOrAbolishedTarget(target))
    ? '削除された内容'
    : '変更内容';

  return `
    <section class="inspection-standard-history-detail__targets">
      <h3 class="inspection-standard-history-detail__sectionTitle">
        ${escapeHtml(sectionTitle)}
      </h3>

      <div class="inspection-standard-history-detail__targetList">
        ${targets.map((target) => renderTargetHTML(target)).join('')}
      </div>
    </section>
  `;
}

function renderApprovalHTML(vm) {
  const teamLeaderButton = buildApprovalButtonVM({
    vm,
    approvalRole: 'team_leader',
    label: '班長承認する',
    requiredJobTitle: '班長',
  });
  
  const leaderButton = buildApprovalButtonVM({
    vm,
    approvalRole: 'leader',
    label: '組長承認する',
    requiredJobTitle: '組長',
  });

  const foremanButton = buildApprovalButtonVM({
    vm,
    approvalRole: 'foreman',
    label: '工長承認する',
    requiredJobTitle: '工長',
  });

  const hasApproverRole = ['班長', '組長', '工長'].includes(vm.currentUserJobTitle);

  return `
    <section
      class="inspection-standard-history-detail__approval"
      data-role="inspection-standard-history-approval"
    >
      <h3 class="inspection-standard-history-detail__sectionTitle">
        承認確認
      </h3>

      <div class="inspection-standard-history-detail__approvalStatusGrid">
        ${renderApprovalStatusHTML({
          label: '班長承認',
          approval: vm.teamLeaderApproval,
        })}
        ${renderApprovalStatusHTML({
          label: '組長承認',
          approval: vm.leaderApproval,
        })}
        ${renderApprovalStatusHTML({
          label: '工長承認',
          approval: vm.foremanApproval,
        })}
      </div>

      ${renderCheckboxHTML({
        label: '変更内容を最後まで確認しました。',
        action: INSPECTION_STANDARD_DRAWER_ACTIONS.CHANGE_HISTORY_APPROVAL_CONFIRM,
        role: 'inspection-standard-history-approval-confirm',
        disabled: !hasApproverRole,
        className: 'inspection-standard-history-detail__approvalConfirm',
        inputClassName: 'inspection-standard-history-detail__approvalConfirmInput',
        labelClassName: 'inspection-standard-history-detail__approvalConfirmLabel',
      })}

      <div
        class="inspection-standard-history-detail__approvalActions"
        data-role="inspection-standard-history-approval-actions"
      >
        ${renderApprovalButtonHTML({
          vm,
          button: teamLeaderButton,
        })}
        ${renderApprovalButtonHTML({
          vm,
          button: leaderButton,
        })}
        ${renderApprovalButtonHTML({
          vm,
          button: foremanButton,
        })}
      </div>

      <p
        class="inspection-standard-history-detail__approvalMessage"
        data-role="inspection-standard-history-approval-message"
      >
        ${escapeHtml(buildApprovalGuideMessage({
          vm,
          hasApproverRole,
        }))}
      </p>
    </section>
  `;
}

function renderApprovalStatusHTML({
  label,
  approval,
} = {}) {
  return `
    <div class="inspection-standard-history-detail__approvalStatus">
      <div class="inspection-standard-history-detail__approvalStatusLabel">
        ${escapeHtml(label)}
      </div>
      <div class="inspection-standard-history-detail__approvalStatusValue${approval.approved ? ' is-approved' : ''}">
        ${escapeHtml(approval.displayName)}
      </div>
    </div>
  `;
}

function buildApprovalButtonVM({
  vm,
  approvalRole,
  label,
  requiredJobTitle,
} = {}) {
  const approvalByRole = {
    team_leader: vm.teamLeaderApproval,
    leader: vm.leaderApproval,
    foreman: vm.foremanApproval,
  };

  const targetApproval = approvalByRole[approvalRole] ?? buildApprovalVM();

  const userHasRole = vm.currentUserJobTitle === requiredJobTitle;
  const alreadyApproved = targetApproval.approved;

  const blockedByTeamLeader =
    approvalRole === 'leader' && !vm.teamLeaderApproval?.approved;

  const blockedByLeader =
    approvalRole === 'foreman' && !vm.leaderApproval?.approved;

  const approvalEnabled = Boolean(
    vm.id &&
    userHasRole &&
    !alreadyApproved &&
    !blockedByTeamLeader &&
    !blockedByLeader
  );

  return {
    approvalRole,
    label,
    requiredJobTitle,
    approvalEnabled,
    disabledReason: buildApprovalDisabledReason({
      label,
      requiredJobTitle,
      userHasRole,
      alreadyApproved,
      blockedByTeamLeader,
      blockedByLeader,
    }),
  };
}

function buildApprovalDisabledReason({
  label,
  requiredJobTitle,
  userHasRole,
  alreadyApproved,
  blockedByTeamLeader,
  blockedByLeader,
} = {}) {
  if (alreadyApproved) {
    return '承認済みです。';
  }

  if (blockedByTeamLeader) {
    return '班長承認が完了していないため、組長承認はできません。';
  }

  if (blockedByLeader) {
    return '組長承認が完了していないため、工長承認はできません。';
  }

  if (!userHasRole) {
    return `${label}は${requiredJobTitle}のみ実行できます。`;
  }

  return '';
}

function renderApprovalButtonHTML({
  vm,
  button,
} = {}) {
  const payload = {
    historyId: vm.id,
    approvalRole: button.approvalRole,
  };

  return `
    <button
      type="button"
      class="inspection-standard-history-detail__approvalButton"
      data-role="inspection-standard-history-approval-button"
      data-approval-enabled="${button.approvalEnabled ? 'true' : 'false'}"
      data-approval-role="${escapeHtml(button.approvalRole)}"
      data-ui-action="${escapeHtml(INSPECTION_STANDARD_DRAWER_ACTIONS.APPROVE_HISTORY)}"
      data-ui-payload="${escapeHtml(JSON.stringify(payload))}"
      ${button.approvalEnabled ? 'disabled' : 'disabled aria-disabled="true"'}
      title="${escapeHtml(button.disabledReason)}"
    >
      ${escapeHtml(button.label)}
    </button>
  `;
}

function buildApprovalGuideMessage({
  vm,
  hasApproverRole,
} = {}) {
  if (!hasApproverRole) {
    return '承認権限がありません。班長・組長・工長のみ承認できます。';
  }
  
  if (
    vm.teamLeaderApproval.approved &&
    vm.leaderApproval.approved &&
    vm.foremanApproval.approved
  ) {
    return '班長承認・組長承認・工長承認は完了しています。';
  }
  
  if (vm.currentUserJobTitle === '組長' && !vm.teamLeaderApproval.approved) {
    return '組長承認は、班長承認が完了してから実行できます。';
  }
  
  if (vm.currentUserJobTitle === '工長' && !vm.leaderApproval.approved) {
    return '工長承認は、組長承認が完了してから実行できます。';
  }

  return 'チェックを入れると、承認ボタンを押せるようになります。';
}

function renderTargetHTML(target) {
  return `
    <article class="inspection-standard-history-detail__target">
      ${renderTargetBadgesHTML(target)}

      ${renderFieldChangesHTML(target)}
    </article>
  `;
}

function renderTargetBadgesHTML(target = {}) {
  const badgesHTML = [
    renderBadgeHTML(target.targetTypeLabel),
    renderBadgeHTML(target.operationLabel),
  ].join('');

  if (!badgesHTML.trim()) return '';

  return `
    <div class="inspection-standard-history-detail__targetBadges inspection-standard-history-detail__targetBadges--top">
      ${badgesHTML}
    </div>
  `;
}

function renderFieldChangesHTML(target = {}) {
  if (isDeletedOrAbolishedTarget(target)) {
    const deletedSnapshotRows = buildSnapshotRows(target.beforeSnapshot);

    if (deletedSnapshotRows.length) {
      return `
        <div class="inspection-standard-history-detail__snapshotList inspection-standard-history-detail__snapshotList--deleted">
          ${deletedSnapshotRows.map((row) => renderSnapshotRowHTML(row)).join('')}
        </div>
      `;
    }
  }

  const fieldChanges = Array.isArray(target.fieldChanges)
    ? target.fieldChanges
    : [];

  if (fieldChanges.length) {
    return `
      <div class="inspection-standard-history-detail__changeList">
        ${fieldChanges.map((change) => renderFieldChangeHTML({
          change,
          target,
        })).join('')}
      </div>
    `;
  }

  const snapshotRows = buildSnapshotRows(target.afterSnapshot);

  if (snapshotRows.length) {
    return `
      <div class="inspection-standard-history-detail__snapshotList">
        ${snapshotRows.map((row) => renderSnapshotRowHTML(row)).join('')}
      </div>
    `;
  }

  return `
    <div class="inspection-standard-history-detail__emptyChange">
      変更項目の詳細がありません。
    </div>
  `;
}

function isDeletedOrAbolishedTarget(target = {}) {
  const operation = String(target.operation ?? '').trim().toLowerCase();
  const operationLabel = String(target.operationLabel ?? '').trim();

  return [
    operation.includes('delete'),
    operation.includes('deleted'),
    operation.includes('abolish'),
    operation.includes('abolished'),
    operation.includes('remove'),
    operationLabel.includes('削除'),
    operationLabel.includes('廃止'),
  ].some(Boolean);
}

function renderFieldChangeHTML({
  change = {},
  target = {},
} = {}) {
  const afterToneClass = getHistoryValueAfterToneClass(target);

  return `
    <div class="inspection-standard-history-detail__change">
      <div class="inspection-standard-history-detail__changeLabel">
        ${escapeHtml(change.fieldLabel || '-')}
      </div>

      <div class="inspection-standard-history-detail__changeValues">
        <div class="inspection-standard-history-detail__valueBlock">
          <div class="inspection-standard-history-detail__valueCaption">
            変更前
          </div>
          <div class="inspection-standard-history-detail__value inspection-standard-history-detail__value--before">
            ${escapeHtml(change.beforeDisplay || '-')}
          </div>
        </div>

        <div class="inspection-standard-history-detail__arrow" aria-hidden="true">
          →
        </div>

        <div class="inspection-standard-history-detail__valueBlock">
          <div class="inspection-standard-history-detail__valueCaption">
            変更後
          </div>
          <div class="inspection-standard-history-detail__value inspection-standard-history-detail__value--after ${afterToneClass}">
            ${escapeHtml(change.afterDisplay || '-')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMetaRowHTML(label, value) {
  return `
    <div class="inspection-standard-history-detail__metaRow">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value || '-')}</dd>
    </div>
  `;
}

function renderBadgeHTML(value = '') {
  const label = pickText(value);

  if (!label) {
    return '';
  }

  const toneClass = getHistoryBadgeToneClass(label);

  return `
    <span class="inspection-standard-history-detail__badge ${toneClass}">
      ${escapeHtml(label)}
    </span>
  `;
}

const SNAPSHOT_FIELD_DEFINITIONS = Object.freeze([
  {
    label: '設備名',
    keys: ['machine', 'machineSnapshot', 'machine_snapshot'],
  },
  {
    label: '作業名',
    keys: ['workName', 'work_name', 'warkName', 'wark_name'],
  },
  {
    label: '周期',
    keys: ['ruleName', 'rule_name'],
  },
  {
    label: '基準年',
    keys: ['anchorYear', 'anchor_year'],
  },
  {
    label: '基準月',
    keys: ['anchorMonth', 'anchor_month'],
  },
  {
    label: '基準週',
    keys: ['weekOfMonth', 'week_of_month'],
  },
  {
    label: '曜日',
    keys: ['dayOfWeek', 'day_of_week'],
    formatter: formatInspectionStandardDayOfWeekLabel,
  },
  {
    label: '計画日',
    keys: ['p_date', 'pDate', 'planDate', 'plan_date'],
    formatter: formatPlanDateWithWeekdayLabel,
  },
  {
    label: '実施直',
    keys: [
      'practitionerPatternName',
      'practitioner_pattern_name',
    ],
  },
  {
    label: '時間帯',
    keys: ['timeZone', 'time_zone'],
  },
  {
    label: '必要人数',
    keys: ['requiredPersonCount', 'required_person_count'],
  },
  {
    label: '工数',
    keys: [
      'inspectionManHours',
      'inspection_man_hours',
      'manHours',
      'man_hours',
    ],
  },
  {
    label: 'ステータス',
    keys: ['status'],
  },
  {
    label: '安全ポイント',
    keys: ['safePoint', 'safe_point'],
  },
  {
    label: '該当装置',
    keys: ['applicableDevice', 'applicable_device'],
  },
  {
    label: '方法',
    keys: ['method'],
  },
  {
    label: '点検方法',
    keys: ['contents'],
  },
  {
    label: '基準処置',
    keys: ['standard'],
  },
  {
    label: '備考',
    keys: ['remarks'],
  },
]);

const SNAPSHOT_EXCLUDED_KEYS = new Set([
  'id',
  'inspectionNo',
  'inspection_no',
  'ruleId',
  'rule_id',
  'controlNo',
  'control_no',
  'practitionerPatternId',
  'practitioner_pattern_id',
]);

function normalizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return {};
  }

  return snapshot;
}

function buildSnapshotRows(snapshot = {}) {
  const usedKeys = new Set();

  const definedRows = SNAPSHOT_FIELD_DEFINITIONS
    .map((definition) => {
      const matchedKey = definition.keys.find((key) => {
        if (SNAPSHOT_EXCLUDED_KEYS.has(key)) return false;

        if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {
          return false;
        }

        return Boolean(formatSnapshotValue(snapshot[key], definition));
      });

      if (!matchedKey) return null;

      usedKeys.add(matchedKey);

      return {
        key: matchedKey,
        label: definition.label,
        value: formatSnapshotValue(snapshot[matchedKey], definition),
      };
    })
    .filter(Boolean);

  const extraRows = Object
    .keys(snapshot)
    .filter((key) => !usedKeys.has(key))
    .filter((key) => !SNAPSHOT_EXCLUDED_KEYS.has(key))
    .map((key) => ({
      key,
      label: key,
      value: formatSnapshotValue(snapshot[key]),
    }))
    .filter((row) => row.value);

  return [
    ...definedRows,
    ...extraRows,
  ];
}

function formatPlanDateWithWeekdayLabel(value) {
  const dateValue = normalizeDateInputValue(value);

  if (!dateValue) {
    return String(value ?? '').trim();
  }

  const weekday = formatJapaneseWeekdayLabel(dateValue);

  return weekday
    ? `${dateValue}(${weekday})`
    : dateValue;
}

function formatSnapshotValue(value, definition = {}) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof definition.formatter === 'function') {
    return String(definition.formatter(value) ?? '').trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => formatSnapshotValue(item))
      .filter(Boolean)
      .join('、');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value).trim();
}

function renderSnapshotRowHTML(row) {
  return `
    <div class="inspection-standard-history-detail__snapshotRow">
      <div class="inspection-standard-history-detail__snapshotLabel">
        ${escapeHtml(row.label)}
      </div>

      <div class="inspection-standard-history-detail__snapshotValue">
        ${escapeHtml(row.value || '-')}
      </div>
    </div>
  `;
}


function pickText(...values) {
  const foundValue = values.find((value) => {
    const text = String(value ?? '').trim();
    return text;
  });

  return String(foundValue ?? '').trim();
}

function escapeHtml(value) {
  return UIManger.escapeHtml(String(value ?? ''));
}

function getHistoryBadgeToneClass(value = '') {
  const text = String(value ?? '').trim();

  if (!text) {
    return '';
  }

  if (text.includes('削除') || text.includes('廃止')) {
    return 'inspection-standard-history-detail__badge--delete';
  }

  if (text.includes('追加')) {
    return 'inspection-standard-history-detail__badge--add';
  }

  if (text.includes('変更') || text.includes('更新')) {
    return 'inspection-standard-history-detail__badge--change';
  }

  return '';
}

function getHistoryValueAfterToneClass(target = {}) {
  const text = [
    target.operationLabel,
    target.operation,
    target.targetTypeLabel,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    text.includes('削除') ||
    text.includes('廃止') ||
    text.includes('delete') ||
    text.includes('deleted') ||
    text.includes('abolish') ||
    text.includes('abolished') ||
    text.includes('remove')
  ) {
    return 'inspection-standard-history-detail__value--after-delete';
  }

  if (
    text.includes('追加') ||
    text.includes('add') ||
    text.includes('added') ||
    text.includes('create') ||
    text.includes('created')
  ) {
    return 'inspection-standard-history-detail__value--after-add';
  }

  if (
    text.includes('変更') ||
    text.includes('更新') ||
    text.includes('update') ||
    text.includes('updated') ||
    text.includes('change') ||
    text.includes('changed')
  ) {
    return 'inspection-standard-history-detail__value--after-change';
  }

  return '';
}