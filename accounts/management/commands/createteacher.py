"""Create the teacher account (it can also open the admin area)."""
import getpass

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Create a teacher account."

    def add_arguments(self, parser):
        parser.add_argument("--email")
        parser.add_argument("--name")
        parser.add_argument("--password", help="Only for scripts. Leave out to be asked safely.")

    def handle(self, *args, email=None, name=None, password=None, **options):
        User = get_user_model()
        email = (email or input("Email: ")).strip().lower()
        name = (name or input("Your name: ")).strip()
        if not email or not name:
            raise CommandError("Email and name are required.")
        if User.objects.filter(email=email).exists():
            raise CommandError(f"An account with {email} already exists.")
        if password is None:
            password = getpass.getpass("Password: ")
            if password != getpass.getpass("Password again: "):
                raise CommandError("The passwords don't match.")
        try:
            validate_password(password, User(email=email, full_name=name))
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages))
        User.objects.create_superuser(email=email, password=password, full_name=name)
        self.stdout.write(self.style.SUCCESS(f"Teacher account created for {email}."))
