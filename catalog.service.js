var CatalogService = (function ($) {
    'use strict';

    //#region Default settings
    var defaultCatalogSettings = {
        containerSelector: '[data-catalog]',
        filtersContainerSelector: '[data-catalog-child="filtersContainer"]',
        filtersItemSelector: '[data-catalog-filter]',
        filtersItemTypeAttribute: 'data-catalog-filter',
        optionsItemSelector: '[data-catalog-option]',
        optionsItemTypeAttribute: 'data-catalog-option',
        productsContainerSelector: '[data-catalog-child="productsContainer"]',
        productsItemSelector: '[data-catalog-child="productsItem"]',
        productsEmptySelector: '[data-catalog-child="productsEmpty"]',
        pagingNextButton: '[data-catalog-child="pagingNext"]',
        pagingHasNextAttribute: 'data-catalog-has-next-page',
        filterTypes: {},
        optionTypes: {},
        clearOn: ['filter'],
        loadingStart: null,
        loadingFinish: null,
        searchData: {
            categoryID: null,
            path: '/',
            pagesize: 12,
            orderby: '1',
            pagenumber: 1,
            viewmode: 'grid',
            filter: []
        }
    };
    
    //#region Default filter types
    defaultCatalogSettings.filterTypes = {
        checkbox: {
            handlers: [{
                trigger: 'click',
                handle: function ($elem, searchData) {
                    var filterItemExist = false,
                        filterItem = {
                            Entity: $elem.attr('data-entity'),
                            ID: $elem.attr('data-id'),
                            Name: $elem.attr('data-name'),
                            PId: $elem.attr('data-pid'),
                            Value: $elem.val() || $elem.attr('data-value')
                        };

                    for (var i = 0, l = searchData.filter.length; i < l; i++) {
                        if (filterItem.ID == searchData.filter[i].ID) {
                            filterItemExist = true;
                            searchData.filter.splice(i, 1);
                            break;
                        }
                    }

                    if (!filterItemExist)
                        searchData.filter.push(filterItem);
                }
            }]
        },
        priceSlider: {
            handlers: [{
                trigger: 'change',
                handle: function ($elem, searchData) {
                    var filterItemExist = false,
                        filterItem = {
                            Entity: $elem.attr('data-entity'),
                            Name: $elem.attr('data-name'),
                            Operator: $elem.attr('data-operator'),
                            Value: $elem.attr('data-price-min') + '~' + $elem.val()
                        };

                    for (var i = 0, l = searchData.filter.length; i < l; i++) {
                        if (filterItem.Entity == searchData.filter[i].Entity) {
                            filterItemExist = true;
                            searchData.filter[i] = filterItem;
                            break;
                        }
                    }

                    if (!filterItemExist)
                        searchData.filter.push(filterItem);
                }
            }]
        }
    };
    //#endregion

    //#region Default catalog options
    defaultCatalogSettings.optionTypes = {
        sorting: {
            clear: true,
            handlers: [{
                trigger: 'click',
                handle: function ($elem, searchData) {
                    var orderby = $elem.attr('data-sorting-id');

                    searchData.orderby = orderby;
                }
            }],
            update: function ($elem, searchData) {
                var orderby = $elem.attr('data-sorting-id');

                if (orderby === searchData.orderby)
                    $elem.addClass('disabled');
                else
                    $elem.removeClass('disabled');
            }
        }
    };
    //#endregion
    //#endregion

    //#region Init class
    var CatalogService = function (data) {
        var selfCatalog = this;
        selfCatalog.settings = $.extend(true, {}, defaultCatalogSettings, data);

        selfCatalog.waitingRequests = [];
        selfCatalog.status = {
            getProducts: 'calm',
            getProductsLoading: false
        };

        //#region Init search data
        selfCatalog.searchData = {};
        selfCatalog.initSearchData(selfCatalog.settings.searchData);
        //#endregion

        //#region Init dom elements
        selfCatalog.$container = null;
        selfCatalog.$filtersContainer = null;
        selfCatalog.$productsContainer = null;
        selfCatalog.$productsEmpty = null;
        selfCatalog.$pagingNextButton = null;

        selfCatalog.initDomElements();
        //#endregion

        selfCatalog.initEvents();

        selfCatalog.filtersInit();
        selfCatalog.optionsInit();
    };
    //#endregion

    //#region Init methods
    CatalogService.prototype.initDomElements = function () {
        var selfCatalog = this;

        selfCatalog.$container = $(selfCatalog.settings.containerSelector);
        selfCatalog.$filtersContainer = selfCatalog.getChild(selfCatalog.settings.filtersContainerSelector);
        selfCatalog.$productsContainer = selfCatalog.getChild(selfCatalog.settings.productsContainerSelector);
        selfCatalog.$productsEmpty = selfCatalog.getChild(selfCatalog.settings.productsEmptySelector);
        selfCatalog.$pagingNextButton = selfCatalog.getChild(selfCatalog.settings.pagingNextButton);
    };

    CatalogService.prototype.initSearchData = function (searchData) {
        this.searchData = {
            categoryID: searchData.categoryID,
            path: searchData.path,
            pagesize: searchData.pagesize,
            orderby: searchData.orderby,
            viewmode: searchData.viewmode,
            pagenumber: 1,
            filter: null
        };

        if (searchData.filter) {
            this.searchData.filter = JSON.parse(searchData.filter);
        }
    };

    CatalogService.prototype.initEvents = function () {
        var selfCatalog = this;
        selfCatalog.$container.on('click', selfCatalog.settings.pagingNextButton, function () {
            selfCatalog.paggingNext();
        });
    };
    //#endregion

    //#region Filters
    CatalogService.prototype.filtersInit = function () {
        var selfCatalog = this;

        selfCatalog.filtersEach(function ($item, type) {
            if (type && type.handlers) {
                $.each(type.handlers, function (index, handler) {
                    if (handler.trigger && handler.handle) {
                        $item.on(handler.trigger, function () {
                            if (!selfCatalog.searchData.filter)
                                selfCatalog.searchData.filter = [];

                            handler.handle($item, selfCatalog.searchData, selfCatalog);
                            selfCatalog.filtersOnChange(type);
                        });
                    }
                });

            }
        });
    };

    CatalogService.prototype.filtersOnChange = function (type) {
        var selfCatalog = this,
            clear = type.clear || false;

        selfCatalog.filtersEach(function ($item, type) {
            if (type && type.update)
                type.update($item, selfCatalog.searchData, selfCatalog);
        });

        selfCatalog.getProducts({
            trigger: 'filter',
            clear: clear
        });
    };

    CatalogService.prototype.filtersEach = function (handler) {
        var selfCatalog = this,
            $filterItems = selfCatalog.getChild(selfCatalog.settings.filtersItemSelector);

        $filterItems.each(function () {
            var $item = $(this),
                typeName = $item.attr(selfCatalog.settings.filtersItemTypeAttribute),
                type = selfCatalog.settings.filterTypes[typeName] || null;

            handler($item, type);
        });
    };
    //#endregion

    //#region Options
    CatalogService.prototype.optionsInit = function() {
        var selfCatalog = this;

        selfCatalog.optionsEach(function($item, type) {
            if (type && type.handlers) {
                $.each(type.handlers, function (index, handler) {
                    if (handler.trigger && handler.handle) {
                        $item.on(handler.trigger, function () {
                            handler.handle($item, selfCatalog.searchData, selfCatalog);
                            selfCatalog.optionsOnChange(type);
                        });
                    }
                });
                
            }
        });
    };

    CatalogService.prototype.optionsOnChange = function (type) {
        var selfCatalog = this,
            clear = type.clear || false;

        selfCatalog.optionsEach(function ($item, type) {
            if (type && type.update)
                type.update($item, selfCatalog.searchData, selfCatalog);
        });

        selfCatalog.getProducts({
            trigger: 'option',
            clear: clear
        });
    };

    CatalogService.prototype.optionsEach = function(handler) {
        var selfCatalog = this,
            $optionItems = selfCatalog.getChild(selfCatalog.settings.optionsItemSelector);

        $optionItems.each(function () {
            var $item = $(this),
                typeName = $item.attr(selfCatalog.settings.optionsItemTypeAttribute),
                type = selfCatalog.settings.optionTypes[typeName] || null;

            handler($item, type);
        });
    };
    //#endregion

    //#region Paging
    CatalogService.prototype.paggingNext = function () {
        this.searchData.pagenumber++;
        this.pagingOnChange();
    };

    CatalogService.prototype.pagingOnChange = function () {
        this.getProducts({
            trigger: 'paging'
        });
    };
    //#endregion

    //#region Data transfer
    CatalogService.prototype.getProducts = function (data) {
        var selfCatalog = this,
            needClear = false,
            requestData  = {},
            request;

        if (selfCatalog.status.getProducts === 'inprogress') {
            selfCatalog.waitingRequests.push(data);
            return;
        }

        selfCatalog.status.getProducts = 'inprogress';

        data = data || {};
        if (data.clear || selfCatalog.settings.clearOn.indexOf(data.trigger) >= 0 || selfCatalog.searchData.pagenumber === 1) {
            selfCatalog.searchData.pagenumber = 1;
            needClear = true;
        }

        if (!selfCatalog.status.getProductsLoading && selfCatalog.settings.loadingStart) {
            selfCatalog.settings.loadingStart();
        }
        selfCatalog.status.getProductsLoading = true;


        //#region Request data
        requestData.url = selfCatalog.searchData.path;
        requestData.type = "GET";
        requestData.data = {
            pagesize: selfCatalog.searchData.pagesize,
            orderby: selfCatalog.searchData.orderby,
            viewmode: selfCatalog.searchData.viewmode,
        };
        if (selfCatalog.searchData.filter && selfCatalog.searchData.filter.length > 0) {
            requestData.data.filter = JSON.stringify(selfCatalog.searchData.filter);
        }
        if (selfCatalog.searchData.pagenumber > 1) {
            requestData.data.pagenumber = selfCatalog.searchData.pagenumber;
        }
        //#endregion

        //#region Request
        request = $.ajax(requestData);
        request.done(function (response) {
            if (needClear)
                selfCatalog.clearProducts();
            selfCatalog.parseGetProductResponse(response);
            selfCatalog.updateLocationState(this.url);
            
            selfCatalog.status.getProducts = 'calm';

            if (selfCatalog.waitingRequests.length > 0) {
                selfCatalog.handleWaitingRequests();
            } else {
                selfCatalog.status.getProductsLoading = false;
                if (selfCatalog.settings.loadingFinish) {
                    selfCatalog.settings.loadingFinish();
                }
            }
        });
        request.fail(function () {
            selfCatalog.status.getProducts = 'calm';

            if (selfCatalog.waitingRequests.length > 0) {
                selfCatalog.handleWaitingRequests();
            } else {
                selfCatalog.status.getProductsLoading = false;
                if (selfCatalog.settings.loadingFinish) {
                    selfCatalog.settings.loadingFinish();
                }
            }
        });
        //#endregion
    };

    CatalogService.prototype.handleWaitingRequests = function() {
        var selfCatalog = this,
            resultRequest = {};

        $.each(selfCatalog.waitingRequests, function(index, requestItem) {
            if (requestItem.clear || selfCatalog.settings.clearOn.indexOf(requestItem.trigger) >= 0)
                resultRequest.clear = true;
        });

        selfCatalog.waitingRequests.length = 0;
        selfCatalog.getProducts(resultRequest);
    };
    
    CatalogService.prototype.parseGetProductResponse = function (response) {
        var selfCatalog = this,
            $response = $('<html></html>'),
            hasNextPage = false,
            $catalog,
            $products;


        $response.html(response);
        $catalog = $response.find(selfCatalog.settings.containerSelector);
        $products = $catalog.find(selfCatalog.settings.productsItemSelector);

        if ($products.length > 0) {
            selfCatalog.$productsContainer.append($products);
            hasNextPage = $catalog.find('[' + selfCatalog.settings.pagingHasNextAttribute + '="true"]').length > 0;
            if (hasNextPage) {
                selfCatalog.$pagingNextButton.show();
            } else {
                selfCatalog.$pagingNextButton.hide();
            }
            selfCatalog.$productsEmpty.hide();
        } else if (selfCatalog.searchData.pagenumber === 1) {
            selfCatalog.$productsEmpty.show();
        } else {
            selfCatalog.$productsEmpty.hide();
        }
        
    };
    //#endregion

    //#region Helpers
    CatalogService.prototype.updateLocationState = function (url) {
        if (window.history && window.history.replaceState) {
            url = url.replace(/(pagenumber=)[0-9]*/, 'pagenumber=1'); // #Todo: Remove pagenumber from url
            window.history.replaceState({}, "", url);
        }
    };

    CatalogService.prototype.clearProducts = function () {
        this.$productsContainer.html('');
    };

    CatalogService.prototype.getChild = function (selector) {
        return this.$container.find(selector);
    };
    //#endregion

    return CatalogService;
}(jQuery));