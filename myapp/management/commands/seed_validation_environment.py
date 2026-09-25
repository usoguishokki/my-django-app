"""Explicit synthetic initialization; no production data source."""
from datetime import date
import json

from django.core.management.base import BaseCommand, CommandError

from myapp.services.validation_dataset import run_dataset


class Command(BaseCommand):
    help = "Seed the empty validation business tables. Stop the validation server first."
    requires_system_checks = []
    reset = False

    def add_arguments(self, parser):
        parser.add_argument("--anchor-date", required=True, type=date.fromisoformat)

    def handle(self, *args, **options):
        try:
            result = run_dataset(anchor=options["anchor_date"], reset=self.reset,
                                 confirmed=options.get("confirm_validation_reset", False))
        except CommandError:
            raise
        except Exception:
            # Driver exceptions may include credentials or bound password hashes.
            raise CommandError("Validation dataset failed; no fallback attempted. Stop and inspect validation state before retrying; driver/commit failures require human review.") from None
        self.stdout.write(json.dumps(result, ensure_ascii=True, indent=2))
        self.stdout.write("Synthetic baseline committed. Restart the local validation server to discard cached data.")
