"""Print a bounded local preview, never send records to a Host or index."""
from __future__ import annotations

import json

from django.core.management.base import BaseCommand, CommandError

from myapp.domain.instruction_card_source import encode_source
from myapp.services.instruction_card_source import build_instruction_card_source_page


class Command(BaseCommand):
    help = "Preview local draft InstructionCard RAG documents (no ingestion)."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=2)
        parser.add_argument("--after-id", type=int, default=0)
        parser.add_argument("--through-id", type=int)
        parser.add_argument("--instruction-card-id", type=int)
        parser.add_argument("--show-text", action="store_true")

    def handle(self, *args, **options):
        if options["show_text"] and options["instruction_card_id"] is None:
            raise CommandError("--show-text requires one explicit --instruction-card-id")
        try:
            page = build_instruction_card_source_page(
                after_id=options["after_id"], through_id=options["through_id"],
                limit=options["limit"], instruction_card_id=options["instruction_card_id"],
            )
        except Exception:
            raise CommandError("Source preview failed; check arguments and Oracle availability. No page is complete.") from None
        records = []
        for item in page["records"]:
            document = item["document"]
            metadata = document["metadata"]
            preview = {
                "source_record_id": document["source_record_id"],
                "equipment_name": metadata["equipment_name"],
                "issued_date": metadata["issued_date"], "completed_date": metadata["completed_date"],
                "document_bytes": len(encode_source(document)), "text_chars": len(document["text"]),
                "change_state": item["change_state"], "metadata_keys": sorted(metadata),
                "truncated_fields": document["truncated_fields"],
            }
            if options["show_text"]:
                preview["text"] = document["text"]
            records.append(preview)
        self.stdout.write(json.dumps({**{k: v for k, v in page.items() if k != "records"},
                                     "count": len(records), "records": records}, ensure_ascii=True))
