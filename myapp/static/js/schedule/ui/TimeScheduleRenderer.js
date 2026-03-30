import { TimeScheduleTemplate } from './TimeScheduleTemplate.js';

export class TimeScheduleRenderer {
  render(root, viewModel) {
    if (!root) {
      return;
    }

    root.innerHTML = TimeScheduleTemplate.create(viewModel);
  }
}