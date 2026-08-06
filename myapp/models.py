from django.db import models
from django.db.models import Q
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
import uuid

from django.utils import timezone
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
    DAILY = "日常点検", "日常点検"
    PERIODIC = "定期点検", "定期点検"
    SYMPTOM_MGMT = "兆候管理", "兆候管理"
    AUTOMATE = "自動化", "自動化"
    MAKER = "メーカ", "メーカ"
    ABOLISHED = "廃止", "廃止"

class DbDetailStatus(models.TextChoices):
    NORMAL = '通常', '通常'
    MAKER = 'メーカ', 'メーカ'
    AUTOMATION = '自動化', '自動化'
    ABOLISHED = '廃止', '廃止'

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


class InspectionStandardHistorySource(models.TextChoices):
    CARD_CREATE = "CARD_CREATE", "カード追加"
    CARD_ABOLISH = "CARD_ABOLISH", "カード削除"
    COMMON_ITEMS_UPDATE = "COMMON_ITEMS_UPDATE", "共通項目変更"
    DETAIL_CREATE = "DETAIL_CREATE", "項目追加"
    DETAIL_UPDATE = "DETAIL_UPDATE", "項目変更"
    DETAIL_ABOLISH = "DETAIL_ABOLISH", "項目削除"
    PLAN_SYNC = "PLAN_SYNC", "計画同期"


class InspectionStandardHistoryOperation(models.TextChoices):
    CREATE = "CREATE", "追加"
    UPDATE = "UPDATE", "変更"
    ABOLISH = "ABOLISH", "廃止"
    DELETE = "DELETE", "削除"


class InspectionStandardHistoryTargetType(models.TextChoices):
    CHECK = "CHECK", "点検カード"
    DETAIL = "DETAIL", "点検項目"
    PLAN = "PLAN", "計画"


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


class EquipmentGroup(models.Model):
    """
    複数の個別設備をまとめる設備グループ。

    CSV:
        equipment_group.csv

    例:
        GRP-R08-069      成形3号機設備群
        GRP-PG-ALL       汎用穴明機群
        GRP-UTILITY      工場ユーティリティ設備群
    """

    class GroupType(models.TextChoices):
        SINGLE_EQUIPMENT = (
            "SINGLE_EQUIPMENT",
            "単独設備",
        )
        MACHINE_SYSTEM = (
            "MACHINE_SYSTEM",
            "主設備・付帯設備群",
        )
        PROCESS_SYSTEM = (
            "PROCESS_SYSTEM",
            "工程設備群",
        )
        FUNCTION_GROUP = (
            "FUNCTION_GROUP",
            "機能別設備群",
        )
        SAFETY_SYSTEM = (
            "SAFETY_SYSTEM",
            "安全・防災設備群",
        )

    id = models.BigAutoField(
        primary_key=True,
    )

    group_code = models.CharField(
        verbose_name="設備グループコード",
        max_length=32,
        unique=True,
    )

    group_name = models.CharField(
        verbose_name="設備グループ名",
        max_length=100,
    )

    group_type = models.CharField(
        verbose_name="設備グループ種別",
        max_length=32,
        choices=GroupType.choices,
    )

    description = models.CharField(
        verbose_name="説明",
        max_length=500,
        blank=True,
        default="",
    )

    is_active = models.BooleanField(
        verbose_name="使用中",
        default=True,
    )

    created_at = models.DateTimeField(
        verbose_name="登録日時",
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        verbose_name="更新日時",
        auto_now=True,
    )

    class Meta:
        db_table = "equipment_group"
        verbose_name = "設備グループ"
        verbose_name_plural = "設備グループ"
        ordering = (
            "group_code",
        )
        indexes = [
            models.Index(
                fields=["group_type", "is_active"],
                name="eqgrp_type_active_idx",
            ),
        ]

    def __str__(self):
        return f"[{self.group_code}] {self.group_name}"


