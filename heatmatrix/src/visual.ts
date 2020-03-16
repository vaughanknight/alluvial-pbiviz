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

import { VisualSettings, AlluvialSortBy, AlluvialColors } from './settings';
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import * as d3 from "d3";
import * as d3Sankey from 'd3-sankey';
import * as d3ScaleChromatic from 'd3-scale-chromatic';
import { packEnclose, color } from "d3";
type Selection<T extends d3.BaseType> = d3.Selection<T, any, any, any>;

/**
 * Alluvial PowerBI Custom Visual to generate
 * highly compelling alluvial diagrams for PowerBI.
 */
export class Visual implements IVisual {
    private target: HTMLElement;

    // private settings: VisualSettings;

    private host: IVisualHost;
    private svg: Selection<SVGElement>;
    private defs: d3.Selection<SVGDefsElement, any, any, any>;

    private _data: DataModel;

    public link: Selection<SVGElement>;
    public node: Selection<SVGElement>;

    private visualSettings: VisualSettings;

    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
        this.svg = d3.select(options.element)
            .append('svg');
    }

    /**
     * PowerBI Update Method called from PowerBI when the control is 
     * updated.
     * @param options PowerBI VisualUpdateOptions
     */
    public update(options: VisualUpdateOptions) {
        let dataView: DataView = options.dataViews[0];

        let powerBiStepsData = dataView.categorical.categories.filter(function (category) {
            return category.source.roles["dr_values"];
        });

        // console.log("STEP: Have steps.");
        // console.log(powerBiStepsData);

        let powerBiSizeData: powerbi.DataViewValueColumn;

        if (dataView.categorical.categories.length > 0) {

            // console.log("STEP: length > 0.");

            if (dataView.categorical.values) {
                var sizeValues = dataView.categorical.values.filter(function (value) {
                    return value.source.roles["dr_size"];
                });
                if (sizeValues.length > 0) {
                    powerBiSizeData = sizeValues[0];

                }
            }
        }

        // console.log("STEP: Have tried size.");

        // Reset and clear
        this._resetAndClearSVG(options);

        // Do nothing if we don't have at least 2 columns of data 
        if (powerBiStepsData.length < 2)
            return;

        this.visualSettings = VisualSettings.parse<VisualSettings>(dataView);

        // Get width and height and set padding 
        var width = +this.svg.attr("width");
        var height = +this.svg.attr("height");

        var colourFunction = this._getColourFunction();

        // Groups are all the first value
        // Variables are all the next value
        // Values are the group/value number
        var powerBiValuesData = dataView.categorical.categories.filter(function (category) {
            return category.source.roles["dr_values"];
        });
        console.log(powerBiValuesData);

        // Labels of row and columns
        var allGroupEntries: readonly string[] = powerBiValuesData[0].values.map(function (s) { return s.toString(); });
        var groupList = allGroupEntries.filter(this._onlyUnique);

        var groupLabels = groupList.map( function(d) { return d.substr(0, 3); });


        var allVariableEntries: readonly string[] = powerBiValuesData[1].values.map(function (s) { return s.toString(); });
        var variableList = allVariableEntries.filter(this._onlyUnique);
        var variableLabels = variableList.map( function(d) { return d.substr(0, 3); });

        var allValueEntries = powerBiValuesData[2].values;

        var relationships: Relationship[] = [];

        for (var i = 0; i < allGroupEntries.length; i++) {
            relationships.push({
                "group": allGroupEntries[i] ? allGroupEntries[i].toString() : "",
                "variable": allVariableEntries[i] ? allVariableEntries[i].toString() : "",
                "value": +allValueEntries[i]
            });
        }

        var dataModel: DataModel = { "relationships": relationships };

        var axisPadding = 250;
        var padding = 0.05;
        var fontSize = "18px";

        // Build X scales and axis:
        var x = d3.scaleBand()
            .range([0, width - axisPadding])
            .domain(groupList)
            .padding(padding);

        this.svg.append("g")
            .attr("transform", "translate(" + axisPadding + "," + (height - axisPadding) + ")")
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("y", 0)
            .attr("x", -9)
            .attr("dy", "1em")
            .attr("font-size", fontSize)
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

        // Build X scales and axis:
        var y = d3.scaleBand()
            .range([height - axisPadding, 0])
            .domain(variableList)
            .padding(padding);

        this.svg.append("g")
            .attr("transform", "translate(" + axisPadding + ", 0)")
            .call(d3.axisLeft(y))
            .attr("font-size", fontSize);

        var _svg = this.svg;

        // Read the data
        _svg.selectAll()
            .data(dataModel.relationships, function (d) { return d.group + ':' + d.variable; })
            .enter()
            .append("rect")
            .attr("x", function (d) { return x(d.group) + axisPadding })
            .attr("y", function (d) { return y(d.variable) })
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            .style("fill", function (d) { return colourFunction(+d.value) });
    }

    private _getColourFunction(): any {
        return d3.scaleSequential(d3[this.visualSettings.alluvial.predfinedInterpolation])
            .domain([0, 5]);
    }

    /**
     * Gets the node color based on the current color configuration
     * @param d The node to calculate the desired color
     * @param data The overall data model
     * @param visualSettings Visual settings that contain the color configuration
     */
    private _getNodeColor(d: Relationship, data: DataModel, visualSettings: VisualSettings): string {
        var colors: { (t: number): string; }[] = [d3.interpolateRgb("#50E6FF", "#243A5E"),
        d3.interpolateCubehelix("#50E6FF", "#3B2E58"), // Cyan to Dark Purple
        d3.interpolateCubehelix("#9BF00B", "#274B47"), // Yellow/green to dark jade
        d3.interpolateCubehelix("#AC0086", "#FFA500")];

        var color = d3.interpolateRgb("#50E6FF", "#243A5E");

        var relationshipList = data.relationships.filter(function (n) {
            return n.group == d.group;
        }).filter(this._onlyUnique);

        var variableList = relationshipList.map(function (n) { return n.group; });
        var itemIndex = variableList.indexOf(d.group);
        var colorValue = (itemIndex + 3) / relationshipList.length;

        switch (visualSettings.alluvial.colorSettings) {
            case AlluvialColors.Ordinal:
                {
                    // Predfined interpolations have the interpolation method available
                    // in d3, so d3[interpolationString] will match
                    var colorOrdinal = d3[visualSettings.alluvial.predfinedInterpolation];
                    return colorOrdinal(colorValue);
                }
            case AlluvialColors.Gradient:
                {
                    if (visualSettings && visualSettings.lineGradient.useGradient) {
                        color = d3.interpolateCubehelix(visualSettings.lineGradient.startColor.toString(),
                            visualSettings.lineGradient.endColor.toString());
                    }

                    var colorScale = d3.scaleSequential(color).domain([0, 1]);

                    return colorScale(colorValue);
                }
        }

    }


    /**
     * Clears and resets to the default  SVG.  
     * Also reconfigures it with the width and height.
     * @param options The VisualUpdateOptions that contains the width and height
     */
    private _resetAndClearSVG(options: VisualUpdateOptions) {


        // Clear the SVG completely 
        this.svg.selectAll("*").remove();

        // Reset the width and height
        this.svg.attr("width", options.viewport.width)
            .attr("height", options.viewport.height);
        //   .append("g")
        //   .attr("transform",
        //       "translate(100, 5)");

        // Add back in the def's element
        this.defs = this.svg.append('defs');
    }

    /** Creates the nodes parent object in the SVG */
    private _createNodesParent() {
        return this.svg.append("g")
            .attr("class", "nodes")
            .attr("font-family", "sans-serif")
            .attr("font-size", 10)
            .selectAll("g");
    }

    /**
     * Creates the links parent object in the SVG
     */
    private _createLinksParent() {
        var opacity = this.visualSettings.alluvial.lineOpacity;
        return this.svg.append("g")
            .attr("class", "links")
            .attr("fill", "none")
            .attr("stroke", "#000")
            .attr("stroke-opacity", opacity)
            .selectAll("path");
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

interface Relationship {
    group: string;
    variable: string;
    value: number;
}

/**
 * Basic Data Model
 */
interface DataModel {
    relationships: Relationship[];
}


