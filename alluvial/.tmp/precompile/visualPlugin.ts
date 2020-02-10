import { Visual } from "../../src/visual";
import powerbiVisualsApi from "powerbi-visuals-api"
import IVisualPlugin = powerbiVisualsApi.visuals.plugins.IVisualPlugin
import VisualConstructorOptions = powerbiVisualsApi.extensibility.visual.VisualConstructorOptions
var powerbiKey: any = "powerbi";
var powerbi: any = window[powerbiKey];

var d3test00CB9A74B1F34FDCA219CB28AC237F91_DEBUG: IVisualPlugin = {
    name: 'd3test00CB9A74B1F34FDCA219CB28AC237F91_DEBUG',
    displayName: 'd3test',
    class: 'Visual',
    apiVersion: '2.6.0',
    create: (options?: VisualConstructorOptions) => {
        if (Visual) {
            return new Visual(options);
        }

        throw 'Visual instance not found';
    },
    custom: true
};

if (typeof powerbi !== "undefined") {
    powerbi.visuals = powerbi.visuals || {};
    powerbi.visuals.plugins = powerbi.visuals.plugins || {};
    powerbi.visuals.plugins["d3test00CB9A74B1F34FDCA219CB28AC237F91_DEBUG"] = d3test00CB9A74B1F34FDCA219CB28AC237F91_DEBUG;
}

export default d3test00CB9A74B1F34FDCA219CB28AC237F91_DEBUG;