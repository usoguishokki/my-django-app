"""Shared application defaults; no environment or credential loading."""
from pathlib import Path
import os

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'sass_processor',
    'myapp',
    'corsheaders'
]

MIDDLEWARE = [
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.gzip.GZipMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'myapp.middlewares.ModelCacheMiddleware',
    'myapp.middlewares.NoCacheHtmlMiddleware',
    'corsheaders.middleware.CorsMiddleware',
]

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000"
]
CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:8080",
    "http://localhost:3000"
]
CORS_ALLOW_CREDENTIALS = True  # 認証情報（クッキーなど）を含めるリクエストを許可

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',  # ✅ 一時的にすべてのリクエストを許可
    ]
}

INTERNAL_IPS = [
    '127.0.0.1',
]


AUTENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend', #標準の認証バックエンド
    'myapp.backends.MemberAuthenticationBackend', #カスタム認証バックエンド
]

ROOT_URLCONF = 'myproject.urls'

LOGIN_URL = '/login/'

AUTH_USER_MODEL = 'myapp.Member_tb'#カスタムユーザモデル
#セッションの有効期限
SESSION_COOKIE_AGE = 86400

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'myapp/templates'),
                 os.path.join(BASE_DIR, 'frontend/build')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'myapp.context_processors.employee_infomation',
            ],
        },
    },
]
WSGI_APPLICATION = 'myproject.wsgi.application'


# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Asia/Tokyo'

USE_I18N = True

USE_TZ = False


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/

STATIC_URL = '/static/'

STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'frontend/build/static'),
]

#collectstaticを利用する時にコメント化を解除
STATIC_ROOT = BASE_DIR / "staticfiles"

# Production URLs include a content hash.  Enabling the JavaScript module
# patterns also rewrites relative ES module imports to their hashed targets.
STATICFILES_STORAGE = "myproject.staticfiles.StaticFilesStorage"

STATICFILES_FINDERS = [
    'django.contrib.staticfiles.finders.FileSystemFinder',
    'django.contrib.staticfiles.finders.AppDirectoriesFinder',
    'sass_processor.finders.CssFinder',
]

SASS_PROCESSOR_ROOT = os.path.join(BASE_DIR, 'myapp/static')

SASS_PROCESSOR_INCLUDE_DIRS = [
    os.path.join(BASE_DIR, 'myapp/static/css'),
]


# SASS Processor settings
# Runtime template rendering must resolve the reviewed, committed CSS only.
# Generate CSS explicitly with `python manage.py compilescss` during development.
SASS_PROCESSOR_ENABLED = False
SASS_PROCESSOR_AUTO_INCLUDE = True
# Keep committed CSS deterministic regardless of the local DEBUG value.
SASS_OUTPUT_STYLE = "nested"
# Explicit build manifests are the only source of SCSS entry points.
SASS_TEMPLATE_EXTS = [".scss-build.html"]

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