class EquipmentGroupMember(models.Model):
    """
    設備グループとControl_tbの所属関係。

    CSV:
        equipment_group_member.csv

    現在の運用ルール:
        1つのControl_tbは、1つの設備グループだけに所属する。
    """

    class MemberRole(models.TextChoices):
        MAIN_MACHINE = (
            "MAIN_MACHINE",
            "主設備",
        )
        CONTROL_PANEL = (
            "CONTROL_PANEL",
            "制御盤",
        )
        ROBOT = (
            "ROBOT",
            "ロボット",
        )
        CONVEYOR = (
            "CONVEYOR",
            "搬送設備",
        )
        TEMPERATURE_UNIT = (
            "TEMPERATURE_UNIT",
            "温調設備",
        )
        AIR_CONDITIONING = (
            "AIR_CONDITIONING",
            "給排気・空調設備",
        )
        DRYING_OVEN = (
            "DRYING_OVEN",
            "乾燥炉",
        )
        AGV = (
            "AGV",
            "AGV",
        )
        SAFETY_DEVICE = (
            "SAFETY_DEVICE",
            "安全・防災設備",
        )
        UTILITY = (
            "UTILITY",
            "付帯設備",
        )
        OTHER = (
            "OTHER",
            "その他設備",
        )

    id = models.BigAutoField(
        primary_key=True,
    )

    equipment_group = models.ForeignKey(
        EquipmentGroup,
        verbose_name="設備グループ",
        on_delete=models.PROTECT,
        related_name="members",
        db_column="equipment_group_id",
    )

    control = models.ForeignKey(
        Control_tb,
        verbose_name="個別設備",
        on_delete=models.PROTECT,
        related_name="equipment_group_members",
        db_column="control_id",
    )

    member_role = models.CharField(
        verbose_name="設備役割",
        max_length=32,
        choices=MemberRole.choices,
    )

    is_primary = models.BooleanField(
        verbose_name="代表設備",
        default=False,
    )

    is_active = models.BooleanField(
        verbose_name="使用中",
        default=True,
    )

    created_at = models.DateTimeField(
        verbose_name="登録日時",
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        verbose_name="更新日時",
        auto_now=True,
    )

    class Meta:
        db_table = "equipment_group_member"
        verbose_name = "設備グループ所属設備"
        verbose_name_plural = "設備グループ所属設備"
        ordering = (
            "equipment_group__group_code",
            "-is_primary",
            "control__control_no",
        )
        indexes = [
            models.Index(
                fields=["equipment_group", "is_active"],
                name="eqgrp_mem_group_act_idx",
            ),
            models.Index(
                fields=["control", "is_active"],
                name="eqgrp_mem_ctrl_act_idx",
            ),
            models.Index(
                fields=["member_role"],
                name="eqgrp_mem_role_idx",
            ),
        ]
        constraints = [
            # 現在の運用では、1設備は1グループだけに所属する。
            models.UniqueConstraint(
                fields=["control"],
                name="eqgrp_mem_control_uq",
            ),

            # 無効な設備を代表設備にはできない。
            models.CheckConstraint(
                check=Q(is_primary=False) | Q(is_active=True),
                name="eqgrp_mem_primary_act_ck",
            ),
        ]

    def clean(self):
        super().clean()

        if self.is_primary and not self.is_active:
            raise ValidationError({
                "is_primary":
                    "無効な所属設備を代表設備には設定できません。"
            })

        if (
            self.is_primary
            and self.is_active
            and self.equipment_group_id
        ):
            duplicate_primary = (
                EquipmentGroupMember.objects
                .filter(
                    equipment_group_id=self.equipment_group_id,
                    is_primary=True,
                    is_active=True,
                )
                .exclude(pk=self.pk)
                .exists()
            )

            if duplicate_primary:
                raise ValidationError({
                    "is_primary":
                        "この設備グループには、すでに代表設備が存在します。"
                })

    def __str__(self):
        primary_label = " / 代表" if self.is_primary else ""

        return (
            f"{self.equipment_group.group_code} - "
            f"{self.control.control_no} "
            f"({self.get_member_role_display()}{primary_label})"
        )


