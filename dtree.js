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

        this.nodeSize = opts.callbacks.nodeSize(visibleNodes, opts.nodeWidth, opts.nodeHeight, opts.callbacks.textRenderer);
        console.log('this.nodeSize: ', this.nodeSize);
    }

    create() {
        let opts = this.opts;
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
        this.tree = d3.tree().nodeSize([nodeSize[0] * 2, nodeSize[1] * 2]);

        this.tree.separation((a, b) => {
            console.log('separation: ', _.cloneDeep(a), _.cloneDeep(b));
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
        this.svg.selectAll('.link')
            .data(links)
            .enter()
            // filter links with no parents to prevent empty nodes
            // .filter(l => !l.target.data.noParent)
            .append('path')
            .attr('class', function (d) {
                return opts.styles.linage + ' ' + d.source.data.name.toLowerCase().replace(/ /g, '_') + '-' + d.target.data.name.toLowerCase().replace(/ /g, '_');
            })
            .attr('d', this._elbow);

        let nodes = this.svg.selectAll('.node').data(treenodes.descendants()).enter();

        this._linkSiblings();

        // Draw siblings (marriage)
        this.svg.selectAll('.sibling')
            .data(this.siblings)
            .enter()
            .append('path')
            .attr('class', function (d) {
                const isDivorced = d.source.marriageNode.data.divorced ||
                    d.target.marriageNode.data.divorced;

                return opts.styles.marriage + ` ${isDivorced ? ' divorced-marriage' : ''}`;
            })
            .attr('d', _.bind(this._siblingLine, this));

        // Create the node rectangles.
        nodes.append('foreignObject')
            .filter(d => !d.data.hidden)
            .attr('x', function (d) {
                console.log(`drawing node: ${d.data.name}`, d);
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
                    d.data.className,
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
            //
            // if (!node.id) {
            //     node.id = ++i;
            // }
            n.push(node);
        }

        recurse(root);
        return n;
    }

    _elbow(d, i) {
        if (d.target.data.noParent) {
            return 'M0,0L0,0';
        }

        let ny = Math.round(d.target.y + (d.source.y - d.target.y) * 0.50);

        let linedata = [
            {
                x: d.target.x,
                y: d.target.y
            },
            {
                x: d.target.x,
                y: ny
            },
            {
                x: d.source.x,
                y: d.source.y
            }
        ];

        let fun = d3.line().curve(d3.curveStepAfter)
            .x(d => d.x)
            .y(d => d.y);
        return fun(linedata);
    }

    _linkSiblings() {
        let allNodes = this.allNodes;

        this.siblings.forEach((sibling) => {
            let start = allNodes.find((v) => sibling.source.id === v.data.id);
            let end = allNodes.find((v) => sibling.target.id === v.data.id);

            if (start) {
                sibling.source.x = start.x;
                sibling.source.y = start.y;
            }

            if (end) {
                sibling.target.x = end.x;
                sibling.target.y = end.y;
            }

            let marriageId = (start.data.marriageNode != null ? start.data.marriageNode.id : end.data.marriageNode.id);

            let marriageNode = allNodes.find((n) => n.data.id === marriageId);

            sibling.source.marriageNode = marriageNode;
            sibling.target.marriageNode = marriageNode;
        });

    }

    _siblingLine(d, i) {
        let ny = Math.round(d.target.y + (d.source.y - d.target.y) * 0.50);
        let nodeWidth = this.nodeSize[0];
        let nodeHeight = this.nodeSize[1];

        // Not first marriage
        if (d.number > 0) {
            ny -= Math.round(nodeHeight * .55 * d.number);
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
            .x(d => d.x)
            .y(d => d.y);
        return fun(linedata);
    }

    static _nodeSize(nodes, width, height, textRenderer) {
        let maxWidth = 0;
        let maxHeight = height;
        let tmpSvg = document.createElement('svg');
        document.body.appendChild(tmpSvg);

        nodes.map(node => {
            let container = document.createElement('div');
            container.setAttribute('class', node.data.className);
            container.style.visibility = 'hidden';
            container.style.maxWidth = width + 'px';

            let text = textRenderer(node.data, node.data.name, node.data.extra, node.data.textClass);
            container.innerHTML = text;

            tmpSvg.appendChild(container);
            let height = container.getBoundingClientRect().height;
            tmpSvg.removeChild(container);

            maxHeight = Math.max(maxHeight, height);
            node.cHeight = maxHeight;
            if (node.data.hidden) {
                node.cWidth = 0;
            } else {
                node.cWidth = width;
            }
        });
        document.body.removeChild(tmpSvg);

        return [width, maxHeight];
    }

    static _nodeRenderer(nodeData, name, x, y, height, width, extra, id, nodeClass, textClass, textRenderer) {
        return `<div class="${nodeClass}" id="node${id}"> ${textRenderer(nodeData, name, extra, textClass)}</div>`;
    }

    static _textRenderer(nodeData, name, extra, textClass) {
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
                nodeRenderer: function (nodeData, name, x, y, height, width, extra, id, nodeClass, textClass, textRenderer) {
                    return TreeBuilder._nodeRenderer(nodeData,
                        name,
                        x,
                        y,
                        height,
                        width,
                        extra,
                        id,
                        nodeClass,
                        textClass,
                        textRenderer);
                },
                nodeSize: function (nodes, width, height, textRenderer) {
                    return TreeBuilder._nodeSize(nodes, width, height, textRenderer);
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
            name: '--root--',
            id: id++,
            hidden: true,
            children: [],
            isRoot: true
        };

        const flattenedNodes = [];

        const reconstructTree = function (person, parentNode, lv = 0) {
            // find the node in existing nodes
            let node = person.id ? flattenedNodes.find(_ => _.id === person.id) : null;

            const nodeAlreadyExists = node !== null;

            // create node if not exists
            if (!nodeAlreadyExists) {
                node = {
                    name: person.name,
                    id: person.id ?? id++,
                    hidden: false,
                    children: [],
                    extra: person.extra,
                    textClass: person.textClass ? person.textClass : opts.styles.text,
                    className: person.className ? person.className : opts.styles.node
                };

                flattenedNodes.push(node);
                person.treeNode = node;
            }

            // hide linages to the hidden root node
            node.noParent = parentNode === root;

            if (nodeAlreadyExists) {
                // if the node exists already, check if it was spouse node and it was managed in another branch
                // if yes then we take it out from the other branch and add to the current one
                // eg: father is maternal grandparents' son-in-law so it was managed initially under maternal family.
                // then if we add paternal grandparents, it should be managed under paternal family
                if (!!person.isSpouse && node.parentNode && node.parentNode.children) {
                    // take out from original family
                    node.parentNode.children = _.without(node.parentNode.children, node);
                }
            }

            // add it to the current family
            parentNode.children.push(node);
            node.parentNode = parentNode;

            // sort children
            dTree._sortPersons(person.children, opts);

            // add "direct" children
            if (person.children && !person.childrenProcessed) { // if the node is duplicated, don't process children nodes again
                person.children.forEach((child) => {
                    reconstructTree(child, node, lv + 1); // recursive call
                });
                person.childrenProcessed = true;
            }

            //sort marriages
            dTree._sortMarriages(person.marriages, opts);

            // go through marriage
            if (person.marriages) {
                person.marriages.forEach((marriage, index) => {
                    const marriageNode = {
                        name: 'Marriage Node of ' + person.name,
                        id: id++,
                        hidden: true,
                        noParent: true,
                        children: [],
                        extra: marriage.extra,
                        isMarriageNode: true,
                        divorced: !!marriage.divorced
                    };

                    const sp = marriage.spouse;

                    marriageNode.name += ' and ' + sp.name;
                    sp.isSpouse = true;
                    sp.divorced = marriage.divorced;

                    // look for the spouse node in the list, it maybe exists due to the other branch's set up
                    let spouseNode = sp.id ? flattenedNodes.find(_ => _.id === sp.id) : null;
                    let spouseNodeAlreadyExists = true;
                    if (!spouseNode) {
                        spouseNodeAlreadyExists = false;
                        spouseNode = {
                            name: sp.name,
                            id: sp.id ?? id++,
                            hidden: false,
                            noParent: true,
                            children: [],
                            textClass: sp.textClass ? sp.textClass : opts.styles.text,
                            className: sp.className ? sp.className : opts.styles.node,
                            extra: sp.extra,
                            isSpouseNode: !!sp.isSpouse
                        };
                        // put to the nodes if not found, so we have only 1 object of the spouse node
                        flattenedNodes.push(spouseNode);
                    } else {
                        // if the spouse found, now it has to have parent linked
                        if (spouseNode.noParent) {
                            spouseNode.noParent = false;
                        }
                    }

                    if (sp.divorced) {
                        spouseNode.className += ' divorce-marriage';
                    }

                    // connect spouse to its partner
                    spouseNode.marriageNode = marriageNode;

                    if (!spouseNodeAlreadyExists) {
                        // if the spouse was not in the nodes list, keep track if the parent node,
                        // as the spouse can be child of another marriage, eg father can be paternal grandparents' child
                        parentNode.children.push(marriageNode, spouseNode);
                        spouseNode.parentNode = parentNode;
                    } else {
                        // only keep track of the marriage node as the spouse node was managed in the other branch
                        parentNode.children.push(marriageNode);
                    }

                    if (marriage.children && marriage.children.length) {
                        // process the children of that marriage
                        dTree._sortPersons(marriage.children, opts);
                        marriage.children.forEach((child) => {
                            reconstructTree(child, marriageNode, lv + 1);
                        });
                    }

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
