# myapp/services/csv_download/streaming_csv_builder.py
from __future__ import annotations

import csv

from django.http import StreamingHttpResponse

from myapp.services.csv_download.constants import CSV_HEADER


class Echo:
    """
    csv.writer が write() した値をそのまま返すための疑似バッファ。
    StreamingHttpResponse でCSVを逐次返すために使う。
    """

    def write(self, value):
        return value


def stream_csv_response(
    *,
    rows,
    filename: str,
) -> StreamingHttpResponse:
    pseudo_buffer = Echo()
    writer = csv.writer(pseudo_buffer)

    def row_iter():
        # Excelで日本語CSVを開いたときの文字化け対策
        yield "\ufeff"
        yield writer.writerow(CSV_HEADER)

        for row in rows:
            yield writer.writerow(row)

    response = StreamingHttpResponse(
        row_iter(),
        content_type="text/csv; charset=utf-8",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'

    return response