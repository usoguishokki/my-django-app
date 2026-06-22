from __future__ import annotations

from typing import Optional

from myapp.models import Control_tb


def control_base_qs():
    """
    Control_tb の共通取得条件。
    Control に紐づくライン・組織を参照する画面で再利用する。
    """

    return Control_tb.objects.select_related(
        'line_name',
        'line_name__organization',
    )


def select_controls_by_organization(*, organization_code: str):
    """
    組織コードに紐づく Control 一覧を取得する。
    """

    return control_base_qs().filter(
        line_name__organization__organization=organization_code
    )


def get_controls_for_inspection_standard_machine_options(
    *,
    organization_code: Optional[str] = None,
):
    """
    点検基準書画面の設備名・管理番号 select 用データを取得する。

    既存テンプレートでは c.machine / c.control_no で参照しているが、
    Django template は dict のキーもドット記法で参照できるため、
    values() の結果でも利用可能。
    """

    if organization_code:
        qs = select_controls_by_organization(
            organization_code=organization_code,
        )
    else:
        qs = control_base_qs()

    return list(
        qs.exclude(machine__isnull=True)
        .exclude(machine__exact='')
        .values('control_no', 'machine')
        .order_by('machine', 'control_no')
    )


def select_control_for_inspection_standard_filter(*, filter_data):
    """
    点検基準書画面で選択された設備条件に一致する Control を1件取得する。
    """

    return (
        control_base_qs()
        .filter(**filter_data)
        .order_by('control_no')
        .first()
    )
    

def select_control_for_update_by_control_no(*, control_no: str):
    """
    カード追加時、管理番号単位で採番を直列化するために Control_tb をロックする。

    注意:
      - 採番衝突防止が目的なので、Control_tb 本体だけを取得・ロックする
      - control_base_qs() は select_related() を含むため使わない
    """

    normalized_control_no = str(control_no or '').strip()

    if not normalized_control_no:
        return None

    try:
        return (
            Control_tb.objects
            .select_for_update()
            .get(control_no=normalized_control_no)
        )
    except Control_tb.DoesNotExist:
        return None