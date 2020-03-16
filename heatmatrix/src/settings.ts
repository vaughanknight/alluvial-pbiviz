/*
 *  Power BI Visualizations
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

import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class CircleSettings {
  public circleColor: boolean = true;
  public circleThickness: boolean = false;
}
export class GradientSettings
{
  public useGradient: boolean = true;
  public startColor: string = "#AC0086";
  public endColor: string = "#FFA500";
}

export enum AlluvialSortBy {
  None = <any>"none",
  Size = <any>"size",
  Automatic = <any>"automatic",
  Name = <any>"name"
}

export enum AlluvialColors
{
  Gradient = <any>"gradient",
  Ordinal = <any>"ordinal"
}

export enum BasicColorInterpolation
{
  interpolateBuGn = <any>"interpolateBuGn",
  interpolateBuPu = <any>"interpolateBuPu",
  interpolateGnBu = <any>"interpolateGnBu",
  interpolateOrRd = <any>"interpolateOrRd",
  interpolatePiYG = <any>"interpolatePiYG",
  interpolatePuBuGn = <any>"interpolatePuBuGn",
  interpolatePuBu = <any>"interpolatePuBu",
  interpolatePuOr = <any>"interpolatePuOr",
  interpolatePuRd = <any>"interpolatePuRd",
  interpolateRdPu = <any>"interpolateRdPu",
  interpolateRdYlGn = <any>"interpolateRdYlGn",
  interpolateRdBu = <any>"interpolateRdBu",
  interpolateRdYlBu = <any>"interpolateRdYlBu",
  interpolateYlGn = <any>"interpolateYlGn",
  interpolateYlGnBu = <any>"interpolateYlGnBu",
  interpolateYlOrRd = <any>"interpolateYlOrRd",
  interpolateYlOrBr = <any>"interpolateYlOrBr",
  interpolateViridis = <any>"interpolateViridis",
  interpolateCool = <any>"interpolateCool",
  interpolateCubehelixDefault = <any>"interpolateCubehelixDefault",
  interpolateWarm = <any>"interpolateWarm",
  interpolateSpectral = <any>"interpolateSpectral",
  interpolateRainbow = <any>"interpolateRainbow",
  interpolatePlasma = <any>"interpolatePlasma",
  interpolateMagma = <any>"interpolateMagma",
  interpolateInferno = <any>"interpolateInferno",
  interpolateBlues = <any>"interpolateBlues",
  interpolateReds = <any>"interpolateReds",
  interpolateGreens = <any>"interpolateGreens",
  interpolateGreys = <any>"interpolateGreys",
  interpolatePurples = <any>"interpolatePurples",
  interpolateOranges = <any>"interpolateOranges"  
}

export class AlluvialSettings
{
  public lineOpacity: number = 0.4;
  public sorting: AlluvialSortBy = AlluvialSortBy.Size;
  public colorSettings : AlluvialColors = AlluvialColors.Ordinal;
  public predfinedInterpolation : BasicColorInterpolation = BasicColorInterpolation.interpolateBlues;
}

export class VisualSettings extends DataViewObjectsParser {
  public circle: CircleSettings = new CircleSettings();
  public lineGradient: GradientSettings = new GradientSettings();
  public alluvial: AlluvialSettings = new AlluvialSettings();
}