class InstructionCardEquipmentMap(models.Model):
    """
    指示カードCSVに記録された設備名と、
    EquipmentGroupの対応マスター。

    CSV:
        instruction_card_equipment_map.csv

    group_codeが未設定の設備名も登録するため、
    equipment_groupはNULLを許可する。
    """

    id = models.BigAutoField(
        primary_key=True,
    )

    equipment_name = models.CharField(
        verbose_name="指示カード設備名",
        max_length=100,
        unique=True,
    )

    equipment_group = models.ForeignKey(
        EquipmentGroup,
        verbose_name="設備グループ",
        on_delete=models.SET_NULL,
        related_name="instruction_card_equipment_maps",
        db_column="equipment_group_id",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        verbose_name="登録日時",
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        verbose_name="更新日時",
        auto_now=True,
    )

    class Meta:
        db_table = "instruction_card_equipment_map"
        verbose_name = "指示カード設備名マップ"
        verbose_name_plural = "指示カード設備名マップ"
        ordering = (
            "equipment_name",
        )

    def __str__(self):
        if self.equipment_group:
            return (
                f"{self.equipment_name} → "
                f"{self.equipment_group.group_code}"
            )

        return f"{self.equipment_name} → 未設定"

class InstructionCard(models.Model):
    """
    指示カードアプリから出力された指示カード本体。

    元CSV:
        PLUS ULTRA_Ver8.csv

    CSVのidには空白・重複が存在するため、
    DB内部では独自のBigAutoFieldを主キーとして使用する。

    設備名は元の文字列をequipment_nameへ保存し、
    完全一致する設備名マップがある場合だけequipment_mapへ紐づける。
    """

    class MaintenanceType(models.TextChoices):
        PREVENTIVE = "予防", "予防"
        BREAKDOWN = "事後", "事後"
        OTHER = "その他", "その他"
        IMPROVEMENT = "改良", "改良"
        SHOP_REQUEST = "現場依頼", "現場依頼"
        INVESTIGATION = "調査", "調査"
        ENGINEERING_REQUEST = "生技依頼", "生技依頼"
        SAFETY = "安全", "安全"
        TRAINING = "人材育成", "人材育成"

    class CompletionStatus(models.TextChoices):
        COMPLETED = "完了", "完了"
        WAITING = "実施待ち", "実施待ち"
        ON_HOLD = "保留", "保留"

    id = models.BigAutoField(
        primary_key=True,
    )

    # ----------------------------
    # 取込元の識別情報
    # ----------------------------

    source_file_name = models.CharField(
        verbose_name="取込元ファイル名",
        max_length=150,
        default="PLUS ULTRA_Ver8.csv",
    )

    source_row_number = models.PositiveIntegerField(
        verbose_name="取込元行番号",
    )

    legacy_id = models.CharField(
        verbose_name="旧指示カードID",
        max_length=20,
        blank=True,
        default="",
        db_index=True,
    )

    # ----------------------------
    # 指示カード基本情報
    # ----------------------------

    issued_date = models.DateField(
        verbose_name="発行日",
        null=True,
        blank=True,
        db_index=True,
    )

    requested_by_name = models.CharField(
        verbose_name="From",
        max_length=50,
        blank=True,
        default="",
    )

    process_name = models.CharField(
        verbose_name="工程名",
        max_length=100,
        blank=True,
        default="",
        db_index=True,
    )

    equipment_name = models.CharField(
        verbose_name="設備名",
        max_length=100,
        blank=True,
        default="",
        db_index=True,
    )

    equipment_map = models.ForeignKey(
        InstructionCardEquipmentMap,
        verbose_name="指示カード設備名マップ",
        on_delete=models.SET_NULL,
        related_name="instruction_cards",
        null=True,
        blank=True,
    )

    maintenance_type = models.CharField(
        verbose_name="保全区分",
        max_length=16,
        choices=MaintenanceType.choices,
        blank=True,
        default="",
        db_index=True,
    )

    work_name = models.CharField(
        verbose_name="作業名",
        max_length=150,
        blank=True,
        default="",
    )

    planned_person_count = models.PositiveSmallIntegerField(
        verbose_name="予定人数",
        null=True,
        blank=True,
    )

    planned_work_minutes = models.PositiveIntegerField(
        verbose_name="予定工数・分",
        null=True,
        blank=True,
    )

    request_text = models.TextField(
        verbose_name="依頼内容",
        blank=True,
        default="",
    )

    due_date = models.DateField(
        verbose_name="期日",
        null=True,
        blank=True,
        db_index=True,
    )

    assigned_to_name = models.CharField(
        verbose_name="To",
        max_length=50,
        blank=True,
        default="",
    )

    related_document_before = models.TextField(
        verbose_name="関連資料1",
        blank=True,
        default="",
    )

    card_reference = models.TextField(
        verbose_name="カードNo・参照先",
        blank=True,
        default="",
    )

    completion_status = models.CharField(
        verbose_name="完了フラグ",
        max_length=16,
        choices=CompletionStatus.choices,
        blank=True,
        default="",
        db_index=True,
    )

    # ----------------------------
    # 実施結果
    # ----------------------------

    action_text = models.TextField(
        verbose_name="実施内容",
        blank=True,
        default="",
    )

    actual_work_minutes = models.PositiveIntegerField(
        verbose_name="実施工数・分",
        null=True,
        blank=True,
    )

    work_reflection = models.TextField(
        verbose_name="作業の振り返り",
        blank=True,
        default="",
    )

    # ----------------------------
    # 安全情報
    # ----------------------------

    injury_state = models.TextField(
        verbose_name="ケガの状態",
        blank=True,
        default="",
    )

    injury_cause = models.TextField(
        verbose_name="ケガの要因",
        blank=True,
        default="",
    )

    unsafe_condition = models.TextField(
        verbose_name="不安全状態",
        blank=True,
        default="",
    )

    unsafe_action = models.TextField(
        verbose_name="不安全行動",
        blank=True,
        default="",
    )

    ky_risk_identification = models.TextField(
        verbose_name="洗い出しKY",
        blank=True,
        default="",
    )

    safety_measure_1 = models.TextField(
        verbose_name="安全対策1",
        blank=True,
        default="",
    )

    safety_measure_2 = models.TextField(
        verbose_name="安全対策2",
        blank=True,
        default="",
    )

    safety_measure_3 = models.TextField(
        verbose_name="安全対策3",
        blank=True,
        default="",
    )

    pointing_call = models.TextField(
        verbose_name="指差呼称",
        blank=True,
        default="",
    )

    priority_risk_point = models.PositiveSmallIntegerField(
        verbose_name="重点危険ポイント",
        null=True,
        blank=True,
        validators=[
            MinValueValidator(1),
            MaxValueValidator(4),
        ],
    )

    nine_word_flags = models.JSONField(
        verbose_name="9ワード",
        default=list,
        blank=True,
    )

    # ----------------------------
    # 関連資料・交換部品
    # ----------------------------

    related_document_after = models.TextField(
        verbose_name="実施後関連資料",
        blank=True,
        default="",
    )

    replacement_part_1 = models.CharField(
        verbose_name="交換部品1",
        max_length=150,
        blank=True,
        default="",
    )

    replacement_part_2 = models.CharField(
        verbose_name="交換部品2",
        max_length=150,
        blank=True,
        default="",
    )

    # ----------------------------
    # 動作・品質確認
    # CSVに空白が存在するためNULLを許可
    # ----------------------------

    standalone_operation_ok = models.BooleanField(
        verbose_name="単体動作",
        null=True,
        blank=True,
    )

    interlocked_operation_ok = models.BooleanField(
        verbose_name="連動動作",
        null=True,
        blank=True,
    )

    quality_ok = models.BooleanField(
        verbose_name="品質",
        null=True,
        blank=True,
    )

    # ----------------------------
    # 完了情報
    # ----------------------------

    completed_date = models.DateField(
        verbose_name="完了日",
        null=True,
        blank=True,
        db_index=True,
    )

    completed_hour = models.PositiveSmallIntegerField(
        verbose_name="完了時",
        null=True,
        blank=True,
        validators=[
            MinValueValidator(0),
            MaxValueValidator(23),
        ],
    )

    completed_minute = models.PositiveSmallIntegerField(
        verbose_name="完了分",
        null=True,
        blank=True,
        validators=[
            MinValueValidator(0),
            MaxValueValidator(59),
        ],
    )

    actual_person_count = models.PositiveSmallIntegerField(
        verbose_name="実施人数",
        null=True,
        blank=True,
    )

    # ----------------------------
    # 承認者・責任者スナップショット
    # ----------------------------

    issuing_team_leader_name = models.CharField(
        verbose_name="発行班長",
        max_length=50,
        blank=True,
        default="",
    )

    a_team_leader_name = models.CharField(
        verbose_name="A班長",
        max_length=50,
        blank=True,
        default="",
    )

    b_team_leader_name = models.CharField(
        verbose_name="B班長",
        max_length=50,
        blank=True,
        default="",
    )

    c_team_leader_name = models.CharField(
        verbose_name="C班長",
        max_length=50,
        blank=True,
        default="",
    )

    group_leader_name = models.CharField(
        verbose_name="組長",
        max_length=50,
        blank=True,
        default="",
    )

    # ----------------------------
    # DB管理情報
    # ----------------------------

    imported_at = models.DateTimeField(
        verbose_name="取込日時",
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        verbose_name="更新日時",
        auto_now=True,
    )

    class Meta:
        db_table = "instruction_card"
        verbose_name = "指示カード"
        verbose_name_plural = "指示カード"
        ordering = (
            "-issued_date",
            "-id",
        )
        indexes = [
            models.Index(
                fields=[
                    "equipment_map",
                    "issued_date",
                ],
                name="inst_card_eqmap_date_idx",
            ),
            models.Index(
                fields=[
                    "maintenance_type",
                    "completion_status",
                ],
                name="inst_card_type_stat_idx",
            ),
            models.Index(
                fields=[
                    "process_name",
                    "equipment_name",
                ],
                name="inst_card_proc_eq_idx",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "source_file_name",
                    "source_row_number",
                ],
                name="inst_card_source_row_uq",
            ),
            models.CheckConstraint(
                check=(
                    Q(completed_hour__isnull=True)
                    | (
                        Q(completed_hour__gte=0)
                        & Q(completed_hour__lte=23)
                    )
                ),
                name="inst_card_hour_ck",
            ),
            models.CheckConstraint(
                check=(
                    Q(completed_minute__isnull=True)
                    | (
                        Q(completed_minute__gte=0)
                        & Q(completed_minute__lte=59)
                    )
                ),
                name="inst_card_minute_ck",
            ),
            models.CheckConstraint(
                check=(
                    Q(priority_risk_point__isnull=True)
                    | (
                        Q(priority_risk_point__gte=1)
                        & Q(priority_risk_point__lte=4)
                    )
                ),
                name="inst_card_risk_point_ck",
            ),
        ]

    def clean(self):
        super().clean()

        if self.nine_word_flags:
            if (
                not isinstance(self.nine_word_flags, list)
                or len(self.nine_word_flags) != 9
                or not all(
                    isinstance(value, bool)
                    for value in self.nine_word_flags
                )
            ):
                raise ValidationError({
                    "nine_word_flags":
                        "9ワードはTrue/Falseを9個持つ配列で登録してください。"
                })

        if (
            self.equipment_map_id
            and self.equipment_name
            and self.equipment_map.equipment_name
            != self.equipment_name
        ):
            raise ValidationError({
                "equipment_map":
                    "設備名と設備名マップの設備名が一致していません。"
            })

    @property
    def equipment_group(self):
        """
        設備名マップに紐づく設備グループを返す。
        未紐づけの場合はNone。
        """
        if not self.equipment_map:
            return None

        return self.equipment_map.equipment_group

    @property
    def completed_time_display(self):
        """
        完了時刻をHH:MM形式で返す。
        時または分が未設定の場合は空文字を返す。
        """
        if (
            self.completed_hour is None
            or self.completed_minute is None
        ):
            return ""

        return (
            f"{self.completed_hour:02d}:"
            f"{self.completed_minute:02d}"
        )

    def __str__(self):
        card_label = self.legacy_id or f"DB-{self.id}"

        return (
            f"[{card_label}] "
            f"{self.equipment_name} - "
            f"{self.work_name}"
        )

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
    required_person_count = models.PositiveSmallIntegerField(
        'required_person_count',
        default=1,
        validators=[MinValueValidator(1)],
    )
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
            models.CheckConstraint(
                check=Q(anchor_month__isnull=True) | (Q(anchor_month__gte=1) & Q(anchor_month__lte=12)),
                name="check_tb_anchor_month_null_or_1_12",
            ),
            models.CheckConstraint(
                check=Q(anchor_year__isnull=True) | Q(anchor_year__gte=1),
                name="check_tb_anchor_year_null_or_gte_1",
            ),
            models.CheckConstraint(
                check=Q(week_of_month__isnull=True) | Q(week_of_month__in=[1, 2, 3, 4, 6]),
                name="check_tb_week_of_month_null_or_valid",
            ),
            models.CheckConstraint(
                check=Q(day_of_week__isnull=True) | Q(day_of_week__in=[0, 1, 2, 3, 4, 5, 6]),
                name="check_tb_day_of_week_null_or_0_6",
            ),
            models.CheckConstraint(
                check=Q(required_person_count__gte=1),
                name="check_tb_required_person_count_gte_1",
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
        choices=DbDetailStatus.choices,
        default=DbDetailStatus.NORMAL,
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
    planned_affilation = models.ForeignKey(
        to=Affilation_tb,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="planned_plans",
    )#計画作成時点の担当班
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

class InspectionStandardHistory(models.Model):
    """
    点検基準書の変更履歴ヘッダー。
    1回のユーザー操作を1件として保存する。
    """

    id = models.BigAutoField(primary_key=True)

    event_id = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
    )

    source = models.CharField(
        max_length=32,
        choices=InspectionStandardHistorySource.choices,
    )

    summary = models.CharField(
        max_length=200,
        blank=True,
        default='',
    )

    control = models.ForeignKey(
        Control_tb,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inspection_standard_histories',
    )

    control_no_snapshot = models.CharField(
        max_length=20,
        blank=True,
        default='',
    )

    machine_snapshot = models.CharField(
        max_length=40,
        blank=True,
        default='',
    )

    inspection_check = models.ForeignKey(
        Check_tb,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inspection_standard_histories',
    )

    inspection_no_snapshot = models.CharField(
        max_length=20,
        blank=True,
        default='',
    )

    operated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inspection_standard_histories',
    )

    operated_by_member_id_snapshot = models.CharField(
        max_length=10,
        blank=True,
        default='',
    )

    operated_by_name_snapshot = models.CharField(
        max_length=20,
        blank=True,
        default='',
    )

    operated_at = models.DateTimeField(
        default=timezone.now,
    )

    note = models.CharField(
        max_length=300,
        blank=True,
        default='',
    )

    team_leader_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='team_leader_approved_inspection_standard_histories',
        db_column='team_leader_appr_by_id',
    )

    team_leader_approved_by_member_id_snapshot = models.CharField(
        max_length=10,
        blank=True,
        default='',
        db_column='team_leader_appr_member_id',
    )

    team_leader_approved_by_name_snapshot = models.CharField(
        max_length=20,
        blank=True,
        default='',
        db_column='team_leader_appr_name',
    )

    team_leader_approved_at = models.DateTimeField(
        null=True,
        blank=True,
        db_column='team_leader_appr_at',
    )

    leader_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='leader_approved_inspection_standard_histories',
        db_column='leader_appr_by_id',
    )

    leader_approved_by_member_id_snapshot = models.CharField(
        max_length=10,
        blank=True,
        default='',
        db_column='leader_appr_member_id',
    )

    leader_approved_by_name_snapshot = models.CharField(
        max_length=20,
        blank=True,
        default='',
        db_column='leader_appr_name',
    )

    leader_approved_at = models.DateTimeField(
        null=True,
        blank=True,
        db_column='leader_appr_at',
    )

    foreman_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='foreman_approved_inspection_standard_histories',
        db_column='foreman_appr_by_id',
    )

    foreman_approved_by_member_id_snapshot = models.CharField(
        max_length=10,
        blank=True,
        default='',
        db_column='foreman_appr_member_id',
    )

    foreman_approved_by_name_snapshot = models.CharField(
        max_length=20,
        blank=True,
        default='',
        db_column='foreman_appr_name',
    )

    foreman_approved_at = models.DateTimeField(
        null=True,
        blank=True,
        db_column='foreman_appr_at',
    )

    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cancelled_inspection_standard_histories',
        db_column='cancelled_by_id',
    )

    cancelled_by_member_id_snapshot = models.CharField(
        max_length=10,
        blank=True,
        default='',
        db_column='cancelled_member_id',
    )

    cancelled_by_name_snapshot = models.CharField(
        max_length=20,
        blank=True,
        default='',
        db_column='cancelled_name',
    )

    cancelled_at = models.DateTimeField(
        null=True,
        blank=True,
        db_column='cancelled_at',
    )

    class Meta:
        db_table = 'inspection_standard_history'
        indexes = [
            models.Index(
                fields=['operated_at'],
                name='ish_at_idx',
            ),
            models.Index(
                fields=['source', 'operated_at'],
                name='ish_src_at_idx',
            ),
            models.Index(
                fields=['control_no_snapshot', 'operated_at'],
                name='ish_ctrl_at_idx',
            ),
            models.Index(
                fields=['inspection_no_snapshot', 'operated_at'],
                name='ish_no_at_idx',
            ),
            models.Index(
                fields=['team_leader_approved_at'],
                name='ish_team_lead_appr_at_idx',
            ),
            models.Index(
                fields=['leader_approved_at'],
                name='ish_lead_appr_at_idx',
            ),
            models.Index(
                fields=['foreman_approved_at'],
                name='ish_fore_appr_at_idx',
            ),
        ]

    def __str__(self):
        return f'{self.get_source_display()} - {self.inspection_no_snapshot} - {self.operated_at}'

