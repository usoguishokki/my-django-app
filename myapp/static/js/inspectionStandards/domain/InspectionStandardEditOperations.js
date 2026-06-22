// static/js/inspectionStandards/domain/InspectionStandardEditOperations.js

export const INSPECTION_STANDARD_EDIT_OPERATIONS = Object.freeze({
  ADD_ITEM: 'add-item',
  CHANGE_ITEM: 'change-item',
  CHANGE_COMMON_ITEMS: 'change-common-items',
  DELETE_ITEM: 'delete-item',
  DELETE: 'delete',
});
  
export const INSPECTION_STANDARD_EDIT_OPERATION_ITEMS = Object.freeze([
  {
    operation: INSPECTION_STANDARD_EDIT_OPERATIONS.CHANGE_COMMON_ITEMS,
    label: '共通項目変更(作業名、周期(年、月、週、曜日)、人数、直、ステータス、時間帯、工数、安全ポイント)',
  },
  {
    operation: INSPECTION_STANDARD_EDIT_OPERATIONS.ADD_ITEM,
    label: '項目追加(該当装置、内容、方法、基準、工数)',
  },
  {
    operation: INSPECTION_STANDARD_EDIT_OPERATIONS.CHANGE_ITEM,
    label: '項目変更(該当装置、内容、方法、基準、工数)',
  },
  {
    operation: INSPECTION_STANDARD_EDIT_OPERATIONS.DELETE_ITEM,
    label: '項目削除',
  },
  {
    operation: INSPECTION_STANDARD_EDIT_OPERATIONS.DELETE,
    label: '削除',
  },
]);