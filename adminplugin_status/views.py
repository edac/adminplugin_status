from django.shortcuts import render_to_response
from django.template import RequestContext
from django.contrib.admin.views.decorators import staff_member_required
from django.core import urlresolvers

# pylint -- name convention
#pylint: disable-msg=C0103

#################################################
#      Web Available Functions
#################################################

from adminplugin_status import settings

#------------------------------------------------------------------------
@staff_member_required
def status_index(request):
    return render_to_response('adminplugin_status/index.html', {
        'root_path' : urlresolvers.reverse('admin:index'),
        'prefix'    : settings.ADMINSTATUS_PREFIX,
        'domprefix' : settings.ADMINSTATUS_DOM_PREFIX
    }, context_instance=RequestContext(request))
#------------------------------------------------------------------------
