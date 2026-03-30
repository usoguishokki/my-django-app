// static/js/ui/actions/UIActionDispatcher.js
export function bindUIActions(rootEl, handlers = {}) {
  if (!rootEl) return () => {};
  if (rootEl.__uiActionsBound) return () => {};
  rootEl.__uiActionsBound = true;

  const readPayload = (el) => {
    try {
      return JSON.parse(el.dataset.uiPayload || '{}');
    } catch {
      return {};
    }
  };

  const dispatch = ({ el, event, type, extra = {} }) => {
    if (!el || !rootEl.contains(el)) return;

    const action =
      type === 'submit'
        ? el.dataset.uiSubmitAction
        : el.dataset.uiAction;

    const handler = handlers[action];
    if (!handler) return;

    handler({
      element: el,
      payload: readPayload(el),
      event,
      type,
      ...extra,
    });
  };

  const onClick = (e) => {
    const el = e.target.closest('[data-ui-action]');
    if (!el) return;

    dispatch({
      el,
      event: e,
      type: 'click',
    });
  };

  const onToggle = (e) => {
    const el = e.target.closest('[data-ui-action]');
    if (!el) return;

    dispatch({
      el,
      event: e,
      type: 'toggle',
      extra: {
        checked: !!e.detail?.checked,
      },
    });
  };

  const onChange = (e) => {
    const el = e.target.closest('[data-ui-action]');
    if (!el) return;

    dispatch({
      el,
      event: e,
      type: 'change',
      extra: {
        value: el.value,
        checked: typeof el.checked === 'boolean' ? el.checked : undefined,
      },
    });
  };

  const onSubmit = (e) => {
    const el = e.target.closest('[data-ui-submit-action]');
    if (!el) return;

    dispatch({
      el,
      event: e,
      type: 'submit',
    });
  };

  const onDropdownChange = (e) => {
    const el = e.target.closest('[data-ui-action]');
    if (!el) return;

    dispatch({
      el,
      event: e,
      type: 'dropdown-change',
      extra: {
        value: e.detail?.value,
        label: e.detail?.label,
        item: e.detail?.item,
      },
    });
  };

  rootEl.addEventListener('click', onClick);
  rootEl.addEventListener('ui:toggle', onToggle);
  rootEl.addEventListener('change', onChange);
  rootEl.addEventListener('submit', onSubmit);
  rootEl.addEventListener('ui:dropdown-change', onDropdownChange);

  return () => {
    rootEl.__uiActionsBound = false;
    rootEl.removeEventListener('click', onClick);
    rootEl.removeEventListener('ui:toggle', onToggle);
    rootEl.removeEventListener('change', onChange);
    rootEl.removeEventListener('submit', onSubmit);
    rootEl.removeEventListener('ui:dropdown-change', onDropdownChange);
  };
}