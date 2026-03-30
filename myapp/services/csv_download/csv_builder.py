# myapp/services/csv_download/csv_builder.py
from __future__ import annotations

import csv
import io
from django.http import HttpResponse

from myapp.services.csv_download.constants import CSV_HEADER


def build_csv_response(*, rows: list[list], filename: str) -> HttpResponse:
    """
    CSVレスポンスを返す
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    writer.writerow(CSV_HEADER)
    writer.writerows(rows)

    response = HttpResponse(
        buffer.getvalue(),
        content_type="text/csv; charset=utf-8-sig",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response