class InspectionStandardHistoryTarget(models.Model):
    """
    点検基準書の変更履歴対象。

    1回の履歴操作で影響を受けた対象を保存する。
    """

    id = models.BigAutoField(primary_key=True)

    history = models.ForeignKey(
        InspectionStandardHistory,
        on_delete=models.CASCADE,
        related_name='targets',
        db_index=False,
    )

    target_type = models.CharField(
        max_length=16,
        choices=InspectionStandardHistoryTargetType.choices,
    )

    operation = models.CharField(
        max_length=16,
        choices=InspectionStandardHistoryOperation.choices,
    )

    inspection_check = models.ForeignKey(
        Check_tb,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inspection_standard_history_targets',
        db_index=False,
    )

    detail = models.ForeignKey(
        Db_details_tb,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inspection_standard_history_targets',
        db_index=False,
    )

    plan = models.ForeignKey(
        Plan_tb,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inspection_standard_history_targets',
        db_index=False,
    )

    target_pk_snapshot = models.CharField(
        max_length=32,
        blank=True,
        default='',
    )

    label_snapshot = models.CharField(
        max_length=150,
        blank=True,
        default='',
    )

    before_snapshot = models.JSONField(
        default=dict,
        blank=True,
    )

    after_snapshot = models.JSONField(
        default=dict,
        blank=True,
    )

    class Meta:
        db_table = 'inspection_std_hist_target'
        indexes = [
            models.Index(
                fields=['history'],
                name='isht_hist_idx',
            ),
            models.Index(
                fields=['target_type', 'operation'],
                name='isht_type_op_idx',
            ),
            models.Index(
                fields=['target_type', 'target_pk_snapshot'],
                name='isht_type_pk_idx',
            ),
        ]

    def __str__(self):
        return f'{self.get_target_type_display()} - {self.get_operation_display()}'

class InspectionStandardHistoryFieldChange(models.Model):
    """
    点検基準書のフィールド単位変更履歴。

    例:
      - wark_name: 変更前A → 変更後B
      - status: 通常 → 廃止
      - inspection_man_hours: 3 → 5
    """

    id = models.BigAutoField(primary_key=True)

    target = models.ForeignKey(
        InspectionStandardHistoryTarget,
        on_delete=models.CASCADE,
        related_name='field_changes',
        db_index=False,
    )

    field_name = models.CharField(
        max_length=64,
    )

    field_label = models.CharField(
        max_length=64,
        blank=True,
        default='',
    )

    before_value = models.TextField(
        blank=True,
        default='',
    )

    after_value = models.TextField(
        blank=True,
        default='',
    )

    before_display = models.CharField(
        max_length=255,
        blank=True,
        default='',
    )

    after_display = models.CharField(
        max_length=255,
        blank=True,
        default='',
    )

    class Meta:
        db_table = 'inspection_std_hist_field'
        indexes = [
            models.Index(
                fields=['target'],
                name='ishf_target_idx',
            ),
            models.Index(
                fields=['field_name'],
                name='ishf_field_idx',
            ),
        ]

    def __str__(self):
        return f'{self.field_name}: {self.before_display} -> {self.after_display}'



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
    status = models.CharField(
        'status',
        max_length=20,
        choices=PlanStatus.choices,
        default=PlanStatus.WAITING,
    )
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


