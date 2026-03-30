from dataclasses import dataclass
from enum import Enum


from datetime import datetime, timedelta, time as dt_time
from .models import Plan_tb

from myapp.domain.line_frame_builder import build_factory_line_frames
from myapp.domain.shifts import calc_shift_window_dt

import itertools


class WorkerStatus(str, Enum):
    WORK = "WORK"
    LUNCH = "LUNCH"
    OFF = "OFF"


@dataclass(frozen=True)
class WorkerTimeBand:
    start_at: datetime
    end_at: datetime
    worker_status: WorkerStatus

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
        
        self.line_frames = {}
        self.worker_frames = []
        self.time_frame = {}
        
    
    def _normalize_worker_point(self, base_start: datetime, value):
        """
        worker 系の時刻を、base_start を基準に同じ時間軸の datetime にそろえる。
        value が datetime ならそのまま返す。
        value が time なら base_start を基準に datetime 化する。
        """
        if value is None:
            return None
    
        if isinstance(value, datetime):
            return value
    
        if isinstance(value, dt_time):
            point = datetime.combine(base_start.date(), value)
            if point < base_start:
                point += timedelta(days=1)
            return point
    
        return value
        
        
    '''
    def _build_worker_frames(self):
        
        if self.target_inf.shift_pattern_name == '1直':
            self.worker_frames = {
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
            self.worker_frames = {
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
            self.worker_frames = {
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
            self.worker_frames = {
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
            self.worker_frames = {
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
    '''
    
    def _build_worker_frames_for_date(self, base_date):
        """
        指定日の勤務帯を WorkerTimeBand の list で返す。
        """
        worker_frames = []

        shift_start_raw = self.target_inf.shift_start_time
        shift_end_raw = self.target_inf.shift_end_time

        if shift_start_raw is None or shift_end_raw is None:
            return worker_frames

        shift_start_t = shift_start_raw if isinstance(shift_start_raw, dt_time) else shift_start_raw.time()
        shift_end_t = shift_end_raw if isinstance(shift_end_raw, dt_time) else shift_end_raw.time()

        shift_window = calc_shift_window_dt(
            shift_date=base_date,
            start_t=shift_start_t,
            end_t=shift_end_t,
        )

        if not shift_window:
            return worker_frames

        shift_start, shift_end = shift_window

        lunch_start_raw = self.target_inf.shift_lunch_time_start
        lunch_end_raw = self.target_inf.shift_lunch_time_end

        lunch_start = self._normalize_worker_point(shift_start, lunch_start_raw)
        lunch_end = self._normalize_worker_point(shift_start, lunch_end_raw)

        if lunch_start is None or lunch_end is None:
            worker_frames.append(
                WorkerTimeBand(
                    start_at=shift_start,
                    end_at=shift_end,
                    worker_status=WorkerStatus.WORK,
                )
            )
            return worker_frames

        if lunch_end <= lunch_start:
            lunch_end += timedelta(days=1)

        if shift_start < lunch_start:
            worker_frames.append(
                WorkerTimeBand(
                    start_at=shift_start,
                    end_at=lunch_start,
                    worker_status=WorkerStatus.WORK,
                )
            )

        if lunch_start < lunch_end:
            worker_frames.append(
                WorkerTimeBand(
                    start_at=lunch_start,
                    end_at=lunch_end,
                    worker_status=WorkerStatus.LUNCH,
                )
            )

        if lunch_end < shift_end:
            worker_frames.append(
                WorkerTimeBand(
                    start_at=lunch_end,
                    end_at=shift_end,
                    worker_status=WorkerStatus.WORK,
                )
            )

        return worker_frames
    
    
    def _build_worker_frames_for_window(self, registration_date, registration_end_date):
        """
        registration_date ～ registration_end_date に重なる worker frame を収集する。
        日跨ぎ勤務を考慮して、前日分から確認する。
        """
        worker_frames = []

        current_date = registration_date.date() - timedelta(days=1)
        end_date = registration_end_date.date()

        while current_date <= end_date:
            daily_frames = self._build_worker_frames_for_date(current_date)

            for frame in daily_frames:
                if frame.end_at <= registration_date:
                    continue
                if registration_end_date <= frame.start_at:
                    continue
                worker_frames.append(frame)

            current_date += timedelta(days=1)

        worker_frames.sort(key=lambda x: x.start_at)
        return worker_frames
    
    
    def _get_candidate_line_frames(self, target_date):
        """
        target_date 周辺の line_frames をまとめて取得する。
        build_factory_line_frames() は翌日1直本体を含まないため、
        前日・当日・翌日を候補にする。
        """
        frames = []

        for base_date in (
            target_date - timedelta(days=1),
            target_date,
            target_date + timedelta(days=1),
        ):
            line_frames = build_factory_line_frames(base_date)
            frames.extend(line_frames.values())

        frames.sort(key=lambda x: x["start"])
        return frames
    
    
    def _find_line_frame_from_candidates(self, candidate_frames, seg_start, seg_end):
        for frame in candidate_frames:
            if frame["start"] <= seg_start and seg_end <= frame["end"]:
                return frame
        return None
    
    
            
    

    def _build_time_frames_from_worker_basis(self, worker_frames):
        """
        worker_frames を主軸にして time_frame を構築する。
        worker 区間は必ず残し、timeZone は line_frames から付与する。
        """
        temp = []

        for worker_frame in worker_frames:
            w_start = worker_frame.start_at
            w_end = worker_frame.end_at
            worker_status = worker_frame.worker_status.value

            candidate_line_frames = self._get_candidate_line_frames(w_start.date())

            boundaries = {w_start, w_end}

            for line_frame in candidate_line_frames:
                l_start = line_frame["start"]
                l_end = line_frame["end"]

                overlap_start = max(w_start, l_start)
                overlap_end = min(w_end, l_end)

                if overlap_start < overlap_end:
                    boundaries.add(overlap_start)
                    boundaries.add(overlap_end)

            points = sorted(boundaries)

            for i in range(len(points) - 1):
                seg_start = points[i]
                seg_end = points[i + 1]

                if seg_start >= seg_end:
                    continue

                line_frame = self._find_line_frame_from_candidates(
                    candidate_frames=candidate_line_frames,
                    seg_start=seg_start,
                    seg_end=seg_end,
                )

                time_zone = line_frame["timeZone"] if line_frame else "UNKNOWN"

                temp.append({
                    "start": seg_start,
                    "end": seg_end,
                    "timeZone": time_zone,
                    "maxTime": [(seg_end - seg_start).total_seconds() / 60],
                    "workerStatus": worker_status,
                })

        temp.sort(key=lambda x: x["start"])
        return temp



    def _clip_frames_to_registration_window(self, frames, registration_date, registration_end_date):
        clipped = []

        for frame in frames:
            clipped_start = max(frame["start"], registration_date)
            clipped_end = min(frame["end"], registration_end_date)

            if clipped_start >= clipped_end:
                continue

            clipped.append({
                "start": clipped_start,
                "end": clipped_end,
                "timeZone": frame["timeZone"],
                "maxTime": [(clipped_end - clipped_start).total_seconds() / 60],
                "workerStatus": frame["workerStatus"],
            })

        return clipped
    
    



            
    
            
            
            
            
    def set_time_frames(self, registration_date, registration_end_date):
        """
        registration_date ～ registration_end_date を基準に
        worker_frames 主軸で base_time_frame / time_frame を再構築する。
        """
        if registration_date is None or registration_end_date is None:
            raise ValueError("registration_date と registration_end_date は必須です。")

        if registration_end_date <= registration_date:
            raise ValueError("registration_end_date は registration_date より後である必要があります。")

        self.worker_frames = self._build_worker_frames_for_window(
            registration_date=registration_date,
            registration_end_date=registration_end_date,
        )

        all_frames = self._build_time_frames_from_worker_basis(self.worker_frames)

        clipped_frames = self._clip_frames_to_registration_window(
            frames=all_frames,
            registration_date=registration_date,
            registration_end_date=registration_end_date,
        )

        self.time_frame = {
            f"time_frame_{idx}": frame
            for idx, frame in enumerate(clipped_frames, start=1)
        }

        self.base_time_frame = self.time_frame

        
    
    
    
        
    def _find_line_frame(self, seg_start, seg_end):
        for frame in self.line_frames.values():
            if frame["start"] <= seg_start and seg_end <= frame["end"]:
                return frame
        return None


    def _find_worker_band(self, seg_start, seg_end):
        for wf in self.worker_frames:
            if wf.start_at <= seg_start and seg_end <= wf.end_at:
                return wf
        return None

        
            
    
    def change_time_frames(self, registration_start, registration_end):
        updated = {
            'start_updated': False,
            'end_updated': False,
            'start_index': None,
            'end_index': None,
        }
        
        frames = list(self.base_time_frame.items())
        first_frame_name, first_frame_data = frames[0]
        last_frame_name, last_frame_data = frames[-1]
        
        #最初のtime_frameよりも前の範囲 → 最初の1つに巻替え
        if registration_end < first_frame_data['start']:
            new_frame = {
                'timeZone': first_frame_data['timeZone'],
                'start': registration_start,
                'end': registration_end,
                'maxTime': [(registration_end - registration_start).total_seconds() / 60]
            }
            self.base_time_frame = {first_frame_name: new_frame}
            return
    
        #最後のtime_frameよりも後の範囲 → 最後の1つに巻替え
        if registration_start > last_frame_data['end']:
            new_frame = {
                'timeZone': last_frame_data['timeZone'],
                'start': registration_start,
                'end': registration_end,
                'maxTime': [(registration_end - registration_start).total_seconds() / 60]
            }
            self.base_time_frame = {last_frame_name: new_frame}
            return
    
        for idx, (frame_name, frame_data) in enumerate(frames):
            start = frame_data['start']
            end = frame_data['end']
            

            #registration_startがstartより前になる最初のframe探して上書き
            if not updated['start_updated']:
                if (start < registration_start <= end) or (first_frame_name == frame_name and registration_start < start):
                    frame_data['start'] = registration_start
                    updated['start_updated'] = True
                    updated['start_index'] = idx
                    frame_data['maxTime'] = [(frame_data['end'] - frame_data['start']).total_seconds() / 60]
                    
            #end巻替え　通常か or 最後のフレーム特例
            if not updated['end_updated']:
                if (start <= registration_end < end) or (last_frame_name == frame_name and registration_end > end):
                    frame_data['end'] = registration_end
                    updated['end_updated'] = True
                    updated['end_index'] = idx
                    frame_data['maxTime'] = [(frame_data['end'] - frame_data['start']).total_seconds() / 60]
                    
        if updated['start_updated'] or updated['end_updated']:
            start_idx = updated['start_index'] if updated['start_index'] is not None else 0
            end_idx = updated['end_index'] if updated['end_index'] is not None else len(frames) - 1
            
            sliced_frames = frames[start_idx:end_idx + 1]
            self.base_time_frame = {name: data for name, data in sliced_frames}
            
        return()
        
    
    def set_busy_key_list(self, _time_zone):
        self.busy_key_list = [
            key
            for key, frame in self.base_time_frame.items()
            if frame.get('timeZone') == _time_zone
            and frame.get('workerStatus') != WorkerStatus.LUNCH.value
        ]
    
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
                plan_time = plan.plan_time.replace(tzinfo=None)
                if frame['start'] <= plan_time < frame['end']:
                   
                    man_hour = plan.inspection_no.man_hours
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
        return self.update_plan_dict['plan_objs']
    
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
            
            if work_total_man_hour < maxTime:
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
        if self.member_instance['leader_profile']:
            detail_data.approver = self.member_instance['leader_profile'].user
        else:
            detail_data.approver = self.fallback_leader_handler
            
        
        #detail_data.weekly_duties.status = '実施待ち'

        self.update_plan_dict['plan_objs'].append(detail_data)
        #self.update_plan_dict['weekly_duty_objs'].append(detail_data.weekly_duties)
        
            
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
            updated_count = Plan_tb.objects.bulk_update(self.update_plan_dict['plan_objs'], ['plan_time', 'status', 'holder', 'approver'])

        
