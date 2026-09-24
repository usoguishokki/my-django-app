"""Normal development / IIS settings. Validation has a separate entry point."""
import os
from dotenv import load_dotenv
from .settings_shared import *  # noqa: F403

load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]

DEBUG = os.getenv("DJANGO_DEBUG", "false").strip().lower() in {"1", "true", "yes", "on"}

if DEBUG:
    FRONTEND_URL = "http://localhost:3000"

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ["DJANGO_ALLOWED_HOSTS"].split(",")
    if host.strip()
]

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'DEBUG',
            'class': 'concurrent_log_handler.ConcurrentRotatingFileHandler',
            'filename': r'C:\inetpub\wwwroot\sitefolder\myproject\logs\myapp.log',
            'maxBytes': 1024 * 1024 * 10,  # 10MB
            'backupCount': 100,
            'encoding': 'utf-8',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file'],
            'level': 'INFO',
            'propagate': True,
        },
        'myapp': {
            'handlers': ['file'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.oracle",
        "NAME": os.environ["ORACLE_DATABASE_NAME"],
        "USER": os.environ["ORACLE_DATABASE_USER"],
        "PASSWORD": os.environ["ORACLE_DATABASE_PASSWORD"],
    },
}

MARP_DATABASE = {
    "DRIVER": os.environ["MARP_DB_DRIVER"],
    "SERVER": os.environ["MARP_DB_SERVER"],
    "PORT": os.getenv("MARP_DB_PORT", "1433").strip(),
    "NAME": os.environ["MARP_DB_NAME"],
    "USER": os.environ["MARP_DB_USERNAME"],
    "PASSWORD": os.environ["MARP_DB_PASSWORD"],
}

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.memcached.PyMemcacheCache',
        'LOCATION': '127.0.0.1:11211',
    }
}