class PartsRackLocation_tb(models.Model):
    """
    部品棚Noと保管場所の対応マスタ。

    MARPから取得した棚番に対し、
    RACK_NOの最長前方一致で保管場所を判定する。
    """

    id = models.BigAutoField(
        primary_key=True,
        db_column="ID",
    )

    rack_no = models.CharField(
        verbose_name="棚No",
        max_length=20,
        unique=True,
        db_column="RACK_NO",
    )

    location_name = models.CharField(
        verbose_name="保管場所",
        max_length=200,
        db_column="LOCATION_NAME",
    )

    location_note = models.CharField(
        verbose_name="補足",
        max_length=300,
        blank=True,
        default="",
        db_column="LOCATION_NOTE",
    )

    is_active = models.BooleanField(
        verbose_name="使用中",
        default=True,
        db_column="IS_ACTIVE",
    )

    display_order = models.PositiveIntegerField(
        verbose_name="表示順",
        default=0,
        db_column="DISPLAY_ORDER",
    )

    created_at = models.DateTimeField(
        verbose_name="登録日時",
        auto_now_add=True,
        db_column="CREATED_AT",
    )

    updated_at = models.DateTimeField(
        verbose_name="更新日時",
        auto_now=True,
        db_column="UPDATED_AT",
    )

    class Meta:
        db_table = "PARTS_RACK_LOCATION"
        verbose_name = "部品棚保管場所"
        verbose_name_plural = "部品棚保管場所"
        ordering = (
            "display_order",
            "rack_no",
        )

    def __str__(self) -> str:
        return (
            f"{self.rack_no}："
            f"{self.location_name}"
        )