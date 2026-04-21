export class ScheduleEventLabelBuilder {
    static build(event) {
      const machineName = event.machineName ?? '';
      const workName = event.workName ?? event.title ?? '';
  
      if (machineName && workName) {
        return `${machineName}: ${workName}`;
      }
  
      if (machineName) {
        return machineName;
      }
  
      return workName;
    }
}