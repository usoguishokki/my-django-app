from django.db import models
from django.db.models import Q
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
"""
初期のmakemigrationsの実行後に作成される、initial.pyに以下のコードを追加する必要ある。(カスタムマイグレーション)
なぜ？ Menber_tb menber_idとpasswordを同じにするため。

from django.db import migrations, models
import django.utils.timezone


def set_initial_password(apps, schema_editor):
    Member_tb = apps.get_model('myapp', 'Member_tb')
    for member in Member_tb.objects.all():
        member.password = member.member_id
        member.save()

class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Member_tb',
            fields=[
                ('member_id', models.CharField(max_length=10, primary_key=True, serialize=False, verbose_name='member_id')),
                ('name', models.CharField(max_length=20, verbose_name='name')),
                ('qualification', models.CharField(max_length=5, verbose_name='qualification')),
                ('job_title', models.CharField(max_length=5, verbose_name='job_title')),
                ('last_login', models.DateTimeField(null=True, verbose_name='last login')),
                ('password', models.CharField(max_length=128)),
            ],
            options={
                'abstract': False,
            }
        ),
        migrations.RunPython(set_initial_password),  # カスタムマイグレーション関数の追加
"""
class WeekSlot(models.IntegerChoices):
    W1 = 1, "1週目"
    W2 = 2, "2週目"
    W3 = 3, "3週目"
    W4 = 4, "4週目"
    RESERVE = 6, "予備週"
    
class DayOfWeek(models.IntegerChoices):
    MON = 0, "月"
    TUE = 1, "火"
    WED = 2, "水"
    THU = 3, "木"
    FRI = 4, "金"
    SAT = 5, "土"
    SUN = 6, "日"
    
class CheckStatus(models.TextChoices):
    PERIODIC = "定期点検", "定期点検"
    MAKER = "メーカ", "メーカ"
    ABOLISHED = "廃止", "廃止"
    DAILY = "日常点検", "日常点検"
    AUTOMATE = "自動化", "自動化"
    SYMPTOM_MGMT = "兆候管理", "兆候管理"
    
class TimeZoneStatus(models.TextChoices):
    RUNNING = "稼働中", "稼働中"
    STOPPED = "停止中", "停止中"
    
class PlanStatus(models.TextChoices):
    WAITING = "配布待ち", "配布待ち"
    IN_PROGRESS = "実施待ち", "実施待ち"
    APPROVAL_WAITING = "承認待ち", "承認待ち"
    COMPLETED = "完了", "完了"
    SENT_BACK = "差戻し", "差戻し"
    DELAYED = "遅れ", "遅れ"
    

class DateTag(models.TextChoices):
    LONG_HOLIDAY = "LONG_HOLIDAY", "連休"

class DateFilterManger(models.Manager):
    def filter_by_date(self, queryset, dates):
        filter_key = queryset.model.date_filter_field + '__in'
        return queryset.filter(**{filter_key: dates})
    
class DateFilterable(models.Model):
    #各モデルでオーバライドするべきフィールド名
    date_filter_field=None
    plan_time_field = None
    result_field = None
    status_field = None
    
    #汎用的なフィールド名を取得
    @classmethod
    def get_field_name(cls, field):
        value = getattr(cls, f'{field}_field', None)
        if value is None:
            raise NotImplementedError(f"{field}_field is not defined in {cls.__name__}.")
        return value
    
    objects = DateFilterManger()
    
    class Meta:
        abstract = True #DateFilerableは抽象化ベースクラスとして定義

class User(models.Model):
    id = models.AutoField(primary_key=True)
    login_number = models.CharField(max_length=10, unique=True)

class Organization(models.Model):
    id = models.AutoField('affilation_id', primary_key=True)
    organization = models.CharField('oraganization', unique=True, max_length=10)
    organization_name = models.CharField('oraganization_name', max_length=10)
    
class Linename_tb(models.Model):
    id = models.AutoField(primary_key=True)
    organization = models.ForeignKey(
        to=Organization, 
        on_delete=models.CASCADE, 
        blank=True, null=True, 
        related_name="linenames"
    )
    line_name = models.CharField('line_name', max_length=50, unique=True)
    
    def __str__(self):
        return self.line_name
    
class Control_tb(models.Model):
    id = models.AutoField(primary_key=True)
    control_no = models.CharField('control_no', unique=True, blank=True, null=False, max_length=20)#管理番号
    line_name = models.ForeignKey(
        to=Linename_tb, 
        on_delete=models.CASCADE, 
        blank=True, null=False, 
        related_name='linenames'
    )
    machine = models.CharField('machine', blank=True, null=True,max_length=40)#設備名
    criterion_link = models.URLField('criterion_link', blank=True, null=True)#運転基準書リンク
    
    def __str__(self):
        return f"[{self.control_no}] {self.machine} ({self.line_name})"

