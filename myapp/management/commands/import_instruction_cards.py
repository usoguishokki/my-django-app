from __future__ import annotations

import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from myapp.models import (
    InstructionCard,
    InstructionCardEquipmentMap,
)


class Command(BaseCommand):
    help = "PLUS ULTRAの指示カードCSVをInstructionCardへ登録します。"

    REQUIRED_COLUMNS = {
        "id",
        "発行日",
        "From",
        "工程名",
        "設備名",
        "保全区分",
        "作業名",
        "人数",
        "工数",
        "依頼内容",
        "期日",
        "To",
        "関連資料1",
        "カードNo",
        "完了フラグ",
        "実施内容",
        "実施工数",
        "作業の振り返り",
        "ケガの状態",
        "ケガの要因",
        "不安全状態",
        "不安全行動",
        "洗い出しKY",
        "安全対策1",
        "安全対策2",
        "安全対策3",
        "指差呼称",
        "実施後関連資料",
        "交換部品1",
        "交換部品2",
        "単体動作",
        "連動動作",
        "品質",
        "重点危険ポイント",
        "完了日",
        "時",
        "分",
        "実施人数",
        "発行班長",
        "A班長",
        "B班長",
        "C班長",
        "組長",
        "9ワード",
    }

    def add_arguments(self, parser):
        parser.add_argument(
            "--csv",
            dest="csv_path",
            required=True,
            help="PLUS ULTRA_Ver8.csvのパス",
        )

        parser.add_argument(
            "--source-name",
            default="PLUS ULTRA_Ver8.csv",
            help=(
                "DBに保存する取込元ファイル名。"
                "再取込時も同じ名前を使用してください。"
            ),
        )

        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="登録処理を検証し、最後にロールバックします。",
        )

    def handle(self, *args, **options):
        csv_path = Path(options["csv_path"])
        source_name = str(options["source_name"]).strip()
        dry_run = options["dry_run"]

        if not csv_path.exists():
            raise CommandError(
                f"CSVファイルが存在しません: {csv_path}"
            )

        if not csv_path.is_file():
            raise CommandError(
                f"ファイルではありません: {csv_path}"
            )

        if not source_name:
            raise CommandError(
                "--source-nameを空白にはできません。"
            )

        rows, encoding = self._read_csv(csv_path)

        self.stdout.write(
            f"CSV読込: {len(rows)}行 ({encoding})"
        )

        equipment_map_by_name = {
            item.equipment_name: item
            for item in (
                InstructionCardEquipmentMap.objects
                .select_related("equipment_group")
                .all()
            )
        }

        created_count = 0
        updated_count = 0
        mapped_count = 0
        unmapped_count = 0
        missing_map_names = set()

        with transaction.atomic():
            for processed_count, row in enumerate(
                rows,
                start=1,
            ):
                csv_row_number = row["_row_number"]
                equipment_name = row["設備名"]

                equipment_map = equipment_map_by_name.get(
                    equipment_name
                )

                if (
                    equipment_map
                    and equipment_map.equipment_group_id
                ):
                    mapped_count += 1
                else:
                    unmapped_count += 1

                    if equipment_name:
                        missing_map_names.add(
                            equipment_name
                        )

                instance = (
                    InstructionCard.objects
                    .filter(
                        source_file_name=source_name,
                        source_row_number=csv_row_number,
                    )
                    .first()
                )

                created = instance is None

                if created:
                    instance = InstructionCard(
                        source_file_name=source_name,
                        source_row_number=csv_row_number,
                    )

                values = self._build_model_values(
                    row=row,
                    equipment_map=equipment_map,
                )

                for field_name, value in values.items():
                    setattr(instance, field_name, value)

                try:
                    instance.full_clean()
                except ValidationError as exc:
                    raise CommandError(
                        f"CSV {csv_row_number}行目で"
                        f"モデル検証エラーが発生しました: "
                        f"{exc.message_dict}"
                    ) from exc

                instance.save()

                if created:
                    created_count += 1
                else:
                    updated_count += 1

                if processed_count % 500 == 0:
                    self.stdout.write(
                        f"{processed_count}件処理済み..."
                    )

            self.stdout.write("")
            self.stdout.write("【登録結果】")
            self.stdout.write(
                f"InstructionCard: "
                f"新規={created_count}件 / "
                f"更新={updated_count}件"
            )
            self.stdout.write(
                f"設備グループ紐づきあり: "
                f"{mapped_count}件"
            )
            self.stdout.write(
                f"設備グループ未紐づき: "
                f"{unmapped_count}件"
            )
            self.stdout.write(
                f"未紐づき設備名種類: "
                f"{len(missing_map_names)}種類"
            )

            if missing_map_names:
                self.stdout.write("")
                self.stdout.write(
                    "【未紐づき設備名】"
                )

                for equipment_name in sorted(
                    missing_map_names
                ):
                    self.stdout.write(
                        f"- {equipment_name}"
                    )

            if dry_run:
                transaction.set_rollback(True)

                self.stdout.write("")
                self.stdout.write(
                    self.style.WARNING(
                        "dry-runのため、"
                        "すべてロールバックしました。"
                    )
                )
            else:
                self.stdout.write("")
                self.stdout.write(
                    self.style.SUCCESS(
                        "指示カードの登録が完了しました。"
                    )
                )

    def _normalize_cell_value(self, value) -> str:
        """
        CSV内の空白相当値を空文字へ統一する。

        pandas等を経由して作成されたCSVでは、
        空白がnanやNaNとして出力される場合がある。
        """
        if value is None:
            return ""

        normalized = str(value).strip()

        if normalized.lower() in {
            "nan",
            "nat",
            "none",
            "null",
        }:
            return ""

        return normalized

    def _read_csv(
        self,
        csv_path: Path,
    ) -> tuple[list[dict], str]:
        decoded_text = None
        used_encoding = None

        raw_data = csv_path.read_bytes()

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

        if decoded_text is None or used_encoding is None:
            raise CommandError(
                "CSVの文字コードを判定できません。"
            )

        reader = csv.DictReader(
            decoded_text.splitlines()
        )

        if reader.fieldnames is None:
            raise CommandError(
                "CSVにヘッダーがありません。"
            )

        actual_columns = {
            str(column).strip()
            for column in reader.fieldnames
            if column is not None
        }

        missing_columns = (
            self.REQUIRED_COLUMNS - actual_columns
        )

        if missing_columns:
            raise CommandError(
                "CSVに必要な列がありません: "
                + ", ".join(sorted(missing_columns))
            )

        rows = []

        for row_number, row in enumerate(
            reader,
            start=2,
        ):
            cleaned_row = {
                str(key).strip(): self._normalize_cell_value(value)
                for key, value in row.items()
                if key is not None
            }

            cleaned_row["_row_number"] = row_number
            rows.append(cleaned_row)

        if not rows:
            raise CommandError(
                "CSVにデータ行がありません。"
            )

        return rows, used_encoding

    def _build_model_values(
        self,
        row: dict,
        equipment_map: InstructionCardEquipmentMap | None,
    ) -> dict:
        row_number = row["_row_number"]

        return {
            "legacy_id": row["id"],
            "issued_date": self._parse_date(
                row["発行日"],
                row_number,
                "発行日",
            ),
            "requested_by_name": row["From"],
            "process_name": row["工程名"],
            "equipment_name": row["設備名"],
            "equipment_map": equipment_map,
            "maintenance_type": row["保全区分"],
            "work_name": row["作業名"],
            "planned_person_count": self._parse_integer(
                row["人数"],
                row_number,
                "人数",
            ),
            "planned_work_minutes": self._parse_integer(
                row["工数"],
                row_number,
                "工数",
            ),
            "request_text": row["依頼内容"],
            "due_date": self._parse_date(
                row["期日"],
                row_number,
                "期日",
            ),
            "assigned_to_name": row["To"],
            "related_document_before": row["関連資料1"],
            "card_reference": row["カードNo"],
            "completion_status": row["完了フラグ"],
            "action_text": row["実施内容"],
            "actual_work_minutes": self._parse_integer(
                row["実施工数"],
                row_number,
                "実施工数",
            ),
            "work_reflection": row["作業の振り返り"],
            "injury_state": row["ケガの状態"],
            "injury_cause": row["ケガの要因"],
            "unsafe_condition": row["不安全状態"],
            "unsafe_action": row["不安全行動"],
            "ky_risk_identification": row["洗い出しKY"],
            "safety_measure_1": row["安全対策1"],
            "safety_measure_2": row["安全対策2"],
            "safety_measure_3": row["安全対策3"],
            "pointing_call": row["指差呼称"],
            "related_document_after": row["実施後関連資料"],
            "replacement_part_1": row["交換部品1"],
            "replacement_part_2": row["交換部品2"],
            "standalone_operation_ok": self._parse_bool(
                row["単体動作"],
                row_number,
                "単体動作",
                allow_blank=True,
            ),
            "interlocked_operation_ok": self._parse_bool(
                row["連動動作"],
                row_number,
                "連動動作",
                allow_blank=True,
            ),
            "quality_ok": self._parse_bool(
                row["品質"],
                row_number,
                "品質",
                allow_blank=True,
            ),
            "priority_risk_point": self._parse_integer(
                row["重点危険ポイント"],
                row_number,
                "重点危険ポイント",
            ),
            "completed_date": self._parse_date(
                row["完了日"],
                row_number,
                "完了日",
            ),
            "completed_hour": self._parse_integer(
                row["時"],
                row_number,
                "時",
            ),
            "completed_minute": self._parse_integer(
                row["分"],
                row_number,
                "分",
            ),
            "actual_person_count": self._parse_integer(
                row["実施人数"],
                row_number,
                "実施人数",
            ),
            "issuing_team_leader_name": row["発行班長"],
            "a_team_leader_name": row["A班長"],
            "b_team_leader_name": row["B班長"],
            "c_team_leader_name": row["C班長"],
            "group_leader_name": row["組長"],
            "nine_word_flags": self._parse_nine_words(
                row["9ワード"],
                row_number,
            ),
        }

    def _parse_date(
        self,
        value: str,
        row_number: int,
        column_name: str,
    ):
        value = str(value).strip()

        if not value:
            return None

        for date_format in (
            "%Y年%m月%d日",
            "%Y/%m/%d",
            "%Y-%m-%d",
        ):
            try:
                return datetime.strptime(
                    value,
                    date_format,
                ).date()
            except ValueError:
                continue

        raise CommandError(
            f"CSV {row_number}行目: "
            f"{column_name}の日付形式が不正です: "
            f"{value}"
        )

    def _parse_integer(
        self,
        value: str,
        row_number: int,
        column_name: str,
    ) -> int | None:
        value = str(value).strip()

        if not value:
            return None

        try:
            decimal_value = Decimal(value)
        except InvalidOperation as exc:
            raise CommandError(
                f"CSV {row_number}行目: "
                f"{column_name}が数値ではありません: "
                f"{value}"
            ) from exc

        if decimal_value != decimal_value.to_integral_value():
            raise CommandError(
                f"CSV {row_number}行目: "
                f"{column_name}が整数ではありません: "
                f"{value}"
            )

        integer_value = int(decimal_value)

        if integer_value < 0:
            raise CommandError(
                f"CSV {row_number}行目: "
                f"{column_name}が負数です: "
                f"{value}"
            )

        return integer_value

    def _parse_bool(
        self,
        value: str,
        row_number: int,
        column_name: str,
        allow_blank: bool = False,
    ) -> bool | None:
        normalized = str(value).strip().lower()

        if not normalized and allow_blank:
            return None

        if normalized in {
            "true",
            "1",
            "yes",
            "y",
            "on",
        }:
            return True

        if normalized in {
            "false",
            "0",
            "no",
            "n",
            "off",
        }:
            return False

        raise CommandError(
            f"CSV {row_number}行目: "
            f"{column_name}の真偽値が不正です: "
            f"{value}"
        )

    def _parse_nine_words(
        self,
        value: str,
        row_number: int,
    ) -> list[bool]:
        value = str(value).strip()

        if not value:
            return []

        raw_values = [
            item.strip()
            for item in value.split(",")
        ]

        if len(raw_values) != 9:
            raise CommandError(
                f"CSV {row_number}行目: "
                f"9ワードが9個ではありません: "
                f"{value}"
            )

        return [
            self._parse_bool(
                item,
                row_number,
                "9ワード",
                allow_blank=False,
            )
            for item in raw_values
        ]