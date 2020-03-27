class TreeBuilder {
    constructor(root, siblings, opts) {
        TreeBuilder.DEBUG_LEVEL = opts.debug ? 1 : 0;

        this.root = root;
        this.siblings = siblings;
        this.opts = opts;

        // flatten nodes
        this.allNodes = this._flatten(this.root);

        // Calculate node size
        let visibleNodes = this.allNodes.filter((n) => !n.hidden);

        this.nodeSize = opts.callbacks.nodeSize(visibleNodes, opts.nodeWidth, opts.callbacks.textRenderer);
    }

    create() {
        let opts = this.opts;
        let allNodes = this.allNodes;
        let nodeSize = this.nodeSize;

        let width = opts.width + opts.margin.left + opts.margin.right;
        let height = opts.height + opts.margin.top + opts.margin.bottom;

        let zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on('zoom', function () {
                svg.attr('transform', d3.event.transform.translate(width / 2, opts.margin.top));
            });

        //make an SVG
        let svg = this.svg = d3.select(opts.target)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .call(zoom).append('g')
            .attr('transform', 'translate(' + width / 2 + ',' + opts.margin.top + ')');

        // Compute the layout.
        this.tree = d3.tree().nodeSize([nodeSize[0] * 2, opts.callbacks.nodeHeightSeperation(nodeSize[0], nodeSize[1])]);

        this.tree.separation(function separation(a, b) {
            if (a.data.hidden || b.data.hidden) {
                return 0.3;
            } else {
                return 0.6;
            }
        });

        this._update(this.root);
    }

    _update(source) {

        let opts = this.opts;
        let allNodes = this.allNodes;
        let nodeSize = this.nodeSize;

        let treenodes = this.tree(source);
        let links = treenodes.links();

        // Create the link lines.
        this.svg.selectAll('.link').data(links).enter()
            // filter links with no parents to prevent empty nodes
            .filter(function (l) {
                return !l.target.data.noParent;
            })
            .append('path')
            .attr('class', opts.styles.linage)
            .attr('d', this._elbow);

        let nodes = this.svg.selectAll('.node').data(treenodes.descendants()).enter();

        this._linkSiblings();

        // Draw siblings (marriage)
        this.svg.selectAll('.sibling')
            .data(this.siblings).enter()
            .append('path')
            .attr('class', opts.styles.marriage)
            .attr('d', _.bind(this._siblingLine, this));

        // Create the node rectangles.
        nodes.append('foreignObject')
            .filter(function (d) {
                return d.data.hidden ? false : true;
            })
            .attr('x', function (d) {
                return Math.round(d.x - d.cWidth / 2) + 'px';
            })
            .attr('y', function (d) {
                return Math.round(d.y - d.cHeight / 2) + 'px';
            })
            .attr('width', function (d) {
                return d.cWidth + 'px';
            })
            .attr('height', function (d) {
                return d.cHeight + 'px';
            })
            .attr('id', function (d) {
                return d.id;
            })
            .html(function (d) {
                return opts.callbacks.nodeRenderer(
                    d.data,
                    d.data.name,
                    d.x, d.y,
                    nodeSize[0],
                    nodeSize[1],
                    d.data.extra,
                    d.data.id,
                    d.data.class,
                    d.data.textClass,
                    opts.callbacks.textRenderer);
            })
            .on('click', function (d) {
                if (d.data.hidden) {
                    return;
                }
                opts.callbacks.nodeClick(d.data.name, d.data.extra, d.data.id);
            })
            .on('contextmenu', function (d) {
                if (d.data.hidden) {
                    return;
                }
                d3.event.preventDefault();
                opts.callbacks.nodeRightClick(d.data.name, d.data.extra, d.data.id);
            });
    }

    _flatten(root) {
        let n = [];
        let i = 0;

        function recurse(node) {
            if (node.children) {
                node.children.forEach(recurse);
            }

            if (!node.id) {
                node.id = ++i;
            }
            n.push(node);
        }

        recurse(root);
        console.log('flattened root: ', _.cloneDeep(n));
        return n;
    }

    _elbow(d, i) {
        if (d.target.data.noParent) {
            return 'M0,0L0,0';
        }
        let ny = Math.round(d.target.y + (d.source.y - d.target.y) * 0.50);

        let linedata = [{
            x: d.target.x,
            y: d.target.y
        }, {
            x: d.target.x,
            y: ny
        }, {
            x: d.source.x,
            y: d.source.y
        }];

        let fun = d3.line().curve(d3.curveStepAfter)
            .x(function (d) {
                return d.x;
            })
            .y(function (d) {
                return d.y;
            });
        return fun(linedata);
    }

    _linkSiblings() {
        let allNodes = this.allNodes;

        this.siblings.forEach((d) => {
            let start = allNodes.filter((v) => d.source.id === v.data.id);
            let end = allNodes.filter((v) => d.target.id === v.data.id);

            d.source.x = start[0].x;
            d.source.y = start[0].y;
            d.target.x = end[0].x;
            d.target.y = end[0].y;

            let marriageId = (start[0].data.marriageNode != null ? start[0].data.marriageNode.id : end[0].data.marriageNode.id);

            let marriageNode = allNodes.find((n) => n.data.id === marriageId);

            d.source.marriageNode = marriageNode;
            d.target.marriageNode = marriageNode;
        });

    }

    _siblingLine(d, i) {
        let ny = Math.round(d.target.y + (d.source.y - d.target.y) * 0.50);
        let nodeWidth = this.nodeSize[0];
        let nodeHeight = this.nodeSize[1];

        // Not first marriage
        if (d.number > 0) {
            ny -= Math.round(nodeHeight * 8 / 10);
        }

        let linedata = [{
            x: d.source.x,
            y: d.source.y
        }, {
            x: Math.round(d.source.x + nodeWidth * 6 / 10),
            y: d.source.y
        }, {
            x: Math.round(d.source.x + nodeWidth * 6 / 10),
            y: ny
        }, {
            x: d.target.marriageNode.x,
            y: ny
        }, {
            x: d.target.marriageNode.x,
            y: d.target.y
        }, {
            x: d.target.x,
            y: d.target.y
        }];

        let fun = d3.line().curve(d3.curveStepAfter)
            .x(function (d) {
                return d.x;
            })
            .y(function (d) {
                return d.y;
            });
        return fun(linedata);
    }

    static _nodeHeightSeperation(nodeWidth, nodeMaxHeight) {
        return nodeMaxHeight + 25;
    }

    static _nodeSize(nodes, width, textRenderer) {
        let maxWidth = 0;
        let maxHeight = 0;
        let tmpSvg = document.createElement('svg');
        document.body.appendChild(tmpSvg);

        _.map(nodes, function (n) {
            let container = document.createElement('div');
            container.setAttribute('class', n.data.class);
            container.style.visibility = 'hidden';
            container.style.maxWidth = width + 'px';

            let text = textRenderer(n.data, n.data.name, n.data.extra, n.data.textClass);
            container.innerHTML = text;

            tmpSvg.appendChild(container);
            let height = 100; // container.offsetHeight;
            tmpSvg.removeChild(container);

            maxHeight = Math.max(maxHeight, height);
            n.cHeight = height;
            if (n.data.hidden) {
                n.cWidth = 0;
            } else {
                n.cWidth = width;
            }
        });
        document.body.removeChild(tmpSvg);

        return [width, maxHeight];
    }

    static _nodeRenderer(nodeData, name, x, y, height, width, extra, id, nodeClass, textClass, textRenderer) {
        return `<div class="${nodeClass}" id="node${id}"> ${textRenderer(nodeData, name, extra, textClass)}</div>`;
    }

    static _textRenderer(nodeData, name, extra, textClass) {
        console.log('rendering text: ', nodeData)
        return `<p align="center" class="${textClass}">${name} (${nodeData.id})</p>`;
    }

    static _debug(msg) {
        if (TreeBuilder.DEBUG_LEVEL > 0) {
            console.log(msg);
        }
    }
}

