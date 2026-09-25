from myapp.management.commands.seed_validation_environment import Command as SeedCommand


class Command(SeedCommand):
    help = "Delete reviewed synthetic validation data and reseed atomically. Stop the server first."
    reset = True

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument("--confirm-validation-reset", action="store_true")
