define([
    'jquery',
    'app/walls',

    'libs/_',
    'three'
],

function($, Walls) {

    "use strict"

    var Elements = function() {
        return this;
    }

    Elements.prototype = {

        // contains all addable elements, key is element id
        sourceElements : {},

        elements: [],

        init: function(configuration, dimensions, deferred) {

            this.sourceElements = ihc.config.elements;

            this.elements = [];

            this.configuration = configuration;
            this.dimensions = dimensions;
            this.deferred = deferred;
        },

        // All model walls to add elements on
        /*walls : function () {
            if ( this._walls.length ) {
                return this._walls;
            }
            var walls = _.find(this.frame.children, function(item) {
                return ( item.model !== undefined && item.model.type == 'walls' )
            });
            this._walls = (walls !== undefined) ? walls.children : [];
            return this._walls;
        },*/

        // Return wall for normal
        wall : function (normal) {
            return Walls.getContainerWallByNormal(normal);
            /*var wall = _.find(this.walls(), function(item) {
                return ( item 
                    && item.model !== undefined
                    && item.model.type == 'wall'
                    && item.model.options.normal.equals(normal) 
                    );
            });
            return (wall === undefined) ? null : wall;*/
        },

        /*
            Return wall elements
        */
        wallElements : function(wall) {
            /*
            return _.filter(wall.children, function(item) {
                return ( item.model !== undefined
                    && item.model.type === 'element' );
            }); */
            return Walls.getContainerWallElements(wall);
        },

        /*
            Add element by id passed from buttons ("add") or drag-n-drop
            to walls with the same normal
                id - element id from this.sourceElements obj
                normal - wall normal
                fn - callback fired when element added(or not)
        */
        addById : function (id, normal, fn, options) {
            if (this.sourceElements[id] === undefined && options === undefined) { 
                console.warn('[elements.js] not found[' + id + ']'); 
                return false; 
                if(fn) fn(null,null); 
            }

            var el;

            if (options !== undefined) {
                el = options;
            } else {
                el = this.sourceElements[id];
            }

            if ( ! normal instanceof THREE.Vector3) {
                normal = new THREE.Vector3(
                    normal.x,
                    normal.y,
                    normal.z
                );
            }

            normal.x = parseFloat(normal.x);
            normal.y = parseFloat(normal.y);
            normal.z = parseFloat(normal.z);

            var self = this
                , scale = ihc.config.scale
                , tscale = scale * 1000

                
                , width = this._snap(el.width * tscale)
                , height = this._snap(el.height * tscale)
                , offset = {
                    left : ihc.config.house.elements.offsetBetweenElements, //el.offset.left * tscale,
                    right: ihc.config.house.elements.offsetBetweenElements //el.offset.right * tscale
                }
                , position = el.position;



            THREE.ImageUtils.loadTexture(el.texture, {}, function(texture) {

                var element = self._element(texture, width, height);

                element.model = {
                    width: width,
                    height: height,
                    texture: texture.sourceFile
                };

                var added = self._add(element, normal, offset, position);

                if (added) {
                    element.model.productid = el.productid;
                    element.model.typeid = el.typeid;
                    element.model.categoryid = el.categoryid;
                    element.model.price = el.price;
                }

                if (fn) fn(added, element);

            });

        },

        /*
            Build element 3d obj
                - texture - THREE.Texture
        */
        _element : function(texture, width, height) {
            var material = new THREE.MeshLambertMaterial({ map : texture })
                , geometry
                , mesh;
            geometry = new THREE.PlaneGeometry(width, height, 1, 1);
            mesh = new THREE.Mesh(geometry, material);  
            return mesh;
        },

        /*
            Find position for element on current wall (by normal) and add it if is possible
                element - element itself
                normal - normal to find wall
                offset - element offset
                position - new element position
        */
         _add : function (element, normal, offset, position) {
            var self = this
                , wall = this.wall(normal);

            if (wall === null) { console.warn('[elements.js] no wall'); return false; }

            var elements = this.wallElements(wall)
                , scale = ihc.config.scale
                , offsetFromEdges = ihc.config.house.elements.offsetFromEdges
                , gridStep = ihc.config.grid.size
                , pr = - wall.model.width / 2 + offsetFromEdges
                , pl = wall.model.width / 2 - offsetFromEdges
                , pt = wall.geometry.height / 2
                , pb = - wall.geometry.height / 2;

            var prp = pr + element.geometry.width / 2
                , plp = pl - element.geometry.width / 2
                , ptp = pt - this._snap(element.geometry.height / 2)
                , pbp = pb + element.geometry.height / 2;
            
            if ( element.geometry.width > Math.abs(pr * 2)
                || element.geometry.height > wall.geometry.height
            ) {
                console.warn('[elements.js] Element does not fit');
                return false;
            }

            element.model.normal = normal;
            element.model.type = 'element';
            element.model.offset = offset;

            // console.log('WALL:' , wall.geometry.width, wall.geometry.width / 2, wall.geometry.width / 2 - offsetFromEdges, this._snap( wall.geometry.width / 2 - offsetFromEdges ));
            // console.log('EL:' , element.geometry.width, element.position);

            // console.log('Wall children:', elements);
            
            // console.log('Step-------------------------------------');
            var used = this.used(elements, element.model.offset);
            // console.log('Used: ', _.flatten(used));
            var free = this.free(used, pr, pl);
            // console.log('Free: ', _.flatten(free));            
            var validPosition = this.validPosition(element, wall, free, position, offset);

            if ( ! validPosition ) { console.warn('[elements.js] incorrect position'); return false; }

            element.position.z += ihc.config.house.elements.offsetFromWall;

            if ( ! elements.length) {

                wall.add(element);     


                if (position) {

                    var wallWidth = wall.model.width
                        , wallWidthHalfed = wallWidth / 2
                        , left = wallWidthHalfed % 20
                        , x = parseInt(position.x, 10)
                        , y = parseInt(position.y, 10);

                    // console.log(x,y);
                    // if (left) {
                        // x += left * ( ( x > 0) ? -1 : 1);
                    // }
                    // console.log(x,y);
                    
                    element.position.x = x;
                    element.position.y = y;

                } else {

                    // element.position.x = prp;
                    // element.position.y = ptp;

                    this.top(element);
                    this.left(element);

                }

                this.elements.push(element);

                return true;                    

            } else {

                var find = this.find(free, element.geometry.width);
                // console.log('Find: ', find, element.geometry.width);

                if ( find !== null) {

                    wall.add(element);

                    if (position) {

                        // console.log('Draw with position', parseInt(position.x, 10), parseInt(position.y, 10), this._snap( parseInt(position.x, 10), 20), this._snap( parseInt(position.y, 10), 20) );

                        element.position.x = parseInt(position.x, 10);
                        element.position.y = parseInt(position.y, 10);

                    } else {

                        element.position.x = (find + element.geometry.width / 2);
                        // element.position.y = ptp;

                        this.top(element);
                        // this.left(element);       

                    }

                    this.elements.push(element);
                    
                    return true;
                } else {
                    console.warn('[elements.js] no free space');
                    return false;
                }

            }      

            return false;

        },

        area : function (object) {
            if (object === undefined) return[0,0];
            var parent = object.parent
                , offsetFromEdges = ihc.config.house.elements.offsetFromEdges
                , gridStep = ihc.config.grid.size
                , pl = parent.geometry.width / 2 - offsetFromEdges
                , pr = - parent.geometry.width / 2 + offsetFromEdges
                , children = [];

            pl = (pl / gridStep | 0) * gridStep;
            pr = (pr / gridStep | 0) * gridStep;

            children = _.filter(parent.children, function(item) {
                return (item.model !== undefined && item.model.type == 'element');
            });

            var used = this.used(children, object.model.offset);

            var x = object.position.x;

            var index = this._findIndex(used, function(item) {
                return (x > item[0] && x < item[1]);
            });

            var range = [
                ( used[index - 1] === undefined ) ? pr : used[index - 1][1],
                ( used[index + 1] === undefined ) ? pl : used[index + 1][0]
            ];

            // console.log('Area: ', range);

            return range;
        },

        areaDistance : function (object, normal) {
            var area = this.area(object, normal);
            return this._distance(area[0], area[1]);
        },

        /*
            Find distance between two points on one coordinate
        */
        _distance : function(from, to) {
            if (from < 0 && to < 0) {
                return Math.abs(from) + to;
            } else if( from < 0 && to > 0) {
                return Math.abs(from) + to;
            } else if( from > 0 && to > 0) {
                return to - from;
            } else if (from == 0 || to == 0) {
                return Math.abs(from + to);
            } else {
                // from == 0 && to == 0
                return 0;
            }
        },

        /*
            Get element index in array
        */
        _findIndex : function(array, fn) {
            _.findIndex(array, fn);
            // for (var i = 0, l = array.length; i < l; i++) { if (fn(array[i])) return i; }
            // return -1;
        },

        /*
            Calculate all ranges, that are already used by elements on current wall
                elements - array of 3d elements (that are on wall)
                offset - default offset between elements
        */
        used : function (elements, offset) {
            var self = this
                , scale = ihc.config.scale
                , tscale = scale * 1000
                , offsetLeft = offset.left
                , offsetRight = offset.right
                , used = _.map(elements, function(item) {
                    var res = [
                        (item.position.x - item.geometry.width / 2 - offsetLeft),
                        (item.position.x + item.geometry.width / 2 + offsetRight)
                    ];
                    return res;
                });

            // important - sort from lowest range to greatest
            used = _.sortBy(used, function(item) {
                return item[0];
            });

            return used;
        },

        /*
            Calculate ranges that are not in use
                used - result from this.used()
                edgeR - max pos in right
                edgeL - max pos in left
        */
        free : function (used, edgeR, edgeL) {
            var free = []
                , edge = edgeR;
            for (var i = 0; i< used.length; i++) {
                var range = used[i];
                if (edge < 0) {
                    if (edge < range[0]) {
                        free.push([ edge, range[0] ]);
                    } else {
                        // no need
                    }
                    edge = range[1];
                } else {
                    if (edge > range[0]) {
                        free.push([ range[1], edge ]);
                    } else {
                        // no need
                    }
                    edge = range[1];
                }
            }
            free.push([ edge, edgeL]);
            return free;
        },

        /*
            Find first free matching space
                free - result from this.free()
                width - width of an element trying to add
        */
        find : function (free, width) {
            var self = this;
            var find = _.find(free, function(item) {
                 return (width <= self._distance(item[0], item[1]) );
            });
            return (find === undefined) ? null : find[0];
        },

        /*
            When adding elements - check if element's position is valid, 
            if it is located inside of the wall and not crosses other elements
                element - the element itself
                wall - wall where element is located
                free - result of this.free() - ranges with free space
                position - new element's position - try if it is valid
                offset - element's offset from both sides
        */
        validPosition : function (element, wall, free, position, offset) {
            // if no position passed - element is added for the first time and it has no position set yet
            // so - position is valid
            if ( ! position ) {
                return true;
            }

            var scale = ihc.config.scale
                , tscale = scale * 1000
                , offsetLeft = offset.left
                , offsetRight = offset.right
                , offsetFromEdges = ihc.config.house.elements.offsetFromEdges
                
                , x = parseInt(position.x, 10)
                , y = parseInt(position.y, 10)

                , width = element.geometry.width
                , height = element.geometry.height

                , wallHeight = wall.geometry.height 
                , wallWidth = wall.model.width
                , wallHeightHalfed = wallHeight / 2
                , wallWidthHalfed = wallWidth / 2 - offsetFromEdges

                , wallEdgeRight = - wallWidthHalfed
                , wallEdgeLeft = wallWidthHalfed

                , index = this._findIndex(free, function(item) {
                    return (x > item[0] && x < item[1]);
                })

                , range = [
                    free[index - 1] === undefined ? wallEdgeRight - offsetRight : free[index - 1][1],
                    free[index + 1] === undefined ? wallEdgeLeft + offsetLeft : free[index + 1][0]
                ]

                , spaceLeft = x - (width / 2 + offsetLeft)
                , spaceRight = x + (width / 2 + offsetRight)

                , inRangeX = ( (spaceLeft >= range[0]) && (spaceRight <= range[1]) )
                , inRangeY = ( (wallHeightHalfed - height / 2) >= Math.abs(y) )
                , inRange = ( inRangeX && inRangeY );

            return inRange;
        },


        centerH : function (object) {
            if (object === undefined) return;
            var area = this.area(object);
            
            var center = area[0] + this._distance(area[0], area[1]) / 2;

            var edge = center - object.geometry.width / 2;
            var snap = edge - this._snap(edge);

            center -= snap;

            object.position.x = center;
        },

        centerV : function (object, normal) {
            if (object === undefined) return;

            var center = 0;   

            var edge = center - object.geometry.height / 2;
            var snap = edge - this._snap(edge);

            center -= snap;

            object.position.y = center;
        },

        top : function (object) {
            if (object === undefined) return;
            var parent = object.parent;
            object.position.y = (parent.geometry.height / 2) - object.geometry.height / 2;
        },

        _snap : function (value, halfed) {
            var step = ihc.config.grid.size;
            if (halfed) {
                step = step / 2;
            }
            value = parseInt(value, 10);
            return (value / step | 0) * step;
        },

        bottom: function (object) {
            if (object === undefined) return;
            var parent = object.parent;
            object.position.y = - parent.geometry.height / 2 + object.geometry.height / 2;
        },

        right : function (object, normal) {
            if (object === undefined) return;
            var area = this.area(object);
            object.position.x = area[1] - object.geometry.width / 2;
        },

        left : function (object) {
            if (object === undefined) return;
            var area = this.area(object);
            object.position.x = area[0] + object.geometry.width / 2;
        },

        

        /*
            Get all elements from all the walls or find single element
                elementid - if passed - return only element for elementid
        */
        getElements : function (elementId) {
            if (elementId) {
                return _.findWhere(this.elements, { id : parseInt(elementId, 10) });
            }
            return this.elements;
/*
            elements = _.chain(this.walls())
                .map(function(item) {
                    return item.children;
                })
                .flatten()
                .filter(function(item) {
                    if (elementid !== undefined) {
                        if (elementid == item.id) {
                            return true;
                        } else {
                            return false;
                        }
                    } else {
                        return item.model !== undefined && item.model.type == 'element';
                    }
                })
                .value();
            return elements;*/
        },

        /*
            Get all information about single element for export
        */
        toModel : function(element) {
            var scale = ihc.config.scale
                , tscale = scale * 1000
                , position = element.position
                , normal = element.model.normal

            return {

                productid : element.model.productid,
                innerid : element.id,
                typeid : element.model.typeid,
                categoryid : element.model.categoryid,
                price : element.model.price,
                
                width : element.model.width / tscale,
                height : element.model.height / tscale,
                position : {
                    x: position.x,
                    y: position.y,
                    z : position.z
                },
                normal : {
                    x: normal.x,
                    y: normal.y,
                    z: normal.z
                },
                texture : element.model.texture,
                
            };
        },

        /*
            Export all elements that are on all walls of the model
        */
        toModels : function () {
            var els = this.getElements()
                , elements = {}
                , self = this;
            _.each(els, function(item, key) {
                var model = self.toModel(item);
                elements[model.innerid] = model;
            });
            return elements;
        },

        /*
            Add all elements by exported models
                elements - array of exported elements ( exported with the help of this.toModel() )
        */
        create : function(frame) {

            var deferreds = [];

            var elements = this.configuration.elements;
            _.each(elements, function(element) { 

                var deferred = $.Deferred();
                deferreds.push(deferred);

                var callback = _.bind(function(added, object) {
                    object.id = parseInt(element.innerid, 10);
                    deferred.resolve();
                }, this);

                this.addById(element.productid, element.normal, callback, element);

            }, this);

            $.when.apply($, deferreds).done(_.bind(function() {
                console.log('[elements.js] Elements done');
                this.deferred.resolve();
            }, this));

        },

        remove: function(elementId) {
            var elementIndex = null;
            _.each(this.elements, function(element, index) {
                if (element.id === elementId) {
                    elementIndex = index;
                }
            }, this);
            if (elementIndex !== null) {
                delete this.elements[elementIndex];
            } else {
                console.error('[elements.js] Index is null');
            }
        }

    };

    return Elements;
});