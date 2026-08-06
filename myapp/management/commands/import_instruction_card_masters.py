from __future__ import annotations

import csv
import io
import zipfile
from pathlib import Path
from typing import Dict, List, Tuple

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from myapp.models import (
    Control_tb,
    EquipmentGroup,
    EquipmentGroupMember,
    InstructionCardEquipmentMap,
)


class Command(BaseCommand):
    help = (
        "指示カード関連の設備マスターをZIP内のCSVから一括登録します。"
    )

    GROUP_FILE = "equipment_group.csv"
    MEMBER_FILE = "equipment_group_member.csv"
    MAP_FILE = "instruction_card_equipment_map.csv"

    def add_arguments(self, parser):
        parser.add_argument(
            "--zip",
            dest="zip_path",
            required=True,
            help="指示カードZIPファイルのパス",
        )

        parser.add_argument(
            "--dry-run",
            action="store_true",
            help=(
                "検証と登録処理を実行しますが、"
                "最後にロールバックします。"
            ),
        )

    def handle(self, *args, **options):
        zip_path = Path(options["zip_path"])
        dry_run = options["dry_run"]

        if not zip_path.exists():
            raise CommandError(
                f"ZIPファイルが存在しません: {zip_path}"
            )

        if not zip_path.is_file():
            raise CommandError(
                f"ファイルではありません: {zip_path}"
            )

        try:
            csv_data = self._read_zip_csv_files(zip_path)
        except zipfile.BadZipFile as exc:
            raise CommandError(
                f"正しいZIPファイルではありません: {zip_path}"
            ) from exc

        group_rows = csv_data[self.GROUP_FILE]
        member_rows = csv_data[self.MEMBER_FILE]
        map_rows = csv_data[self.MAP_FILE]

        self._validate_group_rows(group_rows)
        self._validate_member_rows(
            member_rows=member_rows,
            group_rows=group_rows,
        )
        self._validate_map_rows(
            map_rows=map_rows,
            group_rows=group_rows,
        )

        self.stdout.write(
            self.style.SUCCESS(
                "CSV事前検証に成功しました。"
            )
        )

        with transaction.atomic():
            group_result = self._import_groups(group_rows)
            member_result = self._import_members(member_rows)
            map_result = self._import_equipment_maps(map_rows)

            self.stdout.write("")
            self.stdout.write("【登録結果】")
            self._print_result(
                "EquipmentGroup",
                group_result,
            )
            self._print_result(
                "EquipmentGroupMember",
                member_result,
            )
            self._print_result(
                "InstructionCardEquipmentMap",
                map_result,
            )

            if dry_run:
                transaction.set_rollback(True)

                self.stdout.write("")
                self.stdout.write(
                    self.style.WARNING(
                        "dry-runのため、すべてロールバックしました。"
                    )
                )
            else:
                self.stdout.write("")
                self.stdout.write(
                    self.style.SUCCESS(
                        "指示カード設備マスターの登録が完了しました。"
                    )
                )

    def _read_zip_csv_files(
        self,
        zip_path: Path,
    ) -> Dict[str, List[dict]]:
        """
        ZIP内のフォルダー名にかかわらず、
        CSVのファイル名で対象を特定する。
        """
        target_files = {
            self.GROUP_FILE,
            self.MEMBER_FILE,
            self.MAP_FILE,
        }

        result: Dict[str, List[dict]] = {}

        with zipfile.ZipFile(zip_path, "r") as archive:
            files_by_name = {}

            for archive_name in archive.namelist():
                basename = Path(archive_name).name

                if basename in target_files:
                    if basename in files_by_name:
                        raise CommandError(
                            f"ZIP内に同名ファイルが複数あります: "
                            f"{basename}"
                        )

                    files_by_name[basename] = archive_name

            missing_files = target_files - set(files_by_name)

            if missing_files:
                raise CommandError(
                    "ZIP内に必要なCSVがありません: "
                    + ", ".join(sorted(missing_files))
                )

            for basename, archive_name in files_by_name.items():
                raw_data = archive.read(archive_name)
                result[basename] = self._parse_csv(
                    raw_data=raw_data,
                    filename=basename,
                )

        return result

    def _parse_csv(
        self,
        raw_data: bytes,
        filename: str,
    ) -> List[dict]:
        """
        UTF-8 BOM、UTF-8、CP932の順でCSVを読み込む。
        """
        decoded_text = None
        used_encoding = None

        for encoding in (
            "utf-8-sig",
            "utf-8",
            "cp932",
        ):
            try:
                decoded_text = raw_data.decode(encoding)
                used_encoding = encoding
                break
            except UnicodeDecodeError:
                continue

        if decoded_text is None:
            raise CommandError(
                f"文字コードを判定できません: {filename}"
            )

        reader = csv.DictReader(
            io.StringIO(decoded_text)
        )

        if reader.fieldnames is None:
            raise CommandError(
                f"CSVヘッダーがありません: {filename}"
            )

        rows = []

        for row_number, row in enumerate(
            reader,
            start=2,
        ):
            cleaned_row = {
                str(key).strip(): (
                    str(value).strip()
                    if value is not None
                    else ""
                )
                for key, value in row.items()
                if key is not None
            }

            cleaned_row["_row_number"] = row_number
            rows.append(cleaned_row)

        self.stdout.write(
            f"{filename}: "
            f"{len(rows)}行 "
            f"({used_encoding})"
        )

        return rows

    def _validate_headers(
        self,
        rows: List[dict],
        required_columns: set,
        filename: str,
    ):
        if not rows:
            raise CommandError(
                f"データ行がありません: {filename}"
            )

        actual_columns = (
            set(rows[0].keys()) - {"_row_number"}
        )

        missing_columns = (
            required_columns - actual_columns
        )

        if missing_columns:
            raise CommandError(
                f"{filename}に必要な列がありません: "
                + ", ".join(sorted(missing_columns))
            )

    def _validate_group_rows(
        self,
        rows: List[dict],
    ):
        required_columns = {
            "group_code",
            "group_name",
            "group_type",
            "description",
            "is_active",
        }

        self._validate_headers(
            rows=rows,
            required_columns=required_columns,
            filename=self.GROUP_FILE,
        )

        valid_group_types = {
            value
            for value, _ in EquipmentGroup.GroupType.choices
        }

        seen_group_codes = set()

        for row in rows:
            row_number = row["_row_number"]
            group_code = row["group_code"]
            group_name = row["group_name"]
            group_type = row["group_type"]

            if not group_code:
                raise CommandError(
                    f"{self.GROUP_FILE} "
                    f"{row_number}行目: "
                    "group_codeが空白です。"
                )

            if not group_name:
                raise CommandError(
                    f"{self.GROUP_FILE} "
                    f"{row_number}行目: "
                    "group_nameが空白です。"
                )

            if group_code in seen_group_codes:
                raise CommandError(
                    f"{self.GROUP_FILE} "
                    f"{row_number}行目: "
                    f"group_codeが重複しています: "
                    f"{group_code}"
                )

            seen_group_codes.add(group_code)

            if group_type not in valid_group_types:
                raise CommandError(
                    f"{self.GROUP_FILE} "
                    f"{row_number}行目: "
                    f"未定義のgroup_typeです: "
                    f"{group_type}"
                )

            self._parse_bool(
                row["is_active"],
                filename=self.GROUP_FILE,
                row_number=row_number,
                column_name="is_active",
            )

    def _validate_member_rows(
        self,
        member_rows: List[dict],
        group_rows: List[dict],
    ):
        required_columns = {
            "group_code",
            "control_no",
            "member_role",
            "is_primary",
            "is_active",
        }

        self._validate_headers(
            rows=member_rows,
            required_columns=required_columns,
            filename=self.MEMBER_FILE,
        )

        valid_group_codes = {
            row["group_code"]
            for row in group_rows
        }

        valid_member_roles = {
            value
            for value, _
            in EquipmentGroupMember.MemberRole.choices
        }

        seen_control_nos = set()
        primary_count_by_group: Dict[str, int] = {}

        control_nos = {
            row["control_no"]
            for row in member_rows
            if row["control_no"]
        }

        existing_control_nos = set(
            Control_tb.objects.filter(
                control_no__in=control_nos
            ).values_list(
                "control_no",
                flat=True,
            )
        )

        missing_control_nos = (
            control_nos - existing_control_nos
        )

        if missing_control_nos:
            raise CommandError(
                "Control_tbに存在しないcontrol_noがあります: "
                + ", ".join(sorted(missing_control_nos))
            )

        for row in member_rows:
            row_number = row["_row_number"]
            group_code = row["group_code"]
            control_no = row["control_no"]
            member_role = row["member_role"]

            if group_code not in valid_group_codes:
                raise CommandError(
                    f"{self.MEMBER_FILE} "
                    f"{row_number}行目: "
                    f"存在しないgroup_codeです: "
                    f"{group_code}"
                )

            if not control_no:
                raise CommandError(
                    f"{self.MEMBER_FILE} "
                    f"{row_number}行目: "
                    "control_noが空白です。"
                )

            if control_no in seen_control_nos:
                raise CommandError(
                    f"{self.MEMBER_FILE} "
                    f"{row_number}行目: "
                    f"control_noが重複しています: "
                    f"{control_no}"
                )

            seen_control_nos.add(control_no)

            if member_role not in valid_member_roles:
                raise CommandError(
                    f"{self.MEMBER_FILE} "
                    f"{row_number}行目: "
                    f"未定義のmember_roleです: "
                    f"{member_role}"
                )

            is_primary = self._parse_bool(
                row["is_primary"],
                filename=self.MEMBER_FILE,
                row_number=row_number,
                column_name="is_primary",
            )

            is_active = self._parse_bool(
                row["is_active"],
                filename=self.MEMBER_FILE,
                row_number=row_number,
                column_name="is_active",
            )

            if is_primary and not is_active:
                raise CommandError(
                    f"{self.MEMBER_FILE} "
                    f"{row_number}行目: "
                    "無効な設備を代表設備にはできません。"
                )

            if is_primary:
                primary_count_by_group[group_code] = (
                    primary_count_by_group.get(
                        group_code,
                        0,
                    )
                    + 1
                )

        duplicate_primary_groups = [
            group_code
            for group_code, count
            in primary_count_by_group.items()
            if count > 1
        ]

        if duplicate_primary_groups:
            raise CommandError(
                "代表設備が複数設定されたグループがあります: "
                + ", ".join(
                    sorted(duplicate_primary_groups)
                )
            )

    def _validate_map_rows(
        self,
        map_rows: List[dict],
        group_rows: List[dict],
    ):
        required_columns = {
            "設備名",
            "group_code",
        }

        self._validate_headers(
            rows=map_rows,
            required_columns=required_columns,
            filename=self.MAP_FILE,
        )

        valid_group_codes = {
            row["group_code"]
            for row in group_rows
        }

        seen_equipment_names = set()

        for row in map_rows:
            row_number = row["_row_number"]
            equipment_name = row["設備名"]
            group_code = row["group_code"]

            if not equipment_name:
                raise CommandError(
                    f"{self.MAP_FILE} "
                    f"{row_number}行目: "
                    "設備名が空白です。"
                )

            if equipment_name in seen_equipment_names:
                raise CommandError(
                    f"{self.MAP_FILE} "
                    f"{row_number}行目: "
                    f"設備名が重複しています: "
                    f"{equipment_name}"
                )

            seen_equipment_names.add(equipment_name)

            if (
                group_code
                and group_code not in valid_group_codes
            ):
                raise CommandError(
                    f"{self.MAP_FILE} "
                    f"{row_number}行目: "
                    f"存在しないgroup_codeです: "
                    f"{group_code}"
                )

    def _import_groups(
        self,
        rows: List[dict],
    ) -> Tuple[int, int]:
        created_count = 0
        updated_count = 0

        for row in rows:
            group_code = row["group_code"]

            instance, created = (
                EquipmentGroup.objects.get_or_create(
                    group_code=group_code,
                )
            )

            instance.group_name = row["group_name"]
            instance.group_type = row["group_type"]
            instance.description = row["description"]
            instance.is_active = self._parse_bool(
                row["is_active"],
                filename=self.GROUP_FILE,
                row_number=row["_row_number"],
                column_name="is_active",
            )

            instance.full_clean()
            instance.save()

            if created:
                created_count += 1
            else:
                updated_count += 1

        return created_count, updated_count

    def _import_members(
        self,
        rows: List[dict],
    ) -> Tuple[int, int]:
        created_count = 0
        updated_count = 0

        group_by_code = {
            group.group_code: group
            for group in EquipmentGroup.objects.all()
        }

        control_by_no = {
            control.control_no: control
            for control in Control_tb.objects.filter(
                control_no__in={
                    row["control_no"]
                    for row in rows
                }
            )
        }

        for row in rows:
            control = control_by_no[row["control_no"]]
            equipment_group = group_by_code[
                row["group_code"]
            ]

            instance, created = (
                EquipmentGroupMember.objects.get_or_create(
                    control=control,
                    defaults={
                        "equipment_group": equipment_group,
                        "member_role": row["member_role"],
                    },
                )
            )

            instance.equipment_group = equipment_group
            instance.member_role = row["member_role"]
            instance.is_primary = self._parse_bool(
                row["is_primary"],
                filename=self.MEMBER_FILE,
                row_number=row["_row_number"],
                column_name="is_primary",
            )
            instance.is_active = self._parse_bool(
                row["is_active"],
                filename=self.MEMBER_FILE,
                row_number=row["_row_number"],
                column_name="is_active",
            )

            instance.full_clean()
            instance.save()

            if created:
                created_count += 1
            else:
                updated_count += 1

        return created_count, updated_count

    def _import_equipment_maps(
        self,
        rows: List[dict],
    ) -> Tuple[int, int]:
        created_count = 0
        updated_count = 0

        group_by_code = {
            group.group_code: group
            for group in EquipmentGroup.objects.all()
        }

        for row in rows:
            equipment_name = row["設備名"]
            group_code = row["group_code"]

            equipment_group = (
                group_by_code[group_code]
                if group_code
                else None
            )

            instance, created = (
                InstructionCardEquipmentMap.objects
                .get_or_create(
                    equipment_name=equipment_name,
                )
            )

            instance.equipment_group = equipment_group
            instance.full_clean()
            instance.save()

            if created:
                created_count += 1
            else:
                updated_count += 1

        return created_count, updated_count

    def _parse_bool(
        self,
        value: str,
        filename: str,
        row_number: int,
        column_name: str,
    ) -> bool:
        normalized = str(value).strip().lower()

        true_values = {
            "1",
            "true",
            "yes",
            "y",
            "on",
        }

        false_values = {
            "0",
            "false",
            "no",
            "n",
            "off",
        }

        if normalized in true_values:
            return True

        if normalized in false_values:
            return False

        raise CommandError(
            f"{filename} "
            f"{row_number}行目: "
            f"{column_name}の値が不正です: "
            f"{value}"
        )

    def _print_result(
        self,
        model_name: str,
        result: Tuple[int, int],
    ):
        created_count, updated_count = result

        self.stdout.write(
            f"{model_name}: "
            f"新規={created_count}件 / "
            f"更新={updated_count}件"
        )