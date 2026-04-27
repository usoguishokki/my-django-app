export class ScheduleMemberService {
    constructor() {
      this.members = [];
    }
  
    setMembers(members = []) {
      this.members = Array.isArray(members) ? members : [];
    }
  
    getMembers() {
      return this.members;
    }
  
    findById(memberId) {
      return this.members.find(
        (member) => String(member.id) === String(memberId)
      ) ?? null;
    }
  
    getNameById(memberId) {
      return this.findById(memberId)?.name ?? '';
    }
}