export function buildInspectionStandardMachineItems(items = []) {
  return [
    {
      value: '',
      label: '選択を解除',
      meta: {
        machine: '',
        controlNo: '',
      },
    },
    ...items.map((item) => ({
      value: item.controlNo,
      label: item.machine || item.controlNo,
      meta: {
        machine: item.machine,
        controlNo: item.controlNo,
      },
    })),
  ];
}


export function buildInspectionStandardFiltersFromItem(item = {}) {
  return {
    machine: String(item?.meta?.machine ?? '').trim(),
    controlNo: String(item?.meta?.controlNo ?? item?.value ?? '').trim(),
  };
}
