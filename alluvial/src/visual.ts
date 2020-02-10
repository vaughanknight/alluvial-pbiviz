/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

import { VisualSettings } from "./settings";
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import * as d3 from "d3";
import * as d3Sankey from 'd3-sankey';
import * as d3ScaleChromatic from 'd3-scale-chromatic';
import { packEnclose, color } from "d3";
type Selection<T extends d3.BaseType> = d3.Selection<T, any, any, any>;

// Alluvial PowerBI Visual
export class Visual implements IVisual {
    private target: HTMLElement;

    private settings: VisualSettings;

    private host: IVisualHost;
    private svg: Selection<SVGElement>;
    private defs: d3.Selection<SVGDefsElement, any, any, any>;

    private _data: AlluvialDataModel;

    public link: Selection<SVGElement>;
    public node: Selection<SVGElement>;

    private visualSettings: VisualSettings;

    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
        this.svg = d3.select(options.element)
            .append('svg');
    }

    public update(options: VisualUpdateOptions) {
        let dataView: DataView = options.dataViews[0];

        let powerBiStepsData = dataView.categorical.categories.filter(function (category) {
            return category.source.roles["dr_values"];
        });

        let powerBiSizeData: powerbi.DataViewValueColumn;
        if (dataView.categorical.values.length > 0) {
            var sizeValues = dataView.categorical.values.filter(function (value) {
                return value.source.roles["dr_size"]; 
            });
            if (sizeValues.length > 0) {
                powerBiSizeData = sizeValues[0];
                console.log(powerBiSizeData);
            }
        }

        // Reset and clear
        this._resetAndClearSVG(options);

        // Do nothing if we don't have at least 2 columns of data 
        if (powerBiStepsData.length < 2)
            return;

        // Parse the settings
        this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);

        // Create the node data
        let nodeData = this._getNodeData(powerBiStepsData);

        // Create the link data 
        let linkData: Array<SLinkExtra> = this._getLinkData(nodeData, powerBiStepsData, powerBiSizeData);

        // Data 
        this._data = {
            "nodes": nodeData,
            "links": linkData
        };

        // Calculating the best nodePadding (TODO: improve)
        var nested = d3.nest<SNodeExtra, number>()
            .key(function (d: SNodeExtra): string {
                return d.group;
            })
            .rollup(function (d) {
                return d.length;
            })
            .entries(this._data.nodes);

        var maxNodes = d3.max(nested, function (d) {
            return d.values;
        });

        // Get width and height and set padding 
        var width = +this.svg.attr("width");
        var height = +this.svg.attr("height");
        var bestPadding = d3.min([10, (height - maxNodes) / maxNodes])

        // Define numbers formatting
        var formatNumber = d3.format(",.0f"),
            format = function (d: any) { return formatNumber(d) + " !"; };

        // Create the sankey
        // TODO: option to change node width 
        var sankey = d3Sankey.sankey()
            .nodeWidth(10)
            .nodePadding(bestPadding)
            .size([width, height * 0.9]); // TODO: 0.9 multiplier is because height calculations seem to not be 100%, so 0.9 is to avoid clipping of the SVG

        // Create links generator
        var linksParent = this._createLinksParent();

        // Create the nodes generator 
        var nodesParent = this._createNodesParent();

        // Generate the sankey from the data 
        sankey(this._data);

        // TODO: Clean this up 
        this._data.nodes.forEach(function (d: SNodeExtra) {
            // Set width and heigh of each node
            d.dx = d.x1 - d.x0;
            d.dy = d.y1 - d.y0;

            // Check if the name is a number
            // TODO: doesn't work in typescript 
            // all the time for some reason
            // if (!isNaN(+d.name)) {
            //     d.name = +d.name;
            // }
        })

        // Sort the nodes based on the sorting algorithm i.e. 
        // Size, Alphagetical, Efficiency
        // TODO: sorting
        this._sortNodes(sankey, this._data);

        // Create the links 
        this._generateLinks(linksParent, this._data, format, this._getNodeColor);

        // Create the nodes
        this._generateNodes(nodesParent, this._data, format, width, this._getNodeColor);

        // Add the gradients to the links
        // TODO: option to not have gradient
        this._gradientLinks(linksParent, this._data, this._getNodeColor);

    }

    private _getNodeColor(d: SNodeExtra, data: AlluvialDataModel): string {
        
        // TODO: Add preconfigured colour ranges
        // TODO: Add step independent colour ranges
        // var color = d3.interpolateRgb("#50E6FF", "#243A5E");
        var color = d3.interpolateCubehelix("#AC0086", "#FFA500");
        
        var colorGenerator = d3.scaleSequential(color).domain([0, 1]);

        var groupList = data.nodes.filter(function (n) {
            return n.group == d.group;
        });

        var itemIndex = groupList.map(function (n) { return n.name; }).indexOf(d.name);
        var colorValue = itemIndex / groupList.length;

        return colorGenerator(colorValue);
    }

    private _getLinkData(nodeData: SNodeExtra[], powerBiStepsData: powerbi.DataViewCategoryColumn[], sizeData: powerbi.DataViewValueColumn) {
        let linkData: Array<SLinkExtra> = [];

        // For all steps
        for (var i = 0; i < powerBiStepsData.length - 1; i++) {
            let fromValues = powerBiStepsData[i].values;
            let toValues = powerBiStepsData[i+1].values;
            let sizes = sizeData.values;

            // For each node in this step
            for (var j = 0; j < fromValues.length; j++) {
                var sourceIndex = nodeData.map(function (n) { return n.name; }).indexOf(fromValues[j].toString());
                var targetIndex = nodeData.map(function (n) { return n.name; }).indexOf(toValues[j].toString());
                var sourceNode = nodeData[sourceIndex];
                var targetNode = nodeData[targetIndex];

                linkData.push({ source: sourceNode, target: targetNode, value: +sizes[j] });
            }
        }
        return linkData;
    }

    private _getNodeData(powerBiNodeData: powerbi.DataViewCategoryColumn[]) {
        var nodeData: Array<SNodeExtra> = [];
        for (var i = 0; i < powerBiNodeData.length; i++) {
            var values = powerBiNodeData[i].values.filter(this._onlyUnique);
            for (var j = 0; j < values.length; j++) {
                var theGroup: string = powerBiNodeData[i].source.displayName;
                var theName: string = values[j].toString();
                nodeData.push({ name: theName, group: theGroup, dx: 0, dy: 0, x0: 0, x1: 0, y0: 0, y1: 0 });
            }
        }
        return nodeData;
    }

    private _resetAndClearSVG(options: VisualUpdateOptions) {
        // Reset the width and height
        this.svg.attr("width", options.viewport.width)
            .attr("height", options.viewport.height);

        // Clear the SVG completely 
        this.svg.selectAll("*").remove();

        // Add back in the def's element
        this.defs = this.svg.append('defs');
    }

    private _generateLinks(linksParent, data, format, colorFunction) {

        var gid = this._getGradId;

        linksParent = linksParent
            .data(data.links)
            .enter().append("path")
            .attr("d", d3Sankey.sankeyLinkHorizontal())
            .style("stroke", function (d: SLinkExtra) {
                var stroke = `url(#${gid(d)})`;
                return stroke;
            })
            .attr("stroke-width", function (d: any) { 
                return Math.max(1, d.width); });

        linksParent.append("title")
            .text(function (d: any) { return d.source.name + " → " + d.target.name + "\n" + format(d.value); });
    }

    // Generate a unique ID which is used for gradients
    private _getGradId(d: SLinkExtra) {
        var s = (d.source as unknown) as SNodeExtra;
        var t = (d.target as unknown) as SNodeExtra;

        var id = `${s.name}-${t.name}`;
        id = id.replace(/\s/g, '');

        return id;
    }

    // Applies the gradient to the all the links
    private _gradientLinks(linksParent, data: AlluvialDataModel, colorFunction) {
        var _defs = this.defs;

        var _getGradId = this._getGradId;

        var grads = _defs.selectAll("linearGradient")
            .data(data.links);

        var linGrads = grads.enter().append("linearGradient")
            .attr("id", _getGradId)
            .attr("gradientUnits", "userSpaceOnUse")

        linGrads.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", function (link: SLinkExtra) {
                return colorFunction(link.source, data);
            })

        linGrads.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", function (link: SLinkExtra) {
                return colorFunction(link.target, data);
            })

        linGrads.attr("x1", function (d) { return d.source.x0; })
            .attr("y1", function (d) { return d.source.y0; })
            .attr("x2", function (d) { return d.target.x1; })
            .attr("y2", function (d) { return d.target.y1; });
    }

    // Generates all the nodes and node labels in the sankey
    private _generateNodes(nodesParent, data, format, width, colorFunction) {
        
        nodesParent = nodesParent
            .data(data.nodes)
            .enter().append("g");

        nodesParent.append("rect")
            .attr("x", function (d: any) { return d.x0; })
            .attr("y", function (d: any) { return d.y0; })
            .attr("height", function (d: any) { return d.y1 - d.y0; })
            .attr("width", function (d: any) { return d.x1 - d.x0; })
            .attr("fill", function (d: any, i: number, n: any) {
                return colorFunction(d, data);
            })
            .attr("stroke", "#000");
        
        // TODO: option to not have text i.e. anonymous data 
        nodesParent.append("text")
            .attr("x", function (d: any) { return d.x0 - 6; })
            .attr("y", function (d: any) { return (d.y1 + d.y0) / 2; })
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .text(function (d: any) {
                return d.name; 
            })
            .attr("font-family", "Arial, Helvetica")
            .attr("font-size", 15)
            .filter(function (d: any) { return d.x0 < width / 2; })
            .attr("x", function (d: any) { return d.x1 + 6; })
            .attr("text-anchor", "start");

        // TODO: option to not have text i.e. anonymous data 
        nodesParent.append("title")
            .text(function (d: any) { return d.name + "\n" + format(d.value); });
    }

    private _createNodesParent() {
        return this.svg.append("g")
            .attr("class", "nodes")
            .attr("font-family", "sans-serif")
            .attr("font-size", 10)
            .selectAll("g");
    }

    private _createLinksParent() {
        return this.svg.append("g")
            .attr("class", "links")
            .attr("fill", "none")
            .attr("stroke", "#000")
            .attr("stroke-opacity", 0.4)
            .selectAll("path");
    }

    private _sortNodes(sankey: d3Sankey.SankeyLayout<d3Sankey.SankeyGraph<{}, {}>, {}, {}>, data: AlluvialDataModel) {
        
        var nested = d3.nest<SNodeExtra, number>()
            .key(function (d: SNodeExtra) {
                return d.group;
            })
            .entries(data.nodes)
        nested
            .forEach(function (nestedNodes) {

                // TODO: Previous code used for align middle.  Add back in.
                // var y = (height() - d3.sum(d.values, function(n) {
                //     return n.dy + sankey.nodePadding();
                // })) / 2 + sankey.nodePadding() / 2;

                // This is to make it flat across the top
                // which is great for reports, but may not 
                // be wanted for web
                // TODO: Add align top, align bottom, and align middle
                var y = 0;
                var sortBy: String = "size";

                nestedNodes.values.sort(function (a, b) {
                    if (sortBy == "automatic") return b.y0 - a.y0;
                    if (sortBy == "size") return b.dy - a.dy;
                    //if (sortBy() == "name") return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
                    if (sortBy == "name") {
                        var a1 = typeof a.name,
                            b1 = typeof b.name;
                        return a1 < b1 ? -1 : a1 > b1 ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
                    }
                })

                nestedNodes.values.forEach(function (node) {
                    node.y0 = y;
                    node.y1 = node.y0 + node.dy;
                    y += node.dy + sankey.nodePadding();
                })
            })

        // Re-sort the links now the nodes have been all sorted
        nested.forEach(function (d) {

            d.values.forEach(function (node) {

                var ly = node.y0;

                node.sourceLinks
                    .sort(function (a, b) {
                        return a.target.y0 - b.target.y0;
                    })
                    .forEach(function (link) {
                        link.y0 = ly + link.width / 2;
                        ly += link.width;
                    })

                ly = node.y0;

                node.targetLinks
                    .sort(function (a, b) {
                        return a.source.y0 - b.source.y0;
                    })
                    .forEach(function (link) {
                        link.y1 = ly + link.width / 2;
                        ly += link.width;
                    })
            })
        })
    }

    private _onlyUnique(value: any, index: number, self: Array<any>): boolean {
        return self.indexOf(value) === index;
    }

    private static parseSettings(dataView: DataView): VisualSettings {
        return <VisualSettings>VisualSettings.parse(dataView);
    }

    /**
     * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
     * objects and properties you want to expose to the users in the property pane.
     *
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        const settings: VisualSettings = this.visualSettings || <VisualSettings>VisualSettings.getDefault();
        return VisualSettings.enumerateObjectInstances(settings, options);
    }

}

interface SNodeExtra {
    // nodeId: number;
    name: string;
    group: string;
    dx: number;
    dy: number;
    x0: number;
    x1: number;
    y0: number;
    y1: number;
}

interface SLinkExtra {
    source: SNodeExtra;
    target: SNodeExtra;
    value: number;
}

type SNode = d3Sankey.SankeyNode<SNodeExtra, SLinkExtra>;
type SLink = d3Sankey.SankeyLink<SNodeExtra, SLinkExtra>;

interface AlluvialDataModel {
    nodes: SNode[];
    links: SLink[];
}


