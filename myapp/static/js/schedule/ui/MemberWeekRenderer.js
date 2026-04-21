import { MemberWeekTemplate } from './MemberWeekTemplate.js';

export class MemberWeekRenderer {
  render(root, viewModel) {
    if (!root) {
      return;
    }

    root.innerHTML = MemberWeekTemplate.create(viewModel);
  }
}