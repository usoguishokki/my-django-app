import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../application/edit/InspectionStandardEditSubmitService.js', import.meta.url),
  'utf8',
).replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '');

let lastConfirmation;
const prelude = `
  const ModalManger = {
    showConfirmModal: async (options) => {
      globalThis.__lastResyncConfirmation = options;
      return false;
    },
    closeModal() {},
  };
  const collectInspectionStandardCommonItemFormValues = () => ({ workName: 'Changed' });
  const hasInspectionStandardCommonItemChanges = () => true;
  const validateInspectionStandardCommonItemForm = () => ({ isValid: true });
  const buildInspectionStandardCommonItemChangeEntries = () => [{ key: 'workName' }];
  const buildInspectionStandardCommonItemUpdateValues = (value) => value;
  const applyInspectionStandardEditedCommonItemsToDetailVM = () => ({});
  const setInspectionStandardEditSaveButtonState = () => {};
  const executeInspectionStandardCommonItemsUpdate = async (payload) => {
    globalThis.__resyncUpdatePayload = payload;
    return { success: true, commonItems: {} };
  };
  const fetchInspectionStandardCardAbolishPreview = async () => ({
    abolishPreview: { distributedPlanCount: globalThis.__distributedPlanCount },
  });
  const executeInspectionStandardCardAbolish = async (payload) => {
    globalThis.__abolishPayload = payload;
    return { success: true, card: {} };
  };
`;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(prelude + source).toString('base64')}`;
const { InspectionStandardEditSubmitService } = await import(moduleUrl);

test('protected resync has a safe preserve choice and an explicit destructive choice', async () => {
  const service = new InspectionStandardEditSubmitService();
  assert.equal(await service._confirmProtectedPlanResync(), false);
  lastConfirmation = globalThis.__lastResyncConfirmation;
  assert.match(lastConfirmation.message, /計画を作り直しますか/);
  assert.match(lastConfirmation.message, /再作成されない場合/);
  assert.equal(lastConfirmation.cancelText, '変更前の計画を残す');
  assert.equal(lastConfirmation.confirmText, '削除して計画を作り直す');
  assert.equal(lastConfirmation.dismissValue, null);
});

test('abolition offers preserving distributed plans as the safe choice', async () => {
  const service = new InspectionStandardEditSubmitService();
  assert.equal(await service._confirmDistributedAbolition(), false);
  lastConfirmation = globalThis.__lastResyncConfirmation;
  assert.match(lastConfirmation.message, /実施中の計画があります/);
  assert.equal(lastConfirmation.cancelText, '計画を残して廃止する');
  assert.equal(lastConfirmation.confirmText, '計画も削除して廃止する');
  assert.equal(lastConfirmation.dismissValue, null);
});

test('common-item preview is requested regardless of the frontend schedule field list', () => {
  assert.match(source, /const planPreview = await this\._fetchCommonItemPlanPreview/);
  assert.doesNotMatch(source, /hasInspectionStandardPlanScheduleChangeEntries\(changeEntries\)/);
});

test('safe and destructive resync choices reach the API as distinct flags', async () => {
  for (const destructive of [false, true]) {
    const service = new InspectionStandardEditSubmitService({
      getActiveDetailVM: () => ({ commonItems: {} }),
      setActiveDetailVM() {},
    });
    service._collectValidChangeReasonOrShow = () => 'reason';
    service._fetchCommonItemPlanPreview = async () => ({ protectedPlanCount: 2 });
    service._confirmCommonItemChanges = async () => true;
    service._confirmProtectedPlanResync = async () => destructive;
    service._showSavingModal = () => {};
    service._showMessageModal = () => {};
    await service.saveCommonItems({ element: {
      closest: () => ({ dataset: { checkId: '17', inspectionNo: 'TEST-17' } }),
    } });
    assert.equal(globalThis.__resyncUpdatePayload.deleteProtectedPlans, destructive);
    assert.equal(globalThis.__resyncUpdatePayload.expectedProtectedPlanCount, 2);
  }
});

test('abolition safe choice preserves distributed plans in the API request', async () => {
  globalThis.__distributedPlanCount = 1;
  const service = new InspectionStandardEditSubmitService();
  service._collectValidChangeReasonOrShow = () => 'reason';
  service._confirmDistributedAbolition = async () => false;
  service._setSubmitButtonSaving = () => {};
  service._showMessageModal = () => {};
  service._buildAbolishCardSuccessMessage = () => '';
  await service.saveAbolishCard({ element: {
    closest: () => ({ dataset: { checkId: '17', inspectionNo: 'TEST-17' } }),
  } });
  assert.equal(globalThis.__abolishPayload.deleteDistributedPlans, false);
  assert.equal(globalThis.__abolishPayload.expectedDistributedPlanCount, 1);
});

test('abolition destructive choice is explicit and carries the reviewed count', async () => {
  globalThis.__distributedPlanCount = 2;
  const service = new InspectionStandardEditSubmitService();
  service._collectValidChangeReasonOrShow = () => 'reason';
  service._confirmDistributedAbolition = async () => true;
  service._setSubmitButtonSaving = () => {};
  service._showMessageModal = () => {};
  service._buildAbolishCardSuccessMessage = () => '';
  await service.saveAbolishCard({ element: {
    closest: () => ({ dataset: { checkId: '17', inspectionNo: 'TEST-17' } }),
  } });
  assert.equal(globalThis.__abolishPayload.deleteDistributedPlans, true);
  assert.equal(globalThis.__abolishPayload.expectedDistributedPlanCount, 2);
});

test('dismissing protected-plan choice stops the common-item write', async () => {
  globalThis.__resyncUpdatePayload = null;
  const service = new InspectionStandardEditSubmitService({
    getActiveDetailVM: () => ({ commonItems: {} }),
  });
  service._collectValidChangeReasonOrShow = () => 'reason';
  service._fetchCommonItemPlanPreview = async () => ({ protectedPlanCount: 1 });
  service._confirmCommonItemChanges = async () => true;
  service._confirmProtectedPlanResync = async () => null;
  await service.saveCommonItems({ element: {
    closest: () => ({ dataset: { checkId: '17', inspectionNo: 'TEST-17' } }),
  } });
  assert.equal(globalThis.__resyncUpdatePayload, null);
});
