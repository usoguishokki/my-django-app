// static/js/ui/renderers/pullbackDrawerTopRenderer.js
import { renderDrawerTableTop } from './drawerTableTopRenderer.js';

export function renderPullbackDrawerTop() {
  return renderDrawerTableTop({
    fields: [],
    buttons: [
      { action: 'bulkPullback', label: '確定', payload: {} },
    ],
  });
}