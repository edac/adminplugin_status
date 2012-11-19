from django.conf.urls import patterns, url
from adminplugin_status import views

urlpatterns = patterns('',
    url('^$',
        views.status_index,
        name='adminplugin_status-docroot'
    ),
)