class Affilation_tb(models.Model):
    affilation_id = models.AutoField('affilation_id', primary_key=True)
    affilation = models.CharField('affilation', max_length=20, unique=True)
    
    def __str__(self):
        return self.affilation

class CustomUserManager(BaseUserManager):
    def create_user(self, member_id, password=None, **extra_fields):
        if not member_id:
            raise ValueError('The Member ID must be set')
        
        user = self.model(member_id=member_id, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, member_id, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        
        return self.create_user(member_id, password, **extra_fields)

class Member_tb(AbstractBaseUser, PermissionsMixin):
    member_id = models.CharField('member_id', primary_key=True, max_length=10)
    name = models.CharField('name', max_length=20)
    is_staff = models.BooleanField(default=False)
    
    USERNAME_FIELD = 'member_id'
    REQUIRED_FIELDS = ['name']
    
    objects = CustomUserManager()
    
    def __str__(self):
        return self.member_id
    
    def get_full_name(self):
        return self.name
    
    def get_short_name(self):
        return self.name
   
class UserProfile(models.Model):
    id = models.AutoField('affilation_id', primary_key=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name="profile"
    )
    qualification = models.CharField('qualification', max_length=5)
    job_title = models.CharField('job_title', max_length=5)
    belongs = models.ForeignKey(
        to=Affilation_tb, 
        on_delete=models.CASCADE, 
        related_name='user_profiles'
    )
    organization = models.ForeignKey(to=Organization, on_delete=models.CASCADE)
    
    def __str__(self):
        return f"{self.user.name} ({self.qualification} - {self.job_title})"
    
class ShiftPattan_tb(models.Model):
    pattern_id = models.AutoField('pattern_id', primary_key=True)
    pattern_name = models.CharField('pattern_name', max_length=20)
    start_time = models.TimeField('start_time', null=True)
    end_time = models.TimeField('end_time', null=True)
    lunch_time_start =  models.TimeField('lunch_time_start', null=True)
    lunch_time_end = models.TimeField('lunch_time_end', null=True)
    
    def __str__(self):
        return self.pattern_name


class PlanScheduleRule(models.Model):
    """
    plan_schedule_rule（周期ルールマスタ）
    例:
      - 平日: unit=D, interval=1
      - 毎週: unit=W, interval=1
      - 2か月ごと: unit=M, interval=2
    """
    class Unit(models.TextChoices):
        DAY = "D", "Day"
        WEEK = "W", "Week"
        MONTH = "M", "Month"
        YEAR = "Y", "Year"
    
    name = models.CharField(max_length=64, unique=True)
    unit = models.CharField(max_length=1, choices=Unit.choices)
    interval = models.PositiveBigIntegerField()
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    
    class Meta:
        db_table = "plan_schedule_rule"
        verbose_name = "Plan Schedule Rule"
        verbose_name_plural = "Plan Schedule Rules"
        indexes = [
            models.Index(fields=["unit", "interval"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(interval__gte=1),
                name="plan_schedule_rule_interval_gte_1",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.id}:{self.name} ({self.unit}{self.interval})"
    

class PlanRuleCondition(models.Model):
    """
    plan_rule_condition（ルール条件マスタ）
    例:
      - rule=1, cond_type=DAY_OF_WEEK, op=IN, value_json=[1,2,3,4,5]
      - rule=15, cond_type=DATE_TAG,   op=EQ, value_json="LONG_HOLIDAY"
    """

    class CondType(models.TextChoices):
        DAY_OF_WEEK = "DAY_OF_WEEK", "Day of week"
        WEEK_PARITY = "WEEK_PARITY", "Week parity"
        DATE_TAG = "DATE_TAG", "Date tag"
        NEXT_DATE_TAG = "NEXT_DATE_TAG", "Next date tag"

    class Op(models.TextChoices):
        EQ = "EQ", "Equals"
        IN = "IN", "In"

    rule = models.ForeignKey(
        PlanScheduleRule,
        on_delete=models.CASCADE,   # ルールが消えたら条件も消す（マスタとして自然）
        related_name="conditions",
        db_column="rule_id",        # DB列名を rule_id に寄せたい場合
    )
    cond_type = models.CharField(max_length=32, choices=CondType.choices)
    op = models.CharField(max_length=8, choices=Op.choices)
    value_json = models.JSONField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "plan_rule_condition"
        verbose_name = "Plan Rule Condition"
        verbose_name_plural = "Plan Rule Conditions"
        indexes = [
            models.Index(fields=["rule", "cond_type"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["rule", "cond_type", "op"],
                name="uniq_rule_condtype_op",
            ),
        ]

    def __str__(self) -> str:
        return f"rule={self.rule_id} {self.cond_type} {self.op} {self.value_json}"

    def clean(self):
        """
        最低限の型チェック（DBに変なJSONが入る事故を防ぐ）
        """
        super().clean()

        if self.cond_type == self.CondType.DAY_OF_WEEK and self.op == self.Op.IN:
            if not isinstance(self.value_json, list) or not all(isinstance(x, int) for x in self.value_json):
                raise ValidationError({"value_json": "DAY_OF_WEEK + IN は整数配列を期待します (例: [1,2,3])."})
        if self.cond_type == self.CondType.WEEK_PARITY and self.op == self.Op.IN:
            if not isinstance(self.value_json, list) or not all(isinstance(x, int) for x in self.value_json):
                raise ValidationError({"value_json": "WEEK_PARITY + IN は整数配列を期待します (例: [1,3])."})
        if self.cond_type == self.CondType.DATE_TAG and self.op == self.Op.EQ:
            if not isinstance(self.value_json, str):
                raise ValidationError({"value_json": 'DATE_TAG + EQ は文字列を期待します (例: "LONG_HOLIDAY").'})



#週の考え方: 1:1週目, :1:1週目, 2:2週目, 3:3週目, 4:4週目, 6:予備週
class Check_tb(models.Model):
    id = models.AutoField(primary_key=True)
    inspection_no = models.CharField('inspection_no', unique=True, blank=True, null=True, max_length=20)
    wark_name = models.CharField('wark_name', blank=False, null=True, max_length=100)
    man_hours = models.IntegerField('man_hours', blank=True, null=True,default=1)
    control_no = models.ForeignKey(
        to=Control_tb, 
        on_delete=models.CASCADE, 
        blank=True, null=True, 
        related_name="checks"
    )
    
    rule = models.ForeignKey(
        PlanScheduleRule,
        on_delete=models.PROTECT,   # マスタなので通常はPROTECT推奨（誤削除防止）
        related_name="checks",
    )
    
    anchor_year = models.IntegerField('anchor_year', blank=True, null=True)
    anchor_month = models.PositiveSmallIntegerField(
        'anchor_month',
        blank=True, null=True,
    )
    week_of_month = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        choices=WeekSlot.choices,
    )
    
    day_of_week = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        choices=DayOfWeek.choices,
    )
    
    practitioner = models.ForeignKey(
        to=ShiftPattan_tb, 
        on_delete=models.CASCADE,
        blank=True, 
        null=True, 
        related_name="practitioners"
    )
    
    time_zone = models.CharField(
        max_length=10,
        choices=TimeZoneStatus.choices,
        blank=False,
        null=False,
        default=TimeZoneStatus.RUNNING
    )
    
    status = models.CharField(
        max_length=16,
        choices=CheckStatus.choices,
        default=CheckStatus.PERIODIC,  # 運用に合わせて 
    )
    
    safe_point = models.CharField(
        max_length = 32,
        default='', 
        blank=True
    )
    
    registration = models.DateField('registration', null=True)#登録日
    last_updated = models.DateField('last_updated', null=True)#登録日
    
    
    class Meta:
        constraints = [
            # anchor_month は NULL か 1..12
            models.CheckConstraint(
                check=Q(anchor_month__isnull=True) | (Q(anchor_month__gte=1) & Q(anchor_month__lte=12)),
                name="check_tb_anchor_month_null_or_1_12",
            ),
            # anchor_year は NULL か >= 1（必要なら範囲を狭めてもOK）
            models.CheckConstraint(
                check=Q(anchor_year__isnull=True) | Q(anchor_year__gte=1),
                name="check_tb_anchor_year_null_or_gte_1",
            ),
            # week_of_month は NULL か choices の値（DBによっては choices だけでは守れないため）
            models.CheckConstraint(
                check=Q(week_of_month__isnull=True) | Q(week_of_month__in=[1, 2, 3, 4, 6]),
                name="check_tb_week_of_month_null_or_valid",
            ),
            
            models.CheckConstraint(
                check=Q(day_of_week__isnull=True) | Q(day_of_week__in=[0, 1, 2, 3, 4, 5, 6]),
                name="check_tb_day_of_week_null_or_0_6",
            ),
        ]
    
    def __str__(self):
        return f"{self.inspection_no} - {self.wark_name}"
    
class Db_details_tb(models.Model):
    id = models.AutoField('id', primary_key=True)
    inspection_no = models.ForeignKey(
        to=Check_tb, 
        on_delete=models.CASCADE, 
        blank=True,
        null=True, 
        related_name="db_details"
    )
    applicable_device = models.CharField('applicable_device', blank=True, null=True, max_length=100)
    method = models.CharField('method', blank=True, null=True, max_length=50)
    contents = models.CharField('contents', blank=True, null=True, max_length=200)
    standard = models.CharField('standard', blank=True, null=True, max_length=200)
    remarks = models.CharField('remarks', blank=True, null=True, max_length=200)
    inspection_man_hours = models.IntegerField('inspection_man_hours', blank=True, null=True, default=1)
    status = models.CharField(
        max_length=16,
        choices=CheckStatus.choices,
        default=CheckStatus.PERIODIC,
    )
    
    def __str__(self):
        return f"{self.applicable_device} - {self.contents}"
    
class Hozen_calendar_tb(models.Model):
    h_id = models.AutoField('h_id', primary_key=True)
    h_date = models.DateField('h_date', null=True, unique=True)
    h_day_of_week = models.PositiveSmallIntegerField(
        null=True, blank=True,
        choices=DayOfWeek.choices,
    )
    
    h_month = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )
    
    
    h_week =  models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        choices=WeekSlot.choices,
    )
    
    date_alias = models.CharField(blank=True, null=True, max_length=20)
    
    date_tag = models.CharField(
        max_length=32,
        blank=True,
        null=True,
        choices=DateTag.choices,
    )

    # ★追加2：連休グループ（GW/SV/WVなど）
    holiday_group_id = models.CharField(
        max_length=16,
        blank=True,
        null=True,
        db_index=True,
    )

    def __str__(self):
        return f"{self.h_date} ({self.date_alias})"

    
    def __str__(self):
        return f"{self.h_date} ({self.date_alias})"
    
