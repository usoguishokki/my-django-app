from datetime import timedelta
from .models import Plan_tb, PlanApproval, WeeklyDuty
import itertools

class WorkScheduleEntry:
    def __init__(self, target_inf, member_instance, team_profile, fallback_leader_handler=None):
        self.target_inf = target_inf
        self.member_instance = member_instance
        self.base_time_frame = None
        self.busy_key_list = None
        self.plan_time_frame = {}
        self.update_plan_dict = None
        self.work_data = None
        self.team_profile = team_profile
        self.fallback_leader_handler = fallback_leader_handler
    
    def set_time_frames(self):
        if self.target_inf.shift_pattern_name == '1直':
            self.base_time_frame = {
                'time_frame_1': {
                    'timeZone': '稼働中',
                    'start': self.target_inf.shift_start_time,
                    'end': self.target_inf.hot_time_start_a,
                    'maxTime': [(self.target_inf.hot_time_start_a - self.target_inf.shift_start_time).total_seconds() / 60],
                }, 
                'time_frame_2': {
                    'timeZone': '停止中', 
                    'start': self.target_inf.hot_time_start_a, 
                    'end': self.target_inf.hot_time_end_a,
                    'maxTime': [(self.target_inf.hot_time_end_a - self.target_inf.hot_time_start_a).total_seconds() / 60],
                },
                'time_frame_3': {
                    'timeZone': '稼働中', 
                    'start': self.target_inf.hot_time_end_a, 
                    'end': self.target_inf.field_worker_lunch_time_start,
                    'maxTime': [(self.target_inf.field_worker_lunch_time_start - self.target_inf.hot_time_end_a).total_seconds() / 60],
                },
                'time_frame_4': {
                    'timeZone': '停止中', 
                    'start': self.target_inf.field_worker_lunch_time_start, 
                    'end': self.target_inf.field_worker_lunch_time_end,
                    'maxTime': [(self.target_inf.field_worker_lunch_time_end - self.target_inf.field_worker_lunch_time_start).total_seconds() / 60],
                },
                'time_frame_5': {
                    'timeZone': '稼働中', 
                    'start': self.target_inf.field_worker_lunch_time_end, 
                    'end': self.target_inf.hot_time_start_b,
                    'maxTime': [(self.target_inf.hot_time_start_b - self.target_inf.field_worker_lunch_time_end).total_seconds() / 60],
                },
                'time_frame_6': {
                    'timeZone': '停止中', 
                    'start': self.target_inf.hot_time_start_b, 
                    'end': self.target_inf.hot_time_end_b,
                    'maxTime': [(self.target_inf.hot_time_end_b - self.target_inf.hot_time_start_b).total_seconds() / 60],
                },
                'time_frame_7': {
                    'timeZone': '稼働中', 
                    'start': self.target_inf.hot_time_end_b, 
                    'end': self.target_inf.shift_end_time,
                    'maxTime': [(self.target_inf.shift_end_time - self.target_inf.hot_time_end_b).total_seconds() / 60],
                }
            }
        elif self.target_inf.shift_pattern_name == '2直':
            self.base_time_frame = {
                'time_frame_1': {
                    'timeZone': '稼働中', 
                    'start': self.target_inf.shift_start_time, 
                    'end': self.target_inf.shift_change_time_start,
                    'maxTime': [(self.target_inf.shift_change_time_start - self.target_inf.shift_start_time).total_seconds() / 60],
                },
                'time_frame_2': {
                    'timeZone': '停止中', 
                    'start': self.target_inf.shift_change_time_start, 
                    'end': self.target_inf.shift_change_time_end,
                    'maxTime': [(self.target_inf.shift_change_time_end - self.target_inf.shift_change_time_start).total_seconds() / 60],
                },
                'time_frame_3': {
                    'timeZone': '稼働中', 
                    'start': self.target_inf.shift_change_time_end, 
                    'end': self.target_inf.hot_time_start_a,
                    'maxTime': [(self.target_inf.hot_time_start_a - self.target_inf.shift_change_time_end).total_seconds() / 60],
                },
                'time_frame_4': {
                    'timeZone': '停止中', 
                    'start': self.target_inf.hot_time_start_a, 
                    'end': self.target_inf.hot_time_end_a,
                    'maxTime': [(self.target_inf.hot_time_end_a - self.target_inf.hot_time_start_a).total_seconds() / 60],
                },
                'time_frame_5': {
                    'timeZone': '稼働中', 
                    'start': self.target_inf.hot_time_end_a, 
                    'end': self.target_inf.field_worker_lunch_time_start,
                    'maxTime': [(self.target_inf.field_worker_lunch_time_start -self.target_inf.hot_time_end_a).total_seconds() / 60],
                },
                'time_frame_6': {
                    'timeZone': '停止中', 
                    'start': self.target_inf.field_worker_lunch_time_start, 
                    'end': self.target_inf.field_worker_lunch_time_end,
                    'maxTime': [(self.target_inf.field_worker_lunch_time_end - self.target_inf.field_worker_lunch_time_start).total_seconds() / 60],
                },
                'time_frame_7': {
                    'timeZone': '稼働中', 
                    'start': self.target_inf.field_worker_lunch_time_end, 
                    'end': self.target_inf.shift_end_time,
                    'maxTime': [(self.target_inf.shift_end_time - self.target_inf.field_worker_lunch_time_end).total_seconds() / 60],
                }
            }
        elif self.target_inf.shift_pattern_name == '3直':
            self.base_time_frame = {
                'time_frame_1': {
                    'timeZone':'稼働中', 
                    'start': self.target_inf.shift_start_time, 
                    'end': self.target_inf.hot_time_start_a,
                    'maxTime': [(self.target_inf.hot_time_start_a - self.target_inf.shift_start_time).total_seconds() / 60],
                },
                'time_frame_2': {
                    'timeZone':'停止中', 
                    'start': self.target_inf.hot_time_start_a, 
                    'end': self.target_inf.hot_time_end_a,
                    'maxTime': [(self.target_inf.hot_time_end_a - self.target_inf.hot_time_start_a).total_seconds() / 60],
                },
                'time_frame_3': {
                    'timeZone':'稼働中', 
                    'start': self.target_inf.hot_time_end_a, 
                    'end': self.target_inf.shift_change_time_start,
                    'maxTime': [(self.target_inf.shift_change_time_start - self.target_inf.hot_time_end_a).total_seconds() / 60],
                },
                'time_frame_4': {
                    'timeZone':'停止中', 
                    'start': self.target_inf.shift_change_time_start, 
                    'end': self.target_inf.shift_change_time_end,
                    'maxTime': [(self.target_inf.shift_change_time_end - self.target_inf.shift_change_time_start).total_seconds() / 60],
                },
                'time_frame_5': {
                    'timeZone':'稼働中', 
                    'start': self.target_inf.shift_change_time_end, 
                    'end': self.target_inf.shift_end_time,
                    'maxTime': [(self.target_inf.shift_end_time - self.target_inf.shift_change_time_end).total_seconds() / 60],
                }
            }
        elif self.target_inf.shift_pattern_name == '常昼':
            self.base_time_frame = {
                'time_frame_1': {
                    'timeZone': '稼働中',
                    'start': self.target_inf.shift_start_time,
                    'end': self.target_inf.hot_time_start_a,
                    'maxTime': [(self.target_inf.hot_time_start_a - self.target_inf.shift_start_time).total_seconds() / 60]
                },
                'time_frame_2': {
                    'timeZone': '停止中',
                    'start': self.target_inf.hot_time_start_a,
                    'end': self.target_inf.hot_time_end_a,
                    'maxTime':[(self.target_inf.hot_time_end_a - self.target_inf.hot_time_start_a).total_seconds() / 60]
                },
                'time_frame_3': {
                    'timeZone': '稼働中',
                    'start': self.target_inf.hot_time_end_a,
                    'end': self.target_inf.field_worker_lunch_time_start,
                    'maxTime':[(self.target_inf.field_worker_lunch_time_start - self.target_inf.hot_time_end_a).total_seconds() / 60]
                },
                'time_frame_4': {
                    'timeZone': '停止中',
                    'start': self.target_inf.field_worker_lunch_time_start,
                    'end': self.target_inf.field_worker_lunch_time_end,
                    'maxTime': [(self.target_inf.field_worker_lunch_time_end - self.target_inf.field_worker_lunch_time_start).total_seconds() / 60]
                },
                'time_frame_5': {
                    'timeZone': '稼働中',
                    'start': self.target_inf.field_worker_lunch_time_end,
                    'end': self.target_inf.shift_lunch_time_start,
                    'maxTime': [(self.target_inf.shift_lunch_time_start - self.target_inf.field_worker_lunch_time_end).total_seconds() / 60]
                },
                'time_frame_6': {
                    'timeZone': '稼働中',
                    'start': self.target_inf.shift_lunch_time_end,
                    'end': self.target_inf.hot_time_start_b,
                    'maxTime': [(self.target_inf.hot_time_start_b - self.target_inf.shift_lunch_time_end).total_seconds() / 60]
                },
                'time_frame_7': {
                    'timeZone': '停止中',
                    'start': self.target_inf.hot_time_start_b,
                    'end': self.target_inf.hot_time_end_b,
                    'maxTime':[(self.target_inf.hot_time_end_b - self.target_inf.hot_time_start_b).total_seconds() / 60]
                },
                'time_frame_8': {
                    'timeZone': '稼働中',
                    'start': self.target_inf.hot_time_end_b,
                    'end': self.target_inf.shift_change_time_start,
                    'maxTime':[(self.target_inf.shift_change_time_start - self.target_inf.hot_time_end_b).total_seconds() / 60]
                },
                'time_frame_9': {
                    'timeZone': '停止中',
                    'start': self.target_inf.shift_change_time_start,
                    'end': self.target_inf.end_date_time,
                    'maxTime': [(self.target_inf.end_date_time - self.target_inf.shift_change_time_start).total_seconds() / 60]
                }
            }
        elif self.target_inf.shift_pattern_name == '連2A' or self.target_inf.shift_pattern_name == '連2B':
            self.base_time_frame = {
                'time_frame_1': {
                    'timeZone': '稼働中',
                    'start': self.target_inf.shift_start_time,
                    'end': self.target_inf.hot_time_start_a,
                    'maxTime': [(self.target_inf.hot_time_start_a - self.target_inf.shift_start_time).total_seconds() / 60]           
                },
                'time_frame_2': {
                    'timeZone': '停止中',
                    'start': self.target_inf.hot_time_start_a,
                    'end': self.target_inf.hot_time_end_a,
                    'maxTime': [(self.target_inf.hot_time_end_a - self.target_inf.hot_time_start_a).total_seconds() / 60]
                },
                'time_frame_3': {
                    'timeZone': '稼働中',
                    'start': self.target_inf.hot_time_end_a,
                    'end': self.target_inf.field_worker_lunch_time_start,
                    'maxTime': [(self.target_inf.field_worker_lunch_time_start - self.target_inf.hot_time_end_a).total_seconds() / 60]
                },
                'time_frame_4': {
                    'timeZone': '停止中',
                    'start': self.target_inf.field_worker_lunch_time_start,
                    'end': self.target_inf.field_worker_lunch_time_end,
                    'maxTime': [(self.target_inf.field_worker_lunch_time_end - self.target_inf.field_worker_lunch_time_start).total_seconds() / 60]
                },
                'time_frame_5': {
                    'timeZone': '稼働中',
                    'start': self.target_inf.field_worker_lunch_time_end,
                    'end': self.target_inf.hot_time_start_b,
                    'maxTime': [(self.target_inf.hot_time_start_b - self.target_inf.field_worker_lunch_time_end).total_seconds() / 60]
                },
                'time_frame_6': {
                    'timeZone': '停止中',
                    'start': self.target_inf.hot_time_start_b,
                    'end': self.target_inf.hot_time_end_b,
                    'maxTime': [(self.target_inf.hot_time_end_b - self.target_inf.hot_time_start_b).total_seconds() / 60] 
                },
                'time_frame_7': {
                    'timeZone': '稼働中',
                    'start': self.target_inf.hot_time_end_b,
                    'end': self.target_inf.end_date_time,
                    'maxTime': [(self.target_inf.end_date_time - self.target_inf.hot_time_end_b).total_seconds() / 60]
                }
            }
        
    
    def set_busy_key_list(self, _time_zone):
        self.busy_key_list =[key for key, frame in self.base_time_frame.items() if frame['timeZone']==_time_zone]
    
    def set_actual_time_frame(self):
        self.sorted_time_frames = {key: self.base_time_frame[key] for key in self.busy_key_list if key in self.base_time_frame}
    
    def initFrame(self, member_plans):
        self.insert_plan_schedule(member_plans)
        for frame_name, frame in self.plan_time_frame.items():
            sorted_time_frame = self.sorted_time_frame(frame_name, frame)
            frame_size = len(sorted_time_frame)
            self.initMaxTimeFrame(frame_name)
            self.maximumFreeTime(frame_name, sorted_time_frame, 0, frame_size)
            
    def initMaxTimeFrame(self, frame_name):
        self.base_time_frame[frame_name]['maxTime'] = []
            
    def insert_plan_schedule(self, member_plans):
        count = 0
        for plan in member_plans:
            for key, frame in self.base_time_frame.items():
                plan_time = plan.plan.plan_time.replace(tzinfo=None)
                if frame['start'] <= plan_time < frame['end']:
                   
                    man_hour = plan.plan.inspection_no.man_hours
                    if key not in self.plan_time_frame:
                        self.createScheduleFrame(key)
                    self.updateFrameWithTime(count, key, plan_time, man_hour)
                    count += 1
                    break
                
    def addTaskToSchedule(self, works):
        self.works = list(works.items())

        self.possible_process_dict = {work[0]: True for work in self.works}
        self.update_plan_dict = {
            'plan_objs': [],
            'weekly_duty_objs': []
        }

        while self.works:
            _, self.work_data = self.works.pop(0)
            self.process_work_in_frame()
        
        self.savePlanDict()
        return self.update_plan_dict['weekly_duty_objs']
    
    def isScheduleVald(self, idx, frame_name, man_hour, current_schedule, next_schedule):
        update_data ={
            'flag': False,
            'start': '',
            'end': ''
        }
        
        if idx == 0:
            _previous = self.plan_time_frame[frame_name][idx]['start']
            _current = current_schedule['start'] + timedelta(minutes=man_hour)
            _next = next_schedule['start']
            idx = 0
        elif idx == self.time_frame_size-2:
            _previous = current_schedule['end']
            _current = current_schedule['end'] + timedelta(minutes=man_hour)
            _next = next_schedule['end']
        else:
            _previous = current_schedule['end']
            _current = current_schedule['end'] + timedelta(minutes=man_hour)
            _next = next_schedule['start']
            
        if (_previous <= _current <= _next):
            update_data['flag'] = True
            update_data['start'] = _previous
            update_data['end'] = _current
            
        return update_data, idx
    
    def upDateSchedule(self, idx, frame_name, update_time):
        update_frame = {'start': update_time['start'], 'end': update_time['end']}
        self.plan_time_frame[frame_name].insert(idx, update_frame)
        
    def process_work_in_frame(self):
        for frame_name, frame in self.sorted_time_frames.items():
            work_total_man_hour = self.work_data['total_man_hours']
            maxTime = max(frame['maxTime'])
            
            if work_total_man_hour <= maxTime:
                for detail_data in self.work_data['plan_objs']:
                    man_hour = detail_data.inspection_no.man_hours
                
                    if frame_name not in self.plan_time_frame.keys():
                        self.createScheduleFrame(frame_name)
                        self.updateFrameWithTime(0, frame_name, frame['start'], man_hour)
                        self.updatePlanObj(frame['start'], detail_data)
                        self.sorted_time_frame(frame_name, self.plan_time_frame[frame_name])
                        self.initMaxTimeFrame(frame_name)
                        self.maximumFreeTime(frame_name, self.plan_time_frame[frame_name])
                    else:
                        self.time_frame_size = len(self.plan_time_frame[frame_name])
                        for idx, (current_schedule, next_schedule) in enumerate(zip(self.plan_time_frame[frame_name], self.plan_time_frame[frame_name][1:])):
                            update_data, _idx = self.isScheduleVald(idx, frame_name, man_hour, current_schedule, next_schedule)
                            if update_data['flag']:
                                insert_idx = _idx + 1
                                self.upDateSchedule(insert_idx, frame_name, update_data)
                                self.updatePlanObj(update_data['start'], detail_data)
                                self.deleteMaxmumFreeTime(_idx, frame_name)
                                self.maximumFreeTime(frame_name, self.plan_time_frame[frame_name], _idx, _idx+2)
                                break
                return

    def createScheduleFrame(self, key):
        """
        新しい作業スケジュールフレームを作成
        """
        self.plan_time_frame[key] = []
    
    def updateFrameWithTime(self, idx, key, frame_start_time, man_hour):
        """
        フレームに開始時間と終了時間を設定
        """
        update_frame = {'start': frame_start_time, 'end': frame_start_time + timedelta(minutes=man_hour)}
        self.plan_time_frame[key].insert(idx, update_frame)
        
    def updatePlanObj(self, start_time, detail_data):
        """
        更新するplanのリスト作成
        """
        detail_data.plan_time = start_time
        detail_data.status = '実施待ち'
        detail_data.holder = self.member_instance['user_profile'].user
        if self.fallback_leader_handler and self.member_instance['leader_profile'] is None:
            leader_profile = self.fallback_leader_handler(detail_data, self.team_profile)
            detail_data.approver = leader_profile.user
        else:
            detail_data.approver = self.member_instance['leader_profile'].user
        
        detail_data.weekly_duties.status = '実施待ち'

        self.update_plan_dict['plan_objs'].append(detail_data)
        self.update_plan_dict['weekly_duty_objs'].append(detail_data.weekly_duties)
        
            
    def deleteMaxmumFreeTime(self, idx, frame_name):
        del self.base_time_frame[frame_name]['maxTime'][idx]
          
    def maximumFreeTime(self, frame_name, timeFrames, start_index=0, end_index=3):
        frame_size = len(timeFrames)
        for i, (current_schedule, next_schedule) in enumerate(itertools.islice(zip(timeFrames, timeFrames[1:]), start_index, end_index), start=start_index):
                if i == 0:
                    self.maximumFreeTimeUpdate(i, frame_name, current_schedule['start'], next_schedule['start'])
                elif (i == frame_size -2):
                    self.maximumFreeTimeUpdate(i, frame_name, current_schedule['end'], next_schedule['end'])
                else:
                    self.maximumFreeTimeUpdate(i, frame_name, current_schedule['end'], next_schedule['start'])
        
    
    def maximumFreeTimeUpdate(self, i, frame_name, end_time, next_start_time):
        max_time = (next_start_time - end_time).total_seconds() / 60
        self.base_time_frame[frame_name]['maxTime'].insert(i, max_time)
                    
    def sorted_time_frame(self, frame_name, frame):
        """
        plan_time_frameを降順に並び変える
        """
        sorted_time_frame = sorted(frame, key=lambda x: x['start'])
        sorted_time_frame.insert(0, {'start': self.base_time_frame[frame_name]['start']})
        sorted_time_frame.append({'end': self.base_time_frame[frame_name]['end']})
        self.plan_time_frame[frame_name] = sorted_time_frame
        return sorted_time_frame
            
    def savePlanDict(self):
        """
        更新するplan_tbとplanapprrovalとWeeklyDutyを更新
        """

        if self.update_plan_dict['plan_objs']:
            Plan_tb.objects.bulk_update(self.update_plan_dict['plan_objs'], ['plan_time', 'status', 'holder', 'approver'])
            WeeklyDuty.objects.bulk_update(self.update_plan_dict['weekly_duty_objs'], ['status'])
        
