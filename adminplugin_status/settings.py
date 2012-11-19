from django.conf import settings

DEFAULT_DOM_PREFIX = '#pgContent'
DEFAULT_STATUS_ROOT = '/'

ADMINSTATUS_DOM_PREFIX = getattr(settings,
    'ADMINSTATUS_DOM_PREFIX', DEFAULT_DOM_PREFIX)

ADMINSTATUS_PREFIX= getattr(settings,
    'ADMINSTATUS_PREFIX', DEFAULT_STATUS_ROOT)