class Plan_tb(DateFilterable): #DateFilterableが'models.Modelを継承しているのでmodels.Modelに出なくて大丈夫
    date_filter_field = 'p_date'
    plan_time_field = 'plan_time'
    result_field = 'result'
    status_field = 'status'
    
    plan_id = models.AutoField('plan_id', primary_key=True)#plan_id
    inspection_no = models.ForeignKey(
        to=Check_tb, 
        on_delete=models.CASCADE, 
        blank=False, 
        null=True, 
        related_name="plans"
    )#点検カードNo
    p_date = models.ForeignKey(
        to=Hozen_calendar_tb,
        on_delete=models.CASCADE, 
        blank=False, null=True, 
        related_name="plans_by_date"
    )#計画日(点検カードを実施する日)
    plan_time = models.DateTimeField('plan_time', null=True)#タイムテーブルで日付を指定して配った日
    implementation_date =  models.DateTimeField('implementation_date', null=True, blank=True)#実施日
    result_man_hours = models.IntegerField('man_hours', null=True, blank=True)#実施時間
    result = models.CharField('result', null=True, blank=True, max_length=20)#結果
    points_to_note = models.CharField('points_to_pointed_out', null=True, blank=True, max_length=500)#指摘事項
    status = models.CharField('status', max_length=20, choices=PlanStatus.choices, default=PlanStatus.WAITING)#ステータス
    comment = models.CharField('comment', max_length=300, null=True, blank=True)#コメント
    
    approver = models.ForeignKey(
        Member_tb, 
        null=True, 
        blank=True, 
        on_delete=models.CASCADE,
        related_name='approved_plans'
    )#承認者
    holder = models.ForeignKey(
        Member_tb,
        null=True, 
        blank=True, 
        on_delete=models.CASCADE,
        related_name='holder_plans'
    )#保持者
    applicant = models.ForeignKey(
        Member_tb, 
        null=True, 
        blank=True, 
        on_delete=models.CASCADE,
        related_name='applied_plans'
    )#申請者
    
    
    def __str__(self):
        return f"Plan {self.plan_id} ({self.status})"
   
class WeeklyDuty(DateFilterable): #DateFilterableが'models.Modelを継承しているのでmodels.Modelに出なくて大丈夫
    date_filter_field = 'plan__p_date'
    plan_time_field = 'plan__plan_time'
    result_field = 'plan__result'
    status_field = 'plan__status'
    plan = models.OneToOneField(
        Plan_tb, 
        null=True, 
        blank=True, 
        on_delete=models.CASCADE, 
        related_name='weekly_duties'
    )
    affilation = models.ForeignKey(
        Affilation_tb,  
        null=True, 
        blank=True, 
        on_delete=models.CASCADE, 
        related_name='weekly_duties'
    )
    status = status = models.CharField('status', max_length=20, choices=PlanStatus.choices, default=PlanStatus.WAITING)#ステータス
    this_week = models.BooleanField('this_week' ,default=False)
    
    def __str__(self):
        return f"Weekly Duty - {self.plan} ({self.status})"
    

class PlanApproval(models.Model):
    plan = models.ForeignKey(
        Plan_tb, 
        on_delete=models.CASCADE, 
        related_name='approvals'
    )
    member = models.ForeignKey(
        Member_tb, 
        on_delete=models.CASCADE, 
        related_name="plan_approvals"
    )
    role = models.CharField(max_length=20, choices=[
        ('holder', 'Holder'),
        ('applicant', 'Applicant'),
        ('approver', 'Approver'),
    ])
    
    def __str__(self):
        return f"{self.get_role_display()} - {self.member.name}"

class Calendar_tb(models.Model):
    c_id = models.AutoField('c_id', primary_key=True)
    c_date = models.ForeignKey(
        to=Hozen_calendar_tb, 
        on_delete=models.CASCADE, 
        blank=False, null=True, related_name='calendars'
    )
    affilation = models.ForeignKey(to=Affilation_tb, to_field='affilation_id', on_delete=models.CASCADE, related_name='calendars')
    pattern = models.ForeignKey(to=ShiftPattan_tb, on_delete=models.CASCADE, related_name='calendars')
    
    def __str__(self):
        return f"Calendar ({self.affilation} - {self.pattern})"
    
class Field_worker_tb(models.Model):
    pattern_id = models.AutoField('pattern_id', primary_key=True)
    pattern_name = models.CharField('pattern_name', max_length=20)
    start_time = models.TimeField('start_time', null=True)
    end_time = models.TimeField('end_time', null=True)
    hot_time_morning_start = models.TimeField('hot_time_morning_start', null=True)
    hot_time_morning_end = models.TimeField('hot_time_morning_end', null=True)
    hot_time_afternoon_start = models.TimeField('hot_time_afternoon_start', null=True)
    hot_time_afternoon_end = models.TimeField('hot_time_afternoon_end', null=True)
    lunch_break_start = models.TimeField('lunch_break_start', null=True)
    lunch_break_end = models.TimeField('lunch_break_end', null=True)
    hot_time_last_start = models.TimeField('hot_time_last_start', null=True)
    hot_time_last_end = models.TimeField('hot_time_last_end', null=True)
    
    def __str__(self):
        return self.pattern_name

class Practitioner_tb(models.Model):
    id = models.AutoField('id', primary_key=True)
    plan_id = models.ForeignKey(to=Plan_tb, on_delete=models.CASCADE, blank=True, null=True, related_name='practitioners')
    member_id = models.ForeignKey(to=Member_tb, on_delete=models.CASCADE, blank=True, null=True, related_name='practitioners')
    
    def __str__(self):
        return f"Practitioner for Plan {self.plan_id} - {self.member_id}"


#データベースでビューを使って作成
class Shift_pattern_worker_view(models.Model):
    shift_pattern_name = models.CharField('shift_pattern_name', max_length=10, primary_key=True)
    shift_start_time = models.TimeField('shift_start_time', null=True)
    shift_end_time = models.TimeField('shift_end_time', null=True)
    shift_lunch_time_start = models.TimeField('shift_lunch_time_start', null=True)
    shift_lunch_time_end = models.TimeField('shift_lunch_time_end', null=True)
    hot_time_start_a = models.TimeField('hot_time_start_a', null=True)
    hot_time_end_a = models.TimeField('hot_time_end_a', null=True)
    hot_time_start_b = models.TimeField('hot_time_start_b', null=True)
    hot_time_end_b = models.TimeField('hot_time_end_b', null=True)
    field_worker_lunch_time_start = models.TimeField('field_worker_lunch_time_start', null=True)
    field_worker_lunch_time_end = models.TimeField('field_worker_lunch_time_end', null=True)
    shift_change_time_start = models.TimeField('shift_change_time_start', null=True)
    shift_change_time_end = models.TimeField('shift_change_time_end', null=True)
    
    def __str__(self):
        return self.shift_pattern_name
    
    class Meta:
        managed = False
        db_table = 'shiftpattern_worker_view'

    
    
    
    
    