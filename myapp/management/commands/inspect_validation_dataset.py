"""Read-only inventory for Human Review; no secret or personal data output."""
import json

from django.core.management.base import BaseCommand, CommandError

from myapp import models as m
from myapp.services.validation_dataset import RESET_MODELS, verify_dataset_database


class Command(BaseCommand):
    help = "Verify validation identity/readiness and list synthetic scenario Plans (SELECT only)."
    requires_system_checks = []

    def handle(self, *args, **options):
        try:
            verify_dataset_database()
            result = {
                "counts": {model.__name__: model.objects.count() for model in RESET_MODELS},
                "worker_view_rows": m.Shift_pattern_worker_view.objects.count(),
                "plans": list(m.Plan_tb.objects.filter(inspection_no__inspection_no__startswith="VAL-")
                    .order_by("inspection_no__inspection_no", "p_date__h_date", "plan_id")
                    .values("plan_id", "inspection_no__inspection_no", "p_date__h_date",
                            "planned_affilation_id", "planned_affilation__affilation", "status", "plan_time")),
            }
        except CommandError:
            raise
        except Exception:
            raise CommandError("Validation inventory failed; no fallback attempted.") from None
        self.stdout.write(json.dumps(result, default=str, ensure_ascii=True, indent=2))
