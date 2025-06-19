from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.conf import settings
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

checkStatusFlag = [('', ''), ('メーカ', 'メーカ'), ('自動化', '自動化'), ('日常点検', '日常点検'), ('廃止', '廃止'), ('差戻し', '差戻し')]
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
    day_of_week = models.CharField('day_of_week', blank=True, null=True,max_length=5)
    practitioner = models.ForeignKey(
        to=ShiftPattan_tb, 
        on_delete=models.CASCADE,
        blank=True, 
        null=True, 
        related_name="practitioners"
    )
    time_zone = models.CharField('time_zone', blank=True, null=True,max_length=3)
    status = models.CharField('status', max_length=20, choices=checkStatusFlag, default='')#ステータス
    registration = models.DateField('registration', null=True)#登録日
    last_updated = models.DateField('last_updated', null=True)#登録日
    
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
    
    def __str__(self):
        return f"{self.applicable_device} - {self.contents}"
    
class Hozen_calendar_tb(models.Model):
    h_id = models.AutoField('h_id', primary_key=True)
    h_date = models.DateField('h_date', null=True, unique=True)
    h_day_of_week = models.CharField('h_day_of_week', null=True, max_length=2)
    h_month = models.IntegerField('h_month')
    h_week = models.IntegerField('h_week')
    date_alias = models.CharField('date_alias', blank=True, null=True, max_length=10)
    
    def __str__(self):
        return f"{self.h_date} ({self.date_alias})"
    

status_flag = [('配布待ち', '配布待ち'), ('実施待ち', '実施待ち'), ('承認待ち', '承認待ち'), ('完了', '完了'), ('差戻し', '差戻し'), ('遅れ', '遅れ')]
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
    implementation_date = models.DateField('implementation_date', null=True)#実施日
    result_man_hours = models.IntegerField('man_hours', null=True, blank=True)#実施時間
    result = models.CharField('result', null=True, blank=True, max_length=20)#結果
    points_to_note = models.CharField('points_to_pointed_out', null=True, blank=True, max_length=500)#指摘事項
    status = models.CharField('status', max_length=20, choices=status_flag, default='配布待ち')#ステータス
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
    status = status = models.CharField('status', max_length=20, choices=status_flag, default='配布待ち')#ステータス
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

    
    
    
    
    