const dTree = {
    init: function (data, options = {}) {
        const opts = _.defaultsDeep(options || {}, {
            target: '#graph',
            debug: false,
            width: 600,
            height: 600,
            callbacks: {
                nodeClick: function (name, extra, id) {
                },
                nodeRightClick: function (name, extra, id) {
                },
                nodeHeightSeperation: function (nodeWidth, nodeMaxHeight) {
                    return TreeBuilder._nodeHeightSeperation(nodeWidth, nodeMaxHeight);
                },
                nodeRenderer: function (nodeData, name, x, y, height, width, extra, id, nodeClass, textClass, textRenderer) {
                    return TreeBuilder._nodeRenderer(nodeData, name, x, y, height, width, extra,
                        id, nodeClass, textClass, textRenderer);
                },
                nodeSize: function (nodes, width, textRenderer) {
                    return TreeBuilder._nodeSize(nodes, width, textRenderer);
                },
                nodeSorter: function (a, b) {
                    if (!!a.age && !!b.age) {
                        if (a.age > b.age) return -1; // older on the left
                        if (a.age < b.age) return 1; // younger on the right
                    }
                    return 0;
                },
                textRenderer: function (nodeData, name, extra, textClass) {
                    return TreeBuilder._textRenderer(nodeData, name, extra, textClass);
                },
            },
            margin: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            },
            nodeWidth: 100,
            nodeHeight: 100,
            styles: {
                node: 'node',
                linage: 'linage',
                marriage: 'marriage',
                text: 'nodeText'
            }
        });

        data = this._preprocess(data, opts);
        const treeBuilder = new TreeBuilder(data.root, data.siblings, opts);
        treeBuilder.create();
    },

    _preprocess: function (data, opts) {

        const siblings = [];
        let id = 0;

        const root = {
            name: '',
            id: id++,
            hidden: true,
            children: [],
            isRoot: true
        };

        const flattenedNodes = [];

        const reconstructTree = function (person, parent) {

            // find the node in existing nodes
            let node = person.id ? flattenedNodes.find(_ => _.id === person.id) : null;

            let nodeAlreadyExists = node !== null;

            // create node if not exists
            if (!nodeAlreadyExists) {
                node = {
                    name: person.name,
                    id: person.id ?? id++,
                    hidden: false,
                    children: [],
                    extra: person.extra,
                    textClass: person.textClass ? person.textClass : opts.styles.text,
                    class: person.class ? person.class : opts.styles.node
                };

                // hide linages to the hidden root node
                if (parent === root) {
                    node.noParent = true;
                }
                flattenedNodes.push(node);
            }

            // sort children
            dTree._sortPersons(person.children, opts);

            // add "direct" children
            if (person.children) {
                person.children.forEach((child) => {
                    reconstructTree(child, node);
                });
            }

            if (!nodeAlreadyExists) {
                parent.children.push(node);
            }

            //sort marriages
            dTree._sortMarriages(person.marriages, opts);

            // go through marriage
            if (person.marriages) {
                person.marriages.forEach((marriage, index) => {
                    console.log('marriage: ', marriage);
                    const marriageNode = {
                        name: '',
                        id: id++,
                        hidden: true,
                        noParent: true,
                        children: [],
                        extra: marriage.extra,
                        isMarriageNode: true
                    };

                    const sp = marriage.spouse;

                    sp.marriage = marriage;

                    let spouseNode = sp.id ? flattenedNodes.find(_ => _.id === sp.id) : null;

                    if (!spouseNode) {
                        spouseNode = {
                            name: sp.name,
                            id: sp.id ?? id++,
                            hidden: false,
                            noParent: true,
                            children: [],
                            textClass: sp.textClass ? sp.textClass : opts.styles.text,
                            class: sp.class ? sp.class : opts.styles.node,
                            extra: sp.extra,
                            marriageNode: marriageNode
                        };

                        flattenedNodes.push(spouseNode);
                        parent.children.push(marriageNode, spouseNode);
                    } else {
                        spouseNode.marriageNode = marriageNode;
                        parent.children.push(marriageNode);
                    }

                    dTree._sortPersons(marriage.children, opts);
                    marriage.children.forEach((child) => {
                        console.log('marriage: ', marriage, ', child: ', child);
                        reconstructTree(child, marriageNode);
                    });

                    siblings.push({
                        source: {
                            id: node.id
                        },
                        target: {
                            id: spouseNode.id
                        },
                        number: index
                    });
                });
            }
        };

        data.forEach((person) => {
            reconstructTree(person, root);
        });

        const constructResult = {
            root: d3.hierarchy(root),
            siblings: siblings
        };

        console.log('construct result: ', _.cloneDeep(constructResult));

        return constructResult;

    },

    _sortPersons: function (persons, opts) {
        if (persons !== undefined) {
            persons.sort((a, b) => {
                return opts.callbacks.nodeSorter(a, b);
            });
        }
        return persons;
    },

    _sortMarriages: function (marriages, opts) {
        if (marriages !== undefined && Array.isArray(marriages)) {
            marriages.sort((marriageA, marriageB) => {
                const a = marriageA.spouse;
                const b = marriageB.spouse;

                return opts.callbacks.nodeSorter(a, b);
            });
        }
        return marriages;
    }
};
