adminplugin_status
###################

A jquery based link status checker for your django site.


Notes
-----

Checking everything is prohibitively slow.  Your menu is probably not needed.


Instructions
------------

1. Add 'adminplugin_status' to settings.py:INSTALLED_APPS
2. Configure your url patterns

    urlpatterns = patterns('',
        (r'^admin/status/', include('adminplugin_status.urls')),  # automatically claims /admin/status
    ) + urlpatterns

3.  Configure settings.py to indicate the DEFAULT_DOM_PREFIX to search for
    anchors.  In the case of django, this is probably something like "#content".

    ADMINSTATUS_DOM_PREFIX = '#content'  
    
    If you want to search your menus, try just doing 'html'

4.  I had no template I could handily work with to get this into the /admin, so
    I put a link into templates/admin/base.html by the admin doc link.  With a
    bit of work this could easily function as a bookmarklet.


Modifications
------------

I skip some links including:

1. Anything containing `__debug__`
2. Bookmark links (#)
3. Anything beginning with /admin
4. /login
5. /logout
6. Anything with .doc or .pdf
7. And only scrape the section of the document
