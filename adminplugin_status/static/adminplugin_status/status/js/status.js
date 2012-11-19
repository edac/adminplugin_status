// status.js 0.2.0

// (c) 2012 Riccardo Forina
// Status may be freely distributed under the MIT license.
// For details and documentation:
// http://www.codingnot.es
(function($) {

    window.STATUS = {};

    // Save the document.location hostname, it will be used to check if an url
    // points to the crawled website even if it is a full qualified url
    window.STATUS.localhost = (new Uri(document.location));

    // Normalize a url string to an Uri
    function urlToUri(url, forceTrailingSlash) {
        forceTrailingSlash = forceTrailingSlash || false;
        var uri = new Uri(url);
        uri.setAnchor('');  // no hashes in the url, to avoid duplication
        if (uri.host() === window.STATUS.localhost.host()) {
            uri.setProtocol('');
            uri.setHost('');
        }
        var path = uri.path();
        // if no trailing slash in the path, put it (if asked to do so)
        // TODO: I'm damn sure I'll have troubles later on with image checking
        if (path[path.length-1] !== '/' && forceTrailingSlash === true)
            uri.setPath(path + '/');
        return uri;
    }
    window.STATUS.urlToUri = urlToUri;

    // Collection of Page models
    var Pages = Backbone.Collection.extend({
        model: 'Page',
        // Looks for a Page with a given url in the collection and returns it.
        // If not present, the Page is added to the collection.
        getOrAdd: function(url, toValidate) {
            var page = this.get(url);
            if (page === undefined) {
                page = new Page({
                    url: url,
                    toValidate: toValidate
                });
                page.fetch();
                this.add(page);
            }
            return page;
        },
        internals: function() {
            return this.filter(function(page) {
                return page.get('status') !== 'external';
            });
        }
    });
    // Comparator function to sort Pages by url
    Pages.sortByUrl = function (a, b) {
        var aUrl = a.get('url');
        var bUrl = b.get('url');
        aUrl = aUrl.host() + aUrl.path();
        bUrl = bUrl.host() + bUrl.path();
        return aUrl.localeCompare(bUrl);
    };
    // Comparator function to sort Pages by title
    Pages.sortByTitle = function (a, b) {
        return a.get('metaTitle').localeCompare(b.get('metaTitle'));
    };
    // Comparator function to sort Pages by description
    Pages.sortByDescription = function (a, b) {
        return a.get('metaDescription').localeCompare(b.get('metaDescription'));
    };

    // A collection to hold all the crawled Pages, with a default sorting by url
    window.STATUS.allPages = new Pages();
    window.STATUS.allPages.comparator = Pages.sortByUrl;

    // Page model
    var Page = Backbone.Model.extend({
        idAttribute: 'url',
        defaults: {
            UID: undefined,
            url: undefined,
            html: undefined,
            linksTo: undefined,
            linkedBy: undefined,
            status: 'unfetched',
            statusCode: 'unknown',
            metaTitle: '',
            metaDescription: ''
        },
        initialize: function(attributes) {
            Backbone.Model.prototype.initialize.apply(this, [attributes]);
            this.set('linksTo', new Pages([], {
                comparator: function(page) {
                    return page.get("url").path();
                }
            }));
            this.set('linkedBy', new Pages());
            this.set('UID', this.cid);
        },
        fetch: function(options) {
            var self = this;
            if (this.isExternal() === true) {
                this.set('status', 'external');
                return;
            }
            if (window.STATUS.allPages.get(urlToUri(this.get('url'), true))) {
                this.set('status', 'redirect');
                self.set('statusCode', '30x');
                return;
            }
            options = options ? _.clone(options) : {};
            options.dataType = 'html';
            options.success = function() {
                self.set('status', "success");
            };
            options.error = function() {
                self.set('status', "error");
            };
            options.complete = function(xhr, status) {
                self.set('statusCode', xhr.status);
                self.change();
            };
            return Backbone.Model.prototype.fetch.apply(this, [options]);
        },
        addLinksTo: function(url) {
            if (this.get('linksTo').get(url))
                return;
            var page = window.STATUS.allPages.getOrAdd(
                url,
                this.get('toValidate')
            );
            this.get('linksTo').add(page);
            page.addLinkedBy(this.get('url'));
        },
        addLinkedBy: function(url) {
            if (this.get('linkedBy').get(url))
                return;
            var page = window.STATUS.allPages.getOrAdd(
                url,
                this.get('toValidate')
            );
            this.get('linkedBy').add(page);
            page.addLinksTo(this.get('url'));
        },
        isExternal: function() {
            var host = this.get('url').host();
            return host !== "" && host !== window.STATUS.localhost.host();
        },
        addOrSkip: function(url) {
            if (url.indexOf('__debug__') != -1) {
                return false; // django debug toolbar
            } else if (url.indexOf('#') != -1) {
                return false; // bookmarks
            } else if (url.indexOf('/admin') != -1) {
                return false; // anything in admin page
            } else if (url.indexOf('/login') != -1) {
                return false; // pls don't log me in or out
            } else if (url.indexOf('/logout') != -1) {
                return false;
            } else if (url.lastIndexOf('.doc') != -1) {
                return false; // no downloadin' files
            } else if (url.lastIndexOf('.pdf') != -1) {
                return false; // no downloadin' files
            }

            return true;
        },
        parse: function(response) {
            var self = this;
            // IE8 Fix from original parse function.
            var fakeHtml = $('<html>' + response + '</html>');

            // Find fix to take passed in context arguments
            fakeHtml.find(this.get('toValidate') + ' a[href]').each(function() {
                var el = $(this);
                var url = el.attr('href');
                if (self.addOrSkip(url) ) {
                    self.addLinksTo(urlToUri(el.attr('href')));
                }
            });
            return {
                url: this.get('url'),
                html: fakeHtml,
                metaTitle: fakeHtml.find('title').text() || "{No title}",
                metaDescription: fakeHtml.find('meta[name="description"]').attr('content') || "{No description}"
            };
        },
        url: function() {
            return this.get('url');
        }
    });

    var PageView = Backbone.View.extend({
        tagName: 'tr',
        initialize: function() {
            this.pageTemplate = _.template($('#page-template').html());
            this.statusTemplate = _.template($('#status-template').html());
            this.linksTemplate = _.template($('#links-dropdown-template').html());
            this.model.on('change:metaTitle', this.setTitle, this);
            this.model.on('change:metaDescription', this.setDescription, this);
            this.model.on('change:status change:statusCode', this.setStatus, this);
            this.model.get('linksTo').on('add', this.setLinksTo, this);
            this.model.get('linkedBy').on('add', this.setLinkedBy, this);
            this.model.on('hide', this.hide, this);
            this.model.on('show', this.show, this);
            return this;
        },
        render: function() {
            this.$el.html(this.pageTemplate(this.model.toJSON()));
            this.$elMetaTitle = this.$el.find('.metaTitle');
            this.$elMetaDescription = this.$el.find('.metaDescription');
            this.$elStatus = this.$el.find('.status');
            this.$elLinksTo = this.$el.find('.linksOut');
            this.$elLinkedBy = this.$el.find('.linksIn');
            this.setTitle();
            this.setDescription();
            this.setStatus();
            this.setLinksTo();
            this.setLinkedBy();
            return this;
        },
        setTitle: function() {
            this.$elMetaTitle.html(this.model.get('metaTitle'));
        },
        setDescription: function() {
            this.$elMetaDescription.html(this.model.get('metaDescription'));
        },
        setStatus: function(page) {
            this.$elStatus.html(this.statusTemplate(this.model.toJSON()));
            this.$el.removeClass().addClass(this.model.get('status'));
            return this;
        },
        setLinksTo: function(page) {
            this.$elLinksTo.html(this.linksTemplate({
                dropdownID: this.model.cid + '-linksto',
                links: this.model.get('linksTo')
            }));
            return this;
        },
        setLinkedBy: function(page) {
            this.$elLinkedBy.html(this.linksTemplate({
                dropdownID: this.model.cid + '-linkedby',
                links: this.model.get('linkedBy')
            }));
            return this;
        },
        hide: function() {
            this.$el.hide();
        },
        show: function() {
            this.$el.show();
        }
    });

    // Extending into public NS
    window.STATUS.PagesView = Backbone.View.extend({
        initialize: function(){
            this.$tbody = this.$el.find('tbody');
            this.sortOn = this.$el.find('.btn-sort-on.active').attr('rel');
            this.sortDirection = this.$el.find('.btn-sort-direction.active').attr('rel');
            this.collection.on('add', this.add, this);
            this.collection.on('reset', this.reset, this);
            this.cachedPageViewList = {};
            return this;
        },
        reset: function() {
            var self = this;
            this.$tbody.empty();
            this.collection.each(function(page) {
                self.add(page);
            });
        },
        add: function(page) {
            var pageView = this.cachedPageViewList[page.cid];
            if (pageView === undefined) {
                pageView = new PageView({
                    model: page
                });
                this.cachedPageViewList[page.cid] = pageView;
            }
            this.$tbody.append(pageView.el);
            pageView.render();
            return this;
        },
        events: {
            'click .btn-sort-on': "onBtnSortOn",
            'click .btn-sort-direction': "onBtnSortDirection",
            'click .btn-filter': "onBtnFilter"
        },
        onBtnSortOn: function(ev) {
            this.sortOn = $(ev.currentTarget).attr('rel');
            this.sort();
        },
        onBtnSortDirection: function(ev) {
            this.sortDirection = $(ev.currentTarget).attr('rel');
            this.sort();
        },
        onBtnFilter: function(ev) {
            $(ev.currentTarget).toggleClass('active');
            this.filter();
        },
        filter: function() {
            var filterOn = _.map(this.$el.find('.btn-filter.active'), function(btn) { return $(btn).attr('rel'); });
            this.collection.each(function(page) {
                if (filterOn.indexOf(page.get('status')) === -1) {
                    page.trigger('hide');
                } else {
                    page.trigger('show');
                }
            });
        },
        sort: function() {
            switch(this.sortDirection) {
                case 'asc':
                    this.sortAsc();
                    break;
                case 'desc':
                    this.sortDesc();
                    break;
            }
        },
        sortAsc: function() {
            if (this.sortOn === 'url') {
                    this.collection.comparator = Pages.sortByUrl;
            } else if (this.sortOn === 'title') {
                    this.collection.comparator = Pages.sortByTitle;
            } else if (this.sortOn === 'description') {
                    this.collection.comparator = Pages.sortByDescription;
            }
            this.collection.sort();
        },
        sortDesc: function() {
            if (this.sortOn === 'url') {
                    this.collection.comparator = function(a, b) { return Pages.sortByUrl(b, a); };
            } else if (this.sortOn === 'title') {
                    this.collection.comparator = function(a, b) { return Pages.sortByTitle(b, a); };
            } else if (this.sortOn === 'description') {
                    this.collection.comparator = function(a, b) { return Pages.sortByDescription(b, a); };
            }
            this.collection.sort();
        }
    });
}(jQuery));
