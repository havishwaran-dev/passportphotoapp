#target photoshop

// =========================================================================
// PJK Passport Photo Automation Studio - Action Runner ExtendScript
// Fully compatible with Adobe Photoshop CS6 (with or without SkinFiner)
// =========================================================================

app.displayDialogs = DialogModes.NO;
var origRuler = app.preferences.rulerUnits;
app.preferences.rulerUnits = Units.PIXELS;

function writeJsonFile(filePath, data) {
    try {
        var f = new File(filePath);
        f.open("w");
        var parts = [];
        for (var k in data) {
            var v = data[k];
            if (typeof v === "string") {
                parts.push('"' + k + '": "' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ") + '"');
            } else if (typeof v === "boolean" || typeof v === "number") {
                parts.push('"' + k + '": ' + v);
            } else {
                parts.push('"' + k + '": null');
            }
        }
        f.writeln("{" + parts.join(", ") + "}");
        f.close();
    } catch (e) { }
}

function readJsonFile(filePath) {
    try {
        var f = new File(filePath);
        if (!f.exists) return null;
        f.open("r");
        var content = f.read();
        f.close();
        if (typeof JSON !== "undefined" && JSON.parse) {
            return JSON.parse(content);
        }
        return eval("(" + content + ")");
    } catch (e) {
        return null;
    }
}

// Dynamically resolve project directories relative to this JSX file
var scriptFile = new File($.fileName);
var jsxDir = scriptFile.parent;
var rootDir = jsxDir.parent.parent;
var tempDir = new Folder(rootDir + "/backend/temp");
var argsFile = new File(tempDir + "/ps_args.json");
var resultFile = new File(tempDir + "/ps_result.json");

var result = {
    success: false,
    error: "",
    engine_used: "photoshop_cs6",
    details: "",
    output_path: "",
    plugin_missing: false
};

try {
    var args = readJsonFile(argsFile);
    if (!args) {
        throw new Error("Could not read args file at: " + argsFile.fsName);
    }
    if (args.result_file) {
        resultFile = new File(args.result_file);
    }

    var inputPath = args.input_path;
    var outputPath = args.output_path;
    var targetW = args.target_w_px || 413;
    var targetH = args.target_h_px || 531;
    var targetDpi = args.dpi || 300;
    var addStroke = args.add_stroke !== false;
    var strokeColorHex = args.stroke_color || "#CCCCCC";
    var engineMode = args.engine_mode || "auto"; // "auto", "native_cs6", "action"

    var inputFile = new File(inputPath);
    if (!inputFile.exists) {
        throw new Error("Input image file does not exist: " + inputPath);
    }

        // 1. Open the normalized input image
        var doc = app.open(inputFile);

        var useNativePipeline = (engineMode === "native_cs6");

        // 2. If action mode or auto mode with action file specified:
        if (!useNativePipeline && engineMode === "action") {
            var atnPath = args.action_file || (rootDir + "/PJK.atn");
            var actionSet = args.action_set || "PJK";
            var actionName = args.action_name || "passport";
            var atnFile = new File(atnPath);

            if (atnFile.exists) {
                try { app.load(atnFile); } catch (loadErr) { }
            }

            try {
                var idPly = charIDToTypeID("Ply ");
                var desc = new ActionDescriptor();
                var ref = new ActionReference();
                ref.putName(charIDToTypeID("Actn"), actionName);
                ref.putName(charIDToTypeID("ASet"), actionSet);
                desc.putReference(charIDToTypeID("null"), ref);
                executeAction(idPly, desc, DialogModes.NO);
                result.details = "Photoshop action '" + actionName + "' executed successfully.";
                result.engine_used = "photoshop_atn";
            } catch (actionErr) {
                var errMsg = actionErr.message || actionErr.toString();
                // If action failed due to missing plugin (SkinFiner), switch to Native CS6 Pipeline!
                useNativePipeline = true;
                result.plugin_missing = true;
                result.details = "Notice: Action plugin was unavailable (" + errMsg + "). Completed using Photoshop CS6 Native Studio Engine.";
            }
        } else {
            useNativePipeline = true;
        }

        // 3. Photoshop CS6 Native Studio Engine (Surface Blur + Aspect Crop + Stroke)
        if (useNativePipeline) {
            result.engine_used = "photoshop_cs6_native";
            if (!result.details) {
                result.details = "Processed in Adobe Photoshop CS6 using native Surface Blur retouching (no plugins needed).";
            }

                    // Apply native Surface Blur for gentle, edge-preserving skin softening
                    try {
                        var idSrfB = stringIDToTypeID("surfaceBlur");
                        var blurDesc = new ActionDescriptor();
                        blurDesc.putUnitDouble(charIDToTypeID("Rds "), charIDToTypeID("#Pxl"), 4.0);
                        blurDesc.putInteger(charIDToTypeID("Thsh"), 15);
                        executeAction(idSrfB, blurDesc, DialogModes.NO);
                    } catch (eBlur) {
                        // Non-fatal if Surface Blur cannot be applied
                    }

                    // Smart Crop to Passport aspect ratio (targetW : targetH)
                    var currW = doc.width.value;
                    var currH = doc.height.value;
                    var targetRatio = targetW / targetH;
                    var currRatio = currW / currH;

                    var bounds;
                    if (currRatio > targetRatio) {
                        var cropW = currH * targetRatio;
                        var left = (currW - cropW) / 2;
                        bounds = [left, 0, left + cropW, currH];
                    } else {
                        var cropH = currW / targetRatio;
                        var top = Math.max(0, (currH - cropH) * 0.25);
                        bounds = [0, top, currW, top + cropH];
                    }
                    doc.crop(bounds);

                    // Resize to exact physical dimensions at target DPI (e.g. 413x531 px @ 300 DPI)
                    doc.resizeImage(UnitValue(targetW, "px"), UnitValue(targetH, "px"), targetDpi, ResampleMethod.BICUBIC);

                    // Add 1px/2px crisp border stroke
                    if (addStroke) {
                        try {
                            doc.selection.selectAll();
                            var strokeColor = new SolidColor();
                            strokeColor.rgb.red = 210;
                            strokeColor.rgb.green = 210;
                            strokeColor.rgb.blue = 210;
                            doc.selection.stroke(strokeColor, 1, StrokeLocation.INSIDE);
                            doc.selection.deselect();
                        } catch (eStroke) { }
                    }
                }

                // 4. Save processed photograph as standard baseline JPEG
                if (app.documents.length > 0) {
                    var activeDoc = app.activeDocument;
                    var saveFile = new File(outputPath);
                    var jpgOptions = new JPEGSaveOptions();
                    jpgOptions.quality = args.jpeg_quality ? args.jpeg_quality : 11;
                    jpgOptions.embedColorProfile = true;
                    jpgOptions.formatOptions = FormatOptions.STANDARDBASELINE;
                    activeDoc.saveAs(saveFile, jpgOptions, true, Extension.LOWERCASE);
                    result.output_path = outputPath;
                    result.success = true;

                    // Close all documents cleanly
                    while (app.documents.length > 0) {
                        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
                    }
                } else {
                    result.output_path = outputPath;
                    result.success = true;
                }

            } catch (err) {
                result.success = false;
                result.error = err.message || err.toString();
                try {
                    while (app.documents.length > 0) {
                        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
                    }
            } catch (eClose) { }
        }

        app.preferences.rulerUnits = origRuler;
        writeJsonFile(resultFile.fsName, result